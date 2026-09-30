/* Shared requests are read and changed through authenticated Supabase APIs. */
(() => {
  'use strict';
  let identity = '', generation = 0, rows = [], role = null, error = '', loaded = false;
  const names = {other:'Other courses',common:'AI-Wise Common',aws1:'Academic Writing Skills I',ped:'Pedagogical Sciences'};
  function snapshot() { return {rows:rows.map(r=>({...r})),role,error,loaded}; }
  function notify() { window.dispatchEvent(new Event('aiwise:shared-studio')); }
  function friendly(e) {
    if (['PGRST202','PGRST205','42P01','42883'].includes(e?.code)) return Error('Shared review setup is not ready. Ask the administrator to apply the shared Studio database migration.');
    return Error(e?.message || 'Shared requests could not be reached. Check your connection and retry.');
  }
  async function client() {
    if (window.AIWiseAuth.snapshot().status !== 'member') throw Error('Sign in with an approved team account to use shared review.');
    return window.AIWiseBackend.getClient();
  }
  async function query(request) {
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),15000);
    try { const result = await request.abortSignal(controller.signal); if (result.error) throw friendly(result.error); return result.data; }
    finally { clearTimeout(timer); }
  }
  function convert(r) {
    const name=names[r.course] || r.course, language=r.locale==='nl'?'Nederlands':'English';
    return {shared:true,id:r.id,route:r.course === 'common' ? 'common' : 'studio',type:'submission',status:r.status,rev:r.revision,
      title:`${name} · ${r.chapter.toUpperCase()} · ${language} content update`,target:`${name} · ${r.chapter.toUpperCase()} · ${language}`,
      version:'Saved draft · '+r.saved_at,targetRef:'Shared content copy · '+r.id,
      details:r.summary,changes:r.summary,outcome:'Apply the approved chapter to Beta.',references:'',priority:'normal',
      author:{name:r.author_name,userId:r.author_id},createdAt:r.submitted_at,submittedAt:r.submitted_at,seenBy:{},
      decision:r.decided_at?{status:r.status,reason:r.decision_reason,by:r.reviewer_name,at:r.decided_at}:null,
      events:[{action:'Submitted to team',by:r.author_name,at:r.submitted_at,reason:r.summary},...(r.decided_at?[{action:r.status==='approved'?'Approved and applied to Beta':r.status==='revision'?'Revision requested':'Rejected',by:r.reviewer_name,at:r.decided_at,reason:r.decision_reason}]:[])],
      contentSnapshot:{schema:1,course:r.course,chapter:r.chapter,locale:r.locale||'en',sourceRelease:r.source_release,courseName:name,savedAt:r.saved_at,slots:r.slots,baseSlots:r.base_slots}};
  }
  async function refresh() {
    const token=++generation, user=window.AIWiseAuth.snapshot();
    if (user.status!=='member') { rows=[];role=null;error='Sign in with an approved team account to view shared submissions.';loaded=false;notify();return snapshot(); }
    try {
      const backend=await client();
      const [ownRole,records]=await Promise.all([query(backend.rpc('workspace_role')),query(backend.from('workspace_submissions').select('*').order('submitted_at',{ascending:false}))]);
      if(token!==generation)return snapshot();
      if(!ownRole)throw Error('Team access has been revoked.');
      role=ownRole;rows=records.map(convert);error='';loaded=true;
    } catch(e) { if(token!==generation)return snapshot(); rows=[];role=null;loaded=false;error=friendly(e).message; }
    notify();return snapshot();
  }
  async function submit({course,chapter,raw,slots,baseSlots,baseRelease,summary,locale='en',sourceRelease=null}) {
    const backend=await client(), user=window.AIWiseAuth.snapshot().user;
    const saved=JSON.parse(raw), owner=user.id;
    const assertOwner=()=>{const now=window.AIWiseAuth.snapshot();if(now.status!=='member'||now.user?.id!==owner)throw Error('Your account changed. Reopen the submission form.');};
    // Stable per-account content ID makes a lost response safe to retry, including across tabs.
    const bytes=new TextEncoder().encode(user.id+'\n'+course+'\n'+chapter+'\n'+locale+'\n'+raw);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const clientId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-8'+hash.slice(17,20)+'-'+hash.slice(20,32);
    assertOwner();
    const id=await query(backend.rpc('workspace_submit_localized_content',{p_client_id:clientId,p_locale:locale,p_source_release:sourceRelease,p_course:course,p_chapter:chapter,p_slots:slots,p_base_slots:baseSlots,p_base_release:baseRelease||null,p_saved_at:saved.savedAt,p_summary:summary}));
    assertOwner();await refresh();return {id};
  }
  async function decide(id,revision,status,reason) {
    const backend=await client();
    await query(backend.rpc('workspace_decide_content',{p_id:id,p_revision:revision,p_status:status,p_reason:reason}));
    await refresh();
  }
  window.AIWiseSharedStudio=Object.freeze({snapshot,refresh,submit,decide});
  window.AIWiseAuth.subscribe(state=>{
    const key=state.status+':'+(state.user?.id||'');
    if(key===identity)return;identity=key;generation++;rows=[];role=null;loaded=false;error='';notify();
    if(state.status==='member')refresh();
  });
})();
