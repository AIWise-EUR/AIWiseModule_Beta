/* Disposable Postgres fixture. Never changes live accounts, roles or content. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const f of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'));

 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',paused='33333333-3333-4333-8333-333333333333';
 for(const [id,name] of [[admin,'Admin'],[member,'Reviewer'],[paused,'Paused']])await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,name+'@example.test',JSON.stringify({display_name:name})]);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true),($2,'member',true),($3,'member',false)",[admin,member,paused]);
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return db.query(sql,args);}

 const submission='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const baseline=(await as(admin,"select slots from workspace_content_sources where course='common' and chapter='c1' and locale='en'")).rows[0].slots;
 const changed=structuredClone(baseline);changed['c1.block-0']['Heading 1']='Approved title';
 await as(admin,'select workspace_submit_localized_content($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[submission,'common','c1',changed,baseline,null,new Date().toISOString(),'Review this','en',null]);
 const id=(await as(admin,'select id from workspace_submissions where client_id=$1',[submission])).rows[0].id;
 await as(admin,"select workspace_decide_content($1,1,'approved','Approved')",[id]);
 const selectJobs='select sequence,submission_id,status,attempts,commit_sha from workspace_github_jobs';
 assert.equal((await as(admin,selectJobs)).rows.length,1,'approval atomically creates one queued commit');
 assert.equal((await as(member,selectJobs)).rows.length,0);
 await assert.rejects(()=>as(null,selectJobs));
 for(const user of [admin,member,paused]){
  await assert.rejects(()=>as(user,'select payload,lease_token from workspace_github_jobs'));
  await assert.rejects(()=>as(user,'select workspace_github_claim()'));
  await assert.rejects(()=>as(user,"select workspace_github_check_worker('x')"));
  await assert.rejects(()=>as(user,"update workspace_github_jobs set status='committed'"));
 }
 assert.equal((await as(admin,'select workspace_github_status() enabled')).rows[0].enabled,false,'setup is disabled until explicit activation');
 await assert.rejects(()=>as(member,'select workspace_github_status()'));
 await db.exec('reset role');
 await db.exec("update aiwise_private.github_settings set enabled=true,worker_secret_hash=sha256(convert_to(repeat('f',64),'UTF8'));set role service_role;");
 assert.equal((await db.query("select workspace_github_check_worker(repeat('f',64)) ok")).rows[0].ok,true);
 assert.equal((await db.query("select workspace_github_check_worker(repeat('e',64)) ok")).rows[0].ok,false);
 let job=(await db.query('select workspace_github_claim() job')).rows[0].job;
 assert.equal(job.payload.slots['c1.block-0']['Heading 1'],'Approved title');
 assert.equal(job.payload.author_name,undefined,'private metadata never enters immutable payload');
 assert.equal((await db.query('select workspace_github_claim() job')).rows[0].job,null,'one active worker globally');
 assert.equal((await db.query('select workspace_github_finish($1,$2,$3,$4,false) ok',[job.sequence,member,'a'.repeat(40),null])).rows[0].ok,false,'wrong lease cannot acknowledge');
 assert.equal((await db.query('select workspace_github_lease_valid($1,$2) ok',[job.sequence,job.lease_token])).rows[0].ok,true);
 await db.query('select workspace_github_finish($1,$2,null,$3,false)',[job.sequence,job.lease_token,'connection_unavailable']);
 assert.equal((await db.query('select workspace_github_claim() job')).rows[0].job,null,'backoff is observed');
 await db.exec("update workspace_github_jobs set available_at=now()-interval '1 second';");
 job=(await db.query('select workspace_github_claim() job')).rows[0].job;
 await db.exec("update workspace_github_jobs set lease_until=now()-interval '1 second';");
 const next=(await db.query('select workspace_github_claim() job')).rows[0].job;
 assert.notEqual(next.lease_token,job.lease_token,'interrupted work gets a new lease');
 assert.equal((await db.query('select workspace_github_finish($1,$2,$3,null,false) ok',[job.sequence,job.lease_token,'a'.repeat(40)])).rows[0].ok,false,'stale worker fenced out');
 await db.exec('update workspace_github_jobs set attempts=8;');
 await db.query('select workspace_github_finish($1,$2,null,$3,false)',[next.sequence,next.lease_token,'github_conflict']);
 assert.equal((await as(admin,selectJobs)).rows[0].status,'failed');
 await assert.rejects(()=>as(member,'select workspace_retry_github($1)',[id]));
 await as(admin,'select workspace_retry_github($1)',[id]);
 await db.exec('reset role;set role service_role;');
 job=(await db.query('select workspace_github_claim() job')).rows[0].job;
 await db.query('select workspace_github_finish($1,$2,$3,null,false)',[job.sequence,job.lease_token,'a'.repeat(40)]);
 assert.equal((await as(admin,selectJobs)).rows[0].status,'committed');
 await assert.rejects(()=>as(admin,'select workspace_retry_github($1)',[id]),'successful commits cannot be replayed');
 await db.exec('reset role');
 await db.query('update workspace_members set active=false where user_id=$1',[admin]);
 assert.equal((await as(admin,selectJobs)).rows.length,0,'revocation takes immediate effect');

 // Validate schedule SQL and trigger execution with isolated extension stand-ins.
 await db.exec(`reset role;create schema net;create schema cron;create schema vault;
 create table vault.decrypted_secrets(name text unique,decrypted_secret text);
 create function vault.create_secret(secret text,name text,description text) returns uuid language plpgsql as $$begin insert into vault.decrypted_secrets values(name,secret);return gen_random_uuid();end;$$;
 create table net.test_requests(url text,headers jsonb,body jsonb,timeout_milliseconds integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.test_requests values(url,headers,body,timeout_milliseconds);return 1;end;$$;
 create table cron.job(jobname text,schedule text,command text);
 create function cron.schedule(jobname text,schedule text,command text) returns bigint language plpgsql as $$begin insert into cron.job values(jobname,schedule,command);return 1;end;$$;`);
 const setup=fs.readFileSync(path.join(root,'supabase/ENABLE_GITHUB_PUBLISHING.sql'),'utf8').replace(/^create extension.*;$/gm,'');
 await db.exec(setup);
 assert.equal((await db.query('select count(*)::int n from cron.job')).rows[0].n,1);
 const wake=(await db.query('select * from net.test_requests')).rows[0];
 assert.equal(wake.url,'https://cvcvdiohckwgpgoxibia.supabase.co/functions/v1/github-publish');
 assert.equal(wake.headers['x-aiwise-worker'].length,64);
 assert.equal((await db.query('select workspace_github_check_worker($1) ok',[wake.headers['x-aiwise-worker']])).rows[0].ok,true);
 await db.exec("update workspace_github_jobs set deployment_status='success';delete from net.test_requests;select aiwise_private.kick_github_worker();");
 assert.equal((await db.query('select count(*)::int n from net.test_requests')).rows[0].n,0,'idle schedules do not invoke functions');
 const second=(await db.query(`insert into workspace_submissions(client_id,course,chapter,locale,author_id,author_name,summary,slots,base_slots,saved_at,status)
 select gen_random_uuid(),course,chapter,locale,author_id,author_name,summary,slots,base_slots,saved_at,'approved' from workspace_submissions where id=$1 returning id`,[id])).rows[0].id;
 await db.query('update workspace_beta_content set submission_id=$1 where submission_id=$2',[second,id]);
 assert.equal((await db.query('select count(*)::int n from net.test_requests')).rows[0].n,1,'new approval wakes the worker through the actual statement trigger');

 console.log('PASS GitHub queue: real approval trigger, public-data payload, admin visibility, worker-only leases, fencing, idempotency, retry/backoff and revocation.');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
