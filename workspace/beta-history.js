/* Compare saved Studio content. Historical feedback keeps its original excerpt. */
(() => {
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 function value(version,item,locale){
  const rows=version.content.filter(r=>r.course===item.course&&r.chapter===item.chapter);
  const row=rows.find(r=>r.locale===locale)||rows.find(r=>r.locale==='en');
  return {content:row?.slots?.[item.key],locale:row?.locale||locale};
 }
 function changed(a,b,item,locale){return stable(value(a,item,locale))!==stable(value(b,item,locale));}
 function text(value){if(value==null)return 'Not included in this version.';if(typeof value==='string')return value;if(Array.isArray(value))return value.map(text).join('\n\n');return Object.entries(value).map(([k,v])=>/^Text |^Heading |^Emphasis |^List text /.test(k)?text(v):k+': '+text(v)).join('\n');}
 function atLocation(anchor,path){return anchor.path===path||anchor.path.startsWith(path+'>');}
 function attach({host,doc,version,draft,page,course,locale,initialItem,initialScope,canSelect,reveal}){
  const rolling=!version;if(rolling&&draft)version={id:null,number:null,content:draft.current_content};
  let live=true,epoch=0,busy=false,versions=version?[version]:[],more=true,items=[],selected=null;
  const owner=window.AIWiseAuth.snapshot().user?.id,abort=new AbortController();
  const valid=()=>live&&window.AIWiseAuth.snapshot().user?.id===owner&&window.AIWiseAuth.snapshot().status==='member';
  async function query(make){
   if(!valid())throw Error('Reopen Beta with your team account.');
   const backend=await window.AIWiseBackend.getClient(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   const cancel=()=>controller.abort();abort.signal.addEventListener('abort',cancel,{once:true});
   try{const {data,error}=await make(backend).abortSignal(controller.signal);if(error)throw Error('History could not be loaded. Please retry.');if(!valid())throw Error('Your account changed. Reopen Beta.');return data;}
   finally{clearTimeout(timer);abort.signal.removeEventListener('abort',cancel);}
  }
  async function all(make){let rows=[],offset=0;while(valid()){const batch=await query(b=>make(b).range(offset,offset+199));rows.push(...batch);if(batch.length<200)return rows;offset+=batch.length;}return [];}
  host.innerHTML='<details class="br-history" open><summary>Changes &amp; history</summary><p data-comparison role="status"></p><label class="br-change-toggle"><input type="checkbox" data-mark-changes checked> Highlight changes</label><label class="br-item-label" for="br-history-item">Content item</label><select id="br-history-item" data-history-item disabled><option>Select an item…</option></select><div data-item-detail></div><button type="button" class="button" data-older hidden>Load earlier versions</button><p role="status" data-history-status></p></details>';
  const details=host.querySelector('details'),picker=host.querySelector('[data-history-item]'),content=host.querySelector('[data-item-detail]'),message=host.querySelector('[data-history-status]'),older=host.querySelector('[data-older]'),comparison=host.querySelector('[data-comparison]'),toggle=host.querySelector('[data-mark-changes]');
  const style=doc.createElement('style');style.textContent='[data-review-changed]{outline:2px solid #a87c1d;outline-offset:4px;background-color:#fff4ce55} body:not([data-beta-mode]) [data-review-item]{cursor:pointer} [data-review-selected]{outline:3px solid #35617f!important;outline-offset:5px}';doc.head.append(style);
  function mark(){items.forEach(item=>{item.node.toggleAttribute('data-review-changed',!!toggle.checked&&!!item.changed);});}
  toggle.onchange=mark;
  function paintItem(){
   const item=selected;if(!item)return;
   const current=value(version,item,locale),previous=versions[1]?value(versions[1],item,locale):null;
   content.innerHTML=`<h3>${esc(item.title)}</h3><p class="br-history-note">${item.course==='common'?'Common Studio':'Content Studio'}${current.locale!==locale?' · Saved English fallback':''}</p>${previous?`<details class="br-value" open><summary>${item.changed?'Changed':'Unchanged'} since V${versions[1].number}</summary>${item.changed?`<h4>Before · V${versions[1].number}</h4><pre>${esc(text(previous.content))}</pre>`:''}<h4>${rolling?'Next release':'This version · V'+version.number}</h4><pre>${esc(text(current.content))}</pre></details>`:`<pre>${esc(text(current.content))}</pre>`}<div data-history-review></div><h4>Earlier versions</h4><div data-version-history>${versions.slice(1).map(v=>`<details class="br-value"><summary>V${v.number} · ${esc(v.created_at?.slice(0,10))}</summary><p>${esc(v.author_name)} · ${esc(new Date(v.created_at).toLocaleDateString())}</p><pre>${esc(text(value(v,item,locale).content))}</pre></details>`).join('')||'<p>No earlier saved version.</p>'}</div><h4>Earlier feedback at this location</h4><p class="br-history-note">Original quotes are shown below. Check them if the page layout has changed.</p><div data-item-feedback>Loading feedback…</div>`;
   older.hidden=!more;loadFeedback(item,++epoch);loadCheck(item,epoch);
  }
  async function loadCheck(item,token){
   if(!window.AIWiseBetaChecklist)return;const host=content.querySelector('[data-history-review]');
   try{const data=await window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:version.id});if(rolling&&data.fingerprint!==draft.fingerprint)throw Error('Approved content changed. Reopen this preview before marking it reviewed.');if(!valid()||token!==epoch)return;
    if(!data.changes.some(c=>c.course===item.course&&c.chapter===item.chapter&&c.locale===locale&&c.key===item.key))return;
    const check=data.checks.find(c=>c.course===item.course&&c.chapter===item.chapter&&c.locale===locale&&c.item_key===item.key);
    host.innerHTML=`<p class="beta-review-summary">${check?.reviewed?'✓ Reviewed by '+esc(check.reviewer_name):'Needs review'}</p><button class="button" type="button">${check?.reviewed?'Mark as needs review':'Mark reviewed'}</button><p role="status"></p>`;
    const button=host.querySelector('button');button.onclick=async()=>{if(!valid()||!canSelect())return;button.disabled=true;try{await window.AIWiseBetaChecklist.request(rolling?'workspace_check_beta_draft_item':'workspace_check_beta_item',{...(rolling?{p_fingerprint:draft.fingerprint}:{p_version:version.id}),p_course:item.course,p_chapter:item.chapter,p_locale:locale,p_key:item.key,p_reviewed:!check?.reviewed,p_expected:check?.updated_at||null});if(valid()&&token===epoch)await loadCheck(item,token);}catch(e){if(valid()&&token===epoch)host.querySelector('[role=status]').textContent=e.message;}finally{if(valid())button.disabled=false;}};
   }catch(e){if(valid()&&token===epoch){host.textContent=e.message;const retry=document.createElement('button');retry.className='button';retry.type='button';retry.textContent='Retry review status';retry.onclick=()=>loadCheck(item,token);host.append(retry);}}
  }
  async function loadFeedback(item,token){
   const ids=versions.slice(1).map(v=>v.id),target=content.querySelector('[data-item-feedback]');
   if(!ids.length){target.textContent='No earlier feedback.';return;}
   try{
    const rows=await all(b=>b.from('workspace_beta_memos').select('id,page,version_id,body,author_name,created_at,resolved,anchor').eq('page',page).in('version_id',ids).order('created_at',{ascending:false}).order('id'));
    if(!valid()||token!==epoch)return;
    const memos=rows.filter(row=>atLocation(row.anchor,item.path));
    target.innerHTML=memos.map(row=>`<article class="br-past-memo"><strong>${esc(row.author_name)}</strong><small>V${versions.find(v=>v.id===row.version_id)?.number} · ${row.resolved?'Resolved':'Open'}</small><blockquote>${esc(row.anchor.quote||row.anchor.excerpt)}</blockquote><p>${esc(row.body)}</p><a href="#beta/${row.version_id}?page=${encodeURIComponent(page)}&memo=${row.id}">Open thread →</a></article>`).join('')||'<p>No earlier feedback at this location in the loaded versions.</p>';
   }catch(e){if(valid()&&token===epoch){target.textContent=e.message;const retry=document.createElement('button');retry.className='button';retry.textContent='Retry feedback';retry.type='button';retry.onclick=()=>loadFeedback(item,++epoch);target.append(retry);}}
  }
  function choose(item,scroll=true){
   if(!item||!canSelect())return;selected=item;details.open=true;picker.value=item.id;items.forEach(i=>i.node.toggleAttribute('data-review-selected',i===item));paintItem();host.scrollIntoView({block:'nearest',behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});
   if(scroll){reveal(item.node);item.node.scrollIntoView({block:'center',behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});}
  }
  picker.onchange=()=>{if(!canSelect()){picker.value=selected?.id||'';message.textContent='Post or cancel your draft before opening item history.';return;}message.textContent='';choose(items.find(i=>i.id===picker.value));};
  doc.addEventListener('click',event=>{if(!canSelect()||event.target.closest('a,button,input,select,textarea,summary,[data-beta-overlay]'))return;const node=event.target.closest('[data-review-item]');if(node)choose(items.find(i=>i.node===node),false);},{signal:abort.signal});
  async function loadOlder(initial=false){
   if(busy)return;busy=true;older.disabled=true;message.textContent='Loading version history…';
   try{const rows=rolling&&initial&&!draft.previous_id?[]:await query(b=>{let q=b.from('workspace_beta_versions').select('*');if(rolling||version.published_at)q=q.not('published_at','is',null);if(versions.at(-1).number)q=q.lt('number',versions.at(-1).number);else if(rolling&&draft.previous_number)q=q.lt('number',draft.previous_number+1);return q.order('number',{ascending:false}).limit(initial?1:5);});if(!valid())return;
    versions.push(...rows);more=rows.length===(initial?1:5);
    if(initial){
     const chapter=doc.querySelector('[data-current-block]')?.dataset.currentBlock||(doc.querySelector('[data-anatomy-copy]')?'map':null);
     const nodes=[...doc.querySelectorAll('[data-review-common-key],[data-slot]')].filter(node=>node!==doc.body&&doc.body.contains(node));
     items=nodes.map((node,index)=>{const common=node.hasAttribute('data-review-common-key'),key=common?node.dataset.reviewCommonKey:node.dataset.slot;
      if(node.dataset.anatomyCopy)node=[...doc.querySelectorAll('#nodes [data-id]')].find(n=>n.getAttribute('data-id')===node.dataset.anatomyCopy)||node;return {id:String(index),node,key,chapter:common?chapter:key.split('.')[0],course:common?'common':course,path:window.AIWiseBetaAnchors.path(node),title:(node.textContent.trim().replace(/\s+/g,' ')||node.getAttribute('aria-label')||'Supporting content').slice(0,90)};}).filter(item=>value(version,item,locale).content!==undefined);
     items.forEach(item=>{item.changed=!versions[1]||changed(version,versions[1],item,locale);item.node.dataset.reviewItem=item.id;});
     items.sort((a,b)=>Number(b.changed)-Number(a.changed));
     picker.innerHTML='<option value="">Select an item…</option>'+items.map(item=>`<option value="${item.id}">${item.changed?'Changed · ':''}${esc(item.title)}</option>`).join('');picker.disabled=!items.length;
     const count=items.filter(i=>i.changed).length;comparison.textContent=!items.length?'This page has no Studio content to compare.':versions[1]?`${count} changed ${count===1?'item':'items'} since V${versions[1].number}. Select an item to view its history.`:'First publication. All approved content needs review.';toggle.disabled=!count;mark();if(initialItem){const target=items.find(i=>i.key===initialItem&&(!initialScope||i.course===initialScope));if(target)choose(target);else message.textContent='This item is not visible on this page. Its before/after text is available in the review checklist.';initialItem=null;}
    }
    older.hidden=!more||!selected;if(!message.textContent.startsWith('This item'))message.textContent='';if(selected)paintItem();
   }catch(e){if(valid()){message.textContent=e.message;older.hidden=false;older.textContent='Retry history';}}
   finally{busy=false;if(valid())older.disabled=false;}
  }
  older.onclick=()=>loadOlder(items.length===0);
  if(version)loadOlder(true);else{comparison.textContent='Reopen Beta to load the approved content and review changes.';picker.hidden=true;host.querySelector('.br-item-label').hidden=true;toggle.parentElement.hidden=true;}
  return {dispose(){live=false;epoch++;abort.abort();style.remove();items.forEach(item=>['data-review-changed','data-review-selected','data-review-item'].forEach(attr=>item.node.removeAttribute(attr)));host.replaceChildren();}};
 }
 window.AIWiseBetaHistory=Object.freeze({attach,value,changed,atLocation});
})();
