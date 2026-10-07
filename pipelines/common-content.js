/* Optional Studio extension. Legacy slots and catalog IDs remain unchanged. */
(() => {
  'use strict';
  const key = '_studio', sizes = [14,16,18,22,28,36];
  const clone = v => JSON.parse(JSON.stringify(v));
  const plain = runs => runs.map(r=>r.text).join('');
  const rich = text => [{text:String(text)}];
  const object = v => !!v && typeof v==='object' && !Array.isArray(v);
  const only = (v,keys) => object(v) && Object.keys(v).every(k=>keys.includes(k));
  const templates = ['gradient-row','fn-card','dual-card','sl-card','text'];
  const clean = slots => Object.fromEntries(Object.entries(slots).filter(([k])=>k!==key));
  const extension = slots => slots[key] || {version:1,formats:[],boxes:[]};
  function validRuns(runs) {
    return Array.isArray(runs) && runs.length>0 && runs.length<=2000 && runs.every(r=>only(r,['text','bold','italic','color','size']) && typeof r.text==='string' && r.text.length<=100000 && (r.bold===undefined||typeof r.bold==='boolean') && (r.italic===undefined||typeof r.italic==='boolean') && (r.color===undefined||/^#[0-9a-f]{6}$/i.test(r.color)) && (r.size===undefined||sizes.includes(r.size)));
  }
  function valid(ext,slots) {
    if(ext===undefined)return true;
    if(!only(ext,['version','formats','boxes'])||ext.version!==1||!Array.isArray(ext.formats)||ext.formats.length>2000||!Array.isArray(ext.boxes)||ext.boxes.length>50)return false;
    const ids=new Set(), paths=new Set();
    return ext.formats.every(f=>{
      if(!only(f,['slot','path','runs'])||(!Object.hasOwn(slots,f.slot)||f.slot===key)||!Array.isArray(f.path)||f.path.length>10||f.path.some(k=>typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))||!validRuns(f.runs))return false;
      let text=slots[f.slot];for(const k of f.path)text=object(text)||Array.isArray(text)?text[k]:undefined;
      const id=JSON.stringify([f.slot,f.path]);if(paths.has(id)||typeof text!=='string'||plain(f.runs)!==text)return false;paths.add(id);return true;
    }) && ext.boxes.every(b=>{
      if(!only(b,['id','slot','template','anchor','fields','align','size'])||!/^box-[a-f0-9-]{36}$/.test(b.id||'')||ids.has(b.id)||(!Object.hasOwn(slots,b.slot)||b.slot===key)||!templates.includes(b.template)||!Number.isInteger(b.anchor)||b.anchor<0||b.anchor>200||!['left','center','right'].includes(b.align)||!(b.size===0||sizes.includes(b.size))||!Array.isArray(b.fields)||!b.fields.length||b.fields.length>100||!b.fields.every(validRuns))return false;
      ids.add(b.id);return b.template!=='text'||b.fields.length===2;
    });
  }
  function normalize(runs) {
    const out = [];
    for (const run of runs) {
      if (!run.text) continue;
      const next = {text:run.text};
      if (run.bold) next.bold = true;
      if (run.italic) next.italic = true;
      if (/^#[0-9a-f]{6}$/i.test(run.color || '')) next.color = run.color.toLowerCase();
      if (sizes.includes(run.size)) next.size = run.size;
      const previous = out[out.length - 1];
      if (previous && JSON.stringify({...previous,text:''}) === JSON.stringify({...next,text:''})) previous.text += next.text;
      else out.push(next);
    }
    return out.length ? out : rich('');
  }
  function format(runs, start, end, mark, value) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > plain(runs).length || end <= start) return clone(runs);
    if (!['bold','italic','color','size','clear'].includes(mark)) throw Error('Unsupported format');
    let offset = 0;
    const out = [];
    for (const run of runs) {
      const a = Math.max(0, start - offset), b = Math.min(run.text.length, end - offset);
      if (a < b) {
        if (a) out.push({...run,text:run.text.slice(0,a)});
        const mid = {...run,text:run.text.slice(a,b)};
        if (mark === 'clear') out.push({text:mid.text});
        else { if (value === false) delete mid[mark]; else mid[mark] = value; out.push(mid); }
        if (b < run.text.length) out.push({...run,text:run.text.slice(b)});
      } else out.push({...run});
      offset += run.text.length;
    }
    return normalize(out);
  }

  // Verified reading references are presentation metadata, not authored HTML.
  // Keep saved runs and their offsets unchanged, including citations split by formatting.
  const references = [{text:'Passeport et al. (2026)',href:'https://doi.org/10.5281/zenodo.21893023'}];
  function renderRuns(doc,runs,defaultSize=0,linkReferences=true) {
    const fragment=doc.createDocumentFragment(),text=plain(runs),matches=[];
    if(linkReferences)for(const reference of references){
      let start=text.indexOf(reference.text);
      while(start>=0){
        if(!/[\p{L}\p{N}_]/u.test(text[start-1]||''))matches.push({...reference,start,end:start+reference.text.length});
        start=text.indexOf(reference.text,start+reference.text.length);
      }
    }
    matches.sort((a,b)=>a.start-b.start);
    let offset=0,index=0,anchor=null;
    const append=(parent,run,value)=>{const span=doc.createElement('span');span.textContent=value;
      if(run.bold)span.style.fontWeight='700';if(run.italic)span.style.fontStyle='italic';
      if(run.color)span.style.color=run.color;if(run.size||defaultSize)span.style.fontSize=(run.size||defaultSize)+'px';
      span.style.whiteSpace='pre-wrap';parent.append(span);
    };
    for(const run of runs){
      const end=offset+run.text.length;let position=offset;
      while(position<end){
        while(matches[index]&&matches[index].end<=position){index++;anchor=null;}
        const match=matches[index],linked=match&&position>=match.start;
        const stop=Math.min(end,match?(linked?match.end:match.start):end);
        if(linked&&!anchor){
          anchor=doc.createElement('a');anchor.href=match.href;anchor.target='_blank';anchor.rel='noopener noreferrer';
          anchor.className='studio-reference-link';anchor.title='Read the preprint (opens in a new tab)';
          anchor.style.color='var(--accent, #2b5d63)';anchor.style.textDecoration='underline';anchor.style.textUnderlineOffset='0.15em';
          fragment.append(anchor);
        }
        append(linked?anchor:fragment,run,run.text.slice(position-offset,stop-offset));position=stop;
      }
      offset=end;
    }return fragment;
  }
  // Retain original Text nodes so repeated preview renders cannot change positional labels.
  const replaced = new WeakMap();
  function restore(doc,group='common') {
    const pairs=replaced.get(doc)||[];for(const pair of pairs.filter(p=>p.group===group)){if(pair.wrapper.parentNode)pair.wrapper.replaceWith(pair.node);}
    replaced.set(doc,pairs.filter(p=>p.group!==group));
    doc.querySelectorAll(group==='course'?'[data-studio-course-box]':'[data-studio-box]:not([data-studio-course-box])').forEach(n=>n.remove());
  }
  function replaceText(node,runs,group='common') {
    if(!node?.parentNode||node.nodeType!==3)return;
    const doc=node.ownerDocument, wrapper=doc.createElement('span');wrapper.dataset.studioRich='';wrapper.append(renderRuns(doc,runs,0,!node.parentElement.closest('a')));
    const list=replaced.get(doc)||[];list.push({node,wrapper,group});replaced.set(doc,list);node.replaceWith(wrapper);
  }
  function nodes(root) {
    const out=[],walk=root.ownerDocument.createTreeWalker(root,4);
    while(walk.nextNode()){const n=walk.currentNode;if(n.nodeValue.trim()&&!n.parentElement.closest('script,style,button,.cs-edit-label,[aria-hidden="true"],.gradient-indicator'))out.push(n);}return out;
  }
  function candidates(root,type) {
    if(type==='text')return [root];
    return [...(root.matches('.'+type)?[root]:[]),...root.querySelectorAll('.'+type)].filter(n=>!n.closest('[data-studio-box]'));
  }
  function common(doc,slots,blocks) {
    const ext=extension(slots),tails=new Map();
    for(const f of ext.formats){const block=blocks.find(b=>b.path===f.slot),i=block&&Object.keys(block.fields).indexOf(f.path[0]);
      if(f.path.length===1&&i>=0&&block.nodes[i].nodeType===3)replaceText(block.nodes[i],f.runs);
    }
    for(const box of ext.boxes){const root=blocks.find(b=>b.path===box.slot)?.node;if(!root)throw Error('The added box location is no longer available.');
      const source=candidates(root,box.template)[box.anchor];if(!source)throw Error('The added box template is no longer available.');
      let node;
      if(box.template==='text'){node=doc.createElement('div');node.className='studio-text-box';node.style.cssText='padding:24px;margin:16px 0;border:1px solid #d7e0e0;border-radius:16px;background:#f5f7f7';node.innerHTML='<h4 style="margin:0 0 12px;font-weight:600"></h4><div style="line-height:1.7"></div>';[...node.children].forEach((n,i)=>n.append(renderRuns(doc,box.fields[i],box.size)));}
      else {node=source.cloneNode(true);node.querySelectorAll('.cs-edit-label,[data-studio-box]').forEach(n=>n.remove());
        // Cloning an already formatted source must not alter its editable field count.
        node.querySelectorAll('[data-studio-rich]').forEach(n=>n.replaceWith(doc.createTextNode(n.textContent)));
        const fields=nodes(node);if(fields.length!==box.fields.length)throw Error('The added box template changed.');fields.forEach((n,i)=>{const span=doc.createElement('span');span.append(renderRuns(doc,box.fields[i],box.size,!n.parentElement.closest('a')));n.replaceWith(span);});
      }
      [node,...node.querySelectorAll('*')].forEach(n=>{n.removeAttribute('id');n.removeAttribute('tabindex');n.classList.remove('cs-editable');for(const a of [...n.attributes])if(/^on|^data-cs-|^data-review-/.test(a.name))n.removeAttribute(a.name);});
      node.dataset.studioBox=box.id;node.dataset.reviewCommonKey=box.slot;node.style.textAlign=box.align;if(box.size)node.style.fontSize=box.size+'px';
      const title=node.querySelector('.fn-card-title'),body=node.querySelector('.fn-card-body');if(title&&body){title.tabIndex=0;title.setAttribute('role','button');const refresh=()=>{title.setAttribute('aria-expanded',String(node.classList.contains('open')));body.style.maxHeight=node.classList.contains('open')?'none':'0';};const toggle=()=>{node.classList.toggle('open');refresh();};title.onclick=toggle;title.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle();}};refresh();}
      const tailKey=box.slot+':'+box.template+':'+box.anchor,tail=tails.get(tailKey)||source;tail.after(node);tails.set(tailKey,node);
    }
  }
  function course(doc,data) {
    restore(doc,'course');
    for(const chapter of ['c2','c3'])for(const f of data._studio?.[chapter]?.formats||[]){
      let root=doc.querySelector('[data-slot="'+f.slot+'"]');if(!root)continue;
      if(f.slot==='c2.examples'){root=root.querySelectorAll('.carousel-card')[Number(f.path[0])];const field=f.path[1];if(root&&['thinking','typing','typing_note','processing'].includes(field))root=root.querySelector('.layer-'+(field==='typing_note'?'typing':field));else if(root&&field==='title')root=root.querySelector('.carousel-card-header');}if(!root)continue;
      if(f.slot==='c2.sat_example'){
        if(f.path[0]==='phases'){
          root=root.querySelector('[data-sat-phase="'+Number(f.path[1])+'"]');
          if(f.path[2]==='label')root=root?.querySelector('.sat-phase-label');
          else if(f.path[2]==='steps'){
            root=root?.querySelector('[data-sat-step="'+Number(f.path[3])+'"]');
            root=root?.querySelector(f.path[4]==='name'?'.sat-step-name':f.path[4]==='text'?'.sat-step-text':'.sat-step-badge');
          }
        }else if(f.path[0]==='note')root=root.querySelector('.sat-example-note');
        if(!root)continue;
      }
      const text=plain(f.runs);if(!text)continue;
      const segments=[],walk=doc.createTreeWalker(root,5);let content='';
      while(walk.nextNode()){const n=walk.currentNode;if(n.nodeType===1&&n.tagName==='BR'){content+='\n';continue;}if(n.nodeType!==3||n.parentElement.closest('[data-copy-use],[data-example-index],button,script,style'))continue;segments.push({node:n,start:content.length,end:content.length+n.nodeValue.length});content+=n.nodeValue;}
      const start=content.indexOf(text);if(start<0)continue;const end=start+text.length;
      const slice=(a,b)=>{let offset=0;return f.runs.flatMap(r=>{const l=Math.max(0,a-offset),h=Math.min(r.text.length,b-offset);offset+=r.text.length;return l<h?[{...r,text:r.text.slice(l,h)}]:[];});};
      for(const segment of segments){const a=Math.max(start,segment.start),b=Math.min(end,segment.end);if(a>=b)continue;const n=segment.node,before=n.nodeValue.slice(0,a-segment.start),after=n.nodeValue.slice(b-segment.start);replaceText(n,[...(before?rich(before):[]),...slice(a-start,b-start),...(after?rich(after):[])],'course');}

    }
    for(const chapter of ['c2','c3']){
      // Course data carries both chapters even when this document displays only one.
      // Keep missing-anchor checks for the displayed chapter, not unrelated chapters.
      if(!doc.querySelector('[data-slot^="'+chapter+'."]'))continue;
      const boxes=data._studio?.[chapter]?.boxes||[];if(!boxes.length)continue;
      const blocks=[...new Set(boxes.map(b=>b.slot))].map(path=>{let node=doc.querySelector('[data-slot="'+path+'"]');if(path==='c2.examples')node=node?.closest('.carousel-container')||node;return {path,node};}).filter(b=>b.node);
      common(doc,{_studio:{version:1,formats:[],boxes}},blocks);
      for(const b of boxes)doc.querySelector('[data-studio-box="'+b.id+'"]')?.setAttribute('data-studio-course-box','');
    }
  }
  function validSAT(value) {
    const text=v=>typeof v==='string'&&v.length<=100000;
    const keys=(v,names)=>object(v)&&Object.keys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
    return keys(value,['phases','note'])&&text(value.note)&&Array.isArray(value.phases)&&value.phases.length<=50&&value.phases.every(p=>
      keys(p,['label','steps'])&&text(p.label)&&Array.isArray(p.steps)&&p.steps.length===4&&p.steps.every(s=>
        keys(s,['actor','name','text'])&&['self','ai','team'].includes(s.actor)&&text(s.name)&&text(s.text)));
  }
  function validCopy(value,base,field='') {
    if(field==='c2.sat_example')return validSAT(value)&&validSAT(base);
    if(typeof base==='string')return typeof value==='string'&&value.length<=100000&&(field!=='actor'||!['self','student','ai','team'].includes(base)||['self','student','ai','team'].includes(value))&&(field!=='tag'||!['adopt','modify','discard'].includes(base)||['adopt','modify','discard'].includes(value));
    if(Array.isArray(base))return Array.isArray(value)&&(field==='c2.examples'?value.length>0&&value.length<=50:value.length===base.length)&&value.every((v,i)=>validCopy(v,field==='c2.examples'?base[0]:base[i]));
    if(!object(base)||!object(value))return false;
    if(!field&&(!valid(value[key],value)||!valid(base[key],base)))return false;
    return Object.keys(base).filter(k=>field||k!==key).every(k=>k==='typing_note'&&!Object.hasOwn(value,k)&&Object.hasOwn(base,'typing')||validCopy(value[k],base[k],k))&&Object.keys(value).every(k=>!field&&k===key||Object.hasOwn(base,k)||k==='typing_note'&&Object.hasOwn(base,'typing')&&typeof value[k]==='string');
  }
  window.AIWiseStudioBlocks={key,sizes,templates,clone,plain,rich,format,valid,validRuns,validSAT,validCopy,clean,extension,renderRuns,replaceText,restore,nodes,candidates,common,course};
})();

