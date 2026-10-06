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
  // Fixed share links are URL-scoped: no preference or account storage is changed.
  const params = new URL(location.href).searchParams;
  const fixed = document.documentElement.getAttribute('data-force-course') || (params.get('fixed') === '1' ? params.get('course') || '__missing_course__' : '');
  const script = new URL(document.currentScript.src, location.href);
  const published = script.pathname.endsWith('/published-content-language.js');
  const root = new URL(published ? './' : '../', script);
  const common = published ? '' : 'common/';
  const activityNames = ['sub-lobby','diagnostic-questionnaire-final','aws-i-materials','exploring-topic','searching-literature','organizing-literature','research-question','draft-outline','writing-sections','finalizing-paper'];
  const moduleNames = ['lobby','aiwise-c1-final','aiwise-c2-final','aiwise-c3-final','aiwise-c1-anatomy-2d'];
  const aws = ['psychology.aws1','aws1','other'].includes(fixed);
  function kind(next) {
    if (next.origin !== root.origin || !next.pathname.startsWith(root.pathname)) return '';
    const path = next.pathname.slice(root.pathname.length);
    if (moduleNames.some(n => path === common + n + '.html')) return 'common';
    if (activityNames.some(n => path === (published ? '' : 'course-specific/aws1/') + n + '.html')) return 'activity';
    return '';
  }
  function pin(value) {
    if (!fixed) return value;
    const next = new URL(value, location.href), type = kind(next);
    if (!type) return value;
    // AWS activities belong to that course; other fixed links return to their module.
    if (type === 'activity' && !aws) {
      next.pathname = root.pathname + common + 'aiwise-c1-final.html';
      next.search = ''; next.hash = '';
    }
    next.searchParams.set('course', fixed); next.searchParams.set('fixed', '1');
    if (current() === 'nl') next.searchParams.set('lang', 'nl');
    return next.href;
  }
  window.AIWiseCourseLink = Object.freeze({fixed, pin});
  if (fixed) {
    const update = node => {
      const attr = node.tagName === 'IFRAME' ? 'src' : 'href', raw = node.getAttribute(attr);
      if (!raw || raw.startsWith('#')) return;
      if (!aws && node.tagName === 'A' && kind(new URL(raw, location.href)) === 'activity') {
        node.hidden = true; node.style.display = 'none';
        const caption = node.previousElementSibling;
        if (node.closest('.next-bar') && caption?.classList.contains('next-bar-text')) { caption.hidden = true; caption.style.display = 'none'; }
      }
      node.setAttribute(attr, pin(raw));
    };
    const apply = () => {
      document.querySelectorAll('a[href],iframe[src]').forEach(update);
      if (!aws) document.querySelectorAll('[data-course-activity="psychology.aws1"]').forEach(node => { node.hidden = true; node.style.display = 'none'; });
      // Late-added links also need a fixed href for middle-click and Copy link.
      if (typeof MutationObserver !== 'undefined') new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches('a[href],iframe[src]')) update(node);
          node.querySelectorAll('a[href],iframe[src]').forEach(update);
        }
      }).observe(document.body, {childList:true, subtree:true});
    };
    document.addEventListener('DOMContentLoaded', apply, {once:true});
    // Shared navigation can add links after the initial document load.
    document.addEventListener('click', event => { const link = event.target?.closest?.('a[href]'); if (link) update(link); }, true);
    if (kind(new URL(location.href)) === 'activity' && !aws) location.replace(pin(location.href));
  }
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
