const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../shared-courses.js'), 'utf8');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../../common/courses/registry.json')));
function setup(invoke) {
  let state = {status:'member', role:'admin', user:{id:'first'}}, listener, events = 0;
  const window = {AIWiseAuth:{snapshot:()=>state,subscribe(fn){listener=fn;fn(state);}}, AIWiseBackend:{getClient:async()=>({functions:{invoke}})},dispatchEvent(){events++;}};
  require('./registry.cjs')(window);
  vm.runInNewContext(source, {window, Event:class {}});
  return {api:window.AIWiseSharedCourses, window, switchAccount(){state={...state,user:{id:'second'}};listener(state);}, events:()=>events};
}
const result = () => ({data:{ok:true,capability:'workspace-courses-v1',sha:'a'.repeat(40),commit:null,registry:raw},error:null});
test('fresh shared courses replace stale registry and notify consumers', async () => {
  const response=result();response.data.registry=structuredClone(raw);response.data.registry.courses.push({bachelor:'psychology',id:'test-course',name:'Test course',short_name:'Test'});
  const app=setup(async(name,args)=>{assert.equal(name,'workspace-courses');assert.equal(args.body.action,'load');return response;});
  await app.api.refresh();assert.equal(app.window.AIWiseCourseRegistry.course('psychology.test-course').name,'Test course');assert.equal(app.events(),1);
});
test('missing deployment and server conflicts do not announce success', async () => {
  const app=setup(async()=>({data:null,error:{context:{status:404,json:async()=>({code:'NOT_FOUND'})}}}));
  await assert.rejects(app.api.refresh(),/deploy workspace-courses/);assert.equal(app.events(),0);
  const conflict=setup(async()=>({data:null,error:{context:{status:409,json:async()=>({code:'registry_conflict'})}}}));
  await assert.rejects(conflict.api.save('create',{},'a'.repeat(40)),/shared list changed/);assert.equal(conflict.events(),0);
});
test('late response from another account is ignored', async () => {
  let resolve, entered; const invoked = new Promise(r=>entered=r); const app=setup(()=>new Promise(r=>{resolve=r;entered();}));
  const pending=app.api.refresh();await invoked;app.switchAccount();resolve(result());
  await assert.rejects(pending,/account changed/);assert.equal(app.events(),0);
});
test('unexpected old worker response is never accepted as a registry save', async () => {
  const app=setup(async()=>({data:{ok:true,processed:0},error:null}));
  await assert.rejects(app.api.save('create',{},'a'.repeat(40)),/needs an update/);assert.equal(app.events(),0);
});
