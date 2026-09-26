/* Workspace course registration. Runtime course files remain unchanged. */
(() => {
  'use strict';
  const KEY = 'aiwise_workspace_courses_v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let baseline = [], loadError = '', form = null, initial = '', snapshot = null;
  const valid = c => c && /^[a-z][a-z0-9-]{0,39}$/.test(c.id) && typeof c.short_name === 'string' && c.short_name.trim().length > 0 && c.short_name.length <= 40 && typeof c.full_name === 'string' && c.full_name.trim().length > 0 && c.full_name.length <= 160;
  const ready = fetch('../common/courses/index.json').then(r => { if (!r.ok) throw Error(); return r.json(); }).then(data => {
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
          initial = values(); location.hash = '#courses/' + course.id;
        } catch (error) { message.textContent = error.message; }
      });
      return;
    }
    if (part) {
      const c = all.find(c => c.id === part);
      if (!c) { missing(shell); return; }
      shell(null, c.full_name, `${c.short_name} · ${c.id}`, notice + `<div class="toolbar"><a class="button primary" href="#courses/${c.id}/edit">Edit course details</a><a class="button" href="#courses">All courses</a></div><div class="cards"><div class="card"><h3>Course Profiler Manager</h3><p>${c.id === 'aws1' ? 'Existing AWS1 prompts and activities are available in Manager.' : 'A course profile and activity package still need to be connected.'}</p><a class="button" href="#manager">Open Manager</a></div><div class="card"><h3>Content Studio</h3><p>${c.id === 'aws1' ? 'The C2 example editor is connected.' : c.id === 'ped' ? 'A Beta preview is available. The editor is not connected yet.' : 'Orientation content and its editor still need to be connected.'}</p>${c.id === 'aws1' ? '<a class="button" href="#studio/aws1">Open editor</a>' : c.id === 'ped' ? '<a class="button" href="#beta/ped">Open Beta preview</a>' : '<span class="badge">Setup needed</span>'}</div></div>`, false);
      return;
    }
    shell(null, 'Courses', 'Manage course registration and basic information across the workspace.', notice + '<div class="cards">' + all.map(c => `<a class="card link" href="#courses/${c.id}"><span class="badge">${c.connected ? 'Existing course' : 'Setup needed'}</span><h3>${esc(c.full_name)}</h3><p>${esc(c.short_name)} · ${esc(c.id)}</p><span class="arrow">Manage course →</span></a>`).join('') + addCard() + '</div>', false);
  }
  function missing(shell) { shell(null, 'Course not found', 'This course is not registered in this browser.', '<a class="button" href="#courses">All courses</a>', false); }
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.AIWiseCourses = {ready, list, get, cards, addCard, render, canLeave, dispose};
})();
