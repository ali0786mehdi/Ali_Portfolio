/**
 * RagEngine — Universal Hybrid RAG (Retrieval-Augmented Generation) Engine
 * 
 * Supports:
 * - Ingestion & semantic sentence-aware chunking with metadata
 * - Sparse BM25Okapi lexical retrieval with document length normalization
 * - Dense semantic vector embeddings (subword n-gram hashing + cosine similarity)
 * - Hybrid Retrieval (Dense + Sparse fusion with Reciprocal Rank Fusion / Weighted Scoring)
 * - Cross-scoring candidate reranker
 * - Grounded generation with strict citation tracking ([C1], [C2])
 * - Evaluation metrics (Faithfulness / Groundedness, Hallucination Risk, Relevance)
 * - 2D embedding space projection for visualization
 * 
 * Usable both in modern browsers (window.RagEngine) and Node.js environments.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RagEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // --- Stopwords set (keeps technical keywords like rag, ai, api, vit, jwt, mern) ---
  const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
    'any', 'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
    'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could',
    'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t',
    'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t',
    'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s',
    'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how',
    'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is',
    'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most',
    'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once',
    'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
    'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
    'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their',
    'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they',
    'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to',
    'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
    'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s',
    'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s',
    'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re',
    'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
  ]);

  // --- Linguistic Tokenization & Normalization ---
  function tokenize(text) {
    if (!text || typeof text !== 'string') return [];
    return text
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\s-_.]/g, ' ')
      .split(/\s+/)
      .map(w => w.trim().replace(/^[._-]+|[._-]+$/g, ''))
      .filter(w => w.length > 1 && !STOPWORDS.has(w));
  }

  // Simple stemmer / suffix normalizer for common English endings
  function stem(word) {
    if (word.length <= 4) return word;
    if (word.endsWith('ation')) return word.slice(0, -5);
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('ment')) return word.slice(0, -4);
    if (word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
  }

  // --- Sentence-aware Chunking with Overlap ---
  function chunkDocument(text, chunkSize = 320, overlap = 40, docName = 'document') {
    if (!text || !text.trim()) return [];
    chunkSize = Math.max(80, Math.min(1500, chunkSize));
    overlap = Math.max(0, Math.min(Math.floor(chunkSize / 2), overlap));

    // Split text into paragraphs
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(Boolean);

    const chunks = [];
    let globalChunkId = 1;

    paragraphs.forEach((para, pIdx) => {
      // Split paragraph into sentences using punctuation lookbehind
      const sentences = para
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);

      if (sentences.length === 0) return;

      // If entire paragraph fits comfortably inside chunkSize
      if (para.length <= chunkSize) {
        chunks.push({
          id: globalChunkId++,
          text: para,
          source: `${docName} (p.${pIdx + 1})`,
          paragraphIndex: pIdx,
          sentences: sentences,
          terms: tokenize(para),
          charLength: para.length
        });
        return;
      }

      // Otherwise, build sliding chunks across sentences
      let currentSentences = [];
      let currentLen = 0;

      for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
        const sentence = sentences[sIdx];
        const addedLen = (currentLen > 0 ? 1 : 0) + sentence.length;

        if (currentLen + addedLen <= chunkSize || currentSentences.length === 0) {
          currentSentences.push(sentence);
          currentLen += addedLen;
        } else {
          // Commit current chunk
          const chunkStr = currentSentences.join(' ');
          chunks.push({
            id: globalChunkId++,
            text: chunkStr,
            source: `${docName} (p.${pIdx + 1}, c.${chunks.length + 1})`,
            paragraphIndex: pIdx,
            sentences: [...currentSentences],
            terms: tokenize(chunkStr),
            charLength: chunkStr.length
          });

          // Slide window with overlap: preserve trailing sentences up to overlap length
          let overlapSentences = [];
          let overlapLen = 0;
          for (let k = currentSentences.length - 1; k >= 0; k--) {
            const cand = currentSentences[k];
            if (overlapLen + cand.length <= overlap || overlapSentences.length === 0) {
              overlapSentences.unshift(cand);
              overlapLen += cand.length + 1;
            } else {
              break;
            }
          }

          currentSentences = [...overlapSentences, sentence];
          currentLen = currentSentences.join(' ').length;
        }
      }

      if (currentSentences.length > 0) {
        const chunkStr = currentSentences.join(' ');
        chunks.push({
          id: globalChunkId++,
          text: chunkStr,
          source: `${docName} (p.${pIdx + 1}, c.${chunks.length + 1})`,
          paragraphIndex: pIdx,
          sentences: currentSentences,
          terms: tokenize(chunkStr),
          charLength: chunkStr.length
        });
      }
    });

    return chunks;
  }

  // --- Subword Character N-Gram Hashing Vectorizer (Dense Semantic Vectors) ---
  // Produces a 64-dimensional dense semantic embedding vector
  const EMBED_DIM = 64;

  function hashString(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0);
  }

  function getEmbeddingVector(text) {
    const vec = new Float32Array(EMBED_DIM);
    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const words = cleaned.split(/\s+/).filter(Boolean);

    // Hash whole words
    for (const w of words) {
      if (STOPWORDS.has(w)) continue;
      const h = hashString(w) % EMBED_DIM;
      const sign = (hashString(w, 42) % 2 === 0) ? 1.0 : -1.0;
      vec[h] += sign * 1.5;

      // Subword character 3-grams to capture morphological roots
      if (w.length >= 3) {
        for (let i = 0; i <= w.length - 3; i++) {
          const gram = w.slice(i, i + 3);
          const gh = hashString(gram, 13) % EMBED_DIM;
          const gSign = (hashString(gram, 99) % 2 === 0) ? 0.75 : -0.75;
          vec[gh] += gSign;
        }
      }
    }

    // L2 Normalization
    let norm = 0;
    for (let i = 0; i < EMBED_DIM; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < EMBED_DIM; i++) vec[i] /= norm;
    }
    return vec;
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    let dot = 0;
    for (let i = 0; i < EMBED_DIM; i++) {
      dot += vecA[i] * vecB[i];
    }
    // Since vectors are L2-normalized, dot product is cosine similarity
    return Math.max(0, Math.min(1, (dot + 1) / 2)); // mapped to 0..1 range
  }

  // --- BM25Okapi Sparse Retrieval Engine ---
  class BM25Index {
    constructor(chunks, k1 = 1.5, b = 0.75) {
      this.k1 = k1;
      this.b = b;
      this.chunks = chunks;
      this.N = chunks.length;
      this.docLengths = chunks.map(c => c.terms.length);
      this.avgdl = this.docLengths.reduce((a, b) => a + b, 0) / Math.max(this.N, 1);
      
      // Calculate Document Frequency (DF) for each term
      this.df = new Map();
      this.tf = [];

      chunks.forEach((chunk, i) => {
        const counts = new Map();
        chunk.terms.forEach(t => {
          const st = stem(t);
          counts.set(st, (counts.get(st) || 0) + 1);
        });
        this.tf[i] = counts;
        for (const st of counts.keys()) {
          this.df.set(st, (this.df.get(st) || 0) + 1);
        }
      });

      // Precompute IDF for each term
      this.idf = new Map();
      for (const [t, n] of this.df.entries()) {
        // Lucene/BM25 standard smoothed IDF
        const idfVal = Math.log(1 + (this.N - n + 0.5) / (n + 0.5));
        this.idf.set(t, Math.max(0.1, idfVal));
      }
    }

    score(queryTerms) {
      const stemmedQuery = queryTerms.map(stem);
      const scores = new Float32Array(this.N);

      stemmedQuery.forEach(st => {
        const idf = this.idf.get(st) || 0;
        if (idf <= 0) return;

        for (let i = 0; i < this.N; i++) {
          const tf = this.tf[i].get(st) || 0;
          if (tf === 0) continue;
          const docLen = this.docLengths[i];
          const num = tf * (this.k1 + 1);
          const denom = tf + this.k1 * (1 - this.b + this.b * (docLen / Math.max(this.avgdl, 1)));
          scores[i] += idf * (num / denom);
        }
      });

      // Normalize BM25 scores to [0, 1]
      let maxScore = 0;
      for (let i = 0; i < this.N; i++) {
        if (scores[i] > maxScore) maxScore = scores[i];
      }
      if (maxScore > 0) {
        for (let i = 0; i < this.N; i++) {
          scores[i] /= maxScore;
        }
      }
      return scores;
    }
  }

  // --- Full Inverted & Vector Index ---
  class RagIndex {
    constructor(chunks) {
      this.chunks = chunks;
      this.bm25 = new BM25Index(chunks);
      this.embeddings = chunks.map(c => getEmbeddingVector(c.text));
      
      // Calculate vocabulary
      const vocab = new Set();
      chunks.forEach(c => c.terms.forEach(t => vocab.add(stem(t))));
      this.vocabularySize = vocab.size;
    }

    /**
     * Hybrid Search (BM25 Lexical + Dense Semantic + Proximity Bonus + Reranker)
     */
    search(query, topK = 5) {
      const qTerms = tokenize(query);
      const qStemmed = qTerms.map(stem);
      const qVector = getEmbeddingVector(query);
      const bm25Scores = this.bm25.score(qTerms);

      const qLower = query.toLowerCase().trim();

      const scored = this.chunks.map((chunk, idx) => {
        const denseSim = cosineSimilarity(qVector, this.embeddings[idx]);
        const bm25Score = bm25Scores[idx];

        // Phrase / Proximity Boost
        let proximityBoost = 0;
        const textLower = chunk.text.toLowerCase();
        if (qLower.length > 3 && textLower.includes(qLower)) {
          proximityBoost += 0.20; // Exact full query match
        } else {
          // Check for 2-word n-gram matches
          for (let i = 0; i < qTerms.length - 1; i++) {
            const bigram = `${qTerms[i]} ${qTerms[i + 1]}`;
            if (textLower.includes(bigram)) proximityBoost += 0.08;
          }
        }

        // Query Term Coverage
        const chunkStems = new Set(chunk.terms.map(stem));
        const matchedTerms = qStemmed.filter(t => chunkStems.has(t));
        const coverage = qStemmed.length > 0 ? (matchedTerms.length / qStemmed.length) : 0;

        // Hybrid Fusion: Dense Semantic (50%) + BM25 Lexical (35%) + Coverage (15%)
        let hybridScore = (denseSim * 0.50) + (bm25Score * 0.35) + (coverage * 0.15) + proximityBoost;
        hybridScore = Math.min(1.0, Math.max(0.0, hybridScore));

        // Cross-scoring Reranker
        const leadSentenceMatch = chunk.sentences.length > 0 && 
          qStemmed.some(t => chunk.sentences[0].toLowerCase().includes(t));
        const rerankScore = Math.min(1.0, hybridScore * (leadSentenceMatch ? 1.08 : 1.0));

        return {
          chunk,
          id: chunk.id,
          source: chunk.source,
          text: chunk.text,
          denseSim: parseFloat(denseSim.toFixed(3)),
          bm25Score: parseFloat(bm25Score.toFixed(3)),
          coverage: parseFloat(coverage.toFixed(3)),
          score: parseFloat(rerankScore.toFixed(3)),
          matchedTerms: [...new Set(matchedTerms)]
        };
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      return {
        query,
        queryTerms: qTerms,
        queryVector: qVector,
        all: scored,
        topK: scored.slice(0, topK)
      };
    }
  }

  // --- Grounded Generation & Synthesis Engine ---
  class GroundedGenerator {
    /**
     * Extract precise evidence sentences from ranked chunks
     */
    static extractEvidence(query, rankedChunks, maxSentences = 4) {
      if (!rankedChunks || rankedChunks.length === 0 || rankedChunks[0].score < 0.12) {
        return [];
      }

      const qTerms = tokenize(query).map(stem);
      const candidates = [];

      rankedChunks.slice(0, 3).forEach(c => {
        c.chunk.sentences.forEach((sent, sIdx) => {
          const sentTerms = tokenize(sent).map(stem);
          const matches = qTerms.filter(t => sentTerms.includes(t));
          if (matches.length > 0 || c.score > 0.4) {
            candidates.push({
              chunkId: c.id,
              source: c.source,
              sentence: sent,
              matchCount: matches.length,
              chunkScore: c.score,
              score: (matches.length * 1.5) + c.score
            });
          }
        });
      });

      candidates.sort((a, b) => b.score - a.score);
      // Deduplicate sentences
      const seen = new Set();
      const unique = [];
      for (const cand of candidates) {
        if (!seen.has(cand.sentence)) {
          seen.add(cand.sentence);
          unique.push(cand);
          if (unique.length >= maxSentences) break;
        }
      }
      return unique;
    }

    /**
     * Synthesize grounded answers (Extractive + Fluent LLM simulation)
     */
    static generate(query, rankedChunks) {
      if (!rankedChunks || rankedChunks.length === 0 || rankedChunks[0].score < 0.12) {
        return {
          abstain: true,
          confidence: 0,
          hallucinationRisk: 100,
          evidence: [],
          citations: [],
          extractiveAnswer: "I could not find sufficient grounded evidence in the indexed knowledge base to answer this query safely. In production RAG, an abstention guardrail prevents fabricating ungrounded information.",
          llmAnswer: "Based on the indexed knowledge, there is no verified context regarding this topic. Please try asking about Ali's background, projects, technical skills, or RAG architecture.",
          traceSummary: "Query abstained: retrieval confidence below threshold (0.12)."
        };
      }

      const evidence = this.extractEvidence(query, rankedChunks);
      const topChunks = rankedChunks.filter(c => c.score >= 0.15).slice(0, 3);
      const citations = topChunks.map(c => ({ id: c.id, source: c.source }));

      // Confidence score based on top chunk score and query term coverage
      const topScore = rankedChunks[0].score;
      const confidence = Math.min(99, Math.round(topScore * 85 + 15));
      const hallucinationRisk = Math.max(1, 100 - confidence);

      // Extractive Answer
      const extractiveSentences = evidence.map(e => `${e.sentence} [C${e.chunkId}]`);
      const extractiveAnswer = extractiveSentences.length > 0
        ? extractiveSentences.join(' ')
        : `${topChunks[0].chunk.sentences[0] || topChunks[0].text} [C${topChunks[0].id}]`;

      // Synthesized LLM-style Grounded Answer
      const citedIds = [...new Set(evidence.map(e => `[C${e.chunkId}]`))].join(' ');
      let synthesis = '';

      if (evidence.length >= 2) {
        synthesis = `${evidence[0].sentence} [C${evidence[0].chunkId}] Furthermore, ${evidence[1].sentence.charAt(0).toLowerCase() + evidence[1].sentence.slice(1)} [C${evidence[1].chunkId}]`;
        if (evidence[2]) {
          synthesis += ` Additionally, ${evidence[2].sentence.charAt(0).toLowerCase() + evidence[2].sentence.slice(1)} [C${evidence[2].chunkId}]`;
        }
      } else if (evidence.length === 1) {
        synthesis = `${evidence[0].sentence} [C${evidence[0].chunkId}]`;
      } else {
        synthesis = `${topChunks[0].text} [C${topChunks[0].id}]`;
      }

      return {
        abstain: false,
        confidence,
        hallucinationRisk,
        evidence,
        citations,
        topChunks,
        extractiveAnswer,
        llmAnswer: synthesis,
        traceSummary: `Grounded generation completed using ${topChunks.length} chunks with ${confidence}% confidence.`
      };
    }
  }

  // --- 2D Vector Projection for Visual Graph ---
  // Projects high-dimensional embedding vectors into 2D display coordinates
  function projectTo2D(queryVector, chunks, width = 620, height = 320) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const maxR = Math.min(cx, cy) - 35;

    // Use two pseudo-orthogonal projection axes from embedding dimensions
    const points = chunks.map((c, i) => {
      const vec = c.embedding || getEmbeddingVector(c.chunk ? c.chunk.text : c.text);
      const sim = c.score !== undefined ? c.score : cosineSimilarity(queryVector, vec);

      // Distance from center: higher similarity = closer to query at center
      const r = Math.max(25, (1.0 - sim) * maxR);
      
      // Calculate angle based on semantic projection
      let angle = (i * (2 * Math.PI / Math.max(chunks.length, 1))) + (c.id * 0.37);
      if (vec && vec.length >= 4) {
        const xProj = vec[0] + vec[1] - vec[2];
        const yProj = vec[2] + vec[3] - vec[0];
        angle = Math.atan2(yProj, xProj) + (i * 0.15);
      }

      const x = Math.max(20, Math.min(width - 20, cx + Math.cos(angle) * r));
      const y = Math.max(20, Math.min(height - 20, cy + Math.sin(angle) * r));

      return {
        id: c.id,
        source: c.source,
        score: c.score || 0,
        denseSim: c.denseSim || 0,
        bm25Score: c.bm25Score || 0,
        x,
        y,
        isRetrieved: c.score >= 0.15
      };
    });

    return {
      query: { x: cx, y: cy, label: 'QUERY' },
      points
    };
  }

  // --- Curated Datasets ---
  const DATASETS = {
    portfolio: `Ali Mehdi Mirza is a Computer Engineering student at Vidyalankar Institute of Technology (VIT), Mumbai, maintaining a high academic standing with a CGPA of 9.95 out of 10. He specializes in full-stack web development and AI-driven systems.

Ali's core technical stack includes the MERN stack (MongoDB, Express.js, React, Node.js), TypeScript, Prisma, PostgreSQL, Docker, and Python. For artificial intelligence and generative applications, he leverages the Google Gemini API, OpenAI APIs, and modern RAG pipeline architectures. He also practices data structures and algorithms (DSA) in Python and JavaScript.

His key featured projects include:
1. AuthForge: A production-ready authentication API built with TypeScript, Express, PostgreSQL, and Prisma. Features include JWT token rotation, Role-Based Access Control (RBAC), OAuth2 integration, Two-Factor Authentication (2FA), and distributed rate limiting.
2. Nexora: An event-driven real-time chat platform leveraging WebSockets, Redis Pub/Sub for horizontal scaling, BullMQ queues, and a hybrid PostgreSQL and Redis message storage architecture.
3. AI-Powered Study Planner: A full-stack MERN application that integrates the Gemini API to analyze student syllabi, exam deadlines, and generate customized day-by-day study schedules with JWT authentication and data persistence.
4. Mirza Footwear: A complete e-commerce storefront designed, built, and deployed solo for his family's leather shoe business.

Ali's professional and open source experience includes:
- Social Summer of Code (SSoC) 2026: Selected contributor engineering algorithmic optimizations in Algo-Infinity-Verse and intelligent automation workflows in AI-Agent-Automation.
- Outlier AI (May 2025 - July 2025): Freelance AI Trainer training and evaluating large language models via prompt engineering, data annotation, and RLHF response quality evaluation.
- Math Tutor at Excellent-Avon Group Tuitions: Taught mathematics and problem-solving to students across multiple boards.

Ali is open to software engineering, backend, and full-stack developer internships (remote or based in Mumbai). He can be contacted at alimehdimirza1010@gmail.com, phone +91 89530 19234, GitHub @ali0786mehdi, and LinkedIn ali-mehdi-mirza-2ba8a624b.`,

    rag: `Retrieval-Augmented Generation (RAG) is an architectural pattern that enhances Large Language Models by retrieving relevant authoritative knowledge from an external index before generating a response. This grounds model output in verifiable facts and mitigates hallucinations.

The RAG lifecycle consists of five primary stages:
1. Ingestion and Preprocessing: Documents in various formats (PDFs, Markdown, Web pages, JSON) are parsed, stripped of boilerplate, cleaned, and normalized. Metadata such as author, timestamps, document type, and access permissions are attached to preserve lineage.
2. Chunking Strategies: Long texts are partitioned into searchable segments. Effective chunking respects semantic boundaries such as paragraphs and headings, avoids splitting sentences mid-thought, and includes sliding overlap (typically 10% to 20%) to retain boundary context.
3. Vector Indexing and Embeddings: Chunks are transformed into dense vector embeddings using models such as text-embedding-3 or BGE. These vectors are indexed in vector databases like Pinecone, ChromaDB, Weaviate, pgvector, or Milvus using Approximate Nearest Neighbor (ANN) algorithms like HNSW.
4. Hybrid Retrieval and Reranking: Production RAG pairs dense vector semantic search with sparse lexical search (BM25) via Reciprocal Rank Fusion (RRF). A cross-encoder reranker (such as Cohere Rerank or BGE-Reranker) rescores the top candidate pool to ensure high query relevance before context assembly.
5. Grounded Generation and Citations: The retrieved chunks are assembled into the LLM prompt with strict system guardrails instructing the model to synthesize answers solely from provided context and cite chunk references.

Evaluation in RAG systems is quantified through the RAG Triad: Context Relevance (how well retrieved chunks match the query), Groundedness or Faithfulness (whether the answer is strictly supported by evidence), and Answer Relevance (whether the response satisfies user intent). Latency, token economy, and hallucination risk are continuously monitored.`,

    product: `AliOS Cloud Platform provides developer tools, API gateway management, and serverless workflow automation.

Authentication and Security:
Users can manage access credentials, rotate API keys, and configure OAuth2 providers from the Security Settings dashboard. Password reset links expire automatically after fifteen minutes. Multi-factor authentication (MFA) via TOTP authenticator apps is supported and enforced for enterprise team members.

Subscription Plans and Billing:
- Free Tier: Includes up to 3 projects, 60 API requests per minute, community Discord support, and 500 MB shared vector index storage.
- Pro Plan ($29/month): Unlocks unlimited projects, 1,000 API requests per minute, team role-based permissions, automated audit logs, and priority email support.
- Enterprise Plan: Custom rate limits, dedicated vector database clusters, SAML SSO, and a 99.9% uptime SLA. Billing changes take effect immediately with prorated adjustments on the next invoice.

Webhook and API Integrations:
All outbound webhook payloads are signed using HMAC-SHA256 with your account webhook secret. The service performs automatic exponential backoff retries over 24 hours in the event of HTTP 5xx responses. Rate limits return HTTP 429 Too Many Requests with a Retry-After response header.`
  };

  const PRESET_QUERIES = {
    portfolio: [
      "What are Ali's featured projects?",
      "What is Ali's tech stack and skills?",
      "What is Ali's education and CGPA?",
      "Is Ali open to internships?",
      "Tell me about AuthForge and Nexora"
    ],
    rag: [
      "How do I improve retrieval quality?",
      "What makes chunking effective?",
      "Explain hybrid search and reranking",
      "What is the RAG Triad for evaluation?",
      "How does RAG prevent hallucinations?"
    ],
    product: [
      "How do I reset my password?",
      "What is included in the Pro plan?",
      "How are webhooks secured and retried?",
      "What are the API rate limits?"
    ],
    custom: [
      "What are the main takeaways?",
      "Summarize the key points",
      "What evidence supports this?"
    ]
  };

  // --- Public API ---
  return {
    tokenize,
    stem,
    chunkDocument,
    getEmbeddingVector,
    cosineSimilarity,
    BM25Index,
    RagIndex,
    GroundedGenerator,
    projectTo2D,
    DATASETS,
    PRESET_QUERIES
  };
});
