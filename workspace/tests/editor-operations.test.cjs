const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),copy=v=>JSON.parse(JSON.stringify(v));
function setup(values,extra={}){
 const {document}=parseHTML('<html><body><main><div data-slot="c2.examples"></div><div data-slot="c2.sat_example"></div></main><div id="editor"></div></body></html>');
 Object.defineProperty(document,'currentScript',{value:{hasAttribute:()=>true}});
 const window={},context={window,document,crypto,NodeFilter:{SHOW_TEXT:4}};
 for(const file of ['pipelines/common-content.js','workspace/layout-sync.js','workspace/studio-editing.js'])vm.runInNewContext(read(file),context);
 const E=window.AIWiseStudioEditing,host=document.getElementById('editor'),calls=[];
 const s={values:copy(values),base:copy(values),locale:'en',blocksEnabled:true,exampleBoxesEnabled:true,satPhasesEnabled:true,undo:[],redo:[],frame:{contentDocument:document},...extra};
 let item={path:'c2.examples',example:0};
 const open=(next=item)=>{item=next;host.replaceChildren();E.panel(s,host,item);};
 s.blockEditing={update(){calls.push('preview');},controls(){calls.push('controls');},message(text){calls.push(text);},open(){open();}};
 const click=label=>{const button=[...host.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(button,label);button.click();};
 return {s,E,host,document,window,calls,open,click};
}
const examples=()=>({'c2.examples':[0,1,2].map(i=>({title:'Example '+i,thinking:'Think '+i,typing:'Prompt '+i,processing:'Response '+i}))});
const box=(index=0)=>({id:'box-11111111-1111-4111-8111-111111111111',slot:'c2.examples',template:'text',anchor:0,example:index,family:'box-11111111-1111-4111-8111-111111111111',fields:[[{text:'Context'}],[{text:'Hello',bold:true},{text:' world',italic:true}]],align:'left',size:0});

test('every approved language/scope/chapter keeps its exact original snapshot and unrelated data when a text leaf changes',()=>{
 let checked=0;
 function leaves(value,p=[]){return typeof value==='string'?[{p,value}]:value&&typeof value==='object'?Object.entries(value).flatMap(([key,v])=>leaves(v,[...p,key])):[];}
 for(const locale of ['en','nl'])for(const scope of ['common','psychology','pedagogical-sciences','dpas']){
  const dir=path.join(root,'content/approved',locale,scope);
  for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
   const approved=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
   const {s,E,calls}=setup(approved.slots,{locale});
   const snapshot=JSON.stringify(s.values),slot=Object.keys(s.values).find(k=>k!=='_studio'&&leaves(s.values[k]).length),leaf=leaves(s.values[slot])[0];
   const target=E.slotTarget(s,slot,leaf.p);
   assert.equal(JSON.stringify(s.values),snapshot,'constructing a target must not migrate data');
   E.editText(s,target,leaf.value+' — Nederlands 🙂',{notify:()=>calls.push('field-notification')});
   assert.equal(JSON.stringify(s.undo[0]),snapshot);
   assert.deepEqual(calls,['field-notification']);
   for(const key of Object.keys(s.values).filter(k=>k!==slot&&k!=='_studio'))assert.deepEqual(s.values[key],approved.slots[key]);
   assert.deepEqual(s.values._studio?.boxes,approved.slots._studio?.boxes,'box IDs, order, translations and rich text stay untouched');
   assert.equal(JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'))),JSON.stringify(approved));
   checked++;
  }
 }
 assert.equal(checked,19);
});

test('plain edits preserve missing extension, optional context-note omission, and existing empty values',()=>{
 const {s,E}=setup(examples());
 E.editText(s,E.slotTarget(s,'c2.examples',['0','thinking']),'Changed');
 assert.equal(Object.hasOwn(s.values,'_studio'),false);
 E.editText(s,E.slotTarget(s,'c2.examples',['0','typing_note'],{omitEmpty:true}),'');
 assert.equal(Object.hasOwn(s.values['c2.examples'][0],'typing_note'),false);
 E.editText(s,E.slotTarget(s,'c2.examples',['0','typing_note']),'');
 assert.equal(s.values['c2.examples'][0].typing_note,'');
 s.values['c3.title']='Original';
 E.editText(s,E.slotTarget(s,'c3.title',[]),'New title');assert.equal(s.values['c3.title'],'New title');
});

test('typing preserves rich runs and stable field paths; Undo/Redo restores values and layout maps exactly',()=>{
 const values=examples();values['c2.examples'][0].thinking='Hello world';
 values._studio={version:1,boxes:[],formats:[{slot:'c2.examples',path:['0','thinking'],runs:[{text:'Hello',bold:true},{text:' world',italic:true}]}]};
 const {s,E,open,click}=setup(values,{layoutEnabled:true,layoutPlan:{maps:{'c2.examples':[0,1,2]}}});
 const original=JSON.stringify(s.values);open();
 E.editText(s,E.slotTarget(s,'c2.examples',['0','thinking']),'Hello! world');
 assert.deepEqual(copy(s.values._studio.formats[0].runs),[{text:'Hello',bold:true},{text:'!',bold:true},{text:' world',italic:true}]);
 assert.deepEqual(copy(s.values._studio.formats[0].path),['0','thinking']);
 const edited=JSON.stringify(s.values);click('Undo');assert.equal(JSON.stringify(s.values),original);assert.deepEqual(copy(s.layoutPlan.maps),{'c2.examples':[0,1,2]});
 click('Redo');assert.equal(JSON.stringify(s.values),edited);
});

test('added-box input and formatting share one history step per action and preserve identities',()=>{
 const values=examples();values._studio={version:1,formats:[],boxes:[box()]};
 const {s,E,host,open,click}=setup(values);open();const initial=JSON.stringify(s.values);
 let input=host.querySelectorAll('textarea')[1];input.value='Hello! world';input.oninput();
 assert.equal(s.undo.length,1);assert.equal(s.values._studio.boxes[0].id,box().id);assert.equal(s.values._studio.boxes[0].family,box().family);
 click('Undo');assert.equal(JSON.stringify(s.values),initial);click('Redo');
 input=host.querySelectorAll('textarea')[1];input.selectionStart=0;input.selectionEnd=5;input.setSelectionRange=()=>{};
 const wrap=input.parentElement,button=[...wrap.querySelectorAll('button')].find(b=>b.textContent==='Italic');
 const before=JSON.stringify(s.values),undo=s.undo.length;button.click();assert.equal(s.undo.length,undo+1);
 assert.equal(s.values._studio.boxes[0].fields[1][0].italic,true);click('Undo');assert.equal(JSON.stringify(s.values),before);
});

test('fourth-section opening stays read-only; typing creates only the selected example box and Undo removes it',()=>{
 const {s,E,host,open,click}=setup(examples()),original=JSON.stringify(s.values);open();E.unknownPanel(s,host,1);
 assert.equal(JSON.stringify(s.values),original);const input=host.querySelector('textarea');input.value='Alleen dit voorbeeld';input.oninput();
 assert.equal(s.values._studio.boxes.length,1);assert.equal(s.values._studio.boxes[0].example,1);assert.equal(s.undo.length,1);
 click('Undo');assert.equal(JSON.stringify(s.values),original);click('Redo');assert.equal(s.values._studio.boxes[0].fields[1][0].text,'Alleen dit voorbeeld');
});

test('legacy Dutch translation keeps its pre-refactor history policy and only changes its own text',()=>{
 const b=box();b.slot='common.slot';delete b.example;delete b.family;
 const values={'common.slot':{Text:'Dutch'},_studio:{version:1,formats:[],boxes:[b]}};
 // This path already used no undo snapshot. Preserve it here; changing that is a separate behavior fix.
 const original=JSON.stringify(values);
 const fixture=setup(values,{isCommon:true,locale:'nl',layoutEnabled:false,translationSync:true,englishApproved:copy(values)});
 fixture.window.AIWiseCommonStudio={translationField(){}};
 fixture.open({path:'common.slot'});const input=fixture.host.querySelectorAll('textarea')[1];input.value='Vertaling';input.oninput();
 assert.equal(fixture.s.undo.length,0);assert.equal(fixture.s.values._studio.boxes[0].fields[1].map(r=>r.text).join(''),'Vertaling');
 assert.equal(JSON.stringify(fixture.s.englishApproved),original);assert.equal(fixture.s.values._studio.boxes[0].id,b.id);
});

test('example reorder/duplicate/delete moves formatting, language maps and owned boxes together',()=>{
 const values=examples();values._studio={version:1,boxes:[box(1)],formats:[{slot:'c2.examples',path:['1','thinking'],runs:[{text:'Think 1',bold:true}]},{slot:'unrelated',path:[],runs:[{text:'Other'}]}]};
 const {s,open,click}=setup(values,{layoutEnabled:true,layoutPlan:{maps:{'c2.examples':[0,1,2]}}});
 const initial=JSON.stringify(s.values);open({path:'c2.examples',example:1});click('Move up');
 assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[1,0,2]);assert.equal(s.values._studio.formats[0].path[0],'0');assert.equal(s.values._studio.boxes[0].example,0);
 click('Undo');assert.equal(JSON.stringify(s.values),initial);assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[0,1,2]);
 open({path:'c2.examples',example:1});click('Duplicate card');
 assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[0,1,1,2]);assert.deepEqual(Array.from(s.values._studio.formats.filter(f=>f.slot==='c2.examples'),f=>f.path[0]),['1','2']);
 const [a,b]=s.values._studio.boxes;assert.notEqual(a.id,b.id);assert.equal(a.family,b.family);assert.equal(a.example,1);assert.equal(b.example,2);
 open({path:'c2.examples',example:1});click('Remove card');assert.deepEqual(copy(s.layoutPlan.maps['c2.examples']),[0,1,2]);assert.equal(s.values._studio.formats[0].path[0],'1');assert.equal(s.values._studio.boxes[0].id,b.id);
});

