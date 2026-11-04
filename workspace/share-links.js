/* Read-only shortcuts to the fixed student home links. No draft or release writes. */
(() => {
  'use strict';
  const registry = window.AIWiseCourseRegistry;
  const mounts = [...document.querySelectorAll('.share-links')];
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  for (const mount of mounts) mount.innerHTML = '<h2>Share links</h2><p class="share-link-status" role="status">Loading courses…</p>';
  registry.ready.then(() => {
    for (const mount of mounts) {
      const status = mount.querySelector('[role="status"]');
      if (registry.error()) { status.textContent = registry.error(); continue; }
      status.textContent = 'New courses must be published before sharing their student links.';
      for (const course of registry.courses()) {
        const group = document.createElement('div');
        group.className = 'share-link-course';
        group.innerHTML = `<h3 title="${escape(course.full_name)}">${escape(course.short_name)}</h3><small>${escape(course.bachelor_name)}</small>`;
        for (const [locale, language] of [['en', 'English'], ['nl', 'Nederlands']]) {
          const url = new URL('https://aiwise-eur.github.io/AI-Wise/lobby.html');
          url.searchParams.set('course', course.id);
          url.searchParams.set('fixed', '1');
          url.searchParams.set('lang', locale);
          const row = document.createElement('div');
          row.className = 'share-link-row';
          row.innerHTML = `<a href="${escape(url.href)}" target="_blank" rel="noopener" hreflang="${locale}" aria-label="Open ${escape(course.full_name)} — ${language}">${language} ↗</a><button class="button" type="button" aria-label="Copy ${escape(course.full_name)} — ${language} link">Copy</button>`;
          const button = row.querySelector('button');
          let reset;
          button.addEventListener('click', async () => {
            button.disabled = true;
            clearTimeout(reset);
            try {
              await navigator.clipboard.writeText(url.href);
              button.textContent = 'Copied';
              status.textContent = `${course.short_name} — ${language} link copied.`;
              mount.querySelector('.share-link-manual')?.remove();
              reset = setTimeout(() => { button.textContent = 'Copy'; }, 2000);
            } catch (_) {
              button.textContent = 'Copy';
              status.textContent = `Copy is unavailable. Select and copy the ${course.short_name} — ${language} link:`;
              let input = mount.querySelector('.share-link-manual');
              if (!input) {
                input = document.createElement('input');
                input.className = 'share-link-manual';
                input.readOnly = true;
                input.setAttribute('aria-label', 'Share link to copy manually');
                mount.append(input);
              }
              input.value = url.href;
              input.focus(); input.select();
            } finally { button.disabled = false; }
          });
          group.append(row);
        }
        mount.insertBefore(group, status);
      }
    }
  });
})();
