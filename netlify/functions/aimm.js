/* ------------------------------------------------------------------
   AIMM — Ali's Retrieval-Augmented Generation (RAG) Portfolio Agent
   Serverless Netlify Function at /.netlify/functions/aimm
   
   Architecture:
   1. Ingests & indexes Ali's full portfolio knowledge base using RagEngine.
   2. Performs hybrid retrieval (BM25 + Dense Semantic Vector Search)
      to retrieve top relevant candidate chunks for the user's question.
   3. If GEMINI_API_KEY is configured:
      - Injects retrieved context into a STRICTLY GROUNDED RAG prompt.
      - Calls Google Gemini with low temperature and length limits.
      - Returns grounded reply with source citations.
   4. If GEMINI_API_KEY is not configured or upstream fails:
      - Gracefully falls back to deterministic grounded RAG synthesis
        so the assistant always responds accurately.
   ------------------------------------------------------------------- */

const path = require('path');

let RagEngine;
try {
  RagEngine = require(path.resolve(__dirname, '../../rag-engine.js'));
} catch (e) {
  try {
    RagEngine = require('../rag-engine.js');
  } catch (err) {
    RagEngine = null;
  }
}

// Pre-index knowledge base
let ragIndex = null;
function getRagIndex() {
  if (ragIndex) return ragIndex;
  if (RagEngine && RagEngine.DATASETS && RagEngine.DATASETS.portfolio) {
    const chunks = RagEngine.chunkDocument(RagEngine.DATASETS.portfolio, 280, 40, 'Ali_Portfolio');
    ragIndex = new RagEngine.RagIndex(chunks);
  }
  return ragIndex;
}

const SYSTEM_PROMPT = `You are AIMM, the AI assistant for Ali Mehdi Mirza's portfolio (AliOS).
Your ONLY job is to answer questions based strictly on the retrieved knowledge below.

🚨 CRITICAL RULES:
1. Answer ONLY using information from the "Retrieved Context" section.
2. If you cannot answer from the context, respond: "I don't have verified context on that. Please ask about Ali's projects, skills, education, or availability, or use the Contact window."
3. NEVER add facts, numbers, links, or experiences not in the context.
4. Keep responses short (1-3 sentences max).
5. Be conversational but always grounded.

You are being audited for hallucinations. Do not fabricate.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let message, history;
  try {
    const body = JSON.parse(event.body || '{}');
    message = (body.message || '').toString().slice(0, 1000).trim();
    history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  } catch (e) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  if (!message) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'message is required.' }) };
  }

  // 1. Hybrid RAG Retrieval
  let retrievedChunks = [];
  let localAnswer = null;
  const index = getRagIndex();

  if (index) {
    const searchRes = index.search(message, 5);
    // Use top chunks above a soft threshold for context; always include at least top 3
    const highConfidence = searchRes.topK.filter(c => c.score >= 0.30);
    retrievedChunks = highConfidence.length >= 2 ? highConfidence : searchRes.topK.slice(0, 3);

    // Generate grounded local fallback using all retrieved chunks
    const gen = RagEngine.GroundedGenerator.generate(message, searchRes.topK);
    if (!gen.abstain && gen.llmAnswer) {
      localAnswer = gen.llmAnswer.replace(/\[C\d+\]/g, '').trim();
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // If no Gemini key is configured on Netlify, return the high-quality local RAG answer
  if (!apiKey) {
    const fallbackReply = localAnswer || 
      "I'm AIMM, Ali's portfolio agent. I don't have verified context to answer that—try asking about Ali's stack, projects, experience, or education. Or use the Contact window to reach Ali directly.";

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        reply: fallbackReply,
        ragGrounded: true,
        sources: retrievedChunks.map(c => ({ id: c.id, source: c.source }))
      })
    };
  }

  // 2. Format Strictly Grounded Context for Gemini
  // IMPORTANT: We prepend a strict guardrail that prevents the model from adding any external knowledge
  const contextText = retrievedChunks.length > 0
    ? retrievedChunks.map((c, i) => `[${i + 1}] ${c.text}`).join('\n\n')
    : 'NO CONTEXT FOUND';

  const groundedSystemPrompt = `${SYSTEM_PROMPT}

=== Retrieved Context (answer ONLY from this) ===
${contextText}
=== End Context ===

If the context above does not contain enough information to answer the user's question, politely decline and redirect them.`;

  const contents = [
    ...history.map(h => ({
      role: h.role === 'bot' ? 'model' : 'user',
      parts: [{ text: String(h.text || '').slice(0, 1000) }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  // 3. Call Google Gemini API with STRICT anti-hallucination settings
  const candidateModels = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash'
  ];

  let replyText = null;

  for (const model of candidateModels) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: groundedSystemPrompt }] },
            contents,
            generationConfig: {
              maxOutputTokens: 200,  // Reduced from 350 to prevent rambling
              temperature: 0.05,     // Reduced from 0.15 to be more conservative
              topP: 0.9,
              topK: 10
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_UNSPECIFIED',
                threshold: 'BLOCK_NONE'
              }
            ]
          })
        }
      );

      if (resp.ok) {
        const data = await resp.json();
        replyText = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim();
        if (replyText) break;
      }
    } catch (err) {
      // Continue to next model on network/model error
      console.error(`Error calling ${model}:`, err.message);
    }
  }

  // If Gemini succeeded, return response
  if (replyText) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        reply: replyText,
        ragGrounded: true,
        sources: retrievedChunks.map(c => ({ id: c.id, source: c.source }))
      })
    };
  }

  // Upstream fallback: Use local RAG instead of risking hallucination
  const safeFallback = localAnswer || "I couldn't process that just now. Try asking about Ali's tech stack, projects, education, or experience. Or email Ali directly at alimehdimirza1010@gmail.com.";
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      reply: safeFallback,
      ragGrounded: !!localAnswer,
      sources: retrievedChunks.map(c => ({ id: c.id, source: c.source }))
    })
  };
};
