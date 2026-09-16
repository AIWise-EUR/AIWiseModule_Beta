/**
 * analytics.js
 * Lightweight event tracking for AI-Wise Module.
 *
 * Tracks: prompt copy/download events + diagnostic questionnaire results.
 * Requires user consent (first-visit popup) before any data is sent.
 */
(function () {

  /* ── CONFIGURATION ─────────────────────────────────────────── */
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbyJFJW1CASqa3en_pGid025YGsuLR3VQaQc91Ve6L6fsdQIoe5qTMAOUpq6KyTRr7ET3A/exec";

  /* ── HELPERS ────────────────────────────────────────────────── */
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function hasConsent() {
    try { return localStorage.getItem("aiwise-consent") === "yes"; } catch (e) { return false; }
  }

  function setConsent(val) {
    try { localStorage.setItem("aiwise-consent", val); } catch (e) {}
  }

  function consentDecided() {
    try { return localStorage.getItem("aiwise-consent") !== null; } catch (e) { return true; }
  }

  /* ── SEND ───────────────────────────────────────────────────── */
  function send(eventType, data) {
    if (!ENDPOINT || !hasConsent()) return;
    var payload = JSON.stringify({
      eventType: eventType,
      date:      today(),
      data:      data || {}
    });
    try {
      fetch(ENDPOINT, { method: "POST", mode: "no-cors", body: payload });
    } catch (e) {}
  }

  /* ── CONSENT POPUP ──────────────────────────────────────────── */
  function showConsent() {
    var overlay = document.createElement("div");
    overlay.id = "aiwise-consent-overlay";
    overlay.style.cssText = [
      "position:fixed", "inset:0", "z-index:9999",
      "background:rgba(2,47,53,0.55)", "backdrop-filter:blur(3px)",
      "display:flex", "align-items:center", "justify-content:center",
      "padding:24px", "font-family:inherit"
    ].join(";");

    var box = document.createElement("div");
    box.style.cssText = [
      "background:#fff", "border-radius:14px", "max-width:480px", "width:100%",
      "padding:32px 28px", "box-shadow:0 8px 40px rgba(0,0,0,0.18)"
    ].join(";");

    box.innerHTML = [
      '<p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;',
        'letter-spacing:.08em;color:#2b5d63;">AI-Wise Module</p>',
      '<h2 style="margin:0 0 14px;font-size:18px;color:#022f35;line-height:1.3;">',
        'We collect anonymous usage data</h2>',
      '<p style="margin:0 0 10px;font-size:14px;color:#3d5254;line-height:1.6;">',
        'To improve this module, we record:</p>',
      '<ul style="margin:0 0 14px;padding-left:20px;font-size:14px;color:#3d5254;line-height:1.8;">',
        '<li>Which AI prompts you copy or download</li>',
        '<li>Your diagnostic questionnaire result (recommended step)</li>',
      '</ul>',
      '<p style="margin:0 0 24px;font-size:13px;color:#5a7174;line-height:1.6;">',
        'No names, email addresses, or identifying information are collected. ',
        'Data is used solely for research purposes within this course. ',
        'You can decline and still use all features of this module.</p>',
      '<div style="display:flex;gap:10px;justify-content:flex-end;">',
        '<button id="aiwise-consent-no" style="padding:9px 20px;border-radius:8px;border:1px solid #c8d5d6;',
          'background:#fff;color:#3d5254;font-size:14px;cursor:pointer;">Decline</button>',
        '<button id="aiwise-consent-yes" style="padding:9px 22px;border-radius:8px;border:none;',
          'background:#2b5d63;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Accept</button>',
      '</div>'
    ].join("");

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById("aiwise-consent-yes").addEventListener("click", function () {
      setConsent("yes");
      overlay.remove();
    });
    document.getElementById("aiwise-consent-no").addEventListener("click", function () {
      setConsent("no");
      overlay.remove();
    });
  }

  /* ── CURRENT STAGE ──────────────────────────────────────────── */
  var stage = document.body.getAttribute("data-stage") || "diagnostic";

  /* ── PROMPT BUTTON TRACKING ─────────────────────────────────── */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button[id]");
    if (!btn) return;
    var id = btn.id;
    if (id.indexOf("btn_copy_") === 0) {
      send("prompt_copy", { stage: stage, promptType: id.replace("btn_copy_", "") });
    } else if (id.indexOf("btn_download_") === 0) {
      send("prompt_download", { stage: stage, promptType: id.replace("btn_download_", "") });
    }
  });

  /* ── DIAGNOSTIC RESULT TRACKING ─────────────────────────────── */
  document.addEventListener("aiwise:diagnostic", function (e) {
    var d = e.detail || {};
    send("diagnostic_result", {
      recommendedStage: d.recommendedStage || "",
      checkedCount:     d.checkedCount     || 0,
      checkedNodes:     d.checkedNodes     || [],
      scores:           d.scores           || {}
    });
  });

  /* ── SHOW CONSENT ON FIRST VISIT ─────────────────────────────── */
  if (!consentDecided()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", showConsent);
    } else {
      showConsent();
    }
  }

  window.AIWISE_ANALYTICS = { send: send };

})();
