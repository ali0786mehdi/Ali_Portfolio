/**
 * Ali Mehdi Mirza — Portfolio
 * script.js
 *
 * This is your original script, kept behaviour-identical (same text,
 * same timings, same class names) with defensive null-checks added
 * so a missing element on one page/section can't throw and kill every
 * script below it. Each section below documents what it does and why.
 *
 * IMPORTANT: this file is NOT wrapped in an IIFE. toggleAI() and
 * copyEmail() are called via inline onclick="" attributes in index.html,
 * which can only see functions declared in the global scope. If you
 * ever refactor this to an IIFE or ES module, you must switch those
 * onclick attributes to addEventListener calls, or the buttons will
 * silently do nothing (browser console will show
 * "toggleAI is not defined").
 */

// ==========================================
// 1. PROJECT TOGGLE (AI vs Technical)
// ==========================================
/**
 * Swaps a project's description between its technical write-up and a
 * plain-English one-liner. Called from index.html as:
 *   <button onclick="toggleAI(this, 'pashunet')">
 *
 * @param {HTMLElement} btn - the button that was clicked (passed as `this`)
 * @param {string} projectId - matches the `desc-{projectId}-tech` /
 *   `desc-{projectId}-simple` element ids for that project card
 *
 * Note: this checks techDesc.style.display, which is the element's
 * INLINE style, not its computed/CSS style. On first click there's no
 * inline style yet (it's "" not "none"), so the first click always
 * takes the else branch — that's intentional and matches the CSS
 * default (.project-desc--simple starts hidden via a class, and the
 * first click is what sets the inline styles going forward).
 */
function toggleAI(btn, projectId) {
  const techDesc = document.getElementById(`desc-${projectId}-tech`);
  const simpleDesc = document.getElementById(`desc-${projectId}-simple`);

  if (!techDesc || !simpleDesc || !btn) {
    console.warn(`toggleAI: missing description elements for "${projectId}"`);
    return;
  }

  if (techDesc.style.display === "none") {
    techDesc.style.display = "block";
    simpleDesc.style.display = "none";
    btn.innerText = "🤖 Simplify";
    btn.style.color = "var(--gold)";
  } else {
    techDesc.style.display = "none";
    simpleDesc.style.display = "block";
    btn.innerText = "⚙️ Technical";
    btn.style.color = "var(--accent)";
  }
}

// ==========================================
// 2. CUSTOM CURSOR (Disabled on Touch Devices)
// ==========================================
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');

// Detect if the user is on a touch device. We check three signals because
// no single one is reliable across all browsers/devices (msMaxTouchPoints
// is the old Edge/IE fallback, maxTouchPoints covers modern touch laptops
// that also have a mouse, ontouchstart covers most mobile browsers).
const isTouchDevice = (('ontouchstart' in window) ||
  (navigator.maxTouchPoints > 0) ||
  (navigator.msMaxTouchPoints > 0));

if (!isTouchDevice && cursor && ring) {
  let mx = 0, my = 0, rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.transform = `translate(${mx - 5}px, ${my - 5}px)`;
  });

  // The ring lags behind the dot with simple exponential smoothing
  // (moves 12% of the remaining distance every frame) for a soft
  // trailing effect instead of snapping to the pointer instantly.
  function animateRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
    requestAnimationFrame(animateRing);
  }
  animateRing();

  // Make the ring bloom slightly when hovering anything clickable
  const clickables = document.querySelectorAll(
    'a, button, .btn-primary, .btn-ghost, .btn-resume, .nav-resume-btn, .tag'
  );
  clickables.forEach(el => {
    el.addEventListener('mouseenter', () => ring.classList.add('hover-effect'));
    el.addEventListener('mouseleave', () => ring.classList.remove('hover-effect'));
  });
} else {
  // Hide custom cursor elements completely on touch devices — there's
  // no pointer to track, and leaving them in the DOM with `cursor: none`
  // set globally would make taps look like nothing is happening.
  if (cursor) cursor.style.display = 'none';
  if (ring) ring.style.display = 'none';
}

// ==========================================
// 3. NAVBAR SCROLL EFFECT
// ==========================================
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });
}

// ==========================================
// 4. SCROLL PROGRESS BAR
// ==========================================
const progressBar = document.getElementById('progress-bar');
if (progressBar) {
  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    const total = document.documentElement.scrollHeight - window.innerHeight;
    // Guard against division by zero on short pages (e.g. while content
    // is still loading, or on very large viewports) — without this,
    // `total` can be 0 or negative and the bar snaps to NaN%/a huge %.
    const pct = total > 0 ? (scrolled / total) * 100 : 0;
    progressBar.style.width = `${pct}%`;
  });
}

// ==========================================
// 5. INTERSECTION OBSERVERS (Staggered Animations)
// ==========================================
// For grids (Cards, Timeline items) — reveals each item with a small
// delay based on its position among its siblings, so a row of 3 cards
// fades in left-to-right instead of all at once.
const gridSelector = '.timeline-item, .skill-card, .project-card';
const gridTargets = document.querySelectorAll(gridSelector);

