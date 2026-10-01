/* Disposable database: releases cannot reach the public site without a separate admin approval. */
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
 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',version='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 for(const user of [admin,member])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,user+'@example.test']);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true),($2,'member',true)",[admin,member]);
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return db.query(sql,args);}
 async function service(sql,args=[]){await db.exec('reset role;set role service_role');return db.query(sql,args);}
 await as(admin,'select workspace_create_beta_version($1,$2,$3)',[version,'Private review title','Private summary']);
 const v=(await as(admin,'select id,number,content from workspace_beta_versions')).rows[0];v.number=Number(v.number);
 const {buildRelease,SOURCE_FILES}=await import('../functions/aiwise-release/index.ts');
 const sources=Object.fromEntries(SOURCE_FILES.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
 if(process.env.RELEASE_FIXTURE_DIR){fs.mkdirSync(process.env.RELEASE_FIXTURE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RELEASE_FIXTURE_DIR,'version.json'),JSON.stringify(v));}
 const files=buildRelease(id,v,'a'.repeat(40),'b'.repeat(40),sources);
 const store='select workspace_store_release($1,$2,$3,$4,$5,$6)';const args=[id,version,admin,'a'.repeat(40),'b'.repeat(40),files];
 for(const user of [null,member,admin])await assert.rejects(()=>as(user,store,args));
 await service(store,args);await service(store,args);
 await assert.rejects(()=>service(store,[...args.slice(0,2),member,...args.slice(3)]));
 assert.equal((await service('select workspace_release_claim() job')).rows[0].job,null);
 await assert.rejects(()=>as(admin,'select workspace_approve_release($1)',[id]));
 await db.exec('reset role;update aiwise_private.release_settings set enabled=true');
 assert.equal((await as(member,'select id from workspace_releases')).rows.length,0);
 await assert.rejects(()=>as(admin,'select files from workspace_releases'));
 for(const user of [null,member])await assert.rejects(()=>as(user,'select workspace_approve_release($1)',[id]));
 await assert.rejects(()=>as(admin,"update workspace_releases set status='queued'"));
 await as(admin,'select workspace_approve_release($1)',[id]);await as(admin,'select workspace_approve_release($1)',[id]);
 const job=(await service('select workspace_release_claim() job')).rows[0].job;assert.equal(job.id,id);assert.equal(job.attempts,1);
 assert.equal((await service('select workspace_release_claim() job')).rows[0].job,null);
 assert.equal((await service('select workspace_release_lease_valid($1,$2) ok',[id,job.lease_token])).rows[0].ok,true);
 assert.equal((await service('select workspace_release_finish($1,$2,$3,$4) ok',[id,version,'c'.repeat(40),null])).rows[0].ok,false);
 await service('select workspace_release_finish($1,$2,$3,$4)',[id,job.lease_token,null,'published_changed']);
 await assert.rejects(()=>as(admin,'select workspace_retry_release($1)',[id]));
 assert.equal((await as(admin,'select status from workspace_releases')).rows[0].status,'failed');
 if(process.env.RELEASE_FIXTURE_DIR){fs.mkdirSync(process.env.RELEASE_FIXTURE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.RELEASE_FIXTURE_DIR,'version.json'),JSON.stringify(v));for(const [name,text]of Object.entries(files))fs.writeFileSync(path.join(process.env.RELEASE_FIXTURE_DIR,name),text);}
 // Validate schedule SQL and trigger execution with isolated extension stand-ins.
 await db.exec(`reset role;create schema net;create schema cron;create schema vault;
 create table vault.decrypted_secrets(name text unique,decrypted_secret text);
 create function vault.create_secret(secret text,name text,description text) returns uuid language plpgsql as $$begin insert into vault.decrypted_secrets values(name,secret);return gen_random_uuid();end;$$;
 create table net.test_requests(url text,headers jsonb,body jsonb,timeout_milliseconds integer);
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$begin insert into net.test_requests values(url,headers,body,timeout_milliseconds);return 1;end;$$;
 create table cron.job(jobname text,schedule text,command text);
 create function cron.schedule(jobname text,schedule text,command text) returns bigint language plpgsql as $$begin insert into cron.job values(jobname,schedule,command);return 1;end;$$;`);

 const setup=fs.readFileSync(path.join(root,'supabase/ENABLE_PUBLISHED_RELEASES.sql'),'utf8').replace(/^create extension.*;$/gm,'');
 await db.exec(setup);
 assert.equal((await db.query('select count(*)::int n from net.test_requests')).rows[0].n,0,'prepared and failed releases do not wake the worker');
 const next='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await service(store,[next,...args.slice(1)]);
 await as(admin,'select workspace_approve_release($1)',[next]);await db.exec('reset role');
 const wake=(await db.query('select * from net.test_requests')).rows[0];
 assert.equal(wake.url,'https://cvcvdiohckwgpgoxibia.supabase.co/functions/v1/aiwise-release');
 assert.equal((await service('select workspace_release_check_worker($1) ok',[wake.headers['x-aiwise-worker']])).rows[0].ok,true);
 assert.equal((await service('select workspace_release_check_worker($1) ok',['e'.repeat(64)])).rows[0].ok,false);
 const nextJob=(await service('select workspace_release_claim() job')).rows[0].job;
 await service('select workspace_release_finish($1,$2,$3,$4)',[next,nextJob.lease_token,null,'connection_unavailable']);
 assert.equal((await service('select workspace_release_claim() job')).rows[0].job,null,'retry backoff');
 await db.exec("reset role;update workspace_releases set available_at=now()-interval '1 second' where status='queued';");
 const retryJob=(await service('select workspace_release_claim() job')).rows[0].job;
 await service('select workspace_release_finish($1,$2,$3,$4)',[next,retryJob.lease_token,'c'.repeat(40),null]);
 assert.equal((await as(admin,'select status from workspace_releases where id=$1',[next])).rows[0].status,'committed');
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[admin]);
 await assert.rejects(()=>as(admin,'select workspace_release_status()'));assert.equal((await as(admin,'select id from workspace_releases')).rows.length,0);

 await db.close();console.log('PASS published releases: real snapshot bundling, permissions, separate approval, idempotency, lease fencing and concurrent-release protection');
})().catch(e=>{console.error(e.message,e.stack);process.exitCode=1;});
