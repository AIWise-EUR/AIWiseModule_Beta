/* Shared workspace navigation. Editor and review data remain independent. */
(() => {
  const profiler = document.body.classList.contains('profiler-page');
  const base = profiler ? '../' : '';
  let open = false, expanded = '', hoverTimer;
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  const chevron = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m8 5 5 5-5 5"/></svg>';
  // Areas flagged with children open a second column listing their items; the current item is marked.
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
  const commonItems = [['beta/c1', 'C1 · What is GenAI?'], ['beta/c2', 'C2 · GenAI and human cognition'], ['beta/c3', 'C3 · How to engage with GenAI']];
  const parents = ['manager', 'studio', 'beta'];
  let subitems = {};
  const sidebar = document.createElement('aside');
  sidebar.id = 'workspace-sidebar';
  sidebar.className = 'workspace-sidebar';
  sidebar.setAttribute('aria-label', 'Workspace sidebar');
  sidebar.dataset.expanded = '';
  sidebar.innerHTML = `<div class="sidebar-main"><div class="sidebar-heading"><a class="brand" href="${base}#home" aria-label="AI-Wise workspace home"><strong>AI-Wise</strong><span>Workspace</span></a><button type="button" class="sidebar-toggle" aria-label="Hide sidebar" aria-controls="workspace-sidebar">${icon}</button></div>
    <p class="sidebar-section-label">Workspaces</p><nav class="workspace-navigation" aria-label="Workspace areas">${areas.map(([id, name, href, glyph, children]) => `<div class="sidebar-area" data-area-row="${id}"><a href="${href}" data-area="${id}"><span class="sidebar-icon" aria-hidden="true">${glyph}</span><span>${name}</span></a>${children ? `<button type="button" class="sidebar-expand" aria-label="Show ${name} items" aria-expanded="false" aria-controls="workspace-sidebar-panel">${chevron}</button><div class="sidebar-subitems" data-subitems="${id}" role="group" aria-label="${name} items" hidden></div>` : ''}</div>`).join('')}</nav>
    <nav class="workspace-navigation sidebar-courses" aria-label="Courses"><a href="${base}#courses" data-area="courses"><span class="sidebar-icon" aria-hidden="true">▦</span><span>Courses</span></a><div id="sidebar-course-list"><p class="sidebar-course-status">Loading courses…</p></div><a class="sidebar-add-course" href="${base}#courses/new"><span class="sidebar-icon" aria-hidden="true">+</span><span>Add course</span></a></nav>
    <div class="sidebar-bottom"><a class="sidebar-module" href="${base}../common/lobby.html">Open Beta module ↗</a><section class="sidebar-account" aria-labelledby="sidebar-account-label"><p class="sidebar-section-label" id="sidebar-account-label">Account</p><div data-account-slot></div><nav class="workspace-navigation sidebar-admin" aria-label="Account management"><div class="sidebar-area" data-area-row="team"><a href="${base}#team" data-area="team"><span class="sidebar-icon" aria-hidden="true">♧</span><span>Team management</span></a></div></nav></section></div></div>
    <div class="sidebar-panel" id="workspace-sidebar-panel" role="group" aria-labelledby="sidebar-panel-title"><p class="sidebar-section-label" id="sidebar-panel-title"></p><div class="sidebar-panel-list"></div></div>`;
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
  const hide = sidebar.querySelector('.sidebar-toggle');
  const panel = sidebar.querySelector('.sidebar-panel');
  const panelTitle = sidebar.querySelector('#sidebar-panel-title');
  const panelList = sidebar.querySelector('.sidebar-panel-list');
  const locked = new Map();
  const visible = el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
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
  // The parent area of the current page, so the drawer opens with its items shown.
  function currentParent() {
    if (profiler) return '';
    const [area = '', part, third] = location.hash.slice(1).split('/');
    if (area === 'courses' && third === 'manager') return 'manager';
    if (area === 'profiler' && ['prompts', 'activities'].includes(part)) return 'manager';
    if (area === 'records') return parents.includes(part) ? part : '';
    return parents.includes(area) ? area : '';
  }
  function toggle(value, focus = true) {
    open = value;
    clearTimeout(hoverTimer);
    if (value) renderCourses();
    paint();
    setExpanded(value ? currentParent() : '');
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
      const links = [...sidebar.querySelectorAll('a, button')].filter(visible);
      const first = links[0], last = links.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  function subitem([hash, label, title]) {
    const link = document.createElement('a');
    link.href = `${base}#${hash}`; link.dataset.sub = hash; link.textContent = label;
    if (title) link.title = title;
    return link;
  }
  function itemLinks(id) {
    return [...sidebar.querySelectorAll(`[data-subitems="${id}"] a, .sidebar-panel-list a`)].filter(visible);
  }
  function setExpanded(id, focus = false) {
    expanded = subitems[id] ? id : '';
    sidebar.dataset.expanded = expanded;
    sidebar.querySelectorAll('[data-area-row]').forEach(row => {
      const on = row.dataset.areaRow === expanded;
      row.querySelector('.sidebar-expand')?.setAttribute('aria-expanded', String(on));
      const inline = row.querySelector('.sidebar-subitems');
      if (inline) inline.hidden = !on;
    });
    const area = areas.find(entry => entry[0] === expanded);
    panelTitle.textContent = area ? area[1] : '';
    panelList.replaceChildren(...(expanded ? subitems[expanded].map(subitem) : []));
    markCurrent();
    if (focus && expanded) itemLinks(expanded)[0]?.focus({preventScroll: true});
  }
  sidebar.querySelectorAll('[data-area-row]').forEach(row => {
    const id = row.dataset.areaRow, link = row.querySelector('a'), button = row.querySelector('.sidebar-expand');
    if (!button) return;
    row.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse') return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => setExpanded(id), 150);
    });
    row.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
    link.addEventListener('focus', () => setExpanded(id));
    link.addEventListener('keydown', event => { if (event.key === 'ArrowRight') { event.preventDefault(); setExpanded(id, true); } });
    button.addEventListener('click', () => { clearTimeout(hoverTimer); setExpanded(expanded === id ? '' : id, expanded !== id); });
  });
  sidebar.addEventListener('keydown', event => {
    const item = event.target.closest('[data-sub]');
    if (!item) return;
    const links = itemLinks(expanded), index = links.indexOf(item);
    if (event.key === 'ArrowLeft') { event.preventDefault(); sidebar.querySelector(`[data-area="${expanded}"]`)?.focus({preventScroll: true}); }
    else if (event.key === 'ArrowDown' && links[index + 1]) { event.preventDefault(); links[index + 1].focus(); }
    else if (event.key === 'ArrowUp' && links[index - 1]) { event.preventDefault(); links[index - 1].focus(); }
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
  function collectSubitems(courses) {
    subitems = {
      manager: courses.map(c => [`courses/${c.id}/manager`, c.short_name, c.full_name]),
      studio: courses.map(c => [`studio/${c.id}`, c.short_name, c.full_name]),
      beta: [...commonItems, ...courses.filter(c => c.connected).map(c => [`beta/${c.id}`, c.short_name, c.full_name])]
    };
    for (const id of parents) sidebar.querySelector(`[data-subitems="${id}"]`).replaceChildren(...subitems[id].map(subitem));
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
      collectSubitems(courses);
    } catch {
      const message = document.createElement('p'); message.className = 'sidebar-course-status';
      message.textContent = 'Course list unavailable. Open Courses for details.'; container.replaceChildren(message);
      collectSubitems([]);
    }
    setExpanded(expanded);
  }
  window.AIWiseSidebar = {markCurrent, close(focus = true) { toggle(false, focus); }};
  window.AIWiseCourses.ready.then(renderCourses);
  window.addEventListener('aiwise:courses-changed', renderCourses);
  window.addEventListener('storage', event => { if (event.key === 'aiwise_workspace_courses_v1' || event.key === null) renderCourses(); });
  // The workspace router owns active state after its unsaved-change guard runs.
  paint();
  markCurrent();
})();
