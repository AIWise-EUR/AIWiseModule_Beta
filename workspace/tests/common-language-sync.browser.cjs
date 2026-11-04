/* Real Studio and module rendering, isolated browser; no live writes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),{parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),ctx={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),ctx);
const C=ctx.window.AIWiseCommonContent,chapter='c2',html=fs.readFileSync(path.join(root,'common/aiwise-c2-final.html'),'utf8'),catalog=C.catalog(parseHTML(html).document,chapter);
const base=JSON.parse(JSON.stringify(Object.fromEntries(catalog.map(b=>[b.path,b.fields])))),draft=structuredClone(base);draft['c2.block-0'][Object.keys(draft['c2.block-0'])[0]]='Mijn bestaande Nederlandse concept';
let en=JSON.parse(fs.readFileSync(path.join(root,'content/approved/en/common/c2.json'),'utf8')).slots,release='11111111-1111-4111-8111-111111111111';
const oldRelease=release,key='aiwise_common_studio_c2_nl_v1';
const original=JSON.stringify({schema:1,scope:'common',chapter:'c2',locale:'nl',sourceRelease:oldRelease,baseRelease:null,savedAt:new Date().toISOString(),sourceHTML:html,baseSlots:base,slots:draft});
const courseData=JSON.parse(fs.readFileSync(path.join(root,'course-specific/aws1/course-specific-content_aws1.json'),'utf8')),courseSeed=Object.fromEntries([...parseHTML(html).document.querySelectorAll('[data-slot]')].map(n=>{const key=n.dataset.slot;return [key,key.split('.').reduce((v,k)=>v?.[k],courseData)];}).filter(([,v])=>v!==undefined));
const auth=`window.AIWiseAuth={snapshot:()=>({status:'member',role:'admin',user:{id:'test-admin',email:'test@example.invalid',name:'Test admin',displayName:'Test admin'}}),subscribe(fn){fn(this.snapshot());return ()=>{};},refresh:async()=>{}};`;
const backend=`window.AIWiseBackend={getClient:async()=>({from:()=>chain(),rpc:()=>Promise.resolve({data:{blocks:1,sat_phases:1},error:null})})};function chain(){return new Proxy({then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)},{get:(target,key)=>key==='then'?target.then:()=>chain()});}`;
const loader=fs.readFileSync(path.join(root,'pipelines/beta-content.js'),'utf8')+`;{const original=window.AIWiseBetaContent;window.AIWiseBetaContent={...original,read:async(course,locale='en')=>course==='common'?(await(await fetch('/__fixture')).json())[locale]:[],sources:async(course)=>[{course,chapter:'c2',locale:'nl',slots:course==='common'?${JSON.stringify(base)}:${JSON.stringify(courseSeed)}}]};}`;
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;
 if(p==='/__fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({en:[{course:'common',chapter:'c2',locale:'en',submission_id:release,slots:en}],nl:[]}));return;}
 const overrides={'/workspace/auth.js':auth,'/workspace/supabase-connection.js':backend,'/pipelines/beta-content.js':loader,'/workspace/tutorials.js':'window.AIWiseGuides={show:()=>{},mount:()=>{}};'};
 if(overrides[p]){res.setHeader('Content-Type','text/javascript');res.end(overrides[p]);return;}
 if(p.endsWith('/'))p+='index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
 try{const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await context.addInitScript(({key,original})=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem(key,original);sessionStorage.setItem('seeded','1');}}, {key,original});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().startsWith('[Content Studio]'))errors.push(m.text());});
 const ready=()=>page.waitForFunction(()=>document.querySelector('#cs-example')?.disabled===false);
 const open=async slot=>{if(await page.locator('.cs-editor').evaluate(d=>d.open))await page.locator('[data-cs-close]').first().click();const index=catalog.findIndex(b=>b.path===slot);await page.frameLocator('iframe').locator(`[data-cs-common-item="${index}"]`).evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));await page.locator('.cs-editor[open]').waitFor();};
 await page.goto(origin+'/workspace/?lang=nl#common/c2');await ready();assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),original,'opening never overwrites the existing draft');
 assert.equal(await page.frameLocator('iframe').locator('[data-studio-box]').count(),en._studio.boxes.length);
 assert.match(await page.frameLocator('iframe').locator('.hero h2').textContent(),/Mijn bestaande/);
 await open(en._studio.boxes.find(b=>b.template==='text').slot);
 assert.equal(await page.getByRole('button',{name:'Add text box',exact:true}).count(),0);
 const boxField=page.locator('.cs-block-actions textarea').first();await boxField.fill('Voordat we beginnen');
 for(const box of en._studio.boxes){await open(box.slot);const marks=page.locator('.cs-block-actions').getByRole('button',{name:'Mark translation reviewed',exact:true});while(await marks.count()){const visible=marks.filter({visible:true});if(!await visible.count())break;await visible.first().click();}}
 await page.locator('.cs-editor [data-cs-save]').click();const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
 assert.equal(saved.translationSync.pending.length,0);assert.equal(saved.baseSlots._studio,undefined,'submission baseline stays the actual Dutch server baseline');assert.equal(await page.evaluate(k=>localStorage.getItem(k),saved.recoveryBackup),original);
 const translated=saved.slots._studio.boxes.find(b=>b.template==='text');assert.equal(translated.fields[0][0].text,'Voordat we beginnen');
 const backupCount=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes(':recovery-backup:')).length);await page.locator('.cs-block-actions textarea').last().fill('Bewaarde Nederlandse tekst');await page.locator('.cs-editor [data-cs-save]').click();assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes(':recovery-backup:')).length),backupCount,'ordinary saves must not accumulate full-size backups');
 await page.reload();await ready();assert.match(await page.locator('[data-cs-language-status]').textContent(),/0 fields need translation · 0 fields need review/);
 const oldBox=en._studio.boxes.find(b=>b.template==='text');en=structuredClone(en);en._studio.boxes=en._studio.boxes.filter(b=>b.id!==oldBox.id);en['c2.block-0'][Object.keys(en['c2.block-0'])[0]]='Changed English heading';release='22222222-2222-4222-8222-222222222222';
 const rawBefore=await page.evaluate(key=>localStorage.getItem(key),key);await page.reload();await ready();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),rawBefore);assert.match(await page.locator('[data-cs-language-status]').textContent(),/1 fields need review/);
 assert.equal(await page.frameLocator('iframe').locator('[data-studio-box]').count(),en._studio.boxes.length);assert.match(await page.frameLocator('iframe').locator('.hero h2').textContent(),/Mijn bestaande/);
 await open('c2.block-0');await page.locator('.cs-fields').getByRole('button',{name:'Mark translation reviewed',exact:true}).filter({visible:true}).click();await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();await page.locator('[data-cs-source-reviewed]').click();
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.equal(after.sourceRelease,release);assert.equal(after.translationSync.retired.find(b=>b.id===oldBox.id).fields[0][0].text,'Voordat we beginnen');
 assert.equal(await page.locator('.cs-actions [data-cs-submit]').isDisabled(),false);
 await page.setViewportSize({width:390,height:844});await open('c2.block-0');assert.equal(await page.locator('.cs-editor').evaluate(d=>d.scrollWidth<=d.clientWidth+1),true);
 await page.goto(origin+'/workspace/?lang=nl#studio/psychology/c2');await ready();assert.equal(await page.frameLocator('iframe').locator('[data-studio-box]:not([data-studio-course-box])').count(),en._studio.boxes.length,'Course Studio also shows the approved Common structure');
 assert.deepEqual(errors,[]);console.log('PASS common language sync browser: real Studio, original draft retention, editable added boxes, review gating, save/reload, source changes, deletion archive and mobile');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
