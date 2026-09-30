const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
const code=name=>fs.readFileSync(path.join(root,'workspace',name),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(role='admin',hash='#team',respond=()=>({data:{members:[],total:0}})){
 const {document,window:dom}=parseHTML(fs.readFileSync(path.join(root,'workspace/index.html'),'utf8'));
 dom.HTMLElement.prototype.showModal=function(){this.open=true;};dom.HTMLElement.prototype.close=function(){this.open=false;};
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._selectedValue||this.querySelector('option')?.value;},set(v){this._selectedValue=v;}});
 let state={status:'member',role,user:{id:'admin-id'},message:'Ready'};
 const subscribers=[],events={},calls=[],renders=[];
 const location={hash,pathname:'/workspace/',search:''};
 const window={document,location,matchMedia:()=>({matches:false}),scrollTo(){},addEventListener:(name,fn)=>{events[name]=fn;},
  AIWiseAuth:{snapshot:()=>state,subscribe:fn=>{subscribers.push(fn);fn(state);},refresh:async()=>{}},
  AIWiseBackend:{getClient:async()=>({rpc:(name,args)=>({abortSignal:()=>{calls.push({name,args});return Promise.resolve(respond(name,args));}})})},
  AIWiseMotion:{enter(){},show(n){n.hidden=false;},hide(n){n.hidden=true;}},AIWiseSidebar:{markCurrent(){},close(){}},
  AIWiseOverview:{setHome(){},open(){}},AIWiseCourses:{ready:Promise.resolve(),canLeave:()=>true,dispose(){},cards:()=>'',render:()=>renders.push('courses')},
  AIWiseContentStudio:{canLeave:()=>true,dispose(){},supports:()=>true,render:()=>renders.push('studio')},
  AIWiseControlTower:{canLeave:()=>true,dispose(){},render:()=>renders.push('tower')},
  AIWiseBetaReview:{canLeave:()=>true,dispose(){},open:()=>renders.push('beta')}
 };
 const context=vm.createContext({window,document,location,history:{replaceState:(_,__,url)=>{location.hash=new URL(url,'https://example.test').hash;}},AbortController,setTimeout,clearTimeout,URL,requestAnimationFrame:fn=>fn()});
 vm.runInContext(code('team-management.js'),context);vm.runInContext(code('workspace.js'),context);
 return {document,window,calls,renders,location,async setAuth(next){state=next;subscribers.forEach(fn=>fn(next));await tick();},async route(hash){location.hash=hash;events.hashchange();await tick();}};
}
test('member deep links cannot render administrator areas; Beta preview remains available',async()=>{
 const f=fixture('member','#common/c1');await tick();
 assert.equal(f.location.hash,'#home');assert.equal(f.document.documentElement.dataset.workspaceAccess,'member');
 assert.match(f.document.getElementById('room').textContent,/Preview and share feedback/);assert.equal(f.document.getElementById('home').hidden,true);
 for(const hash of ['#team','#studio/aws1','#tower','#manager','#courses/new','#records/common','#published'])await f.route(hash);
 assert.deepEqual(f.calls,[]);assert.deepEqual(f.renders,[]);
 await f.route('#beta/c1');assert.deepEqual(f.renders,['beta']);
});
test('admin retains campus and Studio; team loads only through guarded RPC',async()=>{
 const f=fixture('admin','#home');await tick();assert.equal(f.document.getElementById('home').hidden,false);
 await f.route('#studio/aws1');assert.deepEqual(f.renders,['studio']);
 await f.route('#team');assert.equal(f.calls[0].name,'workspace_list_team');assert.match(f.document.getElementById('room').textContent,/Team management/);
});
test('role downgrade and sign-out clear administrator screens without a navigation escape',async()=>{
 const f=fixture('admin','#team');await tick();
 await f.setAuth({status:'member',role:'member',user:{id:'admin-id'},message:'Member'});
 assert.equal(f.document.querySelector('.team-panel'),null);assert.match(f.document.getElementById('room').textContent,/Preview and share feedback/);
 await f.setAuth({status:'signed-out',role:null,user:null,message:'Sign in'});
 assert.equal(f.document.querySelector('.beta-welcome'),null);assert.match(f.document.getElementById('room').textContent,/Welcome to AI-Wise/);
});
test('late directory response does not reappear after role revocation',async()=>{
 let finish;const pending=new Promise(r=>finish=r);const f=fixture('admin','#team',()=>pending);await tick();
 await f.setAuth({status:'member',role:'member',user:{id:'admin-id'}});
 finish({data:{members:[{email:'private@example.test'}],total:1}});await tick();
 assert.ok(!f.document.body.textContent.includes('private@example.test'));
});
test('team names and emails render as text; access edit sends version and fixed fields',async()=>{
 const person={user_id:'person-id',email:'x@example.test',display_name:'<img src=x onerror=alert(1)>',role:'member',active:true,access:'member',version:7,confirmed:true};
 const f=fixture('admin','#team',(name)=>name==='workspace_list_team'?{data:{members:[person],total:1}}:{error:{code:'40001',message:'Access changed. Refresh.'}});await tick();
 assert.equal(f.document.querySelector('.team-person img'),null);
 f.document.querySelector('.team-person button').click();
 assert.equal(f.document.querySelector('.team-dialog').open,true);
 // Linkedom select values are read-only; the real browser supplies normal select values.
 const select=f.document.querySelector('#team-role');Object.defineProperty(select,'value',{value:'admin',writable:true});
 const enabled=f.document.querySelector('#team-active');Object.defineProperty(enabled,'value',{value:'true',writable:true});
 await f.document.querySelector('.team-dialog form').onsubmit({preventDefault(){}});
 assert.equal(f.calls.at(-1).name,'workspace_set_team_access');
 assert.equal(f.calls.at(-1).args.p_expected_version,7);assert.equal(f.calls.at(-1).args.p_role,'admin');
 assert.match(f.document.querySelector('[data-error]').textContent,/Access changed/);
 assert.equal(select.disabled,false);
});
test('missing migration has an actionable message and no fake success',async()=>{
 const f=fixture('admin','#team',()=>({error:{code:'PGRST202'}}));await tick();
 assert.match(f.document.querySelector('[data-message]').textContent,/not ready yet/);assert.equal(f.document.querySelectorAll('.team-person').length,0);
});

