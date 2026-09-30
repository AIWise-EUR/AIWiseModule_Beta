/* Team feedback uses the existing account session. RLS remains the authority. */
(() => {
  'use strict';
  function message(error) {
    if(['42P01','PGRST205'].includes(error?.code)) return Error('Team feedback is not ready yet. Ask the administrator to finish setup.');
    if(error?.code==='42501')return Error('Your team access could not be verified. Reopen your account and try again.');
    if(error?.code==='23514'&&error.message?.startsWith('Choose active teammates'))return Error(error.message);
    if(['23514','23503'].includes(error?.code))return Error('This location or thread is no longer available. Reload the preview and select it again.');
    return Error('Feedback could not be reached. Check your connection and retry.');
  }
  async function request(query) {
    const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),15000);
    try {const {data,error}=await query.abortSignal(abort.signal);if(error)throw message(error);return data;}
    finally {clearTimeout(timer);}
  }
  async function account() {
    const state=window.AIWiseAuth.snapshot();
    if(state.status!=='member')throw Error('Sign in with an approved team account to use feedback.');
    return {backend:await window.AIWiseBackend.getClient(),owner:state.user.id};
  }
  function unchanged(owner) {const state=window.AIWiseAuth.snapshot();if(state.status!=='member'||state.user?.id!==owner)throw Error('Your account changed. Reopen feedback.');}
  async function list(page,version=null) {
    const {backend,owner}=await account();
    const [role,memos]=await Promise.all([request(backend.rpc('workspace_role')),request((version?backend.from('workspace_beta_memos').select('*').eq('page',page).eq('version_id',version):backend.from('workspace_beta_memos').select('*').eq('page',page).is('version_id',null)).order('created_at',{ascending:true}))]);
    if(!role)throw Error('Your team access is no longer active.');
    const replies=memos.length?await request(backend.from('workspace_beta_replies').select('*').in('memo_id',memos.map(m=>m.id)).order('created_at',{ascending:true})):[];
    unchanged(owner);return {role,memos,replies};
  }
  const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
  async function insert(table,record) {
    const {backend,owner}=await account();unchanged(owner);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try {
      const result=await backend.from(table).insert(record).select().single().abortSignal(controller.signal);
      if(result.error) {
        if(result.error.code!=='23505')throw message(result.error);
        // Reusing the same client UUID makes a lost response safe to retry.
        const saved=await request(backend.from(table).select('*').eq('id',record.id).single());
        if(saved.author_id!==owner || saved.body!==record.body || (record.page && saved.page!==record.page) || (record.memo_id && saved.memo_id!==record.memo_id) || (record.anchor && stable(saved.anchor)!==stable(record.anchor)) || (saved.version_id||null)!==(record.version_id||null) || stable([...(saved.mentions||[])].sort())!==stable([...(record.mentions||[])].sort())) throw Error('This feedback changed. Refresh before retrying.');
        unchanged(owner);return saved;
      }
      unchanged(owner);return result.data;
    } finally {clearTimeout(timer);}
  }
  async function resolve(id,resolved,previous) {
    const {backend,owner}=await account();
    const rows=await request(backend.from('workspace_beta_memos').update({resolved}).eq('id',id).eq('resolved',previous).select('id'));
    unchanged(owner);if(rows.length!==1)throw Error('This comment changed or you cannot resolve it. Refresh and try again.');
  }
  window.AIWiseBetaFeedback=Object.freeze({list,people:async()=>{const {backend,owner}=await account();const people=await request(backend.rpc('workspace_beta_people'));unchanged(owner);return people;},add:record=>insert('workspace_beta_memos',record),reply:record=>insert('workspace_beta_replies',record),resolve});
})();
