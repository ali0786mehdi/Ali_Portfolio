# AliOS — Interactive Developer Portfolio

> A desktop-inspired portfolio for **Ali Mehdi Mirza** — built to be explored, not just scrolled.

[![Live Portfolio](https://img.shields.io/badge/Live%20Portfolio-Visit-c9a84c?style=for-the-badge)](https://alimehdiport.netlify.app/)
[![GitHub](https://img.shields.io/badge/GitHub-ali0786mehdi-181717?style=for-the-badge&logo=github)](https://github.com/ali0786mehdi)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-0A66C2?style=for-the-badge&logo=linkedin)](https://linkedin.com/in/ali-mehdi-mirza-2ba8a624b)

AliOS presents my experience, projects, skills, and contact details inside a lightweight operating-system-style interface. Open windows, move and resize them, use the terminal, chat with AIMM, switch themes, and discover the portfolio at your own pace.

## Contents

- [Highlights](#highlights)
- [Projects](#projects)
- [Built With](#built-with)
- [Run Locally](#run-locally)
- [Project Structure](#project-structure)
- [Design and Engineering Notes](#design-and-engineering-notes)
- [Connect](#connect)

## Highlights

- **Interactive desktop:** Launch About, Experience, Skills, Projects, Hobbies, Ventures, Contact, Terminal, and more from desktop icons or the start menu.
- **Window manager:** Drag, resize, focus, minimize, maximize, and close application windows.
- **AIMM assistant:** Ask questions about my background, technology stack, projects, experience, or availability. The deployed version can use the Netlify Function at `/.netlify/functions/aimm`, with a local knowledge-base fallback when the function is unavailable.
- **Portfolio terminal:** Try commands such as `help`, `about`, `skills`, `projects`, `open projects`, `theme light`, and `resume`.
- **Responsive experience:** Desktop windows become mobile-friendly full-screen sheets on smaller screens.
- **Personalization:** Toggle light/dark mode, change the wallpaper, replay the boot sequence, and use the custom context menu.
- **Accessible interactions:** Semantic controls, ARIA states, visible form feedback, reduced-motion support, and graceful touch-device behavior.
- **Contact form:** Send a message through Formspree or use the direct email link in the Contact window.

## Projects

| Project | Description | Links |
| --- | --- | --- |
| **AuthForge** | Authentication API built with TypeScript, Express, PostgreSQL, and Prisma, including JWT rotation, RBAC, OAuth2, 2FA, and rate limiting. | [Repository](https://github.com/ali0786mehdi/authforge) |
| **Nexora** | Real-time chat platform exploring WebSockets, Redis Pub/Sub, queues, and scalable backend architecture. | [Repository](https://github.com/ali0786mehdi/nexora) |
| **AI-Powered Study Planner** | MERN application that uses the Gemini API to generate personalized study schedules. | [Live demo](https://ai-study-planner-using-gemini.vercel.app/) · [Repository](https://github.com/ali0786mehdi/ai-study-planner) |
| **Bitly** | A URL shortener currently under development. | [Repository](https://github.com/ali0786mehdi/Bitly) |
| **SSoC contributions** | Open-source work across algorithmic solutions and AI-driven automation projects. | [Algo-Infinity-Verse](https://github.com/Eshajha19/Algo-Infinity-Verse) · [AI-Agent-Automation](https://github.com/vmDeshpande/ai-agent-automation) |

## Built With

- **HTML5** — semantic structure and JSON-LD metadata
- **CSS3** — custom properties, Grid, Flexbox, animations, responsive layouts, and light/dark themes
- **Vanilla JavaScript** — window management, drag/resize interactions, terminal commands, local storage, Clipboard API, and chat behavior
- **Netlify** — deployment and the optional server-side AIMM function
- **Formspree** — contact form delivery

No framework, bundler, or package installation is required for the static portfolio interface.

## Run Locally

Clone the repository and open the page directly in a browser:

```bash
git clone https://github.com/ali0786mehdi/Ali_Portfolio.git
cd Ali_Portfolio
```

Then open `index.html`:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

You can also double-click `index.html`. There is no build step or `npm install` requirement.

### AIMM & RAG System

The portfolio features a hybrid Retrieval-Augmented Generation (RAG) system running both client-side and server-side:
- **Client-side RAG (`rag-engine.js`):** A zero-dependency hybrid retrieval engine utilizing BM25Okapi lexical search, 64-dimensional dense semantic subword n-gram vector embeddings with cosine similarity, reciprocal rank fusion, reranking, and citation-backed grounded answer generation.
- **Interactive RAG Lab (`rag-lab.html` / `rag-lab.js`):** A visual RAG laboratory allowing visitors to experiment with chunking strategies, inspect candidates on an interactive 2D vector similarity canvas, review pipeline execution traces, evaluate confidence/hallucination risk, and compare extractive vs. synthesized grounded answers.
- **Serverless AIMM (`netlify/functions/aimm.js`):** Serverless endpoint that performs hybrid retrieval over Ali's portfolio knowledge base, augments prompts for Google Gemini (with fallbacks across models), and returns citations. If the server function or API key is not configured, the assistant automatically falls back to client-side RAG generation with zero interruption.

## Project Structure

```text
Ali_Portfolio/
├── index.html       Portfolio markup, desktop shell, windows, and metadata
├── style.css        Design tokens, window chrome, themes, responsive styles
├── script.js        Window manager, terminal, AIMM, forms, and interactions
├── rag-engine.js    Universal Hybrid RAG engine (BM25 + Dense Vectors + Citations)
├── rag-lab.html     Interactive RAG Lab workbench
├── rag-lab.js       RAG Lab UI controller, 2D vector canvas, and charts
├── rag-lab.css      RAG Lab design tokens, layout, and visual meters
├── netlify/         Netlify Function configuration and serverless functions
│   └── functions/
│       └── aimm.js  Serverless RAG endpoint backed by Gemini API
├── README.md        Project documentation
└── assets           Images, resume, favicon, and other static assets
```

> File names may vary as the portfolio evolves. The main entry point remains `index.html`.

## Design and Engineering Notes

### Why vanilla JavaScript?

This portfolio is intentionally framework-free. The interface is small enough to solve with browser APIs, so keeping it dependency-free makes the code easier to inspect, deploy, and maintain. It also keeps the focus on the interaction design rather than a build pipeline.

### Hybrid RAG Engine Design

Rather than a simple keyword lookup or external vector database dependency, `rag-engine.js` implements:
1. **Sentence-aware Chunking:** Preserves semantic paragraphs and sentence boundaries with configurable sliding overlap.
2. **Dense Semantic Embeddings:** Computes 64-dimensional subword character n-gram hashing vectors that are L2-normalized for cosine similarity.
3. **BM25Okapi Lexical Search:** Applies term frequency saturation and document length normalization (`k1=1.5`, `b=0.75`).
4. **Hybrid Rank Fusion & Reranking:** Combines dense semantic similarity and sparse BM25 scores with phrase proximity boosts and query coverage reranking.
5. **Grounded Generation & Guardrails:** Synthesizes responses strictly backed by retrieved evidence sentences, providing exact `[C1]` citation anchors and computing confidence and hallucination risk metrics.

### State and persistence

`localStorage` remembers the boot-screen preference and selected theme. The desktop itself is rendered with HTML and CSS, while JavaScript manages window state, stacking order, dragging, resizing, and taskbar updates.

### AIMM fallback behavior

The deployed assistant first attempts the Netlify Function so the model credential can remain server-side. If that request fails, the local hybrid RAG engine answers questions with grounded context instead of leaving the chat unusable. The UI also clearly notes that generated answers may be imperfect.

### Responsive and accessible behavior

Desktop interactions are adapted for smaller screens: windows become sheets, dragging and resizing are disabled where they are not practical, and the custom cursor is skipped on touch devices. The stylesheet also honors `prefers-reduced-motion`.

### Progressive enhancement

The portfolio remains useful without the optional backend function. External links use `noopener noreferrer`, clipboard copying has a visible fallback, and the contact form reports both success and failure states.

## Connect

- **Portfolio:** [alimehdiport.netlify.app](https://alimehdiport.netlify.app/)
- **GitHub:** [@ali0786mehdi](https://github.com/ali0786mehdi)
- **LinkedIn:** [Ali Mehdi Mirza](https://linkedin.com/in/ali-mehdi-mirza-2ba8a624b)
- **LeetCode:** [Ali_mehdi_mirza](https://leetcode.com/u/Ali_mehdi_mirza)
- **Email:** [alimehdimirza1010@gmail.com](mailto:alimehdimirza1010@gmail.com)

Open to backend, full-stack, and platform-engineering internships, remotely or in Mumbai.

---

Built with HTML, CSS, JavaScript, and a lot of curiosity by **Ali Mehdi Mirza**.
