/**
 * activity-common.js
 * Shared logic for all AI-Wise activity pages:
 *  - Header step badge
 *  - Fast-track navigation panel with progress states
 *  - Preset prompt copy / download with animation
 *  - GenAI intro collapsible
 *  - Previous / Next step navigation
 *  - Dialog popup handling
 *  - Button press effects
 */
(function () {
  /* ── CONFIG ──────────────────────────────────────────────── */
  var PAGE_MAP = {
    exploring:  "exploring-topic.html",
    rq:         "research-question.html",
    searching:  "searching-literature.html",
    organizing: "organizing-literature.html",
    outline:    "draft-outline.html",
    writing:    "writing-sections.html",
    finalizing: "finalizing-paper.html"
  };

  var STAGE_LABELS = {
    exploring:  "Exploring a Topic",
    rq:         "Research Question",
    searching:  "Searching Literature",
    organizing: "Organizing Literature",
    outline:    "Draft Structure",
    writing:    "Writing Sections",
    finalizing: "Finalizing the Paper"
  };

  var STAGE_ORDER = ["exploring", "rq", "searching", "organizing", "outline", "writing", "finalizing"];

  /* ── DETECT CURRENT STAGE ───────────────────────────────── */
  var currentStage = document.body.getAttribute("data-stage") || "";
  var currentIdx = STAGE_ORDER.indexOf(currentStage);

  /* ── HEADER BREADCRUMB (right-side slot) ────────────────── */
  function initHeaderBadge() {
    var badge = document.getElementById("header_step_badge");
    if (!badge || currentIdx < 0) return;
    var stageLabel = STAGE_LABELS[currentStage] || "";
    badge.innerHTML = '<span>Activities</span> &rsaquo; Step ' + (currentIdx + 1) + ' &middot; ' + stageLabel;
  }

  /* ── FAST-TRACK PANEL ───────────────────────────────────── */
  function buildFastTrackPanel() {
    var panel = document.createElement("div");
    panel.className = "fast-track-panel";

    var heading = '<p class="fast-track-heading">Steps</p>';
    heading += '<p class="fast-track-desc">Navigate between activity steps.</p>';

    var steps = '<div class="fast-track-steps">';
    STAGE_ORDER.forEach(function (stage, i) {
      var cls = "fast-track-step";
      var numContent = String(i + 1);

      if (stage === currentStage) {
        cls += " is-current";
      } else if (currentIdx >= 0 && i < currentIdx) {
        cls += " is-completed";
        numContent = "\u2713";
      } else if (currentIdx >= 0 && i > currentIdx) {
        cls += " is-future";
      }

      steps += '<a class="' + cls + '" href="' + PAGE_MAP[stage] + '">'
            +  '<span class="fast-track-step-num">' + numContent + '</span> '
            +  STAGE_LABELS[stage]
            +  '</a>';
    });
    steps += '</div>';

    var links = '<div class="fast-track-divider"></div>'
      + '<a class="fast-track-diag-link" href="diagnostic-questionnaire-final.html">\u2190 Diagnostic Questionnaire</a>'
      + '<a class="fast-track-diag-link" href="aws-i-materials.html">AWS I Materials</a>'
      + '<a class="fast-track-diag-link" href="lobby.html">\u2302 Home</a>';

    panel.innerHTML = heading + steps + links;
    return panel;
  }

  function injectFastTrack() {
    var content = document.querySelector(".page-content");
    if (!content) return;

    var shell = content.parentElement;
    if (!shell) return;

    var layout = document.createElement("div");
    layout.className = "activity-layout";

    var main = document.createElement("div");
    main.className = "activity-main";

    while (shell.firstChild) {
      main.appendChild(shell.firstChild);
    }

    var panel = buildFastTrackPanel();
    layout.appendChild(main);
    layout.appendChild(panel);
    shell.appendChild(layout);
  }

  /* ── STEP NAVIGATION (prev / next) ──────────────────────── */
  function initStepNav() {
    if (currentIdx < 0) return;

    var backLink = document.querySelector(".back-link");
    if (!backLink) return;

    var nav = document.createElement("nav");
    nav.className = "step-nav";

    /* Previous */
    var prevHref, prevLabel;
    if (currentIdx === 0) {
      prevHref = "diagnostic-questionnaire-final.html";
      prevLabel = "Diagnostic Questionnaire";
    } else {
      var prevStage = STAGE_ORDER[currentIdx - 1];
      prevHref = PAGE_MAP[prevStage];
      prevLabel = STAGE_LABELS[prevStage];
    }
    nav.innerHTML = '<a class="step-nav-link step-nav-prev" href="' + prevHref + '">'
      + '<span class="step-nav-label">\u2190 Previous</span>'
      + '<span class="step-nav-title">' + prevLabel + '</span>'
      + '</a>';

    /* Next */
    if (currentIdx < STAGE_ORDER.length - 1) {
      var nextStage = STAGE_ORDER[currentIdx + 1];
      nav.innerHTML += '<a class="step-nav-link step-nav-next" href="' + PAGE_MAP[nextStage] + '">'
        + '<span class="step-nav-label">Next \u2192</span>'
        + '<span class="step-nav-title">' + STAGE_LABELS[nextStage] + '</span>'
        + '</a>';
    }

    backLink.parentNode.replaceChild(nav, backLink);
  }

  /* ── (removed: genai collapse) ─────────────────────────── */

  /* ── MODULE HERO (full-width dark band above content) ──── */
  function initPageHero() {
    if (currentIdx < 0) return;

    var pageContent = document.querySelector(".page-content");
    if (!pageContent) return;
    var h2 = pageContent.querySelector("h2");
    if (!h2) return;

    var title = h2.textContent;
    var stepNum = currentIdx + 1;

    var mainSection = pageContent.closest("section");
    if (!mainSection || !mainSection.parentNode) return;

    var hero = document.createElement("section");
    hero.className = "module-hero";
    hero.innerHTML =
      '<div class="module-hero-grid"></div>'
      + '<div class="module-hero-glow"></div>'
      + '<div class="module-hero-inner">'
      +   '<div class="module-hero-tag"><span class="module-hero-tag-dot"></span>Step ' + stepNum + ' · Activity Module</div>'
      +   '<h2 class="module-hero-title">' + title + '</h2>'
      + '</div>';

    mainSection.parentNode.insertBefore(hero, mainSection);
    h2.remove();
  }

  /* ── GENAI FULL-WIDTH BAND ────────────────────────────────── */
  function initGenaiBand() {
    var intro = document.querySelector(".genaiIntro");
    var promptPanel = document.querySelector(".section-prompt-panel");
    if (!intro && !promptPanel) return;

    /* Find the parent that holds these elements */
    var parent = (intro || promptPanel).parentNode;
    if (!parent) return;

    /* Also grab the pre-prompt-space if it exists */
    var spacer = document.getElementById("pre_prompt_space");

    /* Create the full-width band (breaks out of max-width container) */
    var band = document.createElement("div");
    band.className = "genai-band";

    var bandInner = document.createElement("div");
    bandInner.className = "genai-band-inner";

    /* Move elements into band */
    if (spacer) band.appendChild(spacer);
    if (intro) bandInner.appendChild(intro);
    if (promptPanel) bandInner.appendChild(promptPanel);

    band.appendChild(bandInner);

    /* Insert band before the back-link / step-nav */
    var stepNav = parent.querySelector(".step-nav");
    var backLink = parent.querySelector(".back-link");
    var insertBefore = stepNav || backLink || null;
    if (insertBefore) {
      parent.insertBefore(band, insertBefore);
    } else {
      parent.appendChild(band);
    }
  }

  /* ── INIT ────────────────────────────────────────────────── */
  injectFastTrack();
  initHeaderBadge();
  initPageHero();
  initStepNav();
  initGenaiBand();

  /* ── PRESET PROMPT HELPERS ──────────────────────────────── */
  window.AIWISE_COMMON = window.AIWISE_COMMON || {};

  window.AIWISE_COMMON.setButtonFeedback = function (button, message) {
    if (!button) return;
    var original = button.textContent;
    button.textContent = message;
    button.classList.add("copy-success");
    setTimeout(function () {
      button.textContent = original;
      button.classList.remove("copy-success");
    }, 1300);
  };

  window.AIWISE_COMMON.copyPrompt = function (text, button) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        window.AIWISE_COMMON.setButtonFeedback(button, "Copied");
      }).catch(function () {
        window.AIWISE_COMMON.setButtonFeedback(button, "Copy failed");
      });
      return;
    }
    window.AIWISE_COMMON.setButtonFeedback(button, "Clipboard unavailable");
  };

  window.AIWISE_COMMON.downloadPrompt = function (text, filename) {
    var blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  window.AIWISE_COMMON.wirePromptBlock = function (promptText, preId, copyBtnId, dlBtnId, filename) {
    var pre = document.getElementById(preId);
    var copyBtn = document.getElementById(copyBtnId);
    var dlBtn = document.getElementById(dlBtnId);

    if (pre) pre.textContent = promptText;

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        window.AIWISE_COMMON.copyPrompt(promptText, copyBtn);
      });
    }

    if (dlBtn) {
      dlBtn.addEventListener("click", function () {
        window.AIWISE_COMMON.downloadPrompt(promptText, filename);
      });
    }
  };

  /* ── DIALOG POPUPS ──────────────────────────────────────── */
  document.querySelectorAll("[data-dialog-id]").forEach(function (trigger) {
    var dialogId = trigger.getAttribute("data-dialog-id");
    var dialog = dialogId ? document.getElementById(dialogId) : null;
    if (!dialog || typeof dialog.showModal !== "function") return;
    trigger.addEventListener("click", function () { dialog.showModal(); });
  });

  document.querySelectorAll("[data-dialog-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var dialog = btn.closest("dialog");
      if (dialog) dialog.close();
    });
  });

  document.querySelectorAll("dialog.content-popup").forEach(function (dialog) {
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  });

  /* ── BUTTON PRESS EFFECT ────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    btn.classList.remove("pressFx");
    void btn.offsetWidth;
    btn.classList.add("pressFx");
  });

})();
