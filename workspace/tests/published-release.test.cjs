const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const source=fs.readFileSync(path.join(__dirname,'../published-release.js'),'utf8'),settle=()=>new Promise(r=>setTimeout(r,0));
const version={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',number:4,title:'Review <one>'};
function fixture(options={}){
 const dom=parseHTML('<html><body><main id="room"></main></body></html>'),{document}=dom;Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._value||this.querySelector('option')?.value;},set(v){this._value=v;}});let state={status:'member',role:options.role||'admin',user:{id:'owner'}},calls=[],rows=options.rows||[],finish;
 const pending=options.pending?new Promise(r=>finish=r):Promise.resolve();
 const client={from:name=>{calls.push(name);const chain={select:()=>chain,order:()=>chain,limit:()=>chain,abortSignal:async()=>{await pending;return {data:name==='workspace_releases'?rows:options.empty?[]:[version],error:options.error};}};return chain;},rpc:(name,body)=>{calls.push({name,body});return {abortSignal:async()=>({data:options.enabled!==false,error:options.error})};},functions:{invoke:async(name,{body})=>{calls.push({name,body});return {data:{ok:true}};}}};
 const window={AIWiseAuth:{snapshot:()=>state},AIWiseBackend:{getClient:async()=>client}};
 vm.runInNewContext(source,{window,document,crypto:require('node:crypto').webcrypto,AbortController,setTimeout:()=>1,clearTimeout:()=>{}});
 const dispose=window.AIWisePublishedRelease.render((area,title,help,body)=>document.querySelector('#room').innerHTML=body);
 return{document,calls,dispose,finish,setAuth:s=>state=s};
}
test('empty review list cannot prepare a release',async()=>{const f=fixture({empty:true});await settle();assert.equal(f.document.querySelector('[data-prepare]').disabled,true);assert.match(f.document.body.textContent,/Create a review version/);f.dispose();});
test('prepared releases require a distinct Publish action, and deployment claims match status',async()=>{
 const f=fixture({rows:[{...version,id:version.id,version_id:version.id,version_number:4,version_title:'Safe <title>',status:'prepared',created_at:'2026-10-01'},{...version,id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',version_id:version.id,version_number:4,version_title:'Previous',status:'committed',deployment_status:'building',created_at:'2026-10-01'}]});await settle();
 assert.equal(f.document.querySelectorAll('[data-approve]').length,1);assert.match(f.document.body.textContent,/Deployment in progress/);assert.doesNotMatch(f.document.body.textContent,/Deployed to students/);assert.equal(f.document.querySelector('title'),null);assert.equal(f.calls.some(c=>c.name==='workspace_approve_release'),false);f.dispose();
});
test('prepare sends only the chosen saved version and stable request ID, never publishes',async()=>{const f=fixture();await settle();await f.document.querySelector('[data-prepare]').onclick();const invoke=f.calls.find(c=>c.name==='aiwise-release');assert.equal(invoke.body.operation,'prepare');assert.equal(invoke.body.version_id,version.id);assert.equal(f.calls.some(c=>c.name==='workspace_approve_release'),false);f.dispose();});
test('members cannot query release data',async()=>{const f=fixture({role:'member'});await settle();assert.equal(f.calls.length,0);f.dispose();});
test('missing setup disables publication without claiming failure of the student site',async()=>{const f=fixture({error:{code:'PGRST202'}});await settle();assert.match(f.document.body.textContent,/setup is not ready/);assert.equal(f.document.querySelector('[data-prepare]').disabled,true);f.dispose();});
test('late data cannot appear after account change',async()=>{const f=fixture({pending:true});await settle();f.setAuth({status:'signed-out'});f.finish();await settle();assert.equal(f.document.querySelector('[data-release-root]').textContent,'');f.dispose();});
