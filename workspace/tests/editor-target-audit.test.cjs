const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const {buildInventory,commonField,courseField,listRule,loadRuntime}=require('../../checks/editor-target-audit.cjs');
const root=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(root,file),'utf8'),clone=value=>JSON.parse(JSON.stringify(value));

test('every current source and approved content target has a definition, without changing source bytes or inventing identities',()=>{
 const report=buildInventory();assert.deepEqual(report.issues,[]);assert.equal(report.summary.approvedRecords,19);
 const unique=new Set();
 for(const t of report.targets){
  const key=JSON.stringify([t.origin,t.scope,t.locale,t.kind,t.slot,t.keys,t.id]);
  assert.ok(!unique.has(key),'duplicate identity '+key);unique.add(key);
  if(t.kind==='field')assert.ok(['text','enum'].includes(t.shape));
  if(t.kind==='box')assert.ok(report.summary.supportedBoxTemplates.includes(t.template));
 }
 const before=report.sources.map(s=>[s.file,read(s.file)]);buildInventory();
 for(const [file,raw] of before)assert.equal(read(file),raw,'audit must never rewrite '+file);
});

test('all Common field descriptors predict the real formatting controls, including SVG, attributes and map-copy sources',()=>{
 for(const chapter of ['c1','c2','c3','map']){
  const document=parseHTML(read('common/'+(chapter==='map'?'aiwise-c1-anatomy-2d':'aiwise-'+chapter+'-final')+'.html')).document;
  const window=loadRuntime(),context={window,document,NodeFilter:{SHOW_TEXT:4}};
  vm.runInNewContext(read('workspace/studio-editing.js'),context);
  const blocks=window.AIWiseCommonContent.catalog(document,chapter),values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const s={values,commonBlocks:blocks,isCommon:true,locale:'en',blocksEnabled:true};
  const before=JSON.stringify(values);
  for(const block of blocks)for(const key of Object.keys(block.fields)){
   const rule=commonField(block,key),wrap=document.createElement('label'),input=document.createElement(rule.control);input.value=block.fields[key];
   window.AIWiseStudioEditing.field(s,wrap,input,block.path,[key]);
   assert.equal(!!wrap.querySelector('.cs-formatbar'),rule.formatOffered,block.path+'/'+key);
  }
  assert.equal(JSON.stringify(values),before,'rendering controls must not create format records');
 }
});

test('variable-list declarations agree with existing validators; fixed arrays cannot silently acquire structural editing',()=>{
 const report=buildInventory(),M=loadRuntime().AIWiseStudioBlocks;
 for(const source of report.sources.filter(s=>s.file.startsWith('content/approved/')&&!s.file.includes('/common/'))){
  const row=JSON.parse(read(source.file));
  for(const target of report.targets.filter(t=>t.origin===source.file&&t.kind==='list')){
   const value=clone(row.slots),list=target.keys.reduce((v,k)=>v[k],value[target.slot]);
   if(!list.length)continue;
   list.push(clone(list[0]));
   const expected=target.mode==='variable'&&list.length<=50;
   assert.equal(M.validCopy(value,row.slots),expected,source.file+' '+target.slot+' '+JSON.stringify(target.keys));
  }
 }
 assert.deepEqual(listRule('c2.sat_example',['phases','0','steps']).operations,[]);
 assert.deepEqual(listRule('c3.template_compare.md',[]).operations,[]);
});

test('semantic values and translatable labels remain distinct, including the existing XML tag synchronization rule',()=>{
 const L=loadRuntime().AIWiseLayoutSync;
 const base={'c2.sat_example':{phases:[],note:'English'},'c3.template_compare.xml':[{tag:'role',lines:['English content']}]};
 const peer={'c2.sat_example':{phases:[],note:'Nederlands'},'c3.template_compare.xml':[{tag:'rol',lines:['Nederlandse inhoud']}]};
 const next=clone(base);next['c3.template_compare.xml'][0].tag='task';
 const result=L.project(base,next,peer,{'c2.sat_example':[]});
 assert.equal(result['c3.template_compare.xml'][0].tag,'task');
 assert.equal(result['c3.template_compare.xml'][0].lines[0],'Nederlandse inhoud');
 assert.equal(courseField('c3.template_compare.xml',['0','tag'],'role').control,'input');
 assert.equal(courseField('c3.template_compare.xml',['0','tag'],'role').wording,'shared-structural-value');
 assert.equal(courseField('c3.amd_example',['items','0','tag'],'adopt').control,'select');
 assert.equal(courseField('c2.sat_example',['phases','0','steps','0','actor'],'self').shape,'enum');
 assert.equal(courseField('c2.sat_example',['phases','0','steps','0','name'],'Intent').wording,'per-language');
});

test('legacy and translated fourth sections retain their original identity and first matching example placement',()=>{
 const M=loadRuntime().AIWiseStudioBlocks,id='box-11111111-1111-4111-8111-111111111111';
 const legacy={id,slot:'c2.examples',template:'text',anchor:0,fields:[[{text:"WHAT THE MODEL DOESN'T KNOW"}],[{text:'Authored text'}]],align:'left',size:0};
 const translated={...clone(legacy),id:'box-22222222-2222-4222-8222-222222222222',example:1,family:M.unknownFamily};translated.fields[0]=[{text:'Mijn titel'}];
 const boxes=[legacy,translated],before=JSON.stringify(boxes);
 assert.equal(M.unknownFor(boxes,0),legacy);assert.equal(M.unknownFor(boxes,1),translated);
 assert.equal(M.exampleIndex(legacy),0);assert.equal(M.boxFamily(legacy),id);
 assert.equal(JSON.stringify(boxes),before);
 const report=buildInventory();
 for(const b of report.targets.filter(t=>t.kind==='box'&&t.role==='missing-model-context')){
  assert.deepEqual(b.operations,['edit','format']);assert.ok(b.inheritedOperations.includes('remove-with-example'));
 }
});
