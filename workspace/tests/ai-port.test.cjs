/* AI Port: brief, parse, plan, apply and the pending hand-over. DOM via linkedom; no network. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const source=fs.readFileSync(path.join(__dirname,'../ai-port.js'),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,0));
const clone=v=>JSON.parse(JSON.stringify(v));
// Values made inside the vm context have another realm's prototypes; compare by structure.
const same=(a,b)=>assert.deepEqual(clone(a),b);
const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m};};
function fixture(role='member',handler=async()=>({data:[]}),validCopy=()=>true){
 const {document,window:dom}=parseHTML('<html><body><h1 id="room-title">Content Studio</h1></body></html>');
 const create=document.createElement.bind(document);document.createElement=tag=>{const n=create(tag);if(tag==='dialog'){n.showModal=()=>{n.open=true;};n.close=()=>{n.open=false;};}return n;};
 let state=role?{status:'member',role,user:{id:'owner',displayName:'Seyoon'}}:{status:'signed-out'},listener,accountOpened=0;const calls=[],edits=[];
 const chain=table=>{const q={select:()=>q,order:()=>q,limit:()=>q,abortSignal:async()=>{calls.push(table);return handler({table});}};return q;};
 const window={AIWiseAuth:{snapshot:()=>state,subscribe:fn=>{listener=fn;fn(state);}},AIWiseBackend:{getClient:async()=>({from:chain}),checkConnection:async()=>true},AIWiseAccount:{open:()=>accountOpened++},AIWiseSidebar:{close:()=>{}},AIWiseMotion:{enter:()=>{},cancel:()=>{}},
  AIWiseTutorials:{context:()=>'studio-editor'},AIWiseTutorialContent:{guides:{'studio-editor':{name:'Editor',cards:[{title:'Find the right item',body:'The item list groups content.',steps:['Choose your language.']}]}}},
  AIWiseStudioEditing:{remember:()=>edits.push('remember'),textChanged:(s,slot,p,text)=>edits.push(['text',slot,p.join('/'),text])},AIWiseStudioBlocks:{validCopy},addEventListener:()=>{}};
 const localStorage=store(),sessionStorage=store();
 vm.runInNewContext(source,{window,document,location:{href:'https://example.test/workspace/#studio/psychology/c2',hash:'#studio/psychology/c2',pathname:'/workspace/'},URL,AbortController,setTimeout,clearTimeout,localStorage,sessionStorage,navigator:{userAgent:'test-browser'}});
 return {document,dom,api:window.AIWiseAIPort,calls,edits,localStorage,sessionStorage,account:()=>accountOpened,setAuth:a=>{state=a;listener(a);}};
}
function courseSession(over={}){
 const base={'c2.examples':[{title:'A',thinking:'t1',typing:'y1',processing:'p1'},{title:'B',thinking:'t2',typing:'y2',processing:'p2'}],'c2.sat_example_title':'S.A.T worked example','c2.sat_example':{note:'',phases:[{steps:[{text:'step one'}]}]}};
 const s={courseId:'psychology',chapter:'c2',locale:'en',isCommon:false,ready:true,blocked:false,raw:JSON.stringify({savedAt:'2026-10-05T10:00:00Z'}),config:{label:'Psychology'},base,values:clone(base),saved:clone(base),
  items:[{path:'c2.examples',example:0},{path:'c2.examples',example:1},{path:'c2.sat_example',titlePath:'c2.sat_example_title'}],index:1,abort:new AbortController(),dialog:{open:false},...over};
 const log=[];
 const api={update:()=>log.push('update'),controls:()=>log.push('controls'),open:()=>log.push('open'),message:()=>{},save:()=>{log.push('save');s.saved=clone(s.values);},submit:()=>log.push('submit'),canSubmit:()=>true,dirty:()=>JSON.stringify(s.values)!==JSON.stringify(s.saved),label:k=>({'c2.examples':'Examples','c2.sat_example':'S.A.T worked example',thinking:'What you are actually thinking',title:'Title'})[k]||k};
 return {s,api,log};
}
const answer=fields=>'Here is my suggestion.\n\n```aiwise\n'+JSON.stringify({aiwise:1,scope:'psychology',chapter:'c2',locale:'en',fields})+'\n```\nLet me know.';

test('signed-out users are sent to sign in and nothing is queried',()=>{const c=fixture(null);assert.equal(c.document.querySelector('.ap-tab').textContent,'AI Port');c.api.open();assert.equal(c.account(),1);assert.equal(c.calls.length,0);});

test('flatten gives every string of a course chapter a copyable key, and common blocks a block::field key',()=>{
 const c=fixture(),{s,api}=courseSession();
 const keys=c.api.flatten(s,api).map(f=>f.key);
 same(keys,['c2.examples[0].title','c2.examples[0].thinking','c2.examples[0].typing','c2.examples[0].processing','c2.examples[1].title','c2.examples[1].thinking','c2.examples[1].typing','c2.examples[1].processing','c2.sat_example_title','c2.sat_example.note','c2.sat_example.phases[0].steps[0].text']);
 const common=c.api.flatten({isCommon:true,values:{'c1.block-0':{'Heading 1':'Hello','Paragraph 1':'Body'},_studio:{}},items:[{path:'c1.block-0',title:'Hero'}]},api);
 same(common.map(f=>[f.key,f.label]),[['c1.block-0::Heading 1','Hero · Heading 1'],['c1.block-0::Paragraph 1','Hero · Paragraph 1']]);
});

test('parse finds the aiwise block in a fenced answer, bare JSON or prose, and rejects other JSON',()=>{
 const c=fixture();
 same(c.api.parse(answer({'c2.examples[1].thinking':'new'})).fields,{'c2.examples[1].thinking':'new'});
 assert.equal(c.api.parse('{"aiwise":1,"scope":"common","chapter":"c1","fields":{"a":"b"}}').locale,'en');
 assert.equal(c.api.parse('Sure! {"aiwise":1,"scope":"common","chapter":"c1","fields":{"a":"b"}} Done.').scope,'common');
 assert.throws(()=>c.api.parse('```json\n{"scope":"common","chapter":"c1","fields":{"a":"b"}}\n```'),/No aiwise block/);
 assert.throws(()=>c.api.parse('{"aiwise":1,"scope":"common","chapter":"c1","fields":{}}'),/no "fields"/);
 assert.throws(()=>c.api.parse('{"aiwise":1,"scope":"common","chapter":"c1","locale":"de","fields":{"a":"b"}}'),/locale/);
});

test('plan reports unknown, unchanged, non-text and enum fields; apply writes through the Studio editing path, saves and logs',()=>{
 const c=fixture(),{s,api,log}=courseSession({values:(()=>{const v=courseSession().s.values;v['c2.amd']={tag:'adopt'};return v;})()});
 s.base['c2.amd']={tag:'adopt'};
 c.api.attachStudio(s,api);
 const result=c.api.plan(c.api.parse(answer({'c2.examples[1].thinking':'Rewritten thinking','c2.examples[1].title':'B','c2.nope':'x','c2.examples[0].typing':{a:1},'c2.amd.tag':'maybe','c2.sat_example.phases[0].steps[0].text':'A fuller first step'})));
 assert.equal(result.issue,null);
 same(result.changes.map(x=>x.field.key),['c2.examples[1].thinking','c2.sat_example.phases[0].steps[0].text']);
 same(result.skipped.map(x=>[x.key,x.reason]),[['c2.examples[1].title','Unchanged'],['c2.nope','Unknown field for this chapter'],['c2.examples[0].typing','Not plain text'],['c2.amd.tag','Must be one of: adopt, modify, discard']]);
 const outcome=c.api.apply(result);
 assert.equal(s.values['c2.examples'][1].thinking,'Rewritten thinking');
 assert.equal(s.values['c2.sat_example'].phases[0].steps[0].text,'A fuller first step');
 assert.equal(s.values['c2.examples'][0].thinking,'t1','other fields untouched');
 same(c.edits,['remember',['text','c2.examples','1/thinking','Rewritten thinking'],['text','c2.sat_example','phases/0/steps/0/text','A fuller first step']]);
 same(log,['update','controls','save']);
 same(outcome,{saved:true,canSubmit:true});
 const entries=JSON.parse(c.localStorage.getItem('aiwise_ai_port_v1:owner:log'));
 assert.equal(entries.length,1);assert.equal(entries[0].kind,'apply');assert.equal(entries[0].count,2);
 assert.throws(()=>c.api.apply(result),/already applied/);
});

test('a blocked draft and a structure the validator rejects leave the session untouched',()=>{
 const c=fixture(),{s,api}=courseSession({blocked:true});
 c.api.attachStudio(s,api);
 assert.equal(c.api.plan(c.api.parse(answer({'c2.examples[1].thinking':'x'}))).issue,'blocked');
 const d=fixture('member',undefined,()=>false),{s:s2,api:api2,log}=courseSession();
 d.api.attachStudio(s2,api2);
 const before=JSON.stringify(s2.values);
 assert.throws(()=>d.api.apply(d.api.plan(d.api.parse(answer({'c2.examples[1].thinking':'x'})))),/does not fit/);
 assert.equal(JSON.stringify(s2.values),before);same(log,[]);same(d.edits,[]);
});

test('an answer for another chapter is kept and previewed once that chapter attaches',async()=>{
 const c=fixture(),{s,api}=courseSession();
 c.api.open();await settle();
 c.document.querySelector('[data-ap-answer]').value=answer({'c2.examples[1].thinking':'Later'});
 c.document.querySelector('[data-ap-read]').onclick();
 assert.match(c.document.querySelector('[data-ap-result]').textContent,/no Studio chapter is open/);
 assert.equal(JSON.parse(c.sessionStorage.getItem('aiwise_ai_port_pending_v1')).scope,'psychology');
 c.api.close();
 c.api.attachStudio(s,api);await settle();await settle();
 assert.equal(c.sessionStorage.getItem('aiwise_ai_port_pending_v1'),null);
 assert.equal(c.document.querySelector('#ai-port').open,true);
 const result=c.document.querySelector('[data-ap-result]');
 assert.match(result.textContent,/1 field to change/);assert.match(result.textContent,/Later/);
 result.querySelector('[data-ap-apply]').onclick();
 assert.equal(s.values['c2.examples'][1].thinking,'Later');
 assert.match(result.querySelector('[data-ap-apply-status]').textContent,/Applied and saved/);
 assert.ok(result.textContent.includes('Send to Control Tower'));
 // A mismatching chapter is also kept, naming what is open.
 c.document.querySelector('[data-ap-answer]').value=answer({'c2.examples[1].thinking':'x'}).replace('"chapter":"c2"','"chapter":"c3"');
 c.document.querySelector('[data-ap-read]').onclick();
 assert.match(c.document.querySelector('[data-ap-result]').textContent,/Psychology · C2 · en.*is open/);
});

test('the brief carries screen, guide, Studio fields, shared activity by role, port history and the answer format',async()=>{
 const rows={workspace_beta_content:[{course:'psychology',chapter:'c2',approved_at:'2026-10-05T12:51:00Z'}],workspace_beta_versions:[{number:5,title:'Autumn review',author_name:'Neus',created_at:'2026-10-04T09:00:00Z'}],workspace_submissions:[{course:'common',chapter:'c1',author_name:'Seyoon',summary:'Tighten the intro',status:'pending',submitted_at:'2026-10-05T13:00:00Z'}],workspace_releases:[]};
 const c=fixture('member',async({table})=>({data:rows[table]||[]})),{s,api}=courseSession();
 c.api.attachStudio(s,api);
 c.localStorage.setItem('aiwise_ai_port_v1:owner:log',JSON.stringify([{at:'2026-10-05T11:00:00Z',kind:'brief',scope:'psychology',chapter:'c2',locale:'en'}]));
 const text=await c.api.brief();
 assert.match(text,/Member: Seyoon \(member\), signed in/);
 assert.match(text,/Screen: Content Studio \(#studio\/psychology\/c2\)/);
 assert.match(text,/Find the right item: The item list groups content\. Steps: Choose your language\./);
 assert.match(text,/Scope: psychology \(Psychology\) · Chapter: c2 · Language: en/);
 assert.match(text,/Selected item: Example 2/);
 assert.match(text,/key: c2\.examples\[1\]\.thinking  \(Example · #2 · What you are actually thinking\)\n  text: t2/);
 assert.ok(!text.includes('key: c2.examples[0].thinking'),'other items only by title unless requested');
 assert.match(text,/Other items in this chapter.*1\. A; 3\. S\.A\.T worked example/);
 assert.match(text,/Approved to Beta[^]*psychology C2/);
 assert.match(text,/V5 "Autumn review" by Neus/);
 assert.match(text,/Studio requests in Control Tower: not available to your role/);
 assert.match(text,/brief copied \(psychology c2 en\)/);
 assert.match(text,/"scope":"psychology","chapter":"c2","locale":"en"/);
 assert.ok(!text.includes('== Diagnostics =='));
 assert.ok(!c.calls.includes('workspace_submissions'));
 const all=await c.api.brief({all:true,diagnostics:true});
 assert.match(all,/key: c2\.examples\[0\]\.thinking/);assert.match(all,/== Diagnostics ==[^]*Supabase reachable[^]*test-browser/);
 s.values['c2.examples'][1].thinking='edited';
 assert.match(await c.api.brief(),/thinking\)  \[edited in draft\]\n  text: edited/);
 const admin=fixture('admin',async({table})=>({data:rows[table]||[]}));
 assert.match(await admin.api.brief(),/pending · common C1 by Seyoon · [^\n]*Tighten the intro/);
 assert.ok(admin.calls.includes('workspace_submissions')&&admin.calls.includes('workspace_releases'));
});

test('the drawer clears on sign-out and the attached Studio detaches on dispose',async()=>{
 const c=fixture(),{s,api}=courseSession();
 c.api.attachStudio(s,api);same(c.api.context(),{scope:'psychology',chapter:'c2',locale:'en'});
 c.api.open();await settle();
 assert.equal(c.document.querySelector('#ai-port').open,true);
 c.setAuth({status:'signed-out'});
 assert.equal(c.document.querySelector('#ai-port').textContent,'');
 s.abort.abort();assert.equal(c.api.context(),null);
 assert.equal(c.api.plan({aiwise:1,scope:'psychology',chapter:'c2',locale:'en',fields:{a:'b'}}).issue,'no-studio');
});
