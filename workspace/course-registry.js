/* Bachelor – course registry for the workspace. Source: common/courses/registry.json.
   A course is addressed as "<bachelor>.<course>". Approved examples are stored per scope:
   "common", or a bachelor id shared by all of that bachelor's courses. */
(() => {
  'use strict';
  const ID = /^[a-z][a-z0-9-]{0,39}$/;
  let bachelors = [], courses = [], problem = 'The course list has not loaded yet.';
  const text = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160;
  function use(raw) {
    const names = new Map(), keys = new Set(), aliases = new Set();
    if (raw?.schema !== 1 || !Array.isArray(raw.bachelors) || !raw.bachelors.length || !Array.isArray(raw.courses) || !raw.courses.length) throw Error('Invalid course registry.');
    for (const b of raw.bachelors) {
      if (!ID.test(b?.id || '') || b.id === 'common' || names.has(b.id) || !text(b.name) || !text(b.content)) throw Error('Invalid course registry.');
      names.set(b.id, {id: b.id, name: b.name, content: b.content, aliases: [...(b.aliases || [])]});
    }
    const list = raw.courses.map(c => {
      const b = names.get(c?.bachelor), id = c?.bachelor + '.' + c?.id, alias = c?.aliases || [];
      if (!b || !ID.test(c.id || '') || keys.has(id) || !text(c.name) || !text(c.short_name) || !Array.isArray(alias) || alias.some(a => !ID.test(a || '') || aliases.has(a))) throw Error('Invalid course registry.');
      keys.add(id); alias.forEach(a => aliases.add(a));
      return {id, bachelor: b.id, bachelor_name: b.name, slug: c.id, name: c.name, short_name: c.short_name,
        full_name: b.name + ' – ' + c.name, path: b.id + '/' + c.id + '/', activities: c.activities || '', aliases: [...alias]};
    });
    bachelors = [...names.values()]; courses = list; problem = '';
  }
  const copy = value => JSON.parse(JSON.stringify(value));
  const course = id => copy(courses.find(c => c.id === id) || courses.find(c => c.aliases.includes(id)) || null);
  // Versions saved before the bachelor structure name their scopes "aws1" and "ped".
  const scope = id => id === 'common' ? 'common' : (bachelors.find(b => b.id === id) || bachelors.find(b => b.aliases.includes(id)))?.id || null;
  const scopeName = id => id === 'common' ? 'Common' : bachelors.find(b => b.id === scope(id))?.name || String(id ?? '');
  const coursesOf = id => copy(courses.filter(c => c.bachelor === scope(id)));
  // The page used to show a scope's content: its first course, or the first course overall for Common.
  const previewCourse = id => (courses.find(c => c.bachelor === scope(id)) || courses[0])?.id || '';
  const source = typeof document === 'undefined' ? null : document.currentScript?.src;
  const ready = !source ? Promise.resolve() : fetch(new URL('../common/courses/registry.json', source), {cache: 'no-cache'})
    .then(response => { if (!response.ok) throw Error(); return response.json(); }).then(use)
    .catch(() => { problem = 'The course list could not be loaded. Reload the page to try again.'; });
  window.AIWiseCourseRegistry = Object.freeze({ready, use, error: () => problem, bachelors: () => copy(bachelors), courses: () => copy(courses),
    course, scope, scopeName, coursesOf, previewCourse});
})();
