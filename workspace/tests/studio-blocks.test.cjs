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
test('verified citation links span formatting runs without changing saved text, IDs or repeated previews',()=>{
 const {w,doc,blocks,slots}=seed(),M=w.AIWiseStudioBlocks;
 const runs=[{text:'See Passe',bold:true},{text:'port et al. ',italic:true},{text:'(2026)',color:'#123456',size:22},{text:'. <img src=x> https://untrusted.test'}];
 slots._studio={version:1,formats:[],boxes:[{id:'box-11111111-1111-4111-8111-111111111111',slot:blocks[0].path,template:'text',anchor:0,fields:[[{text:'Reading'}],runs],align:'left',size:0}]};
 const saved=JSON.stringify(slots),catalog=JSON.stringify(w.AIWiseCommonContent.catalog(doc,'c2').map(b=>[b.path,Object.keys(b.fields)]));
 for(let i=0;i<2;i++){
  w.AIWiseCommonContent.apply(doc,'c2',slots,blocks);
  const box=doc.querySelector('[data-studio-box]'),links=box.querySelectorAll('a');assert.equal(links.length,1);
  const a=links[0];assert.equal(a.textContent,'Passeport et al. (2026)');assert.equal(a.getAttribute('href'),'https://doi.org/10.5281/zenodo.21893023');assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');
  assert.equal(a.children[0].style.fontWeight,'700');assert.equal(a.children[1].style.fontStyle,'italic');assert.equal(a.children[2].style.fontSize,'22px');
  assert.equal(box.children[1].textContent,M.plain(runs));assert.equal(box.querySelector('img'),null);
 }
 assert.equal(JSON.stringify(slots),saved);assert.ok(M.valid(slots._studio,slots));
 assert.equal(JSON.stringify(w.AIWiseCommonContent.catalog(doc,'c2').map(b=>[b.path,Object.keys(b.fields)])),catalog);
 const host=doc.createElement('div');host.append(M.renderRuns(doc,[{text:'Passeport et al. (2026); Passeport et al. (2026).'}]));assert.equal(host.querySelectorAll('a').length,2);
 host.replaceChildren(M.renderRuns(doc,[{text:'Passeport et al. (2025); OtherPasseport et al. (2026).'}]));assert.equal(host.querySelectorAll('a').length,0);
 const existing=doc.createElement('a');existing.href='https://example.test';existing.textContent='Passeport et al. (2026)';host.replaceChildren(existing);M.replaceText(existing.firstChild,M.rich(existing.textContent));assert.equal(existing.querySelector('a'),null);
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

test('course boxes render only in their chapter, including when both chapters carry approved boxes',()=>{
 const M=setup().AIWiseStudioBlocks;
 const docs=Object.fromEntries(['c1','c2','c3'].map(chapter=>[chapter,parseHTML(fs.readFileSync(path.join(root,'common/aiwise-'+chapter+'-final.html'),'utf8')).document]));
 const makeBox=(chapter,index)=>({id:'box-11111111-1111-4111-8111-11111111111'+index,slot:docs[chapter].querySelector('[data-slot]').dataset.slot,template:'text',anchor:0,fields:[[{text:chapter+' heading'}],[{text:chapter+' saved body'}]],align:'left',size:0});
 const c2=makeBox('c2',2),c3=makeBox('c3',3),data={_studio:{c2:{version:1,formats:[],boxes:[c2]},c3:{version:1,formats:[],boxes:[c3]}}};
 const saved=JSON.stringify(data);
 for(const [chapter,doc] of Object.entries(docs)){
  for(let render=0;render<2;render++){
   assert.doesNotThrow(()=>M.course(doc,data),chapter+' must load despite boxes saved in other chapters');
   const added=[...doc.querySelectorAll('[data-studio-course-box]')];
   assert.equal(added.length,chapter==='c1'?0:1);
   if(added.length)assert.equal(added[0].textContent,chapter+' heading'+chapter+' saved body');
  }
 }
 assert.equal(JSON.stringify(data),saved,'rendering must not modify saved content');
 const broken={_studio:{c2:{version:1,formats:[],boxes:[{...c2,slot:'c2.missing'}]}}};
 assert.throws(()=>M.course(docs.c2,broken),/location is no longer available/,'missing anchors in the displayed chapter remain errors');
});
