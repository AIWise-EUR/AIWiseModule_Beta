/* Disposable database: personal reading state and stable feedback addresses. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..');for(const f of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'));

 const member='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 for(const id of [member,other]){await db.query('insert into auth.users(id) values($1)',[id]);await db.query("insert into workspace_members(user_id,role,active) values($1,'member',true)",[id]);}
 async function as(id,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));return (await db.query(sql,args)).rows;}
 const seen='a'.repeat(64);
 await as(member,'insert into workspace_review_seen(token) values($1)',[seen]);
 assert.equal((await as(member,'select * from workspace_review_seen')).length,1);
 assert.equal((await as(other,'select * from workspace_review_seen')).length,0);
 await as(other,'insert into workspace_review_seen(token) values($1)',[seen]);
 await assert.rejects(()=>as(member,'insert into workspace_review_seen(user_id,token) values($1,$2)',[other,'b'.repeat(64)]));
 await assert.rejects(()=>as(member,"update workspace_review_seen set token=$1",['c'.repeat(64)]));
 await assert.rejects(()=>as(null,'select * from workspace_review_seen'));
 await as(member,'insert into workspace_review_seen(token) values($1)',['d'.repeat(64)]);
 assert.equal((await as(member,'select * from workspace_review_seen')).length,2,'a changed revision has its own read receipt');

 const memo='33333333-3333-4333-8333-333333333333',anchor=JSON.stringify({kind:'comment',path:'body>main:nth-of-type(1)>h2:nth-of-type(1)',fingerprint:'f'.repeat(64),excerpt:'Title'});
 await as(member,`insert into workspace_beta_memos(id,page,anchor,body,content_course,content_chapter,content_locale,item_key) values($1,'common/aiwise-c1-final.html?course=aws1',$2,'Clarify title','common','c1','nl','c1.block-0')`,[memo,anchor]);
 assert.equal((await as(other,'select item_key from workspace_beta_memos where id=$1',[memo]))[0].item_key,'c1.block-0');
 await assert.rejects(()=>as(member,`insert into workspace_beta_memos(page,anchor,body,content_course,content_chapter,content_locale,item_key) values('common/aiwise-c1-final.html?course=aws1',$1,'Invalid address','common','c1','en','c2.wrong')`,[anchor]));
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[member]);
 assert.equal((await as(member,'select * from workspace_review_seen')).length,0);
 await assert.rejects(()=>as(member,'insert into workspace_review_seen(token) values($1)',['e'.repeat(64)]));
 await db.close();console.log('PASS personal receipts: separate accounts, immutable receipts, new revisions, revoked access, anonymous denial');
})().catch(e=>{console.error(e);process.exitCode=1});
