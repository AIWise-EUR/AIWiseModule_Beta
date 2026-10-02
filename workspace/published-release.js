/* Prepare accumulated approvals; only final Publish allocates an immutable numbered version. */
(() => {
 'use strict';
 const repo='https://github.com/AIWise-EUR/AI-Wise',site='https://aiwise-eur.github.io/AI-Wise/';
 const fields='id,number,version_id,version_number,version_title,source_sha,target_sha,status,commit_sha,error_code,deployment_status,deployment_run_id,created_at,candidate_fingerprint';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const versionName=r=>/^V\d+_\d{4}-\d{2}-\d{2}$/.test(r.version_title||'')?r.version_title:'V'+r.version_number+' · '+r.version_title;
 const valid=id=>/^[a-f0-9-]{36}$/.test(id||'');
 const messages={21000:'Publication approval could not finish. Apply the latest publish-approval setup, then retry.',github_secrets_missing:'The GitHub connection is missing its app credentials. In Supabase → Edge Functions → Secrets, check AIWISE_GITHUB_CLIENT_ID and AIWISE_GITHUB_PRIVATE_KEY.',invalid_private_key:'The GitHub private key could not be read. Check that AIWISE_GITHUB_PRIVATE_KEY contains the complete RSA PEM, including the BEGIN and END lines.',runtime_configuration_missing:'The publishing service is missing its server configuration. Check the Supabase function settings.',database_unavailable:'The publishing service could not complete its database request. Check the release setup and retry.',github_permission_or_rate_limit:'GitHub refused the request. Check the app permissions and GitHub rate limits.',github_unavailable:'The publishing service could not connect to GitHub. Check the app connection and retry.',sign_in_required:'Your session could not be verified. Sign in again before preparing the release.',administrator_required:'An active administrator account is required to publish.',approved_content_changed:'New changes were approved. Refresh the review checklist and prepare the release again.',40001:'New changes were approved or this cycle was published. Refresh and prepare again.',55000:'Another release is still publishing. Wait for it to finish.',22023:'This preparation belongs to the earlier workflow. Prepare the next release again.',version_structure_changed:'The content structure changed. Review the updated Beta content before preparing again.',incomplete_version:'Approved content is incomplete. Check the Studio content.',source_schema_outdated:'The module layout changed. The release setup needs updating.',github_installation_unavailable:'Check that the GitHub App can access both repositories.',publishing_not_enabled:'Student publishing is not enabled yet.',source_file_unavailable:'The release files are not available yet.'};

 const icons=[
  '<path d="M7 3h10v4h3v14H4V7h3V3Zm0 4h10M8 12h8M8 16h5"/>',
  '<circle cx="7" cy="5" r="2"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="7" r="2"/><path d="M7 7v10M17 9v2a6 6 0 0 1-6 6H7"/>',
  '<path d="M3 5h18v13H3V5Zm0 4h18M8 22h8M12 18v4"/>'
 ];
 const icon=i=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[i]}</svg>`;
 function render(shell,options={}){
  const owner=window.AIWiseAuth.snapshot().user?.id;
  let disposed=false,busy=false,operation='',timer,dialog,client,rows=[],enabled=false,requestId=crypto.randomUUID(),epoch=0,review=null,actionError='',intent=null;
  const current=()=>{const a=window.AIWiseAuth.snapshot();return !disposed&&a.status==='member'&&a.role==='admin'&&a.user?.id===owner;};
  shell(options.fromBeta?null:'tower','Publish to students','',`<div class="toolbar release-navigation"><a class="button" href="#beta/current">← Back to preview</a><a class="button" href="${site}" target="_blank" rel="noopener noreferrer">Student site ↗</a></div><div class="published-release" data-release-root><section class="release-main" aria-labelledby="release-state-title"><div class="release-heading"><span class="beta-eyebrow">BETA → STUDENT SITE</span><button class="beta-text-action" data-refresh>Refresh status</button></div><h2 id="release-state-title" data-state-title>Checking publication status…</h2><p class="release-explanation" data-state-description></p><ol class="release-steps" aria-label="Publication progress" data-steps></ol><p data-release-review class="beta-review-summary"></p><div data-current-release></div><div class="toolbar release-main-actions"><button class="button primary" data-prepare disabled>Review publication →</button></div><p role="status" data-release-message></p></section><details class="release-history"><summary>Publication history <span data-history-count></span></summary><div data-release-list></div></details></div>`,false);
  const root=document.querySelector('[data-release-root]'),q=s=>root.querySelector(s),message=q('[data-release-message]'),prepare=q('[data-prepare]'),refresh=q('[data-refresh]'),list=q('[data-release-list]');
  const stale=r=>!r?.candidate_fingerprint||r.candidate_fingerprint!==review?.fingerprint;
  const running=r=>['queued','processing'].includes(r.status)||(r.status==='committed'&&['pending','building'].includes(r.deployment_status));
  // Prepared candidates are working copies, not publication history. Reuse one matching copy.
  function selected(){const latest=rows.find(r=>r.version_id);return rows.find(running)||rows.find(r=>r.status==='prepared'&&!stale(r))||(latest&&(latest.status==='failed'||!review?.changes?.length)?latest:null);}
  function state(r){
   if(operation==='prepare')return {title:'Checking your publication…',text:'Collecting the reviewed content and checking the student site. Nothing is public yet.',stage:0,working:true};
   if(operation==='approve')return {title:'Confirming publication…',text:'Saving this version and starting publication. Keep this page open for the result.',stage:0,working:true};
   if(r?.status==='prepared')return {title:'Ready for your final approval',text:'The publication copy is ready. Students will see it only after you confirm Publish to students.',stage:0};
   if(r?.status==='queued'||r?.status==='processing')return {title:r.status==='queued'?'Publication queued':'Sending the update to GitHub…',text:r.error_code?'The last attempt did not finish. Automatic retry is scheduled; the student site has not been confirmed as updated.':'Your approval is saved. This version is being sent to the student site repository.',stage:1,working:true};
   if(r?.status==='failed')return {title:'Publication needs attention',text:r.error_code==='published_changed'?'The student site changed after this copy was prepared. Review a fresh publication copy before trying again.':messages[r.error_code]||'The update could not be committed. Check the connection, then retry publication.',stage:1,failed:true};
   if(r?.status==='committed'){
    if(r.deployment_status==='success')return {title:'Live on the student site',text:'The GitHub update and website deployment both completed.',stage:3};
    if(r.deployment_status==='failure')return {title:'Website deployment needs attention',text:'The GitHub commit succeeded, but the website deployment failed. Open deployment details to inspect the failure.',stage:2,failed:true};
    if(r.deployment_status==='unknown')return {title:'Website deployment is not confirmed',text:'The GitHub commit succeeded. Check deployment details before treating the website as updated.',stage:2};
    return {title:'Updating the student website…',text:'The GitHub commit succeeded. GitHub Pages is building and deploying the website; the existing site stays visible until it finishes.',stage:2,working:true};
   }
   return {title:'Review before publishing',text:'Check the publication copy, then confirm that it should go live for students. Reviewing the copy does not publish it.',stage:0};
  }
  function controls(){const r=selected();prepare.disabled=busy||!enabled||!review?.fingerprint||!!r&&running(r);refresh.disabled=busy;root.querySelectorAll('[data-approve]').forEach(n=>n.disabled=busy||!enabled||stale(rows.find(r=>r.id===n.dataset.approve)));root.querySelectorAll('[data-retry]').forEach(n=>n.disabled=busy||!enabled);}
  function links(r){return `${SHA(r.commit_sha)?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/commit/${r.commit_sha}">View GitHub commit ↗</a>`:''}${Number.isSafeInteger(r.deployment_run_id)&&r.deployment_run_id>0?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/actions/runs/${r.deployment_run_id}">Deployment details ↗</a>`:''}${r.status==='committed'&&r.deployment_status==='success'?`<a class="button primary" target="_blank" rel="noopener noreferrer" href="${site}">Open student site ↗</a>`:''}`;}
  const SHA=v=>/^[a-f0-9]{40}$/.test(v||'');
  function draw(){
   if(!current())return;const r=selected(),view=state(r);q('[data-state-title]').textContent=view.title;q('[data-state-description]').textContent=view.text;
   q('.release-main').setAttribute('aria-busy',String(busy));
   q('[data-steps]').innerHTML=['Review & confirm','GitHub update','Website live'].map((label,i)=>`<li class="${i<view.stage?'is-done':i===view.stage?(view.failed?'is-failed':view.working?'is-working':'is-current'):''}" ${i===view.stage?'aria-current="step"':''}><span class="release-step-icon">${i<view.stage?'<span aria-hidden="true">✓</span>':icon(i)}</span><strong>${label}</strong><small>${i<view.stage?'Complete':i===view.stage?(view.failed?'Needs attention':view.working?'In progress':'Current step'):'Waiting'}</small></li>`).join('');
   const version=r?.version_id?`<p class="release-version">${esc(versionName(r))}</p>`:'';
   q('[data-current-release]').innerHTML=r?version+`<div class="toolbar">${r.status==='prepared'?`<button class="button primary" data-approve="${esc(r.id)}">Publish to students</button>`:''}${r.status==='failed'&&r.error_code!=='published_changed'?`<button class="button primary" data-retry="${esc(r.id)}">Retry publication</button>`:''}${links(r)}</div>`:'';
   prepare.hidden=!!r&&!(r.status==='failed'&&r.error_code==='published_changed');prepare.textContent=operation==='prepare'?'Checking publication…':'Review publication →';
   const published=rows.filter(r=>r.version_id);q('[data-history-count]').textContent=`(${published.length})`;
   list.innerHTML=published.length?published.map(r=>`<article class="release-history-row"><div><h3>${esc(versionName(r))}</h3><p>${esc(state(r).title)}</p></div><div class="toolbar"><a class="button" href="#beta/${esc(r.version_id)}">Review version</a>${links(r)}</div></article>`).join(''):'<p>No publications yet. Prepared copies appear above until you approve publication.</p>';
   controls();
  }
  async function query(make){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const result=await make(client).abortSignal(controller.signal);if(result.error)throw result.error;return result.data;}finally{clearTimeout(timeout);}}
  async function load(){
   if(!current()||busy||dialog)return;clearTimeout(timer);const generation=++epoch;
   try{
    client=await window.AIWiseBackend.getClient();if(!current())return;
    const [setting,r,context]=await Promise.all([query(c=>c.rpc('workspace_release_status')),query(c=>c.from('workspace_releases').select(fields).order('number',{ascending:false}).limit(50)),query(c=>c.rpc('workspace_beta_review_context',{p_version:null}))]);
    if(!current()||generation!==epoch)return;
    enabled=setting===true;rows=r.filter(r=>valid(r.id));review=context;const confirmed=intent&&rows.find(r=>r.id===intent.id&&(intent.kind==='prepare'||r.status!=='prepared'));if(confirmed){actionError='';intent=null;}if(!review?.fingerprint)throw {code:'PGRST202'};
    const p=window.AIWiseBetaChecklist.progress(review);q('[data-release-review]').textContent=`${p.reviewed} of ${p.total} changes reviewed · ${p.open} open memos`;
    message.textContent=!enabled?'Student publishing is not enabled yet.':actionError;draw();
   }catch(e){if(current()&&generation===epoch){enabled=false;controls();message.textContent=['PGRST202','PGRST205','42P01','42883','42703'].includes(e?.code)?'Publish-based version setup is not ready yet.':'Release status could not be loaded. Refresh to retry.';}}
   finally{if(current())timer=setTimeout(load,15000);else root.replaceChildren();}
  }
  async function run(kind,action){
   if(!current()||busy||!enabled)return false;busy=true;operation=kind;epoch++;clearTimeout(timer);actionError='';message.textContent='';draw();let success=false;
   try{await action();success=current();}
   catch(e){if(current()){actionError=messages[e?.code]||'The request could not be confirmed. Refresh the status before retrying.';message.textContent=actionError;}}
   finally{busy=false;operation='';if(current()){await load();}else root.replaceChildren();}return success;
  }
  function confirmPublication(row){
   if(!current()||busy||dialog||stale(row)||row.status!=='prepared')return;
   const p=window.AIWiseBetaChecklist.progress(review);dialog=document.createElement('dialog');dialog.className='team-dialog release-confirm';dialog.setAttribute('aria-labelledby','release-confirm-title');
   dialog.innerHTML=`${icon(2)}<h2 id="release-confirm-title">Publish this content to students?</h2><p>This updates the official AI-Wise student website and saves a numbered, dated version.</p><p class="beta-review-summary">${p.reviewed} of ${p.total} changes reviewed · ${p.open} open memos</p><p>${p.reviewed===p.total&&!p.open?'All changes are reviewed. Ready for your final approval.':'There are outstanding review items. You can return to the preview before publishing.'}</p><div class="toolbar"><button class="button" data-cancel>Not yet</button><button class="button primary" data-confirm>Publish to students</button></div>`;
   document.body.append(dialog);const close=()=>{dialog?.close();dialog?.remove();dialog=null;q('[data-approve]')?.focus();timer=setTimeout(load,15000);};dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
   dialog.querySelector('[data-confirm]').onclick=()=>{close();run('approve',()=>{intent={kind:'approve',id:row.id};return query(c=>c.rpc('workspace_approve_release',{p_id:row.id}));});};clearTimeout(timer);dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  }
  refresh.onclick=()=>load();
  prepare.onclick=async()=>{
   const r=selected();if(r?.status==='prepared'){confirmPublication(r);return;}if(r&&running(r))return;
   const success=await run('prepare',async()=>{
    intent={kind:'prepare',id:requestId};const {data,error}=await client.functions.invoke('aiwise-release',{body:{operation:'prepare',id:requestId,fingerprint:review.fingerprint}});
    if(error){let code;try{code=(await error.context.json()).code;}catch{}throw {code};}if(!data?.ok)throw {code:data?.code};
    requestId=crypto.randomUUID();
   });if(success){const ready=selected();if(ready?.status==='prepared')confirmPublication(ready);}
  };
  root.addEventListener('click',e=>{
   const approve=e.target.closest('[data-approve]'),retry=e.target.closest('[data-retry]');if(!current()||busy||!enabled)return;
   if(retry){run('approve',()=>query(c=>c.rpc('workspace_retry_release',{p_id:retry.dataset.retry})));return;}
   if(approve){const r=rows.find(r=>r.id===approve.dataset.approve);if(r)confirmPublication(r);}
  });
  load();return ()=>{disposed=true;epoch++;clearTimeout(timer);dialog?.close();dialog?.remove();root.replaceChildren();};
 }
 window.AIWisePublishedRelease=Object.freeze({render});
})();
