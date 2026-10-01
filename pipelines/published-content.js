/* Published uses one frozen release. No live Beta or Supabase requests. */
(() => {
 'use strict';
 const url=new URL('published-content.json',document.currentScript.src);
 url.search=new URL(document.currentScript.src).search;
 let pending;
 function release(){
  if(!pending)pending=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
   try{const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Published content is unavailable.');
    const data=await response.json();if(data.schema!==1||!Array.isArray(data.content)||!data.courses||!Array.isArray(data.manifest))throw Error('Invalid published release.');
    const expected=document.documentElement.dataset.publishedRelease;if(expected&&data.release_id!==expected)throw Error('The release is updating. Reload to try again.');return data;
   }finally{clearTimeout(timer);}
  })().catch(e=>{pending=null;throw e;});return pending;
 }
 async function read(course,locale='en'){
  if(!['common','aws1','ped','other'].includes(course)||!['en','nl'].includes(locale))throw Error('Unsupported content.');
  const data=await release(),rows=data.content.filter(r=>r.course===course&&r.locale===locale);
  if(locale==='nl')for(const en of data.content.filter(r=>r.course===course&&r.locale==='en'))if(!rows.some(r=>r.chapter===en.chapter))rows.push({...en,locale:'nl',fallback_locale:'en'});
  return structuredClone(rows);
 }
 function apply(data,rows){
  const copy=structuredClone(data);
  for(const row of rows)for(const [key,value]of Object.entries(row.slots)){
   const parts=key.split('.');if(parts[0]!==row.chapter||parts.some(p=>!/^\w+$/.test(p)||['__proto__','constructor','prototype'].includes(p)))throw Error('Invalid published slot.');
   let target=copy;for(const part of parts.slice(0,-1)){if(!target[part]||typeof target[part]!=='object')throw Error('Content structure mismatch.');target=target[part];}
   if(!Object.hasOwn(target,parts.at(-1)))throw Error('Unknown content slot.');target[parts.at(-1)]=structuredClone(value);
  }return copy;
 }
 window.AIWisePublished=Object.freeze({course:async id=>{const data=await release();if(!Object.hasOwn(data.courses,id))throw Error('Unknown course.');return structuredClone(data.courses[id]);},manifest:async()=>structuredClone((await release()).manifest)});
 window.AIWiseBetaContent=Object.freeze({read,apply});
})();
