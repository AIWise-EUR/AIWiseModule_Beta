/* Rotating workspace tips and read-only local activity. Opening the list never marks requests read. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const row = document.querySelector('.home-update-row');
  const link = document.getElementById('workspace-update');
  const count = document.getElementById('workspace-update-count');
  const pause = document.getElementById('update-pause');
  const trigger = document.getElementById('updates-open');
  const dialog = document.createElement('dialog');
  dialog.id = 'updates-dialog'; dialog.className = 'updates-dialog';
  dialog.setAttribute('aria-labelledby', 'updates-title');
  dialog.setAttribute('aria-describedby', 'updates-summary');
  document.body.appendChild(dialog);
  let cancelClose = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tips = [
    'Choose a course in Content Studio to edit that course’s examples.',
    'Open Common Studio to preview and edit the shared C1, C2 and C3 content.',
    'The item menu includes both C2 and C3. Pick an item to jump straight to it.',
    'Click an outlined item in the preview to open its editor.',
    'Need more space? Drag the editor’s left edge to widen it.',
    'Save draft keeps your edits in this browser. Beta stays unchanged.',
    'Reset draft restores only the course and chapter you are editing.',
    'Use Open in Beta to explore the module outside the editor.',
    'Look for the ⓘ button beside a page title when you need a quick explanation.',
    'Set your display name from the account button in the sidebar.',
    'After creating an account, confirm your email. Team access needs administrator approval.',
    'Use Map or List on the home screen to choose how you navigate.',
    'Open Courses to add a course or change its name.'
  ];
  let index = Math.floor(Math.random() * tips.length), timer, home = false, paused = reduced.matches;
  function collect() {
    const notices = [], updates = [];
    let summary = 'Local activity · This browser only';
    try {
      const data = window.AIWiseControlTower.overview();
      summary += ` · ${data.pending} pending · ${data.urgent} urgent`;
      updates.push(...data.updates);
    } catch { notices.push({title:'Request records are unavailable. Open Control Tower for details.', href:'#tower/all', at:''}); }
    for (const [id, label] of [['aws1', 'AWS1'], ['ped', 'PED']]) for (const chapter of ['c2','c3']) {
      try {
        const raw = localStorage.getItem(`aiwise_content_studio_${id}_${chapter}_v1`);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.schema !== 1 || draft.course !== id || (chapter === 'c2' ? !Array.isArray(draft.examples) : draft.chapter !== 'c3' || !draft.slots) || !Number.isFinite(Date.parse(draft.savedAt))) throw Error();
          updates.push({title:label + ' · ' + chapter.toUpperCase() + ' · Content Studio draft saved in this browser', href:'#studio/' + id + (chapter === 'c2' ? '' : '/c3'), at:draft.savedAt});
        }
      } catch { notices.push({title:label + ' · ' + chapter.toUpperCase() + ' · Content Studio draft could not be read. Open the editor for details.', href:'#studio/' + id + (chapter === 'c2' ? '' : '/c3'), at:''}); }
    }
    for (const chapter of ['c1','c2','c3']) {
      const href = '#common/' + chapter;
      try {
        const raw = localStorage.getItem(`aiwise_common_studio_${chapter}_v1`);
        if (!raw) continue;
        const draft = JSON.parse(raw);
        if (draft.schema !== 1 || draft.scope !== 'common' || draft.chapter !== chapter || !draft.slots || !Number.isFinite(Date.parse(draft.savedAt))) throw Error();
        updates.push({title:'Common Studio · ' + chapter.toUpperCase() + ' · Draft saved in this browser', href, at:draft.savedAt});
      } catch { notices.push({title:'Common Studio · ' + chapter.toUpperCase() + ' · Draft could not be read. Open the editor for details.', href, at:''}); }
    }
    updates.sort((a,b) => (Date.parse(b.at)||0)-(Date.parse(a.at)||0));
    return {summary, entries: [...notices, ...updates]};
  }
  function paint() {
    link.textContent = tips[index];
    link.href = '#updates';
    link.title = 'View all workspace tips';
    link.setAttribute('aria-label', 'Tip: ' + tips[index] + ' View all tips.');
    count.textContent = `Tip ${index + 1} / ${tips.length}`;
    document.getElementById('update-prev').disabled = tips.length < 2;
    document.getElementById('update-next').disabled = tips.length < 2;
    pause.disabled = tips.length < 2;
    pause.textContent = paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Resume automatic tips' : 'Pause automatic tips');
    pause.setAttribute('aria-pressed', String(paused));
  }
  function schedule() {
    clearTimeout(timer);
    if (!home || dialog.open || paused || document.hidden || tips.length < 2 || row.matches(':hover') || row.contains(document.activeElement)) return;
    timer = setTimeout(() => { index = (index + 1) % tips.length; paint(); schedule(); }, 8000);
  }
  function refresh() {
    const data = collect();
    document.getElementById('workspace-status-summary').textContent = data.summary;
    paint(); schedule();
  }
  function step(amount) { index = (index + amount + tips.length) % tips.length; paint(); schedule(); }
  document.getElementById('update-prev').onclick = () => step(-1);
  document.getElementById('update-next').onclick = () => step(1);
  pause.onclick = () => { paused = !paused; paint(); schedule(); };
  row.addEventListener('mouseenter', schedule); row.addEventListener('mouseleave', schedule);
  row.addEventListener('focusin', schedule); row.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches; paint(); schedule(); });
  window.addEventListener('storage', event => { if (home && (!event.key || ['aiwise_common_studio_c1_v1','aiwise_common_studio_c2_v1','aiwise_common_studio_c3_v1','aiwise_control_tower_v1','aiwise_content_studio_aws1_c2_v1','aiwise_content_studio_ped_c2_v1','aiwise_content_studio_aws1_c3_v1','aiwise_content_studio_ped_c3_v1'].includes(event.key))) refresh(); });
  function closeNow(restore = true) {
    cancelClose?.(); cancelClose = null;
    window.AIWiseMotion.cancel(dialog); dialog.classList.remove('updates-closing');
    if (dialog.open) dialog.close();
    if (restore && home) trigger.focus({preventScroll:true});
    schedule();
  }
  function close() {
    if (!dialog.open || cancelClose) return;
    window.AIWiseMotion.cancel(dialog);
    if (window.AIWiseMotion.reduced()) { closeNow(); return; }
    dialog.classList.add('updates-closing');
    cancelClose = window.AIWiseMotion.after(dialog, () => closeNow());
  }
  function open() {
    cancelClose?.(); cancelClose = null;
    window.AIWiseMotion.cancel(dialog); dialog.classList.remove('updates-closing');
    const data = collect();
    dialog.innerHTML = `<div class="updates-heading"><div><p class="eyebrow">AI-Wise Workspace</p><h2 id="updates-title">Tips &amp; activity</h2></div><button class="button" id="updates-close" type="button" aria-label="Close tips and activity" autofocus>×</button></div><p id="updates-summary">${esc(data.summary)}</p><div class="updates-body"><h3 class="section-label">Quick tips</h3><ol class="workspace-tips">${tips.map(tip => `<li>${esc(tip)}</li>`).join('')}</ol><h3 class="section-label">Recent activity</h3>` +
      (data.entries.length ? '<div class="item-list">' + data.entries.map(item => `<a class="item-link" href="${esc(item.href)}"><span>${esc(item.title)}<small>${item.href.startsWith('#tower/request/') ? 'Open request →' : item.href.startsWith('#common/') ? 'Open Common Studio →' : item.href.startsWith('#studio/') ? 'Open Content Studio →' : 'Open Control Tower →'}</small></span><small>${Number.isFinite(Date.parse(item.at)) ? esc(new Date(item.at).toLocaleString()) : 'Check workspace'}</small></a>`).join('') + '</div>' : '<div class="empty-state"><h3>No recorded activity yet</h3><p>Saved drafts and Control Tower requests will appear here.</p></div>') + '</div>';
    document.getElementById('updates-close').addEventListener('click', close);
    if (!dialog.open) dialog.showModal();
    window.AIWiseMotion.enter(dialog);
    document.getElementById('updates-close').focus({preventScroll:true});
    schedule();
  }
  trigger.addEventListener('click', open);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  const outside = event => {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog && outside(event); });
  dialog.addEventListener('click', event => {
    if (event.target.closest('a')) { closeNow(false); return; }
    if (backdropDown && event.target === dialog && outside(event)) close();
    backdropDown = false;
  });
  dialog.addEventListener('wheel', event => { if (event.target === dialog && outside(event)) event.preventDefault(); }, {passive:false});
  window.AIWiseOverview = {setHome(value) { home = value; if (home) refresh(); else { closeNow(false); clearTimeout(timer); } }, open};
})();
