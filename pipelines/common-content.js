/* Shared text catalog and safe approved-content renderer. Course slots are excluded. */
(() => {
  'use strict';
  const chapters = ['c1', 'c2', 'c3'];
  const names = {c1: 'What is GenAI?', c2: 'GenAI and human cognition', c3: 'How to engage with GenAI'};
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
  function catalog(doc, chapter) {
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
  function valid(slots, blocks) {
    return slots && typeof slots === 'object' && !Array.isArray(slots) &&
      Object.keys(slots).length === blocks.length && blocks.every(block => {
        const value = slots[block.path];
        return value && typeof value === 'object' && !Array.isArray(value) &&
          Object.keys(value).length === Object.keys(block.fields).length &&
          Object.keys(block.fields).every(key => Object.hasOwn(value, key) && typeof value[key] === 'string');
      });
  }
  function apply(doc, chapter, slots) {
    const blocks = catalog(doc, chapter);
    if (!valid(slots, blocks)) throw Error('Approved shared content no longer matches this chapter.');
    blocks.forEach(block => {
      Object.keys(block.fields).forEach((key, i) => { block.nodes[i].nodeValue = slots[block.path][key]; });
    });
  }
  window.AIWiseCommonContent = Object.freeze({chapters, names, catalog, valid, apply});
  if (document.currentScript?.hasAttribute('data-editor-only')) return;
  document.addEventListener('DOMContentLoaded', async () => {
    const chapter = document.querySelector('[data-current-block]')?.dataset.currentBlock;
    if (!chapters.includes(chapter)) return;
    try {
      const rows = await window.AIWiseBetaContent.read('common');
      const row = rows.find(row => row.chapter === chapter);
      if (row) apply(document, chapter, row.slots);
    } catch (error) {
      const note = document.createElement('p'); note.setAttribute('role','alert');
      note.textContent = 'The latest shared content could not be loaded. Reload to try again.';
      note.style.cssText = 'padding:16px;background:#fff3e8;color:#682b1b;border:1px solid #b97b57';
      document.querySelector('main')?.prepend(note);
    }
  }, {once:true});
})();
