/* Real Studio and module rendering, isolated browser; no live writes. */
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),ctx);
const C=ctx.window.AIWiseCommonContent;
const seeds={};
for(const ch of ['c1','c2','c3','map']){const h=fs.readFileSync(path.join(root,'common/'+(ch==='map'?'aiwise-c1-anatomy-2d.html':'aiwise-'+ch+'-final.html')),'utf8');seeds[ch]=Object.fromEntries(C.catalog(parseHTML(h).document,ch).map(b=>[b.path,b.fields]));}
const dpas=JSON.parse(fs.readFileSync(path.join(root,'course-specific/dpas/dpas.json'),'utf8')),courseSeeds={};
for(const ch of ['c2','c3']){const h=fs.readFileSync(path.join(root,'common/aiwise-'+ch+'-final.html'),'utf8');courseSeeds[ch]=Object.fromEntries([...parseHTML(h).document.querySelectorAll('[data-slot]')].map(n=>{const key=n.dataset.slot;return [key,key.split('.').reduce((v,k)=>v?.[k],dpas)];}).filter(([,v])=>v!==undefined));}
const auth=`window.AIWiseAuth={snapshot:()=>({status:'member',role:'admin',user:{id:'test-admin',email:'test@example.invalid',name:'Test admin',displayName:'Test admin'}}),subscribe(fn){fn(this.snapshot());return ()=>{};},refresh:async()=>{}};`;
const backend=`window.AIWiseBackend={getClient:async()=>({from:()=>chain(),rpc:()=>Promise.resolve({data:{blocks:1,sat_phases:1,example_boxes:1,bidirectional_layout:1},error:null})})};function chain(){return new Proxy({then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)},{get:(target,key)=>key==='then'?target.then:()=>chain()});}`;
const loader=fs.readFileSync(path.join(root,'pipelines/beta-content.js'),'utf8')+`;{const original=window.AIWiseBetaContent;window.AIWiseBetaContent={...original,read:async()=>[],editing:async()=>[],sources:async(course,locale)=>Object.entries(course==='common'?${JSON.stringify(seeds)}:${JSON.stringify(courseSeeds)}).map(([chapter,slots])=>({course,chapter,locale,slots}))};}`;
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;
 const overrides={'/workspace/auth.js':auth,'/workspace/supabase-connection.js':backend,'/pipelines/beta-content.js':loader,'/workspace/tutorials.js':'window.AIWiseGuides={show:()=>{},mount:()=>{}};'};
 if(overrides[p]){res.setHeader('Content-Type','text/javascript');res.end(overrides[p]);return;}
 if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');let body=fs.readFileSync(file);if(p==='/workspace/index.html')body=body.toString().replace('<body>','<body><p style="padding:10px;background:#fff4ca;text-align:center">LOCAL DPAS EDITOR TEST · isolated drafts · no live account or submissions</p>');res.end(body);}catch{res.writeHead(404).end();}
});
server.listen(8770,'127.0.0.1',()=>console.log('DPAS local verification server ready'));
