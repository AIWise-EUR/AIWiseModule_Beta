import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {buildRelease,SOURCE_FILES,DEST_FILES} from '../functions/aiwise-release/index.ts';
const root=new URL('../../',import.meta.url),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const sources=Object.fromEntries(SOURCE_FILES.map(p=>[p,fs.readFileSync(new URL(p,root),'utf8')]));
const schema=JSON.parse(sources['pipelines/orientation-schema.json']);
export const version={id,number:1,title:'PRIVATE TITLE',author_name:'PRIVATE AUTHOR',content:Object.entries(schema).map(([chapter,v])=>({course:'common',chapter,locale:'en',slots:v.slots}))};
for(const course of ['aws1','ped','other']){
 const base=JSON.parse(sources[course==='ped'?'course-specific/ped/ped.json':'course-specific/aws1/course-specific-content_aws1.json']);
 for(const chapter of ['c2','c3'])version.content.push({course,chapter,locale:'en',slots:Object.fromEntries([...sources[`common/aiwise-${chapter}-final.html`].matchAll(/data-slot="([^"]+)"/g)].map(m=>[m[1],m[1].split('.').reduce((v,k)=>v?.[k],base)]).filter(([,v])=>v!==undefined))});
}
const build=(v=version,s=sources)=>buildRelease(id,v,'a'.repeat(40),'b'.repeat(40),s);
test('release includes only allowlisted flat files and sanitized full version; code and snapshot are frozen',()=>{
 const out=build();assert.deepEqual(Object.keys(out).sort(),DEST_FILES.slice().sort());
 assert.doesNotMatch(out['published-content.json'],/PRIVATE/);const data=JSON.parse(out['published-content.json']);assert.equal(data.content.length,10);
 for(const html of Object.entries(out).filter(([p])=>p.endsWith('.html')).map(([,s])=>s)){assert.doesNotMatch(html,/\.\.\/(pipelines|workspace|course-specific)\//);assert.match(html,/data-published-release=/);}
 assert.doesNotMatch(out['published-course-loader.js'],/return fetch\(/);assert.match(out['published-content-language.js'],/next.pathname.startsWith/);
 for(const [path,js]of Object.entries(out))if(path.endsWith('.js'))assert.doesNotThrow(()=>new vm.Script(js,{filename:path}));
});
test('incomplete, duplicated, unapproved Dutch and mismatched versions stop before a release can be prepared',()=>{
 for(const change of [v=>v.content.pop(),v=>v.content.push(v.content[0]),v=>v.content.push({...v.content[0],locale:'nl'}),v=>v.content[0].slots={'c1.evil':{}},v=>v.content[0].slots['c1.block-0']['unexpected']='x']){
  const v=structuredClone(version);change(v);assert.throws(()=>build(v));
 }
 assert.throws(()=>build(version,{...sources,'common/aiwise-c1-final.html':sources['common/aiwise-c1-final.html']+'changed'}),/source_schema_outdated/);
});
test('checked-in schema still matches the exact module HTML and renderer catalog',()=>{
 const require=createRequire(import.meta.url),actual=require('../../pipelines/build-orientation-schema.cjs');assert.deepEqual(schema,actual);
});
test('published runtime reads only its frozen file, preserves text safety and falls back to saved English',async()=>{
 const out=build(),data=JSON.parse(out['published-content.json']),requests=[],window={};
 data.content[0].slots['c1.block-0']['Text 1']='<script>UNTRUSTED</script>';
 const document={currentScript:{src:'https://example.test/AI-Wise/published-content.js?release='+id},documentElement:{dataset:{publishedRelease:id}}};
 const context={window,document,URL,AbortController,setTimeout,clearTimeout,structuredClone,fetch:async url=>{requests.push(String(url));return {ok:true,json:async()=>structuredClone(data)};}};
 vm.runInNewContext(out['published-content.js'],context);
 const rows=await window.AIWiseBetaContent.read('common','nl');assert.equal(rows.length,4);assert.equal(rows[0].fallback_locale,'en');
 await window.AIWisePublished.course('ped');assert.equal(requests.length,1);assert.match(requests[0],/^https:\/\/example.test\/AI-Wise\/published-content.json\?release=/);
 const original=await window.AIWisePublished.course('aws1'),courseRows=await window.AIWiseBetaContent.read('aws1');assert.deepEqual(window.AIWiseBetaContent.apply(original,courseRows),original);
 document.documentElement.dataset.publishedRelease='another';const other={...context,window:{}};vm.runInNewContext(out['published-content.js'],other);await assert.rejects(()=>other.window.AIWiseBetaContent.read('common'),/release is updating/);
});
