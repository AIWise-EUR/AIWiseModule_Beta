/* Real Studio + iframe integration; isolated browser storage and mocked Beta reads.
   PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node ... */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const harness=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['theme','workspace','auth','content-studio','studio-editing','draft-recovery','motion'].map(f=>`<link rel="stylesheet" href="${f}.css">`).join('')}
<script src="motion.js"></script><script src="course-registry.js"></script>
<script src="../pipelines/course-loader.js" data-render-only></script><script src="../pipelines/content-language.js" data-editor-only></script><script src="../pipelines/common-content.js" data-editor-only></script><script src="../pipelines/beta-content.js"></script>
<script>window.AIWiseAuth={snapshot:()=>({status:'member',role:'admin'}),subscribe(){}};window.AIWiseBackend={getClient:async()=>({rpc:async()=>({data:{blocks:1}})})};window.AIWiseControlTower={submissionName:()=> 'Test editor',submitCommonDraft:async value=>{window.submitted=value;return {id:'test-request'};}};
window.releases=[];const applyBeta=window.AIWiseBetaContent.apply;window.AIWiseBetaContent={apply:applyBeta,read:async course=>JSON.parse(JSON.stringify(window.releases.filter(r=>r.course===course))),sources:async()=>[]};</script>
<script src="common-studio.js"></script><script src="studio-editing.js"></script><script src="draft-recovery.js"></script><script src="content-studio.js"></script></head><body><main></main>
<script>window.startStudio=async(course='common',chapter='c1')=>{await AIWiseCourseRegistry.ready;AIWiseContentStudio.dispose();await AIWiseContentStudio.render((id,title,description,body)=>{document.querySelector('main').innerHTML='<h1>'+title+'</h1>'+description+body;},course,chapter);};</script></body></html>`;
const server=http.createServer((req,res)=>{
 let p=new URL(req.url,'http://localhost').pathname;if(p==='/workspace/recovery-test.html'){res.setHeader('Content-Type','text/html');res.end(harness);return;}if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/workspace/recovery-test.html');
 async function seed(overlap=true){return page.evaluate(async overlap=>{
   window.AIWiseContentStudio.dispose();localStorage.clear();localStorage.setItem('pending-test-request','untouched');
   const html=await fetch('../common/aiwise-c1-final.html').then(r=>r.text()),blocks=AIWiseCommonContent.catalog(new DOMParser().parseFromString(html,'text/html'),'c1');
   const base=Object.fromEntries(blocks.map(b=>[b.path,b.fields])),mine=structuredClone(base),beta=structuredClone(base);
   const target=blocks.find(b=>Object.keys(b.fields).length>=2&&Object.keys(b.fields).some(k=>k.startsWith('Text'))),fields=Object.keys(target.fields).filter(k=>k.startsWith('Text'));
   const first=fields[0],second=fields[1];mine[target.path][first]='My actual test introduction';mine[target.path][second]='My independent second paragraph';if(overlap)beta[target.path][first]='Newly approved test introduction';
   beta._studio={version:1,formats:[],boxes:[{id:'box-aaaaaaaa-1111-4111-8111-111111111111',slot:target.path,template:'text',anchor:0,fields:[[{text:'Academic responsibility'}],[{text:'Newly approved box body'}]],align:'left',size:0}]};
   const key=AIWiseLanguage.draftKey('common','c1','en'),saved={schema:1,scope:'common',chapter:'c1',locale:'en',sourceHTML:html,baseRelease:'old-release',savedAt:'2026-10-01T10:00:00.000Z',baseSlots:base,slots:mine};
   const raw=JSON.stringify(saved);localStorage.setItem(key,raw);window.releases=[{course:'common',chapter:'c1',locale:'en',submission_id:'new-release',slots:beta}];
   await window.startStudio();return {key,raw,path:target.path,first,second};
 },overlap);}
 const ready=()=>page.locator('.dr-dialog[open]').waitFor();
 const fixture=await seed();await ready();assert.match(await page.locator('.dr-dialog').textContent(),/Changed in your draft/);assert.match(await page.locator('.dr-dialog').textContent(),/Changed in Beta/);
 if(process.env.RECOVERY_SCREENSHOT)await page.screenshot({path:process.env.RECOVERY_SCREENSHOT});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.dr-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),true,'mobile modal must not overflow');
 await page.setViewportSize({width:1280,height:1000});await page.locator('[data-dr-next]').click();assert.match(await page.locator('.dr-dialog').textContent(),/Both versions changed this paragraph. Choose which wording to keep./);assert.equal(await page.locator('[data-dr-next]').isDisabled(),true);
 await page.locator('input[value="draft"]').check();await page.locator('[data-dr-next]').click();await page.locator('[data-dr-next]').click();await page.locator('.dr-dialog').waitFor({state:'hidden'});
 const result=await page.evaluate(key=>({saved:JSON.parse(localStorage.getItem(key)),pending:localStorage.getItem('pending-test-request')}),fixture.key);
 assert.equal(result.saved.slots[fixture.path][fixture.first],'My actual test introduction');assert.equal(result.saved.slots[fixture.path][fixture.second],'My independent second paragraph');assert.equal(result.saved.slots._studio.boxes[0].fields[0][0].text,'Academic responsibility');assert.equal(result.saved.baseRelease,'new-release');assert.equal(result.pending,'untouched');
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),result.saved.recoveryBackup),fixture.raw);
 assert.equal(await page.locator('[data-cs-submit]').isDisabled(),false);
 await page.evaluate(()=>window.startStudio());await page.waitForFunction(()=>document.querySelector('[data-cs-edit]')?.disabled===false);assert.equal(await page.locator('.dr-dialog[open]').count(),0);assert.equal(await page.locator('[data-cs-backup]').isVisible(),true);
 // Frozen submission carries the new baseline and combined content, never edits an existing pending request.
 await page.locator('[data-cs-submit]').click();await page.locator('[data-cs-submit-summary]').fill('Recovered combined draft');await page.locator('.cs-submit-form [type="submit"]').click();await page.waitForFunction(()=>!!window.submitted);assert.equal(await page.evaluate(()=>window.submitted.baseRelease),'new-release');
 // Beta may advance during the comparison: do not store the obsolete merge.
 const stale=await seed();await ready();await page.locator('[data-dr-next]').click();await page.locator('input[value="beta"]').check();await page.locator('[data-dr-next]').click();await page.evaluate(()=>window.releases[0].submission_id='even-newer-release');await page.locator('[data-dr-next]').click();await page.locator('[data-dr-error]').filter({hasText:'Beta changed again'}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),stale.key),stale.raw);
 // Another tab may replace the saved draft during the review.
 const race=await seed(false);await ready();await page.locator('[data-dr-next]').click();await page.evaluate(k=>localStorage.setItem(k,'another-tab-copy'),race.key);await page.locator('[data-dr-next]').click();await page.locator('[data-dr-error]').filter({hasText:'Another tab'}).waitFor();assert.equal(await page.evaluate(k=>localStorage.getItem(k),race.key),'another-tab-copy');
 // Invalid records get an export-only explanation, not a force-apply bypass.
 await page.evaluate(async()=>{AIWiseContentStudio.dispose();localStorage.setItem(AIWiseLanguage.draftKey('common','c1','en'),'{invalid');await window.startStudio();});await ready();assert.match(await page.locator('.dr-dialog').textContent(),/different recovery/);assert.equal(await page.locator('[data-dr-next]').isVisible(),false);
 // Course C2 uses split examples/baseSlots storage, and the list must remain atomic.
 const courseFixture=await page.evaluate(async()=>{
   AIWiseContentStudio.dispose();localStorage.clear();const data=await fetch('../course-specific/aws1/course-specific-content_aws1.json').then(r=>r.json());
   const base={'c2.examples':data.c2.examples,'c2.sat_example_title':data.c2.sat_example_title,'c2.sat_example':data.c2.sat_example},beta=structuredClone(base),mine=structuredClone(base);
   mine['c2.examples'][0].title='My course example title';beta['c2.examples'][0].title='Approved course example title';
   beta['c2.sat_example_title']='Approved SAT title';
   window.releases=[{course:'psychology',chapter:'c2',locale:'en',submission_id:'course-new',slots:beta}];
   const extras=value=>Object.fromEntries(Object.entries(value).filter(([k])=>k!=='c2.examples'));
   const key=AIWiseLanguage.draftKey('psychology','c2','en'),raw=JSON.stringify({schema:1,course:'psychology',slot:'c2.examples',locale:'en',baseRelease:'course-old',baseExamples:base['c2.examples'],examples:mine['c2.examples'],baseSlots:extras(base),slots:extras(mine)});
   localStorage.setItem(key,raw);await window.startStudio('psychology','c2');return {key,raw};
 });await ready();await page.locator('[data-dr-next]').click();await page.locator('input[value="draft"]').check();await page.locator('[data-dr-next]').click();await page.locator('[data-dr-next]').click();await page.locator('.dr-dialog').waitFor({state:'hidden'});
 const courseResult=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),courseFixture.key);assert.equal(courseResult.examples[0].title,'My course example title');assert.equal(courseResult.slots['c2.sat_example_title'],'Approved SAT title');assert.equal(courseResult.baseRelease,'course-new');assert.equal(await page.evaluate(k=>localStorage.getItem(k),courseResult.recoveryBackup),courseFixture.raw);
 assert.deepEqual(errors,[]);console.log('PASS Common and Content Studio browser recovery: actual iframe render, visual review, mobile layout, backup, reload, submission, stale Beta, cross-tab race and malformed draft.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
