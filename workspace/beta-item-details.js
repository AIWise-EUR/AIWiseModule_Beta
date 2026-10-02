/* Read-only item history. Shared review decisions stay in the review panel. */
(() => {
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const labels={title:'Title',thinking:'Student thinking',typing:'Prompt',typing_note:'Prompt note',processing:'How the model processes this',body:'Text',text:'Text',heading:'Heading',intro:'Introduction',good:'Suggested example',bad:'Original example'};
 const label=part=>typeof part==='number'?`Example ${part+1}`:labels[part]||String(part).replace(/[_.-]+/g,' ').replace(/^\w/,c=>c.toUpperCase());
 function changes(before,after,path=[]){
  if(stable(before)===stable(after))return [];
  const object=v=>v!==null&&typeof v==='object';
  if((object(before)||before===undefined)&&(object(after)||after===undefined)){
   const keys=[...new Set([...Object.keys(before||{}),...Object.keys(after||{})])];
   if(keys.length)return keys.flatMap(k=>changes(before?.[k],after?.[k],[...path,(Array.isArray(before)||Array.isArray(after))&&/^\d+$/.test(k)?Number(k):k]));
  }
  return [{label:path.map(label).join(' · ')||'Text',before,after}];
 }
 const text=v=>v===undefined||v===null?'Not included':typeof v==='object'?JSON.stringify(v):String(v);
 function comparison(rows,compact=false){return rows.map(r=>{const pair=compact?excerpts(text(r.before),text(r.after)):[text(r.before),text(r.after)];return `<article class="bi-change"><h4>${esc(r.label)}</h4><div class="bi-pair"><div><span>Before</span><p>${esc(pair[0])}</p></div><div><span>After</span><p>${esc(pair[1])}</p></div></div></article>`;}).join('');}
 function excerpts(before,after){let shared=0;while(shared<Math.min(before.length,after.length)&&before[shared]===after[shared])shared++;const start=Math.max(0,shared-45);return [before,after].map(v=>v.length<=170?v:(start?'…':'')+v.slice(start,start+167)+(v.length>start+167?'…':''));}
 const date=v=>v&&!Number.isNaN(new Date(v).getTime())?new Date(v).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Date unavailable';
 function open({item,locale,version,baseline,rolling,page,all,valid,ensureCurrent=async()=>{}}){
  const dialog=document.createElement('dialog'),returnTo=document.activeElement;let live=true,unsubscribe;
  const active=()=>live&&valid();
  dialog.className='bi-dialog';dialog.setAttribute('aria-labelledby','bi-title');
  dialog.innerHTML=`<header class="bi-header"><div><p>Item details</p><h2 id="bi-title">${esc(item.title)}</h2><p>${esc(item.course==='common'?'Common Studio':{aws1:'Academic Writing Skills I',ped:'Pedagogical Sciences',other:'Others'}[item.course]||item.course)} · ${esc(item.chapter.toUpperCase())} · ${esc(locale.toUpperCase())}</p></div><button class="button" type="button" data-bi-close>Close</button></header><div class="bi-body"><p class="bi-intro">Version-by-version changes and feedback, up to the version you are viewing. Only changed fields are shown.</p><p role="status" data-bi-status>Loading history…</p><div data-bi-timeline></div><button class="button" type="button" data-bi-retry hidden>Retry</button></div>`;
  document.body.append(dialog);
  function close(){if(!live)return;live=false;unsubscribe?.();window.AIWiseMotion?.cancel(dialog);dialog.close();dialog.remove();if(returnTo?.isConnected)returnTo.focus({preventScroll:true});}
  dialog.querySelector('[data-bi-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
  unsubscribe=window.AIWiseAuth.subscribe?.(()=>{if(!valid())close();});dialog.showModal();window.AIWiseMotion?.enter(dialog,'dialog');dialog.querySelector('[data-bi-close]').focus();
  const status=dialog.querySelector('[data-bi-status]'),timeline=dialog.querySelector('[data-bi-timeline]'),retry=dialog.querySelector('[data-bi-retry]');
  function memoCard(m,replies){return `<article class="bi-memo"><div><strong>${esc(m.author_name)}</strong><span>${m.resolved?'Resolved':'Open'}</span></div><time>${esc(date(m.created_at))}</time>${m.item_key?'':'<small>Earlier location reference — check the original quote.</small>'}<blockquote>${esc(m.anchor.quote||m.anchor.excerpt)}</blockquote><p>${esc(m.body)}</p>${replies.filter(r=>r.memo_id===m.id).map(r=>`<div class="bi-reply"><strong>${esc(r.author_name)}</strong><time>${esc(date(r.created_at))}</time><p>${esc(r.body)}</p></div>`).join('')}<a class="button" href="#beta/${m.version_id||'current'}?page=${encodeURIComponent(m.page)}&memo=${m.id}">Open conversation →</a></article>`;}
  async function load(){retry.hidden=true;status.textContent='Loading history…';
   try{
    await ensureCurrent();if(!active())return;
    const saved=await all(b=>{let q=b.from('workspace_beta_versions').select('id,number,created_at,published_at,author_name,content').order('number',{ascending:false});return rolling?q:q.lt('number',version.number);});if(!active())return;
    const versions=[version,...saved],ids=new Set(versions.map(v=>v.id||null));
    const [linked,legacy]=await Promise.all([
     all(b=>b.from('workspace_beta_memos').select('*').eq('content_course',item.course).eq('content_chapter',item.chapter).eq('content_locale',locale).eq('item_key',item.key).order('created_at',{ascending:true}).order('id')),
     item.path?all(b=>b.from('workspace_beta_memos').select('*').eq('page',page).is('item_key',null).order('created_at',{ascending:true}).order('id')):[]
    ]);if(!active())return;
    const memos=[...new Map([...linked,...legacy.filter(m=>window.AIWiseBetaHistory.atLocation(m.anchor,item.path))].filter(m=>ids.has(m.version_id||null)).map(m=>[m.id,m])).values()],replies=[];
    for(let i=0;i<memos.length;i+=100)replies.push(...await all(b=>b.from('workspace_beta_replies').select('*').in('memo_id',memos.slice(i,i+100).map(m=>m.id)).order('created_at').order('id')));
    await ensureCurrent();if(!active())return;
    const get=v=>v?window.AIWiseBetaHistory.value(v,item,locale):{content:undefined,locale};
    timeline.innerHTML=versions.map((v,i)=>{
     const previous=i===0?baseline:versions[i+1],current=get(v),before=get(previous),delta=changes(before.content,current.content),notes=memos.filter(m=>(m.version_id||null)===(v.id||null));
     const name=v.id?'V'+v.number:'Next publication',against=previous?'Compared with V'+previous.number:'First included content';
     const summary=delta.length?`${delta.length} changed ${delta.length===1?'field':'fields'}`:'No content changes';
     return `<details class="bi-version" ${i===0?'open':''}><summary><span><strong>${esc(name)}</strong><time>${v.id?esc(date(v.created_at)):'Unpublished'}</time></span><span>${summary} · ${notes.length} ${notes.length===1?'memo':'memos'}</span></summary><div class="bi-version-content"><p class="bi-version-meta">${esc(against)}${v.author_name?' · Saved by '+esc(v.author_name):''}${v.id?' · '+(v.published_at?'Published':'Review snapshot'):''}</p>${current.locale!==locale?'<p>English fallback is shown for this version.</p>':''}${!delta.length&&current.locale!==before.locale?'<p>The language source changed; the text is unchanged.</p>':''}${delta.length?comparison(delta):'<p class="bi-empty">No text changes for this item.</p>'}<section class="bi-comments"><h3>Comments &amp; replies</h3>${notes.map(m=>memoCard(m,replies)).join('')||'<p class="bi-empty">No recorded feedback for this item in this version.</p>'}</section></div></details>`;
    }).join('');
    timeline.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
    status.textContent=`${versions.length} ${versions.length===1?'version':'versions'} · ${memos.length} ${memos.length===1?'memo':'memos'} · ${replies.length} ${replies.length===1?'reply':'replies'}`;
   }catch(e){if(active()){status.textContent=e.message;retry.hidden=false;}}
  }
  retry.onclick=load;load();return close;
 }
 window.AIWiseBetaItemDetails=Object.freeze({changes,comparison,open});
})();