if (gridTargets.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const siblings = el.parentElement
          ? el.parentElement.querySelectorAll(gridSelector)
          : [el];
        const idx = Array.from(siblings).indexOf(el);
        setTimeout(() => el.classList.add('visible'), Math.max(idx, 0) * 120);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  gridTargets.forEach(el => observer.observe(el));
}

// For headings and section labels — simple fade/slide, no stagger.
const animateTargets = document.querySelectorAll('[data-animate], [data-animate-left]');

if (animateTargets.length) {
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        animateObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  animateTargets.forEach(el => animateObserver.observe(el));
}

// ==========================================
// 6. SMART CONTEXTUAL GREETING
// ==========================================
/**
 * Rewrites the hero eyebrow text based on the visitor's local time of
 * day. Purely cosmetic — if #smart-greeting isn't on the page, this
 * just does nothing instead of throwing.
 */
function updateGreeting() {
  const greetingElement = document.getElementById('smart-greeting');
  if (!greetingElement) return;

  const hour = new Date().getHours();
  let dynamicText = "";

  if (hour >= 22 || hour < 5) {
    dynamicText = "Late night coding? Welcome. · ";
  } else if (hour >= 5 && hour < 12) {
    dynamicText = "Good morning. Let's build. · ";
  } else if (hour >= 12 && hour < 18) {
    dynamicText = "Good afternoon. · ";
  } else {
    dynamicText = "Good evening. · ";
  }

  greetingElement.innerHTML = dynamicText + "Mumbai, Maharashtra · Open to Remote";
}
updateGreeting();

// ==========================================
// 7. 1-CLICK COPY EMAIL
// ==========================================
/**
 * Copies the contact email to the clipboard and shows a brief
 * confirmation in place of the button's own text. Called from
 * index.html as: <button onclick="copyEmail(this)">
 *
 * Falls back to a plain mailto: link if the Clipboard API is
 * unavailable (e.g. the page isn't served over HTTPS, or an older
 * browser) rather than silently failing on click.
 */
function copyEmail(btn) {
  if (!btn) return;
  const email = "alimehdimirza1010@gmail.com";

  if (!navigator.clipboard) {
    window.location.href = `mailto:${email}`;
    return;
  }

  navigator.clipboard.writeText(email).then(() => {
    const originalText = btn.innerText;
    btn.innerText = "Copied to clipboard! ✓";
    btn.style.color = "var(--white)";
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.color = "var(--gold)";
    }, 2000);
  }).catch(() => {
    window.location.href = `mailto:${email}`;
  });
}

// ==========================================
// 8. AJAX CONTACT FORM (Formspree)
// ==========================================
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const submitIcon = document.getElementById('submit-icon');
    const successMsg = document.getElementById('form-success');
    const errorMsg = document.getElementById('form-error');

    // Loading state
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Sending...';
    if (submitIcon) submitIcon.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';

    try {
      const response = await fetch(contactForm.action, {
        method: 'POST',
        body: new FormData(contactForm),
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        // Success
        contactForm.reset();
        if (successMsg) successMsg.style.display = 'block';
        if (submitText) submitText.textContent = '✓ Sent!';
        setTimeout(() => {
          if (submitBtn) submitBtn.disabled = false;
          if (submitText) submitText.textContent = 'Send Message';
          if (submitIcon) submitIcon.style.display = 'inline';
        }, 4000);
      } else {
        throw new Error('Form submission failed');
      }
    } catch (err) {
      // Error — covers both a non-2xx response above and network
      // failures (fetch rejects on network errors, not on HTTP errors,
      // so both paths land here).
      if (errorMsg) errorMsg.style.display = 'block';
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'Send Message';
      if (submitIcon) submitIcon.style.display = 'inline';
    }
  });
}

// ==========================================
// 9. DARK / LIGHT MODE TOGGLE
// ==========================================
const themeToggle = document.getElementById('theme-toggle');
const iconMoon = document.getElementById('icon-moon');
const iconSun = document.getElementById('icon-sun');

/**
 * Sets data-theme on <html> (which style.css keys its [data-theme="light"]
 * overrides off of) and swaps the moon/sun icon in the toggle button.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (iconMoon && iconSun) {
    if (theme === 'light') {
      iconMoon.style.display = 'none';
      iconSun.style.display = 'block';
    } else {
      iconMoon.style.display = 'block';
      iconSun.style.display = 'none';
    }
  }
}

// On page load — check localStorage first, then system preference
const savedTheme = localStorage.getItem('theme');
const systemLight = window.matchMedia('(prefers-color-scheme: light)').matches;
const initialTheme = savedTheme || (systemLight ? 'light' : 'dark');
applyTheme(initialTheme);

// On toggle click
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem('theme', next);
  });
}
