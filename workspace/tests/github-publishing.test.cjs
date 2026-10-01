const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const source=fs.readFileSync(path.join(__dirname,'../github-publishing.js'),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,0));
function fixture(job,options={}){
 const {document}=parseHTML('<html><body><section id="host"></section></body></html>');
 let state={status:'member',role:options.role||'admin',user:{id:'owner'}},calls=[],finish;
 const wait=options.pending?new Promise(r=>finish=r):Promise.resolve();
 const chain={select:()=>chain,eq:()=>chain,maybeSingle:()=>chain,abortSignal:async()=>{await wait;return {data:job};}};
 const client={from:name=>{calls.push(name);return chain;},rpc:name=>{calls.push(name);return {abortSignal:async()=>({data:options.enabled!==false,error:options.error})};}};
 const window={AIWiseAuth:{snapshot:()=>state},AIWiseBackend:{getClient:async()=>client}};
 vm.runInNewContext(source,{window,document,AbortController,setTimeout:()=>1,clearTimeout:()=>{}});
 const host=document.querySelector('#host'),dispose=window.AIWiseGitHubPublishing.mount(host,'submission');
 return{host,calls,dispose,finish,setAuth:s=>state=s};
}
test('commit success is separate from deployment success, and both links are fixed to the Beta repo',async()=>{
 const f=fixture({status:'committed',commit_sha:'a'.repeat(40),deployment_status:'building',deployment_run_id:123});await settle();
 assert.match(f.host.textContent,/deployment in progress/);assert.doesNotMatch(f.host.textContent,/deployment completed/);
 assert.equal(f.host.querySelectorAll('a').length,2);assert.ok([...f.host.querySelectorAll('a')].every(a=>a.href.startsWith('https://github.com/AIWise-EUR/AIWiseModule_Beta/')));f.dispose();
});
test('failed commits offer retry but committed deployment failures do not replay approval',async()=>{
 for(const status of ['failed','committed']){const f=fixture({status,deployment_status:'failure'});await settle();assert.equal(f.host.querySelector('[data-publish-retry]').hidden,status!=='failed');f.dispose();}
});
test('missing setup is shown without claiming approval or deployment failed',async()=>{const f=fixture(null,{error:{code:'PGRST202'}});await settle();assert.match(f.host.textContent,/setup is not ready/);f.dispose();});
test('members cannot query private job status',async()=>{const f=fixture(null,{role:'member'});await settle();assert.equal(f.calls.length,0);assert.equal(f.host.textContent,'');});
test('late results are cleared if the signed-in account changes',async()=>{const f=fixture({status:'committed',deployment_status:'success'},{pending:true});await settle();f.setAuth({status:'signed-out'});f.finish();await settle();assert.equal(f.host.textContent,'');});
test('deployed content fallback is language-specific and cannot replace saved review versions',async()=>{
 const {document}=parseHTML('<html><body><main></main></body></html>');
 Object.defineProperty(document,'currentScript',{value:{src:'https://example.test/repo/pipelines/beta-content.js'}});
 const urls=[],window={location:{href:'https://example.test/repo/common/aiwise-c1-final.html?lang=nl'},AIWiseSupabaseConfig:{url:'https://unit.supabase.co',publishableKey:'public'}};
 const context={window,document,URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async input=>{
  const url=new URL(input);urls.push(url);if(url.hostname==='unit.supabase.co')throw Error('Unavailable');
  return url.pathname.endsWith('/c1.json')?{ok:true,json:async()=>({schema:1,sequence:1,course:'common',chapter:'c1',locale:'nl',submission_id:'a'.repeat(36),slots:{'c1.block-0':{'Heading 1':'Nederlands'}}})}:{status:404};
 }};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../pipelines/beta-content.js'),'utf8'),context);
 const rows=await window.AIWiseBetaContent.read('common','nl');assert.equal(rows[0].locale,'nl');assert.ok(urls.filter(u=>u.hostname==='example.test').every(u=>u.pathname.includes('/content/approved/nl/common/')));assert.match(document.body.textContent,/last deployed approved content/);
 await assert.rejects(()=>window.AIWiseBetaContent.sources('common','nl'),/Unavailable/);
 window.location.href+='&review_version=version';const before=urls.length;
 await assert.rejects(()=>window.AIWiseBetaContent.read('common','nl'),/Workspace/);assert.equal(urls.length,before);
});
