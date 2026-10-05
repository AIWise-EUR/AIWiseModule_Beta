/* Real approval modal, isolated browser and mocked authenticated RPC adapter. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const harness=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${['theme','workspace','auth','draft-recovery'].map(f=>`<link rel="stylesheet" href="${f}.css">`).join('')}
<script src="draft-recovery.js"></script><script src="approval-review.js"></script></head><body><button id="open">Review request</button>
<script>
window.calls=[];window.AIWiseSharedStudio={prepareApproval:async()=>window.fixture,applyApproval:async(...args)=>{if(window.fail)throw Error('Beta changed while you were reviewing. Close this comparison and review again.');window.calls.push(args)}};
window.start=(overlap=true)=>{const base={'c1.block-1':{'Heading 1':'Academic responsibility','Text 1':'Original paragraph','Text 2':'Original conclusion'}},draft=structuredClone(base),latest=structuredClone(base);draft['c1.block-1']['Text 1']='Requested wording';latest['c1.block-1']['Text 2']='An independent newer conclusion';if(overlap)latest['c1.block-1']['Text 1']='New Beta wording';window.fixture={base,draft,latest,release:'new-release'};window.calls=[];window.fail=false;};window.start();document.querySelector('#open').onclick=()=>{window.result=undefined;AIWiseApprovalReview.review({id:'request',rev:1,target:'AI-Wise Common · C1 · English',contentSnapshot:{course:'common'}},'Reviewed carefully').then(value=>window.result=value);};
</script></body></html>`;
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p==='/workspace/approval-test.html'){res.setHeader('Content-Type','text/html');res.end(harness);return;}const f=path.resolve(root,'.'+p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/workspace/approval-test.html');
  const open=async()=>{await page.locator('#open').click();await page.locator('dialog[open]').waitFor();};
  await open();assert.match(await page.locator('dialog').textContent(),/1 overlapping change/);await page.locator('[data-close]').click();await page.waitForFunction(()=>window.result===false);assert.equal(await page.evaluate(()=>calls.length),0);
  await open();await page.locator('[data-next]').click();assert.match(await page.locator('dialog').textContent(),/Both versions changed this paragraph. Choose which wording to keep./);assert.equal(await page.locator('[data-next]').isDisabled(),true);
  await page.locator('textarea').fill('Combined wording <img src=x onerror=alert(1)>');assert.equal(await page.locator('input[value="edit"]').isChecked(),true);assert.equal(await page.locator('[data-next]').isDisabled(),false);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('dialog').evaluate(d=>d.scrollWidth<=d.clientWidth),true);await page.setViewportSize({width:1280,height:1000});
  if(process.env.APPROVAL_SCREENSHOT)await page.screenshot({path:process.env.APPROVAL_SCREENSHOT});
  await page.locator('[data-next]').click();assert.match(await page.locator('dialog').textContent(),/Combined wording/);assert.equal(await page.locator('dialog img').count(),0);await page.locator('[data-next]').click();await page.waitForFunction(()=>window.result===true);
  const call=await page.evaluate(()=>calls[0]);assert.equal(call[4]['c1.block-1']['Text 1'],'Combined wording <img src=x onerror=alert(1)>');assert.equal(call[4]['c1.block-1']['Text 2'],'An independent newer conclusion');assert.equal(call[3][0].choice,'edit');
  await page.evaluate(()=>start(false));await open();await page.locator('[data-next]').click();assert.match(await page.locator('h2').textContent(),/Apply these changes/);await page.evaluate(()=>window.fail=true);await page.locator('[data-next]').click();assert.match(await page.locator('[data-error]').textContent(),/Beta changed/);assert.equal(await page.evaluate(()=>calls.length),0);await page.locator('[data-close]').click();
  await page.evaluate(()=>{start(false);fixture.latest=structuredClone(fixture.draft)});await open();await page.locator('[data-next]').click();assert.match(await page.locator('h2').textContent(),/already in Beta/);assert.match(await page.locator('[data-next]').textContent(),/already reflected/);await page.locator('[data-next]').click();await page.waitForFunction(()=>window.result===true);
  assert.deepEqual(errors,[]);console.log('PASS approval modal browser: cancel, mandatory choice, manual wording, safe rendering, mobile, exact merged submission, concurrent failure and no-op preview');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
