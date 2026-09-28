/* Approved Beta content only. Pending submissions and review metadata are private. */
(() => {
  'use strict';
  async function read(course) {
    if (!['aws1','ped','common'].includes(course)) return [];
    const config = window.AIWiseSupabaseConfig;
    if (!config) throw Error('Beta content connection is unavailable.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const url = new URL('/rest/v1/workspace_beta_content', config.url);
      url.search = new URLSearchParams({select:'course,chapter,submission_id,slots,approved_at',course:'eq.'+course});
      const response = await fetch(url, {headers:{apikey:config.publishableKey},cache:'no-store',credentials:'omit',signal:controller.signal});
      if (!response.ok) throw Error('Approved Beta content could not be loaded. Please retry.');
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => row.course !== course || !(course === 'common' ? ['c1','c2','c3'] : ['c2','c3']).includes(row.chapter) || !row.slots || typeof row.slots !== 'object')) throw Error('Invalid approved content response.');
      return rows;
    } finally { clearTimeout(timer); }
  }
  function apply(data, rows) {
    const next = JSON.parse(JSON.stringify(data));
    for (const row of rows) for (const [path,value] of Object.entries(row.slots)) {
      const keys = path.split('.');
      if (keys[0] !== row.chapter || keys.some(k => !/^[a-z][a-z0-9_]*$/i.test(k) || ['__proto__','prototype','constructor'].includes(k))) throw Error('Invalid Beta content slot.');
      let target = next;
      keys.slice(0,-1).forEach(k => { if (!target[k] || typeof target[k] !== 'object') throw Error('Beta content no longer matches the module.'); target=target[k]; });
      if (!Object.hasOwn(target,keys.at(-1))) throw Error('Unknown Beta content slot.');
      target[keys.at(-1)] = JSON.parse(JSON.stringify(value));
    }
    return next;
  }
  window.AIWiseBetaContent = Object.freeze({read,apply});
})();
