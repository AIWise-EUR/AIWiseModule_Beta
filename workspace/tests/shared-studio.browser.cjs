/* Real Supabase SDK + two browser accounts + PostgreSQL RPC/RLS fixture. No live service writes. */
const {chromium}=require('playwright'),{PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../..'),sdk=fs.readFileSync(process.env.SUPABASE_TEST_SDK,'utf8');
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://local').pathname;if(p.endsWith('/'))p+='index.html';const f=path.join(root,p);if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
(async()=>{
 const db=new PGlite();let queue=Promise.resolve();
 function query(user,sql,args=[]){const result=queue.then(async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return db.query(sql,args);});queue=result.catch(()=>{});return result;}
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
 for(const file of ['202609270001_workspace_members.sql','202609280001_shared_studio.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
 const member='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222';
 await db.query("insert into auth.users values ($1,'{\"display_name\":\"Author\"}'),($2,'{\"display_name\":\"Administrator\"}')",[member,admin]);await db.query("insert into workspace_members(user_id,role) values($1,'member'),($2,'admin')",[member,admin]);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});const errors=[];let failSubmit=false,failBeta=false;
 try{
 async function fixture(id){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const user={id,aud:'authenticated',role:'authenticated',email:id+'@example.test',user_metadata:{display_name:id===member?'Author':'Administrator'},app_metadata:{provider:'email'},identities:[],created_at:new Date().toISOString()};
  const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const token=b64({alg:'HS256',typ:'JWT'})+'.'+b64({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})+'.test';
  const session={access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  if(id)await context.addInitScript(s=>{if(!localStorage.getItem('test-seeded')){localStorage.setItem('aiwise_workspace_supabase_auth_v1',JSON.stringify(s));localStorage.setItem('test-seeded','1');}},session);
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());if(url.origin===origin)return route.continue();
   if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({contentType:'text/javascript',body:sdk});
   if(!url.hostname.endsWith('.supabase.co'))return route.abort();
   if(url.pathname==='/auth/v1/user')return route.fulfill({json:user});
   if(url.pathname==='/auth/v1/logout')return route.fulfill({json:{}});
   const uid=req.headers().authorization?' '+id:'';const actor=uid.trim()||null;
   try{
    let data;const body=req.postDataJSON()||{};
    if(url.pathname.endsWith('/workspace_members'))data=(await query(actor,'select user_id,active from workspace_members where user_id=$1',[id])).rows[0]||null;
    else if(url.pathname.endsWith('/workspace_beta_content')){if(failBeta)throw Error('Simulated Beta failure');data=(await query(null,'select * from workspace_beta_content where course=$1',[url.searchParams.get('course').slice(3)])).rows;}
    else if(url.pathname.endsWith('/workspace_submissions'))data=(await query(actor,'select * from workspace_submissions order by submitted_at desc')).rows;
    else if(url.pathname.endsWith('/workspace_role'))data=(await query(actor,'select workspace_role() as result')).rows[0].result;
    else if(url.pathname.endsWith('/workspace_submit_content')){if(failSubmit)throw Error('Network unavailable');data=(await query(actor,'select workspace_submit_content($1,$2,$3,$4,$5,$6,$7,$8) as result',[body.p_client_id,body.p_course,body.p_chapter,body.p_slots,body.p_base_slots,body.p_base_release,body.p_saved_at,body.p_summary])).rows[0].result;}
    else if(url.pathname.endsWith('/workspace_decide_content'))data=(await query(actor,'select workspace_decide_content($1,$2,$3,$4) as result',[body.p_id,body.p_revision,body.p_status,body.p_reason])).rows[0].result;
    else throw Error('Unexpected API '+url.pathname);
    return route.fulfill({json:data});
   }catch(e){return route.fulfill({status:400,json:{code:e.code||'TEST_FAILURE',message:e.message}});}
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return {context,page};
 }
 const author=await fixture(member),reviewer=await fixture(admin),guest=await fixture(null);const page=author.page;
 const ready=()=>page.waitForFunction(()=>document.querySelector('#cs-example')?.disabled===false);
 async function save(title){await page.frameLocator('iframe').locator('#cs-item-0').click();await page.locator('.cs-fields [name="title"]').fill(title);await page.locator('.cs-editor [data-cs-save]').click();await page.locator('[data-cs-close]').first().click();}
 async function send(summary){await page.locator('.cs-actions [data-cs-submit]').click();await page.locator('[data-cs-submit-summary]').fill(summary);await page.locator('.cs-submit-form [type=submit]').click();}
 await page.goto(origin+'/workspace/#studio/ped/c2');await ready();await page.waitForFunction(()=>AIWiseAuth.snapshot().status==='member');
 assert.equal(await page.locator('[data-cs-edit],[data-cs-jump]').count(),0);
 await save('Shared preview <img src=x onerror=alert(1)>');failSubmit=true;await send('First change');
 await page.locator('[data-cs-submit-error]').filter({hasText:'Network unavailable'}).waitFor();assert.ok(await page.evaluate(()=>localStorage.getItem('aiwise_content_studio_ped_c2_v1')));failSubmit=false;
 await page.locator('.cs-submit-form [type=submit]').click();await page.waitForURL(/#tower\/request\//);await page.locator('.ct-submitted-content').waitFor();
 const requestURL=page.url();assert.equal(await page.locator('[value=approved]').count(),0,'member cannot review');assert.match(await page.locator('.ct-detail-grid').textContent(),/Awaiting administrator/);
 await reviewer.page.goto(requestURL);await reviewer.page.locator('[value=approved]').waitFor();
 await reviewer.page.locator('.ct-snapshot-item summary').first().click();assert.equal(await reviewer.page.locator('.ct-submitted-content img').count(),0);
 await reviewer.page.locator('#ct-decisionReason').fill('Checked and approved');await reviewer.page.locator('[value=approved]').click();await reviewer.page.getByText('Applied to Beta',{exact:true}).waitFor();await reviewer.page.waitForTimeout(450);await reviewer.page.screenshot({path:'/tmp/aiwise-shared-approved.png'});
 await guest.page.goto(origin+'/common/aiwise-c2-final.html?course=ped');await guest.page.waitForFunction(()=>window.AIWISE_COURSE?.c2?.examples?.[0]?.title?.startsWith('Shared preview'));
 assert.equal(await guest.page.locator('[data-slot="c2.examples"] img').count(),0);
 // A fresh Studio account reads the newly approved baseline, while the old local draft is preserved and blocked.
 await page.goto(origin+'/workspace/#studio/ped/c2');await ready();assert.match(await page.locator('.cs-toolbar .cs-status').count()?await page.locator('.cs-toolbar .cs-status').textContent():await page.locator('.cs-status').first().textContent(),/source has changed/);
 await reviewer.page.goto(origin+'/workspace/#studio/ped/c2');await reviewer.page.waitForFunction(()=>document.querySelector('#cs-example')?.disabled===false);
 assert.match(await reviewer.page.frameLocator('iframe').locator('#cs-item-0').textContent(),/Shared preview/);
 await reviewer.page.goto(requestURL);await reviewer.page.locator('.ct-submitted-content').waitFor();await reviewer.page.evaluate(()=>AIWiseAuth.signOut());await reviewer.page.locator('.ct-submitted-content').waitFor({state:'detached'});
 failBeta=true;await guest.page.reload();await guest.page.locator('#aiwise-beta-error').waitFor();failBeta=false;
 assert.deepEqual(errors,[]);console.log('PASS browser + SDK + PostgreSQL: author submit, failure retry, second-account admin review, public Beta content, immutable safe text, fresh baseline, stale draft and sign-out clearing');
 }finally{await browser.close();await db.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
