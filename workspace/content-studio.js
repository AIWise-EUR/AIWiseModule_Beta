/* Local authoring for AWS1 C2 examples. No writes to module data or release queues. */
(() => {
  'use strict';
  const KEY = 'aiwise_content_studio_aws1_c2_v1';
  const FIELDS = [
    ['title', 'Example title'],
    ['thinking', 'What you are actually thinking'],
    ['typing_note', 'Context note (optional)'],
    ['typing', 'What you type'],
    ['processing', 'How the model actually processes this']
  ];
  const clone = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let session = null;
  const dirty = () => !!session?.examples && !equal(session.examples, session.saved);
  const valid = items => Array.isArray(items) && items.length > 0 && items.every(item =>
    item && typeof item === 'object' && FIELDS.every(([key]) =>
      typeof item[key] === 'string' || (key === 'typing_note' && item[key] === undefined)));

  function message(s, text, error = false) {
    s.host.querySelectorAll('.cs-status').forEach(node => {
      node.textContent = text;
      node.dataset.error = String(error);
    });
  }
  function controls(s) {
    s.host.querySelectorAll('[data-cs-save]').forEach(button => button.disabled = s.blocked || !dirty());
  }
  function record(s) {
    return { schema: 1, course: 'aws1', slot: 'c2.examples', savedAt: new Date().toISOString(),
      baseExamples: s.base, examples: s.examples };
  }
  function save(s) {
    if (s !== session || s.blocked) return;
    try {
      if (localStorage.getItem(KEY) !== s.raw) {
        message(s, 'Another tab changed this draft. Your edits have not been saved. Copy any text you want to keep before reloading the saved version.', true);
        return;
      }
      const raw = JSON.stringify(record(s));
      localStorage.setItem(KEY, raw);
      s.raw = raw;
      s.saved = clone(s.examples);
      message(s, 'Draft saved in this browser · ' + new Date().toLocaleTimeString() + '. Beta is unchanged.');
      controls(s);
    } catch {
      message(s, 'Draft could not be saved. Your edits are still here. Keep this page open and try saving again.', true);
    }
  }
  function reset(s) {
    if (!confirm('Discard this browser’s C2 draft and current edits? The preview will return to the current Beta content.')) return;
    try {
      if (!s.storageRead || localStorage.getItem(KEY) !== s.raw) {
        message(s, 'The saved draft could not be safely reset. Copy any text you want to keep before reloading.', true); return;
      }
      localStorage.removeItem(KEY);
      s.raw = null; s.blocked = false;
      s.examples = clone(s.base); s.saved = clone(s.base);
      updateExamples(s); controls(s);
      message(s, 'Draft reset to current Beta content.');
    } catch { message(s, 'Draft could not be reset. The saved copy has been preserved.', true); }
  }

  const reduceMotion = () => window.AIWiseMotion.reduced();
  const finishAfterMotion = (node, token, complete) => window.AIWiseMotion.after(node, complete, token);
  function scrollPreview(s, id, animate = true) {
    const target = s.frame.contentDocument.getElementById(id);
    if (target) s.frame.contentWindow.scrollTo({ top: target.getBoundingClientRect().top + s.frame.contentWindow.scrollY - 84, behavior: animate && !reduceMotion() ? 'smooth' : 'instant' });
  }
  function closePicker(s, focus = false) {
    const menu = s.host.querySelector('#cs-examples-menu');
    const trigger = s.host.querySelector('#cs-example');
    trigger.setAttribute('aria-expanded', 'false');
    if (!menu.hidden && !s.cancelPickerClose) {
      const complete = () => {
        menu.hidden = true; menu.inert = false; menu.classList.remove('cs-closing'); s.cancelPickerClose = null;
      };
      if (reduceMotion()) complete();
      else {
        menu.classList.add('cs-closing');
        s.cancelPickerClose = finishAfterMotion(menu, '--cs-motion-menu', complete);
        menu.inert = true;
      }
    }
    if (focus) trigger.focus({ preventScroll: true });
  }
  function setupPicker(s) {
    const trigger = s.host.querySelector('#cs-example');
    const menu = s.host.querySelector('#cs-examples-menu');
    const open = () => {
      s.cancelPickerClose?.(); s.cancelPickerClose = null;
      menu.classList.remove('cs-closing'); menu.inert = false;
      menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      menu.children[s.index]?.focus({ preventScroll: true });
    };
    trigger.addEventListener('click', () => trigger.getAttribute('aria-expanded') === 'false' ? open() : closePicker(s));
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    });
    menu.addEventListener('keydown', event => {
      const buttons = [...menu.children], index = buttons.indexOf(document.activeElement);
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); buttons[next].focus(); }
    });
    s.host.querySelector('.cs-picker').addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); event.stopPropagation(); closePicker(s, true); }
    });
    s.host.querySelector('.cs-picker').addEventListener('focusout', event => {
      if (!event.currentTarget.contains(event.relatedTarget)) closePicker(s);
    });
    document.addEventListener('pointerdown', event => {
      if (!s.host.querySelector('.cs-picker').contains(event.target)) closePicker(s);
    }, { signal: s.abort.signal });
    s.host.querySelector('[data-cs-prev]').addEventListener('click', () => { selectSlide(s, s.index - 1); scrollPreview(s, 'carousel'); });
    s.host.querySelector('[data-cs-next]').addEventListener('click', () => { selectSlide(s, s.index + 1); scrollPreview(s, 'carousel'); });
  }
  function selectSlide(s, index) {
    s.index = Math.max(0, Math.min(index, s.examples.length - 1));
    const doc = s.frame.contentDocument;
    doc.getElementById('carouselTrack').style.transform = `translateX(-${s.index * 100}%)`;
    doc.querySelectorAll('.carousel-slide').forEach((slide, i) => {
      slide.inert = i !== s.index;
      slide.setAttribute('aria-hidden', String(i !== s.index));
    });
    doc.querySelectorAll('.carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === s.index);
      dot.setAttribute('aria-pressed', String(i === s.index));
    });
    doc.getElementById('carouselPrev').disabled = s.index === 0;
    doc.getElementById('carouselNext').disabled = s.index === s.examples.length - 1;
    s.host.querySelector('[data-cs-prev]').disabled = s.index === 0;
    s.host.querySelector('[data-cs-next]').disabled = s.index === s.examples.length - 1;
    s.host.querySelector('[data-cs-count]').textContent = `${s.index + 1} / ${s.examples.length}`;
    s.host.querySelector('[data-cs-title]').textContent = s.examples[s.index].title || 'Untitled example';
    s.host.querySelector('#cs-example').setAttribute('aria-label', `Choose an example. Example ${s.index + 1} of ${s.examples.length}: ${s.examples[s.index].title || 'Untitled example'}`);
    s.host.querySelectorAll('[data-cs-choice]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === s.index)));
  }
  function updateExamples(s) {
    const doc = s.frame.contentDocument;
    const track = doc.getElementById('carouselTrack');
    const y = s.frame.contentWindow.scrollY;
    window.AIWiseCourseRenderer.carousel(track, s.examples);
    const menu = s.host.querySelector('#cs-examples-menu');
    menu.replaceChildren();
    s.examples.forEach((item, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.csChoice = String(i);
      const number = document.createElement('span'); number.className = 'cs-option-number'; number.textContent = String(i + 1).padStart(2, '0');
      const title = document.createElement('span'); title.textContent = item.title || 'Untitled example';
      button.append(number, title);
      button.addEventListener('click', () => { selectSlide(s, i); scrollPreview(s, 'carousel'); closePicker(s, true); });
      menu.appendChild(button);
    });
    track.querySelectorAll('.carousel-card').forEach((card, i) => {
      card.tabIndex = 0; card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Edit example ${i + 1}: ${s.examples[i].title || 'Untitled example'}`);
      const label = doc.createElement('span');
      label.className = 'cs-edit-label'; label.textContent = 'Edit course example';
      card.prepend(label);
      card.addEventListener('click', () => openEditor(s, i));
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(s, i); }
      });
    });
    selectSlide(s, s.index);
    s.frame.contentWindow.scrollTo(0, y);
  }
  function openEditor(s, index) {
    closePicker(s);
    selectSlide(s, index);
    scrollPreview(s, 'carousel');
    s.host.querySelector('#cs-editor-title').textContent = `Example ${index + 1}`;
    FIELDS.forEach(([key]) => s.host.querySelector(`[name="${key}"]`).value = s.examples[index][key] || '');
    s.dialog.showModal();
    s.host.querySelector('[name="title"]').focus({ preventScroll: true });
  }

  function closeEditor(s) {
    if (!s.dialog.open || s.cancelEditorClose) return;
    if (reduceMotion()) { s.dialog.close(); return; }
    s.dialog.classList.add('cs-closing');
    s.cancelEditorClose = finishAfterMotion(s.dialog, '--cs-motion-panel', () => {
      s.cancelEditorClose = null;
      s.dialog.close(); s.dialog.classList.remove('cs-closing');
    });
  }

  function setupEditorResize(s) {
    const handle = s.host.querySelector('.cs-resize-handle');
    let width = 600, drag = null;
    const apply = () => {
      const max = document.documentElement.clientWidth, min = Math.min(360, max);
      const actual = Math.max(min, Math.min(width, max));
      s.dialog.style.setProperty('--cs-editor-width', actual + 'px');
      handle.setAttribute('aria-valuemin', String(min));
      handle.setAttribute('aria-valuemax', String(max));
      handle.setAttribute('aria-valuenow', String(Math.round(actual)));
      handle.setAttribute('aria-valuetext', Math.round(actual) + ' pixels wide');
    };
    const setWidth = next => {
      const max = document.documentElement.clientWidth;
      width = Math.max(Math.min(360, max), Math.min(next, max));
      apply();
    };
    const stop = () => {
      const pointer = drag?.id; drag = null;
      s.dialog.classList.remove('cs-resizing');
      if (pointer !== undefined && handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer);
    };
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      drag = { id: event.pointerId, x: event.clientX, width: s.dialog.getBoundingClientRect().width };
      handle.setPointerCapture(event.pointerId);
      handle.focus({ preventScroll: true });
      s.dialog.classList.add('cs-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (drag?.id === event.pointerId) setWidth(drag.width + drag.x - event.clientX);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => handle.addEventListener(type, stop));
    // A drag ending on the backdrop must not be interpreted as a click outside the editor.
    handle.addEventListener('click', event => event.stopPropagation());
    handle.addEventListener('keydown', event => {
      const step = event.shiftKey ? 50 : 20, current = s.dialog.getBoundingClientRect().width;
      const next = { ArrowLeft: current + step, ArrowRight: current - step, Home: 360, End: document.documentElement.clientWidth }[event.key];
      if (next !== undefined) { event.preventDefault(); setWidth(next); }
    });
    s.dialog.addEventListener('close', stop);
    s.abort.signal.addEventListener('abort', stop, { once: true });
    window.addEventListener('resize', apply, { signal: s.abort.signal });
    apply();
  }

  // The real module HTML and renderers are reused, with scripts and navigation isolated.
  function previewHTML(html, url) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, base, iframe, object, embed, meta[http-equiv]').forEach(node => node.remove());
    doc.querySelectorAll('*').forEach(node => {
      [...node.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || (/^(href|src|action)$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) node.removeAttribute(attr.name);
      });
    });
    const base = doc.createElement('base'); base.href = url; doc.head.prepend(base);
    // WebKit blocks parent-installed listeners without allow-scripts on the frame.
    // CSP still prevents all scripts in the module (including inline handlers) from running.
    const policy = doc.createElement('meta'); policy.httpEquiv = 'Content-Security-Policy';
    policy.content = "script-src 'none'; object-src 'none'; frame-src 'none'; connect-src 'none'; form-action 'none'";
    doc.head.prepend(policy);
    const style = doc.createElement('style');
    style.textContent = `
      #carousel { scroll-margin-top:84px; }
      .carousel-card { position:relative; cursor:pointer; outline:2px dashed #35617f; outline-offset:-3px; }
      .carousel-card:hover,.carousel-card:focus-visible { outline:3px solid #35617f; }
      .cs-edit-label { display:block; padding:8px 22px; color:#35617f; background:#edf3f7; font:600 12px/1.5 sans-serif; }
      .carousel-card p { white-space:pre-wrap; overflow-wrap:anywhere; }
      .carousel-card-header { overflow-wrap:anywhere; }
      html { scroll-behavior:auto !important; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { transition:none !important; animation:none !important; scroll-behavior:auto !important; }
      }
    `;
    doc.head.appendChild(style);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  function connectPreview(s, data) {
    if (session !== s || s.abort.signal.aborted) return;
    try {
      const doc = s.frame.contentDocument;
      doc.addEventListener('pointerdown', () => closePicker(s));
      if (!doc.getElementById('carouselTrack')) throw Error('Missing carousel');
      window.AIWiseCourseRenderer.fillSlots(data, doc);
      window.AIWiseCourseRenderer.toggleRequired(data, doc);
      const dots = doc.getElementById('carouselDots'); dots.replaceChildren();
      s.examples.forEach((_, i) => {
        const dot = doc.createElement('button'); dot.className = 'carousel-dot'; dot.type = 'button';
        dot.setAttribute('aria-label', `Show example ${i + 1}`);
        dot.addEventListener('click', () => selectSlide(s, i)); dots.appendChild(dot);
      });
      doc.getElementById('carouselPrev').addEventListener('click', () => selectSlide(s, s.index - 1));
      doc.getElementById('carouselNext').addEventListener('click', () => selectSlide(s, s.index + 1));
      doc.querySelectorAll('.fn-card-title, .sources-toggle').forEach(node => {
        node.tabIndex = 0;
        if (node.tagName !== 'BUTTON') node.setAttribute('role', 'button');
        node.setAttribute('aria-expanded', 'false');
        const toggle = () => {
          const target = node.matches('.fn-card-title') ? node.parentElement : node;
          target.classList.toggle('open');
          if (node.matches('.sources-toggle')) node.nextElementSibling.classList.toggle('open');
          node.setAttribute('aria-expanded', String(target.classList.contains('open')));
        };
        node.addEventListener('click', toggle);
        if (node.tagName !== 'BUTTON') node.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });
      // Local section links keep the long preview usable without running module scripts.
      doc.querySelectorAll('#coreNavDesktop, #mobileCoreNav').forEach(nav => {
        doc.querySelectorAll('section[id]').forEach(section => {
          const link = doc.createElement('a'); link.className = 'core-nav-sub';
          link.href = '#' + section.id;
          link.textContent = section.querySelector('h2, h3')?.textContent.trim() || section.id;
          nav.appendChild(link);
        });
      });
      doc.addEventListener('click', event => {
        const link = event.target.closest('a'); if (!link) return;
        event.preventDefault();
        const href = link.getAttribute('href') || '';
        if (href.startsWith('#')) scrollPreview(s, href.slice(1));
        else message(s, 'This editor previews C2 only. Use “Open C2 in Beta” to browse the module.');
      });
      doc.addEventListener('submit', event => event.preventDefault());
      updateExamples(s);
      s.host.querySelectorAll('[data-cs-ready]').forEach(node => node.disabled = false);
      selectSlide(s, s.index);
      controls(s);
      scrollPreview(s, 'carousel', false);
      s.ready = true;
    } catch { message(s, 'The C2 preview could not be prepared. Reload to try again; saved drafts are unchanged.', true); }
  }

  async function render(shell) {
    shell('studio', 'AWS1 · Content Studio', 'Select an outlined example in C2 to edit it in place.', `
      <div id="cs-studio">
        <p class="notice">C2 course examples · Drafts stay in this browser. Common content is read-only. Saving does not update Beta or Published.</p>
        <div class="cs-toolbar">
          <div class="cs-example-nav" role="group" aria-label="Course examples">
            <button type="button" class="button cs-step" data-cs-prev disabled aria-label="Previous example"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button>
            <div class="cs-picker">
              <button type="button" id="cs-example" data-cs-ready disabled aria-expanded="false" aria-controls="cs-examples-menu" aria-label="Choose an example">
                <span class="cs-picker-meta">Course example <span data-cs-count></span></span>
                <span data-cs-title>Loading examples…</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>
              </button>
              <div id="cs-examples-menu" role="group" aria-label="Choose an example" hidden></div>
            </div>
            <button type="button" class="button cs-step" data-cs-next disabled aria-label="Next example"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>
          </div>
          <div class="cs-actions" role="group" aria-label="Content actions">
          <button type="button" class="button" data-cs-edit data-cs-ready disabled>Edit example</button>
          <button type="button" class="button" data-cs-jump data-cs-ready disabled>Go to examples</button>
          <button type="button" class="button primary" data-cs-save disabled>Save draft</button>
          <button type="button" class="button" data-cs-reset data-cs-ready disabled>Reset draft</button>
          <a class="button" href="../common/aiwise-c2-final.html?course=aws1" target="_blank" rel="noopener">Open C2 in Beta ↗</a>
          </div>
        </div>
        <p class="cs-status" role="status">Loading C2 preview…</p>
        <div class="cs-preview"><div class="cs-preview-label">AI Orientation · C2 preview · Outlined cards are editable</div>
          <iframe title="AWS1 C2 module editing preview" sandbox="allow-same-origin allow-scripts"></iframe>
        </div>
        <dialog class="cs-editor" aria-labelledby="cs-editor-title" aria-describedby="cs-editor-help">
          <div class="cs-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize editor" aria-controls="cs-editor-body" tabindex="0" title="Drag to resize. Use Left or Right arrow keys."></div>
          <div class="cs-editor-body" id="cs-editor-body">
          <div class="cs-editor-head"><div><h2 id="cs-editor-title">Course example</h2><button type="button" class="button" data-cs-close autofocus>Close</button></div>
            <p id="cs-editor-help">Changes appear in the preview as you type. Save draft to keep them in this browser.</p></div>
          <div class="cs-fields">${FIELDS.map(([key, label]) => `<label>${label}${key === 'title' || key === 'typing_note' ? `<input type="text" name="${key}">` : `<textarea name="${key}" rows="5"></textarea>`}</label>`).join('')}</div>
          <div class="cs-editor-foot"><p class="cs-status" role="status"></p><div>
            <button type="button" class="button primary" data-cs-save disabled>Save draft</button>
            <button type="button" class="button" data-cs-close>Back to preview</button>
          </div></div>
          </div>
        </dialog>
      </div>`, false);
    const host = document.getElementById('cs-studio');
    const s = session = { host, frame: host.querySelector('iframe'), dialog: host.querySelector('dialog'),
      abort: new AbortController(), index: 0, raw: null, blocked: false, storageRead: false };
    try {
      const url = new URL('../common/aiwise-c2-final.html', location.href);
      const [html, data] = await Promise.all([
        fetch(url, { signal: s.abort.signal, cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('Preview unavailable'); return r.text(); }),
        fetch('../course-specific/aws1/course-specific-content_aws1.json', { signal: s.abort.signal, cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('Data unavailable'); return r.json(); })
      ]);
      if (session !== s) return;
      if (!valid(data.c2?.examples)) throw Error('Invalid examples');
      s.base = clone(data.c2.examples); s.examples = clone(s.base);
      let status = 'Current Beta content · No draft edits yet.';
      try {
        s.raw = localStorage.getItem(KEY); s.storageRead = true;
        if (s.raw !== null) {
          const saved = JSON.parse(s.raw);
          if (saved.schema !== 1 || saved.course !== 'aws1' || saved.slot !== 'c2.examples' || !valid(saved.examples) || saved.examples.length !== s.base.length) throw Error('Invalid draft');
          if (!equal(saved.baseExamples, s.base)) throw Error('Changed source');
          s.examples = clone(saved.examples);
          status = 'Saved browser draft restored. Beta is unchanged.';
        }
      } catch {
        s.blocked = true;
        status = 'Saved draft could not be restored or its Beta source has changed. The saved copy has not been changed; the preview shows current Beta content. Reset draft will discard the saved copy.';
      }
      s.saved = clone(s.examples);
      message(s, status, s.blocked);
      host.querySelectorAll('[data-cs-save]').forEach(button => button.addEventListener('click', () => save(s)));
      host.querySelector('[data-cs-reset]').addEventListener('click', () => reset(s));
      host.querySelector('[data-cs-edit]').addEventListener('click', () => openEditor(s, s.index));
      host.querySelector('[data-cs-jump]').addEventListener('click', () => scrollPreview(s, 'carousel'));
      setupPicker(s);
      setupEditorResize(s);
      host.querySelectorAll('[data-cs-close]').forEach(button => button.addEventListener('click', () => closeEditor(s)));
      s.dialog.addEventListener('cancel', event => { event.preventDefault(); closeEditor(s); });
      s.dialog.addEventListener('close', () => {
        if (session === s) s.frame.contentDocument.querySelectorAll('.carousel-card')[s.index]?.focus({ preventScroll: true });
      });
      s.dialog.addEventListener('click', event => {
        if (event.target === s.dialog && event.clientX < s.dialog.getBoundingClientRect().left) closeEditor(s);
      });
      s.dialog.addEventListener('input', event => {
        const key = event.target.name;
        if (!FIELDS.some(([field]) => field === key)) return;
        if (key === 'typing_note' && !event.target.value && !Object.hasOwn(s.base[s.index], key)) delete s.examples[s.index][key];
        else s.examples[s.index][key] = event.target.value;
        updateExamples(s); controls(s);
        message(s, s.blocked ? 'Preview edits only. Saving is unavailable. Copy any text you want to keep before resetting the saved draft.' : dirty() ? 'Unsaved edits · Preview only.' : 'No unsaved edits.', s.blocked);
      });
      s.frame.addEventListener('load', () => connectPreview(s, data), { once: true });
      s.frame.srcdoc = previewHTML(html, url.href);
    } catch (error) {
      if (session === s && error.name !== 'AbortError') message(s, 'C2 could not be loaded. Reload to try again or open C2 in Beta. Saved drafts are unchanged.', true);
    }
  }
  window.addEventListener('beforeunload', event => {
    if (dirty()) { event.preventDefault(); event.returnValue = ''; }
  });
  window.AIWiseContentStudio = {
    render,
    canLeave: () => !dirty() || confirm('Leave Content Studio without saving your edits?'),
    dispose: () => {
      const old = session; session = null;
      old?.abort.abort();
      old?.cancelPickerClose?.(); old?.cancelEditorClose?.();
      if (old?.dialog.open) old.dialog.close();
    }
  };
})();
