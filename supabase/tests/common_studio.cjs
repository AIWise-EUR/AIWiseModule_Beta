/* Run with PGLITE_MODULE pointing to @electric-sql/pglite. No live users/data. */
const {PGlite}=require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202609270001_workspace_members.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202609280001_shared_studio.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20260928132359_common_studio_content.sql'),'utf8'));
 const member='11111111-1111-4111-8111-111111111111',admin='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
 await db.query("insert into auth.users values ($1,'{\"display_name\":\"Author\"}'),($2,'{\"display_name\":\"Admin\"}'),($3,'{\"role\":\"admin\"}')",[member,admin,outsider]);
 await db.query("insert into public.workspace_members(user_id,role) values ($1,'member'),($2,'admin')",[member,admin]);
 async function as(user,sql,params=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return db.query(sql,params);}
 async function denied(user,sql,params=[]){await assert.rejects(()=>as(user,sql,params));}
 await db.exec('reset role');const base=(await db.query("select slots from workspace_content_sources where course='common' and chapter='c1'")).rows[0].slots;
 const slots=structuredClone(base);slots['c1.block-0']['Heading 1']='Shared author content';
 const submit='select public.workspace_submit_content($1,$2,$3,$4,$5,$6,$7,$8) as id';
 const args=['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','common','c1',slots,base,null,'2026-09-28T00:00:00Z','Change the first example'];
 await denied(null,submit,args);await denied(outsider,submit,args);
 await denied(member,"update workspace_members set role='admin' where user_id=$1",[member]);
 await denied(member,"insert into workspace_beta_content(course,chapter,submission_id,slots) values ('common','c1',gen_random_uuid(),'{}')");
 const id=(await as(member,submit,args)).rows[0].id;
 assert.equal((await as(member,submit,args)).rows[0].id,id,'retry deduplicates');
 assert.equal((await as(admin,'select count(*)::int as n from workspace_submissions')).rows[0].n,1,'second account sees request');
 assert.equal((await as(outsider,'select count(*)::int as n from workspace_submissions')).rows[0].n,0,'nonmember cannot read');
 await denied(null,'select * from workspace_submissions');
 await denied(member,"update workspace_submissions set slots='{}' where id=$1",[id]);
 await denied(admin,"update workspace_submissions set status='approved' where id=$1",[id]);
 const decide='select public.workspace_decide_content($1,$2,$3,$4)';
 await denied(member,decide,[id,1,'approved','Cannot self-promote']);
 await denied(admin,decide,[id,1,null,'invalid']);
 assert.equal((await as(null,'select count(*)::int as n from workspace_beta_content')).rows[0].n,0);
 // Two pending submissions from the same baseline; only the first can be applied.
 const id2=(await as(member,submit,['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',...args.slice(1)])).rows[0].id;
 await as(admin,decide,[id,1,'approved','Reviewed']);
 const beta=(await as(null,'select * from workspace_beta_content')).rows[0];
 assert.deepEqual(beta.slots,slots);assert.equal(beta.submission_id,id);
 await denied(admin,decide,[id,1,'rejected','stale']);
 await denied(admin,decide,[id2,1,'approved','would overwrite']);
 assert.equal((await as(admin,'select status from workspace_submissions where id=$1',[id2])).rows[0].status,'pending','failed approval rolled back');
 await as(admin,decide,[id2,1,'revision','Rebase on current Beta']);
 await denied(member,submit,['cccccccc-cccc-4ccc-8ccc-cccccccccccc',...args.slice(1)]);
 const changed=structuredClone(slots);changed['c1.block-0']['Heading 1']='Second release';
 const nextArgs=['dddddddd-dddd-4ddd-8ddd-dddddddddddd','common','c1',changed,slots,id,'2026-09-28T01:00:00Z','Follow-up'];
 const next=(await as(member,submit,nextArgs)).rows[0].id;
 await as(admin,decide,[next,1,'approved','Reviewed again']);
 assert.equal((await as(null,'select submission_id from workspace_beta_content')).rows[0].submission_id,next);
 assert.deepEqual((await as(admin,'select slots from workspace_submissions where id=$1',[id])).rows[0].slots,slots,'old snapshot preserved');
 // Each additional common chapter independently submits and activates without changing C1 or course releases.
 for (const [i, chapter] of ['c2','c3'].entries()) {
  await db.exec('reset role');
  const baseline=(await db.query("select slots from workspace_content_sources where course='common' and chapter=$1",[chapter])).rows[0].slots;
  const edited=structuredClone(baseline);edited[chapter+'.block-0']['Heading 1']='Approved '+chapter;
  const released=(await as(member,submit,[`99999999-9999-4999-8999-99999999999${i}`,'common',chapter,edited,baseline,null,'2026-09-28T02:00:00Z','Common chapter update'])).rows[0].id;
  await as(admin,decide,[released,1,'approved','Reviewed common chapter']);
  const row=(await as(null,"select * from workspace_beta_content where course='common' and chapter=$1",[chapter])).rows[0];
  assert.deepEqual(row.slots,edited);assert.equal(row.submission_id,released);
 }
 assert.equal((await as(null,"select submission_id from workspace_beta_content where course='common' and chapter='c1'")).rows[0].submission_id,next);
 assert.equal((await as(null,"select count(*)::int as n from workspace_beta_content where course <> 'common'")).rows[0].n,0,'common approvals never write course releases');
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[admin]);
 await denied(admin,decide,[id2,1,'approved','revoked']);
 assert.equal((await as(admin,'select count(*)::int as n from workspace_submissions')).rows[0].n,0);
 // Validate every seeded chapter and reject unexpected structure, including SQL null.
 await db.exec('reset role');const sources=(await db.query('select * from workspace_content_sources')).rows;
 for(const source of sources){const ok=await db.query('select workspace_valid_content($1,$2) as ok',[source.slots,source.slots]);assert.equal(ok.rows[0].ok,true);}
 const malformed={...changed, 'c1.unrecognized':'oops'};
 await denied(member,submit,['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','common','c1',malformed,changed,next,'2026-09-28','Bad shape']);
 assert.equal(sources.length,7,'four course and three common baselines coexist');
 const {parseHTML}=require(process.env.LINKEDOM_MODULE || 'linkedom');
 const vm=require('node:vm'),ctx={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),ctx);
 for(const chapter of ['c1','c2','c3']) {
  const document=parseHTML(fs.readFileSync(path.join(root,'common/aiwise-'+chapter+'-final.html'),'utf8')).document;
  const expected=Object.fromEntries(ctx.window.AIWiseCommonContent.catalog(document,chapter).map(b=>[b.path,b.fields]));
  const actual=sources.find(r=>r.course==='common'&&r.chapter===chapter).slots;
  assert.deepEqual(JSON.parse(JSON.stringify(expected)),actual,'seed matches exact module text');
 }
 console.log('PASS common content: real PostgreSQL: two-account sharing, anon/nonmember protection, spoofed role, denied direct writes, immutable snapshots, idempotency, atomic approval, stale release, revocation and all seeded schemas');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
