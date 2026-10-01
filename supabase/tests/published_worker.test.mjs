import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createHandler,buildRelease} from '../functions/aiwise-release/index.ts';
import {sources,version} from './published_bundle.test.mjs';
const pem=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const uuid='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222';
const copy={id:uuid,version_number:1,target_sha:'a'.repeat(40),lease_token:lease,files:buildRelease(uuid,version,'b'.repeat(40),'a'.repeat(40),sources)};
function fixture(options={}){
 let queued=structuredClone(copy),head='a'.repeat(40),counter=0,stored=null,lastCommit=null,state='queued',conflict=!!options.conflict,lost=!!options.lost,ack=!!options.ack;
 const calls=[],finished=[],trees=new Map(),commits=new Map(),updates=[];
 const json=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const fetch=async(input,init={})=>{
  const url=new URL(input),body=init.body?JSON.parse(init.body):null,method=init.method||'GET',p=url.pathname;calls.push({url,body,method,headers:init.headers});
  if(url.hostname==='unit.supabase.co'){
   if(p==='/auth/v1/user')return json({id:uuid});
   if(p.endsWith('/workspace_role'))return json(options.role||'admin');
   if(p.endsWith('/workspace_release_status'))return json(true);
   if(p.endsWith('/workspace_store_release_candidate'))return json(body.p_id);
   if(p.endsWith('/workspace_release_candidate'))return json({content:version.content,fingerprint:'approved-copy'});
   if(p==='/rest/v1/workspace_beta_versions')return json([version]);
   if(p.endsWith('/workspace_release_check_worker'))return json(body.p_secret==='f'.repeat(64));
   if(p.endsWith('/workspace_release_claim')){if(state!=='queued')return json(null);state='processing';return json(queued);}
   if(p.endsWith('/workspace_release_lease_valid'))return json(!options.expired);
   if(p.endsWith('/workspace_release_finish')){
    if(ack){ack=false;return json({},500);}
    finished.push(body);state=body.p_error?'deferred':body.p_superseded?'superseded':'committed';return json(true);
   }
   if(p==='/rest/v1/workspace_releases'){if(url.searchParams.has('id')&&method==='GET')return json([]);if(method==='PATCH'){updates.push(body);return json(null,204);}return json(options.deploy&&state==='committed'?[{id:uuid,commit_sha:lastCommit,created_at:'2026-10-01T00:00:00Z'}]:[]);}
  }
  if(url.hostname==='api.github.com'){
   if(p==='/orgs/AIWise-EUR/installation')return json({id:42,account:{login:'AIWise-EUR',type:'Organization'},permissions:{contents:'write',actions:'read'}});
   if(p==='/app/installations/42/access_tokens'){assert.deepEqual(body.repositories,options.prepare?['AIWiseModule_Beta','AI-Wise']:['AI-Wise']);assert.deepEqual(body.permissions,{contents:options.prepare?'read':'write',actions:'read'});return json({token:'INSTALLATION_SECRET'});}
   if(p==='/installation/token')return json(null,204);
   if(options.prepare&&p==='/repos/AIWise-EUR/AIWiseModule_Beta/git/ref/heads/development')return json({object:{sha:'b'.repeat(40)}});
   if(options.prepare&&p.startsWith('/repos/AIWise-EUR/AIWiseModule_Beta/contents/')){assert.equal(url.searchParams.get('ref'),'b'.repeat(40));return new Response(sources[p.split('/contents/')[1]]);}
   assert.ok(p.startsWith('/repos/AIWise-EUR/AI-Wise/'),'Only Beta repository is accessible');
   if(p.endsWith('/git/ref/heads/main'))return json({object:{sha:options.changed?'d'.repeat(40):head}});
   if(p.includes('/contents/'))return stored?json(stored):json({},404);
   if(p.includes('/git/commits/')&&method==='GET')return json({tree:{sha:'b'.repeat(40)}});
   if(p.endsWith('/git/trees')){assert.equal(body.base_tree,'b'.repeat(40));assert.ok(body.tree.every(f=>Object.keys(copy.files).includes(f.path)));assert.equal(body.tree.length,11);const sha=(++counter).toString(16).padStart(40,'0');trees.set(sha,JSON.parse(body.tree.find(f=>f.path==='published-content.json').content));return json({sha});}
   if(p.endsWith('/git/commits')){const sha=(++counter).toString(16).padStart(40,'0');commits.set(sha,body);return json({sha});}
   if(p.endsWith('/git/refs/heads/main')){
    assert.equal(body.force,false);const c=commits.get(body.sha);
    if(conflict){conflict=false;head='c'.repeat(40);return json({},422);}
    assert.equal(c.parents[0],head);head=body.sha;lastCommit=body.sha;stored=trees.get(c.tree);
    if(lost){lost=false;throw Error('Uncertain network response containing SECRET');}
    return json({object:{sha:head}});
   }
   if(p.endsWith('/commits'))return json([{sha:lastCommit}]);
   if(p.endsWith('/actions/runs'))return json({workflow_runs:[{id:99,name:'pages build and deployment',head_sha:lastCommit,head_branch:'main',status:'completed',conclusion:options.deploy==='failure'?'failure':'success'}]});
  }
  throw Error('Unexpected '+method+' '+url);
 };
 const handler=createHandler({env:n=>({SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SECRET',SUPABASE_ANON_KEY:'public',AIWISE_GITHUB_CLIENT_ID:'Iv1.example',AIWISE_GITHUB_PRIVATE_KEY:pem})[n],fetch,now:()=>Date.parse('2026-10-01T02:00:00Z')});
 const run=(headers={Authorization:'Bearer a.b.c'},body={operation:'process'})=>handler(new Request('https://unit.supabase.co/functions/v1/github-publish',{method:'POST',headers,body:JSON.stringify(body)}));
 return{run,calls,finished,updates,retry:()=>state='queued',setJob:j=>queued=j,setStored:v=>stored=v,get stored(){return stored;}};
}

test('student release commits the frozen package only to the fixed Published branch and revokes its token',async()=>{
 const f=fixture(),r=await f.run();assert.equal(r.status,200);assert.equal((await r.json()).completed,1);assert.equal(f.finished[0].p_error,null);assert.equal(f.stored.release_id,uuid);assert.equal(f.calls.at(-1).url.pathname,'/installation/token');
});
test('members, guests and invalid worker credentials cannot claim or publish releases',async()=>{
 for(const [opts,headers,status]of [[{role:'member'},{Authorization:'Bearer a.b.c'},403],[{}, {},401],[{},{'x-aiwise-worker':'e'.repeat(64)},401]]){const f=fixture(opts),r=await f.run(headers);assert.equal(r.status,status);assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'||c.url.pathname.endsWith('/workspace_release_claim')),false);}
});
test('worker authenticates separately from user JWT and only processes approved queue entries',async()=>{const f=fixture();assert.equal((await f.run({'x-aiwise-worker':'f'.repeat(64)})).status,200);assert.equal(f.calls.some(c=>c.url.pathname==='/auth/v1/user'),false);});
test('a student-site change after preparation stops the release without changing the branch',async()=>{for(const opts of [{changed:true},{conflict:true}]){const f=fixture(opts);await f.run();assert.equal(f.finished[0].p_error,'published_changed');assert.equal(f.stored,null);}});
test('uncertain branch response and database acknowledgement recover without duplicate commits',async()=>{for(const opts of [{lost:true},{ack:true}]){const f=fixture(opts);await f.run();f.retry();await f.run();assert.equal(f.finished.at(-1).p_error,null);assert.equal(f.calls.filter(c=>c.url.pathname.endsWith('/git/commits')&&c.method==='POST').length,1);}});
test('expired lease cannot advance the branch',async()=>{const f=fixture({expired:true});await f.run();assert.equal(f.finished[0].p_error,'lease_expired');assert.equal(f.calls.some(c=>c.method==='PATCH'&&c.url.hostname==='api.github.com'),false);});
test('extra file cannot enter the target repository',async()=>{const f=fixture();f.setJob({...copy,files:{...copy.files,'evil.js':'x'}});await f.run();assert.equal(f.finished[0].p_error,'invalid_release');assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'),false);});
test('Pages deployment status is independent of commit success',async()=>{for(const deploy of ['success','failure']){const f=fixture({deploy});await f.run();assert.equal(f.finished[0].p_error,null);assert.equal(f.updates[0].deployment_status,deploy);}});

test('preparing reads exact source revisions and stores a server-built package without committing',async()=>{
 const f=fixture({prepare:true}),r=await f.run(undefined,{operation:'prepare',id:uuid,fingerprint:'approved-copy',files:{'evil.js':'untrusted'},repository:'evil'});
 assert.equal(r.status,200);const save=f.calls.find(c=>c.url.pathname.endsWith('/workspace_store_release_candidate')).body;
 assert.equal(save.p_source,'b'.repeat(40));assert.equal(save.p_target,'a'.repeat(40));assert.equal(save.p_fingerprint,'approved-copy');assert.deepEqual(save.p_content,version.content);assert.equal(JSON.parse(save.p_files['published-content.json']).version_number,null);assert.equal(save.p_files['evil.js'],undefined);
 assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'&&c.url.pathname.startsWith('/repos/')&&c.method!=='GET'),false);
 assert.equal(f.calls.some(c=>c.url.pathname.endsWith('/workspace_release_claim')),false);
});

test('preparation refuses a stale review fingerprint and the retired saved-version payload',async()=>{for(const body of [{operation:'prepare',id:uuid,fingerprint:'stale'},{operation:'prepare',id:uuid,version_id:version.id}]){const f=fixture({prepare:true}),r=await f.run(undefined,body);assert([400,409].includes(r.status));assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'),false);}});
