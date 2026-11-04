const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..'),name='20261104135937_example_specific_boxes.sql',dir=path.join(root,'supabase/migrations');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<name).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const user='11111111-1111-4111-8111-111111111111';
 await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'test@example.test',now(),'{\"display_name\":\"Example boxes test\"}')",[user]);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true)",[user]);
 const owner=async(sql,args=[])=>{await db.exec('reset role');return(await db.query(sql,args)).rows;};
 const as=async(sql,args=[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');return(await db.query(sql,args)).rows;};
 const source=(await owner("select slots from workspace_content_sources where course='psychology' and chapter='c2' and locale='en'"))[0].slots;
 const submit=async(slots,base,release=null)=>(await as("select workspace_submit_localized_content($1,'psychology','c2',$2,$3,$4,now(),'Example boxes test','en',null) id",[crypto.randomUUID(),slots,base,release]))[0].id;
 const old=structuredClone(source);old._studio={version:1,formats:[],boxes:[{id:'box-'+crypto.randomUUID(),slot:'c2.examples',template:'text',anchor:0,fields:[[{text:'What the model does not know'}],[{text:'Original context'}]],align:'left',size:0}]};
 const oldId=await submit(old,source),snapshot=async()=>JSON.stringify(await owner('select to_jsonb(s) row from workspace_submissions s order by id'));
 const before=await snapshot(),sources=JSON.stringify(await owner('select to_jsonb(s) row from workspace_content_sources s order by course,chapter,locale'));
 const sql=fs.readFileSync(path.join(dir,name),'utf8');assert.equal(sql,fs.readFileSync(path.join(root,'supabase/EXAMPLE_BOXES_SETUP.sql'),'utf8'));
 await db.exec(sql);assert.equal(await snapshot(),before);assert.equal(JSON.stringify(await owner('select to_jsonb(s) row from workspace_content_sources s order by course,chapter,locale')),sources);
 assert.deepEqual((await as('select workspace_studio_capabilities() v'))[0].v,{blocks:1,sat_phases:1,approval_merge:1,example_boxes:1});
 await as("select workspace_decide_content($1,1,'approved','Preserved legacy box')",[oldId]);
 const base=(await owner("select slots from workspace_beta_content where course='psychology' and chapter='c2' and locale='en'"))[0].slots;
 const next=structuredClone(base),original=next._studio.boxes[0];next._studio.boxes.push({...structuredClone(original),id:'box-'+crypto.randomUUID(),example:1,family:original.id,fields:[[{text:'What the model does not know'}],[{text:'Context for the second example'}]]});
 const id=await submit(next,base,oldId);await as("select workspace_decide_content($1,1,'approved','Independent example boxes')",[id]);
 assert.deepEqual((await owner("select slots from workspace_beta_content where course='psychology' and chapter='c2' and locale='en'"))[0].slots,next);
 for(const mutate of [b=>b.example=-1,b=>b.example=50,b=>b.example=0.5,b=>b.example=null,b=>b.example='1',b=>delete b.example,b=>delete b.family,b=>b.family='bad',b=>b.example=0,b=>b.anchor=1,b=>b.slot='c2.sat_example']){
  const bad=structuredClone(next);mutate(bad._studio.boxes[1]);assert.equal((await owner('select workspace_valid_content($1,$2) ok',[bad,base]))[0].ok,false);
 }
 const rows=await snapshot();await owner('select 1');await db.exec(sql);assert.equal(await snapshot(),rows);
 console.log('PASS example_boxes: legacy requests unchanged, independent copies submitted/approved, metadata validation, all capabilities retained, idempotent activation');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
