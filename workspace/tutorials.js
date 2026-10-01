/* Local, account-scoped guide preferences. No content, authentication or permission writes. */
(() => {
 'use strict';
 const guides=window.AIWiseTutorialContent.guides,seen=new Set();let dialog=null,session=null,queued=false,lastContext='',lastOwner='';
 const auth=()=>window.AIWiseAuth?.snapshot()||{status:'signed-out'},identity=a=>(a.user?.id||'guest')+':'+(a.role||'guest');
 const key=(a,id)=>'aiwise_guides_v1:'+identity(a)+':'+id;
 const visited=(a,id)=>{const k=key(a,id);try{return seen.has(k)||localStorage.getItem(k)==='seen';}catch{return seen.has(k);}};
 function remember(a,id){const k=key(a,id);seen.add(k);try{localStorage.setItem(k,'seen');}catch{}}
 function context(){
  const a=auth();if(a.status!=='member')return 'login';
  if(document.querySelector('#my-page[open]'))return 'my-page';if(document.querySelector('#aw-account-dialog[open]'))return 'account';
  if(document.body.classList.contains('profiler-page'))return 'profiler';
  const [area='home',part='']=location.hash.slice(1).split('/');
  if(area==='beta'&&location.hash.includes('publish=1'))return 'release';
  if(area==='beta')return document.querySelector('.br-page')||/^(current|[a-f0-9-]{36})(?:\?|$)/.test(part)?'beta-preview':'beta';
  if(['common','studio'].includes(area))return document.querySelector('#cs-studio')||(area==='common'?['c1','c2','c3','map']:['aws1','ped','other']).includes(part)?area+'-editor':area;
  if(area==='tower')return part==='release'||location.hash==='#tower/new/release'?'release':'tower';
  if(a.role==='member')return 'beta';
  return Object.hasOwn(guides,area)?area:'home';
 }
 function cards(id,a){const list=guides[id].cards.slice();if(id==='beta'&&a.role==='admin')list.push(window.AIWiseTutorialContent.card('Create a focused review','Save the currently approved content before a team review.',['Choose New review version and give it a clear name.','After review, use Publish to students for a separate release approval.']));return list;}
 function close(mark=true){
  if(!session)return;const s=session;if(mark)remember(s.auth,s.id);session=null;dialog.close();dialog.remove();dialog=null;
  if(s.trigger?.isConnected)s.trigger.focus({preventScroll:true});else document.querySelector('[data-guide-trigger]')?.focus({preventScroll:true});
 }
 function show(id,trigger){
  const a=auth();if(!guides[id]||a.status==='checking')return;
  if(a.status!=='member'&&id!=='login')return;
  if(a.role==='member'&&!['login','welcome-member','beta','beta-preview','my-page','account'].includes(id))return;
  if(session)close(false);window.AIWiseSelectControls?.close();
  dialog=document.createElement('dialog');dialog.className='aw-guide';dialog.setAttribute('aria-labelledby','aw-guide-title');dialog.setAttribute('aria-describedby','aw-guide-description');
  session={id,auth:a,owner:identity(a),route:location.pathname+location.hash,trigger,index:0,cards:cards(id,a)};
  dialog.innerHTML='<header class="aw-guide-header"><span class="aw-guide-label">AI-Wise WorkSpace · Guide</span><button type="button" class="aw-guide-close" aria-label="Close guide">×</button></header><div class="aw-guide-content" aria-live="polite" aria-atomic="true"><p class="aw-guide-count"></p><h2 id="aw-guide-title"></h2><p id="aw-guide-description"></p><ol class="aw-guide-steps"></ol></div><nav class="aw-guide-dots" aria-label="Guide cards"></nav><footer class="aw-guide-footer"><button type="button" class="aw-guide-skip">Skip guide</button><div><button type="button" class="button" data-guide-back>Back</button><button type="button" class="button primary" data-guide-next>Next →</button></div></footer><p class="aw-guide-return">Open page guides with ⓘ at the top right. <button type="button" data-guide-tour>Workspace tour</button></p>';
  document.body.append(dialog);
  const tour=dialog.querySelector('[data-guide-tour]');tour.hidden=a.status!=='member'||id.startsWith('welcome');tour.onclick=()=>{const trigger=session.trigger;remember(session.auth,session.id);show(a.role==='member'?'welcome-member':'welcome',trigger);};
  const content=dialog.querySelector('.aw-guide-content');
  function paint(direction=1){
   const s=session;if(!s)return;const c=s.cards[s.index];dialog.querySelector('.aw-guide-count').textContent=guides[id].name+' · '+(s.index+1)+' of '+s.cards.length;
   dialog.querySelector('h2').textContent=c.title;dialog.querySelector('#aw-guide-description').textContent=c.body;
   const steps=dialog.querySelector('ol');steps.replaceChildren();for(const text of c.steps){const li=document.createElement('li');li.textContent=text;steps.append(li);}
   const dots=dialog.querySelector('.aw-guide-dots');dots.replaceChildren();s.cards.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Card '+(i+1));if(i===s.index)b.setAttribute('aria-current','step');b.onclick=()=>{s.index=i;paint();};dots.append(b);});
   dialog.querySelector('[data-guide-back]').disabled=s.index===0;dialog.querySelector('[data-guide-next]').textContent=s.index===s.cards.length-1?'Get started':'Next →';
   content.style.setProperty('--guide-slide-from',direction>0?'18px':'-18px');content.getAnimations?.().forEach(a=>a.cancel());
   if(!matchMedia('(prefers-reduced-motion: reduce)').matches)content.animate?.([{opacity:0,transform:`translateX(${direction>0?18:-18}px)`},{opacity:1,transform:'translateX(0)'}],{duration:400,easing:'ease'});
  }
  const step=n=>{if(!session)return;const i=session.index+n;if(i>=session.cards.length){close();return;}session.index=Math.max(0,i);paint(n);};
  dialog.querySelector('[data-guide-next]').onclick=()=>step(1);dialog.querySelector('[data-guide-back]').onclick=()=>step(-1);
  dialog.querySelector('.aw-guide-close').onclick=()=>close();dialog.querySelector('.aw-guide-skip').onclick=()=>close();
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}});
  let start;content.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')start={x:e.clientX,y:e.clientY};});content.addEventListener('pointerup',e=>{if(start&&Math.abs(e.clientX-start.x)>60&&Math.abs(e.clientY-start.y)<50)step(e.clientX<start.x?1:-1);start=null;});content.addEventListener('pointercancel',()=>start=null);
  paint();dialog.showModal();dialog.querySelector('[data-guide-next]').focus({preventScroll:true});
 }
 function mount(host,id){
  if(!host)return;let button=host.querySelector(':scope > [data-guide-trigger]');if(button){button.dataset.guideTrigger=id;button.setAttribute('aria-label','Open '+guides[id].name+' guide');button.title=guides[id].name+' guide';return;}
  button=document.createElement('button');button.type='button';button.className='aw-guide-trigger';button.dataset.guideTrigger=id;button.textContent='i';button.setAttribute('aria-label','Open '+guides[id].name+' guide');button.setAttribute('aria-haspopup','dialog');button.title=guides[id].name+' guide';button.onclick=()=>show(button.dataset.guideTrigger,button);host.append(button);
 }
 function update(){
  queued=false;const a=auth(),owner=identity(a),id=context();
  if(session&&(session.owner!==owner||a.status!=='checking'&&session.auth.status==='member'&&a.status!=='member'))close(false);
  const account=document.querySelector('#aw-account-dialog[open]'),personal=document.querySelector('#my-page[open]');
  const host=personal?.querySelector('.mp-header')||account?.querySelector('.aw-account-header')||document.querySelector('.br-page .br-top')||(document.body.classList.contains('profiler-page')?document.querySelector('.top'):document.querySelector('#home:not([hidden]) .home-heading')||document.querySelector('.room-heading')||document.querySelector('.workspace-access'));
  if(host)mount(host,id);
  // Existing short descriptions remain available without duplicating the guide's ⓘ action.
  document.querySelectorAll('.help-toggle').forEach(b=>{if(b.textContent==='i'){b.textContent='Details';b.setAttribute('aria-label','Page details');}});
  if(a.status==='checking'||!host||session)return;
  const changed=lastContext!==id||lastOwner!==owner;
  if([...document.querySelectorAll('dialog[open]')].some(d=>d!==personal)||document.querySelector('.mod.on,.mod.open'))return;
  if(changed){lastContext=id;lastOwner=owner;}
  const welcome=a.role==='member'?'welcome-member':'welcome';
  if(a.status==='member'&&!visited(a,welcome)){show(welcome,host.querySelector('[data-guide-trigger]'));return;}
  if(changed&&!visited(a,id))show(id,host.querySelector('[data-guide-trigger]'));
 }
 function schedule(){if(!queued){queued=true;queueMicrotask(update);}}
 const observer=new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('.aw-guide,.aw-select-popup,.aw-select')&&(r.type==='childList'||r.attributeName==='open'||r.attributeName==='hidden')))schedule();});
 observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden']});
 window.addEventListener('hashchange',()=>{if(session&&session.route!==location.pathname+location.hash)close(false);schedule();});window.AIWiseAuth?.subscribe(schedule);
 window.AIWiseTutorials=Object.freeze({open:show,refresh:schedule,context});schedule();
})();
