/* ==========================================================================
   QuickTriage triage logic
   --------------------------------------------------------------------------
   Single source of truth for the questions. To reword a check, edit the
   QUESTIONS object below. Nothing else needs to change.
   ========================================================================== */
(function () {
  "use strict";

  /* ======================================================================
     1. QUESTIONS
     Three checks per context, in the order that rules out a bad pick fastest.
     `help`  -> the sub-line under the question
     `tip`   -> the highlighted hint box
     `plain` -> how the answer reads in the final report
     ====================================================================== */
  var QUESTIONS = {
    home: [
      {
        id: "plan",
        title: "Will this outfit work for your plans today?",
        help: "Think about the weather and what you will do.",
        tip: "If it does not fit your day, choose a different outfit.",
        plain: "Works for today's plans",
        failLabel: "matching your plans",
        suggestion: "Choose something that suits the weather and what you will do today."
      },
      {
        id: "fit",
        title: "Does it fit and feel comfortable?",
        help: "Can you sit, walk, and move comfortably?",
        tip: "If it feels tight or uncomfortable, choose something else.",
        plain: "Fits and feels comfortable",
        failLabel: "fit and comfort",
        suggestion: "Choose clothes that let you sit, reach, and move comfortably."
      },
      {
        id: "confidence",
        title: "Do you feel good in this outfit?",
        help: "You should like how you look and feel.",
        tip: "If you do not feel good in it, choose something else.",
        plain: "Feels right for you",
        failLabel: "feeling good in it",
        suggestion: "Choose something you will still feel good wearing after a few hours."
      }
    ],
    shop: [
      {
        id: "plan",
        title: "Will you wear it this month?",
        help: "Think of a real day or event.",
        tip: "If you cannot think of a time to wear it, you may not need it.",
        plain: "Has a time to wear it",
        failLabel: "finding a time to wear it",
        suggestion: "If you cannot name a day to wear it, save your money."
      },
      {
        id: "fit",
        title: "Can you wear it as it is?",
        help: "Check the buttons, zipper, and seams.",
        tip: "If it needs fixing before you can wear it, answer no.",
        plain: "Ready to wear as it is",
        failLabel: "needing a fix",
        suggestion: "Check what needs fixing. If it costs too much or takes too much work, leave it.",
        yesLabel: "Yes, I can wear it",
        noLabel: "No, it needs fixing"
      },
      {
        id: "confidence",
        title: "Will it go with clothes you already own?",
        help: "Think of an outfit you can make with it.",
        tip: "If you need to buy more clothes to wear it, it may not be worth it.",
        plain: "Goes with your clothes",
        failLabel: "matching clothes you own",
        suggestion: "Only buy it if it works with something you already own."
      }
    ]
  };

  var CONTEXT_LABELS = {
    home: "Choosing an outfit",
    shop: "Shopping for used clothes"
  };

  /* ======================================================================
     2. STATE
     ====================================================================== */
  var state = {
    ctx: null,          // "home" | "shop"
    step: 0,            // index into the current question list
    answers: {},        // Each answer is true if the check passed.
    items: [],          // completed items: { ctx, answers, passed }
    itemNumber: 0
  };

  /* ======================================================================
     3. ELEMENT LOOKUP
     All wired once at the bottom of the file.
     ====================================================================== */
  var $ = function (id) { return document.getElementById(id); };

  var screens = {
    intake: $("qt-intake"),
    triage: $("qt-triage"),
    verdict: $("qt-verdict"),
    summary: $("qt-summary")
  };

  var ctxButtons = Array.prototype.slice.call(document.querySelectorAll(".qt-ctx"));

  var els = {
    begin: $("qt-btn-begin"),
    ctxBadge: $("qt-ctx-badge"),
    counter: $("qt-item-counter"),
    progress: $("qt-progress"),
    barFill: $("qt-bar-fill"),
    qTitle: $("qt-q-title"),
    qHelp: $("qt-q-help"),
    tip: $("qt-tip"),
    yes: $("qt-yes"),
    no: $("qt-no"),
    back: $("qt-back"),
    verdictBox: $("qt-verdict-box"),
    verdictEmoji: $("qt-verdict-emoji"),
    verdictTitle: $("qt-verdict-title"),
    verdictSub: $("qt-verdict-sub"),
    report: $("qt-report"),
    recommendation: $("qt-recommendation"),
    recommendationText: $("qt-recommendation-text"),
    checkAnother: $("qt-check-another"),
    seeSummary: $("qt-see-summary"),
    statApproved: $("qt-stat-approved"),
    statRejected: $("qt-stat-rejected"),
    statTotal: $("qt-stat-total"),
    breakdown: $("qt-breakdown"),
    sessionRecommendationText: $("qt-session-recommendation-text"),
    startOver: $("qt-start-over"),
    backHome: $("qt-back-home")
  };

  /* ======================================================================
     4. ICONS
     Inline SVG so there are no icon fonts or external requests.
     ====================================================================== */
  var ICONS = {
    check: '<svg class="qt-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>',
    cross: '<svg class="qt-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
  };

  /* ======================================================================
     5. SCREEN ROUTING
     Exactly one screen is visible at a time; .qt-active drives display.
     ====================================================================== */
  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle("qt-active", key === name);
    });

    // Move focus to the new screen's heading for keyboard and screen-reader users
    var heading = screens[name].querySelector("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ======================================================================
     6. INTAKE: choosing a context
     ====================================================================== */
  function selectContext(ctx) {
    state.ctx = ctx;

    ctxButtons.forEach(function (btn) {
      var isSelected = btn.getAttribute("data-ctx") === ctx;
      btn.classList.toggle("qt-selected", isSelected);
      btn.setAttribute("aria-checked", isSelected ? "true" : "false");
      btn.setAttribute("tabindex", isSelected ? "0" : "-1");
    });

    els.begin.disabled = false;
    els.begin.removeAttribute("aria-disabled");
  }

  ctxButtons.forEach(function (btn, index) {
    btn.addEventListener("click", function () {
      selectContext(btn.getAttribute("data-ctx"));
    });

    // Arrow-key navigation inside the radiogroup
    btn.addEventListener("keydown", function (event) {
      var keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(event.key in keys)) return;

      event.preventDefault();
      var next = (index + keys[event.key] + ctxButtons.length) % ctxButtons.length;
      ctxButtons[next].focus();
      selectContext(ctxButtons[next].getAttribute("data-ctx"));
    });

    btn.addEventListener("keydown", function (event) {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        selectContext(btn.getAttribute("data-ctx"));
      }
    });
  });

  /* ======================================================================
     7. TRIAGE: rendering each check
     ====================================================================== */
  function currentQuestions() {
    return QUESTIONS[state.ctx] || [];
  }

  function startItem() {
    state.step = 0;
    state.answers = {};
    renderStep();
    showScreen("triage");
  }

  function renderStep() {
    var questions = currentQuestions();
    var question = questions[state.step];
    if (!question) return;

    els.ctxBadge.textContent = CONTEXT_LABELS[state.ctx] || "";
    els.counter.textContent = "Check " + (state.step + 1) + " of " + questions.length;

    els.progress.setAttribute("aria-valuenow", String(state.step + 1));
    els.progress.setAttribute("aria-valuemax", String(questions.length));
    els.barFill.style.width = ((state.step + 1) / questions.length * 100) + "%";

    els.qTitle.textContent = question.title;
    els.qHelp.textContent = question.help;
    els.tip.textContent = question.tip;

    // Re-run the entry animation on each step
    els.qTitle.classList.remove("qt-in");
    void els.qTitle.offsetWidth;
    els.qTitle.classList.add("qt-in");

    // The final question uses its own answer labels.
    els.yes.innerHTML = ICONS.check + (question.yesLabel || "Yes");
    els.no.innerHTML = ICONS.cross + (question.noLabel || "No");

    els.yes.classList.add("qt-btn-yes");
    els.yes.classList.remove("qt-btn-no");
    els.no.classList.add("qt-btn-no");
    els.no.classList.remove("qt-btn-yes");

    els.back.textContent = state.step === 0 ? "Change choice" : "Previous question";

    els.yes.focus({ preventScroll: true });
  }

  function answer(passed) {
    var questions = currentQuestions();
    var question = questions[state.step];
    if (!question) return;

    state.answers[question.id] = passed;

    if (state.step < questions.length - 1) {
      state.step += 1;
      renderStep();
    } else {
      finishItem();
    }
  }

  /* ======================================================================
     8. VERDICT
     ====================================================================== */
  function finishItem() {
    var questions = currentQuestions();
    var passed = questions.every(function (q) { return state.answers[q.id] === true; });

    state.itemNumber += 1;
    state.items.push({
      ctx: state.ctx,
      answers: Object.assign({}, state.answers),
      passed: passed,
      number: state.itemNumber
    });

    var failedQuestions = questions.filter(function (q) {
      return state.answers[q.id] !== true;
    });

    renderVerdict(passed, failedQuestions, questions);
    showScreen("verdict");
  }

  function renderVerdict(passed, failedQuestions, questions) {
    els.verdictBox.classList.remove("qt-verdict-grab", "qt-verdict-skip", "qt-verdict-in");
    void els.verdictBox.offsetWidth;
    els.verdictBox.classList.add(passed ? "qt-verdict-grab" : "qt-verdict-skip", "qt-verdict-in");

    els.verdictEmoji.innerHTML = passed ? ICONS.check : ICONS.cross;
    els.verdictTitle.textContent = passed
      ? "Good choice"
      : state.ctx === "shop" ? "Leave it" : "Choose another outfit";
    els.verdictSub.textContent = passed
      ? "It passed all three questions."
      : "It did not pass all three questions. Check the notes below.";

    els.recommendation.classList.remove("qt-recommendation-pass", "qt-recommendation-skip");
    els.recommendation.classList.add(passed ? "qt-recommendation-pass" : "qt-recommendation-skip");
    els.recommendationText.textContent = getVerdictRecommendation(failedQuestions);

    // Per-check report
    els.report.innerHTML = questions.map(function (q, i) {
      var ok = state.answers[q.id] === true;
      return (
        '<li class="qt-row" style="animation-delay:' + (i * 55) + 'ms">' +
          '<div class="qt-report-line">' +
            '<span class="qt-report-name">' + escapeHtml(q.plain) + "</span>" +
            '<span class="qt-mark ' + (ok ? "qt-mark-pass" : "qt-mark-fail") + '">' +
              (ok ? "Good" : "Needs a change") +
            "</span>" +
          "</div>" +
          (ok ? "" : '<p class="qt-row-suggestion"><strong>Try this:</strong> ' + escapeHtml(q.suggestion) + "</p>") +
        "</li>"
      );
    }).join("");
  }

  /* ======================================================================
     9. SUMMARY
     ====================================================================== */
  function renderSummary() {
    var questions = currentQuestions();
    var approved = state.items.filter(function (item) { return item.passed; }).length;
    var rejected = state.items.length - approved;

    els.statApproved.textContent = String(approved);
    els.statRejected.textContent = String(rejected);
    els.statTotal.textContent = String(state.items.length);

    if (!state.items.length) {
      els.breakdown.innerHTML = '<p class="qt-bd-note">No items checked in this session yet.</p>';
      els.sessionRecommendationText.textContent = "Check an item to see a suggestion here.";
      showScreen("summary");
      return;
    }

    // Count how often each check caught a fail
    var failCounts = questions.map(function (q) {
      return {
        plain: q.plain,
        failLabel: q.failLabel,
        suggestion: q.suggestion,
        count: state.items.filter(function (item) { return item.answers[q.id] !== true; }).length
      };
    });

    var worst = failCounts.reduce(function (a, b) { return b.count > a.count ? b : a; }, failCounts[0]);

    var maxCount = Math.max.apply(null, failCounts.map(function (f) { return f.count; }).concat([1]));

    var rows = failCounts.map(function (f, i) {
      var width = (f.count / maxCount) * 100;
      return (
        '<div class="qt-bd-row" style="--qt-w:' + width + '%;--qt-d:' + (i * 80) + 'ms">' +
          '<span class="qt-bd-name">' + escapeHtml(f.plain) + "</span>" +
          '<span class="qt-bd-count">' + f.count + "</span>" +
        "</div>"
      );
    }).join("");

    var note = worst.count > 0
      ? '<p class="qt-bd-note" style="margin-top:14px">Most common issue: <strong>' +
          escapeHtml(worst.plain) + "</strong>.</p>"
      : '<p class="qt-bd-note" style="margin-top:14px">Every item passed all three questions.</p>';

    if (approved === state.items.length) {
      els.sessionRecommendationText.textContent =
        approved + (approved === 1 ? " item" : " items") +
        " passed every question. Use " + (approved === 1 ? "it" : "them") +
        " as a guide next time.";
    } else if (approved === 0) {
      els.sessionRecommendationText.textContent =
        "No items passed all three questions. The most common issue was " + worst.failLabel +
        ". " + worst.suggestion;
    } else {
      els.sessionRecommendationText.textContent =
        approved + (approved === 1 ? " item passed" : " items passed") +
        " every question. Keep " + (approved === 1 ? "it" : "them") + ". " +
        rejected + (rejected === 1 ? " item did" : " items did") +
        " not pass every question. " + worst.suggestion;
    }

    els.breakdown.innerHTML =
      '<p class="qt-bd-title">Results for each question</p>' + rows + note;

    showScreen("summary");
  }

  /* ======================================================================
     10. HELPERS
     ====================================================================== */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getVerdictRecommendation(failedQuestions) {
    if (!failedQuestions.length) {
      return state.ctx === "shop"
        ? "It passed all three questions. Plan to wear it this month."
        : "It passed all three questions. Wear it today.";
    }

    if (failedQuestions.length === 1) {
      return state.ctx === "shop"
        ? "Try the suggestion below. If you cannot fix the problem before buying, leave it."
        : "Try the suggestion below, or choose another outfit.";
    }

    return state.ctx === "shop"
      ? "Check each suggestion below. If you cannot fix the problems before buying, leave it."
      : "Check each suggestion below, or choose another outfit.";
  }

  function resetSession() {
    state.ctx = null;
    state.step = 0;
    state.answers = {};
    state.items = [];
    state.itemNumber = 0;

    ctxButtons.forEach(function (btn) {
      btn.classList.remove("qt-selected");
      btn.setAttribute("aria-checked", "false");
      btn.setAttribute("tabindex", "0");
    });

    els.begin.disabled = true;
    els.begin.setAttribute("aria-disabled", "true");

    showScreen("intake");
  }

  /* ======================================================================
     11. EVENT WIRING
     ====================================================================== */
  els.begin.addEventListener("click", function () {
    if (!state.ctx) return;
    startItem();
  });

  els.yes.addEventListener("click", function () { answer(true); });
  els.no.addEventListener("click", function () { answer(false); });

  els.back.addEventListener("click", function () {
    if (state.step === 0) {
      resetSession();
    } else {
      state.step -= 1;
      delete state.answers[currentQuestions()[state.step].id];
      renderStep();
    }
  });

  els.checkAnother.addEventListener("click", startItem);
  els.seeSummary.addEventListener("click", renderSummary);
  els.startOver.addEventListener("click", resetSession);
  els.backHome.addEventListener("click", function () {
    window.location.href = "index.html";
  });

  // Keyboard shortcuts during triage: Y / N
  document.addEventListener("keydown", function (event) {
    if (!screens.triage.classList.contains("qt-active")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("button") && (event.key === " " || event.key === "Enter")) return;

    var key = event.key.toLowerCase();
    if (key === "y") { event.preventDefault(); answer(true); }
    if (key === "n") { event.preventDefault(); answer(false); }
  });

  /* ======================================================================
     12. DEEP LINKING
     session.html?mode=shop preselects the shopping context. Handy for
     sending someone straight into the ukay-ukay checklist.
     ====================================================================== */
  var params = new URLSearchParams(window.location.search);
  var mode = params.get("mode");
  if (mode && QUESTIONS[mode]) {
    selectContext(mode);
  }
})();