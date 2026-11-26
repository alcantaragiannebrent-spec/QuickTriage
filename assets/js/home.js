/* ==========================================================================
   QuickTriage home page behaviour
   1. Builds the desktop section rail from real section IDs
   2. Highlights the section currently in view
   3. Keeps the footer year current

   Everything degrades gracefully: with JS off you still get a working page.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. Footer year ---- */
  var yearEl = document.getElementById("qt-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---- 2. Section rail ----
     Edit this list to change which sections appear in the rail.
     `id` must match the id="" on the section in index.html.            */
  var SECTIONS = [
    { id: "intro",          label: "Intro" },
    { id: "how-it-works",   label: "How it works" },
    { id: "why-it-works",   label: "Why it works" },
    { id: "start-a-session", label: "Choose" }
  ];

  var rail = document.getElementById("qt-rail");
  if (!rail) return;

  var links = [];

  SECTIONS.forEach(function (section) {
    var target = document.getElementById(section.id);
    if (!target) return; // section missing — skip rather than render a dead link

    var a = document.createElement("a");
    a.href = "#" + section.id;
    a.setAttribute("aria-label", "Go to " + section.label);

    var dot = document.createElement("span");
    dot.className = "qt-dot";
    dot.setAttribute("aria-hidden", "true");

    var lbl = document.createElement("span");
    lbl.className = "qt-lbl";
    lbl.textContent = section.label;

    a.appendChild(dot);
    a.appendChild(lbl);
    rail.appendChild(a);

    links.push({ el: a, target: target });
  });

  if (!links.length) return;

  /* ---- 3. Scroll spy ----
     Uses IntersectionObserver where available; falls back to a scroll handler. */
  function setActive(activeLink) {
    links.forEach(function (link) {
      var isActive = link.el === activeLink;
      link.el.classList.toggle("qt-on", isActive);
      if (isActive) {
        link.el.setAttribute("aria-current", "true");
      } else {
        link.el.removeAttribute("aria-current");
      }
    });
  }

  if ("IntersectionObserver" in window) {
    var visible = new Map();

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      // Pick the section with the greatest visible area
      var best = null;
      var bestRatio = 0;
      visible.forEach(function (ratio, target) {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          best = target;
        }
      });

      if (!best) return;
      for (var i = 0; i < links.length; i++) {
        if (links[i].target === best) {
          setActive(links[i].el);
          break;
        }
      }
    }, {
      // A band across the middle of the viewport decides "what am I reading?"
      rootMargin: "-45% 0px -45% 0px",
      threshold: [0, 0.25, 0.5, 1]
    });

    links.forEach(function (link) { observer.observe(link.target); });

    // Set an initial state in case the page loads mid-document
    setActive(links[0].el);
  } else {
    var onScroll = function () {
      var marker = window.innerHeight * 0.4;
      var current = links[0];
      links.forEach(function (link) {
        var rect = link.target.getBoundingClientRect();
        if (rect.top <= marker) current = link;
      });
      setActive(current.el);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();