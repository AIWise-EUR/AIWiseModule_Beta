/* Stable, content-checked anchors. Feedback never rewrites module text. */
(() => {
  'use strict';
  const selector = 'h1,h2,h3,h4,p,li,figure,table,blockquote,pre,[data-slot],.card,.sl-card,.fn-card,.technique-pane,.critique-slide,img,svg,iframe,video,canvas';
  const excluded = 'header,nav,footer,button,input,select,textarea,[aria-hidden="true"],.side-nav,.fb-widget,[data-beta-overlay],script,style';
  const text = node => node.textContent.replace(/\s+/g, ' ').trim() || [node.tagName,node.getAttribute('src'),node.getAttribute('alt'),node.getAttribute('title'),node.getAttribute('aria-label')].filter(Boolean).join(' · ');
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  function path(node) {
    const parts=[];
    for(let n=node;n && n.tagName!=='BODY';n=n.parentElement) {
      const tag=n.tagName.toLowerCase();
      const index=[...n.parentElement.children].filter(c=>c.tagName===n.tagName).indexOf(n)+1;
      parts.unshift(`${tag}:nth-of-type(${index})`);
    }
    return 'body>'+parts.join('>');
  }
  function find(doc, anchor) {
    if(!/^body(>[a-z][a-z0-9-]*:nth-of-type\([1-9][0-9]*\)){1,30}$/.test(anchor.path)) return null;
    return doc.querySelector(anchor.path);
  }
  function targets(doc) { return [...doc.querySelectorAll(selector)].filter(n=>(!doc.querySelector('main')||n.closest('main')) && !n.closest(excluded) && text(n)); }
  function target(node) { const n=node?.nodeType===3?node.parentElement:node;return n?.closest(selector); }
  async function make(node, kind, extra={}) {
    return {kind,path:path(node),fingerprint:await digest(text(node)),excerpt:text(node).slice(0,280),...extra};
  }
  // Offsets refer to original text nodes, including whitespace. No authored HTML is inserted.
  function selection(doc) {
    const sel=doc.getSelection();
    if(!sel || sel.isCollapsed || !sel.rangeCount) throw Error('Select a passage in the preview.');
    const range=sel.getRangeAt(0), node=target(range.commonAncestorContainer);
    if(!node || node.closest(excluded) || !node.contains(range.startContainer) || !node.contains(range.endContainer)) throw Error('Select text inside one content box.');
    const prefix=doc.createRange();prefix.selectNodeContents(node);prefix.setEnd(range.startContainer,range.startOffset);
    const quote=range.toString();
    if(!quote.trim() || quote.length>4000) throw Error('Select between 1 and 4,000 characters.');
    return {node,extra:{start:prefix.toString().length,end:prefix.toString().length+quote.length,quote}};
  }
  function range(node, anchor) {
    if(node.textContent.slice(anchor.start,anchor.end)!==anchor.quote) return null;
    const doc=node.ownerDocument, walker=doc.createTreeWalker(node,4), result=doc.createRange();
    let offset=0, start=false, end=false;
    while(walker.nextNode()) {
      const n=walker.currentNode, next=offset+n.nodeValue.length;
      if(!start && anchor.start>=offset && anchor.start<next) {result.setStart(n,anchor.start-offset);start=true;}
      if(start && anchor.end>offset && anchor.end<=next) {result.setEnd(n,anchor.end-offset);end=true;break;}
      offset=next;
    }
    return start&&end?result:null;
  }
  async function locate(doc, anchor) {
    const node=find(doc,anchor);
    if(!node || await digest(text(node))!==anchor.fingerprint) return null;
    if(anchor.kind==='highlight' && !range(node,anchor)) return null;
    return node;
  }
  const point=(node,x,y)=>{const r=node.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(x-r.left)/r.width)),y:Math.max(0,Math.min(1,(y-r.top)/r.height))};};
  function box(a,b) {return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};}
  window.AIWiseBetaAnchors=Object.freeze({targets,target,make,selection,range,locate,point,box,path});
})();
