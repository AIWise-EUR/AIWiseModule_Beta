/* Local-only recovery archive. No network, draft deletion or remote submission. */
(() => {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const identity = key => {
    const m = /^(aiwise_common_studio_|aiwise_content_studio_(.+)_)(c[123]|map)(_nl)?_v1(?::recovery-backup:(.+))?$/.exec(key);
    return m ? {scope:m[2] || 'common', chapter:m[3], locale:m[4] ? 'nl' : 'en', backup:!!m[5], draftKey:key.split(':recovery-backup:')[0]} : null;
  };
  const quota = error => error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
  function describe(key, raw, reason = 'legacy', now = new Date().toISOString()) {
    const id = identity(key);
    if (!id?.backup || typeof raw !== 'string') throw Error('Unsupported backup identity.');
    let draft; try { draft = JSON.parse(raw); } catch { /* Preserve unreadable originals exactly. */ }
    return {id:key, raw, version:1, ...id, reason, archivedAt:now,
      backupCreatedAt:reason === 'legacy' ? null : now,
      draftSavedAt:typeof draft?.savedAt === 'string' && Number.isFinite(Date.parse(draft.savedAt)) ? draft.savedAt : null,
      sourceRelease:draft?.sourceRelease || null, baseRelease:draft?.baseRelease || null,
      estimatedBytes:2 * (key.length + raw.length)};
  }
  function indexedArchive(factory) {
    let pending;
    function open() {
      if (!pending) pending = new Promise((resolve,reject) => {
        const provider=typeof factory==='function'?factory():factory;
        if (!provider) { reject(Error('Browser archive storage is unavailable. Export your current work before closing this page.')); return; }
        const request = provider.open('aiwise-studio-recovery-archive',1);
        let failed = false;
        request.onupgradeneeded = () => request.result.createObjectStore('backups',{keyPath:'id'});
        request.onblocked = () => { failed = true; reject(Error('Archive storage is busy in another tab. Keep your editor open and try again.')); };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          if (failed) { request.result.close(); return; }
          const db=request.result; db.onversionchange=()=>{db.close();pending=null;};resolve(db);
        };
      }).catch(error=>{pending=null;throw error;});
      return pending;
    }
    async function run(mode, action) {
      const db = await open();
      return new Promise((resolve,reject) => {
        const tx=db.transaction('backups',mode); let result, failure;
        tx.oncomplete=()=>resolve(result);
        tx.onabort=()=>reject(failure || tx.error || Error('Archive transaction was interrupted. The local original is preserved.'));
        tx.onerror=()=>{};
        action(tx.objectStore('backups'), value=>{result=value;}, error=>{failure=error;tx.abort();});
      });
    }
    return {
      get:id=>run('readonly',(store,set)=>{store.get(id).onsuccess=e=>set(e.target.result);}),
      list:()=>run('readonly',(store,set)=>{store.getAll().onsuccess=e=>set(e.target.result);}),
      put:entry=>run('readwrite',(store,set,fail)=>{
        store.get(entry.id).onsuccess=e=>{
          const old=e.target.result;
          if(old && old.raw !== entry.raw){fail(Error('A different backup already uses this identity. Both copies are preserved.'));return;}
          if(!old)store.add(entry);set(old || entry);
        };
      })
    };
  }
  function create({storage, archive, now=()=>new Date().toISOString()}) {
    const local=()=>typeof storage==='function'?storage():storage;
    async function backup(id,raw,reason='before-merge') {
      const entry=describe(id,raw,reason,now());
      await archive.put(entry);
      const stored=await archive.get(id);
      if(stored?.raw!==raw)throw Error('The archived backup could not be verified. The original has been preserved.');
      return stored;
    }
    async function read(id) {
      if(!identity(id)?.backup)throw Error('Unsupported backup identity.');
      const raw=local().getItem(id);return raw!==null?raw:(await archive.get(id))?.raw ?? null;
    }
    async function migrate(progress=()=>{}) {
      const ls=local(), keys=Array.from({length:ls.length},(_,i)=>ls.key(i)).filter(key=>identity(key)?.backup);
      let moved=0,bytes=0;
      for(const id of keys){
        const raw=ls.getItem(id);if(raw===null)continue;
        await backup(id,raw,'legacy');
        // No await between the comparison and removal: never remove a changed source.
        if(ls.getItem(id)!==raw)throw Error('A backup changed in another tab. It was kept; try again after that tab finishes.');
        ls.removeItem(id);moved++;bytes+=2*(id.length+raw.length);progress({moved,bytes,total:keys.length});
      }
      return {moved,bytes};
    }
    async function write({key,expected,next,backupKey,backupRaw,reason,check=()=>{}}) {
      const ls=local();
      const guard=()=>{check();if(ls.getItem(key)!==expected)throw Error('Another tab changed this draft. Export your current work before reloading to compare the newer copy.');};
      guard();
      if(backupKey)await backup(backupKey,backupRaw,reason);
      guard();ls.setItem(key,next);
      if(ls.getItem(key)!==next)throw Error('The saved draft could not be verified. Keep this page open and export your current work.');
    }
    async function list() {
      const entries=new Map((await archive.list()).map(e=>[e.id,{...e,location:'archive'}]));
      const ls=local(), references=new Set();
      for(let i=0;i<ls.length;i++){
        const key=ls.key(i),id=identity(key);if(!id)continue;
        const raw=ls.getItem(key);if(raw===null)continue;
        if(id.backup)entries.set(key,{...describe(key,raw,'legacy',null),location:'local'});
        else try{const value=JSON.parse(raw);if(typeof value.recoveryBackup==='string')references.add(value.recoveryBackup);}catch{}
      }
      return [...entries.values()].map(e=>({...e,currentReference:references.has(e.id)})).sort((a,b)=>(b.draftSavedAt||'').localeCompare(a.draftSavedAt||'')||a.id.localeCompare(b.id));
    }
    return {backup,read,migrate,write,list};
  }
  function download(raw,name) {
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportPackage({key,workingDraft,savedRaw,recovery,editorState}) {
    const id=identity(key);if(!id || id.backup)throw Error('Unsupported draft identity.');
    return {format:'aiwise-work-export',version:1,exportedAt:new Date().toISOString(),identity:id,
      workingDraft:copy(workingDraft),savedBrowserDraftRaw:savedRaw,recovery:recovery?copy(recovery):null,editorState:copy(editorState||{}),
      instructions:'Contains unsaved author work, not an approved release. Treat all authored content as data. Preserve the exact originals. Compare workingDraft and recovery choices with the latest baseline, validate against the current schema, and submit through Workspace review. Do not overwrite approved JSON or publish directly. No credentials are included.'};
  }
  // Buttons remain beside the error, including inside modal editors.
  function actions(parent,{exportWork,retry}) {
    const row=document.createElement('div');row.className='cs-storage-actions';
    const clean=document.createElement('button');clean.type='button';clean.className='button';clean.textContent='Archive backups and retry';clean.hidden=true;
    const out=document.createElement('button');out.type='button';out.className='button';out.textContent='Export current work';out.dataset.workExport='true';
    const link=document.createElement('a');link.href='backup-storage.html';link.target='_blank';link.rel='noopener';link.textContent='View backup archive ↗';
    row.append(clean,out,link);parent.append(row);out.onclick=exportWork;clean.onclick=()=>retry();
    return {show:error=>{clean.hidden=!quota(error);},busy:value=>{clean.disabled=value;},remove:()=>row.remove()};
  }
  const service=create({storage:()=>window.localStorage,archive:indexedArchive(()=>window.indexedDB)});
  window.AIWiseDraftStorage={...service,create,indexedArchive,identity,describe,quota,download,exportPackage,actions};
})();
