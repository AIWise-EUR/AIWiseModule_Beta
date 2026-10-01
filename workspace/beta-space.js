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
 async function load(s){
  const epoch=s.epoch=(s.epoch||0)+1;s.message.textContent='Loading review space…';
  try{
   const [versions,review]=await Promise.all([
    request(b=>b.from('workspace_beta_versions').select('id,number,title,summary,author_name,created_at,published_at').order('number',{ascending:false}).range(0,199)),
    window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:null})
   ]);if(!active(s)||s.epoch!==epoch)return;
   s.message.textContent='';s.versions=versions;
   const progress=window.AIWiseBetaChecklist.progress(review),count=review.changes.length;
   s.root.querySelector('[data-current-summary]').textContent=count?`${count} ${count===1?'change':'changes'} · ${progress.reviewed} reviewed · ${progress.open} open ${progress.open===1?'memo':'memos'}`:'No new changes against the comparison version.';
   s.root.querySelector('[data-current-baseline]').textContent=review.previous_number?`Compared with V${review.previous_number}${review.previous_kind==='snapshot'?' · earlier review snapshot':''}`:'First publication · review all approved content';
   const picker=s.root.querySelector('[data-version]');picker.innerHTML=versions.map(v=>`<option value="${v.id}">V${v.number} · ${esc(v.created_at?.slice(0,10))}${v.published_at?'':' · Review snapshot'}</option>`).join('');
   if(s.selected&&versions.some(v=>v.id===s.selected))picker.value=s.selected;
   s.root.querySelector('[data-version-count]').textContent=`Earlier versions (${versions.length}${versions.length===200?'+':''})`;
   s.root.querySelector('[data-archive-empty]').hidden=!!versions.length;s.root.querySelector('[data-archive-controls]').hidden=!versions.length;
   const details=()=>{s.selected=picker.value;const v=versions.find(v=>v.id===s.selected);s.root.querySelector('[data-version-info]').textContent=v?`${date(v.created_at)}${v.summary?' · '+v.summary:''}`:'';};picker.onchange=details;details();
   s.root.querySelector('[data-open]').disabled=false;s.root.querySelector('[data-open-archive]').disabled=!versions.length;
  }catch(e){if(active(s)&&s.epoch===epoch){s.message.textContent=e.message;s.root.querySelector('[data-open]').disabled=true;s.root.querySelector('[data-open-archive]').disabled=true;}}
 }
 async function render(shell,part=''){
  dispose();const [id,query='']=part.split('?');const params=new URLSearchParams(query);
  const owner=who().user?.id,s=session={owner,busy:false,dialog:null,selected:params.get('version')};
  if((id==='current'||validId(id))&&params.get('publish')==='1'&&who().role==='admin'){s.release=window.AIWisePublishedRelease.render(shell,{fromBeta:true});return;}
  if(id==='current'||validId(id)){
   shell(null,'AI-Wise Beta','', '<p role="status" data-preview-status>Loading preview…</p>',false);
   const container=document.getElementById('room');
   try{let draft=null,version=null;const review=await window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:id==='current'?null:id});if(id==='current')draft=review;if(id!=='current')version=await request(b=>b.from('workspace_beta_versions').select('*').eq('id',id).single());
    if(!active(s))return;
    if(id!=='current'&&(!version||version.id!==id||!Array.isArray(version.content)))throw Error('This review version is not available.');
    preview={owner,version:version||{id:'current',content:draft.current_content}};container.replaceChildren();container.classList.add('beta-preview-page');
    const first=!params.has('page')&&!params.has('memo')&&!params.has('item')?window.AIWiseBetaChecklist.firstChange(review):null;
    const start=first?new URLSearchParams(window.AIWiseBetaChecklist.previewLink(version?.id,first).split('?')[1]):params;
    window.AIWiseBetaReview.open('',()=>{location.hash='#beta';},{container,version,draft,review,initialPage:start.get('page'),memo:params.get('memo'),item:start.get('item'),scope:start.get('scope')});
   }catch(e){if(active(s)){const status=container.querySelector('[data-preview-status]')||container.appendChild(document.createElement('p'));status.textContent=e.message;const a=document.createElement('a');a.href='#beta';a.className='button';a.textContent='Back to review versions';container.append(a);}}return;
  }
  shell(null,'AI-Wise Beta','',`<p class="room-lead">Review approved changes here before they reach students.</p><div class="beta-space beta-home-simple"><section class="beta-current"><div><span class="beta-eyebrow">READY FOR TEAM REVIEW</span><h2>Current review</h2><p>Studio approvals collect here. Open the preview to check changes and leave feedback.</p><p class="beta-review-summary" data-current-summary role="status"></p><small data-current-baseline></small></div><div class="beta-current-actions"><button type="button" class="button primary" data-open disabled>Open preview →</button>${who().role==='admin'?'<a class="button" href="#beta/current?publish=1">Publish…</a>':''}<button type="button" class="beta-text-action" data-refresh>Refresh</button></div></section><p role="status" data-space-message></p><details class="beta-archive"><summary data-version-count>Earlier versions</summary><p data-archive-empty hidden>No earlier versions yet.</p><div data-archive-controls><label for="beta-version">Version</label><div class="beta-version-choice"><select id="beta-version" data-version></select><button type="button" class="button" data-open-archive disabled>Open version →</button></div><p class="beta-version-info" data-version-info></p></div></details></div>`,false);
  document.getElementById('room-title')?.focus();
  s.root=document.querySelector('.beta-space');s.message=s.root.querySelector('[data-space-message]');
  s.root.querySelector('[data-open]').onclick=()=>{const page=['c1','c2','c3'].includes(id)?`common/aiwise-${id}-final.html?course=aws1`:null;location.hash='#beta/current'+(page?'?page='+encodeURIComponent(page):'');};
  s.root.querySelector('[data-open-archive]').onclick=()=>{const selected=s.root.querySelector('[data-version]').value;if(validId(selected))location.hash='#beta/'+selected;};
  s.root.querySelector('[data-refresh]').onclick=()=>load(s);await load(s);
 }
 function snapshot(id,course,locale){
  if(!preview||preview.version?.id!==id||who().user?.id!==preview.owner||!['member','checking'].includes(who().status))throw Error('This review version is not available.');
  const rows=preview.version.content.filter(r=>r.course===course&&r.locale===locale);
  if(locale==='nl')for(const english of preview.version.content.filter(r=>r.course===course&&r.locale==='en'))if(!rows.some(r=>r.chapter===english.chapter))rows.push({...english,locale:'nl',fallback_locale:'en'});
  return JSON.parse(JSON.stringify(rows));
 }
 function dispose(){const s=session;session=null;preview=null;s?.release?.();s?.dialog?.close();s?.dialog?.remove();document.getElementById('room')?.classList.remove('beta-preview-page');}
 window.AIWiseBetaSpace=Object.freeze({render,dispose,snapshot,canLeave:()=>!session?.busy&&!session?.dialog});
})();
