/* Exercise the real SQL and compare its merge with the browser engine. No live writes. */
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
(async()=>{
 const db=new PGlite(); await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz,created_at timestamptz default now(),deleted_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 const root=path.resolve(__dirname,'../..'),migration='20261005141841_control_tower_item_approval.sql',dir=path.join(root,'supabase/migrations');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')&&f<migration).sort())await db.exec(fs.readFileSync(path.join(dir,f),'utf8'));
 const user='11111111-1111-4111-8111-111111111111';
 await db.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'test@example.test',now(),'{\"display_name\":\"Reviewer\"}')",[user]);
 await db.query("insert into workspace_members(user_id,role,active) values($1,'admin',true)",[user]);
 const owner=async(sql,args=[])=>{await db.exec('reset role');return (await db.query(sql,args)).rows;};
 const as=async(sql,args=[])=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');return(await db.query(sql,args)).rows;};
 const source=(await owner("select slots from workspace_content_sources where course='common' and chapter='c1' and locale='en'"))[0].slots;
 const submit=async(slots,base=source,release=null)=>(await as("select workspace_submit_localized_content($1,'common','c1',$2,$3,$4,now(),'Approval test','en',null) id",[crypto.randomUUID(),slots,base,release]))[0].id;
 const slot=Object.keys(source).find(k=>Object.keys(source[k]).length>1),[first,second]=Object.keys(source[slot]);
 const a=structuredClone(source),b=structuredClone(source);a[slot][first]='First requested change';b[slot][second]='Second change approved first';
 const aid=await submit(a),bid=await submit(b);
 const before=(await owner('select to_jsonb(s) v from workspace_submissions s where id=$1',[aid]))[0].v;
 const sql=fs.readFileSync(path.join(dir,migration),'utf8');assert.equal(sql,fs.readFileSync(path.join(root,'supabase/CONTROL_TOWER_APPROVAL_SETUP.sql'),'utf8'));await db.exec(sql);
 assert.deepEqual((await owner("select to_jsonb(s)-'approval_result' v from workspace_submissions s where id=$1",[aid]))[0].v,before,'migration preserves all original request data');
 const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/draft-recovery.js'),'utf8'),sandbox);const R=sandbox.window.AIWiseDraftRecovery;
 const js=v=>JSON.parse(JSON.stringify(v));
 const prepare=async id=>(await as('select workspace_prepare_content_approval($1,1) v',[id]))[0].v;
 const apply=async(id,c,choices=[],result=js(R.combine(R.plan(c.base,c.draft,c.latest))))=>as('select workspace_apply_content_approval($1,1,$2,$3,$4,$5,$6)',[id,c.release,c.latest,choices,result,'Reviewed']);
 const current=async()=>(await owner("select * from workspace_beta_content where course='common' and chapter='c1' and locale='en'"))[0];
 await apply(bid,await prepare(bid)); const ac=await prepare(aid);assert.equal(R.plan(ac.base,ac.draft,ac.latest).conflicts.length,0);
 await apply(aid,ac);let beta=await current();assert.equal(beta.slots[slot][first],a[slot][first]);assert.equal(beta.slots[slot][second],b[slot][second]);
 const stored=(await owner('select * from workspace_submissions where id=$1',[aid]))[0];assert.deepEqual(stored.slots,a);assert.deepEqual(stored.base_slots,source);assert.equal(stored.author_id,user);assert.deepEqual(stored.approval_result.slots,beta.slots);
 assert.deepEqual((await owner('select payload from workspace_github_jobs where submission_id=$1',[aid]))[0].payload.slots,beta.slots,'outbox contains combined content');
 const c=structuredClone(beta.slots),d=structuredClone(beta.slots);c[slot][first]='Requested wording';d[slot][first]='New Beta wording';
 const cid=await submit(c,beta.slots,beta.submission_id),did=await submit(d,beta.slots,beta.submission_id),staleContext=await prepare(cid);
 await apply(did,await prepare(did));
 await assert.rejects(()=>apply(cid,staleContext),/Beta changed/);
 const cc=await prepare(cid),model=R.plan(cc.base,cc.draft,cc.latest);assert.equal(model.conflicts.length,1);
 await assert.rejects(()=>apply(cid,cc,[],cc.latest),/Choose a version/);
 const u=model.conflicts[0],edit={kind:u.kind,path:u.path,choice:'edit',text:'Reviewed combined wording'};
 const result=js(R.combine(model,{[u.id]:{choice:'edit',text:edit.text}}));
 const tamper=structuredClone(result);tamper[slot][second]='Unreviewed change';
 await assert.rejects(()=>apply(cid,cc,[edit],tamper),/preview no longer matches/);
 await apply(cid,cc,[edit],result);assert.equal((await current()).slots[slot][first],edit.text);
 // Two equal requests: second records review without replacing the current release or enqueueing a job.
 beta=await current();const same=structuredClone(beta.slots);same[slot][second]='Shared identical edit';
 const x=await submit(same,beta.slots,beta.submission_id),y=await submit(same,beta.slots,beta.submission_id);
 await apply(x,await prepare(x));const prior=await current();await apply(y,await prepare(y));assert.deepEqual(await current(),prior);
 assert.equal((await owner('select approval_result from workspace_submissions where id=$1',[y]))[0].approval_result.no_op,true);
 assert.equal((await owner('select count(*)::int n from workspace_github_jobs where submission_id=$1',[y]))[0].n,0);
 await assert.rejects(()=>prepare(y),/already changed/);
 // Re-running owner setup changes no content or decision.
 // A changed English source still blocks old Dutch translation approvals.
 const nlSource=(await owner("select slots from workspace_content_sources where course='common' and chapter='c1' and locale='nl'"))[0].slots;
 const nid=(await as("select workspace_submit_localized_content($1,'common','c1',$2,$2,null,now(),'Dutch translation','nl',$3) id",[crypto.randomUUID(),nlSource,(await current()).submission_id]))[0].id;
 const nc=await prepare(nid);beta=await current();const en=structuredClone(beta.slots);en[slot][first]='English source advanced';const eid=await submit(en,beta.slots,beta.submission_id);await apply(eid,await prepare(eid));
 await assert.rejects(()=>apply(nid,nc),/English source changed/);
 const snapshot=await owner('select to_jsonb(s) v from workspace_submissions s order by id');await db.exec(sql);assert.deepEqual(await owner('select to_jsonb(s) v from workspace_submissions s order by id'),snapshot);
 // Generic browser/server parity: unrelated fields, lists, boxes, deletion, formatting, reorder, all choices.
 const box=(id,text)=>({id,slot:'item',template:'card',anchor:0,fields:[[{text}]],align:'left'});
 const extension=(boxes=[],formats=[])=>({version:1,boxes,formats});
 const cases=[
 [{item:{title:'Title',body:'Body'}},{item:{title:'New',body:'Body'}},{item:{title:'Title',body:'Other'}}],
 [{item:['A','B']},{item:['B','A']},{item:['A','C']}],
 [{item:'A',_studio:extension()},{item:'A',_studio:extension([box('1','One')])},{item:'A',_studio:extension([box('2','Two')])}],
 [{item:'A',_studio:extension([box('1','One')])},{item:'A',_studio:extension([])},{item:'A',_studio:extension([box('1','Changed')])}],
 [{item:'A'},{item:'B'},{item:'A',_studio:extension([],[{slot:'item',path:[],runs:[{text:'A',bold:true}]}])}],
 [{item:'A',_studio:extension([box('1','One'),box('2','Two'),box('3','Three')])},{item:'A',_studio:extension([box('2','Two'),box('1','One'),box('3','Three')])},{item:'A',_studio:extension([box('3','Three'),box('1','One'),box('2','Two'),box('4','New')])}],
 [{item:{a:'A',b:'B'}},{item:{a:'C',b:'B'},extra:'New'},{item:{a:'A',b:'D'}}],
 ];
 for(const [base,draft,latest] of cases)for(const choice of ['beta','draft']){
  const model=R.plan(base,draft,latest),choices=Object.fromEntries(model.conflicts.map(u=>[u.id,choice]));const resolutions=model.conflicts.map(u=>({kind:u.kind,path:u.path,choice}));
  const merged=(await owner('select aiwise_private.approval_merge($1,$2,$3,$4) v',[base,draft,latest,resolutions]))[0].v;
  assert.deepEqual(merged,js(R.combine(model,choices)));
 }
 await assert.rejects(()=>owner('select aiwise_private.approval_merge($1,$1,$1,$2)',[{item:'A'},[{kind:'field',path:['item'],choice:'draft'}]]),/unchanged or unknown/);
 if(process.env.APPROVAL_READONLY_SNAPSHOT)for(const r of JSON.parse(fs.readFileSync(process.env.APPROVAL_READONLY_SNAPSHOT,'utf8'))){
  const model=R.plan(r.base_slots,r.slots,r.latest);
  assert.equal(model.conflicts.length,0,'These three known pending additions should not overlap');
  const merged=js(R.combine(model)),server=(await owner('select aiwise_private.approval_merge($1,$2,$3,$4) v',[r.base_slots,r.slots,r.latest,[]]))[0].v;assert.deepEqual(server,merged);
  console.log('Verified read-only pending snapshot',r.id,'no-op:',R.equal(merged,js(R.combine(R.plan(r.latest,r.latest,r.latest)))));
 }
 await db.exec('set role anon');await assert.rejects(()=>db.query('select workspace_prepare_content_approval($1,1)',[aid]),/permission denied/);
 await db.exec('reset role');await db.query("update workspace_members set role='member' where user_id=$1",[user]);
 await assert.rejects(()=>as('select workspace_prepare_content_approval($1,1)',[aid]),/Administrator/);
 console.log('PASS item_approval: preserved snapshots, out-of-order merge, concurrent baseline guard, manual resolution, tamper rejection, no-op without outbox, parity and access controls');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
