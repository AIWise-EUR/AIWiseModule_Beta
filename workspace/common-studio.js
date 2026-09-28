/* Shared module text adapter for the same editor used by Content Studio.
   Source markup and course slots are never rewritten by author-entered text. */
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
  function apply(s, openEditor) {
    const doc = s.frame.contentDocument;
    if (!s.commonBlocks) {
      // Include current course examples for context, without adding them to the editable catalog.
      window.AIWiseCourseRenderer.fillSlots(s.source, doc);
      window.AIWiseCourseRenderer.toggleRequired(s.source, doc);
      s.commonBlocks = catalog(doc, s.chapter);
      if (s.commonBlocks.length !== s.items.length) throw Error('Common content changed');
      s.commonBlocks.forEach((block, index) => {
        block.node.id = block.node.id || 'cs-item-' + index;
        block.node.dataset.csCommonItem = index;
        block.node.classList.add('cs-editable'); block.node.tabIndex = -1;
        const edit = doc.createElement('button'); edit.type = 'button'; edit.className = 'cs-edit-label';
        edit.textContent = 'Edit'; edit.setAttribute('aria-label', 'Edit ' + block.title);
        edit.addEventListener('click', () => openEditor(s, index));
        // Keep carousel and tab layout intact: the edit action lives inside its own block.
        if (block.node.matches('.technique-pane,.critique-slide')) block.node.prepend(edit);
        else block.node.before(edit);
        block.node.addEventListener('click', event => {
          if (event.target.closest('a,button,summary,[role="button"],[data-slot],.carousel-container')) return;
          event.stopPropagation(); openEditor(s, index);
        });
      });
    }
    s.commonBlocks.forEach(block => {
      const values = Object.values(s.values[block.path]);
      block.nodes.forEach((node, i) => { node.nodeValue = values[i]; });
    });
  }
  window.AIWiseCommonStudio = {chapters, names, catalog, apply,
    target: (s, index) => s.commonBlocks?.[index]?.node};
})();
