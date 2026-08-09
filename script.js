/* ==========================================================================
   AliOS — script.js
   Sections:
   1. Utilities (toast, clock, storage helpers)
   2. Custom cursor
   3. Boot sequence
   4. Theme + wallpaper
   5. Window manager (open/close/minimize/maximize/drag/resize/focus)
   6. Desktop icons + taskbar + start menu
   7. Context menu
   8. "Simplify" project description toggle
   9. Terminal app
   10. Ask Ali AI (local knowledge-base responder)
   11. Contact form + email copy
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------
     1. Utilities
  ------------------------------------------------------------------ */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const storage = {
    get(key, fallback) {
      try {
        const v = window.localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  function toast(message, duration) {
    const stack = $("#toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 200ms ease, transform 200ms ease";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(() => el.remove(), 220);
    }, duration || 2400);
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function startClock() {
    const clockEl = $("#status-clock");
    if (!clockEl) return;
    const tick = () => {
      const d = new Date();
      clockEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
    };
    tick();
    setInterval(tick, 15000);
  }

  /* ------------------------------------------------------------------
     2. Custom cursor
  ------------------------------------------------------------------ */
  function initCursor() {
    const cursor = $("#cursor");
    const ring = $("#cursorRing");
    if (!cursor || !ring) return;
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches) return;

    let ringX = 0, ringY = 0, mouseX = 0, mouseY = 0;

    window.addEventListener("pointermove", (e) => {
      mouseX = e.clientX; mouseY = e.clientY;
      cursor.style.left = mouseX + "px";
      cursor.style.top = mouseY + "px";
    });

    function raf() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.left = ringX + "px";
      ring.style.top = ringY + "px";
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    const interactiveSelector = "button, a, input, textarea, .app-window, [data-drag-handle]";
    document.addEventListener("pointerover", (e) => {
      if (e.target.closest && e.target.closest(interactiveSelector)) {
        ring.classList.add("is-active");
      }
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest && e.target.closest(interactiveSelector)) {
        ring.classList.remove("is-active");
      }
    });
  }

  /* ------------------------------------------------------------------
     3. Boot sequence
  ------------------------------------------------------------------ */
  function initBoot() {
    const screen = $("#boot-screen");
    const fill = $("#boot-progress-fill");
    const status = $("#boot-status");
    const skipBtn = $("#boot-skip");
    if (!screen) return;

    const messages = [
      "Loading kernel…",
      "Mounting /projects…",
      "Indexing skills.sys…",
      "Waking up Ask Ali AI…",
      "Almost there…"
    ];

    const alreadyBooted = storage.get("alios:booted", false);

    function finishBoot() {
      screen.setAttribute("data-hidden", "true");
      document.body.setAttribute("data-booted", "true");
      storage.set("alios:booted", true);
      setTimeout(() => { screen.style.display = "none"; }, 600);
    }

    if (alreadyBooted) {
      finishBoot();
      screen.style.display = "none";
      return;
    }

    let pct = 0;
    let msgIndex = 0;
    status.textContent = messages[0];

    const interval = setInterval(() => {
      pct += Math.random() * 18 + 8;
      if (pct >= 100) {
        pct = 100;
        fill.style.width = "100%";
        clearInterval(interval);
        setTimeout(finishBoot, 350);
        return;
      }
      fill.style.width = pct + "%";
      const nextMsgIndex = Math.min(messages.length - 1, Math.floor((pct / 100) * messages.length));
      if (nextMsgIndex !== msgIndex) {
        msgIndex = nextMsgIndex;
        status.textContent = messages[msgIndex];
      }
    }, 220);

    skipBtn.addEventListener("click", () => {
      clearInterval(interval);
      finishBoot();
    });
  }

  /* ------------------------------------------------------------------
     4. Theme + wallpaper
  ------------------------------------------------------------------ */
  function initTheme() {
    const savedTheme = storage.get("alios:theme", "dark");
    document.body.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);

    function updateThemeIcon(theme) {
      $$(".theme-toggle").forEach((btn) => {
        if (btn.id === "theme-toggle") btn.textContent = theme === "dark" ? "🌙" : "☀️";
      });
    }

    function toggleTheme() {
      const current = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
      document.body.setAttribute("data-theme", current);
      storage.set("alios:theme", current);
      updateThemeIcon(current);
      toast(current === "dark" ? "Dark mode on" : "Light mode on");
    }

    const toggleBtn = $("#theme-toggle");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleTheme);

    const startMenuTheme = $("#start-menu-theme");
    if (startMenuTheme) startMenuTheme.addEventListener("click", toggleTheme);

    // exposed for context menu
    window.__aliosToggleTheme = toggleTheme;
  }

  function initWallpaper() {
    const wallpapers = ["nebula", "grid", "void"];
    let idx = 0;
    window.__aliosCycleWallpaper = function () {
      idx = (idx + 1) % wallpapers.length;
      $("#desktop").setAttribute("data-wallpaper", wallpapers[idx]);
      toast("Wallpaper: " + wallpapers[idx]);
    };
  }

  /* ------------------------------------------------------------------
     5. Window manager
  ------------------------------------------------------------------ */
  const WindowManager = (function () {
    let zCounter = 20;
    const windows = {}; // appId -> { el, minimized }

    function register() {
      $$(".app-window").forEach((el) => {
        const appId = el.dataset.app;
        windows[appId] = { el, minimized: false };

        // Traffic light buttons
        $(".traffic.close", el).addEventListener("click", () => close(appId));
        $(".traffic.minimize", el).addEventListener("click", () => minimize(appId));
        $(".traffic.maximize", el).addEventListener("click", () => toggleMaximize(appId));

        // Focus on any pointerdown inside window
        el.addEventListener("pointerdown", () => focus(appId));

        makeDraggable(el);
        makeResizable(el);
      });
    }

    function open(appId) {
      const w = windows[appId];
      if (!w) return;
      w.el.setAttribute("data-open", "true");
      w.el.setAttribute("data-minimized", "false");
      w.minimized = false;
      w.el.setAttribute("aria-hidden", "false");
      focus(appId);
      renderTaskbar();
      closeStartMenu();
    }

    function close(appId) {
      const w = windows[appId];
      if (!w) return;
      w.el.setAttribute("data-open", "false");
      w.el.setAttribute("aria-hidden", "true");
      renderTaskbar();
    }

    function minimize(appId) {
      const w = windows[appId];
      if (!w) return;
      w.minimized = true;
      w.el.setAttribute("data-minimized", "true");
      renderTaskbar();
    }

    function restore(appId) {
      const w = windows[appId];
      if (!w) return;
      w.minimized = false;
      w.el.setAttribute("data-minimized", "false");
      focus(appId);
      renderTaskbar();
    }

    function toggle(appId) {
      const w = windows[appId];
      if (!w) return;
      const isOpen = w.el.getAttribute("data-open") === "true";
      if (!isOpen) { open(appId); return; }
      if (w.minimized) { restore(appId); return; }
      // already open + focused -> minimize; open but not top -> focus
      const topId = getTopAppId();
      if (topId === appId) minimize(appId); else focus(appId);
    }

    function toggleMaximize(appId) {
      const w = windows[appId];
      if (!w) return;
      const el = w.el;
      const isMax = el.getAttribute("data-maximized") === "true";
      if (isMax) {
        el.style.width = el.dataset.prevWidth || "";
        el.style.height = el.dataset.prevHeight || "";
        el.style.top = el.dataset.prevTop || "";
        el.style.left = el.dataset.prevLeft || "";
        el.style.right = el.dataset.prevRight || "";
        el.setAttribute("data-maximized", "false");
      } else {
        el.dataset.prevWidth = el.style.width;
        el.dataset.prevHeight = el.style.height;
        el.dataset.prevTop = el.style.top;
        el.dataset.prevLeft = el.style.left;
        el.dataset.prevRight = el.style.right;
        el.style.width = "min(920px, 94vw)";
        el.style.height = "80vh";
        el.style.top = "8vh";
        el.style.left = "50%";
        el.style.right = "auto";
        el.style.transform = "translateX(-50%)";
        el.setAttribute("data-maximized", "true");
      }
      focus(appId);
    }

    function focus(appId) {
      Object.keys(windows).forEach((id) => {
        windows[id].el.setAttribute("data-focused", id === appId ? "true" : "false");
      });
      const el = windows[appId].el;
      zCounter += 1;
      el.style.zIndex = zCounter;
      renderTaskbar();
    }

    function getTopAppId() {
      let top = null, topZ = -1;
      Object.keys(windows).forEach((id) => {
        const w = windows[id];
        if (w.el.getAttribute("data-open") === "true" && !w.minimized) {
          const z = parseInt(w.el.style.zIndex || "0", 10);
          if (z > topZ) { topZ = z; top = id; }
        }
      });
      return top;
    }

    function isOpenApps() {
      return Object.keys(windows).filter((id) => windows[id].el.getAttribute("data-open") === "true");
    }

    function renderTaskbar() {
      const container = $("#taskbar-open");
      if (!container) return;
      container.innerHTML = "";
      const openIds = isOpenApps();
      const topId = getTopAppId();
      openIds.forEach((id) => {
        const btn = document.createElement("button");
        btn.className = "taskbar-app";
        btn.type = "button";
        btn.dataset.running = "true";
        btn.title = id;
        btn.textContent = iconFor(id);
        if (id === topId) btn.style.borderColor = "var(--gold-dim)";
        btn.addEventListener("click", () => {
          if (windows[id].minimized) restore(id); else toggle(id);
        });
        container.appendChild(btn);
      });

      // mark pinned icons as running too
      $$(".taskbar-pinned .taskbar-app").forEach((btn) => {
        const id = btn.dataset.windowTarget;
        btn.dataset.running = openIds.indexOf(id) !== -1 ? "true" : "false";
      });
    }

    function iconFor(appId) {
      const map = {
        about: "🧑‍💻", experience: "🗂️", skills: "🛠️", projects: "🚀",
        hobbies: "🎧", ventures: "👞", "ai-assistant": "🤖", terminal: "▚",
        contact: "✉️", trash: "🗑️"
      };
      return map[appId] || "▫";
    }

    function makeDraggable(el) {
      const handle = $("[data-drag-handle]", el);
      if (!handle) return;
      let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;

      handle.addEventListener("pointerdown", (e) => {
        if (window.innerWidth <= 720) return; // no dragging on mobile sheets
        if (e.target.closest(".traffic")) return;
        dragging = true;
        const rect = el.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        el.style.left = startLeft + "px";
        el.style.top = startTop + "px";
        el.style.right = "auto";
        el.style.transform = "none";
        handle.setPointerCapture(e.pointerId);
      });

      handle.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let newLeft = startLeft + dx;
        let newTop = Math.max(4, startTop + dy);
        el.style.left = newLeft + "px";
        el.style.top = newTop + "px";
      });

      ["pointerup", "pointercancel"].forEach((evt) => {
        handle.addEventListener(evt, () => { dragging = false; });
      });
    }

    function makeResizable(el) {
      const handle = $("[data-resize-handle]", el);
      if (!handle) return;
      let resizing = false, startX = 0, startY = 0, startW = 0, startH = 0;

      handle.addEventListener("pointerdown", (e) => {
        resizing = true;
        const rect = el.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startW = rect.width; startH = rect.height;
        handle.setPointerCapture(e.pointerId);
        e.stopPropagation();
      });

      handle.addEventListener("pointermove", (e) => {
        if (!resizing) return;
        const newW = Math.max(280, startW + (e.clientX - startX));
        const newH = Math.max(220, startH + (e.clientY - startY));
        el.style.width = newW + "px";
        el.style.height = newH + "px";
      });

      ["pointerup", "pointercancel"].forEach((evt) => {
        handle.addEventListener(evt, () => { resizing = false; });
      });
    }

    return { register, open, close, minimize, restore, toggle, toggleMaximize, focus, renderTaskbar, getTopAppId };
  })();

  /* ------------------------------------------------------------------
     6. Desktop icons + taskbar (pinned) + start menu
  ------------------------------------------------------------------ */
  function initLaunchers() {
    $$("[data-window-target]").forEach((trigger) => {
      // taskbar pinned buttons need dataset for renderTaskbar lookups
      if (trigger.classList.contains("taskbar-app")) {
        trigger.dataset.windowTarget = trigger.dataset.windowTarget || trigger.getAttribute("data-window-target");
      }
      trigger.addEventListener("click", (e) => {
        const appId = trigger.getAttribute("data-window-target");
        if (!appId) return;
        WindowManager.open(appId);
      });
    });
  }

  function initStartMenu() {
    const startBtn = $("#start-btn");
    const startMenu = $("#start-menu");
    if (!startBtn || !startMenu) return;

    function openMenu() {
      startMenu.setAttribute("data-open", "true");
      startBtn.setAttribute("aria-expanded", "true");
    }
    function closeMenu() {
      startMenu.setAttribute("data-open", "false");
      startBtn.setAttribute("aria-expanded", "false");
    }
    window.__aliosCloseStartMenu = closeMenu;

    startBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = startMenu.getAttribute("data-open") === "true";
      isOpen ? closeMenu() : openMenu();
    });

    document.addEventListener("click", (e) => {
      if (!startMenu.contains(e.target) && e.target !== startBtn) closeMenu();
    });

    const searchInput = $("#start-menu-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        $$(".start-menu-list li").forEach((li) => {
          const text = li.textContent.trim().toLowerCase();
          li.style.display = text.indexOf(q) === -1 ? "none" : "";
        });
      });
    }

    const restartBtn = $("#start-menu-restart");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        storage.set("alios:booted", false);
        window.location.reload();
      });
    }
  }

  function closeStartMenu() {
    if (window.__aliosCloseStartMenu) window.__aliosCloseStartMenu();
  }

  /* ------------------------------------------------------------------
     7. Context menu
  ------------------------------------------------------------------ */
  function initContextMenu() {
    const menu = $("#context-menu");
    const desktop = $("#desktop");
    if (!menu || !desktop) return;

    function openMenu(x, y) {
      const maxX = window.innerWidth - 210;
      const maxY = window.innerHeight - 180;
      menu.style.left = Math.min(x, maxX) + "px";
      menu.style.top = Math.min(y, maxY) + "px";
      menu.setAttribute("data-open", "true");
    }
    function closeMenu() { menu.setAttribute("data-open", "false"); }

    desktop.addEventListener("contextmenu", (e) => {
      // only trigger on empty desktop space, not inside a window
      if (e.target.closest(".app-window") || e.target.closest(".status-bar") || e.target.closest(".taskbar")) return;
      e.preventDefault();
      openMenu(e.clientX, e.clientY);
    });

    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) closeMenu();
    });
    window.addEventListener("scroll", closeMenu, true);

    $$("[data-action]", menu).forEach((item) => {
      item.addEventListener("click", () => {
        const action = item.getAttribute("data-action");
        if (action === "change-wallpaper" && window.__aliosCycleWallpaper) window.__aliosCycleWallpaper();
        if (action === "toggle-theme" && window.__aliosToggleTheme) window.__aliosToggleTheme();
        if (action === "arrange-icons") toast("Icons arranged (they were already tidy).");
        if (action === "about-alios") toast("AliOS v1.0 — built with HTML, CSS & a lot of coffee ☕");
        closeMenu();
      });
    });
  }

  /* ------------------------------------------------------------------
     8. "Simplify" project description toggle
  ------------------------------------------------------------------ */
  function initSimplifyButtons() {
    $$(".simplify-btn").forEach((btn) => {
      const key = btn.getAttribute("data-simplify-target");
      const tech = $("#desc-" + key + "-tech");
      const simple = $("#desc-" + key + "-simple");
      if (!tech || !simple) return;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => {
        const showingSimple = !simple.hasAttribute("hidden");
        if (showingSimple) {
          simple.setAttribute("hidden", "");
          tech.removeAttribute("hidden");
          btn.setAttribute("aria-pressed", "false");
          btn.textContent = "🤖 Simplify";
        } else {
          tech.setAttribute("hidden", "");
          simple.removeAttribute("hidden");
          btn.setAttribute("aria-pressed", "true");
          btn.textContent = "🤖 Show technical";
        }
      });
    });
  }

  /* ------------------------------------------------------------------
     9. Terminal app
  ------------------------------------------------------------------ */
  function initTerminal() {
    const log = $("#terminal-log");
    const input = $("#terminal-input");
    if (!log || !input) return;

    const commands = {
      help: () =>
        "Available commands: about, skills, projects, experience, contact, resume, whoami, theme [dark|light], open <app>, clear, date, banner",
      whoami: () => "ali-mehdi-mirza · Computer Engineering student, VIT Mumbai · CGPA 9.95",
      about: () =>
        "Full-stack MERN developer & AI enthusiast, based in Mumbai. Building AuthForge, Nexora, and an AI study planner. Open to internships.",
      skills: () =>
        "MERN stack, TypeScript, Prisma, PostgreSQL, MongoDB, Python, Docker, Gemini API, DSA.",
      experience: () =>
        "SSoC 2026 open source contributor · Freelance AI Trainer @ Outlier AI · B.Tech Computer Engineering @ VIT Mumbai.",
      projects: () =>
        "AuthForge (auth API), Nexora (real-time chat), AI-Powered Study Planner, SSoC 2026 contributions. Type 'open projects' to see them.",
      contact: () => "alimehdimirza1010@gmail.com · +91 89530 19234 · type 'open contact' for the form.",
      resume: () => "Opening resume in a new tab…",
      date: () => new Date().toString(),
      banner: () => "     _    _ _  ___  ____  \n    / \\  | (_)/ _ \\/ ___| \n   / _ \\ | | | | | \\___ \\ \n  / ___ \\| | | |_| |___) |\n /_/   \\_\\_|_|\\___/|____/  — AliOS"
    };

    function printLine(text, isEcho) {
      const p = document.createElement("p");
      if (isEcho) {
        p.innerHTML = '<span style="color:var(--gold)">ali@portfolio:~$</span> ' + escapeHtml(text);
      } else {
        p.textContent = text;
      }
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    }

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str;
      return div.innerHTML;
    }

    function run(raw) {
      const trimmed = raw.trim();
      if (!trimmed) return;
      printLine(trimmed, true);
      const [cmd, ...rest] = trimmed.split(/\s+/);
      const arg = rest.join(" ");

      if (cmd === "clear") { log.innerHTML = ""; return; }
      if (cmd === "sudo") { printLine("Permission denied: you're not root here, only Ali is."); return; }
      if (cmd === "theme") {
        if (arg === "dark" || arg === "light") {
          document.body.setAttribute("data-theme", arg);
          storage.set("alios:theme", arg);
          printLine("Theme set to " + arg + ".");
        } else {
          printLine("Usage: theme [dark|light]");
        }
        return;
      }
      if (cmd === "open") {
        const target = arg.toLowerCase().replace(/\s+/g, "-");
        const validTargets = ["about", "experience", "skills", "projects", "hobbies", "ventures", "ai-assistant", "terminal", "contact", "trash"];
        if (validTargets.indexOf(target) !== -1) {
          WindowManager.open(target);
          printLine("Opening " + target + "…");
        } else {
          printLine("No such window: " + arg + ". Try: " + validTargets.join(", "));
        }
        return;
      }
      if (cmd === "resume") {
        printLine(commands.resume());
        window.open("AMM_Resume_internship%20(1).pdf", "_blank", "noopener,noreferrer");
        return;
      }
      if (commands[cmd]) {
        printLine(commands[cmd]());
        return;
      }
      printLine("Command not found: " + cmd + " — type 'help' for a list of commands.");
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        run(input.value);
        input.value = "";
      }
    });

    // focus the input whenever the terminal window is opened
    const terminalWindow = $("#window-terminal");
    if (terminalWindow) {
      terminalWindow.addEventListener("pointerdown", () => {
        setTimeout(() => input.focus(), 0);
      });
    }
  }

  /* ------------------------------------------------------------------
     10. Ask Ali AI — local knowledge-base responder
     NOTE: this runs entirely client-side against a small hard-coded
     knowledge base, so no API key is exposed in the page source.
     To upgrade this to a real LLM-backed assistant, replace answerFromKB()
     with a fetch() to your own serverless endpoint that calls an LLM
     API using a server-side key — never call a paid LLM API directly
     from client-side JS with an embedded key.
  ------------------------------------------------------------------ */
  function initAiAssistant() {
    const form = $("#ai-chat-form");
    const input = $("#ai-chat-input");
    const log = $("#ai-chat-log");
    if (!form || !input || !log) return;

    const KB = [
      {
        keys: ["stack", "tech", "technology", "language", "use"],
        answer: "Ali mainly works in the MERN stack (MongoDB, Express, React, Node.js) plus TypeScript, Prisma, and PostgreSQL for backend/auth work. On the AI side he uses the Gemini API, and for DSA/algorithms he codes in Python and JavaScript."
      },
      {
        keys: ["project", "built", "build", "recent", "authforge", "nexora"],
        answer: "Recent builds: AuthForge (a production-grade auth API with JWT rotation, RBAC, and 2FA), Nexora (a real-time chat platform using Redis Pub/Sub and BullMQ), and an AI-Powered Study Planner using the Gemini API. Open the Projects window on the desktop for details and links."
      },
      {
        keys: ["available", "intern", "internship", "hire", "job", "work", "remote"],
        answer: "Yes — Ali is open to software developer internships, full-stack roles, and collaborations, either remote or based in Mumbai. The fastest way to reach him is the Contact window or alimehdimirza1010@gmail.com."
      },
      {
        keys: ["education", "college", "cgpa", "university", "vit", "study", "degree"],
        answer: "Ali is a Computer Engineering student at Vidyalankar Institute of Technology (VIT), Mumbai, currently holding a CGPA of 9.95/10."
      },
      {
        keys: ["experience", "outlier", "ssoc", "opensource", "open-source", "work history"],
        answer: "Ali is an open source contributor for Social Summer of Code (SSoC) 2026, working on Algo-Infinity-Verse and AI-Agent-Automation. He also worked as a Freelance AI Trainer at Outlier AI, rating and refining LLM responses."
      },
      {
        keys: ["hobby", "hobbies", "free time", "fun", "outside"],
        answer: "Outside of code: chess, filming/editing for his YouTube channel, tutoring math, and strength training. Open the Hobbies window for the full list."
      },
      {
        keys: ["venture", "business", "footwear", "entrepreneur", "mirza"],
        answer: "Ali built and runs the digital storefront for Mirza Footwear, his family's leather shoe business — design, development, and deployment, solo."
      },
      {
        keys: ["contact", "email", "phone", "reach"],
        answer: "You can reach Ali at alimehdimirza1010@gmail.com or +91 89530 19234, or just fill out the form in the Contact window."
      },
      {
        keys: ["resume", "cv"],
        answer: "You can grab Ali's resume from the Resume icon on the desktop, or type 'resume' in the Terminal app."
      }
    ];

    const fallback = "I don't have a specific answer for that yet — try asking about Ali's stack, projects, experience, or availability, or open the Contact window to ask him directly.";

    function answerFromKB(question) {
      const q = question.toLowerCase();
      let best = null, bestScore = 0;
      KB.forEach((entry) => {
        let score = 0;
        entry.keys.forEach((k) => { if (q.indexOf(k) !== -1) score += 1; });
        if (score > bestScore) { bestScore = score; best = entry; }
      });
      return best ? best.answer : fallback;
    }

    function appendMessage(text, who) {
      const wrap = document.createElement("div");
      wrap.className = "ai-chat-msg ai-chat-msg--" + who;
      const avatar = document.createElement("div");
      avatar.className = "ai-chat-avatar";
      avatar.textContent = who === "user" ? "🙂" : "🤖";
      const bubble = document.createElement("div");
      bubble.className = "ai-chat-bubble";
      bubble.textContent = text;
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      log.appendChild(wrap);
      log.scrollTop = log.scrollHeight;
      return bubble;
    }

    function sendMessage(text) {
      const trimmed = text.trim();
      if (!trimmed) return;
      appendMessage(trimmed, "user");
      input.value = "";

      const typingBubble = appendMessage("…", "bot");
      const delay = 350 + Math.random() * 450;
      setTimeout(() => {
        typingBubble.textContent = answerFromKB(trimmed);
        log.scrollTop = log.scrollHeight;
      }, delay);
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage(input.value);
    });

    $$(".ai-suggestion-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        sendMessage(chip.getAttribute("data-suggestion") || chip.textContent);
      });
    });
  }

  /* ------------------------------------------------------------------
     11. Contact form + email copy
  ------------------------------------------------------------------ */
  function initContactForm() {
    const form = $("#contact-form");
    if (!form) return;
    const submitBtn = $("#submit-btn");
    const submitText = $("#submit-text");
    const successMsg = $("#form-success");
    const errorMsg = $("#form-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      successMsg.style.display = "none";
      errorMsg.style.display = "none";
      submitBtn.disabled = true;
      const originalLabel = submitText.textContent;
      submitText.textContent = "Sending…";

      try {
        const res = await fetch(form.action, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" }
        });
        if (res.ok) {
          successMsg.style.display = "block";
          form.reset();
        } else {
          errorMsg.style.display = "block";
        }
      } catch (err) {
        errorMsg.style.display = "block";
      } finally {
        submitBtn.disabled = false;
        submitText.textContent = originalLabel;
      }
    });
  }

  function initEmailCopy() {
    const btn = $("#copy-email-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const email = btn.textContent.trim();
      try {
        await navigator.clipboard.writeText(email);
        toast("Email copied to clipboard");
      } catch (e) {
        toast("Copy this: " + email);
      }
    });
  }

  /* ------------------------------------------------------------------
     Global keyboard shortcuts
  ------------------------------------------------------------------ */
  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const topId = WindowManager.getTopAppId();
        if (topId) WindowManager.minimize(topId);
        closeStartMenu();
      }
    });
  }

  /* ------------------------------------------------------------------
     Init
  ------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initCursor();
    initBoot();
    initTheme();
    initWallpaper();
    WindowManager.register();
    initLaunchers();
    initStartMenu();
    initContextMenu();
    initSimplifyButtons();
    initTerminal();
    initAiAssistant();
    initContactForm();
    initEmailCopy();
    initKeyboardShortcuts();
    startClock();
    WindowManager.renderTaskbar();
  });
})();
