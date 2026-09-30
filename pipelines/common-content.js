/* Shared text catalog and safe approved-content renderer. Course slots are excluded. */
(() => {
  'use strict';
  const chapters = ['c1', 'c2', 'c3', 'map'];
  const names = {c1: 'What is GenAI?', c2: 'GenAI and human cognition', c3: 'How to engage with GenAI', map: 'C1 · GenAI system map'};
  const excluded = '[data-slot], script, style, .hero-tag, .section-tag, .sl-col-icon, .cs-edit-label, .critique-nav, .template-copy, .cycle-step-num, .cycle-arrow, .technique-num, .cst-num, [aria-hidden="true"]';
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
  const ignored = 'script,style,[data-slot],.cs-edit-label,[data-common-generated],.fb-widget,.aiwise-course-switch,.aiwise-course-modal,[data-language-notice],#root,#tooltip';
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
      Object.keys(slots).length === blocks.length && blocks.every(block => {
        const value = slots[block.path];
        return value && typeof value === 'object' && !Array.isArray(value) &&
          Object.keys(value).length === Object.keys(block.fields).length &&
          Object.keys(block.fields).every(key => Object.hasOwn(value, key) && typeof value[key] === 'string');
      });
  }
  function apply(doc, chapter, slots, blocks = catalog(doc, chapter)) {
    if (!valid(slots, blocks)) throw Error('Approved shared content no longer matches this chapter.');
    blocks.forEach(block => {
      Object.keys(block.fields).forEach((key, i) => { block.nodes[i].nodeValue = slots[block.path][key]; });
    });
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
      if(row) { apply(document,chapter,row.slots,sourceBlocks); document.documentElement.lang=locale; }
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
