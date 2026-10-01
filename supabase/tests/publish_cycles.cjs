/* Disposable database: approvals accumulate; only Publish allocates a dated immutable version. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..');for(const f of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'));
 const approval=(await db.query("select pg_get_functiondef('aiwise_private.approve_release(uuid)'::regprocedure) definition")).rows[0].definition;assert.match(approval,/delete from aiwise_private\.beta_draft_checks where updated_at <= stamp/i,'publication cleanup must include a cutoff predicate for safe-update protection');assert.doesNotMatch(approval,/delete from aiwise_private\.beta_draft_checks\s*;/i);
 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',legacy=crypto.randomUUID();
 for(const u of [admin,member])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,u+'@example.test']);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true),($2,'member',true)",[admin,member]);
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return (await db.query(sql,args)).rows;}
 async function service(sql,args=[]){await db.exec('reset role;set role service_role');return (await db.query(sql,args)).rows;}
 const context=async()=>(await as(member,'select workspace_beta_review_context(null) c'))[0].c;
 await assert.rejects(()=>as(admin,'select workspace_create_beta_version($1,$2,$3)',[legacy,'Not allowed','']));
 const noBaseline=await context();assert.equal(noBaseline.previous_id,null);assert(noBaseline.changes.every(c=>c.kind==='initial'));
 await db.exec('reset role');await db.query("insert into workspace_beta_versions(id,title,author_id,author_name,content) select $1,'Legacy snapshot',$2,'Admin',aiwise_private.approved_beta_copy()",[legacy,admin]);
 let ctx=await context();assert.equal(ctx.previous_id,legacy,'unpublished snapshot is the comparison fallback');assert.equal(ctx.previous_kind,'snapshot');assert.equal(ctx.changes.length,0,'unchanged content is not sent for full review again');
 const seeds=noBaseline.changes.filter(r=>typeof r.after==='string').slice(0,2);
 await db.exec('reset role');for(const r of seeds)await db.query("update workspace_content_sources set slots=jsonb_set(slots,array[$4],to_jsonb($5::text)) where course=$1 and chapter=$2 and locale=$3",[r.course,r.chapter,r.locale,r.key,r.after+' First edit']);
 ctx=await context();assert.equal(ctx.changes.length,2);assert(ctx.changes.every(c=>c.kind==='changed'));
 const [item,unchanged]=ctx.changes;
 const mark='select workspace_check_beta_draft_item($1,$2,$3,$4,$5,$6,$7)';
 const markArgs=i=>[i.course,i.chapter,i.locale,i.key,true,null,ctx.fingerprint];
 await as(member,mark,markArgs(item));await as(member,mark,markArgs(unchanged));assert.equal((await context()).checks.length,2);
 for(const actor of [null,member,admin])await assert.rejects(()=>as(actor,'select workspace_release_candidate()'));
 await assert.rejects(()=>as(member,'select * from aiwise_private.beta_draft_checks'));
 const {buildRelease,SOURCE_FILES}=await import('../functions/aiwise-release/index.ts');const source=Object.fromEntries(SOURCE_FILES.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
 const store='select workspace_store_release_candidate($1,$2,$3,$4,$5,$6,$7)';
 async function prepare(){const c=(await service('select workspace_release_candidate() c'))[0].c,id=crypto.randomUUID(),files=buildRelease(id,{id,number:null,content:c.content},'a'.repeat(40),'b'.repeat(40),source),args=[id,admin,'a'.repeat(40),'b'.repeat(40),files,c.content,c.fingerprint];await service(store,args);await service(store,args);return {id,args};}
 assert.equal((await service('select workspace_release_candidate() c'))[0].c.fingerprint,ctx.fingerprint,'worker and review use the same fallback');
 await assert.rejects(()=>as(member,mark,[...markArgs(item).slice(0,6),noBaseline.fingerprint]),/Approved content changed/);
 for(const actor of [null,member,admin])await assert.rejects(()=>as(actor,'select aiwise_private.beta_comparison_base(null)'));
 const first=await prepare();assert.equal((await as(admin,'select count(*)::int n from workspace_beta_versions'))[0].n,1,'preparation creates no numbered version');
 for(const actor of [null,member,admin])await assert.rejects(()=>as(actor,store,first.args));
 await assert.rejects(()=>as(admin,'select files,candidate_content from workspace_releases'));
 await db.exec('reset role');await db.query("update workspace_content_sources set slots=jsonb_set(slots,array[$4],to_jsonb($5::text)) where course=$1 and chapter=$2 and locale=$3",[item.course,item.chapter,item.locale,item.key,item.after+' Approved edit']);
 let fresh=await context();assert.equal(fresh.checks.length,1,'changed content loses its check but other checked items stay reviewed');
 await assert.rejects(()=>as(member,mark,markArgs(item)),/Approved content changed/);
 await db.exec('reset role;update aiwise_private.release_settings set enabled=true');
 await assert.rejects(()=>as(admin,'select workspace_approve_release($1)',[first.id]),/Approved content changed/);
 for(const actor of [null,member])await assert.rejects(()=>as(actor,'select workspace_approve_release($1)',[first.id]));
 assert.equal((await as(admin,'select count(*)::int n from workspace_beta_versions'))[0].n,1);
 const next=await prepare();
 const memo=crypto.randomUUID();const validAnchor={kind:'comment',path:'body>section:nth-of-type(1)',fingerprint:'a'.repeat(64),excerpt:'Review this'};
 await assert.rejects(()=>as(member,'insert into workspace_beta_memos(id,page,anchor,body,version_id,draft_base_version) values($1,$2,$3,$4,null,null)',[memo,'common/aiwise-c1-final.html?course=aws1',validAnchor,'Stale baseline']),/cycle was published/);
 await as(member,'insert into workspace_beta_memos(id,page,anchor,body,version_id,draft_base_version) values($1,$2,$3,$4,null,$5)',[memo,'common/aiwise-c1-final.html?course=aws1',validAnchor,'Check this item',legacy]);
 await as(admin,'select workspace_approve_release($1)',[next.id]);await as(admin,'select workspace_approve_release($1)',[next.id]);
 const v=(await as(member,'select * from workspace_beta_versions where id=$1',[next.id]))[0];assert.equal(Number(v.number),2);assert.equal(v.title,new Date(v.created_at).toISOString().slice(0,10));assert(v.published_at);assert.deepEqual(v.content,next.args[5]);
 assert.equal((await as(member,'select version_id from workspace_beta_memos where id=$1',[memo]))[0].version_id,v.id);
 assert.equal((await as(member,'select reviewer_id from workspace_beta_checks where version_id=$1',[v.id]))[0].reviewer_id,member);
 const savedContext=(await as(member,'select workspace_beta_review_context($1) c',[v.id]))[0].c;assert.equal(savedContext.previous_id,legacy,'first published version retains its legacy comparison');assert.equal(savedContext.changes.length,2);assert.equal(savedContext.checks.length,1);
 fresh=await context();assert.equal(fresh.previous_kind,'published');assert.equal(fresh.previous_id,v.id);assert.equal(fresh.changes.length,0);assert.equal(fresh.open_memos,0);assert.equal(fresh.checks.length,0);
 await assert.rejects(()=>as(member,'insert into workspace_beta_memos(id,page,anchor,body,version_id,draft_base_version) values($1,$2,$3,$4,null,null)',[crypto.randomUUID(),'common/aiwise-c1-final.html?course=aws1',validAnchor,'Stale cycle']),/cycle was published/);
 const job=(await service('select workspace_release_claim() j'))[0].j;assert.equal(job.id,next.id);const manifest=JSON.parse(job.files['published-content.json']);assert(job.files['published-content.json'].endsWith('\n'),'published manifest must end with a real newline');assert.equal(manifest.version_number,2);assert.equal(manifest.version_id,v.id);assert.deepEqual(manifest.content,v.content);
 await service('select workspace_release_finish($1,$2,$3,$4)',[job.id,job.lease_token,'c'.repeat(40),null]);
 // A later approval belongs to a fresh cycle; the earlier content and memo remain unchanged.
 await db.exec('reset role');await db.query("update workspace_content_sources set slots=jsonb_set(slots,array[$4],to_jsonb($5::text)) where course=$1 and chapter=$2 and locale=$3",[item.course,item.chapter,item.locale,item.key,item.after+' Next cycle']);
 fresh=await context();assert(fresh.changes.some(c=>c.key===item.key));assert.deepEqual((await as(member,'select content from workspace_beta_versions where id=$1',[v.id]))[0].content,v.content);
 const last=await prepare();await as(admin,'select workspace_approve_release($1)',[last.id]);assert.equal(Number((await as(member,'select number from workspace_beta_versions where id=$1',[last.id]))[0].number),3);
 await db.exec('reset role');await db.query("insert into workspace_beta_versions(id,title,author_id,author_name,content) select $1,'Later imported snapshot',$2,'Admin',aiwise_private.approved_beta_copy()",[crypto.randomUUID(),admin]);
 assert.equal((await context()).previous_id,last.id,'published baseline takes priority over a newer un-published snapshot');
 assert.equal((await as(member,'select workspace_beta_review_context($1) c',[last.id]))[0].c.previous_id,v.id);
 assert.equal((await as(member,'select published_at from workspace_beta_versions where id=$1',[legacy]))[0].published_at,null,'fallback never fabricates publication');
 console.log('PASS publish cycles: private preparation, no premature version, stale rejection, item review invalidation, preserved checks/comments, numbered/date freeze, idempotency, next-cycle isolation and worker manifest.');await db.close();
})().catch(e=>{console.error(e.message,e.stack);process.exitCode=1;});
