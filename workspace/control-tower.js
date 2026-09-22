(() => {
  'use strict';
  const KEY = 'aiwise_control_tower_v1';
  const PERSON = 'aiwise_control_tower_person_v1';
  const routes = {
    profiler: { from: 'Course Profiler Manager', to: 'Beta', type: 'submission', lane: 'profiler' },
    studio: { from: 'Content Studio', to: 'Beta', type: 'submission', lane: 'studio' },
    common: { from: 'Common Studio', to: 'Beta', type: 'submission', lane: 'common' },
    'rev-profiler': { from: 'Beta', to: 'Course Profiler Manager', type: 'revision', lane: 'profiler' },
    'rev-studio': { from: 'Beta', to: 'Content Studio', type: 'revision', lane: 'studio' },
    'rev-common': { from: 'Beta', to: 'Common Studio', type: 'revision', lane: 'common' },
    release: { from: 'Beta', to: 'Published', type: 'release', lane: 'release' }
  };
  const types = { submission: 'Submission', revision: 'Revision request', release: 'Release request' };
  const statuses = { draft: 'Draft', pending: 'Pending', revision: 'Revision requested', approved: 'Approved', rejected: 'Rejected' };
  const extras = {
    submission: [['changes', 'Changes from the previous version', 'For a first submission, describe what is being introduced.']],
    revision: [['location', 'Affected location', 'Identify the page, section, or marked area. Link relevant Beta comments in References.']],
    release: [['assembly', 'Release assembly', 'List every included Common and Course Specific item with its exact version or commit.'], ['review', 'Review result and remaining issues', 'Summarize the checks and feedback. State whether any issues remain.']]
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const label = id => routes[id].from + ' → ' + routes[id].to;
  const href = id => '#tower/request/' + id;
  const now = () => new Date().toISOString();
  const date = value => value ? new Date(value).toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' }) : 'Not submitted';
  let shell, db, person = '', problem = '', dirty = false, cleanup = [], mapView = 'map', flow = 'submission';
  const personKey = () => person.trim().toLocaleLowerCase();
  const badge = (text, style = '') => `<span class="ct-tag ${style}">${esc(text)}</span>`;
  const link = (text, url, primary = false) => `<a class="button${primary ? ' primary' : ''}" href="${url}">${esc(text)}</a>`;
  const note = text => `<p class="notice">${esc(text)}</p>`;
  function read() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { schema:1, requests:[] };
    let data;
    try { data = JSON.parse(raw); } catch { throw Error('Stored requests could not be read. Existing data has been left untouched.'); }
    if (data.schema !== 1 || !Array.isArray(data.requests) || data.requests.some(r => !/^[a-f0-9-]{36}$/.test(r.id) || !Object.hasOwn(routes,r.route) || r.type !== routes[r.route].type || !Object.hasOwn(statuses,r.status) || !Array.isArray(r.events) || !r.seenBy || !r.author || !Number.isInteger(r.rev))) throw Error('Stored requests could not be read. Existing data has been left untouched.');
    return data;
  }
  function write(operation) {
    if (problem) throw Error(problem);
    const latest = read();
    operation(latest);
    localStorage.setItem(KEY, JSON.stringify(latest));
    db = latest;
  }
  function update(id, expected, operation) {
    write(data => {
      const request = data.requests.find(r => r.id === id);
      if (!request || request.rev !== expected) throw Error('This request changed in another view. Reload it before saving your changes.');
      operation(request, data);
      request.rev++;
    });
  }
  function fail(error, target = 'ct-message') {
    const element = document.getElementById(target);
    if (element) { element.textContent = error.message || String(error); element.focus(); }
  }
  function requirePerson() {
    if (!person.trim()) throw Error('Set your name in the local profile above before saving or reviewing a request.');
  }
  function event(request, action, reason = '') { request.events.push({ at:now(), by:person, action, reason }); }
  function unread(r) { return r.status !== 'draft' && person && !Object.hasOwn(r.seenBy, personKey()); }
  function counts(route) {
    if (problem) return { pending:'—', fresh:'—', urgent:'—' };
    const rows = db.requests.filter(r => r.route === route && r.status === 'pending');
    return { pending:rows.length, fresh:person ? rows.filter(unread).length : '—', urgent:rows.filter(r => r.priority === 'urgent').length };
  }
  function countHtml(route) {
    const n = counts(route);
    return `<span class="ct-counts"><span><b>${n.pending}</b> Pending</span><span><b>${n.fresh}</b> New</span><span class="${Number(n.urgent) ? 'ct-urgent' : ''}"><b>${n.urgent}</b> Urgent</span></span>`;
  }
  function chrome(body) {
    return `<div class="ct-local"><div><strong>Local prototype</strong><p>Requests and decisions stay in this browser. Names are self-entered, with no account permissions or team synchronization. Approval does not move or publish content.</p></div><form id="ct-person-form"><label for="ct-person">Your name · local profile</label><div><input id="ct-person" maxlength="80" value="${esc(person)}" placeholder="Enter your name" required><button class="button" type="submit">Set name</button></div></form></div><p id="ct-message" class="ct-message" role="alert" tabindex="-1">${esc(problem)}</p>${body}`;
  }
  function show(title, description, body) {
    shell('tower', title, description, chrome(body), false);
    document.getElementById('ct-person-form').addEventListener('submit', e => {
      e.preventDefault();
      if (dirty) { fail(Error('Save this draft before changing your local profile.')); return; }
      try {
        const name = document.getElementById('ct-person').value.trim();
        if (!name) throw Error('Enter your name.');
        localStorage.setItem(PERSON, name); person = name; refresh();
      } catch (error) { fail(error); }
    });
  }
  function refresh() { render(location.hash.slice('#tower'.length).replace(/^\//, ''), shell); }
  function selectedRoutes() { return flow === 'revision' ? ['rev-profiler','rev-studio','rev-common'] : ['profiler','studio','common','release']; }
  function mapMarkup(selected) {
    const lanes = { profiler:{path:'M215 100 C345 100 365 295 490 295',x:28,y:17}, studio:{path:'M215 300 H490',x:29,y:46}, common:{path:'M215 500 C345 500 365 305 490 305',x:28,y:74}, release:{path:'M835 300 H1050',x:75,y:46} };
    const roads = selectedRoutes().map(id => {
      const lane = lanes[routes[id].lane], n = counts(id), active = Number(n.pending) > 0;
      return `<a href="#tower/${id}" data-road="${id}" aria-label="${esc(label(id))}: ${n.pending} pending, ${n.fresh} new, ${n.urgent} urgent"><path class="ct-road-hit" d="${lane.path}"/><path class="ct-road ${active ? 'has-requests' : ''} ${id === selected ? 'selected' : ''}" d="${lane.path}"/><path class="ct-road-center" d="${lane.path}"/></a>`;
    }).join('');
    const labels = selectedRoutes().map(id => {
      const lane = lanes[routes[id].lane];
      return `<a class="ct-lane-label ${id === selected ? 'selected' : ''}" style="left:${lane.x}%;top:${lane.y}%" href="#tower/${id}" data-road="${id}"><span>${esc(label(id))}</span>${countHtml(id)}</a>`;
    }).join('');
    const building = (name, icon, pos, route, subtitle) => `<a class="ct-building ${pos}" href="${route}"><svg viewBox="0 0 ${icon==='tower-building'?'180 240':icon==='beta-screen'||icon==='published-product'?'270 200':'240 180'}" aria-hidden="true"><use href="#${icon}"/></svg><strong>${name}</strong><span>${subtitle}</span></a>`;
    return `<div class="ct-map-wrap"><div id="ct-map" class="map-container ct-map-scroll" role="region" aria-label="Request routes. Scroll horizontally on narrow screens." tabindex="0"><div class="ct-campus"><div class="ct-product-zone"><span>Review &amp; Release</span></div><svg class="ct-roads" viewBox="0 0 1200 600" preserveAspectRatio="none"><path class="ct-shared-road" d="M490 300 H835"/>${roads}</svg>${labels}${building('Course Profiler Manager','profiler-building','ct-profiler','#tower/'+(flow==='revision'?'rev-profiler':'profiler'),'Course packages')}${building('Content Studio','studio-building','ct-studio','#tower/'+(flow==='revision'?'rev-studio':'studio'),'Course Orientation')}${building('Common Studio','studio-building','ct-common','#tower/'+(flow==='revision'?'rev-common':'common'),'Shared content')}${building('Control Tower','tower-building','ct-tower','#tower/all','All requests')}${building('AI-Wise Beta','beta-screen','ct-beta','#tower/'+(flow==='revision'?'all':'release'),'Review workspace')}${building('Published','published-product','ct-published','https://aiwise-eur.github.io/AI-Wise/','Student site ↗')}</div></div><aside id="ct-road-popup" class="ct-road-popup" hidden aria-label="Route summary"></aside></div>`;
  }
  function overview(selected) {
    return `<div class="ct-overview"><div class="toolbar"><div class="view-switch" role="group" aria-label="Control Tower view"><button id="ct-map-button" type="button" aria-pressed="${mapView==='map'}">▦ Map</button><button id="ct-list-button" type="button" aria-pressed="${mapView==='list'}">☷ List</button></div><div class="view-switch" role="group" aria-label="Request direction"><button id="ct-submissions" type="button" aria-pressed="${flow==='submission'}">Submissions &amp; release</button><button id="ct-revisions" type="button" aria-pressed="${flow==='revision'}">Revision requests</button></div></div>${mapMarkup(selected)}<div id="ct-route-list" class="cards">${selectedRoutes().map(id => `<a class="card link" href="#tower/${id}"><h3>${esc(label(id))}</h3>${countHtml(id)}<span class="arrow">View requests →</span></a>`).join('')}</div><p class="ct-caption">Counts cover requests awaiting a decision. New means unopened by the named local reviewer. New and Urgent can overlap. Hover or focus a road to preview; click to open its requests.</p></div>`;
  }
  function wireMap(selected) {
    let closeTimer;
    const popup = document.getElementById('ct-road-popup');
    const close = () => { clearTimeout(closeTimer); popup.hidden = true; };
    const keep = () => clearTimeout(closeTimer);
    const later = () => { clearTimeout(closeTimer); closeTimer = setTimeout(close, 240); };
    function preview(anchor) {
      keep(); const id = anchor.dataset.road;
      const rows = db.requests.filter(r => r.route === id && r.status === 'pending').sort((a,b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0,3);
      popup.innerHTML = `<button class="ct-popup-close" type="button" aria-label="Close route preview">×</button><h3>${esc(label(id))}</h3>${countHtml(id)}<ul>${rows.map(r => `<li><strong>${esc(r.title)}</strong><span>${esc(r.target)} · ${esc(r.version)}</span><small>${esc(date(r.submittedAt))}${unread(r)?' · New':''}${r.priority==='urgent'?' · Urgent':''}</small></li>`).join('') || '<li>No pending requests in this browser.</li>'}</ul>${link('View requests','#tower/'+id)}`;
      popup.hidden = false;
      const wrap = document.querySelector('.ct-map-wrap').getBoundingClientRect(), box = anchor.getBoundingClientRect();
      const width = Math.min(340, wrap.width - 24);
      popup.style.width = width + 'px';
      popup.style.left = Math.max(12, Math.min(box.left-wrap.left, wrap.width-width-12)) + 'px';
      popup.style.top = Math.max(12, Math.min(box.bottom-wrap.top+6, wrap.height-popup.offsetHeight-12)) + 'px';
      popup.querySelector('button').addEventListener('click', close);
      popup.querySelector('a').addEventListener('click', () => { close(); if(location.hash==='#tower/'+id)document.querySelector('.ct-queue').scrollIntoView({block:'start'}); });
    }
    document.querySelectorAll('[data-road]').forEach(a => {
      a.addEventListener('mouseenter', () => preview(a)); a.addEventListener('mouseleave', later);
      a.addEventListener('focus', () => preview(a)); a.addEventListener('blur', e => { if (!popup.contains(e.relatedTarget)) later(); });
      a.addEventListener('click', () => { close(); if(location.hash===a.getAttribute('href'))document.querySelector('.ct-queue').scrollIntoView({block:'start'}); });
    });
    popup.addEventListener('mouseenter', keep); popup.addEventListener('mouseleave', later);
    popup.addEventListener('focusin', keep); popup.addEventListener('focusout', e => { if (!popup.contains(e.relatedTarget)) later(); });
    const escapePopup = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', escapePopup);
    document.getElementById('ct-map').addEventListener('scroll', close);
    cleanup.push(() => { clearTimeout(closeTimer); document.removeEventListener('keydown', escapePopup); });
    function setView(view) {
      mapView = view; close();
      document.querySelector('.ct-map-wrap').hidden = view !== 'map';
      document.getElementById('ct-route-list').hidden = view !== 'list';
      document.getElementById('ct-map-button').setAttribute('aria-pressed', String(view==='map'));
      document.getElementById('ct-list-button').setAttribute('aria-pressed', String(view==='list'));
    }
    setView(mapView);
    document.getElementById('ct-map-button').onclick = () => setView('map');
    document.getElementById('ct-list-button').onclick = () => setView('list');
    const setFlow = value => { flow=value; if(location.hash==='#tower')refresh();else location.hash='#tower'; };
    document.getElementById('ct-submissions').onclick = () => setFlow('submission');
    document.getElementById('ct-revisions').onclick = () => setFlow('revision');
  }
  function list(selected) {
    if (routes[selected]) flow = routes[selected].type === 'revision' ? 'revision' : 'submission';
    show('Control Tower', 'Follow requests between workspaces, review the exact request, and record a decision.', overview(selected) +
      `<section class="ct-queue" aria-labelledby="ct-queue-title"><div class="ct-queue-head"><h2 id="ct-queue-title">${selected==='all'?'All requests':esc(label(selected))}</h2><div class="toolbar">${link('All requests','#tower/all')}${link('New request','#tower/new/'+(selected==='all'?selectedRoutes()[0]:selected),true)}<button class="button" id="ct-export" type="button">Export records</button></div></div><div class="ct-filters"><label>Find a request<input type="search" id="ct-search" placeholder="Title, item, or requestor"></label><label>Status<select id="ct-status"><option value="all">All statuses</option>${Object.entries(statuses).map(([key,name])=>`<option value="${key}">${name}</option>`).join('')}</select></label><label>Attention<select id="ct-attention"><option value="all">All requests</option><option value="new">New to me</option><option value="urgent">Urgent</option></select></label></div><div id="ct-rows" aria-live="polite"></div></section>`);
    wireMap(selected);
    const draw = () => {
      const search = document.getElementById('ct-search').value.toLocaleLowerCase(), status=document.getElementById('ct-status').value, attention=document.getElementById('ct-attention').value;
      const rows = db.requests.filter(r => (selected==='all'||r.route===selected) && (status==='all'||r.status===status) && (attention==='all'||attention==='new'&&unread(r)||attention==='urgent'&&r.priority==='urgent') && [r.title,r.target,r.author.name].join(' ').toLocaleLowerCase().includes(search)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      document.getElementById('ct-rows').innerHTML = rows.length ? `<div class="ct-table-wrap"><table class="ct-table"><thead><tr><th>Request</th><th>Requestor</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td><a href="${href(r.id)}">${esc(r.title||'Untitled draft')}</a><small>${esc(label(r.route))} · ${esc(r.target||'No target yet')} · ${esc(r.version||'No version yet')}</small>${unread(r)?badge('New','ct-new'):''} ${r.priority==='urgent'?badge('Urgent','ct-urgent'):''}</td><td>${esc(r.author.name)}</td><td>${esc(date(r.submittedAt))}</td><td>${badge(statuses[r.status],r.status==='approved'?'ct-approved':'')}${r.status==='approved'?'<small>Not applied</small>':''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state"><h3>${problem?'Requests unavailable':'No matching requests'}</h3><p>${problem?'Stored data could not be read; it has not been replaced.':db.requests.length?'Adjust the filters or create a request.':'Create the first request in this browser. No sample requests have been added.'}</p></div>`;
    };
    ['ct-search','ct-status','ct-attention'].forEach(id=>document.getElementById(id).addEventListener(id==='ct-search'?'input':'change',draw)); draw();
    document.getElementById('ct-export').onclick=()=>{
      try { const data=read(), url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='control-tower-records.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); } catch(error){fail(error);}
    };
  }
  function field(key, title, value='', hint='', multiline=false, required=true) {
    return `<label class="ct-field" for="ct-${key}"><span>${esc(title)}${required?' <b aria-hidden="true">*</b>':' · optional'}</span>${hint?`<small>${esc(hint)}</small>`:''}${multiline?`<textarea id="ct-${key}" name="${key}" rows="4" maxlength="12000" ${required?'required':''}>${esc(value)}</textarea>`:`<input id="ct-${key}" name="${key}" value="${esc(value)}" maxlength="${key==='title'?200:1000}" ${required?'required':''}>`}</label>`;
  }
  function form(route, original=null, previous=null) {
    const values = original || previous || {}, type=routes[route].type;
    show(original?'Edit draft':previous?'Resubmit request':'New request', label(route) + ' · ' + types[type],
      '<div class="toolbar">'+link('Back to requests','#tower/'+route)+(previous?link('Previous submission',href(previous.id)):'')+'</div>'+
      (previous?note('This creates a new submission linked to the previous request. Explain the response to the review; the previous submission and decision remain unchanged.'):'')+
      `<form id="ct-request-form" class="ct-form"><div class="ct-form-meta">${badge(types[type])}<strong>${esc(label(route))}</strong><span>Requestor: ${esc(original?.author.name||person||'Set your name above')}</span></div>`+
      (!original&&!previous?`<label class="ct-field">Request route<select id="ct-route">${Object.keys(routes).map(id=>`<option value="${id}" ${id===route?'selected':''}>${esc(label(id))} · ${types[routes[id].type]}</option>`).join('')}</select></label>`:'')+
      field('title','Title',values.title,'Summarize the request in one sentence.')+
      `<div class="ct-form-grid">${field('target','Target item / course',values.target)}${field('version','Exact version',values.version,'Use a version number or commit reference, not “latest”.')}</div>`+
      field('targetRef','Target reference',values.targetRef,'A URL, commit, or file reference that identifies the artifact for review. Linked files are not copied into this prototype.')+
      field('details','Request details',values.details,'What are you requesting, and why?',true)+
      field('outcome','Expected outcome',values.outcome,'What should be true when this request is complete?',true)+
      extras[type].map(([key,title,hint])=>field(key,title,values[key],hint,true)).join('')+
      field('references','References',values.references,'Related feedback, marked locations, documents, or links.',true,false)+
      `<label class="ct-field">Priority<select id="ct-priority" name="priority"><option value="normal">Normal</option><option value="urgent" ${values.priority==='urgent'?'selected':''}>Urgent</option></select></label><div id="ct-urgent-field">${field('urgentReason','Urgency reason',values.urgentReason,'Explain the deadline or impact.',true,false)}</div>`+
      (previous||original?.parentId?field('response','Response to the previous review',original?.response||'','Explain what changed to address the requested revision.',true):'')+
      '<p class="ct-caption">Required fields are marked *. Submitting fixes this request text for review. Linked artifact contents are not frozen. Approval is separate from application.</p><p id="ct-form-message" class="ct-message" role="alert" tabindex="-1"></p><div class="toolbar"><button class="button" type="submit" value="draft" formnovalidate>Save draft</button><button class="button primary" type="submit" value="submit">Submit request</button></div></form>');
    const formElement=document.getElementById('ct-request-form');
    formElement.addEventListener('input',()=>{dirty=true;});
    function priority(){const urgent=document.getElementById('ct-priority').value==='urgent';document.getElementById('ct-urgent-field').hidden=!urgent;document.getElementById('ct-urgentReason').required=urgent;}
    priority();document.getElementById('ct-priority').addEventListener('change',priority);
    document.getElementById('ct-route')?.addEventListener('change',e=>{const next=e.target.value;if(dirty&&!confirm('Change route and discard the unsaved form?')){e.target.value=route;return;}dirty=false;location.hash='#tower/new/'+next;});
    formElement.addEventListener('submit',e=>{
      e.preventDefault();
      try {
        requirePerson(); const submit=e.submitter?.value==='submit';
        const data=Object.fromEntries(new FormData(formElement)); Object.keys(data).forEach(key=>{data[key]=data[key].trim();});
        if(!data.title)throw Error('Enter a title before saving a draft.');
        if(submit){
          const required=['title','target','version','targetRef','details','outcome',...extras[type].map(x=>x[0])];
          if(data.priority==='urgent')required.push('urgentReason');if(previous||original?.parentId)required.push('response');
          if(required.some(key=>!data[key]))throw Error('Complete all required fields before submitting.');
          if(/^(latest|current|working copy)$/i.test(data.version))throw Error('Use an exact version or commit reference.');
        }
        if(data.priority!=='urgent')data.urgentReason='';
        let id=original?.id;
        if(original){
          update(id,original.rev,r=>{if(r.status!=='draft')throw Error('Only drafts can be edited.');Object.assign(r,data);if(submit){r.status='pending';r.submittedAt=now();}event(r,submit?'Submitted':'Draft saved');});
        }else{
          id=crypto.randomUUID();
          const request={...data,id,route,type,author:{name:person,key:personKey()},createdAt:now(),submittedAt:submit?now():null,status:submit?'pending':'draft',rev:1,parentId:previous?.id||null,seenBy:{},events:[]};
          event(request,submit?'Submitted':'Draft saved');
          write(store=>{
            if(previous){const parent=store.requests.find(r=>r.id===previous.id);if(!parent||parent.status!=='revision')throw Error('The previous request is not awaiting revision.');if(store.requests.some(r=>r.parentId===previous.id))throw Error('A resubmission already exists. Open it from the previous request.');}
            store.requests.push(request);
          });
        }
        dirty=false; location.hash=submit?'#tower/'+route:href(id);
      }catch(error){fail(error,'ct-form-message');}
    });
  }
  function textBlock(title,value){return `<section class="ct-detail-section"><h3>${esc(title)}</h3><p class="ct-preserve">${esc(value||'Not provided')}</p></section>`;}
  function reference(value){
    try {const url=new URL(value);if(['http:','https:'].includes(url.protocol))return `<a class="button" href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Open target reference ↗</a>`;}catch{}
    return '';
  }
  function detail(id) {
    let request=db.requests.find(r=>r.id===id);
    if(!request){show('Request not found','This request is not available in this browser.',link('Back to requests','#tower/all'));return;}
    if(request.status!=='draft'&&person&&!Object.hasOwn(request.seenBy,personKey())){
      try {update(request.id,request.rev,r=>{r.seenBy={...r.seenBy,[personKey()]:now()};});request=db.requests.find(r=>r.id===id);}catch(error){problem=error.message;}
    }
    const parent=db.requests.find(r=>r.id===request.parentId),child=db.requests.find(r=>r.parentId===id);
    const controls=request.status==='draft'?link('Edit draft','#tower/edit/'+id,true):request.status==='revision'?(child?link('Open resubmission',href(child.id),true):link('Revise and resubmit','#tower/resubmit/'+id,true)):'';
    const history=request.events.map(e=>`<li><div><strong>${esc(e.action)}</strong><span>${esc(e.by)} · ${esc(date(e.at))}</span></div>${e.reason?`<p class="ct-preserve">${esc(e.reason)}</p>`:''}</li>`).join('');
    const fields=[['Target item / course',request.target],['Exact version',request.version],['Target reference',request.targetRef],['Request details',request.details],['Expected outcome',request.outcome],...extras[request.type].map(([key,title])=>[title,request[key]]),['References',request.references],...(request.priority==='urgent'?[['Urgency reason',request.urgentReason]]:[]),...(request.parentId?[['Response to previous review',request.response]]:[])];
    show(request.title||'Untitled draft',label(request.route)+' · '+types[request.type],
      '<div class="toolbar">'+link('Back to requests','#tower/'+request.route)+controls+'</div>'+
      `<div class="ct-detail-meta">${badge(statuses[request.status],request.status==='approved'?'ct-approved':'')}${request.priority==='urgent'?badge('Urgent','ct-urgent'):''}<span>Requested by <strong>${esc(request.author.name)}</strong></span><span>${esc(date(request.submittedAt))}</span></div>`+
      (parent?`<div class="ct-previous">${link('Previous submission',href(parent.id))}<p><strong>Previous decision</strong></p><p class="ct-preserve">${esc(parent.decision?.reason||'No decision reason recorded.')}</p><details><summary>Compare with the previous submission</summary>${textBlock('Previous target and version',parent.target+' · '+parent.version)}${textBlock('Previous request details',parent.details)}${textBlock('Previous expected outcome',parent.outcome)}</details></div>`:'')+
      `<div class="ct-detail-grid"><article class="ct-detail-card">${fields.map(([title,value])=>textBlock(title,value)).join('')}${reference(request.targetRef)}</article><aside><section class="ct-detail-card"><h2>Review &amp; decision</h2>${request.status==='pending'?`<p>Review the target reference and request before recording a decision as <strong>${esc(person||'your local profile')}</strong>.</p><form id="ct-decision-form">${field('decisionReason','Decision reason','','For a revision request, specify exactly what needs to change.',true)}<p id="ct-decision-message" class="ct-message" role="alert" tabindex="-1"></p><div class="ct-decision-buttons"><button class="button primary" value="approved" type="submit">Approve</button><button class="button" value="revision" type="submit">Request revision</button><button class="button ct-reject" value="rejected" type="submit">Reject</button></div></form>`:request.decision?`<p><strong>${esc(statuses[request.status])}</strong> by ${esc(request.decision.by)}</p><p class="ct-preserve">${esc(request.decision.reason)}</p>`:'<p>Save and submit the draft to request a review.</p>'}</section><section class="ct-detail-card"><h2>Application</h2><p><strong>Not applied</strong></p><p>Content delivery is not connected. A local approval records a decision only; it does not change Beta or Published.</p></section><section class="ct-detail-card"><h2>Request history</h2><ol class="ct-history">${history}</ol></section></aside></div>`);
    const decisionForm=document.getElementById('ct-decision-form');
    decisionForm?.addEventListener('input',()=>{dirty=true;});
    decisionForm?.addEventListener('submit',e=>{
      e.preventDefault();
      try {
        requirePerson();const status=e.submitter?.value,reason=document.getElementById('ct-decisionReason').value.trim();
        if(!['approved','revision','rejected'].includes(status)||!reason)throw Error('Enter a reason and choose a decision.');
        update(request.id,request.rev,r=>{if(r.status!=='pending')throw Error('This request already has a decision.');r.status=status;r.decision={status,reason,by:person,at:now()};event(r,statuses[status],reason);});
        dirty=false;refresh();document.getElementById('room-title').focus({preventScroll:true});
      }catch(error){fail(error,'ct-decision-message');}
    });
  }
  function dispose() { cleanup.forEach(fn=>fn());cleanup=[];dirty=false; }
  function render(part, shellFunction) {
    dispose();shell=shellFunction;problem='';
    try {person=localStorage.getItem(PERSON)||'';db=read();}catch(error){problem=error.message||'Browser storage is unavailable.';db={schema:1,requests:[]};}
    const [view='',id='']=part.split('/');
    if(view==='request'){detail(id);return;}
    if(view==='new'&&routes[id]){form(id);return;}
    if(['edit','resubmit'].includes(view)){
      const r=db.requests.find(item=>item.id===id);
      if(r&&view==='edit'&&r.status==='draft'){form(r.route,r);return;}
      if(r&&view==='resubmit'&&r.status==='revision'){
        const child=db.requests.find(item=>item.parentId===id);
        if(child){detail(child.id);return;}form(r.route,null,r);return;
      }
      show('Request unavailable','This request cannot be edited or resubmitted in its current state.',link('Back to requests','#tower/all'));return;
    }
    list(routes[view]?view:'all');
  }
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  window.addEventListener('storage',e=>{if(e.key===KEY&&location.hash.startsWith('#tower')){
    if(dirty)fail(Error('Records changed in another tab. Your unsaved text is still here; reload before saving.'));
    else refresh();
  }});
  window.AIWiseControlTower={render,dispose,canLeave:()=>!dirty||confirm('Leave without saving your changes?')};
})();
