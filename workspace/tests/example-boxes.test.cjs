const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const id=n=>'box-11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const makeBox=(n,example)=>({id:id(n),slot:'c2.examples',template:'text',anchor:0,fields:[[{text:'WHAT THE MODEL DOES NOT KNOW'}],[{text:'Specific context',bold:true}]],align:'left',size:0,...(example===undefined?{}:{example,family:id(n)})});
function setup(boxes=[makeBox(1)]){
 const {document:doc}=parseHTML('<html><body><main><div class="carousel-wrapper"><div class="carousel-track" data-slot="c2.examples" data-slot-type="carousel"></div></div></main><div id="editor"></div></body></html>');
 Object.defineProperty(doc,'currentScript',{value:{src:'https://test/repo/pipelines/course-loader.js',hasAttribute:()=>true}});
 const window={},context={window,document:doc,URL,URLSearchParams,console,crypto,NodeFilter:{SHOW_TEXT:4}};
 for(const file of ['pipelines/common-content.js','pipelines/course-loader.js','workspace/studio-editing.js'])vm.runInNewContext(read(file),context);
 const examples=[0,1,2].map(i=>({title:'Example '+i,thinking:'Thinking '+i,typing:'Prompt '+i,processing:'Response '+i}));
 const s={isCommon:false,chapter:'c2',locale:'en',blocksEnabled:true,exampleBoxesEnabled:true,values:{'c2.examples':examples,_studio:{version:1,boxes,formats:[]}},frame:{contentDocument:doc},undo:[],redo:[]};
 let selected=0;const host=doc.getElementById('editor'),E=window.AIWiseStudioEditing,M=window.AIWiseStudioBlocks;
 const render=()=>{window.AIWiseCourseRenderer.fillSlots({c2:{examples:s.values['c2.examples']},_studio:{c2:s.values._studio}},doc);E.examplePreview(s);};
 const open=i=>{selected=i;host.replaceChildren();E.panel(s,host,{path:'c2.examples',example:i});};
 s.blockEditing={update:render,controls(){},message(){},open(){open(selected);}};render();open(0);
 const click=label=>{const btn=[...host.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(btn,label);btn.click();};
 return {s,doc,host,E,M,render,open,click,window};
}
test('legacy box is preserved in first example; reminders exist only in editing preview',()=>{
 const {s,doc,M,render,window:w}=setup(),before=JSON.stringify(s.values);
 for(let i=0;i<2;i++){render();assert.equal(doc.querySelectorAll('[data-studio-box]').length,1);assert.equal(doc.querySelectorAll('.carousel-card')[0].querySelectorAll('[data-studio-box]').length,1);assert.equal(doc.querySelectorAll('[data-studio-reminder]').length,2);assert.match(doc.querySelector('[data-studio-reminder]').textContent,/Added in Example 1/);assert.equal(doc.querySelector('[data-studio-reminder]').textContent.includes('Specific context'),false);}
 assert.equal(JSON.stringify(s.values),before);
 w.AIWiseCourseRenderer.fillSlots({c2:{examples:s.values['c2.examples']},_studio:{c2:s.values._studio}},doc);
 assert.equal(doc.querySelectorAll('[data-studio-reminder]').length,0);assert.equal(doc.querySelectorAll('[data-studio-box]').length,1);assert.ok(M.valid(s.values._studio,s.values));
});
test('import creates one independent copy; other examples are unaffected and reminders are deduplicated',()=>{
 const {s,doc,E,M,open,host,click,render}=setup();open(1);assert.equal(host.querySelector('textarea'),null);
 click('Add this box to this version');assert.equal(s.values._studio.boxes.length,2);const [a,b]=s.values._studio.boxes;assert.notEqual(a.id,b.id);assert.equal(b.family,a.id);assert.equal(b.example,1);
 b.fields[1][0].text='Only example B';render();assert.equal(a.fields[1][0].text,'Specific context');assert.equal(doc.querySelectorAll('[data-studio-box]').length,2);assert.equal(doc.querySelectorAll('[data-studio-reminder]').length,1);
 assert.equal(E.exampleReminders(s,1).length,0);E.addExampleBox(s,a,1);assert.equal(s.values._studio.boxes.length,2);assert.ok(M.valid(s.values._studio,s.values));
 const saved=JSON.parse(JSON.stringify(s.values));s.values=saved;render();assert.match(doc.querySelectorAll('.carousel-card')[1].textContent,/Only example B/);
});
test('new boxes belong to selected example; reorder, duplicate, remove and Undo/Redo preserve ownership',()=>{
 const {s,open,click,M}=setup([]);open(1);click('Add text box');const b=s.values._studio.boxes[0];assert.equal(b.example,1);assert.equal(b.family,b.id);
 click('Move up');assert.equal(s.values['c2.examples'][0].title,'Example 1');assert.equal(s.values._studio.boxes[0].example,0);
 click('Undo');assert.equal(s.values._studio.boxes[0].example,1);click('Redo');assert.equal(s.values._studio.boxes[0].example,0);
 open(0);click('Duplicate card');assert.equal(s.values._studio.boxes.length,2);assert.deepEqual(Array.from(s.values._studio.boxes,b=>b.example),[0,1]);assert.notEqual(s.values._studio.boxes[0].id,s.values._studio.boxes[1].id);assert.equal(s.values._studio.boxes[0].family,s.values._studio.boxes[1].family);
 open(0);click('Remove card');assert.equal(s.values._studio.boxes.length,1);assert.equal(s.values._studio.boxes[0].example,0);assert.ok(M.valid(s.values._studio,s.values));
});
test('metadata is bounded to existing C2 examples; duplicate families and unsupported placements fail',()=>{
 const {s,M}=setup([makeBox(1,0)]);assert.ok(M.valid(s.values._studio,s.values));
 for(const mutate of [b=>b.example=-1,b=>b.example=3,b=>b.example=0.5,b=>b.example=null,b=>b.example='1',b=>b.family='bad',b=>delete b.family,b=>delete b.example,b=>b.anchor=1,b=>b.slot='c2.other',b=>b.template='dual-card']){
  const v=JSON.parse(JSON.stringify(s.values));v['c2.other']='text';mutate(v._studio.boxes[0]);assert.equal(M.valid(v._studio,v),false);
 }
 const v=JSON.parse(JSON.stringify(s.values));v._studio.boxes.push({...v._studio.boxes[0],id:id(2)});assert.equal(M.valid(v._studio,v),false);
});
test('unactivated backend cannot create example metadata, including by direct reminder call',()=>{
 const {s,E,open,host}=setup();s.exampleBoxesEnabled=false;open(1);
 assert.ok([...host.querySelectorAll('button')].filter(b=>['Add text box','Add this box to this version','Duplicate card','Move up','Remove card'].includes(b.textContent)).every(b=>b.disabled));
 const before=JSON.stringify(s.values);E.addExampleBox(s,s.values._studio.boxes[0],1);assert.equal(JSON.stringify(s.values),before);
});
