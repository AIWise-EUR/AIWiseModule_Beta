// Sticky feedback widget: a chat-bubble launcher pinned to the bottom-right
// that opens a small popup with a textarea. Injects its own styles and
// markup so any page can use it by including this single script.
//
// Submissions are POSTed to the same Google Apps Script endpoint that
// powers analytics.js, but with eventType "feedback" so they land in
// a dedicated "Feedback" sheet (see analytics-setup.gs). Feedback is
// user-initiated and bypasses the analytics consent gate -- the act
// of typing and clicking Send IS the consent.
(function () {
  if (document.querySelector('.fb-widget')) return;

  var FEEDBACK_ENDPOINT = "https://script.google.com/macros/s/AKfycbyJFJW1CASqa3en_pGid025YGsuLR3VQaQc91Ve6L6fsdQIoe5qTMAOUpq6KyTRr7ET3A/exec";

  var css = ''
    + '.fb-widget{position:fixed;bottom:140px;right:24px;z-index:9999;'
    +   'font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}'
    + '.fb-launcher{display:inline-flex;align-items:center;gap:8px;'
    +   'background:#022f35;color:#fff;border:none;border-radius:999px;'
    +   'padding:12px 18px 12px 14px;font:inherit;font-size:13px;font-weight:600;'
    +   'letter-spacing:0.01em;cursor:pointer;'
    +   'box-shadow:0 6px 20px rgba(2,47,53,0.28);'
    +   'transition:transform .2s ease,box-shadow .2s ease,background .2s ease;}'
    + '.fb-launcher:hover{transform:translateY(-2px);background:#0a464d;'
    +   'box-shadow:0 10px 28px rgba(2,47,53,0.32);}'
    + '.fb-launcher:focus-visible{outline:3px solid rgba(201,169,110,0.55);outline-offset:2px;}'
    + '.fb-launcher svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;}'
    + '.fb-panel{position:absolute;right:0;bottom:58px;width:320px;'
    +   'background:#fff;border:1px solid #d8dfde;border-radius:14px;'
    +   'box-shadow:0 18px 48px rgba(9,24,26,0.18);overflow:hidden;'
    +   'opacity:0;pointer-events:none;transform:translateY(8px) scale(0.98);'
    +   'transform-origin:100% 100%;transition:opacity .18s ease,transform .18s ease;}'
    + '.fb-widget.is-open .fb-panel{opacity:1;pointer-events:auto;transform:translateY(0) scale(1);}'
    + '.fb-panel-head{display:flex;align-items:center;justify-content:space-between;'
    +   'padding:14px 16px;border-bottom:1px solid #eceeed;}'
    + '.fb-panel-title{font-size:14px;font-weight:700;color:#0f2f33;letter-spacing:0.01em;}'
    + '.fb-close{background:none;border:none;padding:0 4px;'
    +   'font:inherit;font-size:22px;line-height:1;color:#5b6668;cursor:pointer;}'
    + '.fb-close:hover{color:#0f2f33;}'
    + '.fb-panel-body{padding:14px 16px 16px;}'
    + '.fb-label{display:block;font-size:12px;color:#5b6668;margin-bottom:8px;}'
    + '.fb-textarea{width:100%;min-height:110px;max-height:240px;box-sizing:border-box;'
    +   'border:1px solid #d8dfde;border-radius:10px;padding:10px 12px;'
    +   'font:inherit;font-size:13px;line-height:1.55;color:#0f2f33;resize:vertical;}'
    + '.fb-textarea:focus{outline:none;border-color:#2b5d63;'
    +   'box-shadow:0 0 0 3px rgba(43,93,99,0.12);}'
    + '.fb-submit{display:block;width:100%;margin-top:12px;padding:10px 14px;'
    +   'background:#022f35;color:#fff;border:none;border-radius:10px;'
    +   'font:inherit;font-size:13px;font-weight:600;cursor:pointer;'
    +   'transition:background .2s ease;}'
    + '.fb-submit:hover{background:#0a464d;}'
    + '.fb-submit:disabled{opacity:0.55;cursor:not-allowed;}'
    + '.fb-success{margin-top:10px;padding:10px 12px;background:#e9f3f1;'
    +   'color:#0f6e56;border-radius:8px;font-size:12.5px;text-align:center;}'
    + '@media (max-width:480px){'
    +   '.fb-panel{width:min(320px,calc(100vw - 32px));}}';

  var style = document.createElement('style');
  style.setAttribute('data-feedback-widget', '');
  style.textContent = css;
  document.head.appendChild(style);

  var wrapper = document.createElement('div');
  wrapper.className = 'fb-widget';
  wrapper.innerHTML = ''
    + '<div class="fb-panel" role="dialog" aria-label="Send feedback" aria-hidden="true">'
    +   '<div class="fb-panel-head">'
    +     '<div class="fb-panel-title">Feedback</div>'
    +     '<button class="fb-close" type="button" aria-label="Close feedback">&times;</button>'
    +   '</div>'
    +   '<div class="fb-panel-body">'
    +     '<label class="fb-label" for="fb-text">What\'s on your mind?</label>'
    +     '<textarea class="fb-textarea" id="fb-text" placeholder="Share a thought, suggestion, or issue..."></textarea>'
    +     '<button class="fb-submit" type="button">Send feedback</button>'
    +     '<div class="fb-success" hidden>Thank you &mdash; your feedback has been noted.</div>'
    +   '</div>'
    + '</div>'
    + '<button class="fb-launcher" type="button" aria-expanded="false" aria-haspopup="dialog">'
    +   '<svg viewBox="0 0 24 24" aria-hidden="true" stroke-linecap="round" stroke-linejoin="round">'
    +     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
    +   '</svg>'
    +   '<span>Feedback</span>'
    + '</button>';
  document.body.appendChild(wrapper);

  var launcher = wrapper.querySelector('.fb-launcher');
  var panel = wrapper.querySelector('.fb-panel');
  var closeBtn = wrapper.querySelector('.fb-close');
  var textarea = wrapper.querySelector('.fb-textarea');
  var submitBtn = wrapper.querySelector('.fb-submit');
  var successBox = wrapper.querySelector('.fb-success');

  function setOpen(isOpen) {
    wrapper.classList.toggle('is-open', isOpen);
    launcher.setAttribute('aria-expanded', String(isOpen));
    panel.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen) setTimeout(function () { textarea.focus(); }, 180);
  }

  launcher.addEventListener('click', function () {
    setOpen(!wrapper.classList.contains('is-open'));
  });
  closeBtn.addEventListener('click', function () { setOpen(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrapper.classList.contains('is-open')) setOpen(false);
  });

  // Close when clicking outside the panel/launcher
  document.addEventListener('click', function (e) {
    if (!wrapper.classList.contains('is-open')) return;
    if (wrapper.contains(e.target)) return;
    setOpen(false);
  });

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  submitBtn.addEventListener('click', function () {
    var text = textarea.value.trim();
    if (!text) { textarea.focus(); return; }

    // Local mirror so the entry is never silently lost (e.g. offline,
    // ad-blocker, endpoint down). Inspectable via DevTools too.
    var payload = { text: text, path: location.pathname, ts: new Date().toISOString() };
    try {
      var stored = JSON.parse(localStorage.getItem('aiwise_feedback') || '[]');
      stored.push(payload);
      localStorage.setItem('aiwise_feedback', JSON.stringify(stored));
    } catch (_) { /* ignore storage errors */ }

    // Ship to the shared Google Apps Script endpoint. eventType
    // "feedback" lands in a dedicated "Feedback" sheet.
    if (FEEDBACK_ENDPOINT) {
      try {
        fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          mode: "no-cors",
          body: JSON.stringify({
            eventType: "feedback",
            date: today(),
            data: { text: text, path: location.pathname }
          })
        });
      } catch (_) { /* network errors are non-fatal -- localStorage has it */ }
    }

    successBox.hidden = false;
    textarea.value = '';
    submitBtn.disabled = true;
    setTimeout(function () {
      successBox.hidden = true;
      submitBtn.disabled = false;
      setOpen(false);
    }, 1600);
  });
})();
