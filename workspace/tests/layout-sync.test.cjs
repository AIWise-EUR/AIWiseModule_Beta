const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/layout-sync.js'),'utf8'),ctx);
const L=ctx.window.AIWiseLayoutSync,copy=v=>JSON.parse(JSON.stringify(v));
const box=(id,text)=>({id,slot:'c2.examples',template:'text',anchor:0,example:0,family:id,fields:[[{text}],[{text:'Body '+text,bold:true}]],align:'left',size:0});
const base=()=>({'c2.examples':[{title:'A',thinking:'Original A',typing:'',processing:''},{title:'B',thinking:'Original B',typing:'',processing:''}],'c2.sat_example':{phases:[],note:''},_studio:{version:1,boxes:[box('box-11111111-1111-4111-8111-111111111111','Original box')],formats:[]}});
test('both directions preserve translated text and formatting through moves, duplication and removal',()=>{
 for(const locale of ['en','nl']){
  const b=base(),peer=base();peer['c2.examples'][0].thinking=locale+' translation A';peer['c2.examples'][1].thinking=locale+' translation B';
  peer._studio.formats=[{slot:'c2.examples',path:['0','thinking'],runs:[{text:locale+' translation A',italic:true}]}];
  peer._studio.boxes[0].fields[1][0].text=locale+' translated box';
  const next=copy(b);next['c2.examples']=[next['c2.examples'][1],next['c2.examples'][0],copy(next['c2.examples'][0]),{title:'New',thinking:'Source text',typing:'',processing:''}];next._studio.boxes[0].example=1;
  const result=copy(L.project(b,next,peer,{'c2.examples':[1,0,0,null],'c2.sat_example':[]}));
  assert.deepEqual(result['c2.examples'].map(x=>x.thinking),[locale+' translation B',locale+' translation A',locale+' translation A','']);
  assert.deepEqual(result._studio.formats.map(f=>f.path[0]),['1','2']);
  assert.equal(result._studio.boxes[0].fields[1][0].text,locale+' translated box');assert.equal(result._studio.boxes[0].example,1);
  assert.equal(peer['c2.examples'][0].thinking,locale+' translation A');
 }
});
test('text edits are independent; structure and duplicate blank-item moves are tracked',()=>{
 const b=base(),next=copy(b);next['c2.examples'][0].thinking='Independent text';
 assert.equal(L.changed(b,next,{'c2.examples':[0,1],'c2.sat_example':[]}),false);
 assert.equal(L.changed(b,next,{'c2.examples':[1,0],'c2.sat_example':[]}),true);
 const s={base:b,values:copy(b),layoutPeer:{slots:copy(b)},locale:'nl'};L.initialize(s,null);
 const before=s.values['c2.examples'].slice();s.values['c2.examples'].reverse();L.remap(s,'c2.examples',before,s.values['c2.examples']);
 assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[1,0]);
 const saved={layoutPlan:copy(s.layoutPlan)};L.initialize(s,saved);assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[1,0]);
});
test('initial English layout keeps language-specific boxes and never overwrites text or source snapshots',()=>{
 const b=base(),peer=base();peer._studio.boxes.push(box('box-22222222-2222-4222-8222-222222222222','English extra'));
 b._studio.boxes[0].fields[0][0].text='Bestaande titel';
 const original=copy(b),s={base:b,values:copy(b),locale:'nl',layoutPeer:{slots:peer}};
 L.initialize(s,null);
 assert.equal(s.values._studio.boxes.length,2);assert.equal(s.values._studio.boxes[0].fields[0][0].text,'Bestaande titel');
 assert.equal(s.values._studio.boxes[1].fields[0][0].text,'');assert.deepEqual(b,original);
 const stale=copy(s.layoutPlan);stale.peer_release='old';L.initialize(s,{layoutPlan:stale});assert.equal(s.layoutPeerChanged,true);
});
test('ambiguous array sizes and malformed mappings refuse synchronization without changing copies',()=>{
 const b=base(),peer=base(),before=copy(peer);peer['c2.examples'].pop();
 assert.throws(()=>L.project(b,b,peer,{'c2.examples':[0,1],'c2.sat_example':[]}),/different item structures/);
 assert.throws(()=>L.project(b,b,b,{'c2.examples':[0,7],'c2.sat_example':[]}),/different item structures/);
 assert.deepEqual(b,before);
});
test('recovery refuses ambiguous example and SAT rebase; latest lists reset origin mappings',()=>{
 const b=base(),s={base:copy(b)},saved={baseExamples:copy(b['c2.examples']),baseSlots:{'c2.sat_example':{phases:[],note:''}},layoutPlan:{maps:{'c2.examples':[1,0],'c2.sat_example':[]}}};
 s.base['c2.examples'][0].title='New approved title';
 assert.throws(()=>L.recoveredPlan(s,saved,b),/order changed/);
 assert.deepEqual(copy(L.recoveredPlan(s,saved,s.base).layoutPlan.maps['c2.examples']),[0,1]);
 const phase={label:'Nieuw',steps:[{actor:'team',name:'Naam',text:'Vertaling'}]};
 s.base['c2.sat_example'].phases.push(phase);
 assert.deepEqual(copy(L.recoveredPlan(s,saved,s.base).layoutPlan.maps['c2.sat_example']),[0]);
 assert.equal(saved.layoutPlan.maps['c2.examples'][0],1);
});
