const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..'),name='20261006171555_sat_phase_editing.sql',dir=path.join(root,'supabase/migrations');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<name).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const user='11111111-1111-4111-8111-111111111111';
 await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'test@example.test',now(),'{\"display_name\":\"SAT test\"}')",[user]);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true)",[user]);
 const owner=async(sql,args=[])=>{await db.exec('reset role');return(await db.query(sql,args)).rows;};
 const as=async(sql,args=[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');return(await db.query(sql,args)).rows;};
 const source=(await owner("select slots from workspace_content_sources where course='psychology' and chapter='c2' and locale='en'"))[0].slots;
 const submit=async(slots,base,release=null)=>(await as("select workspace_submit_localized_content($1,'psychology','c2',$2,$3,$4,now(),'SAT phase editing test','en',null) id",[crypto.randomUUID(),slots,base,release]))[0].id;
 const old=structuredClone(source);old['c2.sat_example_title']='Existing pending SAT';const oldId=await submit(old,source);
 const snapshot=async()=>JSON.stringify(await owner('select to_jsonb(s) row from workspace_submissions s order by id'));
 const before=await snapshot(),sourceBefore=JSON.stringify(await owner('select to_jsonb(s) row from workspace_content_sources s order by course,chapter,locale'));
 const sql=fs.readFileSync(path.join(dir,name),'utf8');assert.equal(sql,fs.readFileSync(path.join(root,'supabase/SAT_PHASE_EDITING_SETUP.sql'),'utf8'));
 await db.exec(sql);assert.equal(await snapshot(),before);assert.equal(JSON.stringify(await owner('select to_jsonb(s) row from workspace_content_sources s order by course,chapter,locale')),sourceBefore);
 assert.deepEqual((await as('select workspace_studio_capabilities() v'))[0].v,{blocks:1,sat_phases:1});
 await as("select workspace_decide_content($1,1,'approved','Preserved old request')",[oldId]);
 const readBeta=async()=>(await owner("select slots from workspace_beta_content where course='psychology' and chapter='c2' and locale='en'"))[0].slots;
 let base=await readBeta(),release=oldId;
 for(const count of [2,4,0,1]){
  const next=structuredClone(base);next['c2.sat_example'].phases=Array.from({length:count},(_,i)=>structuredClone(source['c2.sat_example'].phases[i%3]));
  const id=await submit(next,base,release);await as("select workspace_decide_content($1,1,'approved','Add or delete cycles')",[id]);
  assert.equal((await readBeta())['c2.sat_example'].phases.length,count);base=await readBeta();release=id;
 }
 for(const mutate of [v=>v['c2.sat_example'].phases[0].steps.pop(),v=>v['c2.sat_example'].phases[0].steps[0].actor='script',v=>v['c2.sat_example'].extra='bad',v=>v['c2.sat_example'].phases=Array(51).fill(source['c2.sat_example'].phases[0])]){
  const bad=structuredClone(source);mutate(bad);assert.equal((await owner('select workspace_valid_content($1,$2) ok',[bad,source]))[0].ok,false);
 }
 const rows=await snapshot(),beta=JSON.stringify(await readBeta());await db.exec(sql);assert.equal(await snapshot(),rows);assert.equal(JSON.stringify(await readBeta()),beta);
 console.log('PASS sat_phases: old requests/source unchanged, add/delete/zero/add-back approved, capability, malformed payload rejection, repeat-safe setup');await db.close();
})().catch(e=>{console.error(e);process.exit(1);});
