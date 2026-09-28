/* Real PostgreSQL policy tests; no live database or accounts. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const db=new PGlite(),root=path.resolve(__dirname,'../..');
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const file of ['202609270001_workspace_members.sql','202609280001_shared_studio.sql','20260928151827_beta_review_feedback.sql'])await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
 const author='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333',outsider='44444444-4444-4444-8444-444444444444';
 await db.query(`insert into auth.users values($1,'{"display_name":"Author"}'),($2,'{"display_name":"Other"}'),($3,'{"display_name":"Admin"}'),($4,'{"role":"admin"}')`,[author,other,admin,outsider]);
 await db.query(`insert into workspace_members(user_id,role) values($1,'member'),($2,'member'),($3,'admin')`,[author,other,admin]);
 async function as(id,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role '+(id?'authenticated':'anon'));return db.query(sql,args);}
 const deny=async(...args)=>assert.rejects(()=>as(...args));
 const anchor={kind:'box',path:'body>main:nth-of-type(1)>p:nth-of-type(1)',fingerprint:'a'.repeat(64),excerpt:'A paragraph',x:.1,y:.1,w:.4,h:.5};
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const insert='insert into workspace_beta_memos(id,page,anchor,body) values($1,$2,$3,$4) returning *';
 const args=[id,'common/aiwise-c1-final.html?course=aws1',anchor,'Review this paragraph'];
 await deny(null,'select * from workspace_beta_memos');await deny(null,insert,args);await deny(outsider,insert,args);
 const saved=(await as(author,insert,args)).rows[0];assert.equal(saved.author_id,author);assert.equal(saved.author_name,'Author');
 assert.equal((await as(other,'select count(*)::int n from workspace_beta_memos')).rows[0].n,1);
 assert.equal((await as(outsider,'select count(*)::int n from workspace_beta_memos')).rows[0].n,0);
 await deny(author,insert,args); // UUID retry cannot create a second copy.
 await deny(author,"insert into workspace_beta_memos(id,page,anchor,body,author_id) values(gen_random_uuid(),$1,$2,'Spoof',$3)",[args[1],anchor,admin]);
 await deny(admin,"update workspace_beta_memos set body='Changed'");
 await deny(author,"update workspace_beta_memos set author_id=$1",[other]);
 await deny(admin,'delete from workspace_beta_memos');
 assert.equal((await as(other,'update workspace_beta_memos set resolved=true where id=$1 returning id',[id])).rows.length,0);
 const resolved=(await as(author,'update workspace_beta_memos set resolved=true where id=$1 returning *',[id])).rows[0];assert.equal(resolved.resolved_by,author);assert.ok(resolved.resolved_at);
 const reopened=(await as(admin,'update workspace_beta_memos set resolved=false where id=$1 returning *',[id])).rows[0];assert.equal(reopened.resolved_by,null);
 const reply='insert into workspace_beta_replies(id,memo_id,body) values($1,$2,$3) returning *';
 const rid='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 assert.equal((await as(other,reply,[rid,id,'A reply'])).rows[0].author_id,other);
 await deny(outsider,reply,['cccccccc-cccc-4ccc-8ccc-cccccccccccc',id,'No access']);
 await deny(null,'select * from workspace_beta_replies');
 await deny(other,"update workspace_beta_replies set body='edit'");
 await deny(admin,'delete from workspace_beta_replies');
 for(const bad of [{...anchor,x:-1},{...anchor,w:2},{...anchor,fingerprint:'bad'},{...anchor,path:'script'},{...anchor,kind:'highlight',quote:'text',start:9,end:1},{...anchor,kind:'highlight',quote:'text',start:null,end:4},{...anchor,x:null}])await deny(author,insert,['dddddddd-dddd-4ddd-8ddd-dddddddddddd',args[1],bad,'Bad anchor']);
 await deny(author,insert,['dddddddd-dddd-4ddd-8ddd-dddddddddddd','https://example.com/',anchor,'Invalid page']);
 for(const kind of ['comment','pin','highlight']){
  const a={...anchor,kind,...(kind==='highlight'?{quote:'text',start:0,end:4}:{})};
  assert.equal((await as(author,'select workspace_valid_beta_anchor($1) ok',[a])).rows[0].ok,true);
 }
 await db.exec('reset role');await db.query('update workspace_members set active=false where user_id=$1',[author]);
 assert.equal((await as(author,'select count(*)::int n from workspace_beta_memos')).rows[0].n,0);
 assert.equal((await as(author,'select count(*)::int n from workspace_beta_replies')).rows[0].n,0);
 await deny(author,reply,['eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',id,'Revoked']);
 assert.equal((await as(author,'update workspace_beta_memos set resolved=true returning id')).rows.length,0);
 await deny(other,'select aiwise_private.beta_feedback_stamp()');
 console.log('PASS Beta feedback: team-only access, derived authors, immutable text, reply sharing, author/admin resolution, validated anchors, retries and revocation');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
