/* The URL fragment is never sent to the web host. Joining still requires a confirmed Auth account. */
(() => {
 'use strict';
 const host=document.getElementById('invitation-content');if(!host)return;
 const parsed=/^#([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.([a-f0-9]{64})$/i.exec(location.hash);
 let epoch=0,busy=false;
 const notices={paused:'Your account access is paused. Ask an administrator to restore it in Team management.',revoked:'This invitation was revoked. Ask the team for a new link.',issuer_inactive:'This invitation is no longer active. Ask another administrator for a new link.',expired:'This invitation has expired. Ask the team for a new link.'};
 const same=owner=>window.AIWiseAuth.snapshot().user?.id===owner;
 async function rpc(name,owner){const b=await window.AIWiseBackend.getClient(),c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);try{const {data,error}=await b.rpc(name,{p_id:parsed[1],p_token:parsed[2].toLowerCase()}).abortSignal(c.signal);if(!same(owner))throw Error('Your account changed. Review the invitation again.');if(error)throw Error(['PGRST202','42883','42P01'].includes(error.code)?'Invitations are not ready yet. Ask your team administrator.':['22023','42501'].includes(error.code)?error.message:'The request could not be confirmed. Retry to check its status.');return data;}finally{clearTimeout(timer);}}
 function paragraph(text,role){const p=document.createElement('p');p.textContent=text;if(role)p.setAttribute('role',role);host.append(p);return p;}
 function button(text,action){const b=document.createElement('button');b.type='button';b.className='aw-account-button primary';b.textContent=text;b.onclick=action;host.append(b);return b;}
 function openWorkspace(role){const a=document.createElement('a');a.className='aw-account-button primary';a.href='./#'+(role==='admin'?'home':'beta');a.textContent='Open Workspace';host.append(a);}
 async function render(state){const token=++epoch;host.replaceChildren();
  if(!parsed){paragraph('This invitation link is incomplete or invalid. Ask the team for a new link.','alert');return;}
  if(state.status==='checking'){paragraph('Checking your account…','status');return;}
  if(!state.user){paragraph('Sign in or create an account to request to join the team.');return;}
  const owner=state.user.id;paragraph('Checking invitation…','status');
  try{const info=await rpc('workspace_invitation_details',owner);if(token!==epoch||!same(owner))return;host.replaceChildren();const title=document.createElement('h2');title.textContent=info.label;host.append(title);
   if(!info.approval_required){paragraph('Join requests are not ready yet. Ask your team administrator.','alert');return;}
   paragraph('Member is the default role. An administrator reviews your request and sets your access.');paragraph('Signed in as '+state.user.email);
   if(info.status==='member'){paragraph('Your team access is active.','status');openWorkspace(info.current_role);return;}
   if(info.status==='requested'){paragraph('Request sent. An administrator will review your membership and permissions.','status');const a=document.createElement('a');a.href='./';a.textContent='Back to Workspace';host.append(a);return;}
   if(info.status!=='eligible'){paragraph(notices[info.status]||'This invitation is unavailable.','alert');return;}
   paragraph('Expires '+new Date(info.expires_at).toLocaleDateString());
   const accept=button('Request to join',async()=>{if(busy||!same(owner))return;busy=true;accept.disabled=true;const feedback=paragraph('Sending your request…','status');try{await rpc('workspace_request_team_access',owner);if(!same(owner))return;await window.AIWiseAuth.refresh();if(same(owner))await render(window.AIWiseAuth.snapshot());}catch(e){if(same(owner)&&token===epoch){feedback.textContent=e.message;accept.disabled=false;}}finally{busy=false;}});
  }catch(e){if(token===epoch&&same(owner)){host.replaceChildren();paragraph(e.message,'alert');button('Retry',()=>render(window.AIWiseAuth.snapshot()));}}
 }
 window.AIWiseAuth.subscribe(render);
})();
