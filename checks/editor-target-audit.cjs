/* Read-only inventory of the existing editor. This is an audit model, not a runtime schema. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const families={
 'text':{shape:'text',role:'text'},
 'carousel':{shape:'list',role:'example-card'},
 'sat-example':{shape:'record',role:'sat-example'},
 'prompt-example':{shape:'record',role:'prompt-comparison'},
 'amd-example':{shape:'record',role:'decision-example'},
 'md-panel':{shape:'list',role:'markdown-template'},
 'xml-panel':{shape:'list',role:'xml-template'}
};
const pairedTitles=new Set(['c2.sat_example_title','c3.full_example_title']);
function leaves(value,keys=[]){
 if(typeof value==='string')return [{keys,value}];
 if(!value||typeof value!=='object')throw Error('Unsupported content value at '+JSON.stringify(keys));
 return Object.entries(value).flatMap(([key,child])=>leaves(child,[...keys,key]));
}
function arrays(value,keys=[]){
 if(!value||typeof value!=='object')return [];
 return [...(Array.isArray(value)?[{keys,length:value.length}]:[]),...Object.entries(value).flatMap(([key,v])=>arrays(v,[...keys,key]))];
}
function listRule(slot,keys){
 if(slot==='c2.examples'&&!keys.length)return {mode:'variable',min:1,max:50,operations:['add','duplicate','up','down','remove'],identity:'position-with-layout-map'};
 if(slot==='c2.sat_example'&&keys.join('.')==='phases')return {mode:'variable',min:0,max:50,operations:['add-self-ai','add-self-team','remove'],identity:'position-with-layout-map'};
 return {mode:'fixed',operations:[],identity:'position'};
}
function commonField(block,key){
 const ref=block.nodes[Object.keys(block.fields).indexOf(key)];
 if(!ref)throw Error('Common field missing from source: '+block.path+'/'+key);
 const adapter=ref.nodeType!==3?'attribute':ref.parentElement.closest('svg')?'svg-text':ref.parentElement.closest('title')?'page-title':block.node.hasAttribute('data-anatomy-copy')?'map-copy':'html-text';
 return {shape:'text',storage:'slot-string',role:block.node.hasAttribute('data-common-copy')?'shared-label':key.startsWith('Heading')?'heading':adapter==='attribute'?'attribute':adapter==='map-copy'?'map-annotation':'copy',
  adapter,owner:'common',wording:'per-language',structure:'source-defined',
  control:key.startsWith('Heading')?'input':'textarea',formatOffered:['html-text','map-copy'].includes(adapter),
  formatRendering:adapter==='map-copy'?'copy-consumer-specific':adapter==='html-text'?'inline':'plain'};
}
function courseField(slot,keys,value){
 const name=keys.at(-1)|| (pairedTitles.has(slot)?'title':'Text');
 const choices=name==='actor'?['self','ai','team']:name==='tag'&&(slot==='c3.amd_example'||['adopt','modify','discard'].includes(value))?['adopt','modify','discard']:null;
 return {shape:choices?'enum':'text',storage:'slot-string',role:name,adapter:'course-renderer',owner:'bachelor',
  placement:slot==='c2.examples'?'example':slot==='c2.sat_example'&&keys[0]==='phases'?'sat-phase':'slot',
  wording:['actor','tag'].includes(name)?'shared-structural-value':'per-language',
  control:choices?'select':['title','typing_note','heading','tag','name','label'].includes(name)?'input':'textarea',
  choices,formatOffered:!choices,optional:name==='typing_note',identity:'slot-and-path'};
}
function loadRuntime(){
 const window={},context={window,document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
 for(const file of ['pipelines/common-content.js','workspace/layout-sync.js'])vm.runInNewContext(read(file),context);
 return window;
}
function buildInventory(){
 const runtime=loadRuntime(),M=runtime.AIWiseStudioBlocks,registry=JSON.parse(read('common/courses/registry.json'));
 const targets=[],issues=[],sources=[],catalogs={},slotCatalog={};
 function source(file){const raw=read(file);sources.push({file,sha256:crypto.createHash('sha256').update(raw).digest('hex')});return raw;}
 function extension(slots,origin,scope,locale){
  const ext=slots._studio;if(!ext)return;
  if(!M.valid(ext,slots))issues.push({origin,kind:'invalid-extension'});
  for(const b of ext.boxes){
   const template=M.templates.includes(b.template)?b.template:null;
   if(!template){issues.push({origin,kind:'unknown-template',id:b.id});continue;}
   const isExample=scope!=='common'&&M.exampleBox(b),special=isExample&&M.unknownFor(ext.boxes,M.exampleIndex(b))===b;
   targets.push({origin,scope,locale,kind:'box',id:b.id,slot:b.slot,shape:'record',storage:'studio-box',template,
    role:special?'missing-model-context':'added-box',owner:scope==='common'?'common':'bachelor',placement:isExample?'example':'slot',
    example:isExample?M.exampleIndex(b):null,family:isExample?M.boxFamily(b):null,structure:'shared-after-review',wording:'per-language',
    operations:special?['edit','format']:['edit','format','duplicate','move','remove','align','size'],
    inheritedOperations:isExample?['duplicate-with-example','move-with-example','remove-with-example']:[],
    activation:'existing-capability-and-language-gates',entry:special?'unknownPanel':'panel',
    identity:'box-id',fields:b.fields.map((_,i)=>({shape:'text',storage:'rich-runs',identity:['box',b.id,i]}))});
  }
  for(const f of ext.formats)targets.push({origin,scope,locale,kind:'format',slot:f.slot,keys:f.path,shape:'format-overlay',storage:'studio-formats',identity:'slot-and-path'});
 }
 function courseSlots(slots,origin,scope,locale){
  for(const [slot,value] of Object.entries(slots)){
   if(slot==='_studio')continue;
   const declared=slotCatalog[slot];
   if(!declared){issues.push({origin,kind:'unknown-course-slot',slot});continue;}
   const family=families[declared.renderer];
   if(!family){issues.push({origin,kind:'unknown-renderer',slot,renderer:declared.renderer});continue;}
   targets.push({origin,scope,locale,kind:'slot',slot,...family,renderer:declared.renderer,owner:'bachelor'});
   for(const leaf of leaves(value))targets.push({origin,scope,locale,kind:'field',slot,keys:leaf.keys,...courseField(slot,leaf.keys,leaf.value)});
   for(const list of arrays(value))targets.push({origin,scope,locale,kind:'list',slot,...list,...listRule(slot,list.keys)});
  }
  extension(slots,origin,scope,locale);
 }
 for(const chapter of runtime.AIWiseCommonContent.chapters){
  const file=`common/${chapter==='map'?'aiwise-c1-anatomy-2d':'aiwise-'+chapter+'-final'}.html`,doc=parseHTML(source(file)).document;
  const blocks=runtime.AIWiseCommonContent.catalog(doc,chapter);catalogs[chapter]=blocks;
  for(const block of blocks)for(const key of Object.keys(block.fields))targets.push({origin:file,scope:'common',locale:'source',kind:'field',slot:block.path,keys:[key],...commonField(block,key)});
  for(const node of doc.querySelectorAll('[data-slot]'))slotCatalog[node.dataset.slot]={chapter,renderer:node.dataset.slotType||'text'};
 }
 for(const b of registry.bachelors){
  const data=JSON.parse(source(b.content));
  for(const chapter of ['c2','c3']){
   const slots={};
   for(const [slot,definition] of Object.entries(slotCatalog).filter(([,d])=>d.chapter===chapter)){
    const value=slot.split('.').reduce((v,k)=>v?.[k],data);if(value!==undefined)slots[slot]=value;
   }
   if(data._studio?.[chapter])slots._studio=data._studio[chapter];
   courseSlots(slots,b.content,b.id,'source');
  }
 }
 let approvedRecords=0;
 for(const locale of ['en','nl'])for(const scope of ['common',...registry.bachelors.map(b=>b.id)]){
  const dir=`content/approved/${locale}/${scope}`;
  for(const name of fs.readdirSync(path.join(root,dir)).filter(n=>n.endsWith('.json')).sort()){
   const file=dir+'/'+name,row=JSON.parse(source(file));approvedRecords++;
   if(scope==='common'){
    const blocks=catalogs[row.chapter];
    for(const [slot,value] of Object.entries(row.slots)){
     if(slot==='_studio')continue;
     const block=blocks.find(b=>b.path===slot);
     for(const [key,text] of Object.entries(value)){
      if(!block||!Object.hasOwn(block.fields,key)||typeof text!=='string'){issues.push({origin:file,kind:'unmatched-common-field',slot,key});continue;}
      targets.push({origin:file,scope,locale,kind:'field',slot,keys:[key],...commonField(block,key)});
     }
    }
    extension(row.slots,file,scope,locale);
   }else courseSlots(row.slots,file,scope,locale);
  }
 }
 const countBy=(items,key)=>Object.fromEntries([...new Set(items.map(t=>t[key]))].sort().map(value=>[value,items.filter(t=>t[key]===value).length]));
 const fields=targets.filter(t=>t.kind==='field'),commonSource=fields.filter(t=>t.scope==='common'&&t.locale==='source');
 return {schema:1,basis:'repository source and committed approved snapshots; no live browser or database data',
  summary:{bachelors:registry.bachelors.length,courses:registry.courses.length,approvedRecords,
   commonCatalog:Object.fromEntries(Object.entries(catalogs).map(([chapter,blocks])=>[chapter,{blocks:blocks.length,fields:blocks.reduce((n,b)=>n+Object.keys(b.fields).length,0)}])),
   commonSourceByAdapter:countBy(commonSource,'adapter'),declaredCourseSlots:slotCatalog,
   targetsByKind:countBy(targets,'kind'),fieldsByShape:countBy(fields,'shape'),
   richTextFields:targets.filter(t=>t.kind==='box').reduce((n,b)=>n+b.fields.length,0),
   boxesByTemplate:countBy(targets.filter(t=>t.kind==='box'),'template'),supportedBoxTemplates:Array.from(M.templates),unexplained:issues.length},
  issues,sources,targets};
}
module.exports={buildInventory,commonField,courseField,listRule,families,loadRuntime};
if(require.main===module){const report=buildInventory();console.log(JSON.stringify(process.argv.includes('--details')?report:{...report,targets:undefined},null,2));if(report.issues.length)process.exitCode=1;}
