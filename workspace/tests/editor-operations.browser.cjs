/* Isolated real-browser regression. No production requests or personal browser profile.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node this-file
   EDITOR_SOURCE_DIR may point to the two baseline editor scripts for comparison. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const harness=`<!doctype html><html><head><meta charset="utf-8">
${['theme','workspace','auth','content-studio','studio-editing','draft-recovery','motion'].map(f=>`<link rel="stylesheet" href="${f}.css">`).join('')}
<script src="motion.js"></script><script src="course-registry.js"></script>
<script src="../pipelines/course-loader.js" data-render-only></script><script src="../pipelines/content-language.js" data-editor-only></script><script src="../pipelines/common-content.js" data-editor-only></script><script src="../pipelines/beta-content.js"></script>
<script>
window.AIWiseAuth={snapshot:()=>({status:'member',role:'admin'}),subscribe(){}};
window.AIWiseBackend={getClient:async()=>({rpc:async()=>({data:{blocks:1,sat_phases:1,example_boxes:1,bidirectional_layout:1}})})};
window.AIWiseControlTower={submissionName:()=> 'Isolated test editor',submitCommonDraft:async data=>{window.submitted=data;return {id:'test-request'};},submitStudioDraft:async data=>{window.submitted=data;return {id:'test-request'};}};
const readFixtures=async(scope,locale='en')=>fetch('/__fixtures/'+scope+'?lang='+locale).then(r=>r.json());
window.AIWiseBetaContent={apply:window.AIWiseBetaContent.apply,editing:readFixtures,read:readFixtures,sources:async()=>[]};
</script>
<script src="layout-sync.js"></script><script src="common-studio.js"></script><script src="studio-editing.js"></script><script src="draft-storage.js"></script><script src="draft-recovery.js"></script><script src="content-studio.js"></script>
</head><body><main></main><script>
window.startStudio=async(scope,chapter,item=0)=>{await AIWiseCourseRegistry.ready;AIWiseContentStudio.dispose();await AIWiseContentStudio.render((id,title,description,body)=>{document.querySelector('main').innerHTML='<h1>'+title+'</h1>'+description+body;},scope,chapter,item);};
</script></body></html>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/workspace/editor-operations-test.html'){res.setHeader('Content-Type','text/html');res.end(harness);return;}
 if(url.pathname.startsWith('/__fixtures/')){
  const scope=url.pathname.slice('/__fixtures/'.length),locale=url.searchParams.get('lang');
  if(!['common','psychology','pedagogical-sciences','dpas'].includes(scope)||!['en','nl'].includes(locale)){res.writeHead(400).end();return;}
  const dir=path.join(root,'content/approved',locale,scope);
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')))));return;
 }
 let file=path.resolve(root,'.'+url.pathname);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(process.env.EDITOR_SOURCE_DIR&&['/workspace/studio-editing.js','/workspace/content-studio.js'].includes(url.pathname))file=path.join(process.env.EDITOR_SOURCE_DIR,path.basename(file));
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  const ready=()=>page.waitForFunction(()=>document.querySelector('[data-cs-edit]')?.disabled===false);
  let count=0;const results=[];
  for(const locale of ['en','nl'])for(const scope of ['psychology','pedagogical-sciences','dpas','common'])for(const chapter of scope==='common'?['c1','c2','c3','map']:['c2','c3']){
   const name=[scope,chapter,locale].join('/');
   await page.goto(origin+'/workspace/editor-operations-test.html?lang='+locale);
   const item=scope!=='common'&&chapter==='c2'?'c2.examples':0;
   await page.evaluate(({scope,chapter,item})=>startStudio(scope,chapter,item),{scope,chapter,item});await ready();
   await page.locator('[data-cs-edit]').click();
   const input=page.locator('.cs-fields input,.cs-fields textarea').first();await input.waitFor();
   const fieldName=await input.getAttribute('name'),original=await input.inputValue(),text=original+' — preserved 🙂 '+name;
   assert.ok(fieldName,name+' has a normal field');await input.fill(text);
   assert.equal(await input.inputValue(),text);
   await page.locator('[data-cs-save]').click();
   await page.waitForFunction(()=>document.querySelector('.cs-status')?.textContent.startsWith('Draft saved in this browser'));
   const before=await page.evaluate(({scope,chapter,locale})=>{
    const raw=localStorage.getItem(AIWiseLanguage.draftKey(scope,chapter,locale));return {raw,record:JSON.parse(raw)};
   },{scope,chapter,locale});
   assert.equal(before.record.schema,1);assert.ok(before.raw.includes(text),name+' stored exact text');
   await page.reload();await page.evaluate(({scope,chapter,item})=>startStudio(scope,chapter,item),{scope,chapter,item});await ready();
   await page.locator('[data-cs-edit]').click();assert.equal(await page.locator('.cs-fields [name]').first().inputValue(),text,name+' restored text');
   assert.equal(await page.evaluate(({scope,chapter,locale})=>localStorage.getItem(AIWiseLanguage.draftKey(scope,chapter,locale)),{scope,chapter,locale}),before.raw,name+' opening is not a write');
   await page.locator('[data-cs-close]').first().click();
   // Existing source-review/layout gates remain effective; only send if already allowed.
   const canSubmit=await page.locator('[data-cs-submit]').isEnabled();
   if(canSubmit){
    await page.locator('[data-cs-submit]').click();await page.locator('[data-cs-submit-summary]').fill('Isolated regression test');await page.locator('.cs-submit-form [type=submit]').click();
    await page.waitForFunction(()=>!!window.submitted);assert.equal(await page.evaluate(()=>submitted.raw),before.raw);
   }
   if(scope!=='common'&&chapter==='c2'){
    await page.evaluate(()=>document.querySelector('.cs-submit-dialog')?.close());
    const beforeTitle=await page.locator('[data-cs-title]').textContent();await page.locator('[data-cs-next]').click();assert.notEqual(await page.locator('[data-cs-title]').textContent(),beforeTitle,name+' next card');
    await page.locator('[data-cs-prev]').click();assert.equal(await page.locator('[data-cs-title]').textContent(),beforeTitle,name+' previous card');
   }
   const record={...before.record};delete record.savedAt;
   results.push({name,record,canSubmit});
   console.log('PASS browser '+name+' edit/save/reload'+(scope!=='common'&&chapter==='c2'?'/navigation':'')+(canSubmit?'/mock-submit':''));count++;
  }
  assert.equal(count,20);assert.deepEqual(errors,[]);
  if(process.env.EDITOR_RESULT_PATH)fs.writeFileSync(process.env.EDITOR_RESULT_PATH,JSON.stringify(results));
  console.log('PASS all 20 Studio scope/chapter/language combinations; isolated local storage, no production writes.');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
