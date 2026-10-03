/* Approved Beta content only. Pending submissions and review metadata are private.
   Content is stored per scope: "common", or a bachelor id from common/courses/registry.json. */
(() => {
  'use strict';
  const script=typeof document==='undefined'?null:document.currentScript?.src;
  const archiveRoot=script?new URL('../content/approved/',script):null;
  async function deployedCopy(course,locale) {
    if(!archiveRoot)throw Error('No deployed content copy is available.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try {
      const chapters=course==='common'?['c1','c2','c3','map']:['c2','c3'];
      const rows=await Promise.all(chapters.map(async chapter=>{
        const response=await fetch(new URL(`${locale}/${course}/${chapter}.json`,archiveRoot),{cache:'no-store',credentials:'omit',signal:controller.signal});
        if(response.status===404)return null;
        if(!response.ok)throw Error('Deployed content could not be loaded.');
        const row=await response.json();
        if(row.schema!==1||row.course!==course||row.chapter!==chapter||row.locale!==locale||!Number.isSafeInteger(row.sequence)||row.sequence<1||
          !/^[a-f0-9-]{36}$/.test(row.submission_id||'')||!row.slots||typeof row.slots!=='object'||Array.isArray(row.slots))throw Error('Invalid deployed content.');
        return row;
      }));
      const found=rows.filter(Boolean);
      if(!found.length)throw Error('No deployed content copy is available.');
      if(document.body&&!document.querySelector('[data-deployed-copy-notice]')){
        const note=document.createElement('p');note.dataset.deployedCopyNotice='';note.dataset.languageNotice='';note.setAttribute('role','status');
        note.textContent='Live content is temporarily unavailable. Showing the last deployed approved content.';
        note.style.cssText='padding:12px;background:#fff3e8;color:#682b1b;margin:0';(document.querySelector('main')||document.body).prepend(note);
      }
      return found;
    }finally{clearTimeout(timer);}
  }
  async function read(course, locale = 'en', sources = false) {
    if (!['en','nl'].includes(locale)) throw Error('Unsupported content language.');
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(course)) return [];
    // Saved review copies are read only through the signed-in parent Workspace.
    let context=window, version=null;
    try {
      while(context.parent&&context!==context.parent) {
        version=version||new URL(context.location.href).searchParams.get('review_version');
        context=context.parent;
        if(version&&context.AIWiseBetaSpace)return context.AIWiseBetaSpace.snapshot(version,course,locale);
      }
      version=version||new URL(window.location?.href||'https://example.invalid/').searchParams.get('review_version');
    } catch {if(version)throw Error('This review version is not available.');}
    if(version)throw Error('Open this review version from the Workspace.');
    const config = window.AIWiseSupabaseConfig;
    if (!config) throw Error('Beta content connection is unavailable.');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
    try {
      const url = new URL('/rest/v1/'+(sources?'workspace_content_sources':'workspace_beta_content'), config.url);
      url.search = new URLSearchParams({select:sources?'course,chapter,locale,slots':'course,chapter,locale,submission_id,source_release,slots,approved_at',course:'eq.'+course,locale:'eq.'+locale});
      let response;
      try {
        response = await fetch(url, {headers:{apikey:config.publishableKey},cache:'no-store',credentials:'omit',signal:controller.signal});
        if (!response.ok) throw Error('Approved Beta content could not be loaded. Please retry.');
      }catch(error){
        // Source baselines remain database-only. Saved versions returned above never fall back to a live/deployed copy.
        if(sources)throw error;
        try{return await deployedCopy(course,locale);}catch{throw error;}
      }
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.some(row => row.course !== course || row.locale !== locale || !(course === 'common' ? ['c1','c2','c3','map'] : ['c2','c3']).includes(row.chapter) || !row.slots || typeof row.slots !== 'object')) throw Error('Invalid approved content response.');
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
  window.AIWiseBetaContent = Object.freeze({read,apply,sources:(course,locale)=>read(course,locale,true)});
})();
