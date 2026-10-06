const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const seed=()=>JSON.parse(read('course-specific/ped/ped.json')).c2.sat_example;
function setup(){
 const {document}=parseHTML('<html><body><main><div data-slot="c2.sat_example" data-slot-type="sat-example"></div></main></body></html>');
 Object.defineProperty(document,'currentScript',{value:{src:'https://test/repo/pipelines/course-loader.js',hasAttribute:()=>true}});
 const window={},context={document,window,URL,URLSearchParams,console,NodeFilter:{SHOW_TEXT:4}};
 for(const p of ['pipelines/common-content.js','pipelines/course-loader.js','workspace/studio-editing.js'])vm.runInNewContext(read(p),context);
 return {document,window};
}
test('empty SAT cycles are hidden without modifying saved data; later cycles and exact rich-text paths stay intact',()=>{
 const {window:w,document:doc}=setup(),sat=seed();sat.phases[1].steps.forEach(s=>s.text=' \n ');sat.phases[2].steps[0].text=sat.phases[0].steps[0].text;
 const data={c2:{sat_example:sat},_studio:{c2:{version:1,boxes:[],formats:[{slot:'c2.sat_example',path:['phases','2','steps','0','text'],runs:[{text:sat.phases[2].steps[0].text,bold:true}]}]}}},before=JSON.stringify(data);
 for(let i=0;i<2;i++){
  w.AIWiseCourseRenderer.fillSlots(data,doc);
  assert.deepEqual([...doc.querySelectorAll('.sat-phase')].map(n=>n.dataset.satPhase),['0','2']);
  assert.equal(doc.querySelector('[data-sat-phase="0"] [data-studio-rich]'),null);
  assert.ok(doc.querySelector('[data-sat-phase="2"] [data-studio-rich]'));
 }
 assert.equal(JSON.stringify(data),before);
});
test('only SAT phases can vary, including delete all and add back; malformed steps and unknown keys fail',()=>{
 const M=setup().window.AIWiseStudioBlocks,base={'c2.sat_example':seed(),'c2.other':['fixed']};
 for(const phases of [[],seed().phases.slice(0,2),[...seed().phases,...seed().phases]])assert.ok(M.validCopy({...base,'c2.sat_example':{...seed(),phases}},base));
 const empty={...base,'c2.sat_example':{...seed(),phases:[]}};assert.ok(M.validCopy(base,empty));
 for(const mutate of [v=>v['c2.other'].push('bad'),v=>v['c2.sat_example'].phases[0].steps.pop(),v=>v['c2.sat_example'].phases[0].steps[0].actor='script',v=>v['c2.sat_example'].phases[0].extra='bad',v=>v['c2.sat_example'].phases=Array(51).fill(seed().phases[0])]){
  const bad=structuredClone(base);mutate(bad);assert.equal(M.validCopy(bad,base),false);
 }
});
test('per-box add/delete preserves formats on surviving cycles and Undo/Redo restores both data and formatting',()=>{
 const {window:w,document:doc}=setup(),item={path:'c2.sat_example'},host=doc.createElement('div'),field=()=>doc.createElement('label');doc.body.append(host);
 const s={locale:'en',blocksEnabled:true,satPhasesEnabled:true,values:{[item.path]:seed(),_studio:{version:1,boxes:[],formats:[{slot:item.path,path:['phases','2','steps','0','text'],runs:[{text:seed().phases[2].steps[0].text,bold:true}]}]}},undo:[],redo:[],frame:{contentDocument:doc}};
 const draw=()=>{host.replaceChildren();w.AIWiseStudioEditing.satPanel(s,host,item,field);w.AIWiseStudioEditing.panel(s,host,item);};
 s.blockEditing={update(){},controls(){},message(){},open:draw};draw();
 const original=JSON.stringify(s.values);host.querySelector('button[aria-label^="Delete box 2"]').click();
 assert.equal(s.values[item.path].phases.length,2);assert.equal(s.values._studio.formats[0].path[1],'1');
 [...host.querySelectorAll('button')].find(b=>b.textContent==='Undo').click();assert.equal(JSON.stringify(s.values),original);
 [...host.querySelectorAll('button')].find(b=>b.textContent==='Redo').click();assert.equal(s.values[item.path].phases.length,2);
 [...host.querySelectorAll('button')].find(b=>b.textContent==='Add Self–Team box').click();assert.equal(s.values[item.path].phases.at(-1).label,'Self–Team');
 assert.ok(s.values[item.path].phases.at(-1).steps.every(step=>step.text===''));
 s.blocked=true;draw();assert.ok([...host.querySelectorAll('.cs-sat-box button')].every(b=>b.disabled));
 const before=JSON.stringify(s.values);[...host.querySelectorAll('button')].find(b=>b.textContent==='Add Self–AI box').onclick();assert.equal(JSON.stringify(s.values),before);
});
