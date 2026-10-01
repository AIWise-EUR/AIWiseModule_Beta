/* Administrator-only commit/deployment status. Approval remains the existing guarded RPC. */
(() => {
  'use strict';
  const repo='https://github.com/AIWise-EUR/AIWiseModule_Beta';
  const fields='submission_id,status,attempts,commit_sha,error_code,deployment_status,deployment_run_id';
  function mount(host, submission, {onStatus=()=>{}}={}) {
    let disposed=false,timer,busy=false,linkKey='';
    const initial=window.AIWiseAuth.snapshot(),owner=initial.user?.id;
    const current=()=>{const a=window.AIWiseAuth.snapshot();return !disposed&&a.status==='member'&&a.role==='admin'&&a.user?.id===owner;};
    host.innerHTML='<h3>Beta sync</h3><p>Tracks the approved copy saved to GitHub and deployed to the Beta site. This is separate from publishing to students.</p><p data-publish-status role="status">Checking Beta sync…</p><div class="toolbar" data-publish-links></div><div class="toolbar"><button class="button" data-publish-refresh type="button">Refresh status</button><button class="button" data-publish-retry type="button" hidden>Retry commit</button></div>';
    const status=host.querySelector('[data-publish-status]'),links=host.querySelector('[data-publish-links]'),retry=host.querySelector('[data-publish-retry]'),refresh=host.querySelector('[data-publish-refresh]');
    const report=(message,attention=false)=>{status.textContent=message;onStatus({attention});};
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
        if(!setting.data){report('Automatic Beta sync is not enabled yet.',true);return;}
        if(!job){report('Waiting to save this approved copy to GitHub.');timer=setTimeout(load,15000);return;}
        const labels={queued:job.attempts?'Beta sync delayed. Another attempt is scheduled.':'Approved copy queued for GitHub',processing:'Saving the approved copy to GitHub…',failed:'Beta sync failed. Check the GitHub connection and retry.',superseded:'A newer approved copy is already in GitHub.'};
        const message=job.status==='committed'?{pending:'Saved to GitHub · waiting for Beta deployment',building:'Saved to GitHub · Beta deployment in progress',success:'Saved to GitHub · Beta deployment completed',failure:'Saved to GitHub · Beta deployment failed. Open the deployment details.',unknown:'Saved to GitHub · Beta deployment could not be confirmed.'}[job.deployment_status]||'Saved to GitHub':labels[job.status]||'Beta sync status unavailable.';
        report(message,job.status==='failed'||job.status==='committed'&&['failure','unknown'].includes(job.deployment_status));
        const nextKey=(job.commit_sha||'')+':'+(job.deployment_run_id||'');
        if(nextKey!==linkKey){
          links.replaceChildren();linkKey=nextKey;
          if(/^[a-f0-9]{40}$/.test(job.commit_sha||''))addLink('View commit ↗',repo+'/commit/'+job.commit_sha);
          if(Number.isSafeInteger(job.deployment_run_id)&&job.deployment_run_id>0)addLink('View deployment ↗',repo+'/actions/runs/'+job.deployment_run_id);
        }
        retry.hidden=job.status!=='failed';
        if(['queued','processing'].includes(job.status)||job.status==='committed'&&['pending','building'].includes(job.deployment_status))timer=setTimeout(load,15000);
      }catch(e){if(current())report(['PGRST202','PGRST205','42P01','42883'].includes(e?.code)?'Automatic Beta sync setup is not ready yet.':'Beta sync status could not be loaded. Refresh to retry.',true);}
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
      }catch{if(current())report('The retry could not be queued. Refresh the status and try again.',true);}
      finally{if(current())retry.disabled=false;}
    };
    load();
    return ()=>{disposed=true;clearTimeout(timer);host.replaceChildren();};
  }
  window.AIWiseGitHubPublishing=Object.freeze({mount});
})();
