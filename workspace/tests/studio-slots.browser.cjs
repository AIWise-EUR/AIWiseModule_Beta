/* Integration coverage for every existing course slot, legacy drafts and save conflicts. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const sources=Object.fromEntries(['aws1','ped'].map(id=>[id,JSON.parse(fs.readFileSync(path.join(root,`course-specific/${id}/${id==='aws1'?'course-specific-content_aws1':id}.json`),'utf8'))]));
const server=http.createServer((req,res)=>{
 let p=new URL(req.url,'http://localhost').pathname;if(p.endsWith('/'))p+='index.html';
 const file=path.join(root,p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox'],headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('[data-cs-edit]')?.disabled===false && document.querySelector('iframe')?.title.includes((location.hash.split('/')[2] || 'c2').toUpperCase()));
 const go=async(course,chapter)=>{await page.goto(`${origin}/workspace/#studio/${course}/${chapter}`);await ready();};
 const key=(id,ch)=>`aiwise_content_studio_${id}_${ch}_v1`;
 const stored=(id,ch)=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key(id,ch));
 const choose=async i=>{await page.locator('#cs-example').click();await page.locator(`[data-cs-choice="${i}"]`).click();await page.locator('[data-cs-edit]').click();};
 const saveClose=async()=>{await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();};
 await go('ped','c2');
 assert.equal(await page.locator('nav[aria-label="Chapter"]').count(),0);
 await page.locator('#cs-example').click();
 assert.equal(await page.locator('#cs-examples-menu [data-cs-chapter="c2"]').count(),8);
 assert.equal(await page.locator('#cs-examples-menu [data-cs-chapter="c3"]').count(),15);
 await page.locator('[data-cs-chapter="c3"][data-cs-item="9"]').click();
 await page.waitForURL(/\/c3\/9$/);await ready();
 assert.equal(await page.locator('[data-cs-title]').textContent(),'Critique decide');
 assert.equal(await page.frameLocator('iframe').locator('#cs-item-9').isVisible(),true);
 await page.locator('#cs-example').click();await page.keyboard.press('Home');
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.csChapter),'c2');
 await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.dataset.csItem),'14');
 await page.keyboard.press('Escape');
 await page.locator('#cs-example').click();await page.locator('[data-cs-chapter="c2"][data-cs-item="7"]').click();
 await page.waitForURL(/\/c2\/7$/);await ready();
 assert.equal(await page.locator('[data-cs-title]').textContent(),'S.A.T worked example');
 await page.reload();await ready();assert.equal(await page.locator('[data-cs-title]').textContent(),'S.A.T worked example');
 await go('ped','c2');
 // Restore an actual v1 shape without the new S.A.T fields.
 const legacy={schema:1,course:'ped',slot:'c2.examples',savedAt:new Date().toISOString(),baseExamples:sources.ped.c2.examples,examples:structuredClone(sources.ped.c2.examples)};
 legacy.examples[0].title='Existing legacy draft';
 await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[key('ped','c2'),legacy]);
 await page.reload();await ready();assert.equal(await page.locator('[data-cs-title]').textContent(),'Existing legacy draft');
 assert.match(await page.locator('[data-cs-coverage]').textContent(),/^8 editable/);
 await choose(6);await page.locator('.cs-fields textarea').fill('New S.A.T title');await saveClose();
 await choose(7);await page.locator('[name="phases.0.steps.0.text"]').fill('Changed S.A.T step');
 await page.locator('[name="phases.0.steps.0.actor"]').selectOption('team');await saveClose();
 const pedC2=await stored('ped','c2');assert.equal(pedC2.examples[0].title,'Existing legacy draft');assert.equal(pedC2.slots['c2.sat_example'].phases[0].steps[0].text,'Changed S.A.T step');
 await page.reload();await ready();
 assert.match(await page.locator('iframe').evaluate(el=>el.contentDocument.querySelector('[data-slot="c2.sat_example"]').textContent),/Changed S.A.T step/);
 await go('aws1','c2');assert.match(await page.locator('[data-cs-coverage]').textContent(),/Not configured.*S.A.T/);
 for(const course of ['aws1','ped']){
   await go(course,'c3');assert.match(await page.locator('[data-cs-coverage]').textContent(),/^15 editable/);
   const slots=await page.locator('iframe').evaluate(el=>[...el.contentDocument.querySelectorAll('[data-slot]')].map(n=>n.dataset.slot));
   for(let i=0;i<slots.length;i++){
     await choose(i);
     // Every source string is exposed. Change every textual leaf, including nested template lines.
     const inputs=page.locator('.cs-fields input,.cs-fields textarea');
     assert.ok(await inputs.count()>0,slots[i]);
     for(let j=0;j<await inputs.count();j++)await inputs.nth(j).fill(`Edited ${course} ${i} ${j} <script>literal</script>`);
     if(slots[i]==='c3.amd_example')await page.locator('[name="items.0.tag"]').selectOption('modify');
     await saveClose();
     assert.match(await page.locator('iframe').evaluate((el,i)=>el.contentDocument.getElementById('cs-item-'+i).textContent,i),new RegExp(`Edited ${course} ${i}`));
     assert.equal(await page.locator('iframe').evaluate(el=>el.contentDocument.querySelectorAll('script').length),0);
   }
   const saved=await stored(course,'c3');assert.equal(Object.keys(saved.slots).length,15);
   await page.reload();await ready();assert.match(await page.locator('.cs-status').first().textContent(),/restored/);
   assert.deepEqual(await stored('ped','c2'),pedC2);
   // The picker opens the right hidden technique pane, critique slide and details.
   for(const i of [5,9,14]){
     await page.locator('#cs-example').click();await page.locator(`[data-cs-choice="${i}"]`).click();
     const node=page.frameLocator('iframe').locator('#cs-item-'+i);assert.equal(await node.isVisible(),true);
     assert.equal(await node.evaluate(n=>!!n.closest('[inert]')),false);
   }
 }
 await page.screenshot({path:'/tmp/aiwise-c3-editor.png'});
 // Unsaved chapter navigation is canceled; cross-tab changes are preserved on save and reset.
 await choose(0);await page.locator('[name="good"]').fill('Unsaved local edit');await page.locator('[data-cs-close]').first().click();
 await page.locator('#cs-example').click();page.once('dialog',d=>d.dismiss());await page.locator('[data-cs-chapter="c2"][data-cs-item="0"]').click();await page.waitForURL(/\/c3$/);
 const external={...(await stored('ped','c3')),savedAt:'2026-09-28T10:00:00.000Z'};
 await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[key('ped','c3'),external]);
 await page.locator('.cs-actions [data-cs-save]').click();assert.match(await page.locator('.cs-status').first().textContent(),/Another tab/);
 assert.deepEqual(await stored('ped','c3'),external);
 page.once('dialog',d=>d.accept());await page.locator('[data-cs-reset]').click();assert.match(await page.locator('.cs-status').first().textContent(),/safely reset/);
 page.once('dialog',d=>d.accept());await page.reload();await ready();
 page.once('dialog',d=>d.accept());await page.locator('[data-cs-reset]').click();assert.equal(await stored('ped','c3'),null);assert.deepEqual(await stored('ped','c2'),pedC2);assert.ok(await stored('aws1','c3'));
 // Stale source records are not restored or overwritten.
 external.baseSlots['c3.full_example_title']='stale baseline';
 await page.evaluate(([k,v])=>localStorage.setItem(k,JSON.stringify(v)),[key('ped','c3'),external]);
 await page.reload();await ready();assert.match(await page.locator('.cs-status').first().textContent(),/could not be restored/);assert.deepEqual(await stored('ped','c3'),external);
 await page.setViewportSize({width:390,height:844});await choose(10);await page.screenshot({path:'/tmp/aiwise-c3-editor-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[data-cs-close]').first().click();await page.evaluate(()=>location.hash='#home');await page.locator('#updates-open').click();
 assert.equal(await page.locator('#updates-dialog a[href="#studio/aws1/c3"]').count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS all C3 slots for AWS1/PED, nested fields, S.A.T, legacy restore, safe text, hidden panes, unsaved navigation, cross-tab saves/reset, chapter isolation, stale source, mobile and activity links');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
