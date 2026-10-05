const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
function setup(){const window={},document={currentScript:{hasAttribute:()=>true}};vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),{window,document,NodeFilter:{SHOW_TEXT:4}});return window;}
function seed(){const w=setup(),doc=parseHTML(fs.readFileSync(path.join(root,'common/aiwise-c2-final.html'),'utf8')).document,blocks=w.AIWiseCommonContent.catalog(doc,'c2'),slots=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}])),block=blocks.find(b=>b.node.matches('.gradient-rows'));return {w,doc,blocks,slots,block};}
const box=(slot)=>({id:'box-11111111-1111-4111-8111-111111111111',slot,template:'gradient-row',anchor:2,fields:[[{text:'Intersubjective meaning-making: stimulated, not lived',bold:true}],[{text:'Human understanding develops through interaction.',color:'#2b646a'}]],align:'left',size:16});
test('C2 new box keeps the original gradient design, order, fields and IDs; repeated preview is stable',()=>{
 const {w,doc,blocks,slots,block}=seed();assert.ok(block);const before=Object.keys(slots),old=doc.querySelectorAll('.gradient-row').length;
 slots._studio={version:1,formats:[],boxes:[box(block.path)]};assert.ok(w.AIWiseStudioBlocks.validCopy(slots,w.AIWiseStudioBlocks.clean(slots)));
 w.AIWiseCommonContent.apply(doc,'c2',slots,blocks);
 let added=doc.querySelector('[data-studio-box]');assert.ok(added.matches('.gradient-row'));assert.match(added.previousElementSibling.textContent,/Motor and bodily/);assert.match(added.textContent,/Intersubjective/);assert.equal(doc.querySelectorAll('.gradient-row').length,old+1);
 w.AIWiseCommonContent.apply(doc,'c2',slots,blocks);assert.equal(doc.querySelectorAll('[data-studio-box]').length,1);assert.deepEqual(Object.keys(w.AIWiseStudioBlocks.clean(slots)),before);
 for(const b of blocks)assert.deepEqual(Array.from(b.nodes,n=>n.nodeValue),Object.values(slots[b.path]));
});
test('partial formatting is safe text, survives repeated edits, and cannot inject HTML or CSS',()=>{
 const {w,doc,blocks,slots}=seed(),M=w.AIWiseStudioBlocks,b=blocks[0],key=Object.keys(b.fields)[0];slots[b.path][key]='<img src=x> Hello';
 const runs=M.format(M.rich(slots[b.path][key]),12,17,'bold',true);slots._studio={version:1,formats:[{slot:b.path,path:[key],runs}],boxes:[]};
 assert.ok(M.valid(slots._studio,slots));w.AIWiseCommonContent.apply(doc,'c2',slots,blocks);assert.equal(b.node.querySelector('img'),null);assert.match(b.node.innerHTML,/font-weight:700/);
 w.AIWiseCommonContent.apply(doc,'c2',slots,blocks);assert.equal(doc.querySelectorAll('[data-studio-rich]').length,1);
 const evil=structuredClone(slots._studio);evil.formats[0].runs[0].color='url(javascript:x)';assert.equal(M.valid(evil,slots),false);
 const wrong=structuredClone(slots._studio);wrong.formats[0].runs[0].text='different';assert.equal(M.valid(wrong,slots),false);
});
test('legacy copy stays valid; only the supported C2 list can grow; unknown extensions are rejected',()=>{
 const M=setup().AIWiseStudioBlocks,base={'c2.examples':[{title:'One',thinking:'a',typing:'b',processing:'c'}],'c2.other':['fixed']};
 assert.ok(M.validCopy(base,base));assert.ok(M.validCopy({...base,'c2.examples':[...base['c2.examples'],{...base['c2.examples'][0],title:'Two'}]},base));
 assert.equal(M.validCopy({...base,'c2.other':['fixed','extra']},base),false);assert.equal(M.validCopy({...base,_studio:{version:99,formats:[],boxes:[]}},base),false);
});
test('Control Tower bridge preserves the optional extension in its frozen submission',async()=>{
 const {w,slots,block}=seed();slots._studio={version:1,formats:[],boxes:[box(block.path)]};const baseSlots=w.AIWiseStudioBlocks.clean(slots),store=new Map(),calls=[];
 Object.assign(w,{addEventListener(){},AIWiseAuth:{subscribe(){}},AIWiseSharedStudio:{submit:async data=>{calls.push(data);return {id:'saved'};}}});
 vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/control-tower.js'),'utf8'),{window:w,localStorage:{getItem:k=>store.get(k)||null}});
 const raw=JSON.stringify({schema:1,scope:'common',chapter:'c2',savedAt:new Date().toISOString(),slots,baseSlots});store.set('aiwise_common_studio_c2_v1',raw);
 await w.AIWiseControlTower.submitCommonDraft({chapter:'c2',raw,slots,baseSlots,summary:'Add a box'});assert.equal(calls[0].slots._studio.boxes[0].id,slots._studio.boxes[0].id);
});

test('real course example cards allow optional context notes when cards are added',()=>{
 const M=setup().AIWiseStudioBlocks,data=JSON.parse(fs.readFileSync(path.join(root,'course-specific/aws1/course-specific-content_aws1.json'),'utf8'));
 const base={'c2.examples':data.c2.examples},next=structuredClone(base);next['c2.examples'].push({title:'New',thinking:'',typing:'',processing:''});assert.ok(M.validCopy(next,base));
});