/* Shared text catalog and safe approved-content renderer. Course slots are excluded. */
(() => {
  'use strict';
  const chapters = ['c1', 'c2', 'c3', 'map'];
  const names = {c1: 'What is GenAI?', c2: 'GenAI and human cognition', c3: 'How to engage with GenAI', map: 'C1 · GenAI system map'};
  const excluded = '[data-studio-box], [data-slot], script, style, .hero-tag, .section-tag, .sl-col-icon, .cs-edit-label, .critique-nav, .template-copy, .cycle-step-num, .cycle-arrow, .technique-num, .cst-num, [aria-hidden="true"]';
  function textNodes(root) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeValue.trim() && !node.parentElement.closest(excluded)) nodes.push(node);
    }
    return nodes;
  }
  function legacyCatalog(doc, chapter) {
    const blocks = [];
    function add(node) {
      if (node.matches(excluded) || !textNodes(node).length) return;
      if (node.matches('.part-block,.sl-grid,.sl-col,.sl-col-body,.framework-cards') || node.querySelector('.technique-pane,.critique-slide,.sl-card,.fn-card')) {
        [...node.children].forEach(add);
      } else blocks.push(node);
    }
    doc.querySelectorAll('section.hero, section.section').forEach(section => {
      const container = section.querySelector('.hero-inner') || section;
      [...container.children].forEach(add);
    });
    const sources = doc.querySelector('main > .sources');
    if (sources) add(sources);
    return blocks.map((node, index) => {
      const nodes = textNodes(node), fields = {}, counts = {};
      nodes.forEach(text => {
        const tag = text.parentElement.tagName.toLowerCase();
        const kind = /^h[1-6]$/.test(tag) ? 'Heading' : ['td','th'].includes(tag) ? 'Table text' :
          tag === 'li' ? 'List text' : ['text','tspan'].includes(tag) ? 'Diagram label' :
          tag === 'a' ? 'Link text' : tag === 'strong' || tag === 'b' ? 'Emphasis' : 'Text';
        counts[kind] = (counts[kind] || 0) + 1;
        fields[`${kind} ${counts[kind]}`] = text.nodeValue;
      });
      const heading = node.querySelector('h2,h3,h4,[class$="-title"],[class$="-header"]');
      const friendly = node.matches('.technique-tabs') ? (node.closest('.proactive-panel') ? 'Proactive technique tabs' : 'Prompt technique tabs') :
        node.matches('.critique-stepper-bar') ? 'Review step labels' : node.matches('.cycle-bar') ? 'Prompt → Critique → Integrate' :
        node.matches('.template-block') ? (node.previousElementSibling?.textContent.trim() || 'Prompt template') :
        node.matches('.code-compare') ? 'Markdown and XML' : '';
      const title = (friendly || heading?.textContent || nodes.find(text => /[a-zA-Z]{2}/.test(text.nodeValue))?.nodeValue || nodes[0].nodeValue).trim().replace(/\s+/g, ' ');
      const section = node.closest('section');
      return {path: `${chapter}.block-${index}`, title: title.length > 75 ? title.slice(0, 72) + '…' : title,
        section: section?.querySelector('h2,h3')?.textContent.trim() || 'Introduction', node, nodes, fields};
    });
  }
  const ignored = 'script,style,[data-slot],[data-studio-box],.cs-edit-label,[data-common-generated],.fb-widget,.aiwise-course-switch,.aiwise-course-modal,[data-language-notice],#root,#tooltip';
  function catalog(doc, chapter) {
    // Coalesce entity-split text nodes consistently in browsers and offline parsers.
    doc.body.normalize(); doc.head.normalize();
    // Preserve original block IDs; the migration remaps any entity-split field names.
    const blocks = legacyCatalog(doc, chapter), claimed = new Set(blocks.flatMap(b => b.nodes));
    const groups = new Map();
    const add = (node, ref, kind) => {
      if (node.closest(ignored) || claimed.has(ref)) return;
      const root = node.closest('[data-anatomy-copy],[data-common-copy],header,footer,nav,.side-nav,.mobile-core-nav') || node;
      if (!groups.has(root)) groups.set(root, []);
      if(node.hasAttribute('data-map-field'))kind=({label:'Label',tag:'Category',desc:'Description'})[node.getAttribute('data-map-field')];
      if(node.hasAttribute('data-copy'))kind=node.getAttribute('data-copy').replace(/^nav-/, 'Navigation ').replace(/-/g,' ');
      groups.get(root).push({ref:ref.nodeType===2?{get nodeValue(){return ref.value;},set nodeValue(value){ref.value=value;}}:ref, kind}); claimed.add(ref);
    };
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const ref = walker.currentNode;
      if (ref.nodeValue.trim()) add(ref.parentElement, ref, 'Text');
    }
    doc.querySelectorAll('title,[alt],[title],[aria-label],[placeholder]').forEach(node => {
      if (node.tagName.toLowerCase() === 'title' && node.firstChild) add(node,node.firstChild,'Page title');
      ['alt','title','aria-label','placeholder'].forEach(key => {
        const ref=node.getAttributeNode(key); if(ref?.value.trim()) add(node,ref,key);
      });
    });
    let index=0;
    for (const [node, entries] of groups) {
      const fields={}, nodes=[], counts={};
      for (const {ref,kind} of entries) {
        const key=kind+' '+(counts[kind]=(counts[kind]||0)+1); fields[key]=ref.nodeValue; nodes.push(ref);
      }
      const title=node.hasAttribute('data-common-copy')?'Navigation, controls & feedback labels':
        node.hasAttribute('data-anatomy-copy')?'System map · '+node.querySelector('[data-map-field=label]').textContent.replace(/\n/g,' '):
        (node.textContent.trim().replace(/\s+/g,' ').slice(0,70)||entries[0].ref.nodeValue);
      blocks.push({path:chapter+'.extra-'+index++,title,section:'Interface & supporting content',node,nodes,fields});
    }
    return blocks;
  }
  function copy(doc, key, fallback='') { return doc.querySelector('[data-copy="'+key+'"]')?.textContent ?? fallback; }
  function sync(doc) {
    doc.querySelectorAll('[data-example-index]').forEach(node=>{node.textContent=copy(doc,'example','Example')+' '+node.dataset.exampleIndex+' '+copy(doc,'of','of')+' '+node.dataset.exampleTotal;});
    doc.querySelectorAll('[data-copy-use]').forEach(node => {node.textContent=copy(doc,node.dataset.copyUse,node.textContent);});
    doc.querySelectorAll('[data-copy-toggle]').forEach(node => {node.setAttribute('aria-label',copy(doc,'nav-'+node.dataset.copyToggle)+' '+copy(doc,'subsections'));});
    doc.querySelectorAll('[data-copy-attr]').forEach(node => {
      const [attr,key]=node.dataset.copyAttr.split(':');
      if(['aria-label','placeholder'].includes(attr))node.setAttribute(attr,copy(doc,key,node.getAttribute(attr)));
    });
    doc.defaultView?.AIWiseAnatomy?.refreshTexts();
  }
  function valid(slots, blocks) {
    return slots && typeof slots === 'object' && !Array.isArray(slots) &&
      window.AIWiseStudioBlocks.valid(slots._studio,slots) && Object.keys(slots).filter(k=>k!=='_studio').length === blocks.length && blocks.every(block => {
        const value = slots[block.path];
        return value && typeof value === 'object' && !Array.isArray(value) &&
          Object.keys(value).length === Object.keys(block.fields).length &&
          Object.keys(block.fields).every(key => Object.hasOwn(value, key) && typeof value[key] === 'string');
      });
  }
  function apply(doc, chapter, slots, blocks) {
    window.AIWiseStudioBlocks.restore(doc);
    blocks=blocks||catalog(doc,chapter);
    if (!valid(slots, blocks)) throw Error('Approved shared content no longer matches this chapter.');
    blocks.forEach(block => {
      block.node.dataset.reviewCommonKey = block.path;
      Object.keys(block.fields).forEach((key, i) => { block.nodes[i].nodeValue = slots[block.path][key]; });
    });
    window.AIWiseStudioBlocks.common(doc,slots,blocks);
    sync(doc);
  }
  window.AIWiseCommonContent = Object.freeze({chapters, names, catalog, legacyCatalog, valid, apply, copy, sync});
  if (document.currentScript?.hasAttribute('data-editor-only')) return;
  if (new URL(location.href).searchParams.has('studio-preview')) return;
  const chapter = document.querySelector('[data-current-block]')?.dataset.currentBlock || (document.querySelector('[data-anatomy-copy]') ? 'map' : null);
  const sourceBlocks = chapters.includes(chapter) ? catalog(document,chapter) : [];
  const ready = new Promise(resolve => document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  window.AIWiseCommonReady = ready.then(async () => {
    if (!chapters.includes(chapter)) return;
    const locale=window.AIWiseLanguage?.current() || 'en';
    try {
      const rows=await window.AIWiseBetaContent.read('common',locale), row=rows.find(r=>r.chapter===chapter);
      if(row) { apply(document,chapter,row.slots,sourceBlocks); document.documentElement.lang=row.fallback_locale||locale;
        if(row.fallback_locale){const note=document.createElement('p');note.dataset.languageNotice='';note.setAttribute('role','status');note.textContent='Nederlands was not approved for this page in this version. The saved English content is shown.';note.style.cssText='padding:12px;background:#fff3e8;color:#682b1b;margin:0';(document.querySelector('main')||document.body).prepend(note);}
      }
      else if(locale==='nl') {
        const note=document.createElement('p');note.dataset.languageNotice='';note.setAttribute('role','status');
        note.textContent='Nederlands is not approved for this page yet. English source is shown.';
        note.style.cssText='padding:12px;background:#fff3e8;color:#682b1b;margin:0';
        (document.querySelector('main')||document.body).prepend(note);
      }
      sync(document);
    } catch(error) {
      const note=document.createElement('p');note.dataset.languageNotice='';note.setAttribute('role','alert');
      note.textContent='The latest shared content could not be loaded. Reload to try again.';
      note.style.cssText='padding:16px;background:#fff3e8;color:#682b1b;border:1px solid #b97b57';
      (document.querySelector('main')||document.body).prepend(note);
    }
  });
})();
