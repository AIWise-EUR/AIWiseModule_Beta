/* Names are inserted as plain text; selected teammate IDs accompany the comment. */
(() => {
 'use strict';
 let serial=0;
 function attach(textarea){
  const selected=new Map(),list=document.createElement('div');let people=null,epoch=0,index=0,matches=[],start=-1,end=-1;
  list.className='br-mentions';list.id='beta-mentions-'+(++serial);list.hidden=true;list.setAttribute('role','listbox');list.setAttribute('aria-label','Mention a teammate');
  (textarea.closest('label')||textarea).after(list);textarea.setAttribute('aria-controls',list.id);textarea.setAttribute('aria-autocomplete','list');textarea.setAttribute('aria-expanded','false');
  const hint=document.createElement('small');hint.className='br-mention-hint';hint.id=list.id+'-hint';textarea.setAttribute('aria-describedby',hint.id);hint.textContent='Type @ to mention a teammate.';list.after(hint);
  function close(){epoch++;list.hidden=true;textarea.setAttribute('aria-expanded','false');textarea.removeAttribute('aria-activedescendant');}
  function highlight(){list.querySelectorAll('[role=option]').forEach((n,i)=>n.setAttribute('aria-selected',String(i===index)));textarea.setAttribute('aria-activedescendant',list.id+'-'+index);}
  function choose(person){
   const label='@'+person.name;textarea.setRangeText(label+' ',start,end,'end');selected.set(person.id,label);close();textarea.focus();textarea.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function update(){
   const value=textarea.value.slice(0,textarea.selectionStart),match=value.match(/(?:^|\s)@([^@\n]{0,60})$/);
   if(!match){close();return;}start=value.lastIndexOf('@');end=textarea.selectionStart;
   const token=++epoch;
   try{if(!people)people=await window.AIWiseBetaFeedback.people();if(token!==epoch||!textarea.isConnected)return;
    matches=people.filter(p=>p.name.toLocaleLowerCase().includes(match[1].toLocaleLowerCase())).slice(0,8);index=0;list.replaceChildren();
    if(!matches.length){close();return;}
    matches.forEach((person,i)=>{const button=document.createElement('button');button.type='button';button.id=list.id+'-'+i;button.setAttribute('role','option');button.tabIndex=-1;button.textContent=person.name;button.onmousedown=e=>e.preventDefault();button.onclick=()=>choose(person);list.append(button);});
    list.hidden=false;textarea.setAttribute('aria-expanded','true');highlight();hint.textContent='↑ ↓ to choose · Enter to mention · Esc to dismiss';
   }catch{if(token===epoch){close();hint.textContent='Teammate suggestions are unavailable. Try typing @ again.';}}
  }
  textarea.addEventListener('input',update);textarea.addEventListener('keydown',e=>{
   if(list.hidden)return;
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
   else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();index=(index+(e.key==='ArrowDown'?1:matches.length-1))%matches.length;highlight();}
   else if(e.key==='Enter'){e.preventDefault();choose(matches[index]);}
  });textarea.addEventListener('blur',()=>setTimeout(()=>{if(!list.contains(document.activeElement))close();},100));
  return {ids:()=>[...selected].filter(([,label])=>textarea.value.includes(label)).map(([id])=>id),reset:()=>{selected.clear();close();}};
 }
 window.AIWiseBetaMentions=Object.freeze({attach});
})();
