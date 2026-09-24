/* ------------------------------------------------------------------
   AIMM — Ali's Retrieval-Augmented Generation (RAG) Portfolio Agent
   Serverless Netlify Function at /.netlify/functions/aimm
   
   Architecture:
   1. Ingests & indexes Ali's full portfolio knowledge base using RagEngine.
   2. Performs hybrid retrieval (BM25 + Dense Semantic Vector Search)
      to retrieve top relevant candidate chunks for the user's question.
   3. If GEMINI_API_KEY is configured:
      - Injects retrieved context into a grounded RAG prompt.
      - Calls Google Gemini 1.5 Flash (with fallback to 2.0 Flash / 1.5 Pro).
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

const SYSTEM_PROMPT = `You are AIMM, the AI assistant embedded in Ali Mehdi Mirza's portfolio website ("AliOS").
Speak in first person as AIMM, a friendly, concise, and highly knowledgeable assistant.

CRITICAL GROUNDING RULES:
1. Answer the question strictly using the verified information provided in the "Retrieved Knowledge Chunks" section below.
2. Keep responses short and conversational (2-4 sentences).
3. If the retrieved context does not contain the answer, politely invite the user to reach out directly to Ali via the Contact window or at alimehdimirza1010@gmail.com.
4. Do not fabricate facts, numbers, or experiences that are not grounded in the context.`;

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
    const searchRes = index.search(message, 3);
    retrievedChunks = searchRes.topK.filter(c => c.score >= 0.12);
    
    // Generate grounded local fallback
    const gen = RagEngine.GroundedGenerator.generate(message, searchRes.topK);
    if (!gen.abstain && gen.llmAnswer) {
      localAnswer = gen.llmAnswer.replace(/\[C\d+\]/g, '').trim();
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // If no Gemini key is configured on Netlify, return the high-quality local RAG answer
  if (!apiKey) {
    const fallbackReply = localAnswer || 
      "I'm AIMM, Ali's portfolio agent. I don't have enough verified context to answer that safely, but you can explore Ali's projects and skills on the desktop, or reach out at alimehdimirza1010@gmail.com.";

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

  // 2. Format Grounded Context for Gemini
  const contextText = retrievedChunks.length > 0
    ? retrievedChunks.map((c, i) => `[Source ${i + 1} - Chunk ${c.id}]:\n${c.text}`).join('\n\n')
    : 'No directly relevant chunks found in knowledge base.';

  const groundedSystemPrompt = `${SYSTEM_PROMPT}\n\n### Retrieved Knowledge Chunks:\n${contextText}`;

  const contents = [
    ...history.map(h => ({
      role: h.role === 'bot' ? 'model' : 'user',
      parts: [{ text: String(h.text || '').slice(0, 1000) }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  // 3. Call Google Gemini API (tries 1.5-flash first, falls back to 2.0-flash / 1.5-pro)
  const candidateModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro'
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
            generationConfig: { maxOutputTokens: 350, temperature: 0.5 }
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

  // Upstream fallback
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      reply: localAnswer || "I couldn't reach the model just now, but you can find Ali's projects, experience, and contact info directly in the desktop windows or email him at alimehdimirza1010@gmail.com.",
      ragGrounded: !!localAnswer,
      sources: retrievedChunks.map(c => ({ id: c.id, source: c.source }))
    })
  };
};
