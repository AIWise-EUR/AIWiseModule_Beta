/* Browser regression for AWS1/PED draft isolation. Requires Playwright,
   CHROMIUM_PATH and SUPABASE_TEST_SDK, as in signup.browser.cjs. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const server=http.createServer((req,res)=>{
 let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
 const file=path.join(root,p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.request().url().startsWith('https://cdn.jsdelivr.net/')?r.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.SUPABASE_TEST_SDK,'utf8')}):r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>!document.querySelector('#cs-example')?.disabled && !!document.querySelector('iframe')?.contentDocument.querySelector('.carousel-card'));
 const go=async id=>{await page.evaluate(id=>location.hash='#studio/'+id,id);await page.waitForFunction(id=>document.querySelector('#room-title')?.textContent.startsWith(id==='ped'?'Pedagogical Sciences':'Academic Writing Skills I'),id);await ready();};
 const key=id=>'aiwise_content_studio_'+id+'_c2_v1';
 const stored=id=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id));
 async function edit(title){await page.frameLocator('iframe').locator('#cs-item-'+(Number((await page.locator('[data-cs-count]').textContent()).match(/· (\d+)/)[1])-1)).click();await page.locator('.cs-editor [name="title"]').fill(title);await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();}
 await page.goto(origin+'/workspace/#studio');
 await page.locator('#room a[href="#studio/ped"]').click();await ready();
 assert.match(await page.locator('[data-cs-title]').textContent(),/scientific essay/);
 assert.match(await page.locator('iframe').getAttribute('title'),/^Pedagogical Sciences/);
 assert.match(await page.locator('.help-note a').getAttribute('href'),/course=ped$/);
 const pedSource=JSON.parse(fs.readFileSync(path.join(root,'course-specific/ped/ped.json'),'utf8'));
 assert.equal(await page.locator('iframe').evaluate(el=>el.contentDocument.querySelector('[data-slot="c2.sat_example_title"]').textContent),pedSource.c2.sat_example_title);
 await edit('PED isolated draft');const pedDraft=await stored('ped');assert.equal(pedDraft.course,'ped');assert.equal(await stored('aws1'),null);
 await go('aws1');assert.match(await page.locator('[data-cs-title]').textContent(),/literature review/);
 await edit('AWS1 isolated draft');const awsDraft=await stored('aws1');assert.deepEqual(await stored('ped'),pedDraft);
 await go('ped');assert.equal(await page.locator('[data-cs-title]').textContent(),'PED isolated draft');
 await page.reload();await ready();assert.equal(await page.locator('[data-cs-title]').textContent(),'PED isolated draft');
 await page.frameLocator('iframe').locator('#cs-item-0').click();page.once('dialog',d=>d.accept());await page.locator('[data-cs-reset]').click();await page.locator('[data-cs-close]').first().click();assert.equal(await stored('ped'),null);assert.deepEqual(await stored('aws1'),awsDraft);
 await edit('PED retained draft');
 await page.evaluate(()=>location.hash='#home');await page.locator('#updates-open').click();
 assert.equal(await page.locator('#updates-dialog a[href="#studio/ped"]').count(),1);
 assert.equal(await page.locator('#updates-dialog a[href="#studio/aws1"]').count(),1);
 await page.locator('#updates-close').click();
 await page.evaluate(()=>location.hash='#courses/ped');
 await page.locator('#room .course-campus .studio').click();await ready();
 assert.match(await page.locator('#room-title').textContent(),/^Pedagogical Sciences/);
 // A wrongly labelled draft is blocked, never loaded or silently overwritten.
 await page.evaluate(k=>{const x=JSON.parse(localStorage.getItem(k));x.course='aws1';localStorage.setItem(k,JSON.stringify(x));},key('ped'));
 await page.reload();await ready();assert.match(await page.locator('.cs-status').first().textContent(),/could not be restored/);
 assert.equal((await stored('ped')).course,'aws1');assert.equal(await page.locator('.cs-editor [data-cs-save]').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS PED navigation, PED-specific preview, separate saves, restore, isolated reset, activity links, and mismatched-draft protection');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
