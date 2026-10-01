// Historical migration contract; publish_cycles.cjs tests the current full migration chain.
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
 for(const f of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<'20261001083839').sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'));

 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',paused='33333333-3333-4333-8333-333333333333';
 for(const [id,name] of [[admin,'Admin'],[member,'Reviewer'],[paused,'Paused']])await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)",[id,name+'@example.test',JSON.stringify({display_name:name})]);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true),($2,'member',true),($3,'member',false)",[admin,member,paused]);
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return db.query(sql,args);}
 const create='select workspace_create_beta_version($1,$2,$3) id',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',next='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 for(const user of [null,member,paused])await assert.rejects(()=>as(user,create,[id,'Review one','Summary']));
 await as(admin,create,[id,'Review one','Summary']);await as(admin,create,[id,'Review one','Summary']);
 assert.equal((await as(member,'select count(*)::int n from workspace_beta_versions')).rows[0].n,1);
 const snapshot=(await as(member,'select content from workspace_beta_versions where id=$1',[id])).rows[0].content;
 assert(snapshot.length>0);assert(snapshot.every(r=>r.locale==='en'),'Unapproved Dutch sources stay out');
 const first=snapshot[0];await db.exec('reset role');
 await db.query("update workspace_content_sources set slots=slots||'{\"test_change\":\"later\"}'::jsonb where course=$1 and chapter=$2 and locale=$3",[first.course,first.chapter,first.locale]);
 await as(admin,create,[next,'Review two','New summary']);
 assert.deepEqual((await as(member,'select content from workspace_beta_versions where id=$1',[id])).rows[0].content,snapshot,'Saved copy is immutable across later content changes');
 assert.notDeepEqual((await as(member,'select content from workspace_beta_versions where id=$1',[next])).rows[0].content,snapshot);
 await assert.rejects(()=>as(admin,create,[id,'Changed title','Summary']));
 for(const sql of ["update workspace_beta_versions set title='overwrite'","delete from workspace_beta_versions"]){await assert.rejects(()=>as(admin,sql));await assert.rejects(()=>as(member,sql));}
 await assert.rejects(()=>as(null,'select * from workspace_beta_versions'));
 assert.equal((await as(paused,'select count(*)::int n from workspace_beta_versions')).rows[0].n,0);
 const people=(await as(member,'select workspace_beta_people() people')).rows[0].people;
 assert.equal(people.length,2);assert.deepEqual(Object.keys(people[0]).sort(),['id','name']);
 await assert.rejects(()=>as(paused,'select workspace_beta_people()'));await assert.rejects(()=>as(null,'select workspace_beta_people()'));
 const anchor={kind:'comment',path:'body>main:nth-of-type(1)',fingerprint:'a'.repeat(64),excerpt:'Read this'};
 const memo='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await as(member,'insert into workspace_beta_memos(id,page,version_id,anchor,body,mentions) values($1,$2,$3,$4,$5,$6)',[memo,'common/aiwise-c1-final.html?course=aws1',id,anchor,'@Admin please review',[admin,admin]]);
 const record=(await as(admin,'select * from workspace_beta_memos where version_id=$1',[id])).rows[0];assert.deepEqual(record.mentions,[admin]);
 assert.equal((await as(member,'select count(*)::int n from workspace_beta_memos where version_id=$1',[next])).rows[0].n,0);
 await assert.rejects(()=>as(member,'update workspace_beta_memos set version_id=$1 where id=$2',[next,memo]));
 await assert.rejects(()=>as(member,'insert into workspace_beta_replies(id,memo_id,body,mentions) values(gen_random_uuid(),$1,$2,$3)',[memo,'@Paused',[paused]]));
 await as(admin,'insert into workspace_beta_replies(id,memo_id,body,mentions) values(gen_random_uuid(),$1,$2,$3)',[memo,'@Reviewer reply',[member]]);
 assert.equal((await as(member,'select count(*)::int n from workspace_beta_replies where mentions @> array[$1]::uuid[]',[member])).rows[0].n,1);
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[member]);
 assert.equal((await as(member,'select count(*)::int n from workspace_beta_versions')).rows[0].n,0);
 assert.equal((await as(member,'select count(*)::int n from workspace_beta_memos')).rows[0].n,0);
 console.log('PASS review versions: admin-only creation, immutable copies, retry identity, EN/NL boundaries, private reads, versioned threads, teammate name privacy, mention validation and revocation.');
 await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
