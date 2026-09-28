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
