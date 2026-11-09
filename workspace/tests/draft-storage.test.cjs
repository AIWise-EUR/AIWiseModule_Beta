const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..'),key='aiwise_content_studio_psychology_c2_nl_v1',bk=key+':recovery-backup:original';
function setup(){const {window}=parseHTML('<html><body><main></main></body></html>');const context={window,document:window.document,URL,Blob,setTimeout};for(const file of ['draft-storage.js','draft-recovery.js'])vm.runInNewContext(fs.readFileSync(path.join(root,'workspace',file),'utf8'),context);return {api:window.AIWiseDraftStorage,R:window.AIWiseDraftRecovery,window,document:window.document};}
const plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){const {api,...rest}=setup(),local=new Map(),archived=new Map();let limit=Infinity;
 const storage={get length(){return local.size;},key:i=>[...local.keys()][i],getItem:k=>local.get(k)??null,removeItem:k=>local.delete(k),setItem(k,v){const next=new Map(local);next.set(k,v);if([...next].reduce((n,[k,v])=>n+k.length+v.length,0)>limit)throw new DOMException('quota','QuotaExceededError');local.set(k,v);}};
 const archive={async put(e){const old=archived.get(e.id);if(old&&old.raw!==e.raw)throw Error('identity conflict');if(!old)archived.set(e.id,plain(e));},async get(k){const e=archived.get(k);return e&&plain(e);},async list(){return [...archived.values()].map(plain);}};
 const service=api.create({storage,archive,now:()=> '2026-11-09T00:00:00Z'});
 return {api,...rest,local,archived,storage,archive,service,setLimit:n=>limit=n};}