test('Auth derives the role from membership, preserves refresh state and observes revocation',async()=>{
 let membership={user_id:'u',active:true,role:'member'},selection;
 const backend={auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'u',email:'u@example.test',user_metadata:{display_name:'Reviewer',role:'admin'}}}})},from:()=>{
  const q={select(value){selection=value;return q;},eq:()=>q,maybeSingle:()=>q,abortSignal:async()=>({data:membership})};return q;
 }};
 const window={AIWiseBackend:{getClient:async()=>backend}};
 const document={currentScript:{src:'https://example.test/workspace/auth.js'},addEventListener(){}};
 vm.runInNewContext(code('auth.js'),{window,document,URL,AbortController,setTimeout,clearTimeout});await tick();
 assert.equal(selection,'user_id,active,role');assert.equal(window.AIWiseAuth.snapshot().role,'member');
 membership={...membership,role:'admin'};await window.AIWiseAuth.refresh();assert.equal(window.AIWiseAuth.snapshot().role,'admin');
 membership=null;await window.AIWiseAuth.refresh();assert.equal(window.AIWiseAuth.snapshot().status,'not-member');assert.equal(window.AIWiseAuth.snapshot().role,null);
});

test('Shared Studio refuses a normal member before querying submissions',async()=>{
 let called=false;const window={AIWiseAuth:{snapshot:()=>({status:'member',role:'member',user:{id:'u'}}),subscribe:()=>{}},AIWiseBackend:{getClient:async()=>{called=true;}},dispatchEvent(){}};
 vm.runInNewContext(code('shared-studio.js'),{window,Event,AbortController,setTimeout,clearTimeout});
 const result=await window.AIWiseSharedStudio.refresh();assert.equal(called,false);assert.equal(result.loaded,false);assert.match(result.error,/Administrator/);
 await assert.rejects(()=>window.AIWiseSharedStudio.decide('id',1,'approved','Test'),/Administrator/);assert.equal(called,false);
});
