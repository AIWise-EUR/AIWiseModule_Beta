/* Section navigation is separate from individual content/review addresses. */
(() => {
 'use strict';
 const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
 function title(node){const own=node.matches('h1,h2,h3,h4')?node:null,heading=own||node.querySelector('h2,h3,h4,.carousel-card-header,.sat-example-tag,.technique-pane-title');return clean(heading?.textContent||node.getAttribute('aria-label')||node.getAttribute('alt')||node.textContent).slice(0,80);}
 function sections(doc){const nodes=[...doc.querySelectorAll('main section[id],section.hero,section.section')].filter((n,i,a)=>a.indexOf(n)===i&&!n.closest('[hidden]'));const rows=nodes.map((node,i)=>({id:String(i),node,title:clean(node.querySelector('h2,h3')?.textContent)||'Introduction'}));
  if(!rows.length){const main=doc.querySelector('main')||doc.body;rows.push({id:'0',node:main,title:'Page content'});}return rows;
 }
 function group(node,rows){return [...rows].reverse().find(r=>r.node===node||r.node.contains(node));}
 function destination(href,base,{course,locale,version,root}){const next=new URL(href,base),site=new URL(root);if(next.origin!==site.origin||!next.pathname.startsWith(site.pathname))return null;const path=next.pathname.slice(site.pathname.length);if(!/^(common\/[a-z0-9-]+\.html|course-specific\/[a-z0-9_-]+\/[a-zA-Z0-9_.()-]+\.html)$/.test(path))return null;if(course&&!next.searchParams.has('course'))next.searchParams.set('course',course);if(locale==='nl')next.searchParams.set('lang','nl');else next.searchParams.delete('lang');if(version)next.searchParams.set('review_version',version);return next;}
 function reveal(node){
  const doc=node.ownerDocument,slide=node.closest('.carousel-slide');if(slide){const slides=[...slide.parentElement.querySelectorAll('.carousel-slide')],index=slides.indexOf(slide);doc.querySelectorAll('#carouselDots button')[index]?.click();}
  const pane=node.closest('.technique-pane');if(pane)pane.closest('.technique-panel')?.querySelector('[data-tab="'+pane.dataset.pane+'"]')?.click();
  const step=node.closest('.critique-slide');if(step)step.closest('.critique-stepper')?.querySelector('[data-step="'+step.dataset.slide+'"]')?.click();
  for(let n=node;n;n=n.parentElement)if(n.tagName==='DETAILS')n.open=true;
 }
 window.AIWisePreviewSections=Object.freeze({title,sections,group,destination,reveal});
})();
