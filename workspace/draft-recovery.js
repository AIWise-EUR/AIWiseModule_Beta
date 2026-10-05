/* Three-way browser-draft review. No network or team-request writes. */
(() => {
  'use strict';
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
  function equal(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
  }
  function safe(value, depth = 0) {
    if (depth > 30) throw Error('This draft is too deeply nested to compare. Download it before recovering it manually.');
    if (value && typeof value === 'object') for (const key of Object.keys(value)) {
      if (unsafe.has(key)) throw Error('This draft contains an unsupported field. Download it before recovering it manually.');
      safe(value[key], depth + 1);
    }
  }
  const formatsAt = (slots, path) => (slots._studio?.formats || []).filter(f => f.slot === path[0] && path.slice(1).every((k, i) => f.path[i] === k)).sort((a, b) => JSON.stringify(a.path).localeCompare(JSON.stringify(b.path)));
  // Text and its rich runs are one value: never attach old formatting to new text.
  function plan(base, draft, latest, title = path => path.join(' · ')) {
    [base, draft, latest].forEach(safeValue => safe(safeValue));
    const units = [];
    function add(path, kind, values, name) {
      const [before, mine, beta] = values;
      const mineChanged = !equal(before, mine), betaChanged = !equal(before, beta);
      const decision = !mineChanged ? 'beta' : !betaChanged ? 'draft' : equal(mine, beta) ? 'same' : 'conflict';
      units.push({id: String(units.length), path, kind, title: name || title(path), before, mine, beta, mineChanged, betaChanged, decision});
    }
    function walk(path, values) {
      const present = values.filter(v => v !== undefined);
      if (present.length && present.every(object)) {
        for (const key of new Set(present.flatMap(Object.keys))) walk([...path, key], values.map(v => v?.[key]));
      } else {
        add(path, 'field', values.map((v, i) => v === undefined ? undefined : {value: copy(v), formats: copy(formatsAt([base, draft, latest][i], path))}));
      }
    }
    for (const slot of new Set([base, draft, latest].flatMap(v => Object.keys(v).filter(k => k !== '_studio')))) walk([slot], [base[slot], draft[slot], latest[slot]]);
    const boxes = [base, draft, latest].map(v => v._studio?.boxes || []);
    for (const id of new Set(boxes.flatMap(list => list.map(b => b.id)))) {
      const values = boxes.map(list => list.find(b => b.id === id));
      const box = values[2] || values[1] || values[0];
      add([id], 'box', values.map(value => value && {value: copy(value)}), (box.fields[0]?.map(r => r.text).join('') || 'Added box') + ' · Box');
    }
    // Independently added boxes keep Beta order followed by draft-only additions.
    // Reordering pre-existing boxes is a separate explicit choice if both differ.
    const orders = boxes.map(list => list.map(b => b.id));
    const reordered = order => !equal(order.filter(id => orders[0].includes(id)), orders[0].filter(id => order.includes(id)));
    const defaultOrder = [...new Set([...orders[2], ...orders[1]])];
    if (reordered(orders[1]) || reordered(orders[2])) add(['box-order'], 'order', orders.map(value => ({value})), 'Order of added boxes');
    return {units, changes: units.filter(u => u.mineChanged || u.betaChanged), conflicts: units.filter(u => u.decision === 'conflict'), defaultOrder, hasExtension: [base, draft, latest].some(v => v._studio)};
  }
  function combine(model, choices = {}) {
    const result = {}, formats = [], boxes = [];
    let order = model.defaultOrder;
    for (const unit of model.units) {
      const decision = unit.decision === 'conflict' ? choices[unit.id] : unit.decision;
      if (!['beta', 'draft', 'same'].includes(decision)) throw Error('Choose a version for every overlapping change.');
      const chosen = decision === 'draft' ? unit.mine : unit.beta;
      if (unit.kind === 'order') { order = chosen.value; continue; }
      if (chosen === undefined) continue;
      if (unit.kind === 'box') { boxes.push(copy(chosen.value)); continue; }
      const keys = [...unit.path], last = keys.pop();
      let parent = result;
      for (const key of keys) parent = parent[key] ||= {};
      parent[last] = copy(chosen.value); formats.push(...copy(chosen.formats));
    }
    if (model.hasExtension || boxes.length || formats.length) {
      const ordered = [...new Set([...order, ...model.defaultOrder])].map(id => boxes.find(b => b.id === id)).filter(Boolean);
      result._studio = {version: 1, formats, boxes: ordered};
    }
    return result;
  }
  function storeRecovered(storage, key, expected, next, backupKey) {
    if (storage.getItem(key) !== expected) throw Error('Another tab changed this draft. Reload to compare the newer copy. Nothing was replaced.');
    if (storage.getItem(backupKey) !== null) throw Error('The backup name is already in use. Please try again.');
    storage.setItem(backupKey, expected);
    if (storage.getItem(backupKey) !== expected) throw Error('The original draft could not be backed up. Nothing was replaced.');
    // Recheck after backup, including storage implementations that yield on writes.
    if (storage.getItem(key) !== expected) throw Error('Another tab changed this draft. Reload to compare the newer copy.');
    storage.setItem(key, next);
    if (storage.getItem(key) !== next) throw Error('The updated draft could not be verified. Your original is preserved in the backup.');
  }
  function download(raw, name) {
    const url = URL.createObjectURL(new Blob([raw], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // All draft content is rendered through textContent/style whitelists, never HTML.
  function valueView(node, entry) {
    if (entry === undefined) { node.textContent = 'Not present in this copy'; return; }
    const value = entry.value;
    const runs = (parent, list) => list.forEach(run => {
      const span = document.createElement('span'); span.textContent = run.text;
      if (run.bold) span.style.fontWeight = '700'; if (run.italic) span.style.fontStyle = 'italic';
      if (/^#[0-9a-f]{6}$/i.test(run.color || '')) span.style.color = run.color;
      // Include explicit style labels below: author colours may have low contrast here.
      parent.append(span);
    });
    function show(parent, item) {
      if (typeof item === 'string') { parent.append(document.createTextNode(item || '(Empty text)')); return; }
      if (Array.isArray(item)) { item.forEach((v, i) => { const p = document.createElement('div'); p.className = 'dr-value-item'; const label = document.createElement('b'); label.textContent = `Item ${i + 1}`; p.append(label); show(p, v); parent.append(p); }); return; }
      if (object(item)) for (const [key, v] of Object.entries(item)) { const p = document.createElement('div'); const label = document.createElement('b'); label.textContent = key.replace(/_/g, ' ') + ': '; p.append(label); show(p, v); parent.append(p); }
    }
    if (value?.fields && value?.template) {
      value.fields.forEach(field => { const p = document.createElement('p'); runs(p, field); node.append(p); });
      const p = document.createElement('small'); p.textContent = `Layout: ${value.template} · alignment: ${value.align} · size: ${value.size || 'original'} · after item ${value.anchor + 1}`; node.append(p);
    } else if (typeof value === 'string' && entry.formats?.length === 1) runs(node, entry.formats[0].runs);
    else show(node, value);
    const styles = new Set((entry.formats || []).flatMap(f => f.runs).concat(value?.fields?.flat() || []).flatMap(r => [r.bold && 'Bold', r.italic && 'Italic', r.color && `Colour ${r.color}`, r.size && `${r.size}px`]).filter(Boolean));
    if (styles.size) { const note = document.createElement('small'); note.className = 'dr-style-note'; note.textContent = 'Formatting: ' + [...styles].join(' · '); node.append(note); }
  }
  function mount(host, {model, issue, scope, savedAt, raw, apply}) {
    const dialog = document.createElement('dialog'); dialog.className = 'aw-account-dialog dr-dialog';
    dialog.setAttribute('aria-labelledby', 'dr-title');
    dialog.innerHTML = `<div class="aw-account-header"><div><small data-dr-scope></small><h2 id="dr-title"></h2></div><button type="button" class="aw-account-close" data-dr-close aria-label="Close draft review">×</button></div><div class="dr-body"><p data-dr-intro></p><div data-dr-content></div><p class="aw-account-error" data-dr-error role="alert"></p></div><div class="dr-footer"><button type="button" class="button" data-dr-download>Download original draft</button><div><button type="button" class="button" data-dr-back>Not now</button><button type="button" class="button primary" data-dr-next></button></div></div>`;
    host.append(dialog);
    const q = selector => dialog.querySelector(selector), content = q('[data-dr-content]'), next = q('[data-dr-next]');
    let step = 0, choices = {}, busy = false;
    const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
    function copyPanel(unit, version, interactive = false) {
      const mine = version === 'draft', entry = mine ? unit.mine : unit.beta;
      const panel = el(interactive ? 'label' : 'section', '', 'dr-copy' + (unit.decision === 'conflict' ? ' dr-overlap' : ''));
      const changed = mine ? unit.mineChanged : unit.betaChanged;
      const label = changed ? (entry === undefined ? 'Removed' : unit.before === undefined ? 'Added' : 'Changed') + (mine ? ' in your draft' : ' in Beta') : 'Unchanged from the original';
      panel.append(el('small', label, 'dr-change-label'));
      if (interactive) {
        const row = el('div', '', 'dr-radio'); const input = document.createElement('input'); input.type = 'radio'; input.name = 'dr-choice-' + unit.id; input.value = version; input.checked = choices[unit.id] === version;
        const text = el('strong', mine ? 'Use my draft' : 'Keep latest Beta'); row.append(input, text); panel.append(row);
        input.addEventListener('change', () => { choices[unit.id] = version; next.disabled = model.conflicts.some(u => !choices[u.id]); q('[data-dr-error]').textContent = ''; });
      }
      const text = el('div', '', 'dr-value'); valueView(text, entry);
      if (!interactive && text.textContent.length > 220) {
        panel.append(el('p', text.textContent.slice(0, 220).trim() + '…', 'dr-value'));
        const details = el('details'); details.append(el('summary', 'Show full content'), text); panel.append(details);
      } else panel.append(text);
      return panel;
    }
    function changeRow(unit, interactive = false) {
      const row = el('section', '', 'dr-change'); row.append(el('h3', unit.title));
      if (interactive) row.append(el('p', unit.kind === 'field' && typeof unit.mine?.value === 'string' && typeof unit.beta?.value === 'string' ? 'Both versions changed this paragraph. Choose which wording to keep.' : 'Both versions changed this item. Choose which version to keep.', 'dr-conflict-help'));
      const original = el('details'); original.append(el('summary', 'The original you started from')); const text = el('div', '', 'dr-value'); valueView(text, unit.before); original.append(text); row.append(original);
      const pair = el('div', '', 'dr-pair'); pair.append(copyPanel(unit, 'beta', interactive), copyPanel(unit, 'draft', interactive)); row.append(pair);
      if (!interactive) row.append(el('p', unit.decision === 'conflict' ? '↔ Same item changed in both copies — your choice is needed.' : unit.decision === 'same' ? '✓ Both copies already agree.' : unit.decision === 'draft' ? '✓ Keep your change.' : '✓ Keep the Beta change.', 'dr-outcome'));
      return row;
    }
    function draw() {
      content.replaceChildren(); q('[data-dr-error]').textContent = '';
      q('[data-dr-scope]').textContent = scope + (savedAt && Number.isFinite(Date.parse(savedAt)) ? ' · Draft saved ' + new Date(savedAt).toLocaleString() : '');
      const back = q('[data-dr-back]'); back.textContent = step ? '← Back' : 'Not now'; next.hidden = !!issue; next.disabled = false;
      if (issue) { q('#dr-title').textContent = 'This draft needs a different recovery.'; q('[data-dr-intro]').textContent = issue; content.append(el('p', 'Your saved copy has not been changed. Download it to keep a copy for manual recovery.')); return; }
      const progress = el('p', `Step ${step + 1} of 3 · ${['What happened', 'Choose a version', 'Preview result'][step]}`, 'dr-progress'); content.append(progress);
      if (step === 0) {
        q('#dr-title').textContent = 'Your draft and Beta took different paths.';
        q('[data-dr-intro]').textContent = 'You saved a draft. Since then, the chapter’s Beta baseline changed. Both copies are preserved.';
        content.append(el('div', 'The chapter you started editing', 'dr-origin'), el('div', '', 'dr-fork'));
        const headers = el('div', '', 'dr-pair dr-version-heads'); headers.append(el('strong', 'Latest Beta'), el('strong', 'Your saved draft')); content.append(headers);
        content.append(el('p', `${model.changes.length} changed item(s) · ${model.conflicts.length} need your choice`, 'dr-change-count'));
        if (!model.changes.length) content.append(el('p', 'The version changed, but the saved content is identical. You can continue with the latest baseline.', 'dr-notice'));
        model.changes.forEach(u => content.append(changeRow(u)));
        content.append(el('p', model.conflicts.length ? `${model.conflicts.length} overlapping change(s) need your choice. Other changes will be kept together.` : 'No overlapping edits. These changes can be kept together.', 'dr-notice'));
        next.textContent = model.conflicts.length ? 'Choose overlapping changes →' : 'Preview combined draft →';
      } else if (step === 1) {
        q('#dr-title').textContent = 'Choose what your draft should keep.';
        q('[data-dr-intro]').textContent = 'Only overlapping edits need a choice. Other changes will be kept together.';
        model.conflicts.forEach(u => content.append(changeRow(u, true)));
        next.textContent = 'Preview combined draft →'; next.disabled = model.conflicts.some(u => !choices[u.id]);
      } else {
        q('#dr-title').textContent = 'Apply this combined draft?';
        q('[data-dr-intro]').textContent = 'Review the exact content below. Applying saves your updated browser draft and keeps a backup of the original.';
        for (const unit of model.changes) {
          const decision = choices[unit.id] || unit.decision, chosen = decision === 'draft' ? unit.mine : unit.beta;
          const row = el('section', '', 'dr-change'); row.append(el('h3', unit.title), el('small', decision === 'draft' ? 'From your draft' : decision === 'same' ? 'Same in both copies' : 'From latest Beta', 'dr-change-label'));
          const text = el('div', '', 'dr-value'); valueView(text, chosen); row.append(text); content.append(row);
        }
        content.append(el('p', 'Only your browser draft changes. Existing pending requests, Beta and the student site are unchanged. Send to Control Tower when you are ready.', 'dr-notice'));
        next.textContent = 'Apply to my draft';
      }
    }
    next.addEventListener('click', async () => {
      if (busy || next.disabled) return;
      if (step < 2) { step = step === 0 && !model.conflicts.length ? 2 : step + 1; draw(); dialog.scrollTop = 0; q('#dr-title').focus(); return; }
      try { busy = true; dialog.querySelectorAll('button,input').forEach(node => node.disabled = true); next.textContent = 'Saving draft…'; await apply(combine(model, choices)); dialog.close(); }
      catch (error) { q('[data-dr-error]').textContent = error.message || 'Could not update this draft. The original copy is preserved.'; }
      finally { busy = false; dialog.querySelectorAll('button,input').forEach(node => node.disabled = false); next.textContent = 'Apply to my draft'; }
    });
    const close = () => { if (!busy) dialog.close(); };
    q('[data-dr-close]').onclick = close;
    q('[data-dr-back]').onclick = () => { if (busy) return; if (!step) close(); else { step = step === 2 && !model.conflicts.length ? 0 : step - 1; draw(); dialog.scrollTop = 0; } };
    q('[data-dr-download]').onclick = () => download(raw, 'aiwise-original-draft.json');
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    q('#dr-title').tabIndex = -1;
    draw();
    return {open() { if (!dialog.open) { dialog.showModal(); window.AIWiseMotion?.enter(dialog); q('#dr-title').focus(); } }, dispose() { dialog.close(); dialog.remove(); }};
  }
  window.AIWiseDraftRecovery = {equal, plan, combine, storeRecovered, download, mount};
})();
