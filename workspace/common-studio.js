/* Shared module text adapter for the same editor used by Content Studio.
   Source markup and course slots are never rewritten by author-entered text. */
(() => {
  'use strict';
  const {chapters, names, catalog} = window.AIWiseCommonContent;
  function apply(s, openEditor) {
    const doc = s.frame.contentDocument;
    if (!s.commonBlocks) {
      if(s.chapter==='map'){const style=doc.createElement('style');style.textContent='[data-cs-common-item]{cursor:pointer;outline:1px dashed #35617f;outline-offset:2px}[data-cs-common-item]:focus-visible{outline:3px solid #35617f}';doc.head.appendChild(style);}
      // Include current course examples for context, without adding them to the editable catalog.
      window.AIWiseCourseRenderer.fillSlots(s.source, doc);
      window.AIWiseCourseRenderer.toggleRequired(s.source, doc);
      s.commonBlocks = catalog(doc, s.chapter);
      if (s.commonBlocks.length !== s.items.length) throw Error('Common content changed');
      s.commonBlocks.forEach((block, index) => {
        const node = s.chapter === 'map' && block.node.hasAttribute('data-anatomy-copy') ? doc.querySelector('[data-id="'+block.node.getAttribute('data-anatomy-copy')+'"]') || block.node : block.node;
        block.target = node;
        if (node.closest('[hidden]') || node.ownerDocument.head.contains(node)) return;
        node.id = node.id || 'cs-item-' + index;
        node.dataset.csCommonItem = index;
        node.classList.add('cs-editable'); node.tabIndex = 0;
        const edit = doc.createElement('button'); edit.type = 'button'; edit.className = 'cs-edit-label';
        edit.textContent = 'Edit'; edit.setAttribute('aria-label', 'Edit ' + block.title);
        edit.addEventListener('click', () => openEditor(s, index));
        // Keep carousel and tab layout intact: the edit action lives inside its own block.
        if (s.chapter !== 'map') { if (node.matches('.technique-pane,.critique-slide')) node.prepend(edit); else node.before(edit); }
        node.addEventListener('click', event => {
          if (event.target.closest('a,button,summary,[role="button"],[data-slot],.carousel-container')) return;
          event.stopPropagation(); openEditor(s, index);
        });
        node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(s,index); } });
      });
    }
    s.commonBlocks.forEach(block => {
      Object.keys(block.fields).forEach((key, i) => { block.nodes[i].nodeValue = s.values[block.path][key]; });
    });
    window.AIWiseCommonContent.sync(doc);
    doc.documentElement.lang = s.locale || 'en';
  }
  function upgradeDraft(saved,base) {
    if(saved?.scope!=='common'||(saved.locale||'en')!=='en'||!saved.slots||!saved.baseSlots)return null;
    const keys=Object.keys(saved.baseSlots);
    if(!keys.length||keys.length>=Object.keys(base).length||Object.keys(saved.slots).length!==keys.length)return null;
    for(const path of keys){
      if(!path.startsWith(saved.chapter+'.block-')||!base[path]||!saved.slots[path])return null;
      const fields=Object.keys(base[path]);
      if(fields.length!==Object.keys(saved.baseSlots[path]).length||fields.length!==Object.keys(saved.slots[path]).length||fields.some(key=>saved.baseSlots[path][key]!==base[path][key]||typeof saved.slots[path][key]!=='string'))return null;
    }
    return {...JSON.parse(JSON.stringify(base)),...saved.slots};
  }
  window.AIWiseCommonStudio = {chapters, names, catalog, apply, upgradeDraft,
    target: (s, index) => s.commonBlocks?.[index]?.target || s.commonBlocks?.[index]?.node};
})();
