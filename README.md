<div align="center">

  <h1>Ali Mehdi Mirza — Portfolio</h1>

  <p><em>A dependency-free portfolio, built the same way I build backend systems: deliberately, defensively, and without anything that isn't earning its place.</em></p>

  <a href="https://alimehdiport.netlify.app/" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Live-alimehdiport.netlify.app-c9a84c?style=for-the-badge&logoColor=white" />
  </a>
  &nbsp;
  <img src="https://img.shields.io/badge/Stack-Vanilla_JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  &nbsp;
  <img src="https://img.shields.io/badge/Dependencies-Zero-c9a84c?style=for-the-badge" />
  &nbsp;
  <img src="https://img.shields.io/badge/Build_Step-None-6b6b7a?style=for-the-badge" />

</div>

---

## Preview

<div align="center">
  <img src="./image.png" alt="Portfolio Preview" width="90%" />
</div>

---

## Currently Building — Bitly

This portfolio is the shop window. The workbench is here:

**[Bitly →](https://github.com/ali0786mehdi/Bitly)** — a URL shortner

If you're evaluating me for a backend or systems role, that repo is a more honest signal than this one. This README documents the portfolio; AuthForge documents how I think about auth, data modeling, and API design.

---

## Why No Framework

Most portfolios ship 200–300KB of JavaScript to render a name, a photo, and three cards. This one doesn't, on purpose.

Not because frameworks are bad — I use React/Node daily elsewhere in this GitHub — but because a personal site is a small, mostly-static problem, and reaching for a framework to solve it would be the wrong tool for the job. Picking the right level of abstraction for the problem in front of you is itself the engineering decision, and it's one I'd rather demonstrate than explain in an interview.

What that buys here:
- No build step, no `node_modules`, no bundler config to go stale
- Every animation, observer, and interaction is a native Web API call I can point to and explain line-by-line
- Nothing to patch when a dependency ships a breaking change six months from now

---

## Engineering Notes

Specific decisions worth flagging, in the order a reviewer would likely find them:

| Area | Decision | Reasoning |
|---|---|---|
| **Scroll animations** | `IntersectionObserver`, not `scroll` event listeners | Scroll listeners fire dozens of times per second and force layout recalculation on the main thread; `IntersectionObserver` is async and off the critical path — same visual result, no jank |
| **Progress bar** | Guards `total <= 0` before dividing | `scrollHeight - innerHeight` can be zero or negative on short pages or mid-load; without the guard this silently renders `NaN%` |
| **Global functions** (`toggleAI`, `copyEmail`) | Deliberately *not* wrapped in an IIFE | They're invoked via inline `onclick` in the HTML, which only resolves against the global scope. Documented in-file so a future refactor to modules doesn't silently break both buttons |
| **External links** | `rel="noopener noreferrer"` on every `target="_blank"` | Without it, a linked page can read and redirect `window.opener` — a real reverse-tabnabbing vector, not a lint-rule nitpick |
| **Custom cursor** | Feature-detected via `ontouchstart` / `maxTouchPoints`, fully removed (not just hidden) on touch devices | A cursor-follow effect with no cursor to follow is dead code on ~60% of visitors; detecting and skipping it is cheaper than shipping it and hiding it with CSS |
| **Clipboard copy** | Falls back to `mailto:` if `navigator.clipboard` is unavailable | Clipboard API requires a secure context; degrading gracefully beats a dead button on `http://` or older browsers |
| **Theming** | `data-theme` attribute + CSS custom properties, persisted via `localStorage`, seeded from `prefers-color-scheme` | One source of truth for every color in the system; no duplicated dark/light rule sets |

---

## Feature Summary

| Feature | Implementation |
|---|---|
| Contextual hero greeting | Local `Date().getHours()`, no external time API or geolocation permission needed |
| Plain-English / technical description toggle | Two pre-written descriptions per project, swapped via `element.style.display` — a static content toggle, not a live AI call |
| Custom cursor with trailing ring | `requestAnimationFrame` + exponential smoothing (`ring += (target - ring) * 0.12` per frame) |
| Staggered card reveal | `IntersectionObserver` + sibling-index delay, so a row of cards enters left-to-right instead of all at once |
| Responsive layout | CSS Grid + Flexbox, sized entirely off custom properties — no framework grid system |
| Dark/light theming | CSS custom properties re-scoped under `[data-theme="light"]`, no duplicated stylesheets |

---

## Tech Stack

```
Structure   HTML5 — semantic markup, JSON-LD structured data for SEO
Styling     CSS3 — Grid, Flexbox, custom properties, keyframes
Logic       Vanilla JS — DOM APIs, IntersectionObserver, requestAnimationFrame,
            Clipboard API, localStorage
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
├── index.html      Single-page markup + structured data
├── style.css        Design tokens, layout, animation, theming
├── script.js         Interactivity — cursor, observers, form, theme
├── image.png        Preview screenshot
└── README.md
```

---

## Elsewhere on This Profile

| Project | Focus |
|---|---|
| [AuthForge](https://github.com/ali0786mehdi/authforge) | Auth API — TypeScript, Express, Prisma, PostgreSQL |
| [AI-Powered Study Planner](https://github.com/ali0786mehdi/ai-study-planner) | Full-stack MERN, Gemini API, JWT auth |
| [PashuNet-AI](https://github.com/ali0786mehdi/pashunet-ai) | CNN-based image classification |

---

## Contact

<p align="left">
  <a href="https://alimehdiport.netlify.app/"><img src="https://img.shields.io/badge/-Portfolio-c9a84c?style=for-the-badge" /></a>
  <a href="https://linkedin.com/in/ali-mehdi-mirza-2ba8a624b"><img src="https://img.shields.io/badge/-LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" /></a>
  <a href="mailto:alimehdimirza1010@gmail.com"><img src="https://img.shields.io/badge/-Email-c9a84c?style=for-the-badge&logo=gmail&logoColor=white" /></a>
  <a href="https://leetcode.com/u/Ali_mehdi_mirza"><img src="https://img.shields.io/badge/-LeetCode-FFA116?style=for-the-badge&logo=leetcode&logoColor=black" /></a>
</p>

<sub>Open to backend, full-stack, and platform-engineering internships — remote or Mumbai.</sub>
