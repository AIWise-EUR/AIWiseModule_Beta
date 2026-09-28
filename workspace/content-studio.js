/* Course-slot authoring. Drafts are local; module sources and releases are unchanged. */
(() => {
  'use strict';
  const COURSES = Object.freeze({
    aws1: {label: 'AWS1', source: '../course-specific/aws1/course-specific-content_aws1.json'},
    ped: {label: 'PED', source: '../course-specific/ped/ped.json'}
  });
  const supports = id => Object.hasOwn(COURSES, id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const get = (data, path) => path.split('.').reduce((value, key) => value?.[key], data);
  const put = (data, path, value) => {
    const keys = path.split('.'), last = keys.pop();
    keys.reduce((obj, key) => obj[key], data)[last] = value;
  };
  const labels = {
    'c2.sat_example_title': 'S.A.T example title', 'c2.sat_example': 'S.A.T worked example',
    'c3.amd_example': 'Adopt / Modify / Discard example',
    'c3.template_compare.md': 'Markdown template', 'c3.template_compare.xml': 'XML template',
    'c3.full_example_title': 'Full worked example title', 'c3.full_example': 'Full worked example',
    title: 'Title', thinking: 'What you are actually thinking', typing_note: 'Context note (optional)',
    typing: 'What you type', processing: 'How the model actually processes this',
    bad: 'Initial prompt', good: 'Improved prompt', actor: 'Speaker', tag: 'Tag'
  };
  const label = key => labels[key] || key.replace(/^c3\./, '').replace(/[._]/g, ' ').replace(/^./, c => c.toUpperCase());
  let session = null;
  const dirty = () => !!session?.values && !equal(session.values, session.saved);
  const reduceMotion = () => window.AIWiseMotion.reduced();
  const finishAfterMotion = (node, token, complete) => window.AIWiseMotion.after(node, complete, token);
  function message(s, text, error = false) {
    s.host.querySelectorAll('.cs-status').forEach(node => { node.textContent = text; node.dataset.error = String(error); });
  }
  function controls(s) {
    s.host.querySelectorAll('[data-cs-save]').forEach(button => button.disabled = !s.ready || s.blocked || !dirty());
  }
  // Fixed source structure prevents malformed local records reaching the renderers.
  function valid(value, base, key = '') {
    if (typeof base === 'string') {
      if (typeof value !== 'string') return false;
      if (key === 'actor') return ['self', 'ai', 'team'].includes(value);
      if (key === 'tag' && ['adopt','modify','discard'].includes(base)) return ['adopt','modify','discard'].includes(value);
      return true;
    }
    if (Array.isArray(base)) return Array.isArray(value) && value.length === base.length && base.every((v, i) => valid(value[i], v));
    if (!base || typeof base !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.keys(value).every(k => Object.hasOwn(base, k) || (k === 'typing_note' && Object.hasOwn(base, 'typing') && typeof value[k] === 'string')) &&
      Object.keys(base).every(k => valid(value[k], base[k], k));
  }
  function record(s) {
    const shared = {schema: 1, course: s.courseId, savedAt: new Date().toISOString()};
    if (s.chapter === 'c2') {
      const extras = values => Object.fromEntries(Object.entries(values).filter(([k]) => k !== 'c2.examples'));
      return {...shared, slot: 'c2.examples', baseExamples: s.base['c2.examples'], examples: s.values['c2.examples'],
        baseSlots: extras(s.base), slots: extras(s.values)};
    }
    return {...shared, chapter: s.chapter, baseSlots: s.base, slots: s.values};
  }
  function save(s) {
    if (s !== session || s.blocked || !s.ready) return;
    try {
      if (localStorage.getItem(s.key) !== s.raw) {
        message(s, 'Another tab changed this draft. Your edits have not been saved. Copy any text you want to keep before reloading.', true); return;
      }
      const raw = JSON.stringify(record(s)); localStorage.setItem(s.key, raw);
      s.raw = raw; s.saved = clone(s.values); controls(s);
      message(s, 'Draft saved in this browser · ' + new Date().toLocaleTimeString() + '. Beta is unchanged.');
    } catch { message(s, 'Draft could not be saved. Keep this page open and try again.', true); }
  }
  function reset(s) {
    if (!confirm(`Discard this browser’s ${s.chapter.toUpperCase()} draft and current edits? The preview will return to current Beta content.`)) return;
    try {
      if (!s.storageRead || localStorage.getItem(s.key) !== s.raw) {
        message(s, 'The saved draft could not be safely reset. Copy any text you want to keep before reloading.', true); return;
      }
      localStorage.removeItem(s.key); s.raw = null; s.blocked = false;
      s.values = clone(s.base); s.saved = clone(s.base);
      updatePreview(s); controls(s); message(s, 'Draft reset to current Beta content.');
    } catch { message(s, 'Draft could not be reset. The saved copy has been preserved.', true); }
  }
  function scrollPreview(s, id, animate = true) {
    const target = s.frame.contentDocument.getElementById(id);
    if (target) s.frame.contentWindow.scrollTo({top: target.getBoundingClientRect().top + s.frame.contentWindow.scrollY - 84,
      behavior: animate && !reduceMotion() ? 'smooth' : 'instant'});
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
  function currentValue(s, item) { return item.example === undefined ? s.values[item.path] : s.values[item.path][item.example]; }
  function itemTitle(s, item) { return item.example === undefined ? label(item.path) : currentValue(s, item).title || 'Untitled example'; }
  function selectItem(s, index, scroll = false) {
    s.index = Math.max(0, Math.min(index, s.items.length - 1));
    const item = s.items[s.index], doc = s.frame.contentDocument;
    s.host.querySelector('[data-cs-count]').textContent = `${s.chapter.toUpperCase()} · ${s.index + 1} / ${s.items.length}`;
    s.host.querySelector('[data-cs-title]').textContent = itemTitle(s, item);
    s.host.querySelector('[data-cs-prev]').disabled = s.index === 0;
    s.host.querySelector('[data-cs-next]').disabled = s.index === s.items.length - 1;
    s.host.querySelectorAll('[data-cs-choice]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === s.index)));
    const target = doc.getElementById('cs-item-' + s.index);
    if (item.example !== undefined) {
      doc.getElementById('carouselTrack').style.transform = `translateX(-${item.example * 100}%)`;
      doc.querySelectorAll('.carousel-slide').forEach((slide, i) => { slide.inert = i !== item.example; slide.setAttribute('aria-hidden', String(i !== item.example)); });
      doc.querySelectorAll('.carousel-dot').forEach((dot, i) => { dot.classList.toggle('active', i === item.example); dot.setAttribute('aria-pressed', String(i === item.example)); });
      doc.getElementById('carouselPrev').disabled = item.example === 0;
      doc.getElementById('carouselNext').disabled = item.example === s.values['c2.examples'].length - 1;
      s.slideIndex = item.example;
    }
    const pane = target?.closest('.technique-pane');
    if (pane) pane.closest('.technique-panel').querySelector(`[data-tab="${pane.dataset.pane}"]`)?.click();
    const slide = target?.closest('.critique-slide');
    if (slide) slide.closest('.critique-stepper').querySelector(`[data-step="${slide.dataset.slide}"]`)?.click();
    for (let parent = target?.parentElement; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    if (scroll) scrollPreview(s, 'cs-item-' + s.index);
  }
  function refreshPicker(s) {
    const menu = s.host.querySelector('#cs-examples-menu'); menu.replaceChildren();
    for (const chapter of ['c2', 'c3']) {
      const group = document.createElement('div'); group.setAttribute('role', 'group');
      group.setAttribute('aria-labelledby', 'cs-group-' + chapter);
      const heading = document.createElement('div'); heading.className = 'cs-picker-heading';
      heading.id = 'cs-group-' + chapter;
      heading.textContent = chapter === 'c2' ? 'C2 · GenAI and human cognition' : 'C3 · How to engage with GenAI';
      group.appendChild(heading);
      s.catalog[chapter].forEach((item, i) => {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.csChapter = chapter; button.dataset.csItem = String(i);
        if (chapter === s.chapter) button.dataset.csChoice = String(i);
        const title = chapter === s.chapter ? itemTitle(s, item) : item.example === undefined
          ? label(item.path) : s.otherExamples?.[item.example]?.title || get(s.source, item.path)[item.example].title || 'Untitled example';
        button.textContent = `${i + 1}. ${title}`;
        button.setAttribute('aria-pressed', String(chapter === s.chapter && i === s.index));
        button.addEventListener('click', () => {
          if (chapter === s.chapter) { selectItem(s, i, true); closePicker(s, true); }
          else { closePicker(s, true); location.hash = `#studio/${s.courseId}/${chapter}/${i}`; }
        });
        group.appendChild(button);
      });
      menu.appendChild(group);
    }
    selectItem(s, s.index);
  }
  function updatePreview(s) {
    const doc = s.frame.contentDocument, data = clone(s.source), y = s.frame.contentWindow.scrollY;
    Object.entries(s.values).forEach(([path, value]) => put(data, path, value));
    window.AIWiseCourseRenderer.fillSlots(data, doc);
    window.AIWiseCourseRenderer.toggleRequired(data, doc);
    s.items.forEach((item, i) => {
      const node = item.example === undefined ? doc.querySelector(`[data-slot="${item.path}"]`) : doc.querySelectorAll('.carousel-card')[item.example];
      node.id = 'cs-item-' + i; node.classList.add('cs-editable'); node.tabIndex = 0;
      node.setAttribute('role', 'button'); node.setAttribute('aria-label', 'Edit ' + itemTitle(s, item));
      // Replace handlers, because non-carousel slot containers survive rendering.
      node.onclick = () => openEditor(s, i);
      node.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(s, i); } };
    });
    refreshPicker(s); s.frame.contentWindow.scrollTo(0, y);
  }
  function openEditor(s, index) {
    closePicker(s); selectItem(s, index, true);
    const item = s.items[index];
    s.host.querySelector('#cs-editor-title').textContent = item.example === undefined ? label(item.path) : `Example ${item.example + 1}`;
    const container = s.host.querySelector('.cs-fields'); container.replaceChildren();
    function field(value, path, name) {
      if (typeof value === 'string') {
        const wrap = document.createElement('label'); wrap.textContent = label(name);
        const options = name === 'actor' ? ['self','ai','team'] : name === 'tag' && ['adopt','modify','discard'].includes(value) ? ['adopt','modify','discard'] : null;
        const input = document.createElement(options ? 'select' : ['title','typing_note','heading','tag','name','label'].includes(name) ? 'input' : 'textarea');
        if (options) options.forEach(text => { const option = document.createElement('option'); option.value = text; option.textContent = label(text); input.appendChild(option); });
        input.name = path.join('.') || 'value'; input.value = value;
        if (input.tagName === 'TEXTAREA') input.rows = 5;
        input.addEventListener('input', () => {
          if (!path.length) s.values[item.path] = input.value;
          else {
            const target = currentValue(s, item), keys = [...path], last = keys.pop();
            const parent = keys.reduce((obj, key) => obj[key], target);
            if (last === 'typing_note' && !input.value && !Object.hasOwn(item.example === undefined ? s.base[item.path] : s.base[item.path][item.example], last)) delete parent[last];
            else parent[last] = input.value;
          }
          updatePreview(s); controls(s);
          message(s, s.blocked ? 'Preview edits only. Saving is unavailable until the saved draft is reset.' : dirty() ? 'Unsaved edits · Preview only.' : 'No unsaved edits.', s.blocked);
        });
        wrap.appendChild(input); return wrap;
      }
      const group = document.createElement('fieldset'), legend = document.createElement('legend'); legend.textContent = label(name); group.appendChild(legend);
      Object.entries(value).forEach(([key, child]) => group.appendChild(field(child, [...path, key], Array.isArray(value) ? `${name} ${Number(key) + 1}` : key)));
      return group;
    }
    const value = currentValue(s, item);
    if (typeof value === 'string') container.appendChild(field(value, [], 'Text'));
    else if (item.example !== undefined) {
      ['title','thinking','typing_note','typing','processing'].forEach(key => container.appendChild(field(value[key] || '', [key], key)));
    } else container.appendChild(field(value, [], label(item.path)));
    s.dialog.showModal(); container.querySelector('input,textarea,select')?.focus({preventScroll: true});
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
      .cs-editable { position:relative; cursor:pointer; outline:2px dashed #35617f; outline-offset:-3px; }
      .cs-editable:hover,.cs-editable:focus-visible { outline:3px solid #35617f; }
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

  function connectPreview(s) {
    if (session !== s || s.abort.signal.aborted) return;
    try {
      const doc = s.frame.contentDocument;
      doc.addEventListener('pointerdown', () => closePicker(s));
      doc.querySelectorAll('.technique-panel').forEach(panel => panel.querySelectorAll('.technique-tab').forEach(tab => {
        tab.tabIndex = 0; tab.setAttribute('role', 'button');
        const activate = () => {
          panel.querySelectorAll('.technique-tab').forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-pressed', String(t === tab)); });
          panel.querySelectorAll('.technique-pane').forEach(p => { p.classList.toggle('active', p.dataset.pane === tab.dataset.tab); p.inert = p.dataset.pane !== tab.dataset.tab; });
        };
        tab.addEventListener('click', activate);
        tab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
        if (tab.classList.contains('active')) activate();
      }));
      doc.querySelectorAll('.critique-stepper').forEach(stepper => {
        const tabs = [...stepper.querySelectorAll('.critique-stepper-tab')], slides = [...stepper.querySelectorAll('.critique-slide')];
        let index = 0;
        const go = next => {
          index = Math.max(0, Math.min(next, slides.length - 1));
          stepper.querySelector('.critique-window-inner').style.transform = `translateX(-${index * 100}%)`;
          tabs.forEach((t, i) => { t.classList.toggle('active', i === index); t.setAttribute('aria-pressed', String(i === index)); });
          slides.forEach((slide, i) => { slide.classList.toggle('active', i === index); slide.inert = i !== index; });
          stepper.querySelectorAll('.critique-nav-dot').forEach((d, i) => d.classList.toggle('active', i === index));
          stepper.querySelector('.critique-prev').disabled = index === 0;
          stepper.querySelector('.critique-next').disabled = index === slides.length - 1;
        };
        tabs.forEach((tab, i) => { tab.tabIndex = 0; tab.setAttribute('role', 'button'); tab.addEventListener('click', () => go(i)); tab.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(i); } }); });
        stepper.querySelector('.critique-prev').addEventListener('click', () => go(index - 1));
        stepper.querySelector('.critique-next').addEventListener('click', () => go(index + 1));
        go(0);
      });
      if (s.chapter === 'c2') {
        const dots = doc.getElementById('carouselDots'); dots.replaceChildren();
        s.values['c2.examples'].forEach((_, i) => {
          const dot = doc.createElement('button'); dot.className = 'carousel-dot'; dot.type = 'button'; dot.setAttribute('aria-label', `Show example ${i + 1}`);
          dot.addEventListener('click', () => selectItem(s, i)); dots.appendChild(dot);
        });
        doc.getElementById('carouselPrev').addEventListener('click', () => selectItem(s, s.slideIndex - 1));
        doc.getElementById('carouselNext').addEventListener('click', () => selectItem(s, s.slideIndex + 1));
      }
      doc.querySelectorAll('.fn-card-title, .sources-toggle').forEach(node => {
        node.tabIndex = 0; if (node.tagName !== 'BUTTON') node.setAttribute('role', 'button');
        node.setAttribute('aria-expanded', 'false');
        const toggle = () => { const target = node.matches('.fn-card-title') ? node.parentElement : node;
          target.classList.toggle('open'); if (node.matches('.sources-toggle')) node.nextElementSibling.classList.toggle('open');
          node.setAttribute('aria-expanded', String(target.classList.contains('open'))); };
        node.addEventListener('click', toggle);
        if (node.tagName !== 'BUTTON') node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      });
      doc.querySelectorAll('#coreNavDesktop, #mobileCoreNav').forEach(nav => doc.querySelectorAll('section[id]').forEach(section => {
        const link = doc.createElement('a'); link.className = 'core-nav-sub'; link.href = '#' + section.id;
        link.textContent = section.querySelector('h2,h3')?.textContent.trim() || section.id; nav.appendChild(link);
      }));
      doc.addEventListener('click', event => {
        const link = event.target.closest('a'); if (!link) return; event.preventDefault();
        const href = link.getAttribute('href') || '';
        if (href.startsWith('#')) scrollPreview(s, href.slice(1));
        else message(s, 'Choose an item from another chapter in the item menu, or use Open in Beta to browse the module.');
      });
      doc.addEventListener('submit', event => event.preventDefault());
      updatePreview(s); s.ready = true;
      s.host.querySelectorAll('[data-cs-ready]').forEach(node => node.disabled = false);
      controls(s); selectItem(s, s.index, true);
    } catch { message(s, 'The preview could not be prepared. Reload to try again; saved drafts are unchanged.', true); }
  }

  async function render(shell, courseId = 'aws1', chapter = 'c2', itemIndex = 0) {
    if (!supports(courseId) || !['c2','c3'].includes(chapter)) throw Error('Course editor not connected');
    const config = COURSES[courseId], chapterName = chapter.toUpperCase();
    shell('studio', config.label, '', `
      <div id="cs-studio">
        <p class="notice">${chapterName} course content · Drafts stay in this browser. Common content is read-only. Saving does not update Beta or Published.</p>
        <p data-cs-coverage></p>
        <div class="cs-toolbar">
          <div class="cs-example-block">
            <p class="cs-picker-meta"><span>Course item</span><span data-cs-count></span></p>
            <div class="cs-example-nav" role="group" aria-label="Course items">
              <button type="button" class="button cs-step" data-cs-prev disabled aria-label="Previous item"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12 5-5 5 5 5"/></svg></button>
              <div class="cs-picker">
                <button type="button" id="cs-example" data-cs-ready disabled aria-expanded="false" aria-controls="cs-examples-menu" aria-label="Choose a course item">
                  <span data-cs-title>Loading items…</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>
                </button>
                <div id="cs-examples-menu" role="group" aria-label="Choose a course item" hidden></div>
              </div>
              <button type="button" class="button cs-step" data-cs-next disabled aria-label="Next item"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg></button>
            </div>
          </div>
          <div class="cs-actions" role="group" aria-label="Content actions">
            <button type="button" class="button" data-cs-edit data-cs-ready disabled>Edit item</button>
            <button type="button" class="button" data-cs-jump data-cs-ready disabled>Go to item</button>
            <button type="button" class="button primary" data-cs-save disabled>Save draft</button>
            <button type="button" class="button" data-cs-reset data-cs-ready disabled>Reset draft</button>
            <a class="button" href="../common/aiwise-${chapter}-final.html?course=${courseId}" target="_blank" rel="noopener">Open ${chapterName} in Beta ↗</a>
          </div>
        </div>
        <p class="cs-status" role="status">Loading ${chapterName} preview…</p>
        <div class="cs-preview"><div class="cs-preview-label">AI Orientation · ${chapterName} preview · Outlined items are editable</div>
          <iframe title="${config.label} ${chapterName} module editing preview" sandbox="allow-same-origin allow-scripts"></iframe></div>
        <dialog class="cs-editor" aria-labelledby="cs-editor-title" aria-describedby="cs-editor-help">
          <div class="cs-resize-handle" role="separator" aria-orientation="vertical" aria-label="Resize editor" aria-controls="cs-editor-body" tabindex="0" title="Drag to resize. Use Left or Right arrow keys."></div>
          <div class="cs-editor-body" id="cs-editor-body"><div class="cs-editor-head"><div><h2 id="cs-editor-title">Course item</h2><button type="button" class="button" data-cs-close autofocus>Close</button></div>
            <p id="cs-editor-help">Changes appear as you type. Save draft to keep them in this browser. Reset applies to this chapter only.</p></div>
            <div class="cs-fields"></div><div class="cs-editor-foot"><p class="cs-status" role="status"></p><div>
              <button type="button" class="button primary" data-cs-save disabled>Save draft</button><button type="button" class="button" data-cs-close>Back to preview</button>
            </div></div></div></dialog>
      </div>`, false);
    const host = document.getElementById('cs-studio');
    const s = session = {host, courseId, chapter, key: `aiwise_content_studio_${courseId}_${chapter}_v1`, frame: host.querySelector('iframe'), dialog: host.querySelector('dialog'),
      abort: new AbortController(), index: itemIndex, slideIndex: 0, raw: null, blocked: false, storageRead: false, ready: false};
    try {
      const url = new URL(`../common/aiwise-${chapter}-final.html`, location.href);
      const otherChapter = chapter === 'c2' ? 'c3' : 'c2';
      const [html, data, otherHTML] = await Promise.all([
        fetch(url, {signal: s.abort.signal, cache: 'no-cache'}).then(r => { if (!r.ok) throw Error('Preview unavailable'); return r.text(); }),
        fetch(config.source, {signal: s.abort.signal, cache: 'no-cache'}).then(r => { if (!r.ok) throw Error('Data unavailable'); return r.json(); }),
        fetch(new URL(`../common/aiwise-${otherChapter}-final.html`, location.href), {signal: s.abort.signal, cache: 'no-cache'}).then(r => { if (!r.ok) throw Error('Item list unavailable'); return r.text(); })
      ]);
      if (session !== s) return;
      if (data.course?.id !== s.courseId) throw Error('Wrong course');
      s.source = data;
      const slotPaths = text => [...new DOMParser().parseFromString(text, 'text/html').querySelectorAll('[data-slot]')].map(node => node.dataset.slot);
      const slots = slotPaths(html);
      if (!slots.length || new Set(slots).size !== slots.length || slots.some(path => !path.startsWith(chapter + '.'))) throw Error('Invalid slot catalog');
      s.base = {}; s.items = []; const missing = [];
      slots.forEach(path => {
        const value = get(data, path);
        if (value === undefined) { missing.push(label(path)); return; }
        if (!valid(value, value)) throw Error('Unsupported source');
        s.base[path] = clone(value);
        if (path === 'c2.examples') value.forEach((_, example) => s.items.push({path, example}));
        else s.items.push({path});
      });
      if (!s.items.length) throw Error('No course items');
      s.index = Math.min(s.index, s.items.length - 1);
      s.catalog = {[chapter]: s.items, [otherChapter]: []};
      slotPaths(otherHTML).forEach(path => {
        const value = get(data, path);
        if (value === undefined) return;
        if (path === 'c2.examples') value.forEach((_, example) => s.catalog[otherChapter].push({path, example}));
        else s.catalog[otherChapter].push({path});
      });
      // Show saved C2 example titles in the other chapter's group when their source still matches.
      if (otherChapter === 'c2') try {
        const draft = JSON.parse(localStorage.getItem(`aiwise_content_studio_${courseId}_c2_v1`));
        if (draft?.schema === 1 && draft.course === courseId && draft.slot === 'c2.examples' && equal(draft.baseExamples, data.c2.examples) && valid(draft.examples, data.c2.examples)) s.otherExamples = draft.examples;
      } catch { /* The destination editor reports unreadable drafts without changing them. */ }

      host.querySelector('[data-cs-coverage]').textContent = `${s.items.length} editable items.` + (missing.length ? ' Not configured for this course: ' + missing.join(', ') + '.' : ' All course slots in this chapter are connected.');
      s.values = clone(s.base);
      let status = 'Current Beta content · No draft edits yet.';
      try {
        s.raw = localStorage.getItem(s.key); s.storageRead = true;
        if (s.raw !== null) {
          const saved = JSON.parse(s.raw);
          if (saved.schema !== 1 || saved.course !== courseId) throw Error('Invalid draft');
          let values, baseline;
          if (chapter === 'c2') {
            if (saved.slot !== 'c2.examples' || !equal(saved.baseExamples, s.base['c2.examples'])) throw Error('Invalid examples');
            // Existing C2 drafts have no extra slots. Preserve those examples and use source S.A.T content.
            const extras = Object.fromEntries(Object.entries(s.base).filter(([k]) => k !== 'c2.examples'));
            if ((saved.slots === undefined) !== (saved.baseSlots === undefined)) throw Error('Incomplete draft');
            values = {...(saved.slots ?? extras), 'c2.examples': saved.examples};
            baseline = {...(saved.baseSlots ?? extras), 'c2.examples': saved.baseExamples};
          } else {
            if (saved.chapter !== chapter) throw Error('Wrong chapter');
            values = saved.slots; baseline = saved.baseSlots;
          }
          // Compare keys without relying on serialized property order.
          if (!baseline || Object.keys(baseline).length !== Object.keys(s.base).length || Object.keys(s.base).some(k => !equal(baseline[k], s.base[k])) || !valid(values, s.base)) throw Error('Changed source or invalid draft');
          s.values = Object.fromEntries(Object.keys(s.base).map(k => [k, clone(values[k])]));
          status = 'Saved browser draft restored. Beta is unchanged.';
        }
      } catch {
        s.blocked = true;
        status = 'Saved draft could not be restored or its Beta source has changed. The saved copy has not been changed; the preview shows current Beta content. Reset draft will discard the saved copy.';
      }
      s.saved = clone(s.values); message(s, status, s.blocked);
      host.querySelectorAll('[data-cs-save]').forEach(button => button.addEventListener('click', () => save(s)));
      host.querySelector('[data-cs-reset]').addEventListener('click', () => reset(s));
      host.querySelector('[data-cs-edit]').addEventListener('click', () => openEditor(s, s.index));
      host.querySelector('[data-cs-jump]').addEventListener('click', () => selectItem(s, s.index, true));
      host.querySelector('[data-cs-prev]').addEventListener('click', () => selectItem(s, s.index - 1, true));
      host.querySelector('[data-cs-next]').addEventListener('click', () => selectItem(s, s.index + 1, true));
      const trigger = host.querySelector('#cs-example'), menu = host.querySelector('#cs-examples-menu');
      const openPicker = () => { s.cancelPickerClose?.(); s.cancelPickerClose = null; menu.classList.remove('cs-closing'); menu.inert = false; menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); menu.querySelector('[aria-pressed="true"]')?.focus({preventScroll: true}); };
      trigger.addEventListener('click', () => menu.hidden ? openPicker() : closePicker(s));
      trigger.addEventListener('keydown', e => { if (['ArrowDown','ArrowUp'].includes(e.key)) { e.preventDefault(); openPicker(); } });
      menu.addEventListener('keydown', e => {
        const buttons = [...menu.querySelectorAll('button')], index = buttons.indexOf(document.activeElement), count = buttons.length;
        const next = {ArrowDown: (index + 1) % count, ArrowUp: (index + count - 1) % count, Home: 0, End: count - 1}[e.key];
        if (next !== undefined) { e.preventDefault(); buttons[next].focus(); }
      });
      host.querySelector('.cs-picker').addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); closePicker(s, true); } });
      host.querySelector('.cs-picker').addEventListener('focusout', e => { if (!e.currentTarget.contains(e.relatedTarget)) closePicker(s); });
      document.addEventListener('pointerdown', e => { if (!host.querySelector('.cs-picker').contains(e.target)) closePicker(s); }, {signal: s.abort.signal});
      setupEditorResize(s);
      host.querySelectorAll('[data-cs-close]').forEach(button => button.addEventListener('click', () => closeEditor(s)));
      s.dialog.addEventListener('cancel', e => { e.preventDefault(); closeEditor(s); });
      s.dialog.addEventListener('close', () => { if (session === s) s.frame.contentDocument.getElementById('cs-item-' + s.index)?.focus({preventScroll: true}); });
      s.dialog.addEventListener('click', e => { if (e.target === s.dialog && e.clientX < s.dialog.getBoundingClientRect().left) closeEditor(s); });
      s.frame.addEventListener('load', () => connectPreview(s), {once: true});
      s.frame.srcdoc = previewHTML(html, url.href);
    } catch (error) { if (session === s && error.name !== 'AbortError') message(s, 'This chapter could not be loaded. Reload to try again or open it in Beta. Saved drafts are unchanged.', true); }
  }
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.AIWiseContentStudio = {render, supports,
    canLeave: () => !dirty() || confirm('Leave Content Studio without saving your edits?'),
    dispose: () => { const old = session; session = null; old?.abort.abort(); old?.cancelPickerClose?.(); old?.cancelEditorClose?.(); if (old?.dialog.open) old.dialog.close(); }
  };
})();
