const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),dir=path.join(__dirname,'..');const settle=()=>new Promise(r=>setTimeout(r,0));
function fixture(options={}){
 const dom=parseHTML('<html><body><main id="room"><div class="room-heading"><h1>Workspace</h1></div></main></body></html>'),{document}=dom;
 dom.HTMLElement.prototype.showModal=function(){this.setAttribute('open','');};dom.HTMLElement.prototype.close=function(){this.removeAttribute('open');};
 let state=options.state||{status:'member',role:'admin',user:{id:'one'}},listener;const store=options.store||new Map(),events={};
 const location={pathname:'/workspace/',hash:options.hash||'#home'};
 const window={AIWiseAuth:{snapshot:()=>state,subscribe:fn=>{listener=fn;fn(state);}},addEventListener:(n,fn)=>events[n]=fn};
 const sandbox={window,document,location,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(options.blockStorage)throw Error();store.set(k,v);}},MutationObserver:class{observe(){}},queueMicrotask,matchMedia:()=>({matches:true})};
 vm.runInNewContext(fs.readFileSync(path.join(dir,'tutorial-content.js'),'utf8'),sandbox);vm.runInNewContext(fs.readFileSync(path.join(dir,'tutorials.js'),'utf8'),sandbox);
 return{document,api:window.AIWiseTutorials,store,content:window.AIWiseTutorialContent,state:s=>{state=s;listener(s);},route:hash=>{location.hash=hash;events.hashchange();},refresh:()=>window.AIWiseTutorials.refresh()};
}
const dismiss=f=>f.document.querySelector('.aw-guide-skip').click();
test('first approved login shows a role-specific welcome, once per account and browser; reopen stays available',async()=>{
 const f=fixture();await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Welcome to your workspace/);f.document.querySelector('[data-guide-next]').click();assert.equal(f.document.querySelector('h2').textContent,'Two studios, one module');dismiss(f);f.refresh();await settle();assert.equal(f.document.querySelector('.aw-guide'),null);
 f.document.querySelector('[data-guide-trigger]').click();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Workspace home/);dismiss(f);
 const same=fixture({store:f.store});await settle();assert.equal(same.document.querySelector('.aw-guide'),null);
 same.state({status:'member',role:'member',user:{id:'two'}});await settle();assert.match(same.document.querySelector('.aw-guide-count').textContent,/Welcome to AI-Wise Beta/);assert.doesNotMatch(same.document.querySelector('.aw-guide').textContent,/Control Tower|Publish/);dismiss(same);
});
test('sign-in guidance is replaced by first-login welcome after the account window closes',async()=>{
 const f=fixture({state:{status:'signed-out'}});await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Signing in/);dismiss(f);
 const d=f.document.createElement('dialog');d.id='aw-account-dialog';d.innerHTML='<div class="aw-account-header"></div>';d.setAttribute('open','');f.document.body.append(d);
 f.state({status:'member',role:'admin',user:{id:'new'}});await settle();assert.equal(f.document.querySelector('.aw-guide'),null);
 d.close();f.refresh();await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Welcome to your workspace/);dismiss(f);
});
test('new page guides open once, while hash changes do not close a newly opened current-page guide',async()=>{
 const f=fixture();await settle();dismiss(f);f.route('#beta/current');await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Beta preview/);
 f.route('#beta/current');await settle();assert.ok(f.document.querySelector('.aw-guide'));dismiss(f);f.route('#home');await settle();dismiss(f);f.route('#beta/current');await settle();assert.equal(f.document.querySelector('.aw-guide'),null);
});
test('Common and Content editor guides have separate first-visit preferences',async()=>{
 const f=fixture();await settle();dismiss(f);f.route('#common/c1');await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Common Studio editor/);dismiss(f);f.route('#studio/ped');await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Content Studio editor/);dismiss(f);
});
test('role revocation clears an open administrator guide and members cannot open administrator tours',async()=>{
 const f=fixture();await settle();dismiss(f);f.api.open('team');assert.match(f.document.querySelector('.aw-guide-count').textContent,/Team management/);f.state({status:'member',role:'member',user:{id:'one'}});await settle();assert.match(f.document.querySelector('.aw-guide-count').textContent,/Welcome to AI-Wise Beta/);dismiss(f);f.api.open('team');assert.equal(f.document.querySelector('.aw-guide'),null);
});
test('storage failure does not break navigation or repeatedly reopen a dismissed guide in the session',async()=>{
 const f=fixture({blockStorage:true});await settle();dismiss(f);f.refresh();await settle();assert.equal(f.document.querySelector('.aw-guide'),null);
});
test('all Workspace areas and My page have factual guide content, including prototype limitations',async()=>{
 const f=fixture();await settle();dismiss(f);for(const id of ['login','home','common','studio','common-editor','studio-editor','beta','beta-preview','tower','release','courses','manager','profiler','team','records','my-page','account']){assert.ok(f.content.guides[id]?.cards.length);assert.ok(f.content.guides[id].cards.every(c=>c.title&&c.body&&c.steps.length));}
 assert.match(JSON.stringify(f.content.guides.courses),/this browser/);assert.match(JSON.stringify(f.content.guides.manager),/not connected/);assert.match(JSON.stringify(f.content.guides.records),/not connected/);
});
