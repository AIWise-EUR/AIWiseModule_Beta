/* Run only against a disposable PostgreSQL fixture; never writes to Supabase. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const dir=path.join(__dirname,'../migrations');for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(dir,file),'utf8'));
 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',paused='44444444-4444-4444-8444-444444444444';
 for(const [id,name,role,active] of [[admin,'Admin','admin',true],[member,'Reviewer','member',true],[other,'Other','member',true],[paused,'Paused','member',false]]){await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id,name+'@example.test',{display_name:name,role:'admin'}]);await db.query('insert into workspace_members(user_id,role,active) values($1,$2,$3)',[id,role,active]);}
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return (await db.query(sql,args)).rows;}
 const send='select workspace_send_page_feedback($1,$2,$3,$4,$5)',fid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',args=[fid,'workspace/#beta','Beta','bug','The course list is clipped.'];
 await as(member,send,args);await as(member,send,args);assert.equal((await as(admin,'select * from workspace_page_feedback')).length,1);assert.equal((await as(other,'select * from workspace_page_feedback')).length,0);
 assert.equal((await as(member,'select * from workspace_page_feedback'))[0].author_id,member);
 for(const actor of [null,paused])await assert.rejects(()=>as(actor,send,[crypto.randomUUID(),...args.slice(1)]));
 await assert.rejects(()=>as(other,send,args));await assert.rejects(()=>as(member,send,[fid,...args.slice(1,4),'Changed text']));
 await assert.rejects(()=>as(member,send,[crypto.randomUUID(),'https://evil.example','Bad','bug','text']));
 await assert.rejects(()=>as(member,"update workspace_page_feedback set author_id=$1",[other]));await assert.rejects(()=>as(admin,'delete from workspace_page_feedback'));
 const update='select workspace_update_page_feedback($1,$2,$3,$4)';await assert.rejects(()=>as(member,update,[fid,1,'done','Not allowed']));await as(admin,update,[fid,1,'reviewing','Thanks, checking this.']);await assert.rejects(()=>as(admin,update,[fid,1,'done','Stale overwrite']));assert.equal((await as(member,'select * from workspace_page_feedback'))[0].response,'Thanks, checking this.');
 const v1='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',v2='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 // Minimal immutable versions exercise translation fallback, new/removed keys and exact JSON equality.
 await db.exec('reset role');const content1=[{course:'common',chapter:'c1',locale:'en',slots:{a:{text:'Old'},b:'Same',removed:'Remove me'}},{course:'ped',chapter:'c2',locale:'en',slots:{'c2.examples':['First']}}];
 const content2=[{course:'common',chapter:'c1',locale:'en',slots:{a:{text:'New'},b:'Same',added:'Added'}},{course:'common',chapter:'c1',locale:'nl',slots:{a:{text:'Nieuw'},b:'Zelfde',added:'Toegevoegd'}},{course:'ped',chapter:'c2',locale:'en',slots:{'c2.examples':['First']}}];
 for(const [id,title,content] of [[v1,'First',content1],[v2,'Second',content2]])await db.query('insert into workspace_beta_versions(id,title,author_id,author_name,content) values($1,$2,$3,$4,$5)',[id,title,admin,'Admin',JSON.stringify(content)]);
 const context=async(actor,id)=>(await as(actor,'select workspace_beta_review_context($1) value',[id]))[0].value;
 assert((await context(member,v1)).changes.every(c=>c.kind==='initial'));
 const data=await context(member,v2);assert.equal(data.previous_number,1);assert(!data.changes.some(c=>c.locale==='en'&&c.key==='b'));assert(data.changes.some(c=>c.kind==='removed'&&c.key==='removed'));assert(data.changes.some(c=>c.kind==='added'&&c.key==='added'));assert.equal(data.changes.find(c=>c.locale==='nl'&&c.key==='a').before.text,'Old');
 const mark='select workspace_check_beta_item($1,$2,$3,$4,$5,$6,$7)',check=[v2,'common','c1','en','a',true,null];
 await as(member,mark,check);const saved=(await context(other,v2)).checks[0];assert.equal(saved.reviewer_id,member);await assert.rejects(()=>as(other,mark,check));await as(other,mark,[...check.slice(0,5),false,saved.updated_at]);assert.equal((await context(member,v2)).checks[0].reviewed,false);
 await assert.rejects(()=>as(member,mark,[v2,'common','c1','en','b',true,null]));await assert.rejects(()=>as(member,mark,[null,'common','c1','en','a',true,null]));await assert.rejects(()=>as(member,'delete from workspace_beta_checks'));
 for(const actor of [null,paused]){await assert.rejects(()=>context(actor,v2));await assert.rejects(()=>as(actor,mark,check));}
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[member]);assert.equal((await as(member,'select * from workspace_page_feedback')).length,0);assert.equal((await as(member,'select * from workspace_beta_checks')).length,0);await assert.rejects(()=>context(member,v2));
 // Local equivalent of relevant advisors: every new table has RLS; public functions are invoker; private functions have fixed search paths and no PUBLIC execution.
 await db.exec('reset role');const tables=await db.query("select relname,relrowsecurity from pg_class where relname in ('workspace_page_feedback','workspace_beta_checks')");assert(tables.rows.every(r=>r.relrowsecurity));
 const funcs=await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('send_page_feedback','workspace_send_page_feedback','update_page_feedback','workspace_update_page_feedback','beta_review_context','workspace_beta_review_context','check_beta_item','workspace_check_beta_item')");assert.equal(funcs.rows.length,8);for(const f of funcs.rows){assert(!f.anon);if(f.nspname==='public')assert(!f.prosecdef);else assert(f.proconfig.some(c=>c.startsWith('search_path=')));}
 console.log('PASS page feedback and Beta review: private inbox, derived identity, reply permissions, retry safety, exact version/language diff, shared checks, concurrency, revocation and schema security.');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
