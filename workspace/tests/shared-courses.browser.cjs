/* Real Workspace UI, two isolated accounts; simulated server writes only. */
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict'), http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const initialRegistry = JSON.parse(fs.readFileSync(path.join(root, 'common/courses/registry.json')));
let registry = structuredClone(initialRegistry), mode = '', writes = 0, sha = 'a'.repeat(40);
const auth = `window.AIWiseAuth={snapshot:()=>({status:'member',role:'admin',user:{id:window.testAccount||'test-admin',email:'test@example.invalid',name:'Test admin',displayName:'Test admin'}}),subscribe(fn){fn(this.snapshot());return ()=>{};},refresh:async()=>{}};`;
const backend = `window.AIWiseBackend={getClient:async()=>({from:()=>chain(),rpc:()=>chain(),functions:{invoke:async(name,options)=>{const r=await fetch('/__test_registry',{method:'POST',body:JSON.stringify(options.body)});return r.ok?{data:await r.json(),error:null}:{data:null,error:{context:r}};}}})};function chain(){return new Proxy({then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)},{get:(target,key)=>key==='then'?target.then:()=>chain()});}`;
const server = http.createServer(async (req, res) => {
  let p = new URL(req.url, 'http://localhost').pathname;
  if (p === '/__test_registry') {
    let text = ''; for await (const chunk of req) text += chunk;
    const body = JSON.parse(text); res.setHeader('Content-Type', 'application/json');
    if (mode === 'missing') { res.writeHead(404).end(JSON.stringify({code:'NOT_FOUND'}));return; }
    if (body.action !== 'load') {
      if (mode === 'conflict') { res.writeHead(409).end(JSON.stringify({code:'registry_conflict'}));return; }
      assert.equal(body.expected_sha, sha);
      const existing = registry.courses.find(c=>c.bachelor===body.course.bachelor&&c.id===body.course.id);
      if (existing) Object.assign(existing, body.course); else registry.courses.push(body.course);
      sha = 'b'.repeat(40); writes++;
    }
    res.end(JSON.stringify({ok:true,capability:'workspace-courses-v1',sha,commit:body.action==='load'?null:'c'.repeat(40),registry}));return;
  }
  if (p === '/workspace/tutorials.js') {res.setHeader('Content-Type','text/javascript');res.end('window.AIWiseGuides={show:()=>{},mount:()=>{}};');return;}
  if (p === '/workspace/auth.js' || p === '/workspace/supabase-connection.js') {res.setHeader('Content-Type','text/javascript');res.end(p.endsWith('/auth.js')?auth:backend);return;}
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(root, '.'+p);if (!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try {res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));} catch {res.writeHead(404).end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port, browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true});
  try {
    let account = 0; async function context() {const c=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'});await c.addInitScript(id=>window.testAccount=id,'test-admin-'+(++account));await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());return c;}
    const first=await context(), page=await first.newPage(), errors=[];page.on('pageerror',e=>errors.push(e.message));
    const original=JSON.stringify({schema:1,courses:[{id:'test-skills',short_name:'Skills',full_name:'Test Skills'}]});
    await first.addInitScript(value=>localStorage.setItem('aiwise_workspace_courses_v1',value),original);
    await page.goto(origin+'/workspace/#courses/test-skills/edit');
    await page.waitForFunction(()=>document.getElementById('course-save') && !document.getElementById('course-save').disabled);
    assert.equal(await page.locator('#course-bachelor').inputValue(),'');
    await page.locator('#course-save').click();await page.waitForFunction(()=>document.getElementById('course-bachelor').getAttribute('aria-invalid')==='true');
    await page.locator('#course-bachelor').selectOption('psychology');
    await page.locator('#course-id').fill('DPAS_skills');await page.locator('#course-save').click();
    assert.match(await page.locator('#course-message').innerText(),/lowercase letters/);
    assert.equal(await page.locator('#course-short').inputValue(),'Skills');
    await page.locator('#course-id').fill('test-skills');mode='conflict';await page.locator('#course-save').click();
    await page.waitForFunction(()=>document.getElementById('course-message').textContent.includes('shared list changed'));
    assert.equal(await page.locator('#course-name').inputValue(),'Test Skills');assert.equal(writes,0);
    mode='';await page.locator('#course-refresh').click();await page.waitForFunction(()=>!document.getElementById('course-save').disabled);await page.locator('#course-save').click();
    await page.getByRole('heading',{name:'Course registered with team'}).waitFor();assert.equal(writes,1);
    assert.equal(await page.evaluate(()=>localStorage.getItem('aiwise_workspace_courses_v1')),original);
    assert.equal(await page.evaluate(()=>AIWiseCourses.list().filter(c=>c.slug==='test-skills'||c.id==='test-skills').length),1);
    assert.equal(await page.getByRole('link',{name:'Open Content Studio',exact:true}).getAttribute('href'),'#studio/psychology');
    await page.screenshot({path:'/tmp/aiwise-shared-course-success.png',fullPage:true});
    await page.evaluate(()=>location.hash='#studio');
    await page.locator('#studio-courses').getByRole('link',{name:'Test Skills',exact:true}).waitFor();
    // A separate browser/account has no legacy local storage and starts with the old static registry.
    const second=await context(), other=await second.newPage();
    await other.goto(origin+'/workspace/#studio');
    await other.locator('#studio-courses').getByRole('link',{name:'Test Skills',exact:true}).waitFor();
    assert.equal(await other.evaluate(()=>localStorage.getItem('aiwise_workspace_courses_v1')),null);
    await other.locator('#studio-courses').getByRole('link',{name:'Test Skills',exact:true}).click();
    await other.waitForFunction(()=>location.hash==='#studio/psychology');
    assert.ok((await other.locator('#room').innerText()).includes('Psychology'));
    await page.evaluate(()=>location.hash='#courses/psychology.test-skills/edit');
    await page.waitForFunction(()=>document.getElementById('course-save') && !document.getElementById('course-save').disabled);
    assert.equal(await page.locator('#course-name').inputValue(),'Test Skills');assert.equal(await page.locator('#course-id').inputValue(),'test-skills');assert.equal(await page.locator('#course-bachelor').isDisabled(),true);
    await page.locator('#course-name').fill('Updated test skills');await page.locator('#course-save').click();await page.getByRole('heading',{name:'Shared names saved'}).waitFor();assert.equal(writes,2);
    mode='missing';await page.evaluate(()=>location.hash='#courses/new');
    await page.waitForFunction(()=>document.getElementById('course-message')?.textContent.includes('deploy workspace-courses'));
    assert.equal(await page.locator('#course-save').isDisabled(),true);
    await page.locator('#course-name').fill('Keep this input');await page.locator('#course-refresh').click();
    await page.waitForFunction(()=>!document.getElementById('course-refresh').disabled);assert.equal(await page.locator('#course-name').inputValue(),'Keep this input');
    assert.equal(writes,2);assert.deepEqual(errors,[]);
    console.log('PASS shared courses: validation, conflict, legacy preservation, two-account Studio discovery, name editing, missing deployment');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
