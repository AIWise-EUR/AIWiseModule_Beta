/* Workspace course registration. Runtime course files remain unchanged. */
(() => {
  'use strict';
  const KEY = 'aiwise_workspace_courses_v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let baseline = [], loadError = '', form = null, initial = '', snapshot = null;
  const valid = c => c && /^[a-z][a-z0-9-]{0,39}$/.test(c.id) && typeof c.short_name === 'string' && c.short_name.trim().length > 0 && c.short_name.length <= 40 && typeof c.full_name === 'string' && c.full_name.trim().length > 0 && c.full_name.length <= 160;
  const root = new URL('../', document.currentScript.src);
  const ready = fetch(new URL('common/courses/index.json', root)).then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
    if (!Array.isArray(data) || !data.every(valid) || new Set(data.map(c => c.id)).size !== data.length) throw Error();
    baseline = data;
  }).catch(() => { loadError = 'The course list could not be loaded. Reload the page to try again.'; });
  function read() {
    if (loadError) throw Error(loadError);
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { throw Error('Browser storage is unavailable. Course changes cannot be saved here.'); }
    let entries = [];
    if (raw !== null) {
      try {
        const data = JSON.parse(raw);
        if (data.schema !== 1 || !Array.isArray(data.courses) || !data.courses.every(valid) || data.courses.some(c => c.id === 'other') || new Set(data.courses.map(c => c.id)).size !== data.courses.length) throw Error();
        entries = data.courses;
      } catch { throw Error('Saved course information could not be read. It has been left unchanged.'); }
    }
    return {raw, entries};
  }
  function list() {
    const {entries} = read();
    const merged = new Map(baseline.filter(c => c.id !== 'other').map(c => [c.id, {...c, connected: true}]));
    entries.forEach(c => merged.set(c.id, {...c, connected: merged.has(c.id)}));
    return [...merged.values()];
  }
  function get(id) { return list().find(c => c.id === id); }
  const addCard = () => '<a class="card link course-add" href="#courses/new"><span class="course-plus" aria-hidden="true">+</span><h3>Add course</h3><p>Register a course in Courses.</p><span class="arrow">Go to Courses →</span></a>';
  function cards(area) {
    try {
      return list().map(c => {
        const editable = area === 'studio' && c.id === 'aws1';
        const preview = area === 'studio' && c.id === 'ped';
        const href = editable ? '#studio/aws1' : preview ? '#beta/ped' : '#courses/' + c.id;
        return `<a class="card link" href="${href}"><span class="badge">${editable ? 'Available' : preview ? 'Preview' : c.connected ? 'Existing course' : 'Setup needed'}</span><h3>${esc(c.full_name)}</h3><p>${editable ? 'Edit course examples in the C2 module preview.' : preview ? 'View the PED Orientation in Beta.' : esc(c.short_name) + ' · Manage course information and connections.'}</p><span class="arrow">${editable ? 'Open editor' : preview ? 'Open Beta preview' : 'Manage course'} →</span></a>`;
      }).join('') + addCard();
    } catch (error) { return `<p class="notice">${esc(error.message)}</p>` + addCard(); }
  }
  function courseMap(course) {
    const campus = document.querySelector('#home .campus').cloneNode(true);
    campus.classList.add('course-campus');
    const targets = {
      'profiler-manager': {href: `#courses/${course.id}/manager`, note: `${course.short_name} · Course materials`},
      studio: {href: course.id === 'aws1' ? '#studio/aws1' : '', note: course.id === 'aws1' ? `${course.short_name} · C2 examples` : 'Course editor not connected'},
      'common-studio': {href:'#common', note:'Shared across all courses'},
      tower: {href:'', note:'Course request view not connected'},
      beta: {href:course.connected ? `#beta/${course.id}` : '', note:course.connected ? `${course.short_name} · Working version` : 'Course preview not connected'},
      published: {href:course.id === 'aws1' ? 'https://aiwise-eur.github.io/AI-Wise/' : '', note:course.id === 'aws1' ? `${course.short_name} · Student site ↗` : 'Course release not connected'}
    };
    for (const [name, target] of Object.entries(targets)) {
      const node = campus.querySelector('.destination.' + name);
      node.querySelector('span').textContent = target.note;
      if (name === 'common-studio') node.classList.add('course-shared');
      if (target.href) node.setAttribute('href', target.href);
      else {
        const placeholder = document.createElement('div');
        placeholder.className = node.className + ' course-unavailable';
        placeholder.innerHTML = node.innerHTML;
        placeholder.setAttribute('aria-label', node.querySelector('strong').textContent + ': ' + target.note);
        node.replaceWith(placeholder);
      }
    }
    // The existing student link is not an approval or release action for this course.
    const gate = campus.querySelector('.approval-gate');
    const gateNote = document.createElement('div'); gateNote.className = gate.className + ' course-unavailable';
    gateNote.innerHTML = gate.innerHTML; gateNote.setAttribute('aria-label','Approval and release are not connected'); gate.replaceWith(gateNote);
    return `<div id="course-map" class="map-container" role="region" aria-label="${esc(course.short_name)} course workspaces. Scroll horizontally on small screens." tabindex="0">${campus.outerHTML}</div>`;
  }
  function wireCourseViews() {
    for (const view of ['map','list']) document.getElementById('course-' + view + '-view').addEventListener('click', () => {
      for (const mode of ['map','list']) {
        const selected = mode === view;
        document.getElementById('course-' + mode + '-view').setAttribute('aria-pressed', String(selected));
        document.getElementById(mode === 'map' ? 'course-map' : 'course-material-list').hidden = !selected;
      }
      window.AIWiseMotion.enter(document.getElementById(view === 'map' ? 'course-map' : 'course-material-list'));
    });
  }
  function values() { return form ? JSON.stringify([...new FormData(form).entries()]) : ''; }
  function dirty() { return !!form && values() !== initial; }
  function canLeave() { return !dirty() || window.confirm('Leave without saving these course details?'); }
  function dispose() { form = null; initial = ''; snapshot = null; }
  const notice = '<p class="notice">Course details are saved in this browser only. Registering a course does not create module content or publish it to students.</p>';
  function render(part, shell) {
    let all;
    try { all = list(); }
    catch (error) { shell(null, 'Courses', 'Manage courses across the workspace.', `<p class="notice" role="alert">${esc(error.message)}</p>`, false); return; }
    if (part === 'new' || part.endsWith('/edit')) {
      const isNew = part === 'new', id = part.split('/')[0];
      const course = isNew ? {id:'', short_name:'', full_name:''} : all.find(c => c.id === id);
      if (!course) { missing(shell); return; }
      snapshot = read().raw;
      shell(null, isNew ? 'Add course' : 'Edit course', 'Register and maintain the basic information used in the workspace.', notice +
        `<form id="course-form" class="card course-form"><label for="course-id">Course ID</label><input id="course-id" name="id" value="${esc(course.id)}" required maxlength="40" pattern="[a-z][a-z0-9-]{0,39}" ${isNew ? '' : 'readonly'} aria-describedby="course-id-help"><p id="course-id-help">Lowercase letters, numbers, and hyphens; start with a letter. This ID stays fixed after registration.</p><label for="course-short">Short name</label><input id="course-short" name="short_name" value="${esc(course.short_name)}" required maxlength="40" placeholder="e.g. AWS I"><label for="course-name">Full course name</label><input id="course-name" name="full_name" value="${esc(course.full_name)}" required maxlength="160" placeholder="e.g. Academic Writing Skills I"><p id="course-message" role="status"></p><div class="toolbar"><button type="submit" class="button primary">${isNew ? 'Add course' : 'Save changes'}</button><a class="button" href="#courses${isNew ? '' : '/' + course.id}">Cancel</a></div></form>`, false);
      form = document.getElementById('course-form'); initial = values();
      form.addEventListener('submit', event => {
        event.preventDefault();
        const message = document.getElementById('course-message');
        try {
          const course = Object.fromEntries(new FormData(form));
          Object.keys(course).forEach(k => { course[k] = course[k].trim(); });
          if (!valid(course)) throw Error('Enter a valid course ID and both course names.');
          if (['new','other','edit','__proto__','constructor','prototype'].includes(course.id)) throw Error('This course ID is reserved. Choose another ID.');
          const current = read();
          if (current.raw !== snapshot) throw Error('Course information changed in another tab. Copy your changes, then reopen this form.');
          if (isNew && list().some(c => c.id === course.id)) throw Error('This course ID already exists. Choose another ID.');
          if (!isNew && course.id !== id) throw Error('The course ID cannot be changed.');
          const entries = current.entries.filter(c => c.id !== course.id).concat(course);
          try { localStorage.setItem(KEY, JSON.stringify({schema:1, courses:entries})); }
          catch { throw Error('The course could not be saved. Keep this form open and try again.'); }
          initial = values(); window.dispatchEvent(new Event('aiwise:courses-changed')); location.hash = '#courses/' + course.id;
        } catch (error) { message.textContent = error.message; }
      });
      return;
    }
    if (part) {
      const [id, view] = part.split('/');
      const c = all.find(c => c.id === id);
      if (!c || (view && view !== 'manager')) { missing(shell); return; }
      if (view === 'manager') {
        shell('courses', `${c.short_name} · Course Profiler Manager`, c.full_name,
          `<div class="toolbar"><a class="button primary" href="course-profiler/">Open Course Profiler</a><a class="button" href="#courses/${c.id}">Back to course</a></div><p class="course-local-note">The teacher tool opens its current browser profile. It does not automatically load this course.</p>` +
          (c.id === 'aws1' ? '<div class="cards"><a class="card link" href="#manager/prompts"><h3>Preset Prompts</h3><p>AWS1 course and activity prompts.</p><span class="arrow">Read prompts →</span></a><a class="card link" href="#manager/activities"><h3>AI Activities</h3><p>The seven AWS1 activity pages.</p><span class="arrow">View activities →</span></a></div>' : '<div class="empty-state"><h2>Course materials not connected</h2><p>This course does not yet have a connected profile, preset prompts, or activity package.</p></div>'), false);
        return;
      }
      const destination = (title, description, href, action) => `<div class="card"><h3>${title}</h3><p>${description}</p>${href ? `<a class="button" href="${href}">${action}</a>` : '<span class="badge">Setup needed</span>'}</div>`;
      shell('courses', c.full_name, `${c.short_name} · Course workspace`, `<div class="toolbar course-view-toolbar"><div class="view-switch" role="group" aria-label="Course view"><button id="course-map-view" type="button" aria-pressed="true">▦ Map</button><button id="course-list-view" type="button" aria-pressed="false">☷ List</button></div><a class="button" href="#courses/${c.id}/edit">Edit course details</a><a class="button" href="#courses">All courses</a></div>` + courseMap(c) + `<p class="course-local-note">${esc(c.short_name)} materials · Common Studio is shared across courses and shown in grayscale. Unconnected areas are labeled on the map.</p><div id="course-material-list" class="cards course-hub" hidden>` +
        destination('Course Profiler Manager', c.id === 'aws1' ? 'Review the course and activity prompts.' : 'A course profile and activity package still need to be connected.', `#courses/${c.id}/manager`, 'Open course materials') +
        destination('Content Studio', c.id === 'aws1' ? 'Edit the course examples in AI Orientation.' : 'The Orientation editor is not connected for this course yet.', c.id === 'aws1' ? '#studio/aws1' : '', 'Open editor') +
        destination('AI Activities', c.id === 'aws1' ? 'Inspect the seven existing activity pages.' : 'Activity pages still need to be connected.', c.id === 'aws1' ? '#manager/activities' : '', 'View activities') +
        destination('AI-Wise Beta', c.connected ? 'Preview this course in the current Beta module.' : 'A Beta module is not connected yet.', c.connected ? '#beta/' + c.id : '', 'Open Beta') +
        destination('Control Tower', 'The course request view is not connected yet.', '', '') +
        destination('AI-Wise Published', c.id === 'aws1' ? 'Open the existing student site for AWS1.' : 'A student release is not connected for this course.', c.id === 'aws1' ? 'https://aiwise-eur.github.io/AI-Wise/' : '', 'Open student site') +
        destination('Common Studio', 'Shared content used across courses.', '#common', 'Open shared content') + '</div>', false);
      wireCourseViews();
      return;
    }
    shell(null, 'Courses', 'Choose a course to open its workspace.', '<p class="course-local-note">Course registration and name changes are saved in this browser.</p><div class="cards course-dashboard">' + all.map((c, index) => `<a class="card link course-tile course-tone-${index % 3}" href="#courses/${c.id}"><div class="course-cover"><span>${esc(c.short_name)}</span></div><div class="course-tile-body"><span class="badge">${c.connected ? 'Connected workspaces' : 'Setup needed'}</span><h3>${esc(c.full_name)}</h3><p>${esc(c.id)}</p><span class="arrow">Open course →</span></div></a>`).join('') + addCard() + '</div>', false);
  }
  function missing(shell) { shell(null, 'Course not found', 'This course is not registered in this browser.', '<a class="button" href="#courses">All courses</a>', false); }
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.AIWiseCourses = {ready, list, get, cards, addCard, render, canLeave, dispose};
})();
