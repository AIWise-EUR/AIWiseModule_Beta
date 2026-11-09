(() => {
  'use strict';
  const api=window.AIWiseDraftStorage,q=selector=>document.querySelector(selector);
  let entries=[],busy=false;
  const names={common:'Common',psychology:'Psychology','pedagogical-sciences':'Pedagogical Sciences',dpas:'DPAS'};
  const date=value=>value?new Date(value).toLocaleString():'Not recorded';
  const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  function status(text,error=false){q('#status').textContent=text;q('#status').dataset.error=String(error);}
  function lock(value){busy=value;q('#archive').disabled=value;q('#refresh').disabled=value;}
  function draw(){
    const list=q('#list');list.replaceChildren();const query=q('#filter').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered=entries.filter(e=>query.every(term=>[names[e.scope]||e.scope,e.chapter,e.locale,e.locale==='nl'?'Nederlands Dutch':'English',e.id].join(' ').toLowerCase().includes(term)));
    for(const e of filtered){
      const row=el('article','');row.append(el('h2',`${names[e.scope]||e.scope} · ${e.chapter.toUpperCase()} · ${e.locale==='nl'?'Nederlands':'English'}`));
      row.append(el('p',`${e.location==='archive'?'Archived':'In local storage'}${e.currentReference?' · Original backup linked to a current draft':''}`));
      row.append(el('small',`Draft saved: ${date(e.draftSavedAt)} · Archived: ${date(e.archivedAt)}`));
      row.append(el('small',`Backup created: ${date(e.backupCreatedAt)} · ${e.reason==='legacy'?'Legacy backup; reason not recorded':e.reason==='before-merge'?'Before draft merge':'Before layout synchronization'}`));
      row.append(el('small',`Approximate text size: ${(e.estimatedBytes/1024).toFixed(1)} KiB`));
      const details=el('details','');details.append(el('summary','Preview exact backup and identifier'),el('small',e.id),el('pre',e.raw));row.append(details);
      const button=el('button','Download backup');button.type='button';button.onclick=()=>api.download(e.raw,`aiwise-${e.scope}-${e.chapter}-${e.locale}-backup-${e.id.split(':').at(-1)}.json`);row.append(button);list.append(row);
    }
    if(!filtered.length)list.append(el('p','No matching backups found in this browser.'));
  }
  async function refresh(){entries=await api.list();draw();}
  q('#filter').oninput=draw;
  q('#refresh').onclick=async()=>{if(busy)return;lock(true);try{await refresh();status(`${entries.length} backup(s) found. Current drafts are kept separately.`);}catch(e){status(e.message,true);}finally{lock(false);}};
  q('#archive').onclick=async()=>{
    if(busy)return;lock(true);
    try{
      const result=await api.migrate(({moved,total})=>status(`Archiving backups… ${moved} of ${total}. Keep this page open.`));
      await refresh();
      status(`${result.moved} backup(s) archived; approximately ${(result.bytes/1024/1024).toFixed(2)} MiB of text storage freed. Return to your original editing tab and retry the failed action. If it still fails, export your current work. No current draft was removed.`);
    }catch(e){status(`Archiving stopped: ${e.message} Verified copies are retained. Unmoved originals remain in local storage. Keep your editor open.`,true);}
    finally{lock(false);}
  };
  window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
})();
