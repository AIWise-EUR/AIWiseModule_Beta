const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../shared-studio.js'),'utf8');
function setup({response={base:{item:'old'},draft:{item:'new'},latest:{item:'old'},release:null},error=null}={}){
 const calls=[];let state={status:'member',role:'admin',user:{id:'admin'}};
 const window={AIWiseAuth:{snapshot:()=>state,subscribe(){}},AIWiseBackend:{getClient:async()=>({rpc(name,args){calls.push({name,args});return {abortSignal:async()=>({data:response,error})};}})}};
 vm.runInNewContext(source,{window,AbortController,setTimeout,clearTimeout});
 return {api:window.AIWiseSharedStudio,calls,switchAccount(){state={...state,user:{id:'other'}};}};
}
test('installed approval works even when a later setup erased the advisory flag',async()=>{
 const app=setup();const c=await app.api.prepareApproval('pending-nl',1);
 assert.equal(c.draft.item,'new');assert.deepEqual(app.calls.map(c=>c.name),['workspace_prepare_content_approval']);
});
test('source/version and permission failures stay failures; never use legacy approval',async()=>{
 for(const message of ['English source changed. Request a translation revision.','Administrator permission is required.','This request already changed. Refresh before reviewing.']){
  const app=setup({error:{message}});await assert.rejects(app.api.prepareApproval('id',1),e=>e.message===message);
  assert.deepEqual(app.calls.map(c=>c.name),['workspace_prepare_content_approval']);
 }
});
test('missing service and malformed responses do not open an unsafe comparison',async()=>{
 const absent=setup({error:{code:'PGRST202'}});await assert.rejects(absent.api.prepareApproval('id',1),/setup is not ready/);
 for(const response of [null,{base:{},draft:{},latest:{}},{base:[],draft:{},latest:{},release:null}]){
  await assert.rejects(setup({response}).api.prepareApproval('id',1),/incompatible comparison/);
 }
});
