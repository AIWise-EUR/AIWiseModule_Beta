/* Read-only local activity. Opening this overview does not mark requests read. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const row = document.querySelector('.home-update-row');
  const link = document.getElementById('workspace-update');
  const count = document.getElementById('workspace-update-count');
  const pause = document.getElementById('update-pause');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let entries = [], index = 0, timer, home = false, paused = reduced.matches;
  function collect() {
    const notices = [], updates = [];
    let summary = 'Local activity · This browser only';
    try {
      const data = window.AIWiseControlTower.overview();
      summary += ` · ${data.pending} pending · ${data.urgent} urgent`;
      updates.push(...data.updates);
    } catch { notices.push({title:'Request records are unavailable. Open Control Tower for details.', href:'#tower/all', at:''}); }
    try {
      const raw = localStorage.getItem('aiwise_content_studio_aws1_c2_v1');
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.schema !== 1 || draft.course !== 'aws1' || !Array.isArray(draft.examples) || !Number.isFinite(Date.parse(draft.savedAt))) throw Error();
        updates.push({title:'AWS1 · Content Studio draft saved in this browser', href:'#studio/aws1', at:draft.savedAt});
      }
    } catch { notices.push({title:'The Content Studio draft could not be read. Open the editor for details.', href:'#studio/aws1', at:''}); }
    updates.sort((a,b) => (Date.parse(b.at)||0)-(Date.parse(a.at)||0));
    return {summary, entries: [...notices, ...updates]};
  }
  function paint() {
    const current = entries[index];
    link.textContent = current ? current.title : 'No recorded activity yet. Open Control Tower to review requests.';
    link.href = current ? current.href : '#tower/all';
    link.title = link.textContent;
    count.textContent = entries.length ? `${index + 1} / ${entries.length}` : '';
    document.getElementById('update-prev').disabled = entries.length < 2;
    document.getElementById('update-next').disabled = entries.length < 2;
    pause.disabled = entries.length < 2;
    pause.textContent = paused ? 'Resume' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Resume automatic updates' : 'Pause automatic updates');
    pause.setAttribute('aria-pressed', String(paused));
  }
  function schedule() {
    clearTimeout(timer);
    if (!home || paused || document.hidden || entries.length < 2 || row.matches(':hover') || row.contains(document.activeElement)) return;
    timer = setTimeout(() => { index = (index + 1) % entries.length; paint(); schedule(); }, 6000);
  }
  function refresh() {
    const data = collect(); entries = data.entries; index = 0;
    document.getElementById('workspace-status-summary').textContent = data.summary;
    paint(); schedule();
  }
  function step(amount) { if (entries.length) index = (index + amount + entries.length) % entries.length; paint(); schedule(); }
  document.getElementById('update-prev').onclick = () => step(-1);
  document.getElementById('update-next').onclick = () => step(1);
  pause.onclick = () => { paused = !paused; paint(); schedule(); };
  row.addEventListener('mouseenter', schedule); row.addEventListener('mouseleave', schedule);
  row.addEventListener('focusin', schedule); row.addEventListener('focusout', () => queueMicrotask(schedule));
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', () => { paused = reduced.matches; paint(); schedule(); });
  window.addEventListener('storage', event => { if (home && (!event.key || ['aiwise_control_tower_v1','aiwise_content_studio_aws1_c2_v1'].includes(event.key))) refresh(); });
  function render(shell) {
    const data = collect();
    shell(null, 'Workspace activity', data.summary, '<p class="course-local-note">Recent request states and saved drafts from this browser. Approvals do not indicate publication.</p>' + (data.entries.length ? '<div class="item-list">' + data.entries.map(item => `<a class="item-link" href="${esc(item.href)}"><span>${esc(item.title)}</span><small>${Number.isFinite(Date.parse(item.at)) ? esc(new Date(item.at).toLocaleString()) : 'Check workspace'}</small></a>`).join('') + '</div>' : '<div class="empty-state"><h2>No recorded activity yet</h2><p>Saved drafts and Control Tower requests will appear here.</p></div>'), false);
  }
  window.AIWiseOverview = {setHome(value) { home = value; if (home) refresh(); else clearTimeout(timer); }, render};
})();
