/* ==========================================================================
   QuickTriage — triage logic
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
        title: "Does it suit today's plan?",
        help: "Weather, schedule, how long you'll be on your feet.",
        tip: "If the answer needs a “well, maybe”—it's a no.",
        plain: "Fits your actual plan",
        failLabel: "today's plan",
        suggestion: "Try a layer or shoes that suit today's weather and schedule."
      },
      {
        id: "fit",
        title: "Does it fit and feel right on?",
        help: "Right size, nothing digging in, comfortable to sit in.",
        tip: "Judge the item you'd have to sit in all afternoon, not the one you'd admire in a mirror.",
        plain: "Fits and feels right",
        failLabel: "fit and comfort",
        suggestion: "Choose a size or cut that lets you sit, reach, and move comfortably."
      },
      {
        id: "confidence",
        title: "Would you still be happy in it by lunchtime?",
        help: "Not at first glance—after four hours of wearing it.",
        tip: "If you'd want to change the moment you're out the door, that's your answer.",
        plain: "Still comfortable by lunchtime",
        failLabel: "all-day comfort",
        suggestion: "Swap it for something you'll still feel good wearing after a few hours."
      }
    ],
    shop: [
      {
        id: "plan",
        title: "Do you have an occasion for it this month?",
        help: "A real date, not a someday version of your life.",
        tip: "Bought for a hypothetical event is how the rag pile gets bigger.",
        plain: "Has a real occasion this month",
        failLabel: "a real occasion",
        suggestion: "Name a date this month you'll wear it; if none comes to mind, leave it on the rack."
      },
      {
        id: "fit",
        title: "Would it need repairs before you could wear it?",
        help: "Missing buttons, a stuck zipper, tears at the seam.",
        tip: "Anything that needs sewing is a project, not a purchase. Put it back.",
        plain: "Wearable without repairs",
        failLabel: "repairs before wear",
        suggestion: "Check the repair and cost; if it is more than a quick, affordable fix, leave it.",
        invert: true // a "yes, it needs repairs" answer counts as a failed check
      },
      {
        id: "confidence",
        title: "If you saw it in your closet tomorrow, would you wear it?",
        help: "Picture it next to what you already own.",
        tip: "If it only works in a version of itself you'd have to shop for—leave it on the rack.",
        plain: "You'd actually wear it",
        failLabel: "a place in your closet",
        suggestion: "Make sure it works with three pieces you already own; don't buy it if it needs another purchase."
      }
    ]
  };

  var CONTEXT_LABELS = {
    home: "Choosing at home",
    shop: "Shopping ukay-ukay"
  };

  /* ======================================================================
     2. STATE
     ====================================================================== */
  var state = {
    ctx: null,          // "home" | "shop"
    step: 0,            // index into the current question list
    answers: {},        // { plan: true, fit: false, ... }  — true means "passed"
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
     6. INTAKE — choosing a context
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
     7. TRIAGE — rendering each check
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

    // The third check is the tiebreaker — label the buttons accordingly
    var isLast = state.step === questions.length - 1;
    screens.triage.classList.toggle("qt-inverted-question", Boolean(question.invert));
    if (question.invert) {
      els.yes.innerHTML = ICONS.cross + "Yes, it needs repairs";
      els.no.innerHTML = ICONS.check + "No, it's ready to wear";
    } else {
      els.yes.innerHTML = ICONS.check + (isLast ? "Yes, I'd wear it" : "Yes, that's covered");
      els.no.innerHTML = ICONS.cross + (isLast ? "No, I wouldn't" : "No, it isn't");
    }

    els.yes.classList.toggle("qt-btn-yes", !question.invert);
    els.yes.classList.toggle("qt-btn-no", Boolean(question.invert));
    els.no.classList.toggle("qt-btn-no", !question.invert);
    els.no.classList.toggle("qt-btn-yes", Boolean(question.invert));

    els.back.textContent = state.step === 0 ? "← Change mode" : "← Back";

    els.yes.focus({ preventScroll: true });
  }

  function answer(passed) {
    var questions = currentQuestions();
    var question = questions[state.step];
    if (!question) return;

    state.answers[question.id] = question.invert ? !passed : passed;

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
    els.verdictTitle.textContent = passed ? "Grab and go" : "Put it back";
    els.verdictSub.textContent = passed
      ? "It passed all three checks."
      : "It missed: " + failedQuestions.map(function (q) { return q.failLabel; }).join(", ") + ".";

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
              (ok ? "Pass" : "Fail") +
            "</span>" +
          "</div>" +
          (ok ? "" : '<p class="qt-row-suggestion"><strong>Suggestion:</strong> ' + escapeHtml(q.suggestion) + "</p>") +
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
      els.sessionRecommendationText.textContent = "Check an item first, then use the result to decide what stays.";
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
      ? '<p class="qt-bd-note" style="margin-top:14px">Most often stopped by: <strong>' +
          escapeHtml(worst.plain) + "</strong>.</p>"
      : '<p class="qt-bd-note" style="margin-top:14px">Everything you checked passed every gate.</p>';

    if (approved === state.items.length) {
      els.sessionRecommendationText.textContent =
        approved + (approved === 1 ? " item passed" : " items passed") +
        " every check. Keep these as your benchmark for future choices.";
    } else if (approved === 0) {
      els.sessionRecommendationText.textContent =
        "None cleared all three checks. The most common issue was " + worst.failLabel +
        ". " + worst.suggestion;
    } else {
      els.sessionRecommendationText.textContent =
        "Keep the " + approved + (approved === 1 ? " item" : " items") + " that passed; " +
        "the " + rejected + (rejected === 1 ? " rejected item" : " rejected items") +
        " most often fell short on " + worst.failLabel + ". " + worst.suggestion;
    }

    els.breakdown.innerHTML =
      '<p class="qt-bd-title">What stopped the ones that failed</p>' + rows + note;

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
        ? "All three checks line up. It is worth buying, so plan to wear it this month."
        : "All three checks line up. Wear it for today's plan and move on.";
    }

    var labels = failedQuestions.map(function (q) { return q.failLabel; });
    if (failedQuestions.length === 1) {
      return state.ctx === "shop"
        ? "This purchase hinges on " + labels[0] + ". Check the suggestion below; if you cannot resolve it before buying, leave it."
        : "The only mismatch is " + labels[0] + ". Try the suggestion below, then choose something that feels like a clear yes.";
    }

    return state.ctx === "shop"
      ? "It misses " + formatList(labels) + ". Unless you can address every issue before paying, put it back."
      : "It misses " + formatList(labels) + ". Choose something that covers all of those needs today.";
  }

  function formatList(items) {
    if (items.length < 2) return items[0] || "";
    if (items.length === 2) return items[0] + " and " + items[1];
    return items.slice(0, -1).join(", ") + ", and " + items[items.length - 1];
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