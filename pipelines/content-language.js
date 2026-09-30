/* Content language is independent of the Workspace interface and course. */
(() => {
  'use strict';
  const valid = value => ['en', 'nl'].includes(value);
  const current = () => new URL(location.href).searchParams.get('lang') === 'nl' ? 'nl' : 'en';
  const name = value => value === 'nl' ? 'Nederlands' : 'English';
  const url = (value, locale = current()) => {
    const next = new URL(value, location.href);
    if (locale === 'nl') next.searchParams.set('lang', 'nl'); else next.searchParams.delete('lang');
    return next.href;
  };
  const draftKey = (course, chapter, locale = 'en') =>
    (course === 'common' ? `aiwise_common_studio_${chapter}` : `aiwise_content_studio_${course}_${chapter}`) + (locale === 'nl' ? '_nl' : '') + '_v1';
  window.AIWiseLanguage = Object.freeze({valid, current, name, url, draftKey});
  if (document.currentScript?.hasAttribute('data-editor-only')) return;
  // Keep language on internal module links, including the nested system map.
  document.addEventListener('DOMContentLoaded', () => {
    if (current() !== 'nl') return;
    document.querySelectorAll('a[href],iframe[src]').forEach(node => {
      const attr = node.tagName === 'IFRAME' ? 'src' : 'href', raw = node.getAttribute(attr);
      if (!raw || raw.startsWith('#')) return;
      const next = new URL(raw, location.href);
      if (next.origin === location.origin && /\/common\/|\/course-specific\//.test(next.pathname)) node.setAttribute(attr, url(next.href));
    });
  }, {once:true});
})();
