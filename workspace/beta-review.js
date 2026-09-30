/* The campus Beta destination opens the actual module with private team annotations. */
(() => {
  'use strict';
  const root=new URL('../',document.currentScript.src), A=window.AIWiseBetaAnchors, F=window.AIWiseBetaFeedback;
  const pages=[['common/lobby.html','Module home'],['common/aiwise-c1-final.html','C1 · What is GenAI?'],['common/aiwise-c2-final.html','C2 · GenAI and human cognition'],['common/aiwise-c3-final.html','C3 · How to engage with GenAI'],['common/aiwise-c1-anatomy-2d.html','C1 · GenAI system map']];
  const kinds={comment:'Comment',highlight:'Highlight',box:'Box',pin:'Pin'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let session=null;
  function pageKey(url) {
    const u=new URL(url,root);
    if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname))return null;
    const path=u.pathname.slice(root.pathname.length);
    if(!/^(common\/[a-z0-9-]+\.html|course-specific\/[a-z0-9_-]+\/[a-zA-Z0-9_.()-]+\.html)$/.test(path))return null;
    const course=u.searchParams.get('course');
    const params=new URLSearchParams();if(['aws1','ped','other'].includes(course))params.set('course',course);if(u.searchParams.get('lang')==='nl')params.set('lang','nl');
    return path+(params.size?'?'+params:'');
  }
  const active=s=>session===s;
  const member=()=>window.AIWiseAuth.snapshot().status==='member';
  const dirty=()=>!!session && (!!session.text.value.trim() || !!session.modal.querySelector('[data-reply-text]')?.value.trim());
  function status(s,text,error=false) {s.status.textContent=text;s.status.dataset.error=String(error);}
  function busy(s,value) {
    s.busy=value;
    if(value){s.disabled=new Map([...s.modal.querySelectorAll('button,select,textarea')].map(n=>[n,n.disabled]));s.disabled.forEach((_,n)=>n.disabled=true);}
    else{s.disabled?.forEach((disabled,n)=>n.disabled=disabled);s.disabled=null;s.modal.querySelector('[data-add]').disabled=!member()||!s.doc;}
  }
  function resetDraft(s) {s.selectionEpoch++;s.anchor=null;s.clientId=null;s.text.value='';s.mode=null;s.drag=null;s.form.hidden=true;s.tools.hidden=true;s.modal.querySelector('[data-add]').setAttribute('aria-pressed','false');s.doc?.body.removeAttribute('data-beta-mode');s.targetTabs?.forEach((value,node)=>{if(value===null)node.removeAttribute('tabindex');else node.setAttribute('tabindex',value);});draw(s);}
  function setMode(s,mode) {
    s.selectionEpoch++;s.mode=mode;s.anchor=null;s.clientId=null;s.form.hidden=true;s.tools.hidden=false;s.modal.querySelector('[data-add]').setAttribute('aria-pressed','true');
    s.tools.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
    s.doc?.body.setAttribute('data-beta-mode',mode);s.targetTabs?.forEach((_,node)=>node.tabIndex=0);
    status(s,({comment:'Select a content box. Tab to a tagged box and press Enter also works.',highlight:'Select a passage in the preview, or choose a content box to highlight its text.',box:'Drag a box inside the content you want to mark. Or select a content box with Enter.',pin:'Click the position you want to point to. Or select a content box with Enter.'})[mode]);draw(s);
  }
  function reveal(node) {
    const pane=node.closest('.technique-pane');if(pane)pane.closest('.technique-panel')?.querySelector(`[data-tab="${pane.dataset.pane}"]`)?.click();
    const slide=node.closest('.critique-slide');if(slide)slide.closest('.critique-stepper')?.querySelector(`[data-step="${slide.dataset.slide}"]`)?.click();
    for(let n=node;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
  }
  function selectBox(s,node) {
    reveal(node);node.scrollIntoView({block:'center'});
    if(s.mode==='highlight'){const quote=node.textContent;if(!quote.trim()||quote.length>4000){status(s,'Select a shorter passage in the preview.');return;}selected(s,node,{start:0,end:quote.length,quote});return;}
    selected(s,node,s.mode==='box'?{x:0,y:0,w:1,h:1}:s.mode==='pin'?{x:.5,y:.5}:{});
  }
  async function selected(s,node,extra={}) {
    if(s.busy)return;const mode=s.mode,page=s.page,epoch=++s.selectionEpoch;
    try {
      const anchor=await A.make(node,mode,extra);
      if(!active(s)||page!==s.page||epoch!==s.selectionEpoch||mode!==s.mode)return;
      s.anchor=anchor;s.clientId=crypto.randomUUID();s.form.hidden=false;
      s.modal.querySelector('[data-selected]').textContent=kinds[mode]+': '+anchor.excerpt;
      status(s,'Location selected. Add your comment.');s.text.focus();draw(s);
    } catch {status(s,'This location could not be selected. Try another content box.',true);}
  }
  async function refresh(s) {
    const token=++s.request,page=s.page;s.rows=[];s.replies=[];s.role=null;renderList(s);draw(s);
    if(!page)return;
    if(!member()) {status(s,'Sign in with an approved team account to view and add feedback.');return;}
    s.refresh.disabled=true;status(s,'Loading feedback…');
    try {const result=await F.list(page);if(!active(s)||token!==s.request)return;s.rows=result.memos;s.replies=result.replies;s.role=result.role;status(s,'');renderList(s);draw(s);}
    catch(e){if(active(s)&&token===s.request)status(s,e.message,true);}
    finally {if(active(s)&&token===s.request)s.refresh.disabled=false;}
  }
  function renderList(s) {
    const filter=s.filter.value, rows=s.rows.filter(r=>filter==='all'||r.resolved===(filter==='resolved'));
    s.list.replaceChildren();s.modal.querySelector('[data-count]').textContent=s.rows.filter(r=>!r.resolved).length+' open';
    if(!rows.length){const p=document.createElement('p');p.className='br-empty';p.textContent=member()?'No '+(filter==='all'?'':filter+' ')+'feedback on this page.':'Team feedback appears here after sign-in.';s.list.append(p);return;}
    rows.forEach(row=>{
      const article=document.createElement('article');article.className='br-comment';article.id='br-'+row.id;
      article.innerHTML=`<div class="br-comment-head"><strong>${esc(row.author_name)}</strong><span>${row.resolved?'Resolved':esc(kinds[row.anchor.kind])}</span></div><time>${esc(new Date(row.created_at).toLocaleString())}</time><button class="br-location" type="button">${esc(row.anchor.excerpt)}</button><p class="br-comment-body">${esc(row.body)}</p><p class="br-anchor-status" role="status"></p><div class="br-replies">${s.replies.filter(r=>r.memo_id===row.id).map(r=>`<div><strong>${esc(r.author_name)}</strong><p>${esc(r.body)}</p></div>`).join('')}</div><div class="br-comment-actions"><button type="button" class="button" data-reply>Reply</button>${s.role==='admin'?`<button type="button" class="button" data-resolve>${row.resolved?'Reopen':'Resolve'}</button>`:''}</div>`;
      article.querySelector('.br-location').onclick=async()=>{
        const node=await A.locate(s.doc,row.anchor);if(!active(s))return;
        if(!node){article.querySelector('.br-anchor-status').textContent='Content changed since this comment. The original location is unavailable.';return;}
        reveal(node);node.scrollIntoView({block:'center',behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});s.selected=row.id;draw(s);
      };
      article.querySelector('[data-reply]').onclick=()=>{
        if(s.modal.querySelector('[data-reply-form]')){status(s,'Post or cancel the open reply first.');return;}
        const form=document.createElement('form');form.dataset.replyForm='';const id=crypto.randomUUID();
        form.innerHTML='<label>Reply<textarea data-reply-text rows="3" maxlength="8000" required></textarea></label><div class="br-comment-actions"><button class="button primary" type="submit">Post reply</button><button class="button" type="button" data-cancel>Cancel</button></div><p role="alert"></p>';
        form.querySelector('[data-cancel]').onclick=()=>form.remove();
        form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');if(s.busy)return;busy(s,true);const page=s.page,owner=window.AIWiseAuth.snapshot().user?.id;
          try{const body=form.querySelector('textarea').value.trim();if(!body)throw Error('Write a reply first.');await F.reply({id,memo_id:row.id,body});if(active(s)&&page===s.page&&owner===window.AIWiseAuth.snapshot().user?.id){form.remove();await refresh(s);}}
          catch(error){if(form.isConnected){form.querySelector('[role=alert]').textContent=error.message;button.disabled=false;}}finally{if(active(s))busy(s,false);}};
        article.append(form);form.querySelector('textarea').focus();
      };
      const resolve=article.querySelector('[data-resolve]');if(resolve)resolve.onclick=async()=>{
        if(dirty()){status(s,'Post or cancel your draft before changing the thread status.',true);return;}
        resolve.disabled=true;try{await F.resolve(row.id,!row.resolved,row.resolved);if(active(s))await refresh(s);}catch(e){if(active(s)){status(s,e.message,true);resolve.disabled=false;}}
      };
      s.list.append(article);
    });
  }
  function marker(s,rect,kind,label,id) {
    const doc=s.doc,shape=doc.createElement('span');shape.className='br-mark br-'+kind;
    Object.assign(shape.style,{left:rect.left+'px',top:rect.top+'px',width:Math.max(rect.width,2)+'px',height:Math.max(rect.height,2)+'px'});s.overlay.append(shape);
    if(label){const b=doc.createElement('button');b.type='button';b.className='br-marker-button';b.textContent=label;b.setAttribute('aria-label','Open feedback '+label);Object.assign(b.style,{left:rect.left+'px',top:rect.top+'px'});b.onclick=()=>{s.selected=id;s.list.querySelector('#br-'+id)?.scrollIntoView({block:'nearest'});s.list.querySelector('#br-'+id+' button')?.focus();draw(s);};s.overlay.append(b);}
  }
  async function draw(s) {
    if(!active(s)||!s.overlay?.isConnected)return;
    const epoch=++s.drawEpoch,doc=s.doc;
    const entries=s.rows.filter(r=>s.filter.value==='all'||r.resolved===(s.filter.value==='resolved')).map((r,i)=>({anchor:r.anchor,id:r.id,label:String(i+1)}));
    if(s.anchor)entries.push({anchor:s.anchor,label:'',id:'draft'});
    const found=await Promise.all(entries.map(async r=>({...r,node:await A.locate(doc,r.anchor)})));
    if(!active(s)||s.doc!==doc||epoch!==s.drawEpoch)return;s.overlay.replaceChildren();
    for(const {node,anchor,id,label} of found){
      const statusNode=s.list.querySelector('#br-'+id+' .br-anchor-status');
      if(statusNode)statusNode.textContent=node?'':'Content changed since this comment. Original location unavailable.';
      if(!node)continue;const r=node.getBoundingClientRect(),win=doc.defaultView;
      if(!r.width||!r.height)continue;
      const origin={left:r.left+win.scrollX,top:r.top+win.scrollY,width:r.width,height:r.height};
      if(anchor.kind==='highlight'){
        const range=A.range(node,anchor);if(!range)continue;
        [...range.getClientRects()].forEach((rect,i)=>marker(s,{left:rect.left+win.scrollX,top:rect.top+win.scrollY,width:rect.width,height:rect.height},'highlight',i===0?label:'',id));
      }else if(anchor.kind==='box')marker(s,{left:origin.left+anchor.x*r.width,top:origin.top+anchor.y*r.height,width:anchor.w*r.width,height:anchor.h*r.height},'box',label,id);
      else if(anchor.kind==='pin')marker(s,{left:origin.left+anchor.x*r.width,top:origin.top+anchor.y*r.height,width:4,height:24},'pin',label,id);
      else marker(s,origin,'comment',label,id);
    }
  }
  async function connect(s) {
    if(!active(s))return;
    let doc,url;try {doc=s.frame.contentDocument;url=new URL(s.frame.contentWindow.location.href);}catch {status(s,'This page cannot be reviewed inside Beta.',true);return;}
    if(s.pendingURL&&url.href!==s.pendingURL)return;
    const navigation=s.navigation;
    await Promise.all([s.frame.contentWindow.AIWiseCommonReady,s.frame.contentWindow.AIWiseCourseReady]);
    if(!active(s)||s.navigation!==navigation||s.frame.contentDocument!==doc||(s.pendingURL&&url.href!==s.pendingURL))return;
    const page=pageKey(url);if(!doc?.body||!page){status(s,'Open a module page to add feedback.',true);return;}
    s.pendingURL=null;s.frameAbort?.abort();s.resize?.disconnect();s.mutation?.disconnect();resetDraft(s);
    s.doc=doc;s.page=page;s.frameAbort=new AbortController();const signal=s.frameAbort.signal;
    s.modal.querySelector('[data-page-title]').textContent=doc.title||'Current Beta';
    const path=page.split('?')[0],select=s.modal.querySelector('[data-page]');
    select.querySelector('[data-current]')?.remove();if(!pages.some(p=>p[0]===path)){const o=new Option(doc.title,path);o.dataset.current='';select.add(o);}select.value=path;
    s.locale.value=url.searchParams.get('lang')==='nl'?'nl':'en';
    const course=url.searchParams.get('course');if(['aws1','ped','other'].includes(course))s.course.value=course;
    s.modal.querySelector('[data-external]').href=new URL(page,root).href;
    const style=doc.createElement('style');style.textContent=`.fb-widget{display:none!important} [data-beta-mode] [data-beta-target]:hover,[data-beta-mode] [data-beta-target]:focus-visible{outline:2px dashed #35617f;outline-offset:3px} [data-beta-mode=box] [data-beta-target],[data-beta-mode=pin] [data-beta-target]{touch-action:none;cursor:crosshair} [data-beta-mode=comment] [data-beta-target]{cursor:crosshair} [data-beta-overlay]{position:absolute;inset:0 auto auto 0;width:100%;height:0;z-index:9000;pointer-events:none}.br-mark{position:absolute;pointer-events:none;box-sizing:border-box}.br-highlight{background:rgba(255,201,55,.38);border-bottom:2px solid #98651a}.br-box,.br-comment{border:2px solid #9b6517;border-radius:4px}.br-comment{border-style:dashed}.br-pin{background:#9b6517;transform:translate(-50%,-100%)}.br-pin:after{content:'';position:absolute;bottom:-6px;left:-4px;border:6px solid transparent;border-top-color:#9b6517;border-bottom:0}.br-marker-button{position:absolute;transform:translate(-8px,-12px);min-width:26px;height:26px;border:2px solid white;border-radius:50%;background:#704812;color:white;font:bold 12px/1 system-ui;pointer-events:auto;cursor:pointer;box-shadow:0 1px 5px #0004}`;doc.head.append(style);
    s.overlay=doc.createElement('div');s.overlay.dataset.betaOverlay='';doc.body.append(s.overlay);
    s.targetTabs=new Map();let targets=[];const targetPicker=s.modal.querySelector('[data-target]');
    const register=()=>{
      targets=A.targets(doc);const selectedPath=targetPicker.value===''?'':targetPicker.selectedOptions[0]?.dataset.path;
      targetPicker.replaceChildren(new Option('Select a location…',''));
      targets.forEach((node,i)=>{
        node.dataset.betaTarget='';if(!s.targetTabs.has(node))s.targetTabs.set(node,node.getAttribute('tabindex'));if(s.mode)node.tabIndex=0;
        const option=new Option((node.textContent.trim()||node.getAttribute('alt')||node.getAttribute('title')||node.tagName).slice(0,90),String(i));
        option.dataset.path=String(i);targetPicker.add(option);if(selectedPath===String(i))targetPicker.value=String(i);
      });
    };
    register();
    targetPicker.onchange=()=>{if(targetPicker.value!=='')selectBox(s,targets[Number(targetPicker.value)]);};
    s.mutation=new doc.defaultView.MutationObserver(records=>{
      if(records.every(r=>(r.target.nodeType===3?r.target.parentElement:r.target).closest?.('[data-beta-overlay]')))return;
      clearTimeout(s.targetTimer);s.targetTimer=setTimeout(()=>{if(active(s)&&s.doc===doc){register();draw(s);}},100);
    });
    s.mutation.observe(doc.querySelector('main')||doc.body,{childList:true,characterData:true,subtree:true});
    const schedule=()=>{clearTimeout(s.drawTimer);s.drawTimer=setTimeout(()=>draw(s),80);};
    s.resize=new doc.defaultView.ResizeObserver(schedule);s.resize.observe(doc.body);
    doc.defaultView.addEventListener('resize',schedule,{signal});doc.addEventListener('scroll',schedule,{signal,capture:true});
    doc.addEventListener('keydown',e=>{
      if(e.key==='Escape'){e.preventDefault();if(s.mode&&!dirty()){resetDraft(s);status(s,'Memo cancelled.');}else requestClose(s);return;}
      if(e.key==='Enter'&&s.mode&&e.target.matches('[data-beta-target]')){
        e.preventDefault();selectBox(s,e.target);
      }
      if(s.mode==='highlight'&&e.key.startsWith('Arrow'))doc.addEventListener('keyup',()=>{try{const v=A.selection(doc);selected(s,v.node,v.extra);}catch{}},{once:true,signal});
    },{signal,capture:true});
    doc.addEventListener('pointerdown',e=>{
      if(!s.mode||e.target.closest('[data-beta-overlay]'))return;const node=A.target(e.target);if(!node||!node.matches('[data-beta-target]'))return;
      if(s.mode==='box'){e.preventDefault();s.drag={node,start:A.point(node,e.clientX,e.clientY)};node.setPointerCapture?.(e.pointerId);}
    },{signal,capture:true});
    doc.addEventListener('pointerup',e=>{
      if(!s.mode||e.target.closest('[data-beta-overlay]'))return;
      if(s.mode==='highlight'){try{const v=A.selection(doc);selected(s,v.node,v.extra);}catch(error){status(s,error.message);}return;}
      const node=s.drag?.node||A.target(e.target);if(!node?.matches('[data-beta-target]'))return;e.preventDefault();
      if(s.mode==='box'){if(!s.drag)return;const box=A.box(s.drag.start,A.point(node,e.clientX,e.clientY));s.drag=null;if(box.w<.005||box.h<.005){status(s,'Drag a larger box, or press Enter on a content box.');return;}selected(s,node,box);}
      else selected(s,node,s.mode==='pin'?A.point(node,e.clientX,e.clientY):{});
    },{signal,capture:true});
    doc.addEventListener('pointercancel',()=>{s.drag=null;},{signal});
    doc.addEventListener('click',e=>{
      if(e.target.closest('[data-beta-overlay]'))return;
      if(s.mode||s.busy){e.preventDefault();e.stopImmediatePropagation();return;}
      const link=e.target.closest('a[href]');if(!link)return;
      const next=new URL(link.href,doc.baseURI);if(next.pathname===url.pathname&&next.search===url.search&&next.hash)return;
      if(dirty()){e.preventDefault();status(s,'Post or cancel your draft before changing pages.',true);return;}
      if(!pageKey(next.href)){e.preventDefault();status(s,'Use “Open page” to follow links outside the module.');return;}
      e.preventDefault();navigate(s,next.href);
    },{signal,capture:true});
    s.modal.querySelector('[data-add]').disabled=!member();refresh(s);
  }
  function navigate(s,url) {
    url=window.AIWiseLanguage.url(url,s.locale.value);
    if(s.busy){status(s,'Saving feedback…');return false;}
    if(dirty()){status(s,'Post or cancel your draft before changing pages.',true);return false;}
    s.selectionEpoch++;s.request++;resetDraft(s);s.rows=[];s.replies=[];renderList(s);s.page=null;s.doc=null;s.navigation=(s.navigation||0)+1;s.frameAbort?.abort();s.modal.querySelector('[data-add]').disabled=true;status(s,'Loading preview…');s.pendingURL=new URL(url,root).href;s.frame.src=url;return true;
  }
  function discardPrompt(s,show) {
    const prompt=s.modal.querySelector('[data-discard]');prompt.hidden=!show;
    [...s.modal.children].forEach(node=>{if(node!==prompt)node.inert=show;});
    if(show)prompt.querySelector('[data-keep]').focus();
    else (s.modal.querySelector('[data-reply-text]')||(!s.form.hidden?s.text:null)||s.modal.querySelector('[data-close]')).focus();
  }
  function requestClose(s) {
    if(s.busy){status(s,'Saving feedback…');return;}
    if(dirty()){discardPrompt(s,true);return;}
    const close=s.onClose;dispose();close();
  }
  function open(part,onClose) {
    dispose();const modal=document.createElement('dialog');modal.className='br-dialog';modal.setAttribute('aria-labelledby','br-title');
    modal.innerHTML=`<div class="br-top"><div><h1 id="br-title">AI-Wise Beta</h1><p data-page-title>Current Beta</p></div><button type="button" class="button" data-close aria-label="Close Beta preview">Close</button></div><div class="br-toolbar"><label>Page<select data-page>${pages.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Course<select data-course><option value="aws1">Academic Writing Skills I</option><option value="ped">Pedagogical Sciences</option><option value="other">Others</option></select></label><label>Language<select data-language><option value="en">English</option><option value="nl">Nederlands</option></select></label><a class="button" data-external target="_blank" rel="noopener">Open page ↗</a><button type="button" class="button primary" data-add aria-pressed="false" disabled>Add memo</button></div><div class="br-tools" role="group" aria-label="Mark feedback location" hidden>${Object.entries(kinds).map(([key,label])=>`<button type="button" class="button" data-mode="${key}" aria-pressed="false">${label}</button>`).join('')}<label class="br-target-label">Content box<select data-target><option value="">Select a location…</option></select></label><button type="button" class="button" data-cancel-memo>Cancel memo</button></div><div class="br-body"><iframe title="AI-Wise Beta module preview" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe><aside class="br-panel" aria-label="Beta feedback"><div class="br-panel-head"><h2>Feedback <span data-count>0 open</span></h2><div><label class="br-filter-label">Show<select data-filter><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></label><button class="button" type="button" data-refresh>Refresh</button></div></div><p class="br-status" role="status" data-status></p><form class="br-compose" data-compose hidden><p data-selected></p><label>Comment<textarea data-comment rows="4" maxlength="8000" required placeholder="Describe the change or question…"></textarea></label><div class="br-comment-actions"><button type="submit" class="button primary">Post comment</button><button type="button" class="button" data-cancel-comment>Cancel</button></div></form><div class="br-list" data-list></div></aside></div><div class="br-discard" data-discard role="alertdialog" aria-labelledby="br-discard-message" hidden><p id="br-discard-message">Discard your unsent feedback and close the preview?</p><button class="button primary" type="button" data-keep>Keep editing</button><button class="button" type="button" data-leave>Discard and close</button></div>`;
    document.body.append(modal);const s=session={modal,onClose,frame:modal.querySelector('iframe'),text:modal.querySelector('[data-comment]'),form:modal.querySelector('[data-compose]'),tools:modal.querySelector('.br-tools'),status:modal.querySelector('[data-status]'),filter:modal.querySelector('[data-filter]'),list:modal.querySelector('[data-list]'),locale:modal.querySelector('[data-language]'),course:modal.querySelector('[data-course]'),refresh:modal.querySelector('[data-refresh]'),rows:[],replies:[],request:0,drawEpoch:0,selectionEpoch:0};
    modal.showModal();window.AIWiseMotion.enter(modal,'dialog');modal.querySelector('[data-close]').focus();
    modal.querySelector('[data-close]').onclick=()=>requestClose(s);modal.addEventListener('cancel',e=>{e.preventDefault();requestClose(s);});
    modal.querySelector('[data-keep]').onclick=()=>discardPrompt(s,false);
    modal.querySelector('[data-leave]').onclick=()=>{resetDraft(s);modal.querySelector('[data-reply-form]')?.remove();requestClose(s);};
    modal.querySelector('[data-add]').onclick=()=>{if(!dirty())setMode(s,'comment');else status(s,'Post or cancel your current draft first.');};
    s.tools.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(s,b.dataset.mode));
    modal.querySelector('[data-cancel-memo]').onclick=modal.querySelector('[data-cancel-comment]').onclick=()=>{resetDraft(s);status(s,'Memo cancelled.');};
    s.filter.onchange=()=>{if(dirty()){status(s,'Post or cancel your draft before filtering.',true);s.filter.value=s.lastFilter||'open';return;}s.lastFilter=s.filter.value;renderList(s);draw(s);};
    s.refresh.onclick=()=>{if(dirty()){status(s,'Post or cancel your draft before refreshing.',true);return;}refresh(s);};
    s.form.onsubmit=async e=>{
      e.preventDefault();if(!s.anchor)return;const button=s.form.querySelector('[type=submit]');if(s.busy)return;busy(s,true);
      const page=s.page,owner=window.AIWiseAuth.snapshot().user?.id;
      try {const body=s.text.value.trim();if(!body)throw Error('Write a comment first.');if(!await A.locate(s.doc,s.anchor))throw Error('Content changed. Select the location again.');await F.add({id:s.clientId,page,anchor:s.anchor,body});if(active(s)&&page===s.page&&owner===window.AIWiseAuth.snapshot().user?.id){resetDraft(s);await refresh(s);status(s,'Comment shared with the team.');}}
      catch(error){if(active(s))status(s,error.message,true);}finally{if(active(s))busy(s,false);}
    };
    const choose=()=>{
      const picker=modal.querySelector('[data-page]'),old=s.page?.split('?')[0],oldCourse=s.page?new URL(s.page,root).searchParams.get('course'):null,oldLocale=s.page?new URL(s.page,root).searchParams.get('lang'):null;
      const moved=navigate(s,new URL(picker.value+'?course='+s.course.value,root).href);
      if(!moved&&old){picker.value=old;if(oldCourse)s.course.value=oldCourse;s.locale.value=oldLocale==='nl'?'nl':'en';}
      if(moved)history.replaceState(null,'',window.AIWiseLanguage.url(location.href,s.locale.value));
    };
    s.locale.value=window.AIWiseLanguage.current();s.locale.onchange=choose;modal.querySelector('[data-page]').onchange=choose;s.course.onchange=()=>{modal.querySelector('[data-page]').value='common/lobby.html';choose();};
    s.frame.addEventListener('load',()=>connect(s));
    s.unsubscribe=window.AIWiseAuth.subscribe(auth=>{
      if(auth.status==='checking' && auth.user?.id===s.owner){modal.querySelector('[data-add]').disabled=true;return;}
      const identity=auth.status+':'+(auth.user?.id||'')+':'+(auth.role||'');s.owner=auth.user?.id;if(identity===s.identity){modal.querySelector('[data-add]').disabled=auth.status!=='member'||!s.doc;return;}s.identity=identity;s.request++;resetDraft(s);s.rows=[];s.replies=[];renderList(s);draw(s);modal.querySelector('[data-add]').disabled=auth.status!=='member'||!s.doc;if(s.page)refresh(s);
    });
    const chapter=['c1','c2','c3'].includes(part)?part:null;
    if(['aws1','ped','other'].includes(part))s.course.value=part;
    navigate(s,new URL((chapter?`common/aiwise-${chapter}-final.html`:'common/lobby.html')+'?course='+s.course.value,root).href);
  }
  function dispose() {const s=session;session=null;if(!s)return;s.request++;s.unsubscribe?.();s.frameAbort?.abort();s.resize?.disconnect();s.mutation?.disconnect();clearTimeout(s.drawTimer);clearTimeout(s.targetTimer);s.modal.close();s.modal.remove();}
  window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
  window.AIWiseBetaReview=Object.freeze({open,dispose,canLeave:()=>{if(session?.busy){status(session,'Saving feedback…');return false;}if(!dirty())return true;discardPrompt(session,true);return false;},pageKey});
})();
