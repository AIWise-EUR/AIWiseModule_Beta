/* Disposable database: the bachelor structure renames live scopes, keeps saved versions as they were and retires "other". */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..'),change='20261004090000_content_scopes.sql';
 const files=fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
 const run=async list=>{for(const f of list)await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',f),'utf8'));};
 await run(files.filter(f=>f<change));
 assert.equal(fs.readFileSync(path.join(root,'supabase/CONTENT_SCOPES_SETUP.sql'),'utf8'),fs.readFileSync(path.join(root,'supabase/migrations',change),'utf8'),'the script the owner runs is the tested migration');

 // Records as they exist before the change: an approval, comments, review checks and two published versions.
 const admin='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222',v1=crypto.randomUUID(),v2=crypto.randomUUID();
 for(const u of [admin,member])await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,u+'@example.test']);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true),($2,'member',true)",[admin,member]);
 async function as(user,sql,args=[]){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user||'']);await db.exec('set role '+(user?'authenticated':'anon'));return (await db.query(sql,args)).rows;}
 const owner=async(sql,args=[])=>{await db.exec('reset role');return (await db.query(sql,args)).rows;};
 const context=async(version=null)=>(await as(member,'select workspace_beta_review_context($1) c',[version]))[0].c;
 const submit='select workspace_submit_localized_content(p_client_id=>$1,p_course=>$2,p_chapter=>$3,p_slots=>$4,p_base_slots=>$5,p_base_release=>null,p_saved_at=>now(),p_summary=>$6,p_locale=>$7,p_source_release=>null) id';
 async function approve(course,title){
  const base=(await owner("select slots from workspace_content_sources where course=$1 and chapter='c2' and locale='en'",[course]))[0].slots,slots=structuredClone(base);
  slots['c2.examples'][0].title=title;
  const id=(await as(admin,submit,[crypto.randomUUID(),course,'c2',slots,base,'Updated example','en']))[0].id;
  await as(admin,"select workspace_decide_content($1,(select revision from workspace_submissions where id=$1),'approved','Checked')",[id]);
  return id;
 }
 const approved=await approve('ped','Approved before the change');
 const snapshot=async id=>owner("insert into workspace_beta_versions(id,title,author_id,author_name,content,published_at) select $1,'Published',$2,'Admin',aiwise_private.approved_beta_copy(),now()",[id,admin]);
 await snapshot(v1);
 const edit=async(course,value)=>owner("update workspace_content_sources set slots=jsonb_set(slots,'{c3.full_example_title}',to_jsonb($2::text)) where course=$1 and chapter='c3' and locale='en'",[course,value]);
 await edit('aws1','Edited before the change');
 await snapshot(v2);
 const anchor={kind:'comment',path:'body>main:nth-of-type(1)>h2:nth-of-type(1)',fingerprint:'f'.repeat(64),excerpt:'Title'};
 const memo='insert into workspace_beta_memos(id,page,anchor,body,version_id,draft_base_version,content_course,content_chapter,content_locale,item_key) values($1,$2,$3,$4,null,$5,$6,$7,$8,$9)';
 const memos={ped:crypto.randomUUID(),aws1:crypto.randomUUID(),other:crypto.randomUUID()};
 await as(member,memo,[memos.ped,'common/aiwise-c2-final.html?course=ped&lang=nl',anchor,'Dutch page',v2,null,null,null,null]);
 await as(member,memo,[memos.aws1,'common/aiwise-c2-final.html?course=aws1',anchor,'Linked to an item',v2,'aws1','c2','en','c2.examples']);
 await as(member,memo,[memos.other,'common/lobby.html?course=other',anchor,'Retired course page',v2,null,null,null,null]);
 const saved=JSON.stringify((await owner('select id,content from workspace_beta_versions order by number')));
 const job=JSON.stringify(await owner('select course,chapter,locale,payload from workspace_github_jobs where submission_id=$1',[approved]));

 await run(files.filter(f=>f>=change));

 // Scopes are public names and cannot be changed through the API.
 const scopes=await as(null,'select id,kind,name,retired from workspace_content_scopes order by id');
 assert.deepEqual(scopes.map(s=>s.id),['common','other','pedagogical-sciences','psychology']);
 assert.deepEqual(scopes.filter(s=>s.retired).map(s=>s.id),['other']);
 for(const user of [null,member,admin])await assert.rejects(()=>as(user,"insert into workspace_content_scopes(id,kind,name) values('extra','bachelor','Extra')"));
 for(const user of [member,admin])await assert.rejects(()=>as(user,"update workspace_content_scopes set retired=true where id='psychology'"));
 // The repository's registry and the database name the same bachelors.
 const registry=JSON.parse(fs.readFileSync(path.join(root,'common/courses/registry.json'),'utf8'));
 assert.deepEqual(registry.bachelors.map(b=>[b.id,b.name]).sort(),scopes.filter(s=>s.kind==='bachelor'&&!s.retired).map(s=>[s.id,s.name]).sort());
 assert.deepEqual(registry.bachelors.flatMap(b=>b.aliases.map(a=>[a,b.id])),[['aws1','psychology'],['ped','pedagogical-sciences']]);
 assert.deepEqual((await owner("select aiwise_private.content_scope_alias('aws1') a,aiwise_private.content_scope_alias('ped') p,aiwise_private.content_scope_alias('other') o,aiwise_private.content_scope_alias('psychology') s"))[0],{a:'psychology',p:'pedagogical-sciences',o:null,s:'psychology'});

 // Live records follow the rename.
 assert.deepEqual((await owner('select distinct course from workspace_content_sources order by 1')).map(r=>r.course),['common','other','pedagogical-sciences','psychology']);
 assert.deepEqual(await owner('select course,submission_id from workspace_beta_content'),[{course:'pedagogical-sciences',submission_id:approved}]);
 assert.equal((await owner('select course from workspace_submissions where id=$1',[approved]))[0].course,'pedagogical-sciences');
 const pages=Object.fromEntries((await owner('select id,page,content_course from workspace_beta_memos')).map(r=>[r.id,r]));
 assert.equal(pages[memos.ped].page,'common/aiwise-c2-final.html?course=pedagogical-sciences.inleiding&lang=nl');
 assert.equal(pages[memos.aws1].page,'common/aiwise-c2-final.html?course=psychology.aws1');assert.equal(pages[memos.aws1].content_course,'psychology');
 assert.equal(pages[memos.other].page,'common/lobby.html?course=psychology.aws1');
 // Saved versions and commit jobs keep the ids they were frozen with.
 assert.equal(JSON.stringify(await owner('select id,content from workspace_beta_versions order by number')),saved);
 assert.equal(JSON.stringify(await owner('select course,chapter,locale,payload from workspace_github_jobs where submission_id=$1',[approved])),job);

 // Two earlier versions are still compared as saved; the working copy shows no change from the rename alone.
 const earlier=await context(v2);
 assert.deepEqual(earlier.changes.map(c=>[c.course,c.key,c.kind]),[['aws1','c3.full_example_title','changed']]);
 let current=await context();
 assert.equal(current.previous_id,v2);assert.deepEqual(current.changes,[],'renamed scopes and the retired copy are not review items');
 assert.deepEqual([...new Set(current.current_content.map(r=>r.course))].sort(),['common','pedagogical-sciences','psychology']);
 await edit('psychology','Edited after the change');
 current=await context();
 assert.deepEqual(current.changes.map(c=>[c.course,c.key,c.kind,c.before]),[['psychology','c3.full_example_title','changed','Edited before the change']]);
 await as(member,'select workspace_check_beta_draft_item($1,$2,$3,$4,$5,$6,$7)',['psychology','c3','en','c3.full_example_title',true,null,current.fingerprint]);
 assert.equal((await context()).checks.length,1);

 // The retired scope takes nothing new; a bachelor works under its new id.
 const other=(await owner("select slots from workspace_content_sources where course='other' and chapter='c2' and locale='en'"))[0].slots;
 await assert.rejects(()=>as(admin,submit,[crypto.randomUUID(),'other','c2',other,other,'Retired','en']),/retired/);
 await assert.rejects(()=>as(admin,submit,[crypto.randomUUID(),'aws1','c2',other,other,'Earlier id','en']));
 const next=await approve('psychology','Approved after the change');
 assert.deepEqual((await owner('select course from workspace_beta_content where submission_id=$1',[next])).map(r=>r.course),['psychology']);
 assert.equal((await owner('select course from workspace_github_jobs where submission_id=$1',[next]))[0].course,'psychology');
 // Comments address a course as <bachelor>.<course>.
 await as(member,memo,[crypto.randomUUID(),'common/aiwise-c2-final.html?course=psychology.psychodiagnostics&lang=nl',anchor,'New address',v2,'psychology','c2','nl','c2.examples']);
 await assert.rejects(()=>as(member,memo,[crypto.randomUUID(),'common/aiwise-c2-final.html?course=Psychology.AWS1',anchor,'Bad address',v2,null,null,null,null]));
 await assert.rejects(()=>as(member,memo,[crypto.randomUUID(),'common/aiwise-c2-final.html?course=psychology.aws1',anchor,'Unknown scope',v2,'unknown','c2','en','c2.examples']));
 console.log('PASS content scopes: public registry, renamed live records, untouched saved versions and jobs, rename-free comparison, retired scope and course addresses.');
})().catch(e=>{console.error(e);process.exit(1);});
