const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
require('./registry.cjs').everywhere();
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..'),code=p=>fs.readFileSync(path.join(root,p),'utf8');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(role='admin',failure=null){
 const {document,window:dom}=parseHTML('<html><body><div id="room"></div></body></html>');
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._value||this.querySelector('option')?.value;},set(v){this._value=v;}});
 let auth={status:'member',role,user:{id:'owner'}},opened;
 const version={id,number:1,title:'<img src=x onerror=alert(1)>',summary:'Saved copy',author_name:'Reviewer',created_at:'2026-09-30',content:[{course:'common',chapter:'c1',locale:'en',slots:{'c1.title':'Saved title'}}]};
 const make=table=>{const q={select:()=>q,eq:()=>q,contains:()=>q,order:()=>q,range:()=>q,limit:()=>q,single:()=>{q.singleRow=true;return q;},abortSignal:async()=>failure?{error:failure}:{data:table==='workspace_beta_versions'?(q.singleRow?version:[version]):[]}};return q;};
 const review={fingerprint:'copy',previous_id:null,changes:[],checks:[],current_content:structuredClone(version.content)},helper={};vm.runInNewContext(code('workspace/beta-checklist.js'),{window:helper,URLSearchParams});
 const window={addEventListener:()=>{},AIWiseReviewInbox:{summary:async()=>({changes:2,unreadChanges:1,memoCount:3,unreadMemos:2}),changes:async()=>review.changes.map((r,i)=>({...r,unread:i>0}))},AIWiseBetaChecklist:{...helper.AIWiseBetaChecklist,mount:()=>()=>{},request:async()=>structuredClone(review)},AIWiseAuth:{snapshot:()=>auth},AIWiseBackend:{getClient:async()=>({from:make})},AIWiseBetaReview:{open:(...args)=>{opened=args;}}};
 vm.runInNewContext(code('workspace/version-labels.js'),{window});const location={hash:'#beta'};vm.runInNewContext(code('workspace/beta-space.js'),{window,document,location,URLSearchParams,AbortController,setTimeout,clearTimeout,setInterval:()=>1,clearInterval:()=>{},crypto:require('node:crypto').webcrypto});
 const shell=(_a,_t,_h,body)=>{document.getElementById('room').innerHTML=body;};
 return {api:window.AIWiseBetaSpace,document,version,review,shell,opened:()=>opened,setAuth:a=>auth=a,location};
}
test('Beta starts with real versions and safely escaped metadata; members cannot create versions',async()=>{
 const c=fixture('member');await c.api.render(c.shell);
 assert.equal(c.document.querySelector('[data-create]'),null);assert.equal(c.document.querySelector('.beta-flow'),null);assert.equal(c.document.querySelector('.beta-feed-grid'),null);
 assert.equal(c.document.querySelector('img'),null);assert.match(c.document.querySelector('[data-version-list]').textContent,/V1_2026-09-30/);
 c.document.querySelector('[data-open]').onclick();assert.equal(c.location.hash,'#beta/current');
});
test('Saved preview passes version identity, stays in-page and clones content; Dutch fallback is the saved English copy',async()=>{
 const c=fixture();await c.api.render(c.shell,id+'?page=common%2Faiwise-c1-final.html%3Fcourse%3Daws1&memo=abc');
 assert.equal(c.opened()[2].container,c.document.getElementById('room'));assert.equal(c.opened()[2].version.id,id);assert.equal(c.opened()[2].memo,'abc');
 const rows=c.api.snapshot(id,'common','en');assert.equal(rows[0].slots['c1.title'],'Saved title');rows[0].slots['c1.title']='Mutated';
 assert.equal(c.api.snapshot(id,'common','en')[0].slots['c1.title'],'Saved title');
 assert.equal(c.api.snapshot(id,'common','nl')[0].fallback_locale,'en');
 assert.throws(()=>c.api.snapshot('other','common','en'),/not available/);
 c.setAuth({status:'not-member',user:{id:'owner'}});assert.throws(()=>c.api.snapshot(id,'common','en'),/not available/);
 c.api.dispose();assert.throws(()=>c.api.snapshot(id,'common','en'),/not available/);
});
test('Missing migration keeps content accessible and shows an actionable count error',async()=>{
 const c=fixture('admin',{code:'PGRST205'});await c.api.render(c.shell);
 assert.equal(c.document.querySelector('[data-open]').disabled,false);assert.match(c.document.querySelector('[data-space-message]').textContent,/not ready yet/);
});
test('Saved-version renderer uses the signed-in parent copy and never requests latest public content',async()=>{
 let fetched=false;const parent={};parent.parent=parent;parent.AIWiseBetaSpace={snapshot:(v,c,l)=>[{course:c,locale:l,slots:{frozen:v}}]};
 const window={location:{href:'https://example.test/common/c1.html?review_version='+id},parent};
 vm.runInNewContext(code('pipelines/beta-content.js'),{window,URL,AbortController,setTimeout,clearTimeout,fetch:()=>{fetched=true;throw Error('unexpected');}});
 const rows=await window.AIWiseBetaContent.read('common','en');assert.equal(rows[0].slots.frozen,id);assert.equal(fetched,false);
 const top={location:window.location};top.parent=top;
 vm.runInNewContext(code('pipelines/beta-content.js'),{window:top,URL,AbortController,setTimeout,clearTimeout});
 await assert.rejects(()=>top.AIWiseBetaContent.read('common','en'),/Workspace/);
});

test('next-release preview freezes the approved copy for this visit without creating a saved version',async()=>{const c=fixture();await c.api.render(c.shell,'current');assert.equal(c.opened()[2].version,null);assert.equal(c.opened()[2].draft.fingerprint,'copy');c.version.content[0].slots['c1.title']='A later approval';assert.equal(c.api.snapshot('current','common','en')[0].slots['c1.title'],'Saved title');c.api.dispose();});

test('version chooser has no separate checklist; opening preview selects the first pending change with its exact language and scope',async()=>{
 const c=fixture();await c.api.render(c.shell);assert.equal(c.document.querySelector('[data-review-checklist]'),null);
 c.review.changes=[{course:'common',chapter:'c1',locale:'en',key:'c1.title'},{course:'pedagogical-sciences',chapter:'c2',locale:'nl',key:'c2.example'}];c.review.checks=[{course:'common',chapter:'c1',locale:'en',item_key:'c1.title',reviewed:true}];
 await c.api.render(c.shell,'current');const o=c.opened()[2];assert.equal(o.item,'c2.example');assert.equal(o.scope,'pedagogical-sciences');assert.equal(o.initialPage,'common/aiwise-c2-final.html?course=pedagogical-sciences.inleiding&lang=nl');assert.equal(o.review.fingerprint,'copy');
 await c.api.render(c.shell,id);assert.equal(c.opened()[2].item,'c2.example');
 await c.api.render(c.shell,'current?page=common%2Flobby.html%3Fcourse%3Daws1&memo=specific');assert.equal(c.opened()[2].memo,'specific');assert.equal(c.opened()[2].initialPage,'common/lobby.html?course=aws1');assert.equal(c.opened()[2].item,null);
});
