/* Compare saved Studio content. Historical feedback keeps its original excerpt. */
(() => {
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
 function value(version,item,locale){
  // Versions saved before the bachelor structure name the same scope "aws1" or "ped".
  const scope=window.AIWiseCourseRegistry.scope(item.course);
  const rows=version.content.filter(r=>window.AIWiseCourseRegistry.scope(r.course)===scope&&r.chapter===item.chapter);
  const row=rows.find(r=>r.locale===locale)||rows.find(r=>r.locale==='en');
  return {content:row?.slots?.[item.key],locale:row?.locale||locale};
 }
 function changed(a,b,item,locale){return stable(value(a,item,locale))!==stable(value(b,item,locale));}
 function atLocation(anchor,path){return anchor.path===path||anchor.path.startsWith(path+'>');}
 function attach({host,doc,version,draft,page,course,locale,initialItem,initialScope,onReviewed=()=>{},onViewed=()=>{},canSelect,reveal}){
  const rolling=!version;if(rolling&&draft)version={id:null,number:null,content:draft.current_content};
  let live=true,epoch=0,busy=false,versions=version?[version]:[],items=[],selected=null,closeDetails=null,sections=[];
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
  host.innerHTML='<details class="br-history" open><summary>Selected change</summary><p data-comparison role="status"></p><label class="br-change-toggle"><input type="checkbox" data-mark-changes checked> Highlight changes</label><label class="br-item-label" for="br-history-item">Section</label><select id="br-history-item" data-history-item disabled><option>Choose a section…</option></select><div data-item-detail></div><button type="button" class="button" data-older hidden>Load earlier versions</button><p role="status" data-history-status></p></details>';
  const details=host.querySelector('details'),picker=host.querySelector('[data-history-item]'),content=host.querySelector('[data-item-detail]'),message=host.querySelector('[data-history-status]'),older=host.querySelector('[data-older]'),comparison=host.querySelector('[data-comparison]'),toggle=host.querySelector('[data-mark-changes]');
  const style=doc.createElement('style');style.textContent='[data-review-changed]{outline:2px solid #a87c1d;outline-offset:4px;background-color:#fff4ce55} body:not([data-beta-mode]) [data-review-item]{cursor:pointer} [data-review-selected]{outline:3px solid #35617f!important;outline-offset:5px}';doc.head.append(style);
  function mark(){items.forEach(item=>{item.node.toggleAttribute('data-review-changed',!!toggle.checked&&!!item.changed);});}
  toggle.onchange=mark;
  function paintItem(){
   const item=selected;if(!item)return;
   const current=value(version,item,locale),previous=versions[1]?value(versions[1],item,locale):null;
   const delta=window.AIWiseBetaItemDetails.changes(previous?.content,current.content);
   content.innerHTML=`<h3>${esc(item.title)}</h3><p class="br-history-note">${delta.length?delta.length+' changed '+(delta.length===1?'field':'fields'):'No text changes'}${versions[1]?' · since V'+versions[1].number:''}</p>${window.AIWiseBetaItemDetails.comparison(delta.slice(0,2),true)}${delta.length>2?`<p class="br-history-note">+ ${delta.length-2} more in details</p>`:''}<button type="button" class="button br-item-details" data-item-details>View details &amp; history ↗</button><div data-history-review></div>`;
   content.querySelector('[data-item-details]').onclick=()=>{if(!valid()||!canSelect())return;closeDetails?.();closeDetails=window.AIWiseBetaItemDetails.open({item,locale,version,baseline:versions[1]||null,rolling,page,all,valid,ensureCurrent:async()=>{if(!rolling)return;const current=await query(b=>b.rpc('workspace_beta_review_context',{p_version:null}));if(current.fingerprint!==draft.fingerprint)throw Error('Approved content changed. Reopen this version to see its latest history.');}});};
   older.hidden=true;loadCheck(item,++epoch);
  }
  async function loadCheck(item,token){
   if(!window.AIWiseBetaChecklist)return;const host=content.querySelector('[data-history-review]');
   try{const data=await window.AIWiseBetaChecklist.request('workspace_beta_review_context',{p_version:version.id});if(rolling&&data.fingerprint!==draft.fingerprint)throw Error('Approved content changed. Reopen this preview before marking it reviewed.');if(!valid()||token!==epoch)return;
    if(!data.changes.some(c=>c.course===item.course&&c.chapter===item.chapter&&c.locale===locale&&c.key===item.key))return;
    const check=data.checks.find(c=>c.course===item.course&&c.chapter===item.chapter&&c.locale===locale&&c.item_key===item.key);
    host.innerHTML=`<p class="beta-review-summary">${check?.reviewed?'✓ Reviewed by '+esc(check.reviewer_name):'Needs review'}</p><button class="button" type="button">${check?.reviewed?'Mark as needs review':'Mark reviewed'}</button><p role="status"></p>`;
    const button=host.querySelector('button');button.onclick=async()=>{if(!valid()||!canSelect())return;button.disabled=true;try{await window.AIWiseBetaChecklist.request(rolling?'workspace_check_beta_draft_item':'workspace_check_beta_item',{...(rolling?{p_fingerprint:draft.fingerprint}:{p_version:version.id}),p_course:item.course,p_chapter:item.chapter,p_locale:locale,p_key:item.key,p_reviewed:!check?.reviewed,p_expected:check?.updated_at||null});if(valid()&&token===epoch){await loadCheck(item,token);onReviewed();}}catch(e){if(valid()&&token===epoch)host.querySelector('[role=status]').textContent=e.message;}finally{if(valid())button.disabled=false;}};
   }catch(e){if(valid()&&token===epoch){host.textContent=e.message;const retry=document.createElement('button');retry.className='button';retry.type='button';retry.textContent='Retry review status';retry.onclick=()=>loadCheck(item,token);host.append(retry);}}
  }
  function choose(item,scroll=true,focusPanel=true){
   if(!item||!canSelect())return;closeDetails?.();selected=item;details.open=true;picker.value=window.AIWisePreviewSections.group(item.node,sections)?.id||'';items.forEach(i=>i.node.toggleAttribute('data-review-selected',i===item));paintItem();onViewed(item);if(focusPanel)host.scrollIntoView({block:'nearest',behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});
   if(scroll){reveal(item.node);const view=doc.defaultView;view.scrollTo({top:Math.max(0,view.scrollY+item.node.getBoundingClientRect().top-view.innerHeight/2+item.node.getBoundingClientRect().height/2),behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});}
  }
  picker.onchange=()=>{if(!canSelect()){message.textContent='Post or cancel your draft before changing sections.';return;}const section=sections.find(r=>r.id===picker.value);if(!section)return;reveal(section.node);section.node.scrollIntoView({block:'start',behavior:window.AIWiseMotion.reduced()?'auto':'smooth'});message.textContent='Choose an update above, or select content in this section.';};
  doc.addEventListener('click',event=>{if(!canSelect()||event.target.closest('a,button,input,select,textarea,summary,[role=button],[onclick],.fn-card-title,.sl-item-title,.technique-tab,.critique-stepper-tab,[data-beta-overlay]'))return;const node=event.target.closest('[data-review-item]');if(node)choose(items.find(i=>i.node===node),false);},{signal:abort.signal});
  async function loadOlder(initial=false){
   if(busy)return;busy=true;older.disabled=true;message.textContent='Loading version history…';
   try{let rows,context;
    if(initial){
     context=rolling?draft:await query(b=>b.rpc('workspace_beta_review_context',{p_version:version.id}));
     rows=context.previous_id?await query(b=>b.from('workspace_beta_versions').select('*').eq('id',context.previous_id).limit(1)):[];
     if(context.previous_id&&!rows.length)throw Error('The comparison version could not be loaded. Please retry.');
    }else rows=await query(b=>b.from('workspace_beta_versions').select('*').lt('number',versions.at(-1).number).order('number',{ascending:false}).limit(5));
    if(!valid())return;
    versions.push(...rows);
    if(initial){
     const chapter=doc.querySelector('[data-current-block]')?.dataset.currentBlock||(doc.querySelector('[data-anatomy-copy]')?'map':null);
     const nodes=[...doc.querySelectorAll('[data-review-common-key],[data-slot]')].filter(node=>node!==doc.body&&doc.body.contains(node));
     // Items carry the scope id the shown version was saved with, so its changes and checks match.
     const scope=version.content.find(r=>window.AIWiseCourseRegistry.scope(r.course)===course)?.course||course;
     items=nodes.map((node,index)=>{const common=node.hasAttribute('data-review-common-key'),key=common?node.dataset.reviewCommonKey:node.dataset.slot;
      if(node.dataset.anatomyCopy)node=[...doc.querySelectorAll('#nodes [data-id]')].find(n=>n.getAttribute('data-id')===node.dataset.anatomyCopy)||node;return {id:String(index),node,key,chapter:common?chapter:key.split('.')[0],course:common?'common':scope,path:window.AIWiseBetaAnchors.path(node),title:window.AIWisePreviewSections.title(node)||'Supporting content'};}).filter(item=>value(version,item,locale).content!==undefined);
     items.forEach(item=>{item.changed=!versions[1]||changed(version,versions[1],item,locale);item.node.dataset.reviewItem=item.id;item.node.dataset.reviewContentKey=item.key;item.node.dataset.reviewContentCourse=item.course;});
     items.sort((a,b)=>Number(b.changed)-Number(a.changed));
     sections=window.AIWisePreviewSections.sections(doc);
     picker.innerHTML='<option value="">Choose a section…</option>'+sections.map(section=>{const count=items.filter(i=>i.changed&&window.AIWisePreviewSections.group(i.node,sections)===section).length;return `<option value="${section.id}">${esc(section.title)}${count?' · '+count+' updates':''}</option>`;}).join('');picker.disabled=!sections.length;
     const count=items.filter(i=>i.changed).length;comparison.textContent=!items.length?'This page has no Studio content to compare.':versions[1]?`${count} changed ${count===1?'item':'items'} since V${versions[1].number}${versions[1].published_at?'':' (review snapshot)'}. Choose a section or select an update above.`:'No earlier comparison version. All included content needs review.';toggle.disabled=!count;mark();if(initialItem){const target=items.find(i=>i.key===initialItem&&(!initialScope||i.course===initialScope));if(target)choose(target,true,false);else {const row=(context.changes||[]).find(r=>r.key===initialItem&&(!initialScope||r.course===initialScope)&&r.locale===locale);if(row){selected={...row,title:row.key,path:'',id:'missing'};paintItem();onViewed(selected);}else message.textContent='This item is not available on this page.';}initialItem=null;}
    }
    older.hidden=true;if(!message.textContent.startsWith('This item'))message.textContent='';if(selected?.node)paintItem();
   }catch(e){if(valid()){message.textContent=e.message;older.hidden=false;older.textContent='Retry history';}}
   finally{busy=false;if(valid())older.disabled=false;}
  }
  older.onclick=()=>loadOlder(items.length===0);
  if(version)loadOlder(true);else{comparison.textContent='Reopen Beta to load the approved content and review changes.';picker.hidden=true;host.querySelector('.br-item-label').hidden=true;toggle.parentElement.hidden=true;}
  return {refreshReview(){if(selected?.node)paintItem();},dispose(){live=false;closeDetails?.();epoch++;abort.abort();style.remove();items.forEach(item=>['data-review-changed','data-review-selected','data-review-item','data-review-content-key','data-review-content-course'].forEach(attr=>item.node.removeAttribute(attr)));host.replaceChildren();}};
 }
 window.AIWiseBetaHistory=Object.freeze({attach,value,changed,atLocation});
})();
