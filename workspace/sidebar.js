/* Shared workspace navigation. Editor and review data remain independent. */
(() => {
  const profiler = document.body.classList.contains('profiler-page');
  const base = profiler ? '../' : '';
  let open = false;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  // Areas with sub-items list them beneath their link; the current one is marked.
  const areas = [
    ['home', 'Workspace', `${base}#home`, '▦'],
    ['profiler', 'Course Profiler', `${base}course-profiler/`, '◇'],
    ['manager', 'Course Profiler Manager', `${base}#manager`, '▧', true],
    ['studio', 'Content Studio', `${base}#studio`, '▤', true],
    ['common', 'Common Studio', `${base}#common`, '▥'],
    ['tower', 'Control Tower', `${base}#tower`, '⇄'],
    ['beta', 'Beta', `${base}#beta`, '▣', true],
    ['published', 'Published ↗', 'https://aiwise-eur.github.io/AI-Wise/', '↗']
  ];
  const commonItems = [['c1', 'C1 · What is GenAI?'], ['c2', 'C2 · GenAI and human cognition'], ['c3', 'C3 · How to engage with GenAI']];
  const sidebar = document.createElement('aside');
  sidebar.id = 'workspace-sidebar';
  sidebar.className = 'workspace-sidebar';
  sidebar.setAttribute('aria-label', 'Workspace sidebar');
  sidebar.innerHTML = `<div class="sidebar-heading"><a class="brand" href="${base}#home" aria-label="AI-Wise workspace home"><strong>AI-Wise</strong><span>Workspace</span></a><button type="button" class="sidebar-toggle" aria-label="Hide sidebar" aria-controls="workspace-sidebar">${icon}</button></div>
    <p class="sidebar-section-label">Workspaces</p><nav class="workspace-navigation" aria-label="Workspace areas">${areas.map(([id, name, href, glyph, children]) => `<div class="sidebar-area"><a href="${href}" data-area="${id}"><span class="sidebar-icon" aria-hidden="true">${glyph}</span><span>${name}</span></a>${children ? `<div class="sidebar-subitems" data-subitems="${id}" role="group" aria-label="${name} items"></div>` : ''}</div>`).join('')}</nav>
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
    const path = location.hash.slice(1);
    const [area = 'home', part, third] = path.split('/');
    const managerCourse = area === 'courses' && third === 'manager';
    const legacyManager = area === 'profiler' && ['prompts', 'activities'].includes(part);
    const active = profiler ? 'profiler' : area === 'records' ? part : managerCourse || legacyManager ? 'manager' : area || 'home';
    let subMatched = false;
    sidebar.querySelectorAll('[data-sub]').forEach(link => {
      const current = !profiler && link.dataset.sub === path;
      if (current) { link.setAttribute('aria-current', 'page'); subMatched = true; }
      else link.removeAttribute('aria-current');
    });
    sidebar.querySelectorAll('[data-area]').forEach(link => {
      const current = link.dataset.area === active;
      if (current && !subMatched) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      link.classList.toggle('sidebar-parent-open', current && subMatched);
    });
    sidebar.querySelectorAll('[data-course-id]').forEach(link => {
      if (!profiler && area === 'courses' && !third && link.dataset.courseId === part) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const add = sidebar.querySelector('.sidebar-add-course');
    if (!profiler && area === 'courses' && part === 'new') add.setAttribute('aria-current', 'page');
    else add.removeAttribute('aria-current');
  }
  function subitem(hash, label, title) {
    const link = document.createElement('a');
    link.href = `${base}#${hash}`; link.dataset.sub = hash; link.textContent = label;
    if (title) link.title = title;
    return link;
  }
  function renderSubitems(courses) {
    const fill = (id, nodes) => sidebar.querySelector(`[data-subitems="${id}"]`).replaceChildren(...nodes);
    fill('manager', courses.map(c => subitem(`courses/${c.id}/manager`, c.short_name, c.full_name)));
    fill('studio', courses.map(c => subitem(`studio/${c.id}`, c.short_name, c.full_name)));
    fill('beta', [...commonItems.map(([id, name]) => subitem(`beta/${id}`, name)),
      ...courses.filter(c => c.connected).map(c => subitem(`beta/${c.id}`, c.short_name, c.full_name))]);
  }
  function renderCourses() {
    const container = document.getElementById('sidebar-course-list');
    try {
      const courses = window.AIWiseCourses.list();
      container.replaceChildren(...courses.map(course => {
        const link = document.createElement('a');
        link.href = `${base}#courses/${course.id}`;
        link.dataset.courseId = course.id; link.textContent = course.full_name;
        link.title = `${course.short_name} · ${course.full_name}`; return link;
      }));
      renderSubitems(courses);
    } catch {
      const message = document.createElement('p'); message.className = 'sidebar-course-status';
      message.textContent = 'Course list unavailable. Open Courses for details.'; container.replaceChildren(message);
      renderSubitems([]);
    }
    markCurrent();
  }
  window.AIWiseSidebar = {markCurrent, close(focus = true) { toggle(false, focus); }};
  window.AIWiseCourses.ready.then(renderCourses);
  window.addEventListener('aiwise:courses-changed', renderCourses);
  window.addEventListener('storage', event => { if (event.key === 'aiwise_workspace_courses_v1' || event.key === null) renderCourses(); });
  // The workspace router owns active state after its unsaved-change guard runs.
  paint();
  markCurrent();
})();
