/* Shared workspace navigation. Editor and review data remain independent. */
(() => {
  const profiler = document.body.classList.contains('profiler-page');
  const base = profiler ? '../' : '';
  let open = false;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  const areas = [
    ['home', 'Workspace', `${base}#home`, '▦'],
    ['profiler', 'Course Profiler', `${base}course-profiler/`, '◇'],
    ['manager', 'Course Profiler Manager', `${base}#manager`, '▧'],
    ['studio', 'Content Studio', `${base}#studio`, '▤'],
    ['common', 'Common Studio', `${base}#common`, '▥'],
    ['tower', 'Control Tower', `${base}#tower`, '⇄'],
    ['beta', 'Beta', `${base}#beta`, '▣'],
    ['published', 'Published ↗', 'https://aiwise-eur.github.io/AI-Wise/', '↗']
  ];
  const sidebar = document.createElement('aside');
  sidebar.id = 'workspace-sidebar';
  sidebar.className = 'workspace-sidebar';
  sidebar.setAttribute('aria-label', 'Workspace sidebar');
  sidebar.innerHTML = `<div class="sidebar-heading"><a class="brand" href="${base}#home" aria-label="AI-Wise workspace home"><strong>AI-Wise</strong><span>Workspace</span></a><button type="button" class="sidebar-toggle" aria-label="Hide sidebar" aria-controls="workspace-sidebar">${icon}</button></div>
    <p class="sidebar-section-label">Workspaces</p><nav class="workspace-navigation" aria-label="Workspace areas">${areas.map(([id, name, href, glyph]) => `<a href="${href}" data-area="${id}"><span class="sidebar-icon" aria-hidden="true">${glyph}</span><span>${name}</span></a>`).join('')}</nav>
    <nav class="workspace-navigation sidebar-courses" aria-label="Courses"><a href="${base}#courses" data-area="courses"><span class="sidebar-icon" aria-hidden="true">▦</span><span>Courses</span></a><div id="sidebar-course-list"><p class="sidebar-course-status">Loading courses…</p></div><a class="sidebar-add-course" href="${base}#courses/new"><span class="sidebar-icon" aria-hidden="true">+</span><span>Add course</span></a></nav>
    <div class="sidebar-bottom"><a class="sidebar-module" href="${base}../common/lobby.html">Open Beta module ↗</a><span class="sidebar-note">Prototype</span></div>`;
  const rail = document.createElement('div');
  rail.className = 'sidebar-rail';
  rail.innerHTML = `<button type="button" class="sidebar-toggle" aria-label="Show sidebar" title="Show sidebar" aria-controls="workspace-sidebar">${icon}</button>`;
  const backdrop = document.createElement('button');
  backdrop.className = 'sidebar-backdrop';
  backdrop.type = 'button';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', 'Close sidebar');
  document.body.prepend(sidebar, rail, backdrop);
  const show = rail.querySelector('button');
  const hide = sidebar.querySelector('button');
  const locked = new Map();
  function paint() {
    document.body.classList.add('has-sidebar');
    document.body.classList.toggle('sidebar-expanded', open);
    sidebar.inert = !open;
    rail.inert = open;
    backdrop.inert = !open;
    show.setAttribute('aria-expanded', String(open));
    hide.setAttribute('aria-expanded', String(open));
    if (open) {
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      for (const el of document.body.children) {
        if ([sidebar, rail, backdrop].includes(el) || locked.has(el)) continue;
        locked.set(el, el.inert);
        el.inert = true;
      }
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      locked.forEach((value, el) => { el.inert = value; });
      locked.clear();
    }
  }
  function toggle(value, focus = true) {
    open = value;
    if (value) renderCourses();
    paint();
    if (focus) (open ? hide : show).focus({preventScroll: true});
  }
  show.addEventListener('click', () => toggle(true));
  hide.addEventListener('click', () => toggle(false));
  backdrop.addEventListener('click', () => toggle(false));
  sidebar.addEventListener('click', event => {
    if (event.target.closest('a')) toggle(false);
  });
  // Block background gestures without hiding the scrollbar or resizing the page.
  backdrop.addEventListener('wheel', event => event.preventDefault(), {passive: false});
  backdrop.addEventListener('touchmove', event => event.preventDefault(), {passive: false});
  document.addEventListener('keydown', event => {
    if (!open) return;
    if (event.key === 'Escape') { event.preventDefault(); toggle(false); }
    if (event.key === 'Tab') {
      const links = [...sidebar.querySelectorAll('a, button')];
      const first = links[0], last = links.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  function markCurrent() {
    const [area = 'home', part] = location.hash.slice(1).split('/');
    const active = profiler ? 'profiler' : area === 'records' ? part : area || 'home';
    sidebar.querySelectorAll('[data-area]').forEach(link => {
      if (link.dataset.area === active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    sidebar.querySelectorAll('[data-course-id]').forEach(link => {
      if (!profiler && area === 'courses' && link.dataset.courseId === part) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const add = sidebar.querySelector('.sidebar-add-course');
    if (!profiler && area === 'courses' && part === 'new') add.setAttribute('aria-current', 'page');
    else add.removeAttribute('aria-current');
  }
  function renderCourses() {
    const container = document.getElementById('sidebar-course-list');
    try {
      const nodes = window.AIWiseCourses.list().map(course => {
        const link = document.createElement('a');
        link.href = `${base}#courses/${course.id}`;
        link.dataset.courseId = course.id; link.textContent = course.full_name;
        link.title = `${course.short_name} · ${course.full_name}`; return link;
      });
      container.replaceChildren(...nodes);
    } catch {
      const message = document.createElement('p'); message.className = 'sidebar-course-status';
      message.textContent = 'Course list unavailable. Open Courses for details.'; container.replaceChildren(message);
    }
    markCurrent();
  }
  window.AIWiseSidebar = {markCurrent};
  window.AIWiseCourses.ready.then(renderCourses);
  window.addEventListener('aiwise:courses-changed', renderCourses);
  window.addEventListener('storage', event => { if (event.key === 'aiwise_workspace_courses_v1' || event.key === null) renderCourses(); });
  // The workspace router owns active state after its unsaved-change guard runs.
  paint();
  markCurrent();
})();
