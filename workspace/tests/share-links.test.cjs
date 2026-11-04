const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
async function fixture({clipboard=true,error=''}={}){
 const {document,window}=parseHTML('<html><body><section class="share-links"></section><section class="share-links"></section></body></html>');
 const copied=[],context={document,window,URL,setTimeout:()=>0,clearTimeout(){},navigator:{clipboard:{async writeText(value){if(!clipboard)throw Error('Unavailable');copied.push(value);}}}};
 vm.runInNewContext(read('workspace/course-registry.js'),context);
 window.AIWiseCourseRegistry.use(JSON.parse(read('common/courses/registry.json')));
 if(error)window.AIWiseCourseRegistry={ready:Promise.resolve(),error:()=>error};
 vm.runInNewContext(read('workspace/share-links.js'),context);
 await Promise.resolve();
 return {document,window,copied};
}
test('both home views offer an explicit English and Dutch lobby link for every course',async()=>{
 const {document,window}=await fixture(),courses=window.AIWiseCourseRegistry.courses();
 assert.equal(courses.length,4);
 for(const mount of document.querySelectorAll('.share-links')){
  assert.equal(mount.querySelectorAll('a').length,8);
  const groups=[...mount.querySelectorAll('.share-link-course')];
  for(const [i,course] of courses.entries()){
   assert.equal(groups[i].querySelector('h3').textContent,course.short_name);
   for(const [j,locale] of ['en','nl'].entries()){
    const a=groups[i].querySelectorAll('a')[j],url=new URL(a.href);
    assert.equal(url.origin,'https://aiwise-eur.github.io');
    assert.equal(url.pathname,'/AI-Wise/lobby.html');
    assert.equal(url.searchParams.get('course'),course.id);
    assert.equal(url.searchParams.get('fixed'),'1');
    assert.equal(url.searchParams.get('lang'),locale);
    assert.equal(a.getAttribute('hreflang'),locale);
    assert.equal(a.getAttribute('target'),'_blank');
   }
  }
 }
});
test('each Copy button copies exactly its course and language URL',async()=>{
 const {document,copied}=await fixture();
 for(const row of document.querySelectorAll('.share-link-row')){
  row.querySelector('button').click();await new Promise(setImmediate);
  assert.equal(copied.at(-1),row.querySelector('a').href);
  assert.match(row.closest('.share-links').querySelector('[role="status"]').textContent,/link copied/);
  assert.equal(row.querySelector('button').disabled,false);
 }
});
test('manual copying retains the chosen language; failed registry exposes no links',async()=>{
 const {document}=await fixture({clipboard:false});
 const mount=document.querySelector('.share-links');
 // The browser supports select(); linkedom does not implement selection.
 const original=document.createElement.bind(document);
 document.createElement=tag=>{const el=original(tag);if(tag==='input')el.select=()=>{};return el;};
 for(const i of [1,6]){
  const row=mount.querySelectorAll('.share-link-row')[i];
  row.querySelector('button').click();await new Promise(setImmediate);
  assert.equal(mount.querySelector('.share-link-manual').value,row.querySelector('a').href);
  assert.equal(mount.querySelectorAll('.share-link-manual').length,1);
 }
 const failed=await fixture({error:'The course list could not be loaded.'});
 assert.equal(failed.document.querySelectorAll('a').length,0);
 assert.match(failed.document.querySelector('[role="status"]').textContent,/could not be loaded/);
});
