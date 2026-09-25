/* Shared timing and cancellable transitions. Navigation and unsaved-change guards stay with their owners. */
(() => {
  const active = new WeakMap();
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function duration(kind = 'page', node = document.documentElement) {
    if (reduced()) return 0;
    const token = kind.startsWith('--') ? kind : '--aw-motion-' + kind;
    const value = getComputedStyle(node).getPropertyValue(token).trim();
    return (parseFloat(value) || 0) * (value.endsWith('ms') ? 1 : 1000);
  }
  function after(node, complete, kind = 'page') {
    let timer;
    const cancel = () => { clearTimeout(timer); node.removeEventListener('animationend', finish); };
    const finish = event => {
      if (event && (event.target !== node || event.pseudoElement)) return;
      cancel(); complete();
    };
    node.addEventListener('animationend', finish);
    timer = setTimeout(finish, duration(kind, node) + (reduced() ? 0 : 80));
    return cancel;
  }
  function cancel(node) {
    if (!node) return;
    active.get(node)?.(); active.delete(node);
    node.classList.remove('aw-enter', 'aw-leaving');
  }
  function enter(node, kind = 'page') {
    if (!node) return;
    cancel(node);
    if (reduced()) return;
    node.style.setProperty('--aw-enter-duration', `var(--aw-motion-${kind})`);
    void node.offsetWidth;
    node.classList.add('aw-enter');
    active.set(node, after(node, () => cancel(node), kind));
  }
  function show(node, kind = 'menu') {
    if (!node || (!node.hidden && !node.classList.contains('aw-leaving'))) return;
    cancel(node); node.hidden = false; enter(node, kind);
  }
  function hide(node, kind = 'menu') {
    if (!node || node.hidden || node.classList.contains('aw-leaving')) return;
    cancel(node);
    if (reduced()) { node.hidden = true; return; }
    node.style.setProperty('--aw-enter-duration', `var(--aw-motion-${kind})`);
    node.classList.add('aw-leaving');
    active.set(node, after(node, () => { cancel(node); node.hidden = true; }, kind));
  }
  window.AIWiseMotion = { reduced, duration, after, cancel, enter, show, hide };
  window.addEventListener('pageshow', () => {
    if (document.body.classList.contains('profiler-page')) enter(document.getElementById('shell'));
  });
})();
