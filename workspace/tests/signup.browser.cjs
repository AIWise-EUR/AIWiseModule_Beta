/* Run with Playwright installed, CHROMIUM_PATH and SUPABASE_TEST_SDK pointing
   to Chromium and the pinned supabase-js 2.117.2 UMD file. No live accounts/mail. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '../..');
const sdk = fs.readFileSync(process.env.SUPABASE_TEST_SDK, 'utf8');
const server = http.createServer((req, res) => {
  let name = new URL(req.url, 'http://localhost').pathname;
  if (name.endsWith('/')) name += 'index.html';
  const file = path.join(root, name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json'})[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
  } catch { res.writeHead(404).end(); }
});
const user = {id:'11111111-1111-4111-8111-111111111111', aud:'authenticated', role:'authenticated', email:'applicant@example.test', email_confirmed_at:new Date().toISOString(), app_metadata:{provider:'email'}, user_metadata:{}, identities:[], created_at:new Date().toISOString()};
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
const token = b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
const session = {access_token:token,refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user};
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:'+server.address().port;
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
  const failures = [];
  async function fixture(options = {}) {
    const context = await browser.newContext({viewport:options.mobile ? {width:390,height:844} : {width:1280,height:900},reducedMotion:'reduce'});
    const page = await context.newPage(), calls = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let approved = false;
    await context.route('**/*', async route => {
      const req=route.request(), url=new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({contentType:'text/javascript',body:sdk});
      if (url.hostname.endsWith('.supabase.co')) {
        calls.push({path:url.pathname,redirect:url.searchParams.get('redirect_to'),method:req.method(),body:req.postDataJSON()});
        let body={}, status=200;
        if (url.pathname.endsWith('/signup')) {
          if (options.networkError) return route.abort();
          if (options.signupError) { body=options.signupError;status=options.status||422; }
          else body=options.autoConfirm ? session : {...user,email_confirmed_at:undefined};
        } else if (url.pathname.endsWith('/token')) body=session;
        else if (url.pathname.endsWith('/user')) body=user;
        else if (url.pathname.includes('/rest/')) {
          assert.equal(req.method(),'GET','Browser must not write memberships');
          body=approved ? {user_id:user.id,active:true} : null;
        }
        return route.fulfill({status,headers:{'x-supabase-api-version':'2024-01-01','access-control-expose-headers':'X-Supabase-Api-Version'},contentType:'application/json',body:JSON.stringify(body)});
      }
      return route.abort();
    });
    await page.goto(origin+(options.profiler ? '/workspace/course-profiler/' : '/workspace/'));
    await page.waitForFunction(() => window.AIWiseAuth?.snapshot().status==='signed-out');
    await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
    await page.locator('.aw-account-trigger').click();
    return {page,context,calls,errors,approve:()=>{approved=true;}};
  }
  async function fill(page, confirm='Testing-password-8') {
    await page.locator('#aw-mode-signup').click();
    await page.locator('#aw-auth-email').fill(user.email);
    await page.locator('#aw-auth-password').fill('Testing-password-8');
    await page.locator('#aw-auth-confirm').fill(confirm);
  }
  async function run(name, fn) {
    try { await fn(); console.log('PASS '+name); }
    catch(e) { failures.push(name+': '+e.stack); console.error('FAIL '+name); }
  }
  try {
    await run('Signup, duplicate submission prevention, pending access, approval refresh and sign out',async()=>{
      const f=await fixture(); const {page}=f;
      await page.evaluate(()=>localStorage.setItem('aiwise_test_draft','keep'));
      await fill(page,'different');
      await page.locator('#aw-signin').click();
      assert.equal(f.calls.length,0);
      assert.match(await page.locator('#aw-auth-confirm').evaluate(el=>el.validationMessage),/match/);
      await page.locator('#aw-auth-confirm').fill('Testing-password-8');
      await page.locator('#aw-signin').evaluate(el=>{el.click();el.click();});
      await page.waitForFunction(()=>!document.querySelector('#aw-account-notice').hidden);
      assert.equal(f.calls.filter(c=>c.path.endsWith('/signup')).length,1);
      assert.equal(f.calls[0].body.data && Object.keys(f.calls[0].body.data).length,0);
      assert.equal(await page.locator('#aw-auth-password').inputValue(),'');
      assert.equal(await page.locator('#aw-resend-confirmation').isDisabled(),true);
      assert.equal(await page.evaluate(()=>AIWiseAuth.snapshot().status),'signed-out');
      await page.locator('#aw-auth-password').fill('Testing-password-8');
      await page.locator('#aw-signin').click();
      await page.waitForFunction(()=>AIWiseAuth.snapshot().status==='not-member');
      assert.equal(await page.locator('#aw-mode-signup').isVisible(),false);
      await page.reload();
      await page.waitForFunction(()=>AIWiseAuth.snapshot().status==='not-member');
      await page.getByRole('button',{name:'Show sidebar',exact:true}).click();
      await page.locator('.aw-account-trigger').click();
      f.approve(); await page.locator('#aw-auth-refresh').click();
      await page.waitForFunction(()=>AIWiseAuth.snapshot().status==='member');
      await page.locator('#aw-signout').click();
      await page.waitForFunction(()=>AIWiseAuth.snapshot().status==='signed-out');
      assert.equal(await page.evaluate(()=>localStorage.getItem('aiwise_test_draft')),'keep');
      assert.deepEqual(f.errors,[]); await f.context.close();
    });
    await run('Auto-confirmed signup still requires independent membership approval',async()=>{
      const f=await fixture({autoConfirm:true}); await fill(f.page); await f.page.locator('#aw-signin').click();
      await f.page.waitForFunction(()=>AIWiseAuth.snapshot().status==='not-member');
      assert.deepEqual(f.errors,[]); await f.context.close();
    });
    await run('Resend confirmation needs only email and does not grant membership',async()=>{
      const f=await fixture(); await f.page.locator('#aw-auth-email').fill(user.email);
      await f.page.locator('#aw-resend-confirmation').click();
      await f.page.waitForFunction(()=>!document.querySelector('#aw-account-notice').hidden);
      assert.equal(f.calls[0].path,'/auth/v1/resend');
      assert.equal(f.calls[0].body.type,'signup');
      assert.equal(f.calls[0].redirect,origin+'/workspace/auth-confirm.html');
      assert.equal(await f.page.evaluate(()=>AIWiseAuth.snapshot().status),'signed-out');
      assert.deepEqual(f.errors,[]); await f.context.close();
    });
    for (const [code,message,status] of [['signup_disabled','disabled',422],['email_address_not_authorized','delivery',422],['weak_password','stronger',422],['over_email_send_rate_limit','Too many',429],['user_already_exists','signing in',422]]) {
      await run('Registration error: '+code,async()=>{
        const f=await fixture({signupError:{code,msg:code},status}); await fill(f.page); await f.page.locator('#aw-signin').click();
        await f.page.waitForFunction(()=>!!document.querySelector('#aw-account-error').textContent);
        const actual = await f.page.locator('#aw-account-error').textContent();
        assert.ok(actual.includes(message), actual);
        assert.equal(await f.page.evaluate(()=>AIWiseAuth.snapshot().status),'signed-out');
        assert.equal(await f.page.locator('#aw-signin').isEnabled(),true);
        assert.deepEqual(f.errors,[]); await f.context.close();
      });
    }
    await run('Mobile signup and Course Profiler callback destination',async()=>{
      const f=await fixture({mobile:true,profiler:true}); await fill(f.page);
      const dialog=f.page.locator('#aw-account-dialog');
      const bounds=await dialog.boundingBox(); assert.ok(bounds.x>=0 && bounds.x+bounds.width<=390);
      await f.page.screenshot({path:process.env.SIGNUP_SCREENSHOT || '/tmp/aiwise-signup-mobile.png'});
      await f.page.locator('#aw-signin').click();
      await f.page.waitForFunction(()=>!document.querySelector('#aw-account-notice').hidden);
      assert.equal(f.calls.find(c=>c.path.endsWith('/signup')).redirect,origin+'/workspace/auth-confirm.html');
      assert.deepEqual(f.errors,[]); await f.context.close();
    });
    await run('Confirmation callback strips credentials, rejects error text injection and opens sign in',async()=>{
      const f=await fixture();
      await f.page.goto(origin+'/workspace/auth-confirm.html#access_token=fake-secret&refresh_token=fake-refresh&type=signup');
      assert.equal(f.page.url(),origin+'/workspace/auth-confirm.html');
      assert.equal(f.calls.length,0);
      await f.page.getByRole('link',{name:'Open Workspace sign in'}).click();
      await f.page.waitForFunction(()=>document.querySelector('#aw-account-dialog')?.open);
      await f.page.goto(origin+'/workspace/auth-confirm.html#error=access_denied&error_description=%3Cscript%3Ebad%3C/script%3E');
      assert.equal(await f.page.locator('h1').textContent(),'Confirmation link unavailable');
      assert.ok(!(await f.page.locator('body').textContent()).includes('<script>'));
      assert.deepEqual(f.errors,[]); await f.context.close();
    });
    if(failures.length) throw new Error(failures.join('\n'));
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
