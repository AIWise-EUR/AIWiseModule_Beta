const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const code=fs.readFileSync(path.join(__dirname,'../control-tower.js'),'utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture({shared=false,status='pending',route='studio',chapter='c2',locale='en',withSnapshot=true,failure=false}={}){
 const {document,window:dom}=parseHTML('<html><body><main id="room"></main></body></html>');
 const copy={schema:1,course:route==='common'?'common':'ped',chapter,locale,savedAt:'2026-10-01T00:00:00Z',slots:{[chapter+'.examples']:[{title:'New'}]},baseSlots:{[chapter+'.examples']:[{title:'Old'}]}};
 const r={id,shared,route,type:'submission',status,rev:1,title:'Course update',author:{name:'Author'},events:[],seenBy:{reviewer:'2026-10-01'},createdAt:'2026-10-01',submittedAt:'2026-10-01',...(withSnapshot?{contentSnapshot:copy}:{}),...(status==='approved'?{decision:{by:'Reviewer',reason:'Checked'}}:{})};
 const original={schema:1,requests:shared?[]:[r]};const store=new Map([['aiwise_control_tower_v1',JSON.stringify(original)]]);const calls=[];
 const state={rows:shared?[r]:[],role:'admin',loaded:true};
 const window={AIWiseAuth:{snapshot:()=>({status:'member',role:'admin',user:{displayName:'Reviewer'}}),subscribe:()=>{}},AIWiseSharedStudio:{snapshot:()=>state,refresh:async()=>state,decide:async(...args)=>{calls.push(args);if(failure)throw Error('Approval failed');r.status=args[2];r.rev++;r.decision={by:'Reviewer',reason:args[3]};}},addEventListener:()=>{}};
 const location={hash:'#tower/request/'+id};
 vm.runInNewContext(code,{window,document,location,URL,URLSearchParams,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},setTimeout,confirm:()=>true});
 const shell=(_route,title,help,body)=>{document.getElementById('room').innerHTML='<h1 id="room-title">'+title+'</h1>'+body;};
 return {r,document,dom,calls,store,original,api:window.AIWiseControlTower,render:()=>window.AIWiseControlTower.render('request/'+id,shell)};
}
test('legacy pending and approved Studio requests keep all content and decisions but cannot approve locally',async()=>{
 for(const status of ['pending','approved']){const f=fixture({status});await f.render();assert.equal(f.document.querySelector('#ct-decision-form'),null);assert.match(f.document.querySelector('.ct-detail-grid').textContent,/Resubmit as a team request/);assert.match(f.document.querySelector('.ct-submitted-content').textContent,/New/);assert.ok(f.document.querySelector('a[href="?lang=en#studio/ped/c2"]'));assert.deepEqual(JSON.parse(f.store.get('aiwise_control_tower_v1')),f.original);assert.equal(f.calls.length,0);}
});
test('legacy Common request without a content snapshot opens Common Studio without guessing a chapter',async()=>{const f=fixture({route:'common',withSnapshot:false});await f.render();assert.equal(f.document.querySelector('#ct-decision-form'),null);assert.ok(f.document.querySelector('a[href="#common"]'));});
test('signed-in Team review works without a local-name form and only confirms Beta after success',async()=>{
 const f=fixture({shared:true,locale:'nl'});await f.render();assert.equal(f.document.querySelector('.ct-local'),null);assert.match(f.document.querySelector('.ct-detail-meta').textContent,/Awaiting approval/);
 f.document.getElementById('ct-decisionReason').value='Checked';const e=new f.dom.Event('submit',{cancelable:true});e.submitter=f.document.querySelector('[value="approved"]');e.submitter.value='approved';f.document.getElementById('ct-decision-form').dispatchEvent(e);await new Promise(r=>setImmediate(r));
 assert.equal(f.calls.length,1);assert.deepEqual(Array.from(f.calls[0]),[id,1,'approved','Checked']);assert.match(f.document.querySelector('.ct-detail-meta').textContent,/Applied to Beta/);
 const link=Array.from(f.document.querySelectorAll('a')).find(a=>a.textContent==='Preview in Beta →');assert.ok(link);const [route,query]=link.getAttribute('href').split('?');assert.equal(route,'#beta/current');const params=new URLSearchParams(query);assert.equal(params.get('page'),'common/aiwise-c2-final.html?course=ped&lang=nl');assert.equal(params.get('item'),'c2.examples');assert.equal(params.get('scope'),'ped');
});
test('failed Team approval keeps request pending and shows the error without a Beta success link',async()=>{
 const f=fixture({shared:true,failure:true});await f.render();f.document.getElementById('ct-decisionReason').value='Checked';const e=new f.dom.Event('submit',{cancelable:true});e.submitter=f.document.querySelector('[value="approved"]');e.submitter.value='approved';f.document.getElementById('ct-decision-form').dispatchEvent(e);await new Promise(r=>setImmediate(r));assert.equal(f.r.status,'pending');assert.equal(f.document.getElementById('ct-decision-message').textContent,'Approval failed');assert.equal(f.document.querySelector('[value="approved"]').disabled,false);assert.ok(!f.document.querySelector('a[href^="#beta/current"]'));
});
test('Common map approval opens the map in the current review and preserves language',async()=>{const f=fixture({shared:true,status:'approved',route:'common',chapter:'map',locale:'nl'});await f.render();const link=f.document.querySelector('a[href^="#beta/current"]');const params=new URLSearchParams(link.getAttribute('href').split('?')[1]);assert.equal(params.get('page'),'common/aiwise-c1-anatomy-2d.html?course=aws1&lang=nl');assert.equal(params.get('scope'),'common');});
test('unrelated local Course Profiler requests retain their decision controls',async()=>{const f=fixture({route:'profiler',withSnapshot:false});await f.render();assert.ok(f.document.querySelector('[value="approved"]'));});
