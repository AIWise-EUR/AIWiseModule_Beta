const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const source=fs.readFileSync(path.join(__dirname,'../beta-item-details.js'),'utf8');
const w={};vm.runInNewContext(source,{window:w});const D=w.AIWiseBetaItemDetails;
test('item comparison omits unchanged nested fields and isolates additions and removals',()=>{
 const before=[{title:'Same',thinking:'Old',typing:'Keep'},{title:'Other',thinking:'Unchanged'}],after=[{title:'Same',thinking:'New',typing:'Keep'},{title:'Other',thinking:'Unchanged'}];
 const rows=D.changes(before,after);assert.equal(rows.length,1);assert.equal(rows[0].label,'Example 1 · Student thinking');assert.equal(rows[0].before,'Old');assert.equal(rows[0].after,'New');
 assert.equal(D.changes({a:1,b:2},{b:2,a:1}).length,0);assert.equal(D.changes({title:'Removed'},undefined)[0].after,undefined);assert.equal(D.changes(undefined,{title:'New'})[0].before,undefined);
});
test('compact comparison shows the changed passage even after a long identical prefix; values are escaped',()=>{
 const common='same words '.repeat(50),html=D.comparison([{label:'Prompt',before:common+'old ending',after:common+'<script>new ending</script>'}],true);
 assert.match(html,/old ending/);assert.match(html,/&lt;script&gt;new ending/);assert.equal(html.includes('<script>'),false);assert.ok(html.length<800);
});
test('details include all earlier versions and matching comments with replies, and close cleanly',async()=>{
 const {document}=parseHTML('<html><body><button id="return">Details</button></body></html>');
 const original=document.createElement.bind(document);document.createElement=tag=>{const el=original(tag);if(tag==='dialog'){el.showModal=()=>el.setAttribute('open','');el.close=()=>el.removeAttribute('open');}return el;};
 const item={title:'Heading',course:'ped',chapter:'c2',key:'c2.title',path:'body>main'},version={id:'v3',number:3,created_at:'2026-10-02',content:'New'},older=[{id:'v2',number:2,created_at:'2026-10-01',content:'Old'},{id:'v1',number:1,created_at:'2026-09-30',content:'First'}];
 const memo={id:'m',version_id:'v2',page:'common/aiwise-c2-final.html?course=ped',content_course:'ped',content_chapter:'c2',content_locale:'en',item_key:'c2.title',anchor:{excerpt:'Original text'},body:'Clarify this',author_name:'Alex',created_at:'2026-10-01',resolved:false};
 const replies=[{id:'r',memo_id:'m',body:'Updated the wording',author_name:'Seyoon',created_at:'2026-10-02'}];
 let subscriptions=0;const window={AIWiseAuth:{subscribe:()=>{subscriptions++;return()=>subscriptions--; }},AIWiseBetaHistory:{value:v=>({content:v.content,locale:'en'}),atLocation:()=>false}};
 const all=async make=>{let table,filters=[];const q={select:()=>q,eq:(k,v)=>{filters.push(r=>r[k]===v);return q;},is:(k,v)=>{filters.push(r=>(r[k]??null)===v);return q;},lt:(k,v)=>{filters.push(r=>r[k]<v);return q;},in:(k,v)=>{filters.push(r=>v.includes(r[k]));return q;},order:()=>q};make({from:t=>{table=t;return q;}});return (table==='workspace_beta_versions'?older:table==='workspace_beta_memos'?[memo]:replies).filter(r=>filters.every(f=>f(r)));};
 vm.runInNewContext(source,{window,document});const close=window.AIWiseBetaItemDetails.open({item,locale:'en',version,baseline:older[0],rolling:false,page:memo.page,all,valid:()=>true});
 await new Promise(r=>setTimeout(r,0));assert.equal(document.querySelectorAll('.bi-version').length,3);assert.match(document.body.textContent,/Clarify this/);assert.match(document.body.textContent,/Updated the wording/);assert.match(document.querySelector('[data-bi-status]').textContent,/3 versions · 1 memo · 1 reply/);assert.equal(document.querySelectorAll('.bi-pair').length,3);close();assert.equal(document.querySelector('dialog'),null);assert.equal(subscriptions,0);
});
