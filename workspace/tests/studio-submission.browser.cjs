/* Saved content transfer: browser-local requests, fixed copies, conflicts and failure handling. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('#cs-example')?.disabled===false);
 const go=async chapter=>{await page.goto(origin+'/workspace/#studio/ped/'+chapter);await ready();};
 const requests=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aiwise_control_tower_v1'))?.requests||[]);
 const send=()=>page.locator('.cs-actions [data-cs-submit]');
 const submit=page.locator('.cs-submit-form [type="submit"]');
 const name=page.locator('[data-cs-submit-name]'),summary=page.locator('[data-cs-submit-summary]');
 async function changeTitle(text){await page.frameLocator('iframe').locator('#cs-item-0').click();await page.locator('.cs-fields [name="title"]').fill(text);await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();}
 async function openSubmission(){await send().click();await page.locator('.cs-submit-dialog').waitFor({state:'visible'});}
 await go('c2');
 assert.equal(await page.locator('[data-cs-edit],[data-cs-jump]').count(),0);assert.equal(await send().isDisabled(),true);
 await changeTitle('Saved for review <img src=x onerror=alert(1)>');
 assert.equal(await send().isEnabled(),true);await openSubmission();
 await name.fill('Seyoon');await summary.fill('Review the updated first example.');
 await submit.evaluate(b=>{b.click();b.click();});await page.waitForURL(/#tower\/request\//);
 let rows=await requests();assert.equal(rows.length,1);const first=structuredClone(rows[0]);
 assert.equal(first.status,'pending');assert.equal(first.route,'studio');assert.equal(first.author.name,'Seyoon');
 assert.equal(first.contentSnapshot.slots['c2.examples'][0].title,'Saved for review <img src=x onerror=alert(1)>');
 assert.equal(await page.locator('.ct-submitted-content').count(),1);
 await page.locator('.ct-snapshot-item summary').first().click();
 assert.match(await page.locator('.ct-submitted-content').textContent(),/Saved for review/);assert.equal(await page.locator('.ct-submitted-content img').count(),0);
 await page.screenshot({path:'/tmp/aiwise-submitted-content.png'});
 // The same saved version opens its existing request instead of duplicating it.
 await go('c2');await openSubmission();await name.fill('Seyoon');await summary.fill('Same saved version');await submit.click();await page.waitForURL(/#tower\/request\//);assert.equal((await requests()).length,1);
 // Later edits stay out of the submitted copy, even after reset and reload.
 await go('c2');await changeTitle('Later draft');
 assert.deepEqual((await requests())[0].contentSnapshot,first.contentSnapshot);
 await page.frameLocator('iframe').locator('#cs-item-0').click();await page.locator('.cs-fields [name="title"]').fill('Not yet saved');
 assert.equal(await page.locator('.cs-editor [data-cs-submit]').isDisabled(),true);
 await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();
 // Changes in another tab while the submission form is open are not submitted.
 await openSubmission();await name.fill('Seyoon');await summary.fill('A stale version');
 const draftKey='aiwise_content_studio_ped_c2_v1';
 await page.evaluate(k=>{const d=JSON.parse(localStorage.getItem(k));d.savedAt='2026-09-28T12:00:00Z';localStorage.setItem(k,JSON.stringify(d));},draftKey);
 await submit.click();assert.match(await page.locator('[data-cs-submit-error]').textContent(),/changed in another tab/);assert.equal((await requests()).length,1);
 await page.locator('[data-cs-submit-close]').click();await page.reload();await ready();
 // Failed queue writes leave both the saved draft and previous requests intact.
 await openSubmission();await name.fill('Seyoon');await summary.fill('Storage failure check');
 const beforeDraft=await page.evaluate(k=>localStorage.getItem(k),draftKey);
 await page.evaluate(()=>{window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='aiwise_control_tower_v1')throw new DOMException('Full','QuotaExceededError');return window.originalStorageSet.call(this,k,v);};});
 await submit.click();assert.match(await page.locator('[data-cs-submit-error]').textContent(),/could not be saved/);assert.equal((await requests()).length,1);assert.equal(await page.evaluate(k=>localStorage.getItem(k),draftKey),beforeDraft);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalStorageSet);await submit.click();await page.waitForURL(/#tower\/request\//);assert.equal((await requests()).length,2);
 // C3 can save an initial draft and submit all 15 slots under the current account name.
 await go('c3');await page.frameLocator('iframe').locator('#cs-item-0').click();await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();
 await page.evaluate(()=>{window.AIWiseAuth={snapshot:()=>({user:{id:'test-account',displayName:'Account name'}})};});
 await openSubmission();assert.equal(await name.inputValue(),'Account name');assert.equal(await name.getAttribute('readonly'),'');
 await summary.fill('First C3 review');await submit.click();await page.waitForURL(/#tower\/request\//);
 rows=await requests();assert.equal(rows.length,3);const third=rows.find(r=>r.contentSnapshot.chapter==='c3');assert.equal(Object.keys(third.contentSnapshot.slots).length,15);assert.equal(third.author.userId,'test-account');
 // A review decision does not change the stored content or apply it to Beta.
 await page.locator('#ct-person').fill('Reviewer');await page.locator('#ct-person-form [type="submit"]').click();
 await page.locator('#ct-decisionReason').fill('Reviewed the submitted content copy.');await page.locator('[value="approved"]').click();
 assert.equal((await requests()).find(r=>r.id===third.id).status,'approved');assert.deepEqual((await requests()).find(r=>r.id===third.id).contentSnapshot,third.contentSnapshot);
 assert.match(await page.locator('.ct-detail-grid').textContent(),/Not applied/);
 assert.deepEqual(errors,[]);console.log('PASS save/send/review, removed buttons, fixed C2/C3 copies, duplicate submission, dirty/stale drafts, quota failure, account name and approval isolation');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
