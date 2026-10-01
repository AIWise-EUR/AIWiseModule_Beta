/* Personal reading state never changes the team's review or resolution decisions. */
(() => {
 'use strict';
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 const token=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stable(value))))).map(n=>n.toString(16).padStart(2,'0')).join('');
 const who=()=>window.AIWiseAuth.snapshot();
 async function query(make){const a=who();if(a.status!=='member')throw Error('Sign in to see your unread items.');const b=await window.AIWiseBackend.getClient(),c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const {data,error}=await make(b).abortSignal(c.signal);if(who().user?.id!==a.user.id||who().status!=='member')throw Error('Your account changed.');if(error){if(error.code==='23505')return null;throw Error(['PGRST205','42P01','42703'].includes(error.code)?'Personal reading status needs the Workspace database update.':'Reading status could not be saved or loaded. Please retry.');}return data;}finally{clearTimeout(timer);}}
 async function all(make){const rows=[];for(let start=0;;start+=200){const batch=await query(b=>make(b).range(start,start+199));rows.push(...batch);if(batch.length<200)return rows;}}
 const scope=(id,data)=>id||'current:'+(data.previous_id||'first');
 const changeToken=(id,data,r)=>token(['change',scope(id,data),r.course,r.chapter,r.locale,r.key,r.before,r.after]);
 const memoToken=(m,replies)=>token(['memo',m.id,m.body,m.anchor,replies.filter(r=>r.memo_id===m.id).map(r=>[r.id,r.body]).sort((a,b)=>a[0].localeCompare(b[0]))]);
 async function seen(tokens){const found=new Set();for(let i=0;i<tokens.length;i+=100){const rows=await query(b=>b.from('workspace_review_seen').select('token').in('token',tokens.slice(i,i+100)));rows.forEach(r=>found.add(r.token));}return found;}
 async function mark(value){await query(b=>b.from('workspace_review_seen').insert({token:value}));window.dispatchEvent(new Event('aiwise:reading-changed'));}
 async function changes(id,data){const tokens=await Promise.all(data.changes.map(r=>changeToken(id,data,r))),read=await seen(tokens);return data.changes.map((r,i)=>({...r,read_token:tokens[i],unread:!read.has(tokens[i])}));}
 async function threads(memos,replies){const tokens=await Promise.all(memos.map(m=>memoToken(m,replies))),read=await seen(tokens);return memos.map((m,i)=>({...m,read_token:tokens[i],unread:!read.has(tokens[i])}));}
 async function feedback(id){const memos=await all(b=>{const q=b.from('workspace_beta_memos').select('*').order('created_at').order('id');return id?q.eq('version_id',id):q.is('version_id',null);});const replies=[];for(let i=0;i<memos.length;i+=100)replies.push(...await all(b=>b.from('workspace_beta_replies').select('*').in('memo_id',memos.slice(i,i+100).map(m=>m.id)).order('created_at').order('id')));return {memos:await threads(memos,replies),replies};}
 async function summary(id,data){const [items,notes]=await Promise.all([changes(id,data),feedback(id)]);return {items,memos:notes.memos,changes:items.length,unreadChanges:items.filter(r=>r.unread).length,memoCount:notes.memos.length,unreadMemos:notes.memos.filter(m=>m.unread).length};}
 function address(node,course,locale){const n=node.closest('[data-review-content-key],[data-slot],[data-review-common-key]');if(!n)return null;const key=n.dataset.reviewContentKey||n.dataset.reviewCommonKey||n.dataset.slot;return {content_course:n.dataset.reviewContentCourse||(n.dataset.reviewCommonKey?'common':course),content_chapter:key.split('.')[0],content_locale:locale,item_key:key};}
 window.AIWiseReviewInbox=Object.freeze({query,all,token,changeToken,memoToken,seen,mark,changes,threads,feedback,summary,address});
})();
