/* Prepare accumulated approvals; only final Publish allocates an immutable numbered version. */
(() => {
 'use strict';
 const repo='https://github.com/AIWise-EUR/AI-Wise',site='https://aiwise-eur.github.io/AI-Wise/';
 const fields='id,number,version_id,version_number,version_title,source_sha,target_sha,status,commit_sha,error_code,deployment_status,deployment_run_id,created_at,candidate_fingerprint';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=id=>/^[a-f0-9-]{36}$/.test(id||'');
 const messages={github_secrets_missing:'The GitHub connection is missing its app credentials. In Supabase → Edge Functions → Secrets, check AIWISE_GITHUB_CLIENT_ID and AIWISE_GITHUB_PRIVATE_KEY.',invalid_private_key:'The GitHub private key could not be read. Check that AIWISE_GITHUB_PRIVATE_KEY contains the complete RSA PEM, including the BEGIN and END lines.',runtime_configuration_missing:'The publishing service is missing its server configuration. Check the Supabase function settings.',database_unavailable:'The publishing service could not complete its database request. Check the release setup and retry.',github_permission_or_rate_limit:'GitHub refused the request. Check the app permissions and GitHub rate limits.',github_unavailable:'The publishing service could not connect to GitHub. Check the app connection and retry.',sign_in_required:'Your session could not be verified. Sign in again before preparing the release.',administrator_required:'An active administrator account is required to publish.',approved_content_changed:'New changes were approved. Refresh the review checklist and prepare the release again.',40001:'New changes were approved or this cycle was published. Refresh and prepare again.',55000:'Another release is still publishing. Wait for it to finish.',22023:'This preparation belongs to the earlier workflow. Prepare the next release again.',version_structure_changed:'The content structure changed. Review the updated Beta content before preparing again.',incomplete_version:'Approved content is incomplete. Check the Studio content.',source_schema_outdated:'The module layout changed. The release setup needs updating.',github_installation_unavailable:'Check that the GitHub App can access both repositories.',publishing_not_enabled:'Student publishing is not enabled yet.',source_file_unavailable:'The release files are not available yet.'};
 function render(shell,options={}){
  const owner=window.AIWiseAuth.snapshot().user?.id;
  let disposed=false,busy=false,timer,dialog,client,rows=[],enabled=false,requestId=crypto.randomUUID(),epoch=0,review=null,actionError='';
  const current=()=>{const a=window.AIWiseAuth.snapshot();return !disposed&&a.status==='member'&&a.role==='admin'&&a.user?.id===owner;};
  shell(options.fromBeta?null:'tower','Publish to students','',`<div class="toolbar"><a class="button" href="#beta/current">← Review changes</a><a class="button" href="#beta/current">Open next-release preview</a><a class="button" href="${site}" target="_blank" rel="noopener noreferrer">Student site ↗</a></div><div class="published-release" data-release-root><section class="ct-detail-section"><h2>Next release</h2><p>Studio approvals accumulate here. Prepare the reviewed content, then Publish to create its numbered, dated version.</p><p data-release-review class="beta-review-summary"></p><div class="toolbar"><button class="button primary" data-prepare disabled>Prepare next release</button><button class="button" data-refresh>Refresh status</button></div><p role="status" data-release-message></p></section><div data-release-list></div></div>`,false);
  const root=document.querySelector('[data-release-root]'),message=root.querySelector('[data-release-message]'),prepare=root.querySelector('[data-prepare]'),refresh=root.querySelector('[data-refresh]'),list=root.querySelector('[data-release-list]');
  const stale=r=>!r.candidate_fingerprint||r.candidate_fingerprint!==review?.fingerprint;
  function controls(){prepare.disabled=busy||!enabled||!review?.fingerprint;refresh.disabled=busy;root.querySelectorAll('[data-approve]').forEach(n=>n.disabled=busy||!enabled||stale(rows.find(r=>r.id===n.dataset.approve)));root.querySelectorAll('[data-retry]').forEach(n=>n.disabled=busy||!enabled);}
  const label=r=>r.status==='committed'?({pending:'Committed · waiting for deployment',building:'Deployment in progress',success:'Deployed to students',failure:'Deployment failed · open details',unknown:'Committed · deployment not confirmed'}[r.deployment_status]||'Committed'):({prepared:stale(r)?'New approvals or a publication changed this copy · prepare again':'Prepared · no version number assigned yet',queued:'Version created · Publish queued',processing:'Publishing…',failed:r.error_code==='published_changed'?'The student site changed. Prepare a new release.':'Publish failed. Check the connection and retry.'}[r.status]||'Status unavailable');
  const title=r=>r.version_id?`V${r.version_number} · ${r.version_title}`:'Next release · prepared '+r.created_at?.slice(0,10);
  function draw(){
   list.innerHTML='<h2>Publication history</h2>'+(rows.length?rows.map(r=>`<section class="ct-detail-section" data-release-id="${esc(r.id)}"><h3>${esc(title(r))}</h3><p>${esc(label(r))}</p><div class="toolbar"><a class="button" href="#beta/${esc(r.version_id||'current')}">${r.version_id?'Open frozen version':'Review next release'}</a>${r.status==='prepared'?'<button class="button primary" data-approve="'+esc(r.id)+'">Publish to students</button>':''}${r.status==='failed'&&r.error_code!=='published_changed'?'<button class="button" data-retry="'+esc(r.id)+'">Retry publish</button>':''}${/^[a-f0-9]{40}$/.test(r.commit_sha||'')?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/commit/${r.commit_sha}">View commit ↗</a>`:''}${Number.isSafeInteger(r.deployment_run_id)&&r.deployment_run_id>0?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/actions/runs/${r.deployment_run_id}">Deployment details ↗</a>`:''}${r.status==='committed'&&r.deployment_status==='success'?`<a class="button" target="_blank" rel="noopener noreferrer" href="${site}">Open student site ↗</a>`:''}</div><details><summary>Release details</summary><p>Prepared ${esc(new Date(r.created_at).toLocaleString())}. ${r.version_id?'The numbered content is frozen.':'The number and date will be assigned when you confirm Publish (UTC).'}</p><p>Source: ${esc(r.source_sha?.slice(0,8))} · Student site before release: ${esc(r.target_sha?.slice(0,8))}</p></details></section>`).join(''):'<p>No publications yet.</p>');controls();
  }
  async function query(make){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const result=await make(client).abortSignal(controller.signal);if(result.error)throw result.error;return result.data;}finally{clearTimeout(timeout);}}
  async function load(){
   if(!current()||busy||dialog)return;clearTimeout(timer);const generation=++epoch;
   try{
    client=await window.AIWiseBackend.getClient();if(!current())return;
    const [setting,r,context]=await Promise.all([query(c=>c.rpc('workspace_release_status')),query(c=>c.from('workspace_releases').select(fields).order('number',{ascending:false}).limit(50)),query(c=>c.rpc('workspace_beta_review_context',{p_version:null}))]);
    if(!current()||generation!==epoch)return;
    enabled=setting===true;rows=r.filter(r=>valid(r.id));review=context;
    if(!review?.fingerprint)throw {code:'PGRST202'};
    const p=window.AIWiseBetaChecklist.progress(review);root.querySelector('[data-release-review]').textContent=(review.previous_number?'Since V'+review.previous_number+(review.previous_kind==='snapshot'?' (review snapshot)':'')+': ':'First publication: ')+p.reviewed+' of '+p.total+' items reviewed · '+p.open+' open memos';
    message.textContent=!enabled?'Student publishing is not enabled yet.':actionError;draw();
   }catch(e){if(current()&&generation===epoch){enabled=false;controls();message.textContent=['PGRST202','PGRST205','42P01','42883','42703'].includes(e?.code)?'Publish-based version setup is not ready yet.':'Release status could not be loaded. Refresh to retry.';}}
   finally{if(current())timer=setTimeout(load,15000);else root.replaceChildren();}
  }
  async function run(action){
   if(!current()||busy||!enabled)return;busy=true;epoch++;clearTimeout(timer);controls();actionError='';message.textContent='Saving…';
   try{await action();if(!current())return;}
   catch(e){if(current()){actionError=messages[e?.code]||'The request could not be confirmed. Refresh the status before retrying.';message.textContent=actionError;}}
   finally{busy=false;if(current()){controls();timer=setTimeout(load,15000);}else root.replaceChildren();}
  }
  refresh.onclick=()=>{requestId=crypto.randomUUID();load();};
  prepare.onclick=()=>run(async()=>{
   const {data,error}=await client.functions.invoke('aiwise-release',{body:{operation:'prepare',id:requestId,fingerprint:review.fingerprint}});
   if(error){let code;try{code=(await error.context.json()).code;}catch{}throw {code};}if(!data?.ok)throw {code:data?.code};
   if(current()){requestId=crypto.randomUUID();busy=false;await load();busy=true;}
  });
  list.onclick=e=>{
   const approve=e.target.closest('[data-approve]'),retry=e.target.closest('[data-retry]');if(!current()||busy||!enabled)return;
   if(retry){run(async()=>{await query(c=>c.rpc('workspace_retry_release',{p_id:retry.dataset.retry}));if(current()){busy=false;await load();busy=true;}});return;}
   if(!approve)return;const row=rows.find(r=>r.id===approve.dataset.approve&&r.status==='prepared');if(!row||stale(row))return;
   const p=window.AIWiseBetaChecklist.progress(review);dialog=document.createElement('dialog');dialog.className='team-dialog';dialog.setAttribute('aria-labelledby','release-confirm-title');
   dialog.innerHTML=`<h2 id="release-confirm-title">Publish the next release?</h2><p>This freezes the accumulated approved content, creates its version number and date, and sends it to the student site.</p><p>${p.reviewed} of ${p.total} items reviewed · ${p.open} open memos.</p><p>${p.reviewed===p.total&&!p.open?'Review checklist complete. Ready for your final approval.':'Check outstanding review items before approving.'}</p><p>Later Studio approvals will accumulate in the next release.</p><div class="toolbar"><button class="button" data-cancel>Cancel</button><button class="button primary" data-confirm>Publish to students</button></div>`;
   document.body.append(dialog);const close=()=>{dialog?.close();dialog?.remove();dialog=null;approve.focus();};dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
   dialog.querySelector('[data-confirm]').onclick=()=>{close();run(async()=>{await query(c=>c.rpc('workspace_approve_release',{p_id:row.id}));if(current()){busy=false;await load();busy=true;}});};dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  };
  load();return ()=>{disposed=true;epoch++;clearTimeout(timer);dialog?.close();dialog?.remove();root.replaceChildren();};
 }
 window.AIWisePublishedRelease=Object.freeze({render});
})();
