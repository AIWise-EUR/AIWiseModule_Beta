/* Fixed personal sections. Team records stay on Supabase; personal notes stay on this browser. */
(() => {
 'use strict';
 const base=new URL('./',document.currentScript.src),auth=()=>window.AIWiseAuth.snapshot();
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const tab=document.createElement('button');tab.type='button';tab.className='mp-tab';tab.textContent='My page';tab.setAttribute('aria-haspopup','dialog');tab.setAttribute('aria-controls','my-page');
 const dialog=document.createElement('dialog');dialog.id='my-page';dialog.className='mp-dialog';dialog.setAttribute('aria-labelledby','mp-title');document.body.append(tab,dialog);document.body.classList.add('has-my-page');
 let session=null;
 const valid=s=>session===s&&dialog.open&&['member','checking'].includes(auth().status)&&auth().user?.id===s.owner&&auth().role===s.role;
 const key=(owner,kind)=>'aiwise_my_page_v1:'+owner+':'+kind;
 function read(owner,kind,fallback){try{return JSON.parse(localStorage.getItem(key(owner,kind)))??fallback;}catch{return fallback;}}
 function write(owner,kind,value){localStorage.setItem(key(owner,kind),JSON.stringify(value));}
 const day=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;};
 const allowed=(hash,role)=>/^#(beta|common|studio|tower|courses|manager|profiler|team)(?:[/?][a-zA-Z0-9_./?=&%~-]*)?$/.test(hash)&&(role==='admin'||/^#beta(?:[/?]|$)/.test(hash));
 function pageLink(hash,lang='en'){const url=new URL(base);url.searchParams.set('lang',lang==='nl'?'nl':'en');url.hash=hash;return location.pathname===base.pathname&&(new URL(location.href).searchParams.get('lang')==='nl'?'nl':'en')===(lang==='nl'?'nl':'en')?hash:url.href;}
 function record(){const a=auth();if(a.status!=='member')return;const hash=document.body.classList.contains('profiler-page')?'#profiler':location.hash;if(!allowed(hash,a.role))return;
  const entry={hash,lang:new URL(location.href).searchParams.get('lang')==='nl'?'nl':'en',title:(document.querySelector('#room-title,#br-title')?.textContent||document.title).slice(0,100),at:new Date().toISOString()};
  const existing=read(a.user.id,'recent',[]);const rows=Array.isArray(existing)?existing.filter(r=>r&&allowed(r.hash,a.role)&&r.hash!==hash).slice(0,7):[];
  try{write(a.user.id,'recent',[entry,...rows]);}catch{};
 }
 const when=x=>new Date(x).toLocaleDateString(undefined,{month:'short',day:'numeric'});
 function links(rows,empty){return rows.length?rows.map(r=>`<a class="mp-item" href="${esc(r.href)}"><strong>${esc(r.title)}</strong><span>${esc(r.detail||'')} ${r.at?'· '+esc(when(r.at)):''}</span></a>`).join(''):`<p class="mp-empty">${empty}</p>`;}
 const memoLink=row=>pageLink('#beta/'+(row.version_id||'current')+'?page='+encodeURIComponent(row.page)+'&memo='+row.id);
 async function request(s,make){
  if(!valid(s))throw Error('Reopen My page with your team account.');const b=await window.AIWiseBackend.getClient(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);s.requests.add(controller);
  try{const {data,error}=await make(b).abortSignal(controller.signal);if(error)throw Error('Could not load this section. Please retry.');if(!valid(s))throw Error('Your account changed.');return data;}finally{clearTimeout(timer);s.requests.delete(controller);}
 }
 function recent(s){const records=read(s.owner,'recent',[]),rows=Array.isArray(records)?records.filter(r=>r&&allowed(r.hash,s.role)).slice(0,5):[];dialog.querySelector('[data-mp-recent]').innerHTML=links(rows.map(r=>({...r,href:pageLink(r.hash,r.lang),detail:'Visited'})),'Pages you visit will appear here.');}
 async function section(s,target,loader,empty){
  const epoch=++s.epochs[target],node=dialog.querySelector(`[data-mp-${target}]`);node.innerHTML='<p class="mp-empty" role="status">Loading…</p>';
  try{const rows=await loader();if(valid(s)&&epoch===s.epochs[target])node.innerHTML=links(rows,empty);}
  catch(e){if(valid(s)&&epoch===s.epochs[target]){node.innerHTML='<p class="mp-empty" role="status">Could not load this section.</p><button type="button" class="button">Retry</button>';node.querySelector('button').onclick=()=>section(s,target,loader,empty);}}
 }
 function load(s){recent(s);const feedback=dialog.querySelector('[data-mp-page-feedback]');if(feedback)window.AIWisePageFeedback?.notifications(feedback);
  section(s,'notifications',async()=>{
   const [memos,replies]=await Promise.all([
    request(s,b=>b.from('workspace_beta_memos').select('id,page,version_id,body,author_name,created_at').contains('mentions',[s.owner]).order('created_at',{ascending:false}).limit(6)),
    request(s,b=>b.from('workspace_beta_replies').select('id,body,author_name,created_at,workspace_beta_memos!inner(id,page,version_id)').contains('mentions',[s.owner]).order('created_at',{ascending:false}).limit(6))
   ]);
   return [...memos,...replies.map(r=>({...r,...r.workspace_beta_memos,body:r.body,author_name:r.author_name,created_at:r.created_at}))].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,6).map(r=>({href:memoLink(r),title:r.author_name+' mentioned you',detail:r.body.slice(0,130),at:r.created_at}));
  },'No mentions yet. Team mentions will appear here.');
  section(s,'work',async()=>{
   const [memos,replies]=await Promise.all([request(s,b=>b.from('workspace_beta_memos').select('id,page,version_id,body,created_at,resolved').eq('author_id',s.owner).order('created_at',{ascending:false}).limit(5)),request(s,b=>b.from('workspace_beta_replies').select('id,body,created_at,workspace_beta_memos!inner(id,page,version_id)').eq('author_id',s.owner).order('created_at',{ascending:false}).limit(5))]);
   const rows=memos.map(r=>({href:memoLink(r),title:r.body.slice(0,100),detail:'My feedback · '+(r.resolved?'Resolved':'Open'),at:r.created_at}));
   rows.push(...replies.map(r=>({href:memoLink(r.workspace_beta_memos),title:r.body.slice(0,100),detail:'My reply',at:r.created_at})));
   if(s.role==='admin'){
    const [submissions,versions]=await Promise.all([
     request(s,b=>b.from('workspace_submissions').select('id,summary,status,submitted_at').eq('author_id',s.owner).order('submitted_at',{ascending:false}).limit(5)),
     request(s,b=>b.from('workspace_beta_versions').select('id,number,title,created_at').eq('author_id',s.owner).order('created_at',{ascending:false}).limit(5))
    ]);rows.push(...submissions.map(r=>({href:pageLink('#tower/request/'+r.id),title:r.summary.slice(0,100),detail:'My submission · '+r.status,at:r.submitted_at})),...versions.map(r=>({href:pageLink('#beta/'+r.id),title:'V'+r.number+' · '+r.title,detail:'Review version I created',at:r.created_at})));
   }
   return rows.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,7);
  },'Your feedback'+(s.role==='admin'?', submissions and review versions':'')+' will appear here.');
 }
 function saveNotes(s){if(!valid(s))return false;try{
  const memo=dialog.querySelector('[data-mp-day-note]').value,personal=dialog.querySelector('[data-mp-note]').value;
  const existing=read(s.owner,'calendar',{}),calendar=existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{};
  if(memo.trim())calendar[s.date]=memo;else delete calendar[s.date];write(s.owner,'calendar',calendar);write(s.owner,'note',personal);s.unsaved=false;dialog.querySelector('[data-mp-save-status]').textContent='Saved in this browser.';return true;
 }catch{s.unsaved=true;dialog.querySelector('[data-mp-save-status]').textContent='Could not save. Keep this panel open and copy your notes, or retry.';return false;}}
 function build(a){const s=session={owner:a.user.id,role:a.role,date:day(),requests:new Set(),epochs:{notifications:0,work:0},unsaved:false};
  dialog.innerHTML=`<header class="mp-header"><div><h2 id="mp-title">My page</h2><p>${esc(a.user.displayName||'Team member')}</p></div><button class="aw-account-close" type="button" data-mp-close aria-label="Close My page">×</button></header><div class="mp-body"><section><h3>Notifications</h3><p class="mp-hint">Mentions from the team</p><div data-mp-notifications></div></section><section><h3>Page feedback</h3><div data-mp-page-feedback></div></section><section><h3>Recent pages</h3><p class="mp-hint">On this browser</p><div data-mp-recent></div></section><section><h3>My work</h3><div data-mp-work></div></section><section><h3>Calendar</h3><p class="mp-hint">Notes by date · saved on this browser</p><label for="mp-date">Date</label><input type="date" id="mp-date" value="${s.date}"><label for="mp-day-note">Memo for this date</label><textarea id="mp-day-note" data-mp-day-note maxlength="4000" rows="3" placeholder="Add a note for this date…"></textarea></section><section><h3>Personal notes</h3><label class="mp-hint" for="mp-note">Only saved on this browser, under your account</label><textarea id="mp-note" data-mp-note maxlength="8000" rows="4" placeholder="Keep a thought for later…"></textarea><p data-mp-save-status role="status"></p><button type="button" class="button" data-mp-save>Save notes</button></section></div><footer class="mp-footer"><button type="button" class="button" data-mp-account>Account settings</button><button type="button" class="button" data-mp-refresh>Refresh</button></footer>`;
  const calendar=read(s.owner,'calendar',{}),personal=read(s.owner,'note','');dialog.querySelector('[data-mp-day-note]').value=typeof calendar?.[s.date]==='string'?calendar[s.date]:'';dialog.querySelector('[data-mp-note]').value=typeof personal==='string'?personal:'';
  dialog.querySelector('[data-mp-close]').onclick=close;
  dialog.querySelector('[data-mp-account]').onclick=()=>{if(close())window.AIWiseAccount.open();};
  dialog.querySelector('[data-mp-refresh]').onclick=()=>load(s);
  dialog.querySelectorAll('textarea').forEach(n=>n.addEventListener('input',()=>{s.unsaved=true;saveNotes(s);}));
  dialog.querySelector('[data-mp-save]').onclick=()=>saveNotes(s);
  dialog.querySelector('#mp-date').onchange=e=>{if(s.unsaved&&!saveNotes(s)){e.target.value=s.date;return;}if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){e.target.value=s.date;return;}s.date=e.target.value;const saved=read(s.owner,'calendar',{});dialog.querySelector('[data-mp-day-note]').value=typeof saved?.[s.date]==='string'?saved[s.date]:'';};
  return s;
 }
 function close(){if(session?.unsaved&&!saveNotes(session))return false;session?.requests.forEach(c=>c.abort());window.AIWiseMotion.cancel(dialog);dialog.close();tab.focus({preventScroll:true});return true;}
 function open(){const a=auth();if(a.status!=='member'){window.AIWiseAccount.open();return;}window.AIWiseSidebar.close(false);
  const s=session?.owner===a.user.id&&session.role===a.role?session:build(a);dialog.showModal();window.AIWiseMotion.enter(dialog,'menu');load(s);dialog.querySelector('[data-mp-close]').focus();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{const link=e.target.closest('.mp-item');if(link&&!close())e.preventDefault();});
 tab.onclick=open;
 window.addEventListener('hashchange',()=>setTimeout(record,0));
 window.AIWiseAuth.subscribe(a=>{if(a.status==='checking'&&a.user?.id===session?.owner)return;if(session&&(a.status!=='member'||a.user?.id!==session.owner||a.role!==session.role)){session.requests.forEach(c=>c.abort());session=null;dialog.close();dialog.replaceChildren();}if(a.status==='member')setTimeout(record,0);});
 window.addEventListener('page-feedback-updated',()=>{if(session&&valid(session)){const host=dialog.querySelector('[data-mp-page-feedback]');if(host)window.AIWisePageFeedback?.notifications(host);}});
 window.AIWiseMyPage=Object.freeze({open,close});
})();
