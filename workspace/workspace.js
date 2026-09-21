(() => {
  'use strict';
  const areas = {
    profiler: {name: 'Course Profiler', icon: 'profiler-building', note: 'Design course profiles, preset prompts, and AI Activities.', action: 'Enter Course Profiler'},
    studio: {name: 'Content Studio', icon: 'studio-building', note: 'Shape the Course Specific content within AI Orientation.', action: 'Enter Content Studio'},
    tower: {name: 'Control Tower', icon: 'tower-building', note: 'Review packages and record decisions between areas.', action: 'Open submissions'},
    beta: {name: 'AI-Wise Beta', icon: 'beta-screen', note: 'Explore Common and Course Specific working versions.', action: 'Enter Beta'},
    published: {name: 'AI-Wise Published', icon: 'published-product', note: 'Access approved student releases and their history.', action: 'View releases'}
  };
  const items = {
    c1: {name: 'C1 · What is GenAI?', area: 'Common', url: '../common/aiwise-c1-final.html'},
    c2: {name: 'C2 · GenAI and human cognition', area: 'Common', url: '../common/aiwise-c2-final.html'},
    c3: {name: 'C3 · How to engage with GenAI', area: 'Common', url: '../common/aiwise-c3-final.html'},
    aws1: {name: 'Academic Writing Skills I', area: 'Course Specific', url: '../common/lobby.html?course=aws1'},
    ped: {name: 'Pedagogical Sciences', area: 'Course Specific', url: '../common/lobby.html?course=ped'},
    other: {name: 'Others', area: 'Course Specific preview', url: '../common/lobby.html?course=other'}
  };
  const activityPages = [
    ['Exploring a topic','exploring-topic.html'], ['Formulating a research question','research-question.html'],
    ['Searching for literature','searching-literature.html'], ['Organizing literature','organizing-literature.html'],
    ['Creating a draft structure','draft-outline.html'], ['Writing sections','writing-sections.html'], ['Finalizing a paper','finalizing-paper.html']
  ];
  const home = document.getElementById('home');
  const room = document.getElementById('room');
  document.querySelector('.skip').addEventListener('click', event => {
    event.preventDefault();
    document.getElementById('main').focus();
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const badge = text => `<span class="badge">${escape(text)}</span>`;
  const card = (title, text, href, label = 'Open', tag = '') => `<a class="card link" href="${href}">${tag ? badge(tag) : ''}<h3>${escape(title)}</h3><p>${escape(text)}</p><span class="arrow">${escape(label)} →</span></a>`;
  const notice = text => `<p class="notice">${escape(text)}</p>`;
  const empty = (title,text) => `<div class="empty-state"><h2>${escape(title)}</h2><p>${escape(text)}</p></div>`;
  const button = (title,href,primary=false) => `<a class="button${primary?' primary':''}" href="${href}">${escape(title)}</a>`;
  let pendingFetch;
  let currentPrompt = '';

  document.getElementById('area-list').innerHTML = Object.entries(areas).map(([id,a]) => `<a class="card link" href="#${id}"><svg viewBox="0 0 ${id==='tower'?'180 240':id==='beta'||id==='published'?'270 200':'240 180'}" aria-hidden="true"><use href="#${a.icon}"/></svg><h2>${a.name}</h2><p>${a.note}</p><span class="arrow">${a.action} →</span></a>`).join('');
  function setView(view) {
    document.getElementById('map-container').hidden = view !== 'map';
    document.getElementById('area-list').hidden = view !== 'list';
    for (const mode of ['map','list']) document.getElementById(mode+'-view').setAttribute('aria-pressed', String(mode===view));
  }
  setView(window.matchMedia('(max-width: 700px)').matches ? 'list' : 'map');
  document.getElementById('map-view').addEventListener('click',()=>setView('map'));
  document.getElementById('list-view').addEventListener('click',()=>setView('list'));

  function shell(area,title,description,body,records=true) {
    const parent = areas[area];
    room.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="#home">Workspace</a><span aria-hidden="true">/</span>${parent && title!==parent.name ? `<a href="#${area}">${parent.name}</a><span aria-hidden="true">/</span>` : ''}<span aria-current="page">${escape(title)}</span></nav><div class="room-heading"><div><p class="eyebrow">${parent ? parent.name : 'Workspace'}</p><h1 id="room-title" tabindex="-1">${escape(title)}</h1><p class="room-description">${escape(description)}</p></div>${records&&parent?button('Records Office','#records/'+area):''}</div>${body}`;
  }
  function renderProfiler(part) {
    if (!part || part === 'profile') {
      window.location.replace('course-profiler/');
      return;
    }
    if (part === 'prompts') {
      shell('profiler','AWS1 · Preset Prompts','Read the prompts currently used by the AWS1 Beta activities.',notice('This is a read-only view. Editing and package submission are not available in this prototype.')+'<div class="prompt-view"><label for="prompt-select">Choose a prompt</label><select id="prompt-select"></select><div class="toolbar"><button class="button" id="copy-prompt" type="button">Copy prompt</button><button class="button" id="download-prompt" type="button">Download prompt</button></div><p class="live-message" id="prompt-message" role="status"></p><pre id="prompt-text" tabindex="0" aria-label="Selected preset prompt"></pre></div>');
      setupPrompts(); return;
    }
    if (part === 'activities') {
      shell('profiler','AWS1 · AI Activities','Inspect the current activity pages and their prompts before designing the next version.',notice('Activity configuration editing and submission are not connected yet.')+`<div class="item-list">${activityPages.map(([name,file])=>`<a class="item-link" href="../course-specific/aws1/${file}"><span>${name}</span><small>Open Beta page ↗</small></a>`).join('')}</div>`); return;
    }
    if (part === 'profile') {
      shell('profiler','AWS1 · Course Profile','Course context, goals, tasks, and the analysis underlying activity design.',empty('Profile editor not connected','The profile editor will live here. A completed profile, its prompts, and Activity configuration will be submitted together as one course package.')); return;
    }
    shell('profiler','Course Profiler',areas.profiler.note,`<p class="section-label">Academic Writing Skills I · AWS1</p><div class="cards">${card('Course Profile','Context, learning goals, tasks, and analysis.','#profiler/profile','View area','Planned')}${card('Preset Prompts','The current Course Preset and activity prompts.','#profiler/prompts','Read prompts','Available')}${card('AI Activity Configuration','Titles, entry points, sequence, visibility, and prompt connections.','#profiler/activities','Inspect current activities','Preview')}</div>`+notice('Course package: Course Profile + Preset Prompts + AI Activity Configuration. Save a checkpoint, then submit through Control Tower to Beta.'));
  }
  function setupPrompts() {
    const source = window.AIWISE_PRESETS;
    const select = document.getElementById('prompt-select');
    if (!source) { document.getElementById('prompt-text').textContent='Prompts could not be loaded. Please reload this page.'; document.getElementById('copy-prompt').disabled=true; document.getElementById('download-prompt').disabled=true; return; }
    const titles = {exploring:'Exploring a topic',searching:'Searching for literature',organizing:'Organizing literature',outline:'Creating a draft structure',writing:'Writing sections',finalizing:'Finalizing a paper'};
    const entries = [['Course Preset',source.course]];
    for (const [key,value] of Object.entries(source.activities)) {
      if (typeof value==='string') entries.push([titles[key]||key,value]);
      else for (const [sub,text] of Object.entries(value)) if(typeof text==='string') entries.push([`${titles[key]||key} · ${{grammarCheck:'Grammar check',terminologyOptions:'Terminology options'}[sub]||sub}`,text]);
    }
    entries.forEach(([label],index)=>select.add(new Option(label,String(index))));
    const show = () => { currentPrompt=entries[Number(select.value)][1]; document.getElementById('prompt-text').textContent=currentPrompt; document.getElementById('prompt-message').textContent=''; };
    select.addEventListener('change',show); show();
    document.getElementById('copy-prompt').addEventListener('click',async()=>{
      const message=document.getElementById('prompt-message');
      try { await navigator.clipboard.writeText(currentPrompt); message.textContent='Prompt copied.'; }
      catch { message.textContent='Clipboard access is unavailable. Select and copy the prompt text below.'; }
    });
    document.getElementById('download-prompt').addEventListener('click',()=>{
      const url=URL.createObjectURL(new Blob([currentPrompt],{type:'text/plain;charset=utf-8'}));
      const a=document.createElement('a'); a.href=url; a.download=entries[Number(select.value)][0].toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.txt';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  async function renderStudio(part) {
    if(part !== 'aws1') {
      shell('studio','Content Studio',areas.studio.note,notice('Editing scope: Course Specific sections within AI Orientation. AI-Wise Common is outside this area.')+`<div class="cards">${card('Academic Writing Skills I','Inspect the current course examples and their placement.','#studio/aws1','View content','Available')}${card('Pedagogical Sciences','View the PED Orientation in Beta.','#beta/ped','Open Beta preview','Preview')}</div>`); return;
    }
    shell('studio','AWS1 · Orientation content','Inspect the current examples inside the Common Orientation structure.',notice('Content editing and submission are not connected yet. This preview shows the existing course content.')+'<div class="toolbar">'+button('Open C2 in Beta','../common/aiwise-c2-final.html?course=aws1')+button('Open C3 in Beta','../common/aiwise-c3-final.html?course=aws1')+'</div><div id="studio-examples" aria-live="polite"><p>Loading course examples…</p></div>');
    const controller=new AbortController(); pendingFetch=controller;
    try {
      const response=await fetch('../course-specific/aws1/course-specific-content_aws1.json',{signal:controller.signal});
      if(!response.ok) throw Error('Unavailable');
      const data=await response.json(); if(controller.signal.aborted)return;
      const target=document.getElementById('studio-examples'); if(!target)return;
      target.innerHTML='<h2 class="section-label">C2 · Course examples</h2><div class="cards">'+(data.c2?.examples||[]).map((example,i)=>`<article class="card">${badge('Example '+(i+1))}<h3>${escape(example.title||'Course example')}</h3><p><strong>Student thinking</strong><br>${escape(example.thinking)}</p><p><strong>Student prompt</strong><br>${escape(example.typing)}</p><p><strong>Model processing</strong><br>${escape(example.processing)}</p></article>`).join('')+'</div>';
    } catch(error) { if(error.name!=='AbortError'){const target=document.getElementById('studio-examples');if(target)target.textContent='Course examples could not be loaded. You can open the Beta pages above.';} }
  }
  function renderBeta(part) {
    const item=items[part];
    if(item) {
      shell('beta',item.name,item.area+' · Item versions',`<div class="version-row"><div><strong>Current working copy</strong><p>Preview the content currently available in Beta.</p></div>${button('Open preview',item.url,true)}</div>`+notice('Saved version history is not connected in this prototype. This working copy is not an immutable checkpoint or an approved release.')+(part==='aws1'?'<div class="toolbar">'+button('Diagnostic Questionnaire','../course-specific/aws1/diagnostic-questionnaire-final.html')+button('Activity entry','../course-specific/aws1/sub-lobby.html')+button('Course materials','../course-specific/aws1/aws-i-materials.html')+'</div>':'')); return;
    }
    shell('beta','AI-Wise Beta',areas.beta.note,'<div class="toolbar">'+button('Open Beta module','../common/lobby.html',true)+'</div><h2 class="section-label">AI-Wise Common</h2><div class="cards">'+['c1','c2','c3'].map(id=>card(items[id].name,'Shared Orientation content.','#beta/'+id,'View item')).join('')+'</div><h2 class="section-label">AI-Wise Course Specific</h2><div class="cards">'+['aws1','ped','other'].map(id=>card(items[id].name,id==='other'?'Uses the shared Others configuration and inherits AWS1 content.':'Course content within the current module.','#beta/'+id,'View item')).join('')+'</div>');
  }
  function renderTower(part) {
    const types={all:'All submissions',profiler:'Course Profiler → Beta',studio:'Content Studio → Beta',release:'Beta → Published'};
    const selected=types[part]?part:'all';
    shell('tower','Control Tower',areas.tower.note,`<nav class="tabs" aria-label="Submission route">${Object.entries(types).map(([key,label])=>`<a href="#tower/${key}" ${key===selected?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`+empty('Submission queue not connected','This view will show submitted packages, their exact versions, and the reasons for approval, rejection, or requested revision.')+`<div class="cards"><article class="card"><h3>Review a package</h3><p>Open the exact submitted versions and compare them with the previous versions.</p></article><article class="card"><h3>Record a decision</h3><p>Approve, reject, or request revision. Preserve the reason and link any resubmission.</p></article><article class="card"><h3>Release the reviewed version</h3><p>Only the approved assembly proceeds to Published. Later Beta edits remain separate.</p></article></div>`,false);
  }
  function renderPublished() {
    shell('published','AI-Wise Published',areas.published.note,empty('No approved release connected','This prototype is not connected to a Published release registry. The active student release, included versions, approval record, and release history will appear here.')+'<div class="toolbar">'+button('View Beta working versions','#beta')+button('View release submissions','#tower/release')+'</div>');
  }
  function renderRecords(area) {
    if(!areas[area]) {renderNotFound();return;}
    shell(area,'Records Office',areas[area].name+' · Internal history',empty('Version records not connected','Saved checkpoints, previous versions, review notes, and restoration history will be available here. No history is being recorded by this navigation prototype.')+'<div class="toolbar">'+button('Return to '+areas[area].name,'#'+area)+'</div>',false);
  }
  function renderNotFound() {shell(null,'Area not found','That workspace address is not available.',button('Back to map','#home'),false);}
  function route(focus=true) {
    pendingFetch?.abort(); pendingFetch=null;
    const [area='home',part='']=(location.hash.slice(1)||'home').split('/');
    const activeArea = area === 'records' ? part : area;
    document.querySelectorAll('[data-area]').forEach(link => {
      if (link.dataset.area === activeArea) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const isHome=area==='home';home.hidden=!isHome;room.hidden=isHome;
    if(isHome) document.title='AI-Wise Workspace';
    else {
      if(area==='profiler')renderProfiler(part);
      else if(area==='studio')renderStudio(part);
      else if(area==='beta')renderBeta(part);
      else if(area==='tower')renderTower(part);
      else if(area==='published')renderPublished();
      else if(area==='records')renderRecords(part);
      else renderNotFound();
      document.title=(document.getElementById('room-title')?.textContent||'Workspace')+' · AI-Wise';
    }
    if(focus){document.getElementById(isHome?'main':'room-title')?.focus({preventScroll:true});window.scrollTo(0,0);}
  }
  window.addEventListener('hashchange',()=>route()); route(false);
  // Native fragment scrolling must not hide the header on direct #home links.
  window.addEventListener('load', () => requestAnimationFrame(() => window.scrollTo(0, 0)));
})();
