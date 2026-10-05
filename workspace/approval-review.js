/* An explicit preview of the server's field merge. Submitted snapshots stay immutable. */
(() => {
  'use strict';
  const engine = () => window.AIWiseDraftRecovery;
  function resolutions(model, choices) {
    return model.conflicts.map(u => {
      const choice = choices[u.id];
      return {kind: u.kind, path: u.path, ...(typeof choice === 'object' ? choice : {choice})};
    });
  }
  async function review(request, reason) {
    const api = window.AIWiseSharedStudio, context = await api.prepareApproval(request.id, request.rev);
    const title = path => {
      const item = context.latest[path[0]] || context.draft[path[0]] || context.base[path[0]];
      const name = request.contentSnapshot.course === 'common' && item && typeof item === 'object' && !Array.isArray(item) ? Object.values(item).find(v => typeof v === 'string' && v.trim()) : path[0].replace(/[._]/g, ' ');
      return String(name || path[0]).slice(0, 100) + (path.length > 1 ? ' · ' + path.slice(1).join(' · ') : '');
    };
    const model = engine().plan(context.base, context.draft, context.latest, title);
    const dialog = document.createElement('dialog'); dialog.className = 'aw-account-dialog dr-dialog';
    dialog.setAttribute('aria-labelledby', 'approval-review-title');
    dialog.innerHTML = `<div class="aw-account-header"><div><small data-scope></small><h2 id="approval-review-title" tabindex="-1"></h2></div><button type="button" class="aw-account-close" aria-label="Close approval review" data-close>×</button></div><div class="dr-body"><p data-intro></p><div data-content></div><p class="aw-account-error" role="alert" data-error></p></div><div class="dr-footer"><button type="button" class="button" data-back>Cancel</button><button type="button" class="button primary" data-next></button></div>`;
    document.body.append(dialog);
    const q = s => dialog.querySelector(s), content = q('[data-content]'), next = q('[data-next]');
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n; };
    const choices = {}; let step = 0, busy = false, applied = false;
    let finish; const done = new Promise(resolve => { finish = resolve; });
    function value(entry) { const n = el('div', '', 'dr-value'); engine().valueView(n, entry); return n; }
    function panel(u, which, interactive) {
      const mine = which === 'draft', entry = mine ? u.mine : u.beta;
      const n = el(interactive ? 'label' : 'section', '', 'dr-copy' + (u.decision === 'conflict' ? ' dr-overlap' : ''));
      n.append(el('small', mine ? (step === 2 ? 'Approved result' : 'Submitted request') : 'Latest Beta', 'dr-change-label'));
      if (interactive) {
        const input = document.createElement('input'); input.type = 'radio'; input.name = 'approval-' + u.id; input.value = which; input.checked = choices[u.id] === which;
        const line = el('div', '', 'dr-radio'); line.append(input, el('strong', mine ? 'Use requested change' : 'Keep latest Beta')); n.append(line);
        input.onchange = () => { choices[u.id] = which; next.disabled = model.conflicts.some(u => !choices[u.id]); };
      }
      n.append(value(entry)); return n;
    }
    function row(u, interactive) {
      const n = el('section', '', 'dr-change'); n.append(el('h3', u.title));
      const textField = u.kind === 'field' && typeof u.mine?.value === 'string' && typeof u.beta?.value === 'string';
      if (u.kind === 'field' && [u.before?.value, u.mine?.value, u.beta?.value].some(Array.isArray)) n.append(el('p', 'This list is compared as one group because its entries have no stable IDs. Choosing a version keeps that complete list, including its order.', 'dr-notice'));
      if (interactive) n.append(el('p', textField ? 'Both versions changed this paragraph. Choose which wording to keep.' : 'Both versions changed this item. Choose which version to keep.', 'dr-conflict-help'));
      const original = el('details'); original.append(el('summary', 'Original when this request was created'), value(u.before)); n.append(original);
      const pair = el('div', '', 'dr-pair'); pair.append(panel(u, 'beta', interactive), panel(u, 'draft', interactive)); n.append(pair);
      if (interactive && textField) {
        const label = el('label', '', 'dr-copy dr-edit-choice'), input = document.createElement('input'); input.type = 'radio'; input.name = 'approval-' + u.id; input.value = 'edit'; input.checked = choices[u.id]?.choice === 'edit';
        const line = el('div', '', 'dr-radio'); line.append(input, el('strong', 'Write combined wording')); label.append(line);
        const textarea = document.createElement('textarea'); textarea.rows = 5; textarea.maxLength = 100000; textarea.value = choices[u.id]?.text ?? u.mine.value; textarea.setAttribute('aria-label', 'Combined wording: ' + u.title);
        label.append(textarea, el('small', 'Custom wording uses the original page style. Reapply bold, colour or italics in Studio if needed.'));
        const change = () => { input.checked = true; choices[u.id] = {choice: 'edit', text: textarea.value}; next.disabled = model.conflicts.some(u => !choices[u.id]); };
        input.onchange = change; textarea.oninput = change; n.append(label);
      }
      if (!interactive) n.append(el('p', u.decision === 'conflict' ? '↔ Both changed this field — choose in the next step.' : u.decision === 'same' ? '✓ This change is already in Beta.' : u.decision === 'draft' ? '✓ Add this requested change.' : '✓ Keep the newer Beta change.', 'dr-outcome'));
      return n;
    }
    function draw() {
      content.replaceChildren(); q('[data-error]').textContent = ''; next.disabled = false;
      q('[data-scope]').textContent = request.target;
      q('[data-back]').textContent = step ? '← Back' : 'Cancel';
      content.append(el('p', `Step ${step + 1} of 3 · ${['Compare changes', 'Resolve overlaps', 'Preview approval'][step]}`, 'dr-progress'));
      if (step === 0) {
        q('#approval-review-title').textContent = 'Review this request with the latest Beta';
        q('[data-intro]').textContent = 'We compare the original, the submitted request and current Beta. Changes in different fields stay together, regardless of submission order.';
        content.append(el('div', 'Original when the request was created', 'dr-origin'), el('div', '', 'dr-fork'));
        const heads = el('div', '', 'dr-pair dr-version-heads'); heads.append(el('strong', 'Latest Beta'), el('strong', 'Submitted request')); content.append(heads);
        content.append(el('p', `${model.conflicts.length} overlapping change(s) need a choice. Other changes are combined automatically.`, 'dr-notice'));
        model.changes.forEach(u => content.append(row(u, false)));
        next.textContent = model.conflicts.length ? 'Choose overlapping changes →' : 'Preview approval →';
      } else if (step === 1) {
        q('#approval-review-title').textContent = 'Choose only where edits overlap';
        q('[data-intro]').textContent = 'Only the same field changed differently needs a decision. You can also write combined wording for a text field. For a box or list, choose a version; further editing is available in Studio.';
        model.conflicts.forEach(u => content.append(row(u, true)));
        next.textContent = 'Preview approval →'; next.disabled = model.conflicts.some(u => !choices[u.id]);
      } else {
        const result = engine().combine(model, choices), final = engine().plan(context.latest, result, context.latest, title);
        const noOp = !final.changes.length;
        q('#approval-review-title').textContent = noOp ? 'This result is already in Beta' : 'Apply these changes to Beta?';
        q('[data-intro]').textContent = noOp ? 'Approval will record your review. Beta will stay as it is and no new deployment will be created.' : 'These are the exact changes from current Beta. Other content stays as shown in the comparison.';
        final.changes.forEach(u => content.append(row(u, false)));
        content.append(el('p', 'The submitted request and its author are preserved. Your choices and the approved result are recorded separately. Publishing to students remains a separate action.', 'dr-notice'));
        next.textContent = noOp ? 'Approve — already reflected' : 'Approve & apply to Beta';
      }
    }
    next.onclick = async () => {
      if (busy || next.disabled) return;
      if (step < 2) { step = step === 0 && !model.conflicts.length ? 2 : step + 1; draw(); dialog.scrollTop = 0; q('#approval-review-title').focus(); return; }
      busy = true; dialog.querySelectorAll('button,input,textarea').forEach(n => n.disabled = true); next.textContent = 'Recording approval…';
      try { await api.applyApproval(request.id, request.rev, context, resolutions(model, choices), engine().combine(model, choices), reason); applied = true; dialog.close(); }
      catch (error) { q('[data-error]').textContent = error.message || 'Approval could not be confirmed. Refresh requests before trying again.'; }
      finally { busy = false; dialog.querySelectorAll('button,input,textarea').forEach(n => n.disabled = false); next.textContent = 'Approve reviewed result'; }
    };
    q('[data-close]').onclick = () => { if (!busy) dialog.close(); };
    q('[data-back]').onclick = () => { if (busy) return; if (!step) dialog.close(); else { step = step === 2 && !model.conflicts.length ? 0 : step - 1; draw(); dialog.scrollTop = 0; } };
    const navigate = () => { if (!busy) dialog.close(); };
    window.addEventListener('hashchange', navigate);
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { window.removeEventListener('hashchange', navigate); dialog.remove(); finish(applied); }, {once: true});
    draw(); dialog.showModal(); window.AIWiseMotion?.enter(dialog); q('#approval-review-title').focus();
    return done;
  }
  window.AIWiseApprovalReview = {review, resolutions};
})();
