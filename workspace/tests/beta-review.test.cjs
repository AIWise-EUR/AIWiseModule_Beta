const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto}=require('node:crypto'),{parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
function anchors(){const window={};vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/beta-anchors.js'),'utf8'),{window,crypto:webcrypto,TextEncoder,Uint8Array});return window.AIWiseBetaAnchors;}
const A=anchors();
test('anchors restore unchanged content and refuse changed content or invalid selectors',async()=>{
 const {document}=parseHTML('<html><body><main><p>Shared <strong>content</strong>.</p><p>Second paragraph.</p></main></body></html>');
 const node=document.querySelector('p'),anchor=await A.make(node,'comment');
 assert.equal(await A.locate(document,anchor),node);
 document.body.appendChild(document.createElement('div'));assert.equal(await A.locate(document,anchor),node);
 node.textContent='Changed content';assert.equal(await A.locate(document,anchor),null);
 assert.equal(await A.locate(document,{...anchor,path:'body,script'}),null);
});
test('content targets exclude navigation and include labelled diagrams',async()=>{
 const {document}=parseHTML('<html><body><nav><svg></svg></nav><main><h2>Review me</h2><iframe title="Diagram" src="diagram.html"></iframe></main><footer><p>Navigation</p></footer></body></html>');
 assert.equal(A.targets(document).length,2);const node=document.querySelector('iframe'),anchor=await A.make(node,'pin',{x:.5,y:.5});
 assert.match(anchor.excerpt,/Diagram/);assert.equal(await A.locate(document,anchor),node);node.setAttribute('src','changed.html');assert.equal(await A.locate(document,anchor),null);
});
test('box coordinates are normalized and survive reverse dragging',()=>{
 const node={getBoundingClientRect:()=>({left:100,top:200,width:400,height:200})};
 const a=A.point(node,500,400),b=A.point(node,200,250),box=A.box(a,b);
 assert.equal(box.x,.25);assert.equal(box.y,.25);assert.equal(box.w,.75);assert.equal(box.h,.75);
 assert.equal(A.point(node,0,9999).y,1);
});
function service(handler){
 let auth={status:'member',user:{id:'member-id'}};
 const chain=(table)=>{let op='select',record,filters=[];const q={select(){return q;},single(){return q;},eq(k,v){filters.push([k,v]);return q;},in(){return q;},is(k,v){filters.push([k,v]);return q;},order(){return q;},insert(r){op='insert';record=r;return q;},update(r){op='update';record=r;return q;},abortSignal(){return handler({table,op,record,filters});}};return q;};
 const backend={from:chain,rpc:()=>({abortSignal:async()=>({data:'member'})})};
 const window={AIWiseAuth:{snapshot:()=>auth},AIWiseBackend:{getClient:async()=>backend}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/beta-feedback.js'),'utf8'),{window,AbortController,setTimeout,clearTimeout});
 return {api:window.AIWiseBetaFeedback,setAuth:v=>auth=v};
}
test('lost insert response retries find the same immutable comment and reject changed anchors',async()=>{
 const anchor={kind:'comment',path:'body>main:nth-of-type(1)',fingerprint:'a'.repeat(64),excerpt:'Original'};
 const record={id:'memo-id',page:'common/lobby.html?course=aws1',anchor,body:'Comment'};
 const {api}=service(async q=>q.op==='insert'?{error:{code:'23505'}}:{data:{...record,author_id:'member-id'}});
 assert.equal((await api.add(record)).id,'memo-id');
 await assert.rejects(()=>api.add({...record,anchor:{...anchor,excerpt:'Changed'}}),/changed/);
});
test('sign-out during a request rejects private results',async()=>{
 let finish;const pending=new Promise(r=>finish=r),ctx=service(async()=>pending);
 const request=ctx.api.add({id:'new',body:'Comment'});await new Promise(r=>setImmediate(r));
 ctx.setAuth({status:'signed-out',user:null});finish({data:{id:'new'}});
 await assert.rejects(()=>request,/account changed/);
});
test('setup and permission failures have user-facing messages; stale resolution is not success',async()=>{
 const missing=service(async()=>({error:{code:'PGRST205',message:'internal table name'}}));
 await assert.rejects(()=>missing.api.list('common/lobby.html'),/not ready yet/);
 const stale=service(async()=>({data:[]}));await assert.rejects(()=>stale.api.resolve('memo',true,false),/changed or you cannot resolve/);
});
