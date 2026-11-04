/* Shared structure, separate language text. The server repeats this projection at approval. */
(() => {
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const arrays={'c2.examples':[], 'c2.sat_example':['phases']};
  const at=(slots,key)=>arrays[key].reduce((v,k)=>v?.[k],slots[key]);
  const put=(slots,key,value)=>{if(key==='c2.examples')slots[key]=value;else slots[key].phases=value;};
  const boxes=s=>s._studio?.boxes||[];
  const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
  function shape(value,key=''){
    if(typeof value==='string')return ['actor','tag'].includes(key)?value:'';
    if(Array.isArray(value))return value.map(v=>shape(v));
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,shape(v,k)]));
    return value;
  }
  function structure(slots){
    const result=Object.fromEntries(Object.entries(slots).filter(([k])=>k!=='_studio').map(([k,v])=>[k,shape(v)]));
    result.boxes=boxes(slots).map(b=>({...b,fields:b.fields.length}));
    return result;
  }
  function changed(base,next,maps){
    return canonical(structure(base))!==canonical(structure(next))||Object.entries(maps||{}).some(([,a])=>a.some((v,i)=>v!==i));
  }
  function mergeText(source,target,key=''){
    if(typeof source==='string')return ['actor','tag'].includes(key)?source:typeof target==='string'?target:'';
    if(Array.isArray(source))return source.map((v,i)=>mergeText(v,target?.[i]));
    if(source&&typeof source==='object')return Object.fromEntries(Object.entries(source).map(([k,v])=>[k,mergeText(v,target?.[k],k)]));
    return source;
  }
  function project(base,next,peer,maps){
    const result=clone(peer),formats=clone(peer._studio?.formats||[]);
    for(const [key,value] of Object.entries(next))if(key!=='_studio')result[key]=mergeText(value,peer[key]);
    for(const key of Object.keys(arrays)){
      const old=at(base,key),current=at(next,key);if(!old&&!current)continue;
      const other=at(peer,key),map=maps?.[key];
      if(!Array.isArray(old)||!Array.isArray(current)||!Array.isArray(other)||old.length!==other.length||
        !Array.isArray(map)||map.length!==current.length||map.some(i=>i!==null&&(!Number.isInteger(i)||i<0||i>=old.length)))
        throw Error('The two languages have different item structures. Review their item order before synchronizing; existing text is preserved.');
      put(result,key,current.map((v,i)=>mergeText(v,map[i]===null?undefined:other[map[i]])));
    }
    const remapped=formats.flatMap(f=>{
      if(!Object.hasOwn(arrays,f.slot))return [f];
      const offset=f.slot==='c2.examples'?0:f.path[0]==='phases'?1:-1;if(offset<0)return [f];
      return (maps[f.slot]||[]).flatMap((old,i)=>old===Number(f.path[offset])?[{...clone(f),path:f.path.map((v,j)=>j===offset?String(i):v)}]:[]);
    }).filter(f=>{let text=result[f.slot];for(const k of f.path)text=text?.[k];return text===f.runs.map(r=>r.text).join('');});
    const nextBoxes=boxes(next).map(b=>{
      const own=boxes(peer).find(p=>p.id===b.id);
      if(own&&(own.template!==b.template||own.fields.length!==b.fields.length))throw Error('A translated box has an incompatible template. Review it before synchronizing.');
      return {...clone(b),fields:own?clone(own.fields):b.fields.map(()=>[{text:''}])};
    });
    if(next._studio||peer._studio)result._studio={version:1,formats:remapped,boxes:nextBoxes};
    return result;
  }
  function initialize(s,saved){
    if(!s.layoutPeer)return;
    const original=clone(s.values);
    const maps=Object.fromEntries(Object.keys(arrays).filter(k=>Array.isArray(at(s.base,k))).map(k=>[k,at(s.base,k).map((_,i)=>i)]));
    if(saved?.layoutPlan){
      s.layoutPlan=clone(saved.layoutPlan);
      // Retain the exact counterpart reviewed when the draft was saved. The server
      // refuses stale submissions rather than replacing a translator's newer work.
    }else {
      s.layoutPlan={version:1,peer_base:clone(s.layoutPeer.slots),peer_release:s.layoutPeer.submission_id||null,maps};
      // English supplies the initial order; keep every language-specific box too.
      // Opening the editor never writes either approved copy or a browser draft.
      const own=boxes(s.values),peer=boxes(s.layoutPeer.slots),first=s.locale==='en'?own:peer;
      const order=[...first,...(s.locale==='en'?peer:own).filter(b=>!first.some(a=>a.id===b.id))];
      const merged=order.map(b=>{const text=own.find(a=>a.id===b.id);return {...clone(b),fields:text?clone(text.fields):b.fields.map(()=>[{text:''}])};});
      if(canonical(merged)!==canonical(own)){
        s.values._studio ||= {version:1,formats:[],boxes:[]};
        s.values._studio.boxes=merged;s.needsUpgrade=true;s.layoutBackupNeeded=true;
      }
    }
    try{
      project(s.base,s.values,s.layoutPlan.peer_base,s.layoutPlan.maps);
      s.layoutProblem='';
    }catch(e){s.values=original;s.layoutProblem=e.message;}
    s.layoutPeerChanged=canonical(s.layoutPeer.slots)!==canonical(s.layoutPlan.peer_base)||(s.layoutPeer.submission_id||null)!==s.layoutPlan.peer_release;
  }
  function remap(s,key,before,after,duplicate=-1,original=-1){
    if(!s.layoutPlan)return;
    const previous=s.layoutPlan.maps[key];
    s.layoutPlan.maps[key]=after.map((v,i)=>i===duplicate?previous[original]:before.includes(v)?previous[before.indexOf(v)]:null);
  }
  function recoveredPlan(s,saved,values){
    if(!saved?.layoutPlan)return null;
    const recovered=clone(saved),oldBase={...saved.baseSlots,...(saved.baseExamples?{'c2.examples':saved.baseExamples}:{})};
    for(const key of Object.keys(arrays)){
      const latest=at(s.base,key);if(!Array.isArray(latest))continue;
      if(canonical(at(oldBase,key))===canonical(latest))continue;
      if(canonical(at(values,key))!==canonical(latest))throw Error('The example or S.A.T item order changed. Keep the latest item list in this review, then reapply text from the original backup.');
      recovered.layoutPlan.maps[key]=latest.map((_,i)=>i);
    }
    return recovered;
  }
  function payload(s){
    if(!s.layoutEnabled||!s.layoutPlan)return null;
    if(s.layoutProblem)throw Error(s.layoutProblem);
    if(!changed(s.base,s.values,s.layoutPlan.maps))return null;
    project(s.base,s.values,s.layoutPlan.peer_base,s.layoutPlan.maps);
    return clone(s.layoutPlan);
  }
  function reviewControl(s){
    if(!s.layoutEnabled||!s.layoutPlan)return;
    const status=document.createElement('p');status.className='cs-language-status';
    status.textContent=s.layoutPeerChanged?'The other language changed since this draft. Review its latest copy before synchronizing.':s.layoutReviewRequired?'The shared layout changed. New fields may need text in this language.':'Layout changes are reviewed for both languages; wording remains separate.';
    s.host.querySelector('.cs-toolbar').after(status);
    if(!s.layoutPeerChanged)return;
    const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Review updated other-language copy';status.append(' ',button);
    button.onclick=()=>{
      let projected;try{projected=project(s.base,s.values,s.layoutPeer.slots,s.layoutPlan.maps);}catch(e){s.blockEditing.message(e.message);return;}
      const dialog=document.createElement('dialog');dialog.className='aw-account-dialog dr-dialog';
      const heading=document.createElement('h2');heading.textContent='Check the other language before applying this layout';
      const note=document.createElement('p');note.textContent='Review the current item order and the proposed result. Existing wording is kept; removed items remain in approval history. Your original local draft is backed up on save.';
      const pair=document.createElement('div');pair.className='dr-pair';
      for(const [label,value] of [['Current other-language copy',s.layoutPeer.slots],['After your layout changes',projected]]){
        const section=document.createElement('section'),h=document.createElement('h3');h.textContent=label;section.append(h);
        window.AIWiseDraftRecovery.valueView(section,{value});pair.append(section);
      }
      const cancel=document.createElement('button');cancel.type='button';cancel.className='button';cancel.textContent='Keep original draft';cancel.onclick=()=>dialog.close();
      const use=document.createElement('button');use.type='button';use.className='button primary';use.textContent='Use reviewed item order';
      use.onclick=()=>{s.layoutPlan.peer_base=clone(s.layoutPeer.slots);s.layoutPlan.peer_release=s.layoutPeer.submission_id||null;s.layoutPeerChanged=false;s.layoutBackupNeeded=true;s.needsUpgrade=true;s.blockEditing.controls();status.textContent='Other-language copy reviewed. Save this draft before submitting.';dialog.close();};
      dialog.append(heading,note,pair,cancel,use);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
    };
  }
  window.AIWiseLayoutSync={project,changed,initialize,remap,recoveredPlan,payload,clone,reviewControl};
})();
