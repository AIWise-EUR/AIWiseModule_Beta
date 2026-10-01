const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const source=fs.readFileSync(path.join(__dirname,'../beta-history.js'),'utf8');
const window={};vm.runInNewContext(source,{window});const H=window.AIWiseBetaHistory;
const item={course:'common',chapter:'c1',key:'c1.block-0'};
const version=(en,nl)=>({content:[{course:'common',chapter:'c1',locale:'en',slots:{'c1.block-0':en}},...(nl?[{course:'common',chapter:'c1',locale:'nl',slots:{'c1.block-0':nl}}]:[])]});
test('comparison respects exact slot, nested values, language and English fallback',()=>{
 const a=version({title:'A',body:['Text']}),b=version({body:['Text'],title:'A'}),c=version({title:'B',body:['Text']});
 assert.equal(H.changed(a,b,item,'en'),false);assert.equal(H.changed(a,c,item,'en'),true);
 assert.equal(H.value(a,item,'nl').locale,'en');assert.equal(H.changed(a,b,item,'nl'),false);
 assert.equal(H.changed(a,version({title:'A',body:['Text']},{title:'A',body:['Text']}),item,'nl'),true);
 assert.equal(H.value(a,{...item,course:'ped'},'en').content,undefined);
});
test('historical feedback matches exact block or descendants, never similarly named neighbors',()=>{
 const p='body>main:nth-of-type(1)>section:nth-of-type(1)';
 assert.equal(H.atLocation({path:p},p),true);assert.equal(H.atLocation({path:p+'>p:nth-of-type(1)'},p),true);
 assert.equal(H.atLocation({path:p.replace('(1)','(2)')},p),false);
});
test('current Beta explains comparison scope without querying saved content',()=>{
 const {document}=parseHTML('<html><head></head><body><div id="host"></div></body></html>');
 const w={AIWiseAuth:{snapshot:()=>({status:'member',user:{id:'owner'}})},AIWiseBackend:{getClient:()=>{throw Error('unexpected request')}}};
 vm.runInNewContext(source,{window:w,AbortController,setTimeout,clearTimeout});
 const result=w.AIWiseBetaHistory.attach({host:document.querySelector('#host'),doc:document,version:null,canSelect:()=>true});
 assert.match(document.querySelector('[data-comparison]').textContent,/Reopen Beta/);result.dispose();assert.equal(document.querySelector('[data-history-item]'),null);
});
test('saved history excludes head-only text, loads previous snapshots and clears all marks on dispose',async()=>{
 const {document,window:dom}=parseHTML('<html><head><title data-review-common-key="c1.extra-1">Title</title></head><body><main data-current-block="c1"><h2 data-review-common-key="c1.block-0">New heading</h2></main><div id="host"></div></body></html>');
 const current={...version({heading:'New heading'}),id:'new',number:2},previous={...version({heading:'Old heading'}),id:'old',number:1,title:'Earlier',author_name:'Tester',created_at:'2026-09-30'};
 let auth={status:'member',user:{id:'owner'}};
 const q={select:()=>q,lt:()=>q,order:()=>q,limit:()=>q,abortSignal:async()=>({data:[previous]})};
 const w={AIWiseAuth:{snapshot:()=>auth},AIWiseBackend:{getClient:async()=>({from:()=>q})},AIWiseBetaAnchors:{path:()=> 'body>main:nth-of-type(1)>h2:nth-of-type(1)'}};
 vm.runInNewContext(source,{window:w,AbortController,setTimeout,clearTimeout});
 const result=w.AIWiseBetaHistory.attach({host:document.querySelector('#host'),doc:document,version:current,course:'aws1',locale:'en',canSelect:()=>true});
 document.querySelector('[data-mark-changes]').checked=true;
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(document.querySelector('[data-comparison]').textContent,/1 changed item/);
 assert.equal(document.querySelectorAll('[data-review-changed]').length,1);
 assert.equal(document.querySelectorAll('[data-history-item] option').length,2);
 result.dispose();assert.equal(document.querySelectorAll('[data-review-changed]').length,0);
});
