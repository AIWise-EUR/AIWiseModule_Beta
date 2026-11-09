/* Three-way content comparison and browser-draft recovery. Network writes belong to callers. */
(() => {
  'use strict';
  const copy = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
  const unsafe = new Set(['__proto__', 'prototype', 'constructor']);
  // Ignore only cache versions on these known loaders, not arbitrary URLs/queries.
  function normalizeSource(html) {
    return typeof html === 'string' ? html.replace(/(<script\b[^>]*\bsrc=["'])(\.\.\/pipelines\/(?:content-language|beta-content|common-content|course-loader)\.js)\?([^"']*)(["'])/g,
      (_, prefix, file, query, quote) => {
        const rest = query.split('&').filter(part => !/^v=/.test(part)).join('&');
        return prefix + file + (rest ? '?' + rest : '') + quote;
      }) : null;
  }
  const sameSource = (a, b) => typeof a === 'string' && typeof b === 'string' && normalizeSource(a) === normalizeSource(b);
  function sourceReport(before, after, chapter) {
    if (sameSource(before, after)) return {details: [], affected: []};
    if (typeof before !== 'string') throw Error('The saved draft has no original page layout to compare.');
    const parse = html => new window.DOMParser().parseFromString(html, 'text/html');
    const oldDoc = parse(normalizeSource(before)), newDoc = parse(normalizeSource(after));
    const oldBlocks = window.AIWiseCommonContent.catalog(oldDoc, chapter), newBlocks = window.AIWiseCommonContent.catalog(newDoc, chapter);
    const details = [], affected = [];
    const ancestors = node => { const path = []; for (let p = node.parentElement; p && p.tagName !== 'HTML'; p = p.parentElement) path.push(p.tagName + '#' + (p.id || '') + '.' + (p.getAttribute('class') || '')); return path.join(' / '); };
    for (const path of new Set([...oldBlocks, ...newBlocks].map(b => b.path))) {
      const old = oldBlocks.find(b => b.path === path), current = newBlocks.find(b => b.path === path);
      if (old && current && old.node.outerHTML === current.node.outerHTML && ancestors(old.node) === ancestors(current.node) && equal(old.fields, current.fields)) continue;
      affected.push(path);
      details.push({location: path, title: current?.title || old?.title || path,
        reason: !current ? 'This saved location no longer exists.' : !old ? 'This is a new location in the current page.' : 'The source at this location changed. Old numbered fields cannot be matched automatically.',
        before: old ? JSON.stringify(old.fields, null, 2) : 'Not present', after: current ? JSON.stringify(current.fields, null, 2) : 'Not present'});
    }
    // Also explain changes outside editable blocks, such as scripts, CSS or wrappers.
    const oldLines = normalizeSource(before).split('\n'), newLines = normalizeSource(after).split('\n');
    const index = oldLines.findIndex((line, i) => line !== newLines[i]);
    const line = index < 0 ? Math.min(oldLines.length, newLines.length) : index;
    details.push({location: 'Page source · line ' + (line + 1), title: 'First page-source difference',
      reason: affected.length ? 'The item list above identifies affected editing locations. This is the first source difference.' : 'The page source changed outside the editable item contents. Existing item locations still match.',
      before: oldLines.slice(line, line + 3).join('\n') || 'Not present', after: newLines.slice(line, line + 3).join('\n') || 'Not present'});
    return {details, affected};
  }
  function restrictLocations(model, report) {
    model.details = report.details;
    for (const unit of model.units) {
      const slots = unit.kind === 'field' ? [unit.path[0]] : unit.kind === 'box' ? [unit.mine?.value.slot, unit.before?.value.slot, unit.beta?.value.slot] : [];
      if (!slots.some(slot => report.affected.includes(slot))) continue;
      // Unedited fields already choose current Beta; identical results need no decision.
      if (!unit.mineChanged || equal(unit.mine, unit.beta)) continue;
      unit.restricted = true;
      unit.decision = 'conflict';
      unit.reason = 'The page location changed. Keep the current content, or explicitly write replacement text for the current location. Your old copy stays in the backup.';
    }
    model.changes = model.units.filter(u => u.mineChanged || u.betaChanged || u.restricted);
    model.conflicts = model.units.filter(u => u.decision === 'conflict');
    return model;
  }
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
  const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const formatsAt = (slots, path) => (slots._studio?.formats || []).filter(f => f.slot === path[0] && path.slice(1).every((k, i) => f.path[i] === k)).sort((a, b) => compareText(JSON.stringify(a.path), JSON.stringify(b.path)));
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
    const boxes = [base, draft, latest].map(v => copy(v._studio?.boxes || []));
    // Two independently added C2 boxes may represent the same placement. Only
    // reconcile unique NEW additions; never reinterpret an existing/deleted ID.
    const placement = b => b.slot === 'c2.examples' && b.template === 'text' && b.family && Number.isInteger(b.example)
      ? JSON.stringify([b.slot, b.family, b.example]) : null;
    const reconciled = new Set();
    for (const mine of boxes[1]) {
      const key = placement(mine);
      if (!key || boxes[0].some(b => b.id === mine.id || placement(b) === key) ||
          boxes[2].some(b => b.id === mine.id) || boxes[1].filter(b => placement(b) === key).length !== 1) continue;
      const matches = boxes[2].filter(b => placement(b) === key);
      if (matches.length !== 1) continue;
      const beta = matches[0];
      if (boxes[0].some(b => b.id === beta.id) || boxes[1].some(b => b.id === beta.id)) continue;
      // Keep the approved identity so later language projection preserves peer text.
      mine.id = beta.id;
      reconciled.add(beta.id);
    }
    for (const id of new Set(boxes.flatMap(list => list.map(b => b.id)))) {
      const values = boxes.map(list => list.find(b => b.id === id));
      const box = values[2] || values[1] || values[0];
      const name = box.fields[0]?.map(r => r.text).join('') || values[1]?.fields[0]?.map(r => r.text).join('') || 'Added box';
      add([id], 'box', values.map(value => value && {value: copy(value)}), name + ' · Box' + (placement(box) ? ` · Example ${box.example + 1}` : ''));
      if (reconciled.has(id)) {
        const empty = b => b.fields.every(field => field.every(run => run.text === ''));
        const [mine, beta] = values.slice(1);
        const layout = b => Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'fields'));
        // Auto-preserve authored rich text only when layout agrees and the other
        // side is entirely blank. Different wording or layout requires a choice.
        if (equal(layout(mine), layout(beta)) && empty(mine) !== empty(beta))
          units[units.length - 1].decision = empty(beta) ? 'draft' : 'beta';
      }
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
      const selection = unit.decision === 'conflict' ? choices[unit.id] : unit.decision;
      const decision = typeof selection === 'object' ? selection.choice : selection;
      if (!['beta', 'draft', 'same', 'edit'].includes(decision)) throw Error('Choose a version for every overlapping change.');
      if (unit.restricted && !['beta', 'edit'].includes(decision)) throw Error('This old location cannot be reused automatically. Choose the current location or write replacement text.');
      if (decision === 'edit' && (unit.kind !== 'field' || (!unit.restricted && typeof unit.mine?.value !== 'string') || typeof unit.beta?.value !== 'string' || typeof selection.text !== 'string' || selection.text.length > 100000)) throw Error('This field cannot be edited here. Choose a version instead.');
      const chosen = decision === 'edit' ? {value: selection.text, formats: []} : decision === 'draft' ? unit.mine : unit.beta;
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
      formats.sort((a, b) => compareText(a.slot, b.slot) || compareText(JSON.stringify(a.path), JSON.stringify(b.path)));
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
  function mount(host, {model, issue, scope, savedAt, raw, apply, latest, returnToEditor, sendForReview, exportWork, archiveBackups}) {
    const dialog = document.createElement('dialog'); dialog.className = 'aw-account-dialog dr-dialog';
    dialog.setAttribute('aria-labelledby', 'dr-title');
    dialog.innerHTML = `<div class="aw-account-header"><div><small data-dr-scope></small><h2 id="dr-title"></h2></div><button type="button" class="aw-account-close" data-dr-close aria-label="Close draft review">×</button></div><div class="dr-body"><p data-dr-intro></p><div data-dr-content></div><p class="aw-account-error" data-dr-error role="alert"></p></div><div class="dr-footer"><button type="button" class="button" data-dr-download>Download original draft</button><div><button type="button" class="button" data-dr-back>Not now</button><button type="button" class="button primary" data-dr-next></button></div></div>`;
    host.append(dialog);
    const q = selector => dialog.querySelector(selector), content = q('[data-dr-content]'), next = q('[data-dr-next]');
    let step = 0, choices = {}, busy = false, done = false, action = null;
    const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
    const selected = unit => choices[unit.id]?.choice || choices[unit.id];
    const unanswered = () => model.conflicts.some(u => !selected(u) || selected(u) === 'edit' && !choices[u.id].text?.trim());
    const snapshot=()=>({step,choices:copy(choices),comparison:copy(model),originalRaw:raw,latest:copy(latest),issue:issue||null,
      combinedValues:step===2 && (issue || !unanswered()) ? (issue?copy(latest):combine(model,choices)) : null});
    const storageActions=exportWork && window.AIWiseDraftStorage?.actions(q('[data-dr-error]').parentElement,{
      exportWork:()=>exportWork(snapshot()),retry:()=>runApply(true)
    });
    async function runApply(clean=false) {
      if(busy || done || step!==2)return;
      let failure;
      try {
        busy=true;dialog.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=true);
        // Export remains available even during a slow archive operation.
        storageActions?.busy(true);
        const exportButton=dialog.querySelector('[data-work-export]');if(exportButton)exportButton.disabled=false;
        next.textContent=clean?'Archiving backups…':'Saving draft…';
        if(clean)await archiveBackups(({moved,total})=>{q('[data-dr-error]').textContent=`Archiving backups… ${moved} of ${total}. Keep this page open.`;});
        await apply(issue?copy(latest):combine(model,choices),{restart:!!issue});done=true;action=null;
      }catch(error){failure=error;}
      finally{
        busy=false;dialog.querySelectorAll('button,input,textarea').forEach(node=>node.disabled=false);draw();
        storageActions?.busy(false);storageActions?.show(failure);
        if(failure)q('[data-dr-error]').textContent=window.AIWiseDraftStorage?.quota(failure)?'Browser storage is full. Archive backups and retry, or export your current work. Your original draft and review choices are preserved.':failure.message||'Could not update this draft. The original copy is preserved.';
      }
    }

    function actionOption(value, title, explanation) {
      const label = el('label', '', 'dr-copy dr-action'), radio = document.createElement('input');
      radio.type = 'radio'; radio.name = 'dr-action'; radio.value = value; radio.checked = action === value;
      radio.onchange = () => { action = value; next.disabled = false; };
      const row = el('div', '', 'dr-radio'); row.append(radio, el('strong', title)); label.append(row, el('p', explanation)); return label;
    }
    function diagnostics() {
      for (const item of model?.details || []) {
        const row = el('details', '', 'dr-change');
        row.append(el('summary', item.title + ' · ' + item.location), el('p', item.reason));
        const pair = el('div', '', 'dr-pair');
        for (const [label, value] of [['Saved page', item.before], ['Current page', item.after]]) {
          const panel = el('section', '', 'dr-copy'); panel.append(el('strong', label), el('pre', value, 'dr-value')); pair.append(panel);
        }
        row.append(pair); content.append(row);
      }
    }
    function copyPanel(unit, version, interactive = false) {
      const mine = version === 'draft', entry = mine ? unit.mine : unit.beta;
      const panel = el(interactive ? 'label' : 'section', '', 'dr-copy' + (unit.decision === 'conflict' ? ' dr-overlap' : ''));
      const changed = mine ? unit.mineChanged : unit.betaChanged;
      const label = changed ? (entry === undefined ? 'Removed' : unit.before === undefined ? 'Added' : 'Changed') + (mine ? ' in your draft' : ' in Beta') : 'Unchanged from the original';
      panel.append(el('small', label, 'dr-change-label'));
      if (interactive) {
        const row = el('div', '', 'dr-radio'); const input = document.createElement('input'); input.type = 'radio'; input.name = 'dr-choice-' + unit.id; input.value = version; input.checked = selected(unit) === version;
        input.disabled = mine && !!unit.restricted;
        const text = el('strong', mine ? unit.restricted ? 'Old draft · reference only' : 'Use my draft' : unit.beta === undefined ? 'Leave this removed location out' : 'Keep latest Beta'); row.append(input, text); panel.append(row);
        input.addEventListener('change', () => { choices[unit.id] = version; next.disabled = unanswered(); q('[data-dr-error]').textContent = ''; });
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
      row.append(el('small', 'Location: ' + unit.path.join(' → '), 'dr-change-label'));
      if (interactive) row.append(el('p', unit.reason || (unit.kind === 'field' && typeof unit.mine?.value === 'string' && typeof unit.beta?.value === 'string' ? 'Both versions changed this paragraph. Choose which wording to keep.' : 'Both versions changed this item. Choose which version to keep.'), 'dr-conflict-help'));
      const original = el('details'); original.append(el('summary', 'The original you started from')); const text = el('div', '', 'dr-value'); valueView(text, unit.before); original.append(text); row.append(original);
      const pair = el('div', '', 'dr-pair'); pair.append(copyPanel(unit, 'beta', interactive), copyPanel(unit, 'draft', interactive)); row.append(pair);
      if (interactive && unit.kind === 'field' && typeof unit.beta?.value === 'string' && (unit.restricted || typeof unit.mine?.value === 'string')) {
        const label = el('label', '', 'dr-copy dr-edit-choice'), radio = document.createElement('input'), input = document.createElement('textarea');
        radio.type = 'radio'; radio.name = 'dr-choice-' + unit.id; radio.value = 'edit'; radio.checked = selected(unit) === 'edit';
        const heading = el('div', '', 'dr-radio'); heading.append(radio, el('strong', 'Write replacement text here'));
        input.value = selected(unit) === 'edit' ? choices[unit.id].text : ''; input.maxLength = 100000;
        input.setAttribute('aria-label', 'Replacement text for ' + unit.title); input.placeholder = 'Enter the wording to use at the current location.';
        const change = () => { radio.checked = true; choices[unit.id] = {choice:'edit',text:input.value}; next.disabled = unanswered(); };
        radio.onchange = change; input.oninput = change;
        label.append(heading, input, el('small', 'Uses the page’s default text styling. Original formatting remains in your backup.')); row.append(label);
      }
      if (!interactive) row.append(el('p', unit.decision === 'conflict' ? '↔ Same item changed in both copies — your choice is needed.' : unit.decision === 'same' ? '✓ Both copies already agree.' : unit.decision === 'draft' ? '✓ Keep your change.' : '✓ Keep the Beta change.', 'dr-outcome'));
      return row;
    }
    function draw() {
      content.replaceChildren(); q('[data-dr-error]').textContent = '';
      q('[data-dr-scope]').textContent = scope + (savedAt && Number.isFinite(Date.parse(savedAt)) ? ' · Draft saved ' + new Date(savedAt).toLocaleString() : '');
      const back = q('[data-dr-back]'); back.textContent = step ? '← Back' : 'Not now'; next.hidden = false; next.disabled = false;
      if (done) {
        q('#dr-title').textContent = 'Your recovered draft is saved.'; q('[data-dr-intro]').textContent = 'The original draft is backed up. Choose what to do next.';
        back.textContent = 'Close';
        content.append(actionOption('editor', 'Return to the editor', 'Continue editing the recovered draft.'));
        if (sendForReview) content.append(actionOption('submit', 'Send to Control Tower', 'Open the submission summary and confirm sending. Nothing is submitted automatically.'));
        next.textContent = 'Continue'; next.disabled = !action; return;
      }
      if (issue) {
        q('#dr-title').textContent = 'Choose how to recover this draft.'; q('[data-dr-intro]').textContent = issue;
        content.append(el('p', 'The original is still stored unchanged. Automatic comparison is unavailable for the reason above.'));
        diagnostics();
        if (step === 2) {
          q('#dr-title').textContent = 'Start from current Beta with an original backup?';
          q('[data-dr-intro]').textContent = 'The new working draft will contain the current Beta content shown below. Old edits will remain in the downloadable backup; they are not included in this new working draft.';
          for (const [path, value] of Object.entries(latest || {})) { const row = el('details', '', 'dr-change'); row.append(el('summary', path)); const view = el('div', '', 'dr-value'); valueView(view, {value}); row.append(view); content.append(row); }
          next.textContent = 'Back up original and save current Beta';
        } else {
          content.append(actionOption('pause', 'Keep the original and decide later', 'Close without changing your saved draft. You can download it for further recovery.'));
          if (latest) content.append(actionOption('latest', 'Back up original and start from current Beta', 'Preview first. Old edits stay in a separate backup; the editor will open with current approved content.'));
          next.textContent = 'Continue'; next.disabled = !action;
        }
        return;
      }
      const progress = el('p', `Step ${step + 1} of 3 · ${['What happened', 'Choose a version', 'Preview result'][step]}`, 'dr-progress'); content.append(progress);
      if (step === 0) {
        q('#dr-title').textContent = 'Your draft and Beta took different paths.';
        q('[data-dr-intro]').textContent = model.details?.length ? 'The saved page and current page differ. Review the exact locations below, then choose the content to keep. Your original draft is unchanged.' : 'You saved a draft. Since then, the chapter’s Beta baseline changed. Both copies are preserved.';
        content.append(el('div', 'The chapter you started editing', 'dr-origin'), el('div', '', 'dr-fork'));
        const headers = el('div', '', 'dr-pair dr-version-heads'); headers.append(el('strong', 'Latest Beta'), el('strong', 'Your saved draft')); content.append(headers);
        content.append(el('p', `${model.changes.length} changed item(s) · ${model.conflicts.length} need your choice`, 'dr-change-count'));
        diagnostics();
        if (!model.changes.length) content.append(el('p', 'The version changed, but the saved content is identical. You can continue with the latest baseline.', 'dr-notice'));
        model.changes.forEach(u => content.append(changeRow(u)));
        content.append(el('p', model.conflicts.length ? `${model.conflicts.length} overlapping change(s) need your choice. Other changes will be kept together.` : 'No overlapping edits. These changes can be kept together.', 'dr-notice'));
        next.textContent = model.conflicts.length ? 'Choose overlapping changes →' : 'Preview combined draft →';
      } else if (step === 1) {
        q('#dr-title').textContent = 'Choose what your draft should keep.';
        q('[data-dr-intro]').textContent = 'Choose for each overlapping edit or changed location. You can write replacement text here without leaving this popup.';
        model.conflicts.forEach(u => content.append(changeRow(u, true)));
        next.textContent = 'Preview combined draft →'; next.disabled = unanswered();
      } else {
        q('#dr-title').textContent = 'Apply this combined draft?';
        q('[data-dr-intro]').textContent = 'Review the exact content below. Applying saves your updated browser draft and keeps a backup of the original.';
        for (const unit of model.changes) {
          const decision = selected(unit) || unit.decision, chosen = decision === 'edit' ? {value:choices[unit.id].text,formats:[]} : decision === 'draft' ? unit.mine : unit.beta;
          const row = el('section', '', 'dr-change'); row.append(el('h3', unit.title), el('small', decision === 'edit' ? 'Your replacement text' : decision === 'draft' ? 'From your draft' : decision === 'same' ? 'Same in both copies' : 'From latest Beta', 'dr-change-label'));
          const text = el('div', '', 'dr-value'); valueView(text, chosen); row.append(text); content.append(row);
        }
        content.append(el('p', 'Only your browser draft changes. Existing pending requests, Beta and the student site are unchanged. Send to Control Tower when you are ready.', 'dr-notice'));
        next.textContent = 'Apply to my draft';
      }
    }
    next.addEventListener('click', async () => {
      if (busy || next.disabled) return;
      if (done) { dialog.close(); if (action === 'editor') returnToEditor?.(); else if (action === 'submit') sendForReview?.(); return; }
      if (issue && step !== 2) { if (action === 'pause') { dialog.close(); return; } step = 2; draw(); return; }
      if (step < 2) { step = step === 0 && !model.conflicts.length ? 2 : step + 1; draw(); dialog.scrollTop = 0; q('#dr-title').focus(); return; }
      await runApply();
    });
    const close = () => { if (!busy) dialog.close(); };
    q('[data-dr-close]').onclick = close;
    q('[data-dr-back]').onclick = () => { if (busy) return; if (done || !step) close(); else { step = issue || step === 2 && !model.conflicts.length ? 0 : step - 1; draw(); dialog.scrollTop = 0; } };
    q('[data-dr-download]').onclick = () => download(raw, 'aiwise-original-draft.json');
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    q('#dr-title').tabIndex = -1;
    draw();
    return {snapshot,hasChanges:()=>!done && (step===2 || Object.keys(choices).length>0),isBusy:()=>busy,open() { if (!dialog.open) { dialog.showModal(); window.AIWiseMotion?.enter(dialog); q('#dr-title').focus(); } }, dispose() { dialog.close(); dialog.remove(); }};
  }
  window.AIWiseDraftRecovery = {equal, normalizeSource, sameSource, sourceReport, restrictLocations, plan, combine, storeRecovered, download, mount, valueView};
})();
