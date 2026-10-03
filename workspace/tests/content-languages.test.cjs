const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
vm.runInNewContext(read('pipelines/common-content.js'),context);const api=context.window.AIWiseCommonContent;
for(const chapter of ['c1','c2','c3','map'])test(`${chapter}: all authored text belongs to Common Studio or a course slot`,()=>{
 const file=chapter==='map'?'aiwise-c1-anatomy-2d':`aiwise-${chapter}-final`;
 const document=parseHTML(read(`common/${file}.html`)).document,blocks=api.catalog(document,chapter),covered=new Set(blocks.flatMap(b=>b.nodes));
 const walker=document.createTreeWalker(document.body,4),missing=[];
 while(walker.nextNode()){const n=walker.currentNode;if(n.nodeValue.trim()&&!n.parentElement.closest('script,style,[data-slot],#root,#tooltip')&&!covered.has(n))missing.push(n.nodeValue);}
 assert.deepEqual(missing,[]);
 const slots=Object.fromEntries(blocks.map(b=>[b.path,b.fields]));
 assert.equal(api.valid(slots,blocks),true);api.apply(document,chapter,slots);
 assert.equal(api.catalog(document,chapter).length,blocks.length,'repeat catalog does not grow');
 if(chapter==='map'){
  assert.equal(document.querySelectorAll('[data-anatomy-copy]').length,22);
  for(const n of document.querySelectorAll('[data-anatomy-copy]'))assert.equal(n.querySelectorAll('[data-map-field]').length,3,'all map names, types and tooltip explanations');
 }else for(const n of document.querySelectorAll('[data-common-copy] [data-copy]'))assert.ok(covered.has(n.firstChild),'runtime copy is editable');
});
test('English draft keys are unchanged; Dutch drafts and URLs are independent',()=>{
 const c={window:{},document:{currentScript:{hasAttribute:()=>true}},location:{href:'https://example.test/repo/workspace/?lang=nl#common/c1'},URL};
 vm.runInNewContext(read('pipelines/content-language.js'),c);const a=c.window.AIWiseLanguage;
 assert.equal(a.draftKey('common','c1','en'),'aiwise_common_studio_c1_v1');assert.equal(a.draftKey('aws1','c2','en'),'aiwise_content_studio_aws1_c2_v1');
 assert.equal(a.draftKey('common','c1','nl'),'aiwise_common_studio_c1_nl_v1');
 assert.equal(a.current(),'nl');assert.equal(a.url('../common/aiwise-c1-final.html?course=ped','nl'),'https://example.test/repo/common/aiwise-c1-final.html?course=ped&lang=nl');
 assert.equal(a.url('../common/aiwise-c1-final.html?course=ped&lang=nl','en'),'https://example.test/repo/common/aiwise-c1-final.html?course=ped');
});
test('Beta feedback preserves English keys and uses canonical Dutch keys',()=>{
 const c={window:{addEventListener(){}},document:{currentScript:{src:'https://example.test/repo/workspace/beta-review.js'}},URL,URLSearchParams};require('./registry.cjs')(c.window);
 vm.runInNewContext(read('workspace/beta-review.js'),c);const key=c.window.AIWiseBetaReview.pageKey;
 // An earlier course id addresses the same page as the course it now names.
 assert.equal(key('https://example.test/repo/common/aiwise-c1-final.html?course=ped'),'common/aiwise-c1-final.html?course=pedagogical-sciences.inleiding');
 assert.equal(key('https://example.test/repo/common/aiwise-c1-final.html?course=psychology.psychodiagnostics'),'common/aiwise-c1-final.html?course=psychology.psychodiagnostics');
 assert.equal(key('https://example.test/repo/common/aiwise-c1-final.html?course=unknown'),'common/aiwise-c1-final.html');
 assert.equal(key('https://example.test/repo/common/aiwise-c1-final.html?lang=nl&course=ped'),'common/aiwise-c1-final.html?course=pedagogical-sciences.inleiding&lang=nl');
 assert.equal(key('https://example.test/repo/common/aiwise-c1-anatomy-2d.html?lang=nl'),'common/aiwise-c1-anatomy-2d.html?lang=nl');
 assert.equal(key('https://other.test/repo/common/aiwise-c1-final.html'),null);
});
test('public renderer requests one language and rejects a mixed-language response',async()=>{
 const urls=[],c={window:{AIWiseSupabaseConfig:{url:'https://example.test',publishableKey:'public'}},URL,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async url=>{urls.push(String(url));return {ok:true,json:async()=>[{course:'common',chapter:'c1',locale:'en',slots:{}}]};}};
 vm.runInNewContext(read('pipelines/beta-content.js'),c);
 await assert.rejects(()=>c.window.AIWiseBetaContent.read('common','nl'),/Invalid approved content response/);
 assert.equal(new URL(urls[0]).searchParams.get('locale'),'eq.nl');
 await assert.rejects(()=>c.window.AIWiseBetaContent.read('common','xx'),/Unsupported/);
});
test('existing English common drafts gain new fields without losing edits; changed baselines stay blocked',()=>{
 const c={window:{AIWiseCommonContent:api}};vm.runInNewContext(read('workspace/common-studio.js'),c);
 const upgrade=c.window.AIWiseCommonStudio.upgradeDraft;
 const base={'c1.block-0':{'Heading 1':'Original'},'c1.extra-0':{'Text 1':'New control'}};
 const saved={scope:'common',chapter:'c1',baseSlots:{'c1.block-0':{'Heading 1':'Original'}},slots:{'c1.block-0':{'Heading 1':'My draft'}}};
 const result=upgrade(saved,base);assert.equal(result['c1.block-0']['Heading 1'],'My draft');assert.equal(result['c1.extra-0']['Text 1'],'New control');
 assert.equal(Object.keys(saved.slots).length,1,'source draft remains untouched');
 assert.equal(upgrade({...saved,locale:'nl'},base),null);
 assert.equal(upgrade({...saved,baseSlots:{'c1.block-0':{'Heading 1':'Old release'}}},base),null);
});
test('all course slots render for every bachelor, including translated runtime labels',()=>{
 for(const {id:course,content} of JSON.parse(read('common/courses/registry.json')).bachelors)for(const chapter of ['c2','c3']){
  const {document}=parseHTML(read(`common/aiwise-${chapter}-final.html`));
  const data=JSON.parse(read(content));
  const c={window:{AIWiseCommonContent:api},document,URL,console};
  Object.defineProperty(document,'currentScript',{value:{src:'https://example.test/pipelines/course-loader.js',hasAttribute:()=>true}});
  vm.runInNewContext(read('pipelines/course-loader.js'),c);
    for(const n of document.querySelectorAll('[data-slot]'))if(n.dataset.slot.split('.').reduce((v,k)=>v?.[k],data)===undefined)assert.ok(n.closest('[data-requires-slot][hidden]'),`${course} ${n.dataset.slot} missing visible content`);
  c.window.AIWiseCourseRenderer.fillSlots(data,document);c.window.AIWiseCourseRenderer.toggleRequired(data,document);
  for(const n of document.querySelectorAll('[data-slot]'))if(!n.closest('[data-requires-slot][hidden]'))assert.ok(n.textContent.trim(),`${course} ${n.dataset.slot} rendered`);
  if(chapter==='c2'){
   document.querySelector('[data-copy=thinking]').textContent='Wat je denkt';api.sync(document);
   assert.equal(document.querySelector('.layer-thinking .carousel-layer-label').textContent,'Wat je denkt');
  }else{
   document.querySelector('[data-copy=adopt]').textContent='Overnemen';api.sync(document);
   assert.ok([...document.querySelectorAll('[data-copy-use=adopt]')].every(n=>n.textContent==='Overnemen'));
  }
 }
});