test('scope labels cover actual Common/map and bachelor keys, unknown dates stay unknown',()=>{
 const {api}=setup();for(const [k,scope,chapter,locale]of [[key,'psychology','c2','nl'],['aiwise_common_studio_c1_v1','common','c1','en'],['aiwise_common_studio_map_nl_v1','common','map','nl'],['aiwise_content_studio_pedagogical-sciences_c3_v1','pedagogical-sciences','c3','en'],['aiwise_content_studio_dpas_c2_v1','dpas','c2','en']]){
  const e=api.describe(k+':recovery-backup:a','{broken','legacy','2026-11-09T00:00:00Z');assert.equal(e.scope,scope);assert.equal(e.chapter,chapter);assert.equal(e.locale,locale);assert.equal(e.backupCreatedAt,null);assert.equal(e.draftSavedAt,null);assert.equal(e.raw,'{broken');}
 assert.equal(api.identity('unrelated:key'),null);
});
test('full local storage -> verified migration -> retry saves exact unsaved content; settings/current draft retained',async()=>{
 const f=fixture();f.storage.setItem(key,'original');f.storage.setItem(bk,'x'.repeat(5000));f.storage.setItem('settings','keep');f.setLimit(6000);
 const next=JSON.stringify({text:'최신 미저장 Dutch wijziging',padding:'y'.repeat(2000)});
 await assert.rejects(f.service.write({key,expected:'original',next}),{name:'QuotaExceededError'});
 const result=await f.service.migrate();assert.equal(result.moved,1);assert.equal(f.storage.getItem(key),'original');assert.equal(f.storage.getItem('settings'),'keep');assert.equal(f.archived.get(bk).raw,'x'.repeat(5000));
 await f.service.write({key,expected:'original',next});assert.equal(f.storage.getItem(key),next);
});
test('new backup saved and verified before replacing current draft; retries reuse immutable identity',async()=>{
 const f=fixture();f.storage.setItem(key,'original');f.setLimit(500);
 await assert.rejects(f.service.write({key,expected:'original',next:'x'.repeat(1000),backupKey:bk,backupRaw:'original',reason:'before-merge'}));
 assert.equal(f.storage.getItem(key),'original');assert.equal(f.archived.get(bk).raw,'original');assert.equal(f.storage.getItem(bk),null);
 await f.service.write({key,expected:'original',next:'merged',backupKey:bk,backupRaw:'original',reason:'before-merge'});assert.equal(f.archived.size,1);assert.equal(await f.service.read(bk),'original');assert.equal(f.storage.getItem(key),'merged');
});
test('archive write rejection and readback mismatch never remove local originals or replace drafts',async()=>{
 for(const mode of ['reject','mismatch']){const f=fixture();f.storage.setItem(key,'original');f.storage.setItem(bk,'original');
  if(mode==='reject')f.archive.put=async()=>{throw new DOMException('archive full','QuotaExceededError');};else f.archive.get=async()=>({raw:'wrong'});
  await assert.rejects(f.service.migrate());assert.equal(f.storage.getItem(bk),'original');
  await assert.rejects(f.service.write({key,expected:'original',next:'edited',backupKey:bk,backupRaw:'original'}));assert.equal(f.storage.getItem(key),'original');}
});
test('committed archive copy survives interruption before local removal and next migration is idempotent',async()=>{
 const f=fixture();f.storage.setItem(bk,'original');const get=f.archive.get;f.archive.get=async()=>{throw Error('connection interrupted');};
 await assert.rejects(f.service.migrate());assert.equal(f.archived.get(bk).raw,'original');assert.equal(f.storage.getItem(bk),'original');
 f.archive.get=get;assert.equal((await f.service.migrate()).moved,1);assert.equal((await f.service.migrate()).moved,0);assert.equal(f.archived.size,1);
});
test('changes by another tab during archive await stop deletion and replacement',async()=>{
 const f=fixture();f.storage.setItem(key,'original');f.storage.setItem(bk,'original');const put=f.archive.put;
 f.archive.put=async e=>{await put(e);f.storage.setItem(bk,'other backup');};await assert.rejects(f.service.migrate(),/changed/);assert.equal(f.storage.getItem(bk),'other backup');
 f.archive.put=async e=>{await put(e);f.storage.setItem(key,'other draft');};await assert.rejects(f.service.write({key,expected:'original',next:'mine',backupKey:bk,backupRaw:'original'}),/Another tab/);assert.equal(f.storage.getItem(key),'other draft');
});
test('same identifier with different raw content stops migration without replacing either copy',async()=>{
 const f=fixture();f.storage.setItem(bk,'local');f.archived.set(bk,{id:bk,raw:'archived'});await assert.rejects(f.service.migrate(),/identity/);assert.equal(f.storage.getItem(bk),'local');assert.equal(f.archived.get(bk).raw,'archived');
});
test('no backup or oversized current draft remains a safe failure rather than clearing unrelated data',async()=>{
 const f=fixture();f.storage.setItem(key,'original');f.storage.setItem('settings','x'.repeat(1000));f.setLimit(1500);assert.equal((await f.service.migrate()).moved,0);
 await assert.rejects(f.service.write({key,expected:'original',next:'x'.repeat(2000)}));assert.equal(f.storage.getItem(key),'original');assert.equal(f.storage.getItem('settings').length,1000);
});
test('archive list preserves labels and current references and read supports both storage locations',async()=>{
 const f=fixture(),raw=JSON.stringify({savedAt:'2026-11-08T19:07:36Z',text:'é 한글'});f.storage.setItem(key,JSON.stringify({recoveryBackup:bk}));f.storage.setItem(bk,raw);
 assert.equal(await f.service.read(bk),raw);await f.service.migrate();const [e]=await f.service.list();assert.equal(e.currentReference,true);assert.equal(e.location,'archive');assert.equal(e.draftSavedAt,'2026-11-08T19:07:36Z');assert.equal(await f.service.read(bk),raw);
});
test('export requires no storage and preserves unsaved rich text, original raw, baseline and pending recovery choices',()=>{
 const {api}=setup(),draft={schema:1,baseRelease:'release-before',slots:{text:'unsaved',_studio:{formats:[{runs:[{text:'한글',bold:true}]}]}}},recovery={choices:{'0':{choice:'edit',text:'pending replacement'}}};
 const e=api.exportPackage({key,workingDraft:draft,savedRaw:'{unreadable original',recovery,editorState:{itemIndex:2}});draft.slots.text='later';
 assert.equal(e.workingDraft.slots.text,'unsaved');assert.equal(e.workingDraft.baseRelease,'release-before');assert.equal(e.savedBrowserDraftRaw,'{unreadable original');assert.equal(e.recovery.choices['0'].text,'pending replacement');assert.equal(e.workingDraft.slots._studio.formats[0].runs[0].bold,true);
 assert.match(e.instructions,/Do not overwrite approved JSON/);
});
test('recovery popup retries same selected text after quota and export includes unsaved choices',async()=>{
 const {R,document,window}=setup(),base={slot:{text:'base'}},mine={slot:{text:'mine'}},beta={slot:{text:'beta'}};let attempts=0,migrated=0,exported,applied;
 const ui=R.mount(document.querySelector('main'),{model:R.plan(base,mine,beta),raw:'original',latest:beta,apply:async value=>{attempts++;if(attempts===1)throw new DOMException('full','QuotaExceededError');applied=plain(value);},archiveBackups:async()=>{migrated++;},exportWork:value=>exported=plain(value)});
 const dialog=document.querySelector('dialog');dialog.close=()=>{};const next=dialog.querySelector('[data-dr-next]');dialog.querySelector('#dr-title').focus=()=>{};next.click();const input=dialog.querySelector('textarea');input.value='unsaved recovery wording';input.dispatchEvent(new window.Event('input'));next.click();next.click();await new Promise(r=>setTimeout(r,0));
 assert.match(dialog.textContent,/Browser storage is full/);assert.equal(ui.hasChanges(),true);dialog.querySelector('[data-work-export]').click();assert.equal(exported.combinedValues.slot.text,'unsaved recovery wording');
 const retry=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Archive backups and retry');assert.equal(retry.hidden,false);retry.click();await new Promise(r=>setTimeout(r,0));assert.equal(migrated,1);assert.equal(attempts,2);assert.equal(applied.slot.text,'unsaved recovery wording');assert.equal(ui.hasChanges(),false);assert.match(dialog.textContent,/Your recovered draft is saved/);
});
function studio(f){
 const {window,document}=f;document.body.innerHTML='<main><div class="cs-toolbar"></div><p class="cs-status"></p><div class="cs-fields"></div><div class="cs-preview"></div><button data-cs-save></button><button data-cs-backup hidden></button><textarea data-cs-submit-summary></textarea></main>';
 window.AIWiseDraftStorage={...f.api,...f.service};
 const code=fs.readFileSync(path.join(root,'workspace/content-studio.js'),'utf8').replace('window.AIWiseContentStudio = {render, supports, betaURL,','window.AIWiseContentStudio = {render, supports, betaURL, test:{save,record,exportWork,archiveAndRetry,dirty,set:s=>{session=s;}},');
 vm.runInNewContext(code,{window,document,URL,crypto,localStorage:f.storage,setTimeout,confirm:()=>false});return window.AIWiseContentStudio.test;
}
test('actual Studio save/export across 20 Common and bachelor chapter-language combinations preserves drafts',async()=>{
 const f=fixture(),t=studio(f);let exported;f.window.AIWiseDraftStorage.download=raw=>{exported=JSON.parse(raw);};
 for(const courseId of ['common','psychology','pedagogical-sciences','dpas'])for(const chapter of courseId==='common'?['c1','c2','c3','map']:['c2','c3'])for(const locale of ['en','nl']){
  const isCommon=courseId==='common',draftKey=(isCommon?'aiwise_common_studio_':'aiwise_content_studio_'+courseId+'_')+chapter+(locale==='nl'?'_nl':'')+'_v1';
  const base=chapter==='c2'&&!isCommon?{'c2.examples':[{title:'original',thinking:'before'}]}:{block:{text:'before'}};
  const values=plain(base);if(values['c2.examples'])values['c2.examples'][0].thinking='unsaved 한글';else values.block.text='unsaved 한글';
  const s={key:draftKey,courseId,chapter,locale,isCommon,ready:true,base,values,saved:plain(base),raw:'previous raw',items:[{path:'block',title:'Block'}],sourceHTML:'<p>baseline</p>',host:f.document.querySelector('main'),submitDialog:f.document.querySelector('main'),baseRelease:'release-1',layoutBackupNeeded:true};
  t.set(s);f.storage.setItem(draftKey,s.raw);t.exportWork(s);assert.deepEqual(exported.workingDraft.baseSlots,isCommon||chapter==='c3'?base:{});assert.equal(exported.savedBrowserDraftRaw,'previous raw');assert.equal(exported.identity.scope,courseId);
  await t.save(s);assert.equal(s.saveFailed,false);const saved=JSON.parse(f.storage.getItem(draftKey));assert.equal(saved.schema,1);assert.equal(saved.locale,locale);assert.equal(saved.baseRelease,'release-1');assert.equal(saved.examples?.[0].thinking||saved.slots.block.text,'unsaved 한글');assert.equal(await f.service.read(saved.recoveryBackup),'previous raw');assert.equal(t.dirty(),false);
 }
});
test('actual Studio error actions retry and export memory edits while localStorage is full',async()=>{
 const f=fixture(),t=studio(f);const s={key,courseId:'psychology',chapter:'c2',locale:'nl',ready:true,base:{'c2.examples':[{title:'old'}]},values:{'c2.examples':[{title:'unsaved '+ 'x'.repeat(2000)}]},saved:{'c2.examples':[{title:'old'}]},raw:'original',host:f.document.querySelector('main')};
 f.storage.setItem(key,'original');f.storage.setItem(bk,'b'.repeat(5000));f.setLimit(6000);t.set(s);await t.save(s);assert.equal(s.saveFailed,true);assert.equal(f.storage.getItem(key),'original');let exported;f.window.AIWiseDraftStorage.download=raw=>exported=JSON.parse(raw);t.exportWork(s);assert.equal(exported.workingDraft.examples[0].title,s.values['c2.examples'][0].title);await t.archiveAndRetry(s);assert.equal(s.saveFailed,false);assert.equal(JSON.parse(f.storage.getItem(key)).examples[0].title,s.values['c2.examples'][0].title);
});
