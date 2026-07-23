(() => {
  "use strict";

  /* ---------- i18n ---------- */
  function getPath(obj, path) {
    return path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);
  }

  function writeLang(lang) {
    const dict = CONTENT[lang];
    document.documentElement.lang = lang;
    document.title = dict.meta.title;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const val = getPath(dict, el.dataset.i18n);
      if (val !== null) el.innerHTML = val;
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    const toggle = document.getElementById("earlier-toggle");
    if (toggle) {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.innerHTML = expanded ? dict.exp.earlierHide : dict.exp.earlierShow;
    }

    localStorage.setItem("ga_lang", lang);
  }

  // Elements whose own box height won't move when their text re-wraps
  // (inline elements) delegate the height-lock to their block parent instead.
  function flipTargets(els) {
    const set = new Set();
    els.forEach((el) => {
      const isInline = getComputedStyle(el).display === "inline";
      set.add(isInline ? el.parentElement || el : el);
    });
    return Array.from(set);
  }

  function applyLang(lang, animate) {
    const dict = CONTENT[lang];
    if (!dict) return;

    if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      writeLang(lang);
      return;
    }

    const els = Array.from(document.querySelectorAll("[data-i18n]"));
    const targets = flipTargets(els);

    // Lock current heights so the text swap can't shove anything else on the page.
    targets.forEach((t) => {
      t.style.height = t.getBoundingClientRect().height + "px";
      t.style.overflow = "hidden";
    });

    els.forEach((el, i) => {
      el.style.transitionDelay = Math.min((i % 12) * 10, 90) + "ms";
      el.classList.add("i18n-out");
    });

    setTimeout(() => {
      writeLang(lang);

      // Measure the new natural height while still locked/invisible, then
      // morph smoothly into it instead of snapping.
      const newHeights = targets.map((t) => {
        const locked = t.style.height;
        t.style.height = "auto";
        const h = t.getBoundingClientRect().height;
        t.style.height = locked;
        return h;
      });

      requestAnimationFrame(() => {
        targets.forEach((t, i) => {
          t.style.transition = "height .45s cubic-bezier(.4,0,.2,1)";
          t.style.height = newHeights[i] + "px";
        });
        els.forEach((el) => el.classList.remove("i18n-out"));

        setTimeout(() => {
          targets.forEach((t) => {
            t.style.height = "";
            t.style.overflow = "";
            t.style.transition = "";
          });
          els.forEach((el) => { el.style.transitionDelay = ""; });
        }, 480);
      });
    }, 280);
  }

  function initLang() {
    const saved = localStorage.getItem("ga_lang");
    const lang = saved || "en";
    applyLang(lang, false);

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("active")) return;
        applyLang(btn.dataset.lang, true);
      });
    });
  }

  /* ---------- Theme toggle ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.getElementById("theme-toggle").setAttribute("aria-pressed", String(theme === "light"));
    localStorage.setItem("ga_theme", theme);
  }

  // Custom-property inheritance into ::view-transition-new(root) is flaky on
  // some desktop browsers (falls back silently), so the reveal origin is
  // baked directly into the keyframe text instead of read via var().
  function setRevealOrigin(x, y) {
    let styleEl = document.getElementById("theme-reveal-style");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "theme-reveal-style";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent =
      "@keyframes theme-reveal {" +
      "from { clip-path: circle(0% at " + x + "px " + y + "px); }" +
      "to { clip-path: circle(150% at " + x + "px " + y + "px); }" +
      "}";
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpRgb(a, b, t) {
    return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")";
  }

  // Mirrors the light/dark values baked into the stylesheet so a mid-drag
  // finger/cursor position can be painted directly, frame by frame.
  const THEME_KEYFRAMES = {
    light: {
      track: [[207, 230, 247], [246, 239, 224]],
      thumbBg: [255, 248, 228],
      core: [246, 201, 76],
      cutoutFill: [248, 242, 226], cutoutX: 7, cutoutY: -7, cutoutScale: 0,
      raysOpacity: 1, raysScale: 1, raysRotate: 0,
      starsOpacity: 0,
      thumbX: 0, thumbRotate: 0
    },
    dark: {
      track: [[23, 28, 44], [10, 9, 18]],
      thumbBg: [227, 230, 238],
      core: [207, 211, 218],
      cutoutFill: [23, 28, 44], cutoutX: 3.4, cutoutY: -3, cutoutScale: 1,
      raysOpacity: 0, raysScale: 0.4, raysRotate: -90,
      starsOpacity: 1,
      thumbX: 21, thumbRotate: -70
    }
  };
  const THEME_TRAVEL = 21;

  function initTheme() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const track = btn.querySelector(".theme-track");
    const thumb = btn.querySelector(".theme-thumb");
    const core = btn.querySelector(".theme-core");
    const cutout = btn.querySelector(".theme-cutout");
    const rays = btn.querySelector(".theme-rays");
    const stars = btn.querySelector(".theme-stars");
    const paintables = [track, thumb, core, cutout, rays, stars];

    const current = document.documentElement.getAttribute("data-theme") || "dark";
    btn.setAttribute("aria-pressed", String(current === "light"));

    function themeProgress(theme) { return theme === "light" ? 0 : 1; }

    function paint(p) {
      p = Math.max(0, Math.min(1, p));
      const L = THEME_KEYFRAMES.light, D = THEME_KEYFRAMES.dark;
      track.style.background = "linear-gradient(135deg, " + lerpRgb(L.track[0], D.track[0], p) + " 0%, " + lerpRgb(L.track[1], D.track[1], p) + " 100%)";
      thumb.style.background = lerpRgb(L.thumbBg, D.thumbBg, p);
      thumb.style.transform = "translateX(" + lerp(L.thumbX, D.thumbX, p) + "px) rotate(" + lerp(L.thumbRotate, D.thumbRotate, p) + "deg)";
      core.style.fill = lerpRgb(L.core, D.core, p);
      cutout.style.fill = lerpRgb(L.cutoutFill, D.cutoutFill, p);
      cutout.style.transform = "translate(" + lerp(L.cutoutX, D.cutoutX, p) + "px, " + lerp(L.cutoutY, D.cutoutY, p) + "px) scale(" + lerp(L.cutoutScale, D.cutoutScale, p) + ")";
      rays.style.opacity = lerp(L.raysOpacity, D.raysOpacity, p);
      rays.style.transform = "scale(" + lerp(L.raysScale, D.raysScale, p) + ") rotate(" + lerp(L.raysRotate, D.raysRotate, p) + "deg)";
      stars.style.opacity = lerp(L.starsOpacity, D.starsOpacity, p);
    }

    function setDragTransitions(value) {
      paintables.forEach((el) => { el.style.transition = value; });
    }

    function clearPaint() {
      paintables.forEach((el) => {
        el.style.background = ""; el.style.transform = ""; el.style.fill = ""; el.style.opacity = "";
      });
    }

    function commitTheme(next, originX, originY) {
      if (next === document.documentElement.getAttribute("data-theme")) return;
      setRevealOrigin(originX, originY);
      if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.startViewTransition(() => applyTheme(next));
      } else {
        applyTheme(next);
      }
    }

    // ---- click / tap (no meaningful pointer movement) ----
    let suppressClick = false;
    btn.addEventListener("click", (e) => {
      if (suppressClick) { suppressClick = false; return; }
      const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      const rect = btn.getBoundingClientRect();
      const isRealClick = e.clientX !== 0 || e.clientY !== 0;
      const x = isRealClick ? e.clientX : rect.left + rect.width / 2;
      const y = isRealClick ? e.clientY : rect.top + rect.height / 2;
      commitTheme(next, x, y);
    });

    // ---- drag, like a physical switch ----
    let dragging = false, moved = false, startX = 0, startP = 0;

    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== undefined && e.button > 0) return;
      dragging = true; moved = false;
      startX = e.clientX;
      startP = themeProgress(document.documentElement.getAttribute("data-theme"));
      btn.setPointerCapture(e.pointerId);
    });

    btn.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dx) < 3) return;
        moved = true;
        setDragTransitions("none");
      }
      paint(startP + dx / THEME_TRAVEL);
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      if (!moved) return; // treated as a plain click
      suppressClick = true;

      const dx = e.clientX - startX;
      const p = Math.max(0, Math.min(1, startP + dx / THEME_TRAVEL));
      const next = p > 0.5 ? "dark" : "light";
      const rect = btn.getBoundingClientRect();

      requestAnimationFrame(() => {
        setDragTransitions("");
        clearPaint();
        commitTheme(next, e.clientX, rect.top + rect.height / 2);
      });
    }

    btn.addEventListener("pointerup", endDrag);
    btn.addEventListener("pointercancel", () => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      requestAnimationFrame(() => { setDragTransitions(""); clearPaint(); });
    });
  }

  /* ---------- Custom cursor ---------- */
  function initCursor() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const dot = document.getElementById("cursor-dot");
    const ring = document.getElementById("cursor-ring");
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.body.classList.add("has-cursor");

    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + "px"; dot.style.top = my + "px";
    });

    function loop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.left = rx + "px"; ring.style.top = ry + "px";
      requestAnimationFrame(loop);
    }
    loop();

    document.querySelectorAll("a, button").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("hover"));
    });
  }

  /* ---------- Scroll progress ---------- */
  function initProgress() {
    const bar = document.getElementById("progress-bar");
    window.addEventListener("scroll", () => {
      const h = document.documentElement;
      const scrolled = (h.scrollTop) / (h.scrollHeight - h.clientHeight) * 100;
      bar.style.width = scrolled + "%";
    }, { passive: true });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = document.querySelectorAll(".reveal, .hero-title .line[data-split]");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    items.forEach((el, i) => {
      el.style.transitionDelay = Math.min((i % 6) * 60, 300) + "ms";
      io.observe(el);
    });
  }

  /* ---------- Hero on load (immediate, not scroll-based) ---------- */
  function initHero() {
    requestAnimationFrame(() => {
      document.querySelectorAll(".hero-title .line[data-split]").forEach((el) => {
        el.classList.add("in-view");
      });
      document.querySelectorAll(".hero .reveal").forEach((el, i) => {
        setTimeout(() => el.classList.add("in-view"), 300 + i * 120);
      });
    });
  }

  /* ---------- Stat counters ---------- */
  function initCounters() {
    const stats = document.querySelectorAll(".stat-value");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        const target = parseFloat(el.dataset.value);
        const prefix = el.dataset.prefix || "";
        const suffix = el.dataset.suffix || "";
        const duration = 1400;
        const start = performance.now();
        function tick(now) {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = prefix + Math.round(target * eased) + suffix;
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.4 });
    stats.forEach((el) => io.observe(el));
  }

  /* ---------- Magnetic buttons ---------- */
  function initMagnetic() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    document.querySelectorAll(".btn-magnetic").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      btn.addEventListener("mouseleave", () => { btn.style.transform = "translate(0,0)"; });
    });
  }

  /* ---------- Earlier career toggle ---------- */
  function initEarlier() {
    const toggle = document.getElementById("earlier-toggle");
    const list = document.getElementById("earlier-list");
    if (!toggle || !list) return;
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      list.hidden = expanded;
      const lang = document.documentElement.lang || "en";
      toggle.innerHTML = expanded ? CONTENT[lang].exp.earlierShow : CONTENT[lang].exp.earlierHide;
      if (!expanded) {
        list.querySelectorAll("li").forEach((li, i) => {
          li.style.opacity = "0";
          li.style.transform = "translateY(10px)";
          setTimeout(() => {
            li.style.transition = "opacity .5s ease, transform .5s ease";
            li.style.opacity = "1";
            li.style.transform = "translateY(0)";
          }, i * 45);
        });
      }
    });
  }

  /* ---------- Mobile nav toggle ---------- */
  function initMobileNav() {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");
    const langSwitch = document.querySelector(".lang-switch");
    if (!toggle) return;
    toggle.addEventListener("click", () => {
      const open = toggle.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      links.style.display = open ? "flex" : "";
      langSwitch.style.display = open ? "flex" : "";
      if (open) {
        links.style.cssText = "display:flex;flex-direction:column;position:absolute;top:100%;left:0;right:0;background:var(--bg);padding:1.5rem;gap:1.25rem;border-bottom:1px solid var(--line);";
        langSwitch.style.cssText = "display:flex;position:absolute;top:100%;right:1.5rem;margin-top: 9.5rem;";
      } else {
        links.style.cssText = ""; langSwitch.style.cssText = "";
      }
    });
    links.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => {
      toggle.classList.remove("open");
      links.style.cssText = ""; langSwitch.style.cssText = "";
    }));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initLang();
    initTheme();
    initCursor();
    initProgress();
    initHero();
    initReveal();
    initCounters();
    initMagnetic();
    initEarlier();
    initMobileNav();
  });
})();
