/* A saved review version is prepared first; only an explicit administrator action publishes it. */
(() => {
 'use strict';
 const repo='https://github.com/AIWise-EUR/AI-Wise',site='https://aiwise-eur.github.io/AI-Wise/';
 const fields='id,number,version_id,version_number,version_title,source_sha,target_sha,status,commit_sha,error_code,deployment_status,deployment_run_id,created_at';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=id=>/^[a-f0-9-]{36}$/.test(id||'');
 const messages={version_structure_changed:'This version uses a different content structure. Create and review a new Beta version before publishing.',incomplete_version:'This review version is incomplete. Create and review a new Beta version.',source_schema_outdated:'The module layout changed. Update the release schema before preparing this version.',github_installation_unavailable:'Check that the GitHub App can access both AI-Wise repositories.',publishing_not_enabled:'Student publishing is not enabled yet.',source_file_unavailable:'The release files are not available in the Beta repository yet.'};
 function render(shell){
  const owner=window.AIWiseAuth.snapshot().user?.id;
  let disposed=false,busy=false,timer,dialog,client,versions=[],rows=[],enabled=false,requestId=crypto.randomUUID(),epoch=0;
  const current=()=>{const a=window.AIWiseAuth.snapshot();return !disposed&&a.status==='member'&&a.role==='admin'&&a.user?.id===owner;};
  shell('tower','Publish to students','',`<div class="toolbar"><a class="button" href="#tower">← Control Tower</a><a class="button" href="#beta">Review versions</a><a class="button" href="${site}" target="_blank" rel="noopener noreferrer">Student site ↗</a></div><div class="published-release" data-release-root><section class="ct-detail-section"><h2>Prepare a release</h2><p>Choose a saved Beta version. Preparing keeps it ready for your final Publish approval.</p><label class="ct-field" for="release-version">Review version<select id="release-version" disabled><option value="">Loading versions…</option></select></label><div class="toolbar"><button class="button primary" data-prepare disabled>Prepare release</button><button class="button" data-refresh>Refresh status</button></div><p role="status" data-release-message></p></section><div data-release-list></div></div>`,false);
  const root=document.querySelector('[data-release-root]'),picker=root.querySelector('select'),message=root.querySelector('[data-release-message]'),prepare=root.querySelector('[data-prepare]'),refresh=root.querySelector('[data-refresh]'),list=root.querySelector('[data-release-list]');
  function controls(){picker.disabled=busy||!enabled||!versions.length;prepare.disabled=busy||!enabled||!versions.length;refresh.disabled=busy;root.querySelectorAll('[data-approve],[data-retry]').forEach(n=>n.disabled=busy||!enabled);}
  const label=r=>r.status==='committed'?({pending:'Committed · waiting for deployment',building:'Deployment in progress',success:'Deployed to students',failure:'Deployment failed · open details',unknown:'Committed · deployment not confirmed'}[r.deployment_status]||'Committed'):({prepared:'Ready for Publish approval',queued:'Publish approved · queued',processing:'Publishing…',failed:r.error_code==='published_changed'?'The student site changed. Prepare a new release.':'Publish failed. Check the connection and retry.'}[r.status]||'Status unavailable');
  function draw(){
   list.innerHTML='<h2>Releases</h2>'+ (rows.length?rows.map(r=>`<section class="ct-detail-section" data-release-id="${esc(r.id)}"><div class="beta-section-heading"><h3>V${esc(r.version_number)} · ${esc(r.version_title)}</h3><span class="ct-tag">Release ${esc(r.number)}</span></div><p>${esc(label(r))}</p><div class="toolbar"><a class="button" href="#beta/${esc(r.version_id)}">Review version</a>${r.status==='prepared'?'<button class="button primary" data-approve="'+esc(r.id)+'">Publish to students</button>':''}${r.status==='failed'&&r.error_code!=='published_changed'?'<button class="button" data-retry="'+esc(r.id)+'">Retry publish</button>':''}${/^[a-f0-9]{40}$/.test(r.commit_sha||'')?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/commit/${r.commit_sha}">View commit ↗</a>`:''}${Number.isSafeInteger(r.deployment_run_id)&&r.deployment_run_id>0?`<a class="button" target="_blank" rel="noopener noreferrer" href="${repo}/actions/runs/${r.deployment_run_id}">Deployment details ↗</a>`:''}${r.status==='committed'&&r.deployment_status==='success'?`<a class="button" target="_blank" rel="noopener noreferrer" href="${site}">Open student site ↗</a>`:''}</div><details><summary>Release details</summary><p>Prepared ${esc(new Date(r.created_at).toLocaleString())}. Content is frozen for this release.</p><p>Source: ${esc(r.source_sha?.slice(0,8))} · Student site before release: ${esc(r.target_sha?.slice(0,8))}</p></details></section>`).join(''):'<p>No releases prepared yet.</p>');controls();
  }
  async function query(make){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const result=await make(client).abortSignal(controller.signal);if(result.error)throw result.error;return result.data;}finally{clearTimeout(timeout);}}
  async function load(){
   if(!current()||busy)return;clearTimeout(timer);const generation=++epoch;
   try{
    client=await window.AIWiseBackend.getClient();if(!current())return;
    const [setting,v,r]=await Promise.all([query(c=>c.rpc('workspace_release_status')),query(c=>c.from('workspace_beta_versions').select('id,number,title').order('number',{ascending:false}).limit(200)),query(c=>c.from('workspace_releases').select(fields).order('number',{ascending:false}).limit(50))]);
    if(!current()||generation!==epoch)return;
    enabled=setting===true;versions=v.filter(v=>valid(v.id));rows=r.filter(r=>valid(r.id)&&valid(r.version_id));
    const selected=picker.value;picker.innerHTML=versions.length?versions.map(v=>`<option value="${v.id}">V${esc(v.number)} · ${esc(v.title)}</option>`).join(''):'<option value="">No saved versions yet</option>';
    picker.value=versions.some(v=>v.id===selected)?selected:versions[0]?.id||'';
    message.textContent=!enabled?'Student publishing is not enabled yet.':!versions.length?'Create a review version in Beta, then return here to prepare its release.':'';draw();
   }catch(e){if(current()&&generation===epoch){enabled=false;controls();message.textContent=['PGRST202','PGRST205','42P01','42883'].includes(e?.code)?'Student publishing setup is not ready yet.':'Release status could not be loaded. Refresh to retry.';}}
   finally{if(current())timer=setTimeout(load,15000);else root.replaceChildren();}
  }
  async function run(action){
   if(!current()||busy||!enabled)return;busy=true;epoch++;clearTimeout(timer);controls();message.textContent='Saving…';
   try{await action();if(!current())return;}
   catch(e){if(current())message.textContent=messages[e?.code]||'The request could not be confirmed. Refresh the status before retrying.';}
   finally{busy=false;if(current()){controls();timer=setTimeout(load,15000);}else root.replaceChildren();}
  }
  picker.onchange=()=>{requestId=crypto.randomUUID();};refresh.onclick=load;
  prepare.onclick=()=>run(async()=>{
   if(!versions.some(v=>v.id===picker.value))return;
   const {data,error}=await client.functions.invoke('aiwise-release',{body:{operation:'prepare',id:requestId,version_id:picker.value}});
   if(error){let code;try{code=(await error.context.json()).code;}catch{}throw {code};}
   if(!data?.ok)throw {code:data?.code};
   if(current()){requestId=crypto.randomUUID();busy=false;await load();busy=true;}
  });
  list.onclick=e=>{
   const approve=e.target.closest('[data-approve]'),retry=e.target.closest('[data-retry]');if(!current()||busy||!enabled)return;
   if(retry){run(async()=>{await query(c=>c.rpc('workspace_retry_release',{p_id:retry.dataset.retry}));if(current()){busy=false;await load();busy=true;}});return;}
   if(!approve)return;const row=rows.find(r=>r.id===approve.dataset.approve&&r.status==='prepared');if(!row)return;
   dialog=document.createElement('dialog');dialog.className='team-dialog';dialog.setAttribute('aria-labelledby','release-confirm-title');
   dialog.innerHTML=`<h2 id="release-confirm-title">Publish V${esc(row.version_number)}?</h2><p>${esc(row.version_title)}</p><p>This replaces the AI orientation content on the student site with this saved version.</p><div class="toolbar"><button class="button" data-cancel>Cancel</button><button class="button primary" data-confirm>Publish to students</button></div>`;
   document.body.append(dialog);const close=()=>{dialog?.close();dialog?.remove();dialog=null;approve.focus();};dialog.querySelector('[data-cancel]').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
   dialog.querySelector('[data-confirm]').onclick=()=>{close();run(async()=>{await query(c=>c.rpc('workspace_approve_release',{p_id:row.id}));if(current()){busy=false;await load();busy=true;}});};dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  };
  load();return ()=>{disposed=true;epoch++;clearTimeout(timer);dialog?.close();dialog?.remove();root.replaceChildren();};
 }
 window.AIWisePublishedRelease=Object.freeze({render});
})();
