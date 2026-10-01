import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createHandler,artifact} from '../functions/github-publish/index.ts';
const pem=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
const uuid='11111111-1111-4111-8111-111111111111',lease='22222222-2222-4222-8222-222222222222';
const copy={sequence:1,submission_id:uuid,course:'common',chapter:'c1',locale:'en',lease_token:lease,payload:{schema:1,course:'common',chapter:'c1',locale:'en',submission_id:uuid,source_release:null,approved_at:'2026-10-01T00:00:00Z',slots:{'c1.block-0':{'Heading 1':'Approved <text>'}},author_name:'PRIVATE',decision_reason:'PRIVATE'}};
function fixture(options={}){
 let queued=structuredClone(copy),head='a'.repeat(40),counter=0,stored=null,lastCommit=null,state='queued',conflict=!!options.conflict,lost=!!options.lost,ack=!!options.ack;
 const calls=[],finished=[],trees=new Map(),commits=new Map(),updates=[];
 const json=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const fetch=async(input,init={})=>{
  const url=new URL(input),body=init.body?JSON.parse(init.body):null,method=init.method||'GET',p=url.pathname;calls.push({url,body,method,headers:init.headers});
  if(url.hostname==='unit.supabase.co'){
   if(p==='/auth/v1/user')return json({id:uuid});
   if(p.endsWith('/workspace_role'))return json(options.role||'admin');
   if(p.endsWith('/workspace_github_status'))return json(true);
   if(p.endsWith('/workspace_github_check_worker'))return json(body.p_secret==='f'.repeat(64));
   if(p.endsWith('/workspace_github_claim')){if(state!=='queued')return json(null);state='processing';return json(queued);}
   if(p.endsWith('/workspace_github_lease_valid'))return json(!options.expired);
   if(p.endsWith('/workspace_github_finish')){
    if(ack){ack=false;return json({},500);}
    finished.push(body);state=body.p_error?'deferred':body.p_superseded?'superseded':'committed';return json(true);
   }
   if(p==='/rest/v1/workspace_github_jobs'){if(method==='PATCH'){updates.push(body);return json(null,204);}return json(options.deploy&&state==='committed'?[{sequence:1,commit_sha:lastCommit,created_at:'2026-10-01T00:00:00Z'}]:[]);}
  }
  if(url.hostname==='api.github.com'){
   if(p==='/orgs/AIWise-EUR/installation')return json({id:42,account:{login:'AIWise-EUR',type:'Organization'},permissions:{contents:'write',actions:'read'}});
   if(p==='/app/installations/42/access_tokens'){assert.deepEqual(body.repositories,['AIWiseModule_Beta']);assert.deepEqual(body.permissions,{contents:'write',actions:'read'});return json({token:'INSTALLATION_SECRET'});}
   if(p==='/installation/token')return json(null,204);
   assert.ok(p.startsWith('/repos/AIWise-EUR/AIWiseModule_Beta/'),'Only Beta repository is accessible');
   if(p.endsWith('/git/ref/heads/development'))return json({object:{sha:head}});
   if(p.includes('/contents/'))return stored?json(stored):json({},404);
   if(p.includes('/git/commits/')&&method==='GET')return json({tree:{sha:'b'.repeat(40)}});
   if(p.endsWith('/git/trees')){assert.equal(body.base_tree,'b'.repeat(40));assert.equal(body.tree.length,1);const sha=(++counter).toString(16).padStart(40,'0');trees.set(sha,JSON.parse(body.tree[0].content));return json({sha});}
   if(p.endsWith('/git/commits')){const sha=(++counter).toString(16).padStart(40,'0');commits.set(sha,body);return json({sha});}
   if(p.endsWith('/git/refs/heads/development')){
    assert.equal(body.force,false);const c=commits.get(body.sha);
    if(conflict){conflict=false;head='c'.repeat(40);return json({},422);}
    assert.equal(c.parents[0],head);head=body.sha;lastCommit=body.sha;stored=trees.get(c.tree);
    if(lost){lost=false;throw Error('Uncertain network response containing SECRET');}
    return json({object:{sha:head}});
   }
   if(p.endsWith('/commits'))return json([{sha:lastCommit}]);
   if(p.endsWith('/actions/runs'))return json({workflow_runs:[{id:99,name:'pages build and deployment',head_sha:lastCommit,head_branch:'development',status:'completed',conclusion:options.deploy==='failure'?'failure':'success'}]});
  }
  throw Error('Unexpected '+method+' '+url);
 };
 const handler=createHandler({env:n=>({SUPABASE_URL:'https://unit.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'SERVICE_SECRET',SUPABASE_ANON_KEY:'public',AIWISE_GITHUB_CLIENT_ID:'Iv1.example',AIWISE_GITHUB_PRIVATE_KEY:pem})[n],fetch,now:()=>Date.parse('2026-10-01T02:00:00Z')});
 const run=(headers={Authorization:'Bearer a.b.c'},body={})=>handler(new Request('https://unit.supabase.co/functions/v1/github-publish',{method:'POST',headers,body:JSON.stringify(body)}));
 return{run,calls,finished,updates,retry:()=>state='queued',setJob:j=>queued=j,setStored:v=>stored=v,get stored(){return stored;}};
}
test('admin approval commits only sanitized approved data to the fixed Beta path, then revokes the token',async()=>{
 const f=fixture(),r=await f.run(undefined,{repository:'AI-Wise',path:'.github/workflows/evil.yml',slots:'UNTRUSTED'});
 assert.equal(r.status,200);assert.equal((await r.json()).completed,1);assert.equal(f.finished[0].p_error,null);
 assert.equal(f.stored.slots['c1.block-0']['Heading 1'],'Approved <text>');assert.ok(!JSON.stringify(f.stored).includes('PRIVATE'));
 assert.equal(f.calls.filter(c=>c.url.pathname.endsWith('/git/trees'))[0].body.tree[0].path,'content/approved/en/common/c1.json');
 assert.equal(f.calls.at(-1).url.pathname,'/installation/token');
});
test('member, guest and invalid scheduled secret cannot reach GitHub or claim a job',async()=>{
 for(const [opts,headers,status]of [[{role:'member'},{Authorization:'Bearer a.b.c'},403],[{}, {},401],[{},{'x-aiwise-worker':'e'.repeat(64)},401]]){
  const f=fixture(opts),r=await f.run(headers);assert.equal(r.status,status);assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'||c.url.pathname.endsWith('/workspace_github_claim')),false);
 }
});
test('scheduled worker uses its validated secret without a user session',async()=>{const f=fixture();assert.equal((await f.run({'x-aiwise-worker':'f'.repeat(64)})).status,200);assert.equal(f.calls.some(c=>c.url.pathname==='/auth/v1/user'),false);});
test('concurrent code commit causes a fresh-tree retry without force or unrelated file changes',async()=>{const f=fixture({conflict:true});assert.equal((await f.run()).status,200);const writes=f.calls.filter(c=>c.url.pathname.endsWith('/git/commits')&&c.method==='POST');assert.equal(writes.length,2);assert.equal(writes[1].body.parents[0],'c'.repeat(40));});
test('lost ref-update response is recovered without duplicate commits',async()=>{const f=fixture({lost:true});await f.run();assert.equal(f.finished[0].p_error,'connection_unavailable');f.retry();await f.run();assert.equal(f.finished.at(-1).p_error,null);assert.equal(f.calls.filter(c=>c.url.pathname.endsWith('/git/commits')&&c.method==='POST').length,1);});
test('lost database acknowledgement is recovered from the committed artifact',async()=>{const f=fixture({ack:true});assert.equal((await f.run()).status,502);f.retry();await f.run();assert.equal(f.finished.at(-1).p_error,null);assert.equal(f.calls.filter(c=>c.url.pathname.endsWith('/git/commits')&&c.method==='POST').length,1);});
test('expired worker cannot advance the branch',async()=>{const f=fixture({expired:true});await f.run();assert.equal(f.finished[0].p_error,'lease_expired');assert.equal(f.calls.some(c=>c.method==='PATCH'&&c.url.hostname==='api.github.com'),false);});
test('old queued approval never overwrites a newer artifact',async()=>{const f=fixture();f.setStored({...artifact(copy).value,sequence:2});await f.run();assert.equal(f.finished[0].p_superseded,true);assert.equal(f.calls.some(c=>c.method==='PATCH'&&c.url.hostname==='api.github.com'),false);});
test('same sequence with changed content stops instead of overwriting a manual edit',async()=>{const f=fixture();f.setStored({...artifact(copy).value,slots:{'c1.block-0':{'Heading 1':'Someone else changed this'}}});await f.run();assert.equal(f.finished[0].p_error,'artifact_conflict');});
test('invalid content paths are rejected before GitHub credentials are used',async()=>{const f=fixture();f.setJob({...copy,course:'../../AI-Wise'});await f.run();assert.equal(f.finished[0].p_error,'invalid_job');assert.equal(f.calls.some(c=>c.url.hostname==='api.github.com'),false);});
test('Pages success and failure are recorded independently of a successful commit',async()=>{for(const deploy of ['success','failure']){const f=fixture({deploy});await f.run();assert.equal(f.finished[0].p_error,null);assert.equal(f.updates[0].deployment_status,deploy);assert.equal(f.updates[0].deployment_run_id,99);}});
test('Common map and course EN/NL slots produce separate artifacts',()=>{for(const course of ['common','aws1','ped','other'])for(const locale of ['en','nl']){const chapter=course==='common'?'map':'c3';const job={...copy,course,chapter,locale,payload:{...copy.payload,course,chapter,locale,slots:{[chapter+'.label']:'Text'}}};assert.equal(artifact(job).path,`content/approved/${locale}/${course}/${chapter}.json`);}});
