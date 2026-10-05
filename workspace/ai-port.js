/* AI Port: a brief for the member's own Claude or ChatGPT, and an express inlet that applies
   the answer to the open Studio draft. No AI provider is called and no key is stored. */
(() => {
 'use strict';
 const auth=()=>window.AIWiseAuth?.snapshot()||{status:'signed-out'};
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clone=v=>JSON.parse(JSON.stringify(v));
 const REPO='https://github.com/AIWise-EUR/AIWiseModule_Beta';
 const PENDING='aiwise_ai_port_pending_v1';
 const key=(owner,kind)=>'aiwise_ai_port_v1:'+owner+':'+kind;
 function read(owner,kind,fallback){try{return JSON.parse(localStorage.getItem(key(owner,kind)))??fallback;}catch{return fallback;}}
 function write(owner,kind,value){try{localStorage.setItem(key(owner,kind),JSON.stringify(value));return true;}catch{return false;}}
 const stamp=d=>{const n=d?new Date(d):new Date();const p=x=>String(x).padStart(2,'0');return `${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}`;};

 // Page errors are kept for the optional diagnostics section only.
 const errors=[];
 const noteError=text=>{errors.push({at:new Date().toISOString(),text:String(text).slice(0,300)});if(errors.length>8)errors.shift();};
 window.addEventListener('error',e=>noteError(e.message||'Script error'));
 window.addEventListener('unhandledrejection',e=>noteError(e.reason?.message||e.reason||'Unhandled rejection'));

 /* ---------- Studio attachment ---------- */
 let studio=null;
 function attachStudio(s,api){
  studio={s,api};
  s.abort?.signal.addEventListener('abort',()=>{if(studio?.s===s)studio=null;},{once:true});
  const pending=readPending();
  if(pending&&pending.scope===s.courseId&&pending.chapter===s.chapter&&(pending.locale||'en')===s.locale){
   clearPending();
   setTimeout(()=>{if(studio?.s!==s||auth().status!=='member')return;open();const answer=dialog.querySelector('[data-ap-answer]');if(answer){answer.value=pending.text;}inlet();},0);
  }
 }
 function readPending(){try{return JSON.parse(sessionStorage.getItem(PENDING));}catch{return null;}}
 function clearPending(){try{sessionStorage.removeItem(PENDING);}catch{}}
 function storePending(text,payload){try{sessionStorage.setItem(PENDING,JSON.stringify({text,scope:payload.scope,chapter:payload.chapter,locale:payload.locale||'en'}));return true;}catch{return false;}}

 // Every editable string of the open chapter, with a key an AI can copy exactly.
 function flatten(s,api){
  const out=[],label=k=>api?.label?api.label(k):k;
  const segment=seg=>/^\d+$/.test(seg)?'#'+(Number(seg)+1):label(seg);
  if(s.isCommon){
   for(const [block,fields] of Object.entries(s.values)){
    if(block==='_studio'||!fields||typeof fields!=='object')continue;
    const item=s.items?.find(i=>i.path===block);
    for(const [field,text] of Object.entries(fields))if(typeof text==='string')out.push({key:block+'::'+field,slot:block,path:[field],value:text,label:(item?.title||block)+' · '+field,itemPath:block});
   }
   return out;
  }
  const walk=(value,slot,path,suffix)=>{
   if(typeof value==='string'){out.push({key:slot+suffix,slot,path,value,label:[slot==='c2.examples'?'Example':label(slot),...path.map(segment)].join(' · '),itemPath:slot,example:slot==='c2.examples'?Number(path[0]):undefined});return;}
   if(Array.isArray(value)){value.forEach((v,i)=>walk(v,slot,[...path,String(i)],suffix+'['+i+']'));return;}
   if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))walk(v,slot,[...path,k],suffix+'.'+k);
  };
  for(const [slot,value] of Object.entries(s.values))if(slot!=='_studio')walk(value,slot,[],'');
  return out;
 }
 const baseAt=(s,f)=>f.path.reduce((v,k)=>v?.[k],s.base?.[f.slot]);
 function enumFor(s,f){
  const last=f.path[f.path.length-1],base=baseAt(s,f),current=f.value;
  if(last==='actor')return ['self','ai','team'];
  if(last==='tag'&&['adopt','modify','discard'].includes(base??current))return ['adopt','modify','discard'];
  return null;
 }
 function setValue(s,f,text){
  if(!f.path.length){s.values[f.slot]=text;return;}
  const keys=[...f.path],last=keys.pop(),parent=keys.reduce((o,k)=>o[k],s.values[f.slot]);
  if(last==='typing_note'&&!text&&baseAt(s,f)===undefined)delete parent[last];else parent[last]=text;
 }
 const belongs=(f,item)=>item&&(f.slot===item.titlePath||f.slot===item.path&&(item.example===undefined||f.example===item.example));

 /* ---------- Parse, plan, apply ---------- */
 function parse(text){
  const t=String(text||''),candidates=[];
  const fence=/```(?:aiwise|json)?[^\n]*\n([\s\S]*?)```/gi;let m;while((m=fence.exec(t)))candidates.push(m[1]);
  const marker=t.indexOf('{"aiwise"');if(marker>=0)candidates.push(t.slice(marker,t.lastIndexOf('}')+1));
  const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)candidates.push(t.slice(a,b+1));
  let found=null;
  for(const c of candidates){try{const v=JSON.parse(c);if(v&&typeof v==='object'&&v.aiwise===1){found=v;break;}}catch{}}
  if(!found)throw Error('No aiwise block found. Ask your AI to end its answer with the aiwise block shown in the brief.');
  return check(found);
 }
 function check(v){
  if(typeof v.scope!=='string'||typeof v.chapter!=='string')throw Error('The aiwise block needs "scope" and "chapter".');
  if(v.locale!==undefined&&!['en','nl'].includes(v.locale))throw Error('The aiwise block has an unsupported "locale".');
  if(!v.fields||typeof v.fields!=='object'||Array.isArray(v.fields)||!Object.keys(v.fields).length)throw Error('The aiwise block has no "fields".');
  return {aiwise:1,scope:v.scope,chapter:v.chapter,locale:v.locale||'en',fields:v.fields};
 }
 function plan(payload){
  const out={payload,changes:[],skipped:[],issue:null,studio:null,session:null};
  if(!studio){out.issue='no-studio';return out;}
  const {s,api}=studio;out.studio={scope:s.courseId,chapter:s.chapter,locale:s.locale,label:s.config?.label||s.courseId};out.session=s;
  if(payload.scope!==s.courseId||payload.chapter!==s.chapter||payload.locale!==s.locale){out.issue='mismatch';return out;}
  if(s.blocked){out.issue='blocked';return out;}
  if(!s.ready){out.issue='loading';return out;}
  const byKey=new Map(flatten(s,api).map(f=>[f.key,f]));
  for(const [k,value] of Object.entries(payload.fields)){
   const f=byKey.get(k);
   if(!f){out.skipped.push({key:k,reason:'Unknown field for this chapter'});continue;}
   if(typeof value!=='string'){out.skipped.push({key:k,reason:'Not plain text'});continue;}
   const allowed=enumFor(s,f);
   if(allowed&&!allowed.includes(value)){out.skipped.push({key:k,reason:'Must be one of: '+allowed.join(', ')});continue;}
   if(value===f.value){out.skipped.push({key:k,reason:'Unchanged'});continue;}
   out.changes.push({field:f,text:value});
  }
  return out;
 }
 function apply(result){
  if(!studio||!result||result.session!==studio.s)throw Error('Reopen this chapter and read the answer again.');
  const {s,api}=studio;
  if(result.applied)throw Error('This answer was already applied. Read it again to apply it once more.');
  if(result.issue||!result.changes.length)throw Error('Nothing to apply.');
  if(s.blocked)throw Error('Review the saved draft first; the port does not change a blocked draft.');
  const trial={values:clone(s.values),base:s.base};
  result.changes.forEach(c=>setValue(trial,c.field,c.text));
  const blocks=window.AIWiseStudioBlocks;
  if(blocks?.validCopy&&!blocks.validCopy(trial.values,s.base))throw Error('The combination does not fit the chapter structure. Nothing was changed.');
  const wasOpen=!!s.dialog?.open;
  window.AIWiseStudioEditing?.remember(s);
  result.changes.forEach(c=>{window.AIWiseStudioEditing?.textChanged(s,c.field.slot,c.field.path,c.text);setValue(s,c.field,c.text);});
  result.applied=true;
  api.update();api.controls();if(wasOpen)api.open?.();
  api.save?.();
  const saved=typeof api.dirty==='function'?!api.dirty():true;
  log({kind:'apply',scope:s.courseId,chapter:s.chapter,locale:s.locale,count:result.changes.length,saved});
  return {saved,canSubmit:!!api.canSubmit?.()};
 }

 /* ---------- Brief ---------- */
 const SYSTEM=`AI-Wise is a learning module about generative AI for bachelor students (Erasmus University Rotterdam). The team edits it in the AI-Wise WorkSpace:
- Common Studio: shared chapters C1 (What is GenAI?), C2 (GenAI and human cognition), C3 (How to engage with GenAI) and the system map. Common text is identical for every course.
- Content Studio: course examples per bachelor (Psychology, Pedagogical Sciences). Every course of a bachelor shows that bachelor's examples.
- A draft stays in the member's browser until "Send to Control Tower" creates a Team request (administrators only). An administrator approves it in Control Tower; approval updates Beta. "Publish to students" later releases Beta to the student site. The AI Port never writes Beta or Published.
- Languages: English is the source text; Nederlands is a separate translation draft.
- Requests marked "Browser only" stay in one browser and never reach the team; only "Team" requests do.
- Code and system changes live in the GitHub repository ${REPO}; the development branch deploys the Beta site.`;
 const ANSWER=`Answer the member in plain language. If you propose new or changed text for Studio fields, end your answer with exactly one block in this form, using only the keys listed under "Studio content" and only the fields you changed. Plain text only, no markdown inside the text:
\`\`\`aiwise
{"aiwise":1,"scope":"SCOPE","chapter":"CHAPTER","locale":"LOCALE","fields":{"KEY":"new text"}}
\`\`\`
The member pastes your whole answer into the WorkSpace AI Port, which previews every field, applies it to the browser draft and then offers Send to Control Tower. If no Studio content is listed, say which chapter the member should open first.`;
 const screen=()=>{const hash=location.hash||'#home';const title=document.querySelector('#room-title')?.textContent?.trim()||(hash==='#home'?'Workspace home':hash);return `${title} (${hash})`;};
 function guideText(){
  const id=window.AIWiseTutorials?.context?.(),guide=id&&window.AIWiseTutorialContent?.guides?.[id];
  if(!guide)return '';
  return guide.cards.map(c=>`- ${c.title}: ${c.body} Steps: ${c.steps.join(' ')}`).join('\n');
 }
 function studioText(all){
  if(!studio)return 'No Studio chapter is open. Open Common Studio or Content Studio to include editable content.';
  const {s,api}=studio;if(!s.ready)return 'The Studio chapter is still loading.';
  const fields=flatten(s,api),item=s.items?.[s.index],draft=s.raw?`saved in this browser at ${stamp(JSON.parse(s.raw).savedAt)}`:'none saved';
  const dirty=typeof api.dirty==='function'&&api.dirty();
  const edited=f=>{const base=baseAt(s,f);return base!==undefined&&base!==f.value;};
  const line=f=>`• key: ${f.key}  (${f.label})${edited(f)?'  [edited in draft]':''}\n  text: ${f.value.replace(/\n/g,'\n  ')}`;
  const selected=item?fields.filter(f=>belongs(f,item)):[];
  const others=(s.items||[]).map((it,i)=>i===s.index?null:`${i+1}. ${s.isCommon?it.title:it.example===undefined?api.label(it.path):(s.values['c2.examples']?.[it.example]?.title||'Untitled example')}`).filter(Boolean);
  const head=`Scope: ${s.courseId} (${s.config?.label||s.courseId}) · Chapter: ${s.chapter} · Language: ${s.locale}\nDraft: ${draft}${dirty?' · unsaved edits in the editor':''}${s.blocked?' · blocked: the saved draft needs review before editing':''}`;
  if(all)return `${head}\nAll fields (key → current text; [edited in draft] marks a change against Beta):\n${fields.map(line).join('\n')}`;
  const title=item?(s.isCommon?item.title:item.example===undefined?api.label(item.path):`Example ${item.example+1}`):'none';
  return `${head}\nSelected item: ${title}\nFields of the selected item (key → current text; [edited in draft] marks a change against Beta):\n${selected.map(line).join('\n')||'(none)'}\nOther items in this chapter (tick "Include the text of every Studio item" for their text): ${others.join('; ')||'none'}`;
 }
 async function activityText(a){
  let client;try{client=await window.AIWiseBackend.getClient();}catch{return 'Shared activity could not be loaded (no connection).';}
  const q=async make=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const {data,error}=await make(client).abortSignal(controller.signal);return error?null:data;}catch{return null;}finally{clearTimeout(timer);}};
  const admin=a.role==='admin';
  const [approvals,versions,submissions,releases]=await Promise.all([
   q(b=>b.from('workspace_beta_content').select('course,chapter,approved_at').order('approved_at',{ascending:false}).limit(8)),
   q(b=>b.from('workspace_beta_versions').select('number,title,author_name,created_at').order('created_at',{ascending:false}).limit(5)),
   admin?q(b=>b.from('workspace_submissions').select('course,chapter,author_name,summary,status,submitted_at').order('submitted_at',{ascending:false}).limit(8)):Promise.resolve(undefined),
   admin?q(b=>b.from('workspace_releases').select('number,version_number,version_title,status,deployment_status,created_at').order('created_at',{ascending:false}).limit(3)):Promise.resolve(undefined)
  ]);
  const list=(rows,empty,fmt)=>rows===undefined?'not available to your role':rows===null?'could not be loaded':rows.length?'\n'+rows.map(r=>'  - '+fmt(r)).join('\n'):empty;
  return `Approved to Beta (latest first): ${list(approvals,'none yet',r=>`${r.course} ${String(r.chapter).toUpperCase()} · ${stamp(r.approved_at)}`)}
Beta review versions: ${list(versions,'none yet',r=>`V${r.number} "${r.title}" by ${r.author_name} · ${stamp(r.created_at)}`)}
Studio requests in Control Tower: ${list(submissions,'none yet',r=>`${r.status} · ${r.course} ${String(r.chapter).toUpperCase()} by ${r.author_name} · ${stamp(r.submitted_at)} · ${String(r.summary).replace(/\s+/g,' ').slice(0,120)}`)}
Student releases: ${list(releases,'none yet',r=>`release ${r.number} from V${r.version_number} "${r.version_title}" · ${r.status} · deployment ${r.deployment_status} · ${stamp(r.created_at)}`)}`;
 }
 function historyText(owner){
  const rows=read(owner,'log',[]);
  if(!Array.isArray(rows)||!rows.length)return 'Nothing yet on this browser.';
  return rows.slice(0,10).map(r=>`- ${stamp(r.at)} ${describe(r)}`).join('\n');
 }
 const describe=r=>r.kind==='brief'?`brief copied (${r.scope?`${r.scope} ${r.chapter} ${r.locale}`:'no Studio open'})`:r.kind==='apply'?`${r.count} field${r.count===1?'':'s'} applied to the ${r.scope} ${r.chapter} ${r.locale} draft${r.saved?' and saved':' (save failed)'}`:r.kind==='submit'?`sent ${r.scope} ${r.chapter} ${r.locale} to Control Tower`:r.kind||'';
 async function diagnosticsText(a){
  let connection='not checked';
  try{await window.AIWiseBackend.checkConnection();connection='Supabase reachable';}catch(e){connection='Supabase check failed: '+(e?.message||e);}
  let storage='available';try{localStorage.setItem('aiwise_ai_port_probe','1');localStorage.removeItem('aiwise_ai_port_probe');}catch{storage='not available';}
  return `Time: ${new Date().toISOString()}\nSign-in: ${a.status}${a.role?' · role '+a.role:''}\nConnection: ${connection}\nBrowser storage: ${storage}\nBrowser: ${navigator.userAgent}\nPage: ${location.href}\nRecent page errors: ${errors.length?'\n'+errors.map(e=>`  - ${stamp(e.at)} ${e.text}`).join('\n'):'none captured since this page was opened'}`;
 }
 async function brief({all=false,diagnostics=false}={}){
  const a=auth();if(a.status!=='member')throw Error('Sign in with your team account first.');
  const who=`${a.user?.displayName||a.user?.name||'Team member'} (${a.role==='admin'?'administrator':'member'}), signed in.`;
  const answer=ANSWER.replace('SCOPE',studio?.s.courseId||'…').replace('CHAPTER',studio?.s.chapter||'…').replace('LOCALE',studio?.s.locale||'en');
  const parts=[
   `AI-Wise WorkSpace · brief for your AI assistant\nGenerated ${stamp()} (browser time). Paste this whole text into your own Claude or ChatGPT, then ask your question or request.`,
   `== What the system is ==\n${SYSTEM}`,
   `== Who and where ==\nMember: ${who}\nScreen: ${screen()}\nGuide for this screen:\n${guideText()||'- (no guide for this screen)'}`,
   `== Studio content ==\n${studioText(all)}`,
   `== Recent activity (shared by the team) ==\n${await activityText(a)}`,
   `== This member's AI Port history (this browser) ==\n${historyText(a.user.id)}`
  ];
  if(diagnostics)parts.push(`== Diagnostics ==\n${await diagnosticsText(a)}`);
  parts.push(`== How to answer ==\n${answer}`);
  return parts.join('\n\n');
 }
 function log(entry){
  const a=auth();if(a.status!=='member'||!a.user?.id)return;
  const rows=read(a.user.id,'log',[]);
  write(a.user.id,'log',[{at:new Date().toISOString(),...entry},...(Array.isArray(rows)?rows:[])].slice(0,50));
  if(session&&dialog.open)history();
 }

 /* ---------- Drawer ---------- */
 const tab=document.createElement('button');tab.type='button';tab.className='mp-tab ap-tab';tab.textContent='AI Port';tab.setAttribute('aria-haspopup','dialog');tab.setAttribute('aria-controls','ai-port');
 const dialog=document.createElement('dialog');dialog.id='ai-port';dialog.className='mp-dialog ap-dialog';dialog.setAttribute('aria-labelledby','ap-title');
 document.body.append(tab,dialog);
 let session=null,briefEpoch=0,current=null;
 const valid=s=>session===s&&dialog.open&&['member','checking'].includes(auth().status)&&auth().user?.id===s.owner;
 function build(a){
  const s=session={owner:a.user.id,role:a.role};
  dialog.innerHTML=`<header class="mp-header"><div><h2 id="ap-title">AI Port</h2><p>Your own Claude or ChatGPT, with the WorkSpace's context</p></div><button class="aw-account-close" type="button" data-ap-close aria-label="Close AI Port">×</button></header>
<div class="mp-body ap-body">
<section><h3>1 · Brief for your AI</h3><p class="mp-hint">Copy it, paste it into your AI, then ask your question or request. Nothing is sent anywhere by the WorkSpace.</p>
<label class="ap-check"><input type="checkbox" data-ap-all> Include the text of every Studio item</label>
<label class="ap-check"><input type="checkbox" data-ap-diag> Include diagnostics (for a problem report)</label>
<textarea data-ap-brief readonly rows="9" aria-label="Brief for your AI"></textarea><p data-ap-brief-status role="status" class="ap-status"></p>
<div class="ap-actions"><button type="button" class="button primary" data-ap-copy>Copy brief</button><button type="button" class="button" data-ap-refresh>Refresh</button><a class="button" href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude ↗</a><a class="button" href="https://chatgpt.com/" target="_blank" rel="noopener">Open ChatGPT ↗</a></div></section>
<section><h3>2 · Express inlet</h3><p class="mp-hint">Paste your AI's whole answer. The fields in its aiwise block are previewed, applied to the browser draft and saved. Beta changes only after Control Tower approval.</p>
<textarea data-ap-answer rows="6" placeholder="Paste the answer here…" aria-label="Your AI's answer"></textarea>
<div class="ap-actions"><button type="button" class="button primary" data-ap-read>Read answer</button><button type="button" class="button" data-ap-clear>Clear</button></div>
<div data-ap-result class="ap-result" aria-live="polite"></div></section>
<section><h3>Port history</h3><p class="mp-hint">On this browser, under your account</p><div data-ap-history></div></section>
<section><h3>Code and system work</h3><p class="mp-hint">Claude Code and Codex open the repository with your own subscription. Setup notes: docs/ai-port.md in the repository.</p><a class="button" href="${REPO}" target="_blank" rel="noopener">Open repository ↗</a></section>
</div>`;
  dialog.querySelector('[data-ap-close]').onclick=close;
  dialog.querySelectorAll('[data-ap-all],[data-ap-diag]').forEach(n=>n.onchange=()=>refresh(s));
  dialog.querySelector('[data-ap-refresh]').onclick=()=>refresh(s);
  dialog.querySelector('[data-ap-copy]').onclick=()=>copy(s);
  dialog.querySelector('[data-ap-read]').onclick=()=>inlet();
  dialog.querySelector('[data-ap-clear]').onclick=()=>{dialog.querySelector('[data-ap-answer]').value='';dialog.querySelector('[data-ap-result]').replaceChildren();current=null;};
  return s;
 }
 async function refresh(s){
  const epoch=++briefEpoch,area=dialog.querySelector('[data-ap-brief]'),status=dialog.querySelector('[data-ap-brief-status]');
  status.textContent='Preparing the brief…';
  try{const text=await brief({all:dialog.querySelector('[data-ap-all]').checked,diagnostics:dialog.querySelector('[data-ap-diag]').checked});if(!valid(s)||epoch!==briefEpoch)return;area.value=text;status.textContent=`Ready · ${text.length.toLocaleString()} characters.`;}
  catch(e){if(!valid(s)||epoch!==briefEpoch)return;area.value='';status.textContent=e?.message||'The brief could not be prepared.';}
 }
 async function copy(s){
  const area=dialog.querySelector('[data-ap-brief]'),status=dialog.querySelector('[data-ap-brief-status]');
  if(!area.value){status.textContent='The brief is not ready yet.';return;}
  try{await navigator.clipboard.writeText(area.value);status.textContent='Brief copied. Paste it into your AI.';}
  catch{area.focus?.();area.select?.();status.textContent='Select the brief text and copy it with your keyboard.';}
  log({kind:'brief',scope:studio?.s.courseId,chapter:studio?.s.chapter,locale:studio?.s.locale});
 }
 function history(){
  const host=dialog.querySelector('[data-ap-history]');if(!host||!session)return;
  const rows=read(session.owner,'log',[]);
  host.innerHTML=Array.isArray(rows)&&rows.length?rows.slice(0,8).map(r=>`<p class="ap-history-row"><span>${esc(stamp(r.at))}</span> ${esc(describe(r))}</p>`).join(''):'<p class="mp-empty">Copied briefs and applied answers will appear here.</p>';
 }
 const studioRoute=p=>p.scope==='common'?`#common/${p.chapter}`:`#studio/${p.scope}/${p.chapter}`;
 function inlet(){
  const host=dialog.querySelector('[data-ap-result]'),text=dialog.querySelector('[data-ap-answer]').value;
  host.replaceChildren();current=null;
  let payload;try{payload=parse(text);}catch(e){host.innerHTML=`<p class="aw-account-error">${esc(e.message)}</p>`;return;}
  const result=current=plan(payload);
  const where=`${payload.scope} · ${payload.chapter.toUpperCase()} · ${payload.locale}`;
  if(result.issue==='no-studio'||result.issue==='mismatch'){
   const stored=storePending(text,payload);
   host.innerHTML=`<p>This answer is for <strong>${esc(where)}</strong>${result.studio?`, but <strong>${esc(result.studio.label)} · ${esc(result.studio.chapter.toUpperCase())} · ${esc(result.studio.locale)}</strong> is open`:' and no Studio chapter is open'}.</p><p class="mp-hint">${stored?'Open that chapter and the preview will appear there.':'Open that chapter, then paste the answer again.'}</p><div class="ap-actions"><button type="button" class="button primary" data-ap-go>Open ${esc(where)}</button></div>`;
   host.querySelector('[data-ap-go]').onclick=()=>{
    const hash=studioRoute(payload);let target=hash;
    if(window.AIWiseLanguage?.url&&window.AIWiseLanguage.current?.()!==payload.locale){const url=new URL(location.href);url.hash=hash;target=window.AIWiseLanguage.url(url.href,payload.locale);}
    close();if(target.startsWith('#'))location.hash=target;else location.href=target;
   };
   return;
  }
  if(result.issue){
   host.innerHTML=`<p class="aw-account-error">${esc(result.issue==='blocked'?'The saved draft of this chapter needs review first. Choose Review saved draft in the Studio, then paste the answer again.':'The chapter is still loading. Try again in a moment.')}</p>`;return;
  }
  const rows=result.changes.map(c=>`<div class="ap-change"><p class="ap-change-key"><strong>${esc(c.field.label)}</strong><br><code>${esc(c.field.key)}</code></p><p class="ap-old"><span>Now</span>${esc(c.field.value||'(empty)')}</p><p class="ap-new"><span>Proposed</span>${esc(c.text)}</p></div>`).join('');
  const skipped=result.skipped.length?`<details class="ap-skipped"><summary>${result.skipped.length} not applied</summary>${result.skipped.map(x=>`<p><code>${esc(x.key)}</code> · ${esc(x.reason)}</p>`).join('')}</details>`:'';
  host.innerHTML=`<p>${result.changes.length?`<strong>${result.changes.length}</strong> field${result.changes.length===1?'':'s'} to change in <strong>${esc(where)}</strong>.`:`No changes to apply for <strong>${esc(where)}</strong>.`}</p>${rows}${skipped}${result.changes.length?'<div class="ap-actions"><button type="button" class="button primary" data-ap-apply>Apply to draft and save</button></div>':''}<p class="ap-status" data-ap-apply-status role="status"></p>`;
  const button=host.querySelector('[data-ap-apply]');if(button)button.onclick=()=>{
   const status=host.querySelector('[data-ap-apply-status]');
   try{
    const outcome=apply(result);button.disabled=true;
    status.textContent=outcome.saved?'Applied and saved as the browser draft. Beta is unchanged.':'Applied to the editor. The draft could not be saved automatically; check the Studio message and use Save draft.';
    if(outcome.saved&&outcome.canSubmit){const send=document.createElement('button');send.type='button';send.className='button';send.textContent='Send to Control Tower';send.onclick=()=>{const {s,api}=studio||{};if(!s)return;log({kind:'submit',scope:s.courseId,chapter:s.chapter,locale:s.locale});close();api.submit?.();};button.after(send);}
   }catch(e){status.textContent=e?.message||'The answer could not be applied.';}
  };
 }
 function close(){window.AIWiseMotion?.cancel(dialog);if(dialog.open)dialog.close();tab.focus({preventScroll:true});return true;}
 function open(){
  const a=auth();if(a.status!=='member'){window.AIWiseAccount?.open();return;}
  window.AIWiseSidebar?.close(false);
  const s=session?.owner===a.user.id&&session.role===a.role?session:build(a);
  if(!dialog.open){dialog.showModal();window.AIWiseMotion?.enter(dialog,'menu');}
  history();refresh(s);dialog.querySelector('[data-ap-close]').focus();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 tab.onclick=open;
 window.AIWiseAuth?.subscribe(a=>{if(a.status==='checking'&&a.user?.id===session?.owner)return;if(session&&(a.status!=='member'||a.user?.id!==session.owner||a.role!==session.role)){session=null;current=null;if(dialog.open)dialog.close();dialog.replaceChildren();}});
 window.AIWiseAIPort=Object.freeze({open,close,brief,parse,plan,apply,attachStudio,flatten,context:()=>studio?{scope:studio.s.courseId,chapter:studio.s.chapter,locale:studio.s.locale}:null});
})();
