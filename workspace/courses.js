/* Shared registry course pages, with preserved legacy browser-only entries. */
(() => {
  'use strict';
  const KEY = 'aiwise_workspace_courses_v1', MIGRATED = 'aiwise_workspace_courses_registered_v1';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loadError = '', form = null, initial = '', snapshot = null, saving = false, generation = 0;
  const valid = c => c && /^[a-z][a-z0-9-]{0,39}$/.test(c.id) && typeof c.short_name === 'string' && c.short_name.trim().length > 0 && c.short_name.length <= 40 && typeof c.full_name === 'string' && c.full_name.trim().length > 0 && c.full_name.length <= 160;
  const registry = window.AIWiseCourseRegistry;
  const ready = registry.ready.then(() => { loadError = registry.error();  });
  function read() {
    if (loadError) throw Error(loadError);
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { throw Error('Browser storage is unavailable. Course changes cannot be saved here.'); }
    let entries = [];
    if (raw !== null) {
      try {
        const data = JSON.parse(raw);
        if (data.schema !== 1 || !Array.isArray(data.courses) || !data.courses.every(valid) || new Set(data.courses.map(c => c.id)).size !== data.courses.length) throw Error();
        entries = data.courses;
      } catch { throw Error('Saved course information could not be read. It has been left unchanged.'); }
    }
    return {raw, entries};
  }
  function list() {
    const {entries} = read();
    const merged = new Map(registry.courses().map(c => [c.id, {...c, connected: true}]));
    let migrated = {};
    try { migrated = JSON.parse(localStorage.getItem(MIGRATED) || '{}') || {}; } catch { /* Originals remain visible. */ }
    entries.forEach(c => {
      const saved = migrated[c.id];
      if (saved?.source === JSON.stringify(c) && merged.has(saved.id)) return;
      merged.set(c.id, {...c, connected: false});
    });
    return [...merged.values()];
  }
  // Course examples are edited once per bachelor and shown in every course of that bachelor.
  const hasStudio = course => !!course.bachelor && !!window.AIWiseContentStudio?.supports(course.bachelor);
  const studioHref = course => '#studio/' + course.bachelor;
  function get(id) { return list().find(c => c.id === id); }
  const addCard = () => '<a class="card link course-add" href="#courses/new"><span class="course-plus" aria-hidden="true">+</span><h3>Add course</h3><p>Register a course in Courses.</p><span class="arrow">Go to Courses →</span></a>';
  function cards(area) {
    try {
      return list().map(c => {
        const editable = area === 'studio' && hasStudio(c);
        const href = editable ? studioHref(c) : '#courses/' + c.id;
        return `<a class="card link" href="${href}"><span class="badge">${editable ? 'Available' : c.connected ? 'Existing course' : 'Setup needed'}</span><h3>${esc(c.full_name)}</h3><p>${editable ? 'Edit the ' + esc(c.bachelor_name) + ' examples in the C2 and C3 module previews.' : esc(c.short_name) + ' · Manage course information and connections.'}</p><span class="arrow">${editable ? 'Open editor' : 'Manage course'} →</span></a>`;
      }).join('') + addCard();
    } catch (error) { return `<p class="notice">${esc(error.message)}</p>` + addCard(); }
  }
  function courseMap(course) {
    const campus = document.querySelector('#home .campus').cloneNode(true);
    campus.classList.add('course-campus');
    const targets = {
      'profiler-manager': {href: `#courses/${course.id}/manager`, note: `${course.short_name} · Course materials`},
      studio: {href: hasStudio(course) ? studioHref(course) : '', note: hasStudio(course) ? `${course.bachelor_name} · C2 and C3 content` : 'Course editor not connected'},
      'common-studio': {href:'#common', note:'Shared across all courses'},
      tower: {href:'', note:'Course request view not connected'},
      beta: {href:course.connected ? `#beta/${course.id}` : '', note:course.connected ? `${course.short_name} · Working version` : 'Course preview not connected'},
      published: {href:course.connected ? 'https://aiwise-eur.github.io/AI-Wise/' : '', note:course.connected ? `${course.short_name} · Student site ↗` : 'Course release not connected'}
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
  function canLeave() { if (saving) return false; return !dirty() || window.confirm('Leave without saving these course details?'); }
  function dispose() { generation++; form = null; initial = ''; snapshot = null; saving = false; }
  const sharedNote = '<p>Register a course in the team list and connect it to its bachelor’s Content Studio. Examples are shared by all courses in that bachelor. Student publication is a separate step.</p>';
  const refreshToolbar = () => '<div class="toolbar"><button id="shared-courses-refresh" class="button" type="button">Refresh shared list</button><span id="shared-courses-status" role="status"></span></div>';
  function mountRefresh(updated) {
    const button = document.getElementById('shared-courses-refresh'), status = document.getElementById('shared-courses-status');
    if (!button) return;
    const token = generation;
    button.onclick = async () => {
      button.disabled = true; status.textContent = 'Loading shared courses…';
      try {
        await window.AIWiseSharedCourses.refresh();
        if (generation !== token || !button.isConnected) return;
        loadError = ''; updated(); status.textContent = 'Shared list is up to date.';
      } catch (error) { if (generation === token && button.isConnected) status.textContent = error.message; }
      finally { if (button.isConnected) button.disabled = false; }
    };
    button.click();
  }
  function dashboardCards() {
    return list().map((c, index) => `<a class="card link course-tile course-tone-${index % 3}" href="#courses/${c.id}"><div class="course-cover"><span>${esc(c.short_name)}</span></div><div class="course-tile-body"><span class="badge">${c.connected ? 'Team course' : 'Browser only · Register with team'}</span><h3>${esc(c.full_name)}</h3><p>${esc(c.id)}</p><span class="arrow">${c.connected ? 'Open course' : 'Register and connect'} →</span></div></a>`).join('') + addCard();
  }
  function render(part, shell) {
    let all;
    try { all = list(); }
    catch (error) { shell(null, 'Courses', '', `<p class="notice" role="alert">${esc(error.message)}</p>`, false); return; }
    if (part === 'new' || part.endsWith('/edit')) {
      const isNew = part === 'new', id = part.split('/')[0];
      const course = isNew ? {id:'', short_name:'', full_name:''} : all.find(c => c.id === id);
      if (!course) { missing(shell); return; }
      const registered = !!course.connected, token = ++generation;
      snapshot = read().raw;
      let sha = '', loaded = false;
      const options = () => '<option value="">Select bachelor…</option>' + registry.bachelors().map(b => `<option value="${esc(b.id)}" ${b.id === course.bachelor ? 'selected' : ''}>${esc(b.name)}</option>`).join('');
      shell(null, registered ? 'Edit course' : isNew ? 'Add course' : 'Register course with team', sharedNote + (!isNew && !registered ? '<p>Your existing browser copy will be preserved.</p>' : ''),
        `<form id="course-form" class="card course-form" novalidate><label for="course-bachelor">Bachelor</label><select id="course-bachelor" name="bachelor" required ${registered ? 'disabled' : ''} aria-describedby="course-bachelor-help">${options()}</select><p id="course-bachelor-help">Choose the course’s actual bachelor. If it is missing, ask the administrator to set up that bachelor first.</p><label for="course-id">Course ID</label><input id="course-id" name="id" value="${esc(course.slug || course.id)}" required maxlength="40" ${registered ? 'readonly' : ''} aria-describedby="course-id-help"><p id="course-id-help">Lowercase letters, numbers, and hyphens; start with a letter. For example: dpas-skills. Bachelor and ID stay fixed after registration.</p><label for="course-short">Short name</label><input id="course-short" name="short_name" value="${esc(course.short_name)}" required maxlength="40" placeholder="e.g. Skills"><label for="course-name">Full course name</label><input id="course-name" name="full_name" value="${esc(course.name || course.full_name)}" required maxlength="160" placeholder="e.g. DPAS - B1 - 1.1 Skills"><p id="course-message" role="status" aria-live="polite"></p><div class="toolbar"><button id="course-save" type="submit" class="button primary" disabled>${registered ? 'Save shared names' : 'Register with team'}</button><button id="course-refresh" type="button" class="button">Refresh shared list</button><a class="button" href="#courses${isNew ? '' : '/' + course.id}">Cancel</a></div></form>`, false);
      form = document.getElementById('course-form'); initial = values();
      const activeForm = form, message = document.getElementById('course-message'), save = document.getElementById('course-save'), refresh = document.getElementById('course-refresh');
      const current = () => token === generation && form === activeForm && activeForm.isConnected;
      const setError = error => {
        message.textContent = error.message;
        activeForm.querySelectorAll('[aria-invalid]').forEach(n => n.removeAttribute('aria-invalid'));
        const ids = {bachelor:'course-bachelor', id:'course-id', short_name:'course-short', name:'course-name'};
        if (ids[error.field]) { const input = document.getElementById(ids[error.field]); input.setAttribute('aria-invalid', 'true'); input.focus(); }
      };
      refresh.onclick = async () => {
        refresh.disabled = true; save.disabled = true; sha = ''; loaded = false;
        message.textContent = 'Loading the shared course list…';
        try {
          const result = await window.AIWiseSharedCourses.refresh();
          if (!current()) return;
          loadError = ''; sha = result.sha; loaded = true;
          const selection = document.getElementById('course-bachelor');
          const chosen = selection.value; selection.innerHTML = options(); selection.value = chosen;
          const latest = registered && registry.course(course.id);
          if (registered && !latest) { loaded = false; throw Error('This course is no longer registered. Your details are preserved.'); }
          if (latest && !dirty()) {
            document.getElementById('course-short').value = latest.short_name;
            document.getElementById('course-name').value = latest.name; initial = values();
          }
          message.textContent = 'Shared list loaded. Review your bachelor and course names before saving.';
        } catch (error) { if (current()) setError(error); }
        finally { if (current()) { refresh.disabled = false; save.disabled = !loaded; } }
      };
      activeForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (saving || !loaded) return;
        try {
          const input = Object.fromEntries(new FormData(activeForm));
          Object.keys(input).forEach(k => { input[k] = input[k].trim(); });
          input.bachelor = registered ? course.bachelor : input.bachelor;
          const invalid = (text, field) => { throw Object.assign(Error(text), {field}); };
          if (!registry.bachelors().some(b => b.id === input.bachelor)) invalid('Select the bachelor this course belongs to.', 'bachelor');
          if (!/^[a-z][a-z0-9-]{0,39}$/.test(input.id) || ['new','edit','common','constructor','prototype'].includes(input.id)) invalid('Course ID: use lowercase letters, numbers and hyphens, starting with a letter. Example: dpas-skills.', 'id');
          if (!input.short_name || input.short_name.length > 40 || /[\u0000-\u001f\u007f]/.test(input.short_name)) invalid('Enter a short name using 1–40 characters.', 'short_name');
          if (!input.full_name || input.full_name.length > 160 || /[\u0000-\u001f\u007f]/.test(input.full_name)) invalid('Enter a full course name using 1–160 characters.', 'name');
          if (read().raw !== snapshot) throw Error('Browser course information changed in another tab. Your inputs are preserved; copy them before reopening this form.');
          if (registered && input.id !== course.slug) throw Error('The course ID cannot be changed.');
          saving = true; save.disabled = true; refresh.disabled = true; activeForm.querySelectorAll('input').forEach(n => n.readOnly = true); document.getElementById('course-bachelor').disabled = true; message.textContent = 'Saving to the team course list…';
          const payload = {bachelor:input.bachelor, id:input.id, short_name:input.short_name, name:input.full_name};
          const result = await window.AIWiseSharedCourses.save(registered ? 'update' : 'create', payload, sha);
          if (!current()) return;
          const registeredId = input.bachelor + '.' + input.id;
          if (!isNew && !registered && read().raw === snapshot) {
            // Keep the original key byte-for-byte; hide only this exact, successfully registered copy.
            try {
              const migrated = JSON.parse(localStorage.getItem(MIGRATED) || '{}') || {};
              migrated[course.id] = {source:JSON.stringify(read().entries.find(c => c.id === course.id)), id:registeredId};
              localStorage.setItem(MIGRATED, JSON.stringify(migrated));
            } catch { /* Team save succeeded; a visible local backup is safe. */ }
          }
          saving = false; initial = values();
          const link = document.createElement('a'); link.className = 'button primary'; link.href = '#studio/' + input.bachelor; link.textContent = 'Open Content Studio';
          const hub = document.createElement('a'); hub.className = 'button'; hub.href = '#courses/' + registeredId; hub.textContent = 'Open course';
          activeForm.replaceChildren();
          const heading = document.createElement('h2'); heading.textContent = registered ? 'Shared names saved' : 'Course registered with team';
          const note = document.createElement('p'); note.textContent = 'This course is connected to its bachelor’s Content Studio. Beta module menus update after deployment. The student site changes only after a separate publish.';
          const actions = document.createElement('div'); actions.className = 'toolbar'; actions.append(link, hub); activeForm.append(heading, note, actions); initial = values();
          if (result.commit) { const commit = document.createElement('a'); commit.href = 'https://github.com/AIWise-EUR/AIWiseModule_Beta/commit/' + result.commit; commit.textContent = 'View saved change ↗'; commit.target = '_blank'; commit.rel = 'noopener noreferrer'; actions.append(commit); }
          window.dispatchEvent(new Event('aiwise:courses-changed'));
        } catch (error) { if (current()) setError(error); }
        finally { if (current()) { saving = false; save.disabled = !loaded; refresh.disabled = false; if (document.getElementById('course-bachelor')) { document.getElementById('course-bachelor').disabled = registered; activeForm.querySelectorAll('input').forEach(n => n.readOnly = registered && n.name === 'id'); } } }
      });
      refresh.click();
      return;
    }
    if (part) {
      const [id, view] = part.split('/');
      const c = all.find(c => c.id === id);
      if (!c || (view && view !== 'manager')) { missing(shell); return; }
      if (view === 'manager') {
        shell('courses', `${c.full_name} · Course Profiler Manager`, '<p>The teacher tool opens its current browser profile. It does not automatically load this course.</p>',
          `<div class="toolbar"><a class="button primary" href="course-profiler/">Open Course Profiler</a><a class="button" href="#courses/${c.id}">Back to course</a></div>` +
          (c.activities ? '<div class="cards"><a class="card link" href="#manager/prompts"><h3>Preset Prompts</h3><p>Academic Writing Skills I course and activity prompts.</p><span class="arrow">Read prompts →</span></a><a class="card link" href="#manager/activities"><h3>AI Activities</h3><p>The seven Academic Writing Skills I activity pages.</p><span class="arrow">View activities →</span></a></div>' : '<div class="empty-state"><h2>Course materials not connected</h2><p>This course does not yet have a connected profile, preset prompts, or activity package.</p></div>'), false);
        return;
      }
      const destination = (title, description, href, action) => `<div class="card"><h3>${title}</h3><p>${description}</p>${href ? `<a class="button" href="${href}">${action}</a>` : '<span class="badge">Setup needed</span>'}</div>`;
      shell('courses', c.full_name, `<p>${esc(c.full_name)} materials · Common Studio is shared across courses and shown in grayscale. Unconnected areas are labeled on the map.</p>`, `<div class="toolbar course-view-toolbar"><div class="view-switch" role="group" aria-label="Course view"><button id="course-map-view" type="button" aria-pressed="true">▦ Map</button><button id="course-list-view" type="button" aria-pressed="false">☷ List</button></div><a class="button" href="#courses/${c.id}/edit">${c.connected ? 'Edit course details' : 'Register with team'}</a><a class="button" href="#courses">All courses</a></div>` + courseMap(c) + `<div id="course-material-list" class="cards course-hub" hidden>` +
        destination('Course Profiler Manager', c.activities ? 'Review the course and activity prompts.' : 'A course profile and activity package still need to be connected.', `#courses/${c.id}/manager`, 'Open course materials') +
        destination('Content Studio', hasStudio(c) ? 'Edit the ' + esc(c.bachelor_name) + ' examples in AI Orientation. Every course of this bachelor shows them.' : 'The Orientation editor is not connected for this course yet.', hasStudio(c) ? studioHref(c) : '', 'Open editor') +
        destination('AI Activities', c.activities ? 'Inspect the seven existing activity pages.' : 'Activity pages still need to be connected.', c.activities ? '#manager/activities' : '', 'View activities') +
        destination('AI-Wise Beta', c.connected ? 'Preview this course in the current Beta module.' : 'A Beta module is not connected yet.', c.connected ? '#beta/' + c.id : '', 'Open Beta') +
        destination('Control Tower', 'The course request view is not connected yet.', '', '') +
        destination('AI-Wise Published', c.connected ? 'Open the student site.' : 'A student release is not connected for this course.', c.connected ? 'https://aiwise-eur.github.io/AI-Wise/' : '', 'Open student site') +
        destination('Common Studio', 'Shared content used across courses.', '#common', 'Open shared content') + '</div>', false);
      wireCourseViews();
      return;
    }
    shell(null, 'Courses', '<p>Team courses connect to their bachelor’s Content Studio. Browser-only entries need registration; their original copies are preserved.</p>', refreshToolbar() + '<div id="course-dashboard" class="cards course-dashboard">' + dashboardCards() + '</div>', false);
    mountRefresh(() => { document.getElementById('course-dashboard').innerHTML = dashboardCards(); });
  }
  function missing(shell) { shell(null, 'Course not found', '', '<p class="room-lead">This course is not in the loaded course list. Open All courses to refresh it.</p><a class="button" href="#courses">All courses</a>', false); }
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.AIWiseCourses = {ready, list, get, cards, addCard, render, canLeave, dispose, refreshToolbar, mountRefresh};
})();
