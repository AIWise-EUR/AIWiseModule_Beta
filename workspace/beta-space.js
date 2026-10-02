/* Review versions are private content copies. Rendering remains in the Workspace. */
(() => {
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let session=null,preview=null;
 const validId=s=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
 const who=()=>window.AIWiseAuth.snapshot();
 const active=s=>session===s&&who().user?.id===s.owner&&['member','checking'].includes(who().status);
 async function request(make){
  const user=who();if(user.status!=='member')throw Error('Sign in with an approved team account.');
  const backend=await window.AIWiseBackend.getClient(),abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
  try{const {data,error}=await make(backend).abortSignal(abort.signal);
   if(error)throw Error(['PGRST202','PGRST205','42P01','42703'].includes(error.code)?'Review versions are not ready yet. Ask the administrator to finish setup.':error.code==='22023'?error.message:'The review space could not be loaded. Please retry.');
   if(who().user?.id!==user.user.id||!['member','checking'].includes(who().status))throw Error('Your account changed. Reopen Beta.');return data;
  }finally{clearTimeout(timer);}
 }
 const date=value=>new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const inbox=()=>window.AIWiseReviewInbox;
 function badges(info,id){
  const base='#beta/'+(id||'current');
  const stat=(href,icon,total,label,unread)=>`<a class="beta-version-stat" href="${href}"><span class="beta-stat-total"><span aria-hidden="true">${icon}</span><strong>${total}</strong><span>${label}</span></span>${unread?`<small class="beta-unread">${unread} unread</small>`:''}</a>`;
  return stat(base,'↻',info.changes,info.changes===1?'update':'updates',info.unreadChanges)+stat(base+'?tab=feedback','▤',info.memoCount,info.memoCount===1?'memo':'memos',info.unreadMemos);
 }
 async function load(s){
  if(s.loading||!active(s))return;s.loading=true;const epoch=s.epoch=(s.epoch||0)+1;s.message.textContent='Updating your counts…';
  try{
   const versions=await request(b=>b.from('workspace_beta_versions').select('id,number,title,summary,author_name,created_at,published_at').order('number',{ascending:false}).range(0,s.limit));
   const visible=versions.slice(0,s.limit);
   const summaries=await Promise.all([null,...visible.map(v=>v.id)].map(async id=>{const data=id&&s.contexts?.get(id)||await window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:id});if(id){s.contexts ||=new Map();s.contexts.set(id,data);}return {data,info:await inbox().summary(id,data)};}));
   if(!active(s)||s.epoch!==epoch)return;
   const current=summaries[0];s.message.textContent='Unread is personal to you. Counts refresh automatically.';
   s.root.querySelector('[data-current-summary]').innerHTML=badges(current.info,null);
   s.root.querySelector('[data-current-baseline]').textContent=current.data.previous_number?`Since V${current.data.previous_number}${current.data.previous_kind==='snapshot'?' · earlier snapshot':''}`:'No earlier comparison version';
   s.root.querySelector('[data-version-list]').innerHTML=visible.map((v,i)=>`<article class="beta-version-row"><div class="beta-version-meta"><h3>V${v.number} <span>· ${esc(v.created_at?.slice(0,10))}</span></h3><small>${v.published_at?'Published':'Earlier snapshot'}</small></div><div class="beta-version-stats">${badges(summaries[i+1].info,v.id)}</div><a class="button beta-version-open" href="#beta/${v.id}" aria-label="Open V${v.number}">Open →</a></article>`).join('')||'<p>No earlier versions yet.</p>';
   s.root.querySelector('[data-version-more]').hidden=versions.length<=s.limit;
   s.root.querySelector('[data-open]').disabled=false;
  }catch(e){if(active(s)){s.message.textContent=e.message;s.root.querySelector('[data-open]').disabled=false;}}
  finally{s.loading=false;}
 }
 async function render(shell,part=''){
  dispose();const [id,query='']=part.split('?');const params=new URLSearchParams(query);
  const owner=who().user?.id,s=session={owner,busy:false,dialog:null,selected:params.get('version'),limit:5};
  if((id==='current'||validId(id))&&params.get('publish')==='1'&&who().role==='admin'){s.release=window.AIWisePublishedRelease.render(shell,{fromBeta:true});return;}
  if(id==='current'||validId(id)){
   shell(null,'AI-Wise Beta','', '<p role="status" data-preview-status>Loading preview…</p>',false);
   const container=document.getElementById('room');
   try{let draft=null,version=null;const review=await window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:id==='current'?null:id});if(id==='current')draft=review;if(id!=='current')version=await request(b=>b.from('workspace_beta_versions').select('*').eq('id',id).single());
    if(!active(s))return;
    if(id!=='current'&&(!version||version.id!==id||!Array.isArray(version.content)))throw Error('This review version is not available.');
    preview={owner,version:version||{id:'current',content:draft.current_content}};container.replaceChildren();container.classList.add('beta-preview-page');
    let first=null;if(!params.has('page')&&!params.has('memo')&&!params.has('item')&&params.get('tab')!=='feedback'){try{const items=await inbox().changes(version?.id||null,review);first=items.find(r=>r.unread)||items[0]||null;}catch{first=window.AIWiseBetaChecklist.firstChange(review);}}if(!active(s))return;
    const start=first?new URLSearchParams(window.AIWiseBetaChecklist.previewLink(version?.id,first).split('?')[1]):params;
    window.AIWiseBetaReview.open('',()=>{location.hash='#beta';},{container,version,draft,review,initialPage:start.get('page'),memo:params.get('memo'),item:start.get('item'),scope:start.get('scope'),tab:params.get('tab')});
   }catch(e){if(active(s)){const status=container.querySelector('[data-preview-status]')||container.appendChild(document.createElement('p'));status.textContent=e.message;const a=document.createElement('a');a.href='#beta';a.className='button';a.textContent='Back to review versions';container.append(a);}}return;
  }
  shell(null,'AI-Wise Beta','',`<p class="room-lead">Choose a version. Approved changes collect in Next publication until published.</p><div class="beta-space beta-home-simple"><div class="beta-list-heading"><h2>Versions</h2><button type="button" class="button" data-refresh>↻ Refresh</button></div><div class="beta-version-columns" aria-hidden="true"><span>Version</span><span>Updates</span><span>Feedback</span><span></span></div><section class="beta-version-row beta-version-current" aria-label="Next publication"><div class="beta-version-meta"><h3>Next publication</h3><small><span class="beta-version-status">Unpublished</span><span data-current-baseline></span></small></div><div class="beta-version-stats" data-current-summary><span class="beta-stat-loading">Loading…</span><span></span></div><button type="button" class="button primary beta-version-open" data-open>Open →</button></section><div data-version-list></div><button class="button beta-version-more" type="button" data-version-more hidden>Load more versions</button><p role="status" data-space-message></p></div>`,false);
  document.getElementById('room-title')?.focus();s.root=document.querySelector('.beta-space');s.message=s.root.querySelector('[data-space-message]');
  s.root.querySelector('[data-open]').onclick=()=>{location.hash='#beta/current';};
  s.root.querySelector('[data-refresh]').onclick=()=>load(s);
  s.root.querySelector('[data-version-more]').onclick=()=>{s.limit+=5;load(s);};
  const update=()=>{if(!document.hidden)load(s);};s.abort=new AbortController();
  window.addEventListener('focus',update,{signal:s.abort.signal});window.addEventListener('aiwise:reading-changed',update,{signal:s.abort.signal});
  s.timer=setInterval(update,15000);await load(s);
 }
 function snapshot(id,course,locale){
  if(!preview||preview.version?.id!==id||who().user?.id!==preview.owner||!['member','checking'].includes(who().status))throw Error('This review version is not available.');
  const rows=preview.version.content.filter(r=>r.course===course&&r.locale===locale);
  if(locale==='nl')for(const english of preview.version.content.filter(r=>r.course===course&&r.locale==='en'))if(!rows.some(r=>r.chapter===english.chapter))rows.push({...english,locale:'nl',fallback_locale:'en'});
  return JSON.parse(JSON.stringify(rows));
 }
 function dispose(){const s=session;session=null;preview=null;clearInterval(s?.timer);s?.abort?.abort();s?.release?.();s?.dialog?.close();s?.dialog?.remove();document.getElementById('room')?.classList.remove('beta-preview-page');}
 window.AIWiseBetaSpace=Object.freeze({render,dispose,snapshot,canLeave:()=>!session?.busy&&!session?.dialog});
})();
