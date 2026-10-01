/* Administrator-only commit/deployment status. Approval remains the existing guarded RPC. */
(() => {
  'use strict';
  const repo='https://github.com/AIWise-EUR/AIWiseModule_Beta';
  const fields='submission_id,status,attempts,commit_sha,error_code,deployment_status,deployment_run_id';
  function mount(host, submission) {
    let disposed=false,timer,busy=false,linkKey='';
    const initial=window.AIWiseAuth.snapshot(),owner=initial.user?.id;
    const current=()=>{const a=window.AIWiseAuth.snapshot();return !disposed&&a.status==='member'&&a.role==='admin'&&a.user?.id===owner;};
    host.innerHTML='<h2>GitHub &amp; deployment</h2><p data-publish-status role="status">Checking commit status…</p><div class="toolbar" data-publish-links></div><div class="toolbar"><button class="button" data-publish-refresh type="button">Refresh status</button><button class="button" data-publish-retry type="button" hidden>Retry commit</button></div>';
    const status=host.querySelector('[data-publish-status]'),links=host.querySelector('[data-publish-links]'),retry=host.querySelector('[data-publish-retry]'),refresh=host.querySelector('[data-publish-refresh]');
    const addLink=(label,url)=>{const a=document.createElement('a');a.className='button';a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener noreferrer';links.append(a);};
    async function load() {
      clearTimeout(timer);
      if(busy||!current()){if(!current())host.replaceChildren();return;}
      busy=true;refresh.disabled=true;retry.hidden=true;
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
      try {
        const client=await window.AIWiseBackend.getClient();
        const [setting,result]=await Promise.all([
          client.rpc('workspace_github_status').abortSignal(controller.signal),
          client.from('workspace_github_jobs').select(fields).eq('submission_id',submission).maybeSingle().abortSignal(controller.signal),
        ]);
        if(!current())return;
        if(setting.error||result.error)throw setting.error||result.error;
        const job=result.data;
        if(!setting.data){status.textContent='Automatic commits are not enabled yet.';return;}
        if(!job){status.textContent='Waiting for this approval to enter the commit queue.';timer=setTimeout(load,15000);return;}
        const labels={queued:job.attempts?'Commit delayed. Another attempt is scheduled.':'Approved · commit queued',processing:'Approved · committing to GitHub…',failed:'Approved · commit failed. Check the GitHub connection and retry.',superseded:'A newer approved copy is already in GitHub.'};
        status.textContent=labels[job.status]||'Commit status unavailable.';
        if(job.status==='committed')status.textContent={pending:'Committed · waiting for deployment',building:'Committed · deployment in progress',success:'Committed · deployment completed',failure:'Committed · deployment failed. Open the deployment details.',unknown:'Committed · deployment could not be confirmed.'}[job.deployment_status]||'Committed';
        const nextKey=(job.commit_sha||'')+':'+(job.deployment_run_id||'');
        if(nextKey!==linkKey){
          links.replaceChildren();linkKey=nextKey;
          if(/^[a-f0-9]{40}$/.test(job.commit_sha||''))addLink('View commit ↗',repo+'/commit/'+job.commit_sha);
          if(Number.isSafeInteger(job.deployment_run_id)&&job.deployment_run_id>0)addLink('View deployment ↗',repo+'/actions/runs/'+job.deployment_run_id);
        }
        retry.hidden=job.status!=='failed';
        if(['queued','processing'].includes(job.status)||job.status==='committed'&&['pending','building'].includes(job.deployment_status))timer=setTimeout(load,15000);
      }catch(e){if(current())status.textContent=['PGRST202','PGRST205','42P01','42883'].includes(e?.code)?'Automatic commit setup is not ready yet.':'Commit status could not be loaded. Refresh to retry.';}
      finally{clearTimeout(timeout);busy=false;if(current())refresh.disabled=false;else host.replaceChildren();}
    }
    refresh.onclick=load;
    retry.onclick=async()=>{
      if(!current())return;
      retry.disabled=true;
      try{
        const client=await window.AIWiseBackend.getClient();
        const {error}=await client.rpc('workspace_retry_github',{p_submission:submission});
        if(error)throw error;
        if(current())await load(); // The server schedule picks up the retry even if the browser closes.
      }catch{if(current())status.textContent='The retry could not be queued. Refresh the status and try again.';}
      finally{if(current())retry.disabled=false;}
    };
    load();
    return ()=>{disposed=true;clearTimeout(timer);host.replaceChildren();};
  }
  window.AIWiseGitHubPublishing=Object.freeze({mount});
})();
