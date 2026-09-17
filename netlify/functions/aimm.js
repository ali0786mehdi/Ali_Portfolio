/* ------------------------------------------------------------------
   AIMM — Ali's LLM-backed portfolio agent
   Serverless proxy (Netlify Function). Keeps the Gemini API key on the
   server so it's never exposed in client-side JS / page source.

   Setup:
   1. Get a free Gemini API key: https://aistudio.google.com/app/apikey
   2. In Netlify: Site settings → Environment variables →
      add GEMINI_API_KEY = <your key>
   3. Deploy. This function will be live at /.netlify/functions/aimm
------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are AIMM, the AI agent embedded in Ali Mehdi Mirza's portfolio website ("AliOS").
Speak in first person as AIMM, a friendly, concise assistant who knows Ali's background well.

Facts about Ali you can use:
- Full-stack MERN developer (MongoDB, Express, React, Node.js) + TypeScript, Prisma, PostgreSQL, Docker.
- Computer Engineering student at Vidyalankar Institute of Technology (VIT), Mumbai, CGPA 9.95/10.
- Projects: AuthForge (production-grade auth API: JWT rotation, RBAC, 2FA), Nexora (real-time chat
  platform using Redis Pub/Sub + BullMQ), AI-Powered Study Planner (Gemini API), Mirza Footwear
  e-commerce site (family business).
- Open source contributor, Social Summer of Code (SSoC) 2026 — Algo-Infinity-Verse, AI-Agent-Automation.
- Worked as a Freelance AI Trainer at Outlier AI, rating/refining LLM responses.
- Open to software developer internships and full-stack roles, remote or Mumbai-based.
- Contact: alimehdimirza1010@gmail.com.

Keep answers short (2-4 sentences), warm, and steer people toward the Contact window or email for
anything you're unsure about. Do not invent facts about Ali beyond what's given here.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY is not configured on the server." })
    };
  }

  let message, history;
  try {
    const body = JSON.parse(event.body || "{}");
    message = (body.message || "").toString().slice(0, 1000); // basic length guard
    history = Array.isArray(body.history) ? body.history.slice(-8) : []; // last 8 turns
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  if (!message.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "message is required." }) };
  }

  const contents = [
    ...history.map((h) => ({
      role: h.role === "bot" ? "model" : "user",
      parts: [{ text: String(h.text || "").slice(0, 1000) }]
    })),
    { role: "user", parts: [{ text: message }] }
  ];

  try {
    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: { maxOutputTokens: 300, temperature: 0.6 }
        })
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return { statusCode: 502, body: JSON.stringify({ error: "Upstream error", detail: errText }) };
    }

    const data = await resp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "I couldn't come up with an answer just then — try rephrasing, or use the Contact window.";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error", detail: String(err) }) };
  }
};
