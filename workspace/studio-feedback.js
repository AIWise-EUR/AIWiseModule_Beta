/* Show the same Beta threads while editing their Studio item, without changing draft state. */
(() => {
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function mount(host,{course,chapter,locale,key,extraKey,node,doc}){
  const R=window.AIWiseReviewInbox,F=window.AIWiseBetaFeedback,owner=window.AIWiseAuth.snapshot().user?.id;let live=true,epoch=0,saving=false;
  const active=()=>live&&window.AIWiseAuth.snapshot().status==='member'&&window.AIWiseAuth.snapshot().user?.id===owner;
  host.innerHTML='<h3>Feedback on this content block</h3><p>Shared with Beta. Saving an edit does not resolve a memo.</p><div data-sf-list></div><p data-sf-status role="status"></p><button class="button" type="button" data-sf-refresh>Refresh feedback</button>';
  const status=host.querySelector('[data-sf-status]'),list=host.querySelector('[data-sf-list]');
  async function load(){if(saving||list.querySelector('textarea')){status.textContent='Post or cancel your reply first.';return;}const token=++epoch;status.textContent='Loading feedback…';try{
   const keys=[key,...(extraKey?[extraKey]:[])];
   const [linked,legacy,versions]=await Promise.all([
    R.all(b=>b.from('workspace_beta_memos').select('*').eq('content_course',course).eq('content_chapter',chapter).eq('content_locale',locale).in('item_key',keys).order('created_at').order('id')),
    R.all(b=>b.from('workspace_beta_memos').select('*').is('item_key',null).order('created_at').order('id')),
    R.all(b=>b.from('workspace_beta_versions').select('id,number,created_at').order('number'))
   ]);if(!active()||token!==epoch)return;
   const expected=chapter==='map'?'common/aiwise-c1-anatomy-2d.html':`common/aiwise-${chapter}-final.html`;
   for(const memo of legacy){const page=new URL(memo.page,'https://workspace.invalid/');if(page.pathname!=='/'+expected||(page.searchParams.get('lang')||'en')!==locale||(course!=='common'&&(page.searchParams.get('course')||'aws1')!==course))continue;const target=await window.AIWiseBetaAnchors.locate(doc,memo.anchor);if(target&&node&&(node===target||node.contains(target)))linked.push({...memo,legacyLocation:true});}
   const rows=[...new Map(linked.map(m=>[m.id,m])).values()],replies=[];for(let i=0;i<rows.length;i+=100)replies.push(...await R.all(b=>b.from('workspace_beta_replies').select('*').in('memo_id',rows.slice(i,i+100).map(m=>m.id)).order('created_at').order('id')));
   const memos=await R.threads(rows,replies);if(!active()||token!==epoch)return;list.replaceChildren();
   memos.sort((a,b)=>Number(a.resolved)-Number(b.resolved)||Number(b.unread)-Number(a.unread)).forEach(m=>{const v=versions.find(v=>v.id===m.version_id),details=document.createElement('details');details.className='sf-thread';details.innerHTML=`<summary><strong>${esc(m.author_name)}</strong> <span data-sf-unread>${m.unread?'● Unread':'Opened'}</span><small>${v?'V'+v.number+' · '+v.created_at.slice(0,10):m.version_id?'Saved version':'Next publication'} · ${m.resolved?'Resolved':'Unresolved'}</small></summary><blockquote>${esc(m.anchor.quote||m.anchor.excerpt)}</blockquote><p class="ct-preserve">${esc(m.body)}</p>${replies.filter(r=>r.memo_id===m.id).map(r=>`<div class="sf-reply"><strong>${esc(r.author_name)}</strong><p class="ct-preserve">${esc(r.body)}</p></div>`).join('')}<div class="toolbar"><button type="button" class="button" data-sf-reply>Reply</button><button type="button" class="button" data-sf-resolve>${m.resolved?'Reopen':'Resolve'}</button><a class="button" href="#beta/${m.version_id||'current'}?page=${encodeURIComponent(m.page)}&memo=${m.id}">Open in Beta →</a></div><div data-sf-compose></div><p role="status" data-sf-note></p>`;
    details.addEventListener('toggle',async()=>{if(!details.open||!m.unread)return;try{await R.mark(m.read_token);if(active()){m.unread=false;details.querySelector('[data-sf-unread]').textContent='Opened';}}catch(e){if(active())details.querySelector('[data-sf-note]').textContent=e.message;}});
    details.querySelector('[data-sf-reply]').onclick=()=>{const box=details.querySelector('[data-sf-compose]');if(box.children.length)return;const form=document.createElement('form');form.innerHTML='<label>Reply<textarea rows="3" maxlength="8000" required></textarea></label><div class="toolbar"><button type="submit" class="button primary">Post reply</button><button type="button" class="button" data-cancel>Cancel</button></div>';form.querySelector('[data-cancel]').onclick=()=>form.remove();const id=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;saving=true;try{await F.reply({id,memo_id:m.id,body:form.querySelector('textarea').value.trim(),mentions:[]});if(active()){form.remove();saving=false;load();}}catch(err){if(active()){details.querySelector('[data-sf-note]').textContent=err.message;button.disabled=false;}}finally{saving=false;}};box.append(form);form.querySelector('textarea').focus();};
    details.querySelector('[data-sf-resolve]').onclick=async e=>{e.target.disabled=true;try{await F.resolve(m.id,!m.resolved,m.resolved);if(active())load();}catch(err){if(active()){details.querySelector('[data-sf-note]').textContent=err.message;e.target.disabled=false;}}};list.append(details);
   });status.textContent=memos.length?'':'No linked feedback yet. Older feedback appears when its original location can still be verified.';
  }catch(e){if(active()&&token===epoch)status.textContent=e.message;}}
  host.querySelector('[data-sf-refresh]').onclick=()=>{if(list.querySelector('textarea')){status.textContent='Post or cancel your reply before refreshing.';return;}load();};load();
  const unsubscribe=window.AIWiseAuth.subscribe(()=>{if(!active()){epoch++;host.replaceChildren();}});
  const dispose=()=>{live=false;epoch++;unsubscribe?.();host.replaceChildren();};dispose.canLeave=()=>{if(saving){status.textContent='Posting your reply…';return false;}return !list.querySelector('textarea')||confirm('Discard your unsent feedback reply?');};return dispose;
 }
 window.AIWiseStudioFeedback=Object.freeze({mount});
})();
