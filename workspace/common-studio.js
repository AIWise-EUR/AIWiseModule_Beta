/* Shared module text adapter for the same editor used by Content Studio.
   Source markup and course slots are never rewritten by author-entered text. */
(() => {
  'use strict';
  const {chapters, names, catalog} = window.AIWiseCommonContent;
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
      Object.keys(block.fields).forEach((key, i) => { block.nodes[i].nodeValue = s.values[block.path][key]; });
    });
  }
  window.AIWiseCommonStudio = {chapters, names, catalog, apply,
    target: (s, index) => s.commonBlocks?.[index]?.node};
})();
