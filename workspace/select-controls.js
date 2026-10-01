/* Progressive enhancement: original selects remain the form/data contract. */
(() => {
 'use strict';
 const controls=new Map();let opened=null,nextId=0,scheduled=false;
 const disabled=o=>o.disabled||o.parentElement?.tagName==='OPTGROUP'&&o.parentElement.disabled;
 function label(select){
  const explicit=select.getAttribute('aria-label');if(explicit)return explicit;
  const ids=select.getAttribute('aria-labelledby');if(ids)return ids.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
  const labels=select.labels?.length?[...select.labels]:[...document.querySelectorAll('label')].filter(l=>l.getAttribute('for')===select.id&&select.id||l.contains(select));
  return labels.map(l=>{const c=l.cloneNode(true);c.querySelectorAll('select,.aw-select').forEach(n=>n.remove());return c.textContent.trim();}).join(' ')||select.title||'Choose an option';
 }
 function close(restore=false){
  if(!opened)return;const c=opened;opened=null;c.button.setAttribute('aria-expanded','false');c.button.removeAttribute('aria-activedescendant');
  if(c.popup?.hidePopover)try{c.popup.hidePopover();}catch{}c.popup?.remove();c.popup=null;if(restore&&c.button.isConnected)c.button.focus({preventScroll:true});
 }
 function sync(c,structural=false){
  const s=c.select;if(!s.isConnected){if(opened===c)close();controls.delete(s);return;}
  const selected=s.options[s.selectedIndex],name=structural||!c.name?(c.name=label(s)):c.name,hidden=s.hidden||s.style.display==='none';
  c.wrap.hidden=hidden;c.button.disabled=s.matches(':disabled');
  const text=selected?.label||selected?.textContent||'Choose…';if(c.text.textContent!==text)c.text.textContent=text;
  c.button.setAttribute('aria-label',name);c.button.title=text;c.button.setAttribute('aria-required',String(s.required));
  const described=s.getAttribute('aria-describedby');if(described)c.button.setAttribute('aria-describedby',described);else c.button.removeAttribute('aria-describedby');
  if(c.invalid&&s.validity?.valid){c.button.removeAttribute('aria-invalid');c.error.remove();c.invalid=false;}
  const signature=[...s.options].map(o=>[o.label||o.textContent,o.value,o.selected,disabled(o),o.hidden,o.parentElement?.label].join('\u0001')).join('\u0002');
  if(opened===c){if(hidden||c.button.disabled||!c.button.getClientRects().length)close();else if(signature!==c.signature){c.active=s.selectedIndex;draw(c);}}
  c.signature=signature;
 }
 function visibleOptions(c){const term=(c.search?.value||'').trim().toLocaleLowerCase();return [...c.select.options].map((o,i)=>({o,i})).filter(({o})=>!o.hidden&&(!term||(o.label||o.textContent).toLocaleLowerCase().includes(term)));}
 function position(c){
  if(!c.popup)return;const rect=c.button.getBoundingClientRect(),viewport=window.visualViewport;
  const width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0;
  if(rect.bottom<top||rect.top>top+height){close();return;}
  const menuWidth=Math.min(Math.max(rect.width,240),width-24),below=top+height-rect.bottom-12,above=rect.top-top-12,up=below<220&&above>below;
  const available=Math.max(90,Math.min(360,up?above:below));
  Object.assign(c.popup.style,{width:menuWidth+'px',maxHeight:available+'px',left:Math.max(left+12,Math.min(rect.left,left+width-menuWidth-12))+'px',top:(up?Math.max(top+12,rect.top-Math.min(c.popup.scrollHeight,available)-6):rect.bottom+6)+'px'});
 }
 function highlight(c){
  c.list.querySelectorAll('[role=option]').forEach(n=>n.classList.toggle('is-active',Number(n.dataset.index)===c.active));
  const node=c.list.querySelector(`[data-index="${c.active}"]`);for(const input of [c.button,c.search].filter(Boolean)){if(node)input.setAttribute('aria-activedescendant',node.id);else input.removeAttribute('aria-activedescendant');}node?.scrollIntoView?.({block:'nearest'});
 }
 function draw(c){
  const rows=visibleOptions(c);c.list.replaceChildren();let group=null,container=c.list;
  for(const {o,i}of rows){
   const parent=o.parentElement?.tagName==='OPTGROUP'?o.parentElement:null;
   if(parent!==group){group=parent;container=c.list;if(group){container=document.createElement('div');container.setAttribute('role','group');container.setAttribute('aria-label',group.label);const heading=document.createElement('div');heading.className='aw-select-group';heading.textContent=group.label;heading.setAttribute('aria-hidden','true');container.append(heading);c.list.append(container);}}
   const option=document.createElement('div');option.id=c.id+'-option-'+i;option.className='aw-select-option';option.dataset.index=i;option.setAttribute('role','option');option.setAttribute('aria-selected',String(i===c.select.selectedIndex));option.setAttribute('aria-disabled',String(disabled(o)));
   const text=document.createElement('span');text.textContent=o.label||o.textContent;const check=document.createElement('span');check.className='aw-select-check';check.textContent=i===c.select.selectedIndex?'✓':'';check.setAttribute('aria-hidden','true');option.append(text,check);container.append(option);
  }
  if(!rows.length){const p=document.createElement('p');p.className='aw-select-empty';p.setAttribute('role','status');p.textContent='No matching options';c.list.append(p);}
  if(!rows.some(r=>r.i===c.active&&!disabled(r.o)))c.active=rows.find(r=>!disabled(r.o))?.i??-1;highlight(c);position(c);
 }
 function choose(c,index){
  const option=c.select.options[index];if(!option||disabled(option)||c.button.disabled)return;const previous=c.select.selectedIndex;c.select.selectedIndex=index;close(true);sync(c);
  if(previous!==index){c.select.dispatchEvent(new Event('input',{bubbles:true}));c.select.dispatchEvent(new Event('change',{bubbles:true}));queueMicrotask(scan);}
 }
 function key(c,e){
  if(e.key==='Escape'&&opened===c){e.preventDefault();e.stopPropagation();close(true);return;}
  if(e.key==='Tab'&&opened===c){close(true);return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)&&!(e.target===c.search&&['Home','End'].includes(e.key))){
   e.preventDefault();e.stopPropagation();if(opened!==c){open(c);return;}const rows=visibleOptions(c).filter(r=>!disabled(r.o));let i=rows.findIndex(r=>r.i===c.active);
   i=e.key==='Home'?0:e.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,i+(e.key==='ArrowDown'?1:-1)));c.active=rows[i]?.i??-1;highlight(c);return;
  }
  if(e.key==='Enter'||e.key===' '&&e.target!==c.search){e.preventDefault();e.stopPropagation();if(opened===c)choose(c,c.active);else open(c);return;}
  if(e.target!==c.search&&e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(opened!==c)open(c);if(c.search){c.search.value+=e.key;draw(c);return;}const now=Date.now();c.typed=(now-c.typedAt<700?c.typed||'':'')+e.key.toLocaleLowerCase();c.typedAt=now;const rows=visibleOptions(c).filter(r=>!disabled(r.o));const found=rows.find(r=>(r.o.label||r.o.textContent).toLocaleLowerCase().startsWith(c.typed));if(found){c.active=found.i;highlight(c);}}
 }
 function open(c){
  if(c.button.disabled||c.wrap.hidden)return;if(opened===c){close();return;}close();opened=c;c.active=c.select.selectedIndex;
  const popup=document.createElement('div');popup.className='aw-select-popup';popup.setAttribute('popover','manual');c.popup=popup;c.search=null;
  if(c.select.options.length>8){const search=document.createElement('input');search.type='search';search.className='aw-select-search';search.placeholder='Find an option…';search.setAttribute('role','combobox');search.setAttribute('aria-label','Search '+label(c.select));search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-expanded','true');search.setAttribute('aria-controls',c.id+'-list');search.autocomplete='off';search.oninput=()=>draw(c);search.onkeydown=e=>key(c,e);popup.append(search);c.search=search;}
  c.list=document.createElement('div');c.list.id=c.id+'-list';c.list.className='aw-select-list';c.list.setAttribute('role','listbox');c.list.setAttribute('aria-label',label(c.select));popup.append(c.list);
  (c.button.closest('dialog')||document.body).append(popup);if(popup.showPopover)popup.showPopover();else popup.classList.add('aw-select-fallback');
  c.button.setAttribute('aria-expanded','true');draw(c);(c.search||c.button).focus({preventScroll:true});
  popup.addEventListener('pointerdown',e=>{if(e.target.closest('[role=option]'))e.preventDefault();});
  popup.onclick=e=>{const option=e.target.closest('[role=option]');if(option)choose(c,Number(option.dataset.index));};
 }
 function enhance(select){
  if(controls.has(select)||select.multiple||select.hasAttribute('multiple')||select.size>1||select.hasAttribute('data-native-select'))return;
  const id='aw-select-'+(++nextId),wrap=document.createElement('span');wrap.className='aw-select';
  const button=document.createElement('button');button.type='button';button.className='aw-select-trigger';button.id=id;button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id+'-list');
  const text=document.createElement('span');text.className='aw-select-value';button.append(text);const arrow=document.createElement('span');arrow.className='aw-select-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';button.append(arrow);
  select.before(wrap);wrap.append(select,button);select.classList.add('aw-select-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
  const c={select,wrap,button,text,id,signature:'',active:-1};controls.set(select,c);
  button.onclick=()=>open(c);button.onkeydown=e=>key(c,e);select.addEventListener('change',()=>sync(c));select.addEventListener('focus',()=>button.focus());
  select.addEventListener('invalid',e=>{e.preventDefault();button.setAttribute('aria-invalid','true');if(!c.invalid){c.error=document.createElement('span');c.error.className='aw-select-error';c.error.setAttribute('role','alert');wrap.append(c.error);c.invalid=true;}c.error.textContent=select.validationMessage||'Choose an option.';button.focus();});
  sync(c);
 }
 function scan(){scheduled=false;document.querySelectorAll('select').forEach(enhance);for(const c of controls.values())sync(c,true);}
 const observer=new MutationObserver(records=>{if(!records.some(r=>r.target.tagName==='SELECT'||r.target.tagName==='OPTION'||r.target.tagName==='OPTGROUP'||r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('select,option,optgroup')||n.querySelector?.('select')))))return;if(!scheduled){scheduled=true;queueMicrotask(scan);}});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','hidden','selected','label','value','required','aria-label','aria-labelledby','aria-describedby']});
 document.addEventListener('pointerdown',e=>{if(opened&&!opened.wrap.contains(e.target)&&!opened.popup?.contains(e.target))close();},true);
 document.addEventListener('click',e=>{const l=e.target.closest('label');if(!l||e.target.closest('.aw-select'))return;const select=l.control||l.querySelector('select');const c=controls.get(select);if(c){e.preventDefault();c.button.focus();}});
 document.addEventListener('reset',()=>queueMicrotask(scan));
 window.addEventListener('resize',()=>{if(opened)position(opened);});window.addEventListener('scroll',e=>{if(opened&&!opened.popup.contains(e.target))position(opened);},true);
 window.addEventListener('blur',()=>close());
 // Programmatic .value changes do not emit DOM events; keep the visual mirror current.
 setInterval(()=>{if(!document.hidden)for(const c of controls.values())sync(c);},250);
 window.AIWiseSelectControls=Object.freeze({refresh:scan,close});scan();
})();
