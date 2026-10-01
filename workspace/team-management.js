/* Administrators manage registered accounts through guarded database RPCs. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let session = null;
  const admin = () => { const a=window.AIWiseAuth.snapshot(); return a.status==='member' && a.role==='admin'; };
  const sameAccount = owner => {const a=window.AIWiseAuth.snapshot();return ['member','checking'].includes(a.status)&&a.role==='admin'&&a.user?.id===owner;};
  const active = s => session===s && sameAccount(s.owner);
  function friendly(error) {
    if (['PGRST202','42883','42P01','PGRST205','42703'].includes(error?.code)) return 'Team management is not ready yet. Ask the project administrator to finish setup.';
    if (error?.code==='42501') return 'Administrator access is required. Reopen your account to check access.';
    if (['40001','23514','22023'].includes(error?.code)) return error.message;
    return 'The change could not be confirmed. Refresh the team list before trying again.';
  }
  async function rpc(name, args) {
    if(!admin())throw Error('Administrator access is required.');
    const owner=window.AIWiseAuth.snapshot().user.id, backend=await window.AIWiseBackend.getClient();
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),15000);
    try {
      const result=await backend.rpc(name,args).abortSignal(abort.signal);
      if(result.error)throw Error(friendly(result.error));
      if(!sameAccount(owner))throw Error('Your account changed. Reopen Team management.');
      return result.data;
    } finally {clearTimeout(timer);}
  }
  async function load(s) {
    const epoch=++s.epoch;s.message.textContent='Loading team…';s.list.replaceChildren();
    s.root.querySelectorAll('[data-load]').forEach(b=>b.disabled=true);
    try {
      const result=await rpc('workspace_list_team',{p_search:s.search,p_offset:s.offset,p_limit:50});
      if(!active(s)||epoch!==s.epoch)return;
      s.message.textContent=result.pending_requests?result.pending_requests+' join '+(result.pending_requests===1?'request awaits':'requests await')+' approval.':'';s.rows=result.members;
      s.root.querySelector('[data-total]').textContent=result.total+' '+(result.total===1?'account':'accounts');
      s.root.querySelector('[data-page]').textContent=result.total?`${s.offset+1}–${s.offset+result.members.length} of ${result.total}`:'0 accounts';
      if(!s.rows.length)s.list.innerHTML='<p class="empty-state">No accounts found.</p>';
      for(const row of s.rows) {
        const item=document.createElement('li');item.className='team-person';
        const label=!row.confirmed?'Email unconfirmed':({pending:row.requested_at?'Join request':'Awaiting approval',inactive:'Access paused',admin:'Administrator',member:'Member'})[row.access];
        item.innerHTML=`<div class="team-person-name"><strong>${esc(row.display_name)}${row.user_id===s.owner?' <span class="team-you">You</span>':''}</strong><span>${esc(row.email)}</span>${row.requested_at?`<span>Requested ${esc(new Date(row.requested_at).toLocaleDateString())} · ${esc(row.invitation_name||'Invitation link')}</span>`:''}</div><span class="badge">${esc(label)}</span><button class="button" type="button" ${!row.confirmed?'disabled':''}>${row.access==='pending'?'Review request':'Manage access'}</button>`;
        item.querySelector('button').setAttribute('aria-label',`${row.access==='pending'?'Review':'Manage'} access for ${row.display_name}`);
        item.querySelector('button').onclick=()=>edit(s,row);
        s.list.append(item);
      }
      s.root.querySelector('[data-prev]').disabled=s.offset===0;
      s.root.querySelector('[data-next]').disabled=s.offset+50>=result.total;
    } catch(e) {if(active(s)&&epoch===s.epoch){s.message.textContent=e.message;s.root.querySelector('[data-prev]').disabled=true;s.root.querySelector('[data-next]').disabled=true;}}
    finally {if(active(s)&&epoch===s.epoch)s.root.querySelectorAll('[data-load]').forEach(b=>b.disabled=false);}
  }
  function edit(s,row) {
    if(!active(s)||!admin()||s.busy)return;
    const dialog=document.createElement('dialog');dialog.className='team-dialog';dialog.setAttribute('aria-labelledby','team-edit-title');
    dialog.innerHTML=`<form><h2 id="team-edit-title">${row.access==='pending'?'Review join request':'Manage access'}</h2><p><strong>${esc(row.display_name)}</strong><br>${esc(row.email)}</p><label for="team-role">Role</label><select id="team-role"><option value="member">Member</option><option value="admin">Administrator</option></select><p class="team-help">Members can preview Beta and leave feedback. Administrators can also edit content, review submissions and manage the team.</p><label for="team-active">Workspace access</label><select id="team-active"><option value="true">${row.access==='pending'?'Approve request':'Active'}</option><option value="false">${row.access==='pending'?'Decline request':'Paused'}</option></select><p class="team-help">Paused accounts cannot use Workspace or team feedback.</p>${row.user_id===s.owner?'<p class="team-self-note">You are changing your own access. Switching to Member takes you to Beta; pausing access closes your Workspace.</p>':''}<p role="alert" data-error></p><div class="toolbar"><button class="button" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">${row.access==='pending'?'Confirm decision':'Save access'}</button></div></form>`;
    document.body.append(dialog);s.dialog=dialog;const role=dialog.querySelector('#team-role'),enabled=dialog.querySelector('#team-active');
    role.value=row.role;enabled.value=String(row.access==='pending'||row.active);
    const close=()=>{if(s.busy)return;dialog.close();dialog.remove();s.dialog=null;};
    dialog.querySelector('[data-cancel]').onclick=close;
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.querySelector('form').onsubmit=async e=>{
      e.preventDefault();if(!active(s)||!admin()||s.busy)return;s.busy=true;
      dialog.querySelectorAll('button,select').forEach(n=>n.disabled=true);dialog.querySelector('[data-error]').textContent='Saving access…';
      try {
        await rpc('workspace_set_team_access',{p_user_id:row.user_id,p_role:role.value,p_active:enabled.value==='true',p_expected_version:row.version});
        if(!active(s))return;s.busy=false;close();
        await window.AIWiseAuth.refresh();
        if(active(s)){await load(s);s.message.textContent='Access updated.';}
      } catch(error) {if(active(s)){dialog.querySelector('[data-error]').textContent=error.message;dialog.querySelectorAll('button,select').forEach(n=>n.disabled=false);}}
      finally {if(session===s)s.busy=false;}
    };
    dialog.showModal();role.focus();
  }
  function render(shell) {
    dispose();if(!admin())return;
    shell(null,'Team management','',`<p class="room-lead">Approve accounts and manage access to AI-Wise.</p><div class="team-summary"><p><strong>Members</strong><br>Beta preview and feedback</p><p><strong>Administrators</strong><br>Content, approvals and team management</p></div><div data-team-invitations></div><section class="team-panel" aria-label="Team accounts"><form class="team-search"><label for="team-search">Find a person</label><div><input id="team-search" type="search" maxlength="100" placeholder="Name or email"><button class="button" type="submit" data-load>Search</button><button class="button" type="button" data-refresh data-load>Refresh</button></div></form><p data-total></p><p role="status" aria-live="polite" data-message></p><ul class="team-people" data-list></ul><div class="team-pagination"><button class="button" type="button" data-prev disabled>Previous</button><span data-page></span><button class="button" type="button" data-next disabled>Next</button></div></section>`,false);
    const root=document.querySelector('.team-panel'),s=session={root,owner:window.AIWiseAuth.snapshot().user.id,search:'',offset:0,epoch:0,busy:false,rows:[],dialog:null};
    s.message=root.querySelector('[data-message]');s.list=root.querySelector('[data-list]');
    root.querySelector('form').onsubmit=e=>{e.preventDefault();s.search=root.querySelector('input').value.trim();s.offset=0;load(s);};
    root.querySelector('[data-refresh]').onclick=()=>load(s);
    root.querySelector('[data-prev]').onclick=()=>{s.offset=Math.max(0,s.offset-50);load(s);};
    root.querySelector('[data-next]').onclick=()=>{s.offset+=50;load(s);};
    s.invites=window.AIWiseInvites?.mount(document.querySelector('[data-team-invitations]'));
    load(s);
  }
  function dispose(){const s=session;session=null;if(!s)return;s.epoch++;s.invites?.dispose();s.dialog?.close();s.dialog?.remove();}
  window.AIWiseTeam=Object.freeze({render,dispose,canLeave:()=>!session?.busy&&!session?.dialog&&(session?.invites?.canLeave()??true)});
})();
