/* Page feedback is shared with administrators; authors can see their own messages. */
(() => {
 'use strict';
 const base=new URL('./',document.currentScript.src),auth=()=>window.AIWiseAuth.snapshot();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const kinds={bug:'Report an error',idea:'Suggest a feature',improvement:'Suggest an improvement'},states={new:'New',reviewing:'Under review',done:'Done'};
 const button=document.createElement('button');button.type='button';button.className='pf-bubble';button.setAttribute('aria-haspopup','dialog');button.innerHTML='<span aria-hidden="true">✎</span> Feedback <span data-pf-count hidden></span>';
 const dialog=document.createElement('dialog');dialog.className='pf-dialog';dialog.setAttribute('aria-labelledby','pf-title');document.body.append(button,dialog);
 let session=null,poll,identity='',badgeEpoch=0;
 const valid=s=>session===s&&auth().status==='member'&&auth().user?.id===s.owner&&auth().role===s.role;
 const failure=e=>['42P01','PGRST205','PGRST202','42883'].includes(e?.code)?'Page feedback is not ready yet. Your message has not been sent.':e?.code==='40001'?'This feedback changed. Refresh before saving.':'Could not connect. Your message is still here; please retry.';
 async function query(make){const a=auth();if(a.status!=='member')throw Error('Sign in with an approved team account.');const b=await window.AIWiseBackend.getClient(),c=new AbortController(),timer=setTimeout(()=>c.abort(),15000);
  try{const result=await make(b).abortSignal(c.signal);if(auth().user?.id!==a.user.id||auth().role!==a.role||auth().status!=='member')throw Error('Your account changed.');if(result.error)throw Error(failure(result.error));return result;}finally{clearTimeout(timer);}
 }
 function context(){
  const profiler=document.body.classList.contains('profiler-page');let hash=profiler?'#profile':location.hash||'#home';
  const preview=document.querySelector('.br-page');if(preview){const params=new URLSearchParams(hash.split('?')[1]||''),page=preview.querySelector('[data-page]')?.value,course=preview.querySelector('[data-course]')?.value,lang=preview.querySelector('[data-language]')?.value;if(page){params.set('page',page+'?course='+course+(lang==='nl'?'&lang=nl':''));hash=hash.split('?')[0]+'?'+params;}}
  return {page:'workspace/'+(profiler?'course-profiler/':'')+hash,title:(document.querySelector('#br-title,#room-title')?.textContent||document.title||'Workspace').slice(0,160)};
 }
 function href(page){if(!/^workspace\/(course-profiler\/)?#[a-zA-Z0-9_/?=&%~.:-]*$/.test(page))return base.href;const [path,hash]=page.slice('workspace/'.length).split('#');const url=new URL(path||'./',base);url.hash=hash;return url.href;}
 async function list(status='all',offset=0){return (await query(b=>{let q=b.from('workspace_page_feedback').select('*').order('created_at',{ascending:false}).order('id');if(status!=='all')q=q.eq('status',status);return q.range(offset,offset+49);})).data;}
 async function refreshBadge(){clearTimeout(poll);const a=auth(),epoch=++badgeEpoch,span=button.querySelector('[data-pf-count]');span.hidden=true;
  if(a.status==='member'&&a.role==='admin')try{const r=await query(b=>b.from('workspace_page_feedback').select('id',{head:true,count:'exact'}).eq('status','new'));if(epoch===badgeEpoch&&r.count>0){span.hidden=false;span.textContent=String(r.count);}}catch{}
  if(epoch===badgeEpoch&&auth().status==='member')poll=setTimeout(refreshBadge,45000);
 }
 function close(){if(session?.busy)return;dialog.close();button.focus({preventScroll:true});}
 function build(s){
  dialog.innerHTML=`<header class="pf-head"><div><h2 id="pf-title">Workspace feedback</h2><p>Messages go to the administrator inbox.</p></div><button type="button" class="aw-account-close" data-pf-close aria-label="Close page feedback">×</button></header><div class="pf-tabs" role="group" aria-label="Feedback view"><button type="button" class="button" data-pf-write>Write feedback</button><button type="button" class="button" data-pf-inbox>${s.role==='admin'?'Administrator inbox':'My feedback'}</button></div><div class="pf-body"><form data-pf-form><p class="pf-context">About <strong data-pf-page></strong></p><label for="pf-kind">Type</label><select id="pf-kind">${Object.entries(kinds).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select><label for="pf-body">Message</label><textarea id="pf-body" rows="6" maxlength="8000" required placeholder="What happened, or what would you like to improve?"></textarea><p class="pf-note">Your name and this page are included. You and administrators can read the message.</p><button type="submit" class="button primary">Send feedback</button><p role="status" data-pf-send-status></p></form><section data-pf-list hidden><div class="toolbar"><label>Status<select data-pf-filter>${Object.entries({all:'All',...states}).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label><button type="button" class="button" data-pf-refresh>Refresh</button></div><p role="status" data-pf-list-status></p><div data-pf-rows></div><button class="button" type="button" data-pf-more hidden>Load more</button></section></div>`;
  dialog.querySelector('[data-pf-close]').onclick=close;dialog.querySelector('[data-pf-write]').onclick=()=>view(s,'write');dialog.querySelector('[data-pf-inbox]').onclick=()=>view(s,'inbox');
  dialog.querySelector('[data-pf-refresh]').onclick=()=>load(s);dialog.querySelector('[data-pf-filter]').onchange=()=>load(s);dialog.querySelector('[data-pf-more]').onclick=()=>load(s,true);
  dialog.querySelector('[data-pf-form]').onsubmit=async e=>{e.preventDefault();if(s.busy||!valid(s))return;const body=dialog.querySelector('#pf-body').value.trim();if(!body)return;const kind=dialog.querySelector('#pf-kind').value,key=JSON.stringify([s.context,body,kind]);if(s.last!==key){s.id=crypto.randomUUID();s.last=key;}s.busy=true;const form=e.currentTarget,message=form.querySelector('[role=status]');form.querySelectorAll('button,textarea,select').forEach(n=>n.disabled=true);message.textContent='Sending…';
   try{await query(b=>b.rpc('workspace_send_page_feedback',{p_id:s.id,p_page:s.context.page,p_title:s.context.title,p_kind:kind,p_body:body}));if(valid(s)){dialog.querySelector('#pf-body').value='';s.last='';message.textContent='Sent to the administrator inbox. Track it in the feedback inbox.';refreshBadge();window.dispatchEvent(new Event('page-feedback-updated'));}}
   catch(e){if(valid(s))message.textContent=e.message;}finally{if(valid(s)){s.busy=false;form.querySelectorAll('button,textarea,select').forEach(n=>n.disabled=false);}}
  };
 }
 function view(s,tab){if(!valid(s)||s.busy)return;s.view=tab;dialog.querySelector('[data-pf-form]').hidden=tab!=='write';dialog.querySelector('[data-pf-list]').hidden=tab!=='inbox';dialog.querySelector('[data-pf-write]').setAttribute('aria-pressed',String(tab==='write'));dialog.querySelector('[data-pf-inbox]').setAttribute('aria-pressed',String(tab==='inbox'));if(tab==='inbox')load(s);}
 function draw(s){const target=dialog.querySelector('[data-pf-rows]');target.replaceChildren();
  for(const row of s.rows){const card=document.createElement('article');card.className='pf-message';card.innerHTML=`<div class="beta-section-heading"><strong>${esc(row.author_name)}</strong><span class="ct-tag">${states[row.status]}</span></div><small>${esc(kinds[row.kind])} · ${esc(new Date(row.created_at).toLocaleString())}</small><a href="${esc(href(row.page))}" data-pf-source>${esc(row.page_title)} ↗</a><p class="pf-message-text">${esc(row.body)}</p>${row.response?`<div class="pf-response"><strong>${esc(row.administrator_name||'Administrator')}</strong><p class="pf-message-text">${esc(row.response)}</p></div>`:''}`;
   card.querySelector('[data-pf-source]').onclick=close;
   if(s.role==='admin'){const form=document.createElement('form');form.innerHTML=`<label>Status<select>${Object.entries(states).map(([v,t])=>`<option value="${v}" ${v===row.status?'selected':''}>${t}</option>`).join('')}</select></label><label>Reply to the author<textarea maxlength="8000" rows="3"></textarea></label><button class="button" type="submit">Save response</button><p role="status"></p>`;form.querySelector('textarea').value=row.response;
    form.onsubmit=async e=>{e.preventDefault();if(s.busy||!valid(s))return;s.busy=true;const status=form.querySelector('select').value,response=form.querySelector('textarea').value;form.querySelectorAll('button,select,textarea').forEach(n=>n.disabled=true);
     try{await query(b=>b.rpc('workspace_update_page_feedback',{p_id:row.id,p_revision:row.revision,p_status:status,p_response:response}));if(valid(s)){s.busy=false;await load(s);refreshBadge();window.dispatchEvent(new Event('page-feedback-updated'));}}
     catch(e){if(valid(s))form.querySelector('[role=status]').textContent=e.message;}finally{if(valid(s)){s.busy=false;form.querySelectorAll('button,select,textarea').forEach(n=>n.disabled=false);}}
    };card.append(form);
   }target.append(card);
  }if(!s.rows.length)target.innerHTML='<p class="pf-note">No feedback in this view yet.</p>';
 }
 async function load(s,more=false){if(!valid(s)||s.busy)return;const epoch=++s.epoch,offset=more?s.rows.length:0,message=dialog.querySelector('[data-pf-list-status]');message.textContent='Loading…';
  try{const rows=await list(dialog.querySelector('[data-pf-filter]').value,offset);if(valid(s)&&epoch===s.epoch){s.rows=more?[...s.rows,...rows]:rows;draw(s);message.textContent='';dialog.querySelector('[data-pf-more]').hidden=rows.length<50;}}
  catch(e){if(valid(s)&&epoch===s.epoch)message.textContent=e.message;}
 }
 function open(viewName='write'){const a=auth();if(a.status!=='member'){window.AIWiseAccount.open();return;}if(!session||session.owner!==a.user.id||session.role!==a.role){session={owner:a.user.id,role:a.role,rows:[],epoch:0,busy:false,context:context()};build(session);}const s=session;if(!dialog.querySelector('#pf-body').value.trim()){s.context=context();dialog.querySelector('[data-pf-page]').textContent=s.context.title;dialog.querySelector('[data-pf-send-status]').textContent='';}dialog.showModal();window.AIWiseMotion?.enter(dialog,'menu');view(s,viewName);dialog.querySelector('[data-pf-close]').focus();}
 // This section is independent from Beta mentions, so missing setup cannot hide existing notifications.
 async function notifications(host){const owner=auth().user?.id,role=auth().role;host.innerHTML='<p class="mp-empty">Loading page feedback…</p>';
  try{const rows=(await list(role==='admin'?'new':'all')).slice(0,5);if(!host.isConnected||auth().user?.id!==owner||auth().role!==role)return;host.replaceChildren();const entry=document.createElement('button');entry.type='button';entry.className='button';entry.textContent=role==='admin'?'Open administrator inbox':'Open my feedback';entry.onclick=()=>{if(window.AIWiseMyPage?.close?.()===false)return;open('inbox');};host.append(entry);const p=document.createElement('p');p.className='mp-empty';p.textContent=rows.length?rows.map(r=>r.author_name+' · '+(role==='admin'?r.body.slice(0,90):states[r.status]+(r.response?' · Administrator replied':''))).join('\n'):'No new page feedback.';host.append(p);}
  catch(e){if(host.isConnected&&auth().user?.id===owner){host.innerHTML='<p class="mp-empty">Page feedback is unavailable.</p>';const retry=document.createElement('button');retry.className='button';retry.textContent='Retry';retry.onclick=()=>notifications(host);host.append(retry);}}
 }
 button.onclick=()=>open();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 window.addEventListener('focus',refreshBadge);auth();window.AIWiseAuth.subscribe(a=>{const next=a.status+':'+a.user?.id+':'+a.role;if(next===identity)return;identity=next;if(a.status==='checking')return;if(session&&!valid(session)){session=null;dialog.close();dialog.replaceChildren();}refreshBadge();});
 window.AIWisePageFeedback=Object.freeze({open,notifications,href,context});
})();
