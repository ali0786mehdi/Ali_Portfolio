<div align="center">

  <h1>AliOS — Ali Mehdi Mirza's Portfolio</h1>

  <p><em>A portfolio that works like a tiny operating system — windows you can open, drag, and close, a terminal you can type into, and a chat assistant that actually knows my resume. No framework, no build step, no dependencies.</em></p>

---

## Preview

<div align="center">
  <img src="./image.png" alt="Portfolio Preview" width="90%" />
</div>

---

## What is AliOS?

It's my portfolio, but instead of a normal scrolling page, it looks and behaves like a small desktop operating system.

- You boot into it (a short loading screen, skippable)
- You see a desktop with icons: About, Experience, Skills, Projects, Hobbies, Ventures, Contact, and more
- Clicking an icon opens a window — you can drag it around, resize it, minimize it, or close it
- There's a taskbar at the bottom showing what's open
- There's a real terminal you can type commands into
- There's a chat window where you can ask questions about me and get real answers, not a static FAQ

The idea: instead of *telling* you I'm a developer, let you *use* something I built.

---

## Currently Building — Bitly

This portfolio is the shop window. The workbench is here:

**[Bitly →](https://github.com/ali0786mehdi/Bitly)** — a URL shortener

If you're evaluating me for a backend or systems role, that repo is a more honest signal than this one. This README documents the portfolio; Bitly and AuthForge document how I think about auth, data modeling, and API design.

---

## Why No Framework

Most portfolios ship 200–300KB of JavaScript to render a name, a photo, and three cards. This one doesn't, on purpose.

Not because frameworks are bad — I use React/Node daily elsewhere on this GitHub — but because a personal site is a small, mostly-static problem, and reaching for a framework to solve it would be the wrong tool for the job. Even with a full window-manager UI (drag, resize, minimize, taskbar), plain HTML, CSS, and JavaScript were enough.

What that buys here:
- No build step, no `node_modules`, no bundler config to go stale
- Every animation, drag, and interaction is a native browser feature I can point to and explain line-by-line
- Nothing to patch when a dependency ships a breaking change six months from now

---

## What's Inside, in Plain English

| Part | What it does |
|---|---|
| **Boot screen** | A short fake loading sequence the first time you visit. Skips itself automatically on your next visit. |
| **Desktop icons** | Click one, a window opens. Same idea as a computer desktop. |
| **Windows** | Each section (About, Projects, Skills, etc.) lives in its own window. You can drag it by the top bar, resize it from the corner, minimize it, maximize it, or close it. |
| **Taskbar** | Shows which windows are currently open, so you can jump back to them. |
| **Start menu** | A quick list of every window, with a search box to filter it. |
| **Right-click menu** | Right-click empty desktop space for small extras — change wallpaper, toggle theme. |
| **Terminal** | A real, typeable terminal. Type `help` to see the commands — you can open sections, read my skills, or grab my resume, all by typing. |
| **Ask Ali AI** | A chat window you can ask things like "what's Ali's stack?" or "is Ali available for internships?" It matches your question against a small set of real facts about me and answers — no made-up information. |
| **Simplify button** | On the more technical project (Nexora), one click swaps the technical description for a plain-English one, and back. |
| **Contact form** | A real form that emails me directly, with a working success/error message. |
| **Light / dark theme** | Toggle from the top bar or the right-click menu. Your choice is remembered next time you visit. |

---

## Engineering Notes

Specific decisions worth flagging, in the order a reviewer would likely find them:

| Area | Decision | Reasoning |
|---|---|---|
| **Windows** | Each window is a plain HTML element, shown/hidden and moved with CSS + a small amount of JS — no UI framework | Dragging, resizing, and stacking windows sounds complex, but it's really just tracking a position and a z-index. Doing it by hand keeps the whole system inspectable in one file. |
| **Boot screen** | Skips itself after the first visit, using `localStorage` | Nobody wants to watch a loading animation every single time. It's a one-time introduction, not a gate. |
| **Ask Ali AI** | Answers come from a small hard-coded list of facts about me, matched by keyword — not a live call to a paid AI service | This keeps the assistant honest (it can't make things up about me) and keeps the site dependency-free and free to host. The code has a note on how to swap in a real AI backend later, the right way — through a server, never with a secret key sitting in the page's JavaScript. |
| **Terminal** | A small command parser (`help`, `about`, `skills`, `open <window>`, etc.) rather than a real shell | It's a portfolio easter egg, not a real terminal — but it's genuinely functional, not just decoration. |
| **Custom cursor** | Turned off automatically on touch devices, instead of just hidden with CSS | A cursor-follow effect with nothing to follow is dead code on phones and tablets. Detecting and skipping it is cheaper than shipping it and hiding it. |
| **External links** | `rel="noopener noreferrer"` on every `target="_blank"` link | Without it, a linked page can read and redirect the tab that opened it — a real security gap, not a style nitpick. |
| **Clipboard copy** (email button) | Falls back to just showing the email as text if the Clipboard API isn't available | The Clipboard API needs a secure connection; degrading gracefully beats a button that silently does nothing. |
| **Theming** | One `data-theme` attribute and a single set of CSS variables, not two separate stylesheets | One source of truth for every color, so light and dark mode can never drift out of sync. |
| **Contact form** | Submits with `fetch`, shows a real success or error message, and disables the button while sending | So you always know whether your message actually went through. |

---

## Tech Stack

```
Structure   HTML5 — semantic markup, JSON-LD structured data for SEO
Styling     CSS3 — Grid, Flexbox, custom properties, keyframes
Logic       Vanilla JS — DOM APIs, drag & resize, localStorage, Clipboard API
Hosting     Netlify (CDN)
```

---

## Running Locally

No build step, no install step.

```bash
git clone https://github.com/ali0786mehdi/portfolio.git
cd portfolio

# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

Or just double-click `index.html`. There is nothing to compile.

---

## Project Structure

```
portfolio/
├── index.html      All windows, boot screen, and page structure
├── style.css        Design tokens, window styling, animation, theming
├── script.js         Window manager, terminal, AI chat, form logic
├── image.png        Preview screenshot
└── README.md
```

---

## Elsewhere on This Profile

| Project | Focus |
|---|---|
| [Bitly](https://github.com/ali0786mehdi/Bitly) | URL shortener — currently in progress |
| [AuthForge](https://github.com/ali0786mehdi/authforge) | Auth API — TypeScript, Express, Prisma, PostgreSQL |
| [Nexora](https://github.com/ali0786mehdi/nexora) | Real-time chat platform — Redis, WebSockets, BullMQ |
| [AI-Powered Study Planner](https://github.com/ali0786mehdi/ai-study-planner) | Full-stack MERN, Gemini API, JWT auth |

---

## Contact

<p align="left">
  <a href="https://alimehdiport.netlify.app/"><img src="https://img.shields.io/badge/-Portfolio-c9a84c?style=for-the-badge" /></a>
  <a href="https://linkedin.com/in/ali-mehdi-mirza-2ba8a624b"><img src="https://img.shields.io/badge/-LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" /></a>
  <a href="mailto:alimehdimirza1010@gmail.com"><img src="https://img.shields.io/badge/-Email-c9a84c?style=for-the-badge&logo=gmail&logoColor=white" /></a>
  <a href="https://leetcode.com/u/Ali_mehdi_mirza"><img src="https://img.shields.io/badge/-LeetCode-FFA116?style=for-the-badge&logo=leetcode&logoColor=black" /></a>
</p>

<sub>Open to backend, full-stack, and platform-engineering internships — remote or Mumbai.</sub>
