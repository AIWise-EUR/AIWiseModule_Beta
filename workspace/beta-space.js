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
 const link=row=>'#beta/'+(row.version_id||'current')+'?page='+encodeURIComponent(row.page)+'&memo='+row.id;
 function feedbackItem(row){return `<a class="beta-feed-item" href="${esc(link(row))}"><strong>${esc(row.author_name)}</strong><span>${esc(row.body.slice(0,160))}</span><small>${date(row.created_at)} · ${row.resolved?'Resolved':'Open'}</small></a>`;}
 async function load(s){
  const epoch=s.epoch=(s.epoch||0)+1;s.message.textContent='Loading review space…';
  try{
   const [versions,recent,mentions,replies]=await Promise.all([
    request(b=>b.from('workspace_beta_versions').select('id,number,title,summary,author_name,created_at').order('number',{ascending:false}).range(0,199)),
    request(b=>b.from('workspace_beta_memos').select('id,page,version_id,author_name,body,resolved,created_at').order('created_at',{ascending:false}).limit(8)),
    request(b=>b.from('workspace_beta_memos').select('id,page,version_id,author_name,body,resolved,created_at').contains('mentions',[s.owner]).order('created_at',{ascending:false}).limit(10)),
    request(b=>b.from('workspace_beta_replies').select('id,body,author_name,created_at,workspace_beta_memos!inner(id,page,version_id,resolved)').contains('mentions',[s.owner]).order('created_at',{ascending:false}).limit(10))
   ]);if(!active(s)||s.epoch!==epoch)return;
   s.message.textContent='';s.versions=versions;
   const picker=s.root.querySelector('[data-version]');picker.innerHTML='<option value="current">Current approved Beta</option>'+versions.map(v=>`<option value="${v.id}">V${v.number} · ${esc(v.title)}</option>`).join('');
   if(versions.length)picker.value=versions[0].id;
   if(s.selected&& (s.selected==='current'||versions.some(v=>v.id===s.selected)))picker.value=s.selected;
   const details=()=>{s.selected=picker.value;const chosen=s.selected,release=s.root.querySelector('[data-version-release]');
    if(release){release.textContent=chosen==='current'?'Save a review version before publishing.':who().role==='admin'?'Checking publication status…':'An administrator publishes this saved version after review.';
     if(chosen!=='current'&&who().role==='admin')request(b=>b.from('workspace_releases').select('status,deployment_status').eq('version_id',chosen).order('number',{ascending:false}).limit(1)).then(rows=>{if(!active(s)||s.epoch!==epoch||s.selected!==chosen)return;const row=rows[0];release.textContent=!row?'No release prepared for this version.':row.status==='committed'?({success:'Published to students',building:'Publishing · deployment in progress',pending:'Publishing · waiting for deployment',failure:'Deployment needs attention',unknown:'Publication is not confirmed yet'}[row.deployment_status]||'Publication is not confirmed yet'):({prepared:'Release prepared · awaiting Publish approval',queued:'Publish approved · queued',processing:'Publishing…',failed:'Publishing needs attention'}[row.status]||'Publication status unavailable');}).catch(()=>{if(active(s)&&s.selected===chosen)release.textContent='Publication status unavailable. Open Publish this version to retry.';});
    }s.checklist?.();const review=s.root.querySelector('[data-review-checklist]');if(review&&window.AIWiseBetaChecklist)s.checklist=window.AIWiseBetaChecklist.mount(review,picker.value==='current'?null:picker.value);const publish=s.root.querySelector('[data-version-publish]');if(publish){publish.hidden=picker.value==='current';publish.href='#beta/'+picker.value+'?publish=1';}const v=versions.find(v=>v.id===picker.value);s.root.querySelector('[data-version-info]').textContent=v?`${date(v.created_at)} · ${v.author_name}${v.summary?' — '+v.summary:''}`:'Latest approved content. Earlier feedback is kept here.';};picker.onchange=details;details();
   s.root.querySelector('[data-open]').disabled=false;
   const approved=s.root.querySelector('[data-approved-updates]');
   if(approved&&window.AIWiseBetaChecklist)window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:null}).then(data=>{
    if(!active(s)||s.epoch!==epoch)return;approved.replaceChildren();
    if(data.previous_number&&data.changes.length){approved.hidden=false;const text=document.createElement('p');text.textContent=data.changes.length+(data.changes.length===1?' approved Beta item differs from V':' approved Beta items differ from V')+data.previous_number+'. Create a new review version to publish these updates.';const action=document.createElement('button');action.type='button';action.className='button';action.textContent='Review latest approved changes';action.onclick=()=>{picker.value='current';details();};approved.append(text,action);}
    else approved.hidden=true;
   }).catch(()=>{if(active(s)&&s.epoch===epoch){approved.hidden=false;approved.textContent='Latest approved changes could not be checked. Use Refresh to retry.';}});
   s.root.querySelector('[data-version-count]').textContent=versions.length?`${versions.length}${versions.length===200?'+':''} saved review ${versions.length===1?'version':'versions'}`:'No saved versions yet. An administrator can create the first review version.';
   s.root.querySelector('[data-recent]').innerHTML=recent.map(feedbackItem).join('')||'<p class="br-empty">No feedback yet. Open a version to start a review.</p>';
   const tagged=[...mentions,...replies.map(r=>({...r,...r.workspace_beta_memos,body:r.body,created_at:r.created_at,author_name:r.author_name}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,10);
   s.root.querySelector('[data-mentions]').innerHTML=tagged.map(feedbackItem).join('')||'<p class="br-empty">When a teammate mentions you, their memo will appear here.</p>';
  }catch(e){if(active(s)&&s.epoch===epoch){s.message.textContent=e.message;s.root.querySelector('[data-open]').disabled=true;}}
 }
 function create(s){
  if(who().role!=='admin')return;
  const d=document.createElement('dialog');d.className='team-dialog';d.setAttribute('aria-labelledby','beta-create-title');
  d.innerHTML='<form><h2 id="beta-create-title">New review version</h2><p>Save the currently approved content for a focused team review. Later edits will stay separate.</p><label for="beta-version-name">Version name</label><input id="beta-version-name" maxlength="100" required placeholder="For example: October review"><label for="beta-version-summary">What should the team review?</label><textarea id="beta-version-summary" rows="3" maxlength="2000"></textarea><p role="alert"></p><div class="toolbar"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Create version</button></div></form>';
  document.body.append(d);s.dialog=d;let id=crypto.randomUUID(),last='';
  const close=()=>{if(s.busy)return;d.close();d.remove();s.dialog=null;};d.querySelector('[data-cancel]').onclick=close;d.oncancel=e=>{e.preventDefault();close();};
  d.querySelector('form').onsubmit=async e=>{e.preventDefault();if(s.busy)return;s.busy=true;d.querySelector('[role=alert]').textContent='Saving review version…';d.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=true);
   const title=d.querySelector('input').value.trim(),summary=d.querySelector('textarea').value.trim(),key=JSON.stringify([title,summary]);if(last&&last!==key)id=crypto.randomUUID();last=key;
   try{await request(b=>b.rpc('workspace_create_beta_version',{p_id:id,p_title:title,p_summary:summary}));if(!active(s))return;s.busy=false;close();await load(s);if(active(s)){s.root.querySelector('[data-version]').value=id;s.root.querySelector('[data-version]').onchange();}}
   catch(e){if(active(s)){d.querySelector('[role=alert]').textContent=e.message;d.querySelectorAll('input,textarea,button').forEach(n=>n.disabled=false);}}finally{if(active(s))s.busy=false;}
  };d.showModal();d.querySelector('input').focus();
 }
 async function render(shell,part=''){
  dispose();const [id,query='']=part.split('?');const params=new URLSearchParams(query);
  const owner=who().user?.id,s=session={owner,busy:false,dialog:null,selected:params.get('version')};
  if(validId(id)&&params.get('publish')==='1'&&who().role==='admin'){s.release=window.AIWisePublishedRelease.render(shell,{versionId:id,fromBeta:true});return;}
  if(id==='current'||validId(id)){
   shell(null,'AI-Wise Beta','', '<p role="status" data-preview-status>Loading preview…</p>',false);
   const container=document.getElementById('room');
   try{let version=null;if(id!=='current')version=await request(b=>b.from('workspace_beta_versions').select('*').eq('id',id).single());
    if(!active(s))return;
    if(id!=='current'&&(!version||version.id!==id||!Array.isArray(version.content)))throw Error('This review version is not available.');
    preview={owner,version};container.replaceChildren();container.classList.add('beta-preview-page');
    window.AIWiseBetaReview.open('',()=>{location.hash='#beta';},{container,version,initialPage:params.get('page'),memo:params.get('memo'),item:params.get('item'),scope:params.get('scope')});
   }catch(e){if(active(s)){container.querySelector('[data-preview-status]').textContent=e.message;const a=document.createElement('a');a.href='#beta';a.className='button';a.textContent='Back to review versions';container.append(a);}}return;
  }
  shell(null,'AI-Wise Beta','',`<p class="room-lead">Review changes with the team, then publish the selected version.</p><div class="beta-space"><ol class="beta-flow"><li><strong>1 · Approved</strong><span>Studio → Beta</span></li><li><strong>2 · Review</strong><span>Check this saved version</span></li><li><strong>3 · Publish</strong><span>Release to students</span></li></ol><aside class="beta-approved-updates" data-approved-updates hidden></aside><section class="beta-version-card"><div class="beta-section-heading"><h2>Review versions</h2>${who().role==='admin'?'<div class="toolbar"><a class="button primary" data-version-publish hidden>Publish this version →</a><button type="button" class="button" data-create>New review version</button></div>':''}</div><p data-version-count></p><label for="beta-version">Version</label><div class="beta-version-choice"><select id="beta-version" data-version><option>Loading versions…</option></select><button type="button" class="button primary" data-open disabled>Open preview →</button></div><p class="beta-version-info" data-version-info></p><p class="beta-review-summary" data-version-release role="status"></p><p role="status" data-space-message></p><button type="button" class="button" data-refresh>Refresh</button></section><div data-review-checklist></div><div class="beta-feed-grid"><section><h2>Recent feedback</h2><div data-recent></div></section><section><h2>Mentioned you</h2><div data-mentions></div></section></div></div>`,false);
  document.getElementById('room-title')?.focus();
  s.root=document.querySelector('.beta-space');s.message=s.root.querySelector('[data-space-message]');
  s.root.querySelector('[data-open]').onclick=()=>{const page=['c1','c2','c3'].includes(id)?`common/aiwise-${id}-final.html?course=aws1`:null;location.hash='#beta/'+s.root.querySelector('[data-version]').value+(page?'?page='+encodeURIComponent(page):'');};
  s.root.querySelector('[data-refresh]').onclick=()=>load(s);s.root.querySelector('[data-create]')?.addEventListener('click',()=>create(s));await load(s);
 }
 function snapshot(id,course,locale){
  if(!preview||preview.version?.id!==id||who().user?.id!==preview.owner||!['member','checking'].includes(who().status))throw Error('This review version is not available.');
  const rows=preview.version.content.filter(r=>r.course===course&&r.locale===locale);
  if(locale==='nl')for(const english of preview.version.content.filter(r=>r.course===course&&r.locale==='en'))if(!rows.some(r=>r.chapter===english.chapter))rows.push({...english,locale:'nl',fallback_locale:'en'});
  return JSON.parse(JSON.stringify(rows));
 }
 function dispose(){const s=session;session=null;preview=null;s?.checklist?.();s?.release?.();s?.dialog?.close();s?.dialog?.remove();document.getElementById('room')?.classList.remove('beta-preview-page');}
 window.AIWiseBetaSpace=Object.freeze({render,dispose,snapshot,canLeave:()=>!session?.busy&&!session?.dialog});
})();
