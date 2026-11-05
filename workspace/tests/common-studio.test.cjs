/* DOM-only tests. LINKEDOM_MODULE points to the pinned linkedom package. */
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const {parseHTML} = require(process.env.LINKEDOM_MODULE || 'linkedom');
const root=path.resolve(__dirname,'../..');
function core() {
  const context={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),context);
  return context.window.AIWiseCommonContent;
}
const api=core();
function source(chapter) { return parseHTML(fs.readFileSync(path.join(root,`common/aiwise-${chapter}-final.html`),'utf8')).document; }
for(const chapter of ['c1','c2','c3']) test(`${chapter}: catalog and renderer preserve course slots and markup`,()=>{
  const document=source(chapter), blocks=api.catalog(document,chapter);
  assert.ok(blocks.length>10); assert.equal(new Set(blocks.map(b=>b.path)).size,blocks.length);
  const courseSlots=[...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML);
  const values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const heading=blocks[0], key=Object.keys(heading.fields)[0];
  values[heading.path][key]='<img src=x onerror=alert(1)> Plain text';
  api.apply(document,chapter,values);
  assert.equal(document.querySelector('.hero h2').textContent,values[heading.path][key]);
  assert.equal(document.querySelector('.hero h2 img'),null,'never parses authored markup');
  assert.deepEqual([...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML),courseSlots);
  assert.equal(api.catalog(document,chapter).length,blocks.length);
  assert.equal(document.querySelector('.hero h2').getAttribute('class'),heading.node.getAttribute('class'));
});
test('changed structure is rejected before any partial rendering',()=>{
  const document=source('c3'), original=document.documentElement.outerHTML, blocks=api.catalog(document,'c3');
  const values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  values[blocks[0].path][Object.keys(blocks[0].fields)[0]]='Changed';
  delete values[blocks.at(-1).path];
  assert.throws(()=>api.apply(document,'c3',values),/no longer matches/);
  assert.equal(document.documentElement.outerHTML,original);
});
test('renderer maps fields by key even when JSON key order changes in PostgreSQL',()=>{
  const document=source('c2'), blocks=api.catalog(document,'c2');
  const values=Object.fromEntries(blocks.map(b=>[b.path,Object.fromEntries(Object.entries(b.fields).reverse())]));
  api.apply(document,'c2',values);
  for(const block of blocks) assert.deepEqual(Array.from(block.nodes,n=>n.nodeValue),Object.values(block.fields));
});
test('editor preview maps database values by field key and preserves course slots',()=>{
  const document=source('c3'), blocks=api.catalog(document,'c3');
  const before=[...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML);
  const values=Object.fromEntries(blocks.map(b=>[b.path,Object.fromEntries(Object.entries(b.fields).reverse())]));
  const window={AIWiseCommonContent:api,AIWiseCourseRenderer:{fillSlots(){},toggleRequired(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),{window});
  const session={frame:{contentDocument:document},items:blocks,chapter:'c3',source:{},values};
  window.AIWiseCommonStudio.apply(session,()=>{});
  for(const block of session.commonBlocks) assert.deepEqual(Array.from(block.nodes,n=>n.nodeValue),Object.values(block.fields));
  assert.deepEqual([...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML),before);
});
test('backend bridge preserves common scope and rejects stale or unsaved submissions',async()=>{
  const storage=new Map(), calls=[];
  const window={addEventListener(){},AIWiseAuth:{subscribe(){}},AIWiseSharedStudio:{submit:async input=>{calls.push(input);return {id:'shared-id'};}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/control-tower.js'),'utf8'),{window,localStorage:{getItem:key=>storage.get(key)??null}});
  const baseSlots={'c1.block-0':{'Heading 1':'Original'}}, slots={'c1.block-0':{'Heading 1':'Edited'}};
  const raw=JSON.stringify({schema:1,scope:'common',chapter:'c1',savedAt:'2026-09-28T00:00:00Z',slots,baseSlots});
  storage.set('aiwise_common_studio_c1_v1',raw);
  const input={course:'common',chapter:'c1',raw,slots,baseSlots,baseRelease:null,summary:'Shared edit'};
  assert.equal((await window.AIWiseControlTower.submitCommonDraft(input)).id,'shared-id');
  assert.equal(calls[0].course,'common'); assert.equal(calls[0].baseRelease,null);
  await assert.rejects(()=>window.AIWiseControlTower.submitCommonDraft({...input,slots:{}}),/cannot be submitted/);
  storage.set('aiwise_common_studio_c1_v1','changed');
  await assert.rejects(()=>window.AIWiseControlTower.submitCommonDraft(input),/another tab/);
  assert.equal(calls.length,1);
});

test('small SAT diagrams open their shared symbol owner without changing saved fields',()=>{
  const document=source('c2'), blocks=api.catalog(document,'c2');
  const values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const original=JSON.stringify(values), opened=[];
  const window={AIWiseCommonContent:api,AIWiseCourseRenderer:{fillSlots(){},toggleRequired(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),{window});
  const session={frame:{contentDocument:document},items:blocks,chapter:'c2',source:{},values};
  window.AIWiseCommonStudio.apply(session,(_,index)=>opened.push(index));
  const cards=[...document.querySelectorAll('.framework-card')].filter(card=>card.querySelector('svg use'));
  assert.ok(cards.length>=2);
  for(const card of cards){
    const button=[...card.querySelectorAll('button')].find(b=>b.textContent==='Edit shared diagram labels');
    assert.ok(button); button.click();
    const id=card.querySelector('use').getAttribute('href').slice(1);
    assert.ok(session.commonBlocks[opened.at(-1)].node.contains(document.getElementById(id)));
  }
  assert.equal(JSON.stringify(values),original);
});

test('Common template examples link to course editing and preserve slot content',()=>{
  const document=source('c3'), blocks=api.catalog(document,'c3'), opened=[];
  const values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const before=[...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML);
  const window={AIWiseCommonContent:api,AIWiseCourseRenderer:{fillSlots(){},toggleRequired(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),{window});
  const session={frame:{contentDocument:document},items:blocks,chapter:'c3',source:{},values,openCourseSlot:path=>opened.push(path)};
  window.AIWiseCommonStudio.apply(session,()=>{});
  for(const node of document.querySelectorAll('[data-slot^="c3.template_compare."]')) node.previousElementSibling.click();
  assert.deepEqual(opened,['c3.template_compare.md','c3.template_compare.xml']);
  assert.deepEqual([...document.querySelectorAll('[data-slot]')].map(n=>n.outerHTML),before);
});

test('example heading shortcuts target the shared owner and survive repeated edits',()=>{
  const document=source('c2');
  Object.defineProperty(document,'currentScript',{value:{src:'https://example.invalid/pipelines/course-loader.js',hasAttribute:()=>true}});
  const window={AIWiseCommonContent:api};
  const context={window,document,URL};
  vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/course-loader.js'),'utf8'),context);
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),context);
  const blocks=api.catalog(document,'c2'), values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const owner=blocks.find(b=>b.node.hasAttribute('data-common-copy')), opened=[];
  const session={frame:{contentDocument:document},items:blocks,chapter:'c2',locale:'nl',values,
    source:{c2:{examples:[{title:'First',thinking:'First body'},{title:'Second',thinking:'Second body'}]}},
    openSharedHeading:key=>opened.push(key)};
  const original=JSON.stringify(values);
  window.AIWiseCommonStudio.apply(session,()=>{});
  assert.equal(document.querySelectorAll('[data-cs-shared-heading]').length,6);
  document.querySelector('[data-cs-shared-heading="thinking"]').click();
  assert.deepEqual(opened,['thinking']);
  assert.equal(JSON.stringify(values),original,'opening a shortcut never changes content');
  values[owner.path]['thinking 1']='Wat je eigenlijk denkt';
  window.AIWiseCommonStudio.apply(session,()=>{});
  window.AIWiseCommonStudio.apply(session,()=>{});
  assert.equal(document.querySelectorAll('[data-cs-shared-heading]').length,6,'no duplicate buttons after rerender');
  assert.equal(document.querySelectorAll('[data-cs-shared-labels]').length,1);
  assert.deepEqual([...document.querySelectorAll('[data-copy-use="thinking"]')].map(n=>n.textContent),['Wat je eigenlijk denkt','Wat je eigenlijk denkt']);
  assert.deepEqual([...document.querySelectorAll('.layer-thinking p')].map(n=>n.textContent),['First body','Second body']);
  assert.equal(owner.fields['thinking 1'],'What you are actually thinking');
});

for(const chapter of ['c1','c2','c3']) test(`${chapter}: shared labels entry is outside navigation and opens existing fields`,()=>{
  const document=source(chapter), blocks=api.catalog(document,chapter), opened=[];
  const values=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));
  const window={AIWiseCommonContent:api,AIWiseCourseRenderer:{fillSlots(){},toggleRequired(){}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),{window});
  const session={frame:{contentDocument:document},items:blocks,chapter,source:{},values};
  window.AIWiseCommonStudio.apply(session,(_,i)=>opened.push(i));
  const button=document.querySelector('[data-cs-shared-labels]');
  assert.ok(button);assert.equal(button.closest('[hidden],nav,#coreNavDesktop,#mobileCoreNav'),null);
  button.click();assert.ok(session.commonBlocks[opened[0]].node.hasAttribute('data-common-copy'));
  assert.deepEqual(Object.keys(values),Array.from(blocks,b=>b.path),'field identities remain unchanged');
});
