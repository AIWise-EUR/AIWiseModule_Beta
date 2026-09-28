(() => {
  'use strict';
  const publishedUrl = 'https://aiwise-eur.github.io/AI-Wise/';
  const areas = {
    profiler: {name: 'Course Profiler', icon: 'profiler-building', note: 'Teacher workspace for course information and educational intent.', action: 'Open teacher tool'},
    courses: {name: 'Courses', icon: 'courses-notes', note: 'Register courses and manage their basic information across the workspace.', action: 'Manage courses'},
    manager: {name: 'Course Profiler Manager', icon: 'profiler-building', note: 'Development team workspace for reviewing teacher profiles and preparing course packages.', action: 'Enter Manager'},
    studio: {name: 'Content Studio', icon: 'studio-building', note: 'Shape the Course Specific content within AI Orientation.', action: 'Enter Content Studio'},
    common: {name: 'Common Studio', icon: 'studio-building', note: 'Shape AI-Wise Common content shared across courses.', action: 'Enter Common Studio'},
    tower: {name: 'Control Tower', icon: 'tower-building', note: 'Review packages and record decisions between areas.', action: 'Open submissions'},
    beta: {name: 'AI-Wise Beta', icon: 'beta-screen', note: 'Explore Common and Course Specific working versions.', action: 'Enter Beta'},
    published: {name: 'AI-Wise Published', icon: 'published-product', note: 'Open the live AI-Wise module used by students.', action: 'Open student site'}
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
  const card = (title, text, href, label = 'Open', tag = '') => `<a class="card link" href="${href}">${tag ? badge(tag) : ''}<h3>${escape(title)}</h3><p>${escape(text)}</p><span class="arrow">${escape(label)} ${href.startsWith('https://')?'↗':'→'}</span></a>`;
  const empty = (title,text) => `<div class="empty-state"><h2>${escape(title)}</h2>${text ? `<p>${escape(text)}</p>` : ''}</div>`;
  const button = (title,href,primary=false) => `<a class="button${primary?' primary':''}" href="${href}">${escape(title)}</a>`;
  let pendingFetch;
  let currentPrompt = '';
  let renderedHash = location.hash;

  document.getElementById('area-list').innerHTML = Object.entries(areas).map(([id,a]) => `<a class="card link" href="${id==='published'?publishedUrl:'#'+id}"><svg viewBox="0 0 ${id==='tower'?'180 240':id==='beta'||id==='published'?'270 200':'240 180'}" aria-hidden="true"><use href="#${a.icon}"/></svg><h2>${a.name}</h2><p>${a.note}</p><span class="arrow">${a.action} ${id==='published'?'↗':'→'}</span></a>`).join('');
  function setView(view) {
    document.getElementById('map-container').hidden = view !== 'map';
    document.getElementById('area-list').hidden = view !== 'list';
    window.AIWiseMotion.enter(document.getElementById(view === 'map' ? 'map-container' : 'area-list'));
    for (const mode of ['map','list']) document.getElementById(mode+'-view').setAttribute('aria-pressed', String(mode===view));
  }
  setView(window.matchMedia('(max-width: 700px)').matches ? 'list' : 'map');
  document.getElementById('map-view').addEventListener('click',()=>setView('map'));
  // The home greeting names the signed-in person once accounts carry a display name; until then it stays a plain Hello.
  const greeting = document.getElementById('home-greeting');
  window.AIWiseAuth?.subscribe(auth => { const name = auth.user?.name?.trim(); greeting.textContent = name ? `Hello, ${name}` : 'Hello'; });
  document.getElementById('list-view').addEventListener('click',()=>setView('list'));

  // Explanations sit behind the ⓘ button beside the title; the page itself shows only what can be acted on.
  const hint = (...texts) => texts.filter(Boolean).map(text => `<p>${escape(text)}</p>`).join('');
  const lead = text => `<p class="room-lead">${escape(text)}</p>`;
  function shell(area,title,help,body,records=true) {
    const parent = areas[area];
    room.innerHTML = `<div class="room-heading"><div class="room-title"><h1 id="room-title" tabindex="-1">${escape(title)}</h1>${help ? `<div class="room-help"><button type="button" class="help-toggle" aria-label="About this page" aria-expanded="false" aria-controls="room-help-note">i</button><div class="help-note" id="room-help-note" role="note" hidden>${help}</div></div>` : ''}</div>${records&&parent?button('Records Office','#records/'+area):''}</div>${body}`;
    window.AIWiseMotion.enter(room);
  }
  function setHelp(open, focus = false) {
    const note = room.querySelector('.help-note'), toggle = room.querySelector('.help-toggle');
    if (!note || !toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) window.AIWiseMotion.show(note); else window.AIWiseMotion.hide(note);
    if (focus) toggle.focus({preventScroll: true});
  }
  document.addEventListener('click', event => {
    const toggle = event.target.closest('.help-toggle');
    if (toggle && room.contains(toggle)) { setHelp(toggle.getAttribute('aria-expanded') !== 'true'); return; }
    if (!event.target.closest('.help-note')) setHelp(false);
  });
  room.addEventListener('keydown', event => {
    const note = room.querySelector('.help-note');
    if (event.key === 'Escape' && note && !note.hidden) setHelp(false, true);
  });
  function renderProfiler(part) {
    if (!part || part === 'profile') {
      window.location.replace('course-profiler/');
      return;
    }
    if (part === 'prompts') {
      shell('manager','Academic Writing Skills I · Preset Prompts',hint('Read the prompts currently used by the Academic Writing Skills I Beta activities.','This is a read-only view. Editing and package submission are not available in this prototype.'),'<div class="prompt-view"><label for="prompt-select">Choose a prompt</label><select id="prompt-select"></select><div class="toolbar"><button class="button" id="copy-prompt" type="button">Copy prompt</button><button class="button" id="download-prompt" type="button">Download prompt</button></div><p class="live-message" id="prompt-message" role="status"></p><pre id="prompt-text" tabindex="0" aria-label="Selected preset prompt"></pre></div>');
      setupPrompts(); return;
    }
    if (part === 'activities') {
      shell('manager','Academic Writing Skills I · AI Activities',hint('Inspect the current activity pages and their prompts before designing the next version.','Activity configuration editing and submission are not connected yet.'),`<div class="item-list">${activityPages.map(([name,file])=>`<a class="item-link" href="../course-specific/aws1/${file}"><span>${name}</span><small>Open Beta page ↗</small></a>`).join('')}</div>`); return;
    }
    renderNotFound();
  }
  function renderManager(part) {
    if (part === 'prompts' || part === 'activities') { renderProfiler(part); return; }
    if (part) { renderNotFound(); return; }
    shell('manager','Course Profiler Manager',hint(areas.manager.note,'The teacher uses Course Profiler to express course goals and context. The development team reviews and refines that output here. Control Tower handles approval and transfer between areas.','Profile intake and package preparation are not connected yet. Shared teacher submissions, managed versions, and package assembly will be added after their workflow is defined.'),
      '<div class="toolbar">'+button('Open Course Profiler','course-profiler/',true)+'</div>'+
      '<div class="cards">'+
      card('Teacher course profile','Open the existing course design tool. Profiles currently stay in this browser.','course-profiler/','Open Course Profiler','Teacher tool')+
      card('Academic Writing Skills I · Preset Prompts','Inspect the current course and activity prompts.','#manager/prompts','Read prompts','Available')+
      card('Academic Writing Skills I · AI Activities','Inspect the current activity pages and prompt connections.','#manager/activities','View activities','Available')+
      '</div><h2 class="section-label">Courses</h2><div class="cards">'+window.AIWiseCourses.cards('manager')+'</div>'+
      '<div class="toolbar">'+button('View package requests in Control Tower','#tower/profiler')+'</div>');
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
  function renderStudio(part) {
    const [courseId, chapter = 'c2', itemIndex = '0', extra] = part.split('/');
    if (window.AIWiseContentStudio.supports(courseId) && ['c2','c3'].includes(chapter) && /^\d+$/.test(itemIndex) && Number.isSafeInteger(Number(itemIndex)) && !extra) { window.AIWiseContentStudio.render(shell, courseId, chapter, Number(itemIndex)); return; }
    if (part) { window.AIWiseCourses.render(part, shell); return; }
    shell('studio','Content Studio',hint(areas.studio.note,'Editing scope: Course Specific sections within AI Orientation. AI-Wise Common is outside this area.'),'<div class="cards">'+window.AIWiseCourses.cards('studio')+'</div>');
  }

  function renderCommon() {
    shell('common','Common Studio',hint(areas.common.note,'This studio is for shared module content, structure, rules, and templates. Editing is not connected yet. You can inspect the current Common content in Beta below.'),
      '<h2 class="section-label">Current Beta previews</h2><div class="cards">'+
      ['c1','c2','c3'].map(id=>card(items[id].name,'Shared AI Orientation content.','#beta/'+id,'View in Beta')).join('')+
      '</div><div class="toolbar">'+button('View Common Studio requests','#tower/common')+'</div>',false);
  }
  function renderBeta(part) {
    const item=items[part];
    if(item) {
      shell('beta',item.name,hint(item.area+' · Item versions','Saved version history is not connected in this prototype. This working copy is not an immutable checkpoint or an approved release.'),`<div class="version-row"><div><strong>Current working copy</strong><p>Preview the content currently available in Beta.</p></div>${button('Open preview',item.url,true)}</div>`+(part==='aws1'?'<div class="toolbar">'+button('Diagnostic Questionnaire','../course-specific/aws1/diagnostic-questionnaire-final.html')+button('Activity entry','../course-specific/aws1/sub-lobby.html')+button('Course materials','../course-specific/aws1/aws-i-materials.html')+'</div>':'')); return;
    }
    shell('beta','AI-Wise Beta',hint(areas.beta.note),'<div class="toolbar">'+button('Open Beta module','../common/lobby.html',true)+'</div><h2 class="section-label">AI-Wise Common</h2><div class="cards">'+['c1','c2','c3'].map(id=>card(items[id].name,'Shared Orientation content.','#beta/'+id,'View item')).join('')+'</div><h2 class="section-label">AI-Wise Course Specific</h2><div class="cards">'+['aws1','ped','other'].map(id=>card(items[id].name,id==='other'?'Uses the shared Others configuration and inherits AWS1 content.':'Course content within the current module.','#beta/'+id,'View item')).join('')+'</div>');
  }
  function renderTower(part) {
    window.AIWiseControlTower.render(part, shell);
  }
  function renderPublished() {
    window.location.replace(publishedUrl);
  }
  function renderRecords(area) {
    if(!areas[area]) {renderNotFound();return;}
    shell(area,'Records Office',hint(areas[area].name+' · Internal history','Saved checkpoints, previous versions, review notes, and restoration history will be available here. No history is being recorded by this navigation prototype.'),empty('Version records not connected','')+'<div class="toolbar">'+button('Return to '+areas[area].name,'#'+area)+'</div>',false);
  }
  function renderNotFound() {shell(null,'Area not found','',lead('That workspace address is not available.')+button('Back to map','#home'),false);}
  function route(focus=true) {
    if (!window.AIWiseControlTower.canLeave() || !window.AIWiseContentStudio.canLeave() || !window.AIWiseCourses.canLeave()) { history.replaceState(null, '', location.pathname + location.search + renderedHash); return; }
    window.AIWiseControlTower.dispose();
    window.AIWiseContentStudio.dispose();
    window.AIWiseCourses.dispose();
    renderedHash = location.hash;
    pendingFetch?.abort(); pendingFetch=null;
    const [area='home', ...segments]=(location.hash.slice(1)||'home').split('/');
    const part=segments.join('/');
    const activeArea = area === 'updates' ? 'home' : area === 'records' ? part : area === 'profiler' && ['prompts','activities'].includes(part) ? 'manager' : area;
    document.querySelectorAll('[data-area]').forEach(link => {
      if (link.dataset.area === activeArea) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    window.AIWiseSidebar.markCurrent();
    const isUpdates = area === 'updates';
    const isHome=area==='home' || isUpdates;home.hidden=!isHome;room.hidden=isHome;
    if (isUpdates) { history.replaceState(null, '', location.pathname + location.search + '#home'); renderedHash = '#home'; window.AIWiseSidebar.markCurrent(); }
    window.AIWiseOverview.setHome(isHome);
    if(isHome) { document.title='AI-Wise Workspace'; window.AIWiseMotion.enter(home); }
    else {
      if(area==='profiler')renderProfiler(part);
      else if(area==='manager')renderManager(part);
      else if(area==='studio')renderStudio(part);
      else if(area==='courses')window.AIWiseCourses.render(part, shell);
      else if(area==='common')renderCommon();
      else if(area==='beta')renderBeta(part);
      else if(area==='tower')renderTower(part);
      else if(area==='published')renderPublished();
      else if(area==='records')renderRecords(part);
      else renderNotFound();
      document.title=(document.getElementById('room-title')?.textContent||'Workspace')+' · AI-Wise';
    }
    if(focus){document.getElementById(isHome?'main':'room-title')?.focus({preventScroll:true});window.scrollTo(0,0);}
    if (isUpdates) window.AIWiseOverview.open();
    if(focus && area==='tower' && part && !part.includes('/')) document.querySelector('.ct-queue')?.scrollIntoView({block:'start'});
  }
  window.AIWiseCourses.ready.then(() => { window.addEventListener('hashchange',()=>route()); route(false); });
  // Native fragment scrolling must not hide the header on direct #home links.
  window.addEventListener('load', () => requestAnimationFrame(() => window.scrollTo(0, 0)));
})();