test('SAT remapping leaves note formats and unrelated boxes intact and restores mappings on Undo',()=>{
 const sat=JSON.parse(read('course-specific/ped/ped.json')).c2.sat_example,values={'c2.sat_example':sat,_studio:{version:1,boxes:[],formats:[{slot:'c2.sat_example',path:['note'],runs:[{text:sat.note}]},{slot:'c2.sat_example',path:['phases','2','steps','0','text'],runs:[{text:sat.phases[2].steps[0].text,bold:true}]}]}};
 const {s,E,host,document,click}=setup(values,{layoutEnabled:true,layoutPlan:{maps:{'c2.sat_example':[0,1,2]}}});
 const draw=()=>{host.replaceChildren();E.satPanel(s,host,{path:'c2.sat_example'},()=>document.createElement('label'));E.panel(s,host,{path:'c2.sat_example'});};s.blockEditing.open=draw;draw();
 const initial=JSON.stringify(s.values);host.querySelector('[aria-label^="Delete box 2"]').click();
 assert.deepEqual(copy(s.layoutPlan.maps['c2.sat_example']),[0,2]);assert.deepEqual(copy(s.values._studio.formats[0]),values._studio.formats[0]);assert.equal(s.values._studio.formats[1].path[1],'1');
 click('Undo');assert.equal(JSON.stringify(s.values),initial);assert.deepEqual(copy(s.layoutPlan.maps['c2.sat_example']),[0,1,2]);
 click('Add Self–AI box');assert.deepEqual(copy(s.layoutPlan.maps['c2.sat_example']),[0,1,2,null]);
});

test('language, capability, conflict and box-limit guards preserve existing edit boundaries',()=>{
 for(const flags of [{locale:'nl',layoutEnabled:false},{blocksEnabled:false},{exampleBoxesEnabled:false},{blocked:true},{layoutProblem:'Resolve first'}]){
  const {s,E,host}=setup(examples(),flags),before=JSON.stringify(s.values);E.unknownPanel(s,host,0);
  for(const input of host.querySelectorAll('input,textarea')){assert.ok(input.disabled);input.value='Must not be stored';input.oninput();}
  assert.equal(JSON.stringify(s.values),before);assert.equal(s.undo.length,0);
 }
 const values=examples();values._studio={version:1,formats:[],boxes:Array.from({length:50},(_,i)=>({...box(),id:'box-'+i,family:'box-'+i}))};
 const {s,E,host}=setup(values),before=JSON.stringify(s.values);E.unknownPanel(s,host,2);assert.ok(host.querySelector('textarea').disabled);assert.equal(JSON.stringify(s.values),before);
});
