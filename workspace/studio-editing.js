/* Existing Studio shell, menus, preview and authenticated submission remain the entry points. */
(() => {
  'use strict';
  const M=()=>window.AIWiseStudioBlocks, clone=v=>JSON.parse(JSON.stringify(v));
  const valueAt=(s,slot,path)=>path.reduce((v,k)=>v?.[k],s.values[slot]);
  function ext(s){return s.values._studio ||= {version:1,formats:[],boxes:[]};}
  function historyCopy(s){const copy=clone(s.values);if(s.layoutPlan){s.layoutHistory ||= new WeakMap();s.layoutHistory.set(copy,clone(s.layoutPlan.maps));}return copy;}
  function remember(s){if(!s.blockEditing)return;s.undo.push(historyCopy(s));if(s.undo.length>60)s.undo.shift();s.redo=[];}
  function changed(s){if(s.layoutEnabled&&s.layoutPlan&&window.AIWiseLayoutSync.changed(s.base,s.values,s.layoutPlan.maps))s.needsUpgrade=true;s.blockEditing.update();s.blockEditing.controls();s.blockEditing.message('Unsaved edits · Preview only.');}
  function mutate(s,fn,reopen=false){if(s.layoutEnabled&&s.layoutProblem){s.blockEditing.message(s.layoutProblem);return;}remember(s);fn();changed(s);if(reopen)s.blockEditing.open();}
  function formatRecord(s,slot,path){return s.values._studio?.formats.find(f=>f.slot===slot&&JSON.stringify(f.path)===JSON.stringify(path));}
  function textChanged(s,slot,path,text){const f=formatRecord(s,slot,path);if(f)editRuns(f,text);}
  function editRuns(f,text){
    const old=M().plain(f.runs);let a=0,b=0;while(a<old.length&&a<text.length&&old[a]===text[a])a++;
    while(b<old.length-a&&b<text.length-a&&old[old.length-b-1]===text[text.length-b-1])b++;
    function slice(start,end){let i=0;return f.runs.flatMap(r=>{const left=Math.max(0,start-i),right=Math.min(r.text.length,end-i);i+=r.text.length;return left<right?[{...r,text:r.text.slice(left,right)}]:[];});}
    const before=slice(0,a),after=slice(old.length-b,old.length),insert=text.slice(a,text.length-b);
    f.runs=[...before,...(insert?[{...(before.at(-1)||{}),text:insert}]:[]),...after];if(!f.runs.length)f.runs=M().rich('');
  }
  function button(text,action){const b=document.createElement('button');b.type='button';b.className='button';b.textContent=text;b.onclick=action;return b;}
  function menu(title,values,onpick){
    const d=document.createElement('details');d.className='cs-format-menu';const t=document.createElement('summary');t.textContent=title;d.append(t);
    const list=document.createElement('div');list.className='cs-format-options';
    values.forEach(([label,value])=>list.append(button(label,()=>{onpick(value);d.open=false;})));d.append(list);return d;
  }
  function toolbar(s,wrap,input,read,write){
    const bar=document.createElement('div');bar.className='cs-formatbar';bar.setAttribute('role','group');bar.setAttribute('aria-label','Text formatting');
    let selection=null;const capture=()=>{selection=[input.selectionStart,input.selectionEnd];};input.addEventListener('select',capture);input.addEventListener('keyup',capture);input.addEventListener('mouseup',capture);
    const apply=(mark,val)=>{const [a,b]=selection||[input.selectionStart,input.selectionEnd];if(a===b){s.blockEditing.message('Select the words to format first.');return;}
      remember(s);const runs=read();const selected=[];let offset=0;runs.forEach(r=>{if(offset<b&&offset+r.text.length>a)selected.push(r);offset+=r.text.length;});
      write(M().format(runs,a,b,mark,val===undefined?!selected.every(r=>r[mark]):val));changed(s);input.focus();input.setSelectionRange(a,b);
    };
    bar.append(button('Bold',()=>apply('bold')),button('Italic',()=>apply('italic')),
      menu('Color',[['Default',null],['Ink','#173e43'],['Teal','#2b646a'],['Green','#2c7354'],['Amber','#9a621a'],['Red','#a43b36']],v=>apply('color',v||false)),
      menu('Text size',M().sizes.map(v=>[v+' px',v]),v=>apply('size',v)),button('Clear format',()=>apply('clear')));
    bar.querySelectorAll('button').forEach(b=>b.addEventListener('mousedown',e=>e.preventDefault()));
    input.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();capture();apply(e.key.toLowerCase()==='b'?'bold':'italic');}});
    const preview=document.createElement('div');preview.className='cs-formatted-copy';preview.setAttribute('aria-label','Formatted text preview');
    function draw(){preview.replaceChildren(M().renderRuns(document,read()));}draw();
    bar.addEventListener('click',draw);input.addEventListener('input',draw);wrap.append(bar,preview);
  }
  function field(s,wrap,input,slot,path){
    if(!s.blocksEnabled||(s.locale!=='en'&&!s.layoutEnabled))return;
    // Attributes and diagram labels stay plain; their DOM does not accept inline spans.
    if(s.isCommon){const block=s.commonBlocks?.find(b=>b.path===slot),i=block&&Object.keys(block.fields).indexOf(path[0]);if(i===undefined||i<0||block.nodes[i].nodeType!==3||block.nodes[i].parentElement.closest('svg,title'))return;}
    toolbar(s,wrap,input,()=>formatRecord(s,slot,path)?.runs||M().rich(input.value),runs=>{
      const records=ext(s).formats,f=formatRecord(s,slot,path);if(f)f.runs=runs;else records.push({slot,path,runs});
    });
  }
  function exampleReminders(s,index){
    const boxes=(s.values._studio?.boxes||[]).filter(M().exampleBox),own=new Set(boxes.filter(b=>M().exampleIndex(b)===index).map(M().boxFamily)),seen=new Set();
    return boxes.filter(b=>{const family=M().boxFamily(b);if(own.has(family)||seen.has(family))return false;seen.add(family);return true;});
  }
  function addExampleBox(s,source,index){
    if(s.blocked||s.abort?.signal.aborted||!s.exampleBoxesEnabled||(s.locale!=='en'&&!s.layoutEnabled)||ext(s).boxes.length>=50||!s.values['c2.examples']?.[index]||!exampleReminders(s,index).includes(source))return;
    mutate(s,()=>{ext(s).boxes.push({...clone(source),id:'box-'+crypto.randomUUID(),example:index,family:M().boxFamily(source),anchor:0});},true);
  }
  function reminder(s,source,index,doc=document){
    const node=doc.createElement('div');node.className='cs-example-reminder';node.dataset.studioReminder=source.id;
    node.style.cssText='padding:24px;margin:16px 0;border:1px dashed #aebdbc;border-radius:16px;background:#fafbfb;color:#667471';
    const title=doc.createElement('h4');title.textContent=M().plain(source.fields[0])||'Untitled box';title.style.cssText='margin:0 0 10px;font-weight:600;color:#687572';
    const origin=doc.createElement('p');origin.textContent='Added in Example '+(M().exampleIndex(source)+1);origin.style.cssText='font-size:12px;margin:0 0 8px';
    const hint=doc.createElement('p');hint.textContent='No box has been added to this version yet.';hint.style.cssText='margin:0 0 12px';
    const add=doc.createElement('button');add.type='button';add.textContent='Add this box to this version';add.className='button';add.style.cssText='padding:10px 14px;border:1px solid #2b5d63;border-radius:8px;background:#fff;color:#173e43;font:inherit;cursor:pointer';
    add.disabled=!!s.blocked||!s.exampleBoxesEnabled||(s.locale!=='en'&&!s.layoutEnabled)||(s.values._studio?.boxes.length||0)>=50;
    add.onclick=e=>{e.stopPropagation();addExampleBox(s,source,index);};
    const note=doc.createElement('small');note.textContent='Editor only';note.style.cssText='display:block;margin-top:10px';
    node.append(title,origin,hint,add,note);return node;
  }
  function examplePreview(s){
    if(s.isCommon||s.chapter!=='c2')return;
    const doc=s.frame.contentDocument;doc.querySelectorAll('[data-studio-reminder]').forEach(n=>n.remove());
    doc.querySelectorAll('.carousel-card').forEach((card,index)=>{for(const source of exampleReminders(s,index))card.append(reminder(s,source,index,doc));});
  }
  function panel(s,container,item){
    if(s.isCommon&&s.locale==='nl'&&!s.layoutEnabled){translationPanel(s,container,item);return;}
    if(!s.blocksEnabled||(s.locale!=='en'&&!s.layoutEnabled))return;
    const section=document.createElement('section');section.className='cs-block-actions';
    const heading=document.createElement('h3');heading.textContent='Boxes & layout';section.append(heading);
    const actions=document.createElement('div');actions.className='cs-formatbar';section.append(actions);
    {
      const block=s.isCommon?s.commonBlocks?.find(b=>b.path===item.path):{path:item.path,node:s.frame.contentDocument.querySelector('[data-slot=\"'+item.path+'\"]')};
      if(block&&!block.node.closest('header,footer,nav,svg')&&block.node.closest('main')){
        const choices=[];
        for(const type of (s.isCommon?M().templates.filter(t=>t!=='text'):[]))M().candidates(block.node,type).forEach((node,i)=>choices.push([`${node.querySelector('[class$="-title"]')?.textContent.trim()||type} · ${i+1}`,{type,i,node}]));
        const add=(type,i,node,duplicate)=>mutate(s,()=>{
          if(ext(s).boxes.length>=50)return;
          let fields=type==='text'?[M().rich('New text box'),M().rich('')]:(()=>{const copy=node.cloneNode(true);copy.querySelectorAll('[data-studio-rich]').forEach(n=>n.replaceWith(copy.ownerDocument.createTextNode(n.textContent)));return M().nodes(copy).map(n=>M().rich(duplicate?n.nodeValue:''));})();
          if(type!=='text'&&!duplicate){fields[0]=M().rich('New box');}
          const id='box-'+crypto.randomUUID(),placement=item.example===undefined?{}:{example:item.example,family:id};
          if(item.example!==undefined&&!s.exampleBoxesEnabled)return;
          ext(s).boxes.push({id,slot:item.path,template:type,anchor:i,fields,align:'left',size:0,...placement});
        },true);
        if(choices.length){actions.append(menu('Add same box after…',choices,c=>add(c.type,c.i,c.node,false)),menu('Duplicate box…',choices,c=>add(c.type,c.i,c.node,true)));}
        const addText=button('Add text box',()=>add('text',0,block.node,false));addText.disabled=item.example!==undefined&&!s.exampleBoxesEnabled;actions.append(addText);
      }
      if(item.example!==undefined&&!s.exampleBoxesEnabled){const note=document.createElement('p');note.textContent='Example-specific box controls become available after the workspace update.';section.append(note);}
      for(const box of s.values._studio?.boxes.filter(b=>b.slot===item.path&&(item.example===undefined||M().exampleIndex(b)===item.example))||[]){
        const card=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Added box · '+(M().plain(box.fields[0]).trim()||'Untitled');card.append(legend);
        box.fields.forEach((runs,i)=>{const wrap=document.createElement('label');wrap.textContent=i===0?'Title':'Text '+i;const input=document.createElement('textarea');input.setAttribute('aria-label',i===0?'Title':'Text '+i);input.rows=i===0?2:5;input.value=M().plain(runs);
          input.oninput=()=>{remember(s);const f={runs:box.fields[i]};editRuns(f,input.value);box.fields[i]=f.runs;changed(s);};wrap.append(input);toolbar(s,wrap,input,()=>box.fields[i],runs=>box.fields[i]=runs);card.append(wrap);});
        const group=document.createElement('div');group.className='cs-formatbar';
        const duplicateBox=button('Duplicate',()=>mutate(s,()=>{if(ext(s).boxes.length<50){const a=ext(s).boxes,id='box-'+crypto.randomUUID();a.splice(a.indexOf(box)+1,0,{...clone(box),id,...(M().exampleBox(box)?{example:M().exampleIndex(box),family:id}:{})});}},true));duplicateBox.disabled=item.example!==undefined&&!s.exampleBoxesEnabled;
        group.append(duplicateBox,
          button('Move up',()=>move(s,box,-1)),button('Move down',()=>move(s,box,1)),button('Remove box',()=>mutate(s,()=>{ext(s).boxes=ext(s).boxes.filter(b=>b.id!==box.id);},true)),
          menu('Alignment',[['Left','left'],['Center','center'],['Right','right']],v=>mutate(s,()=>{box.align=v;})),menu('Box text size',[['Original size',0],...M().sizes.map(v=>[v+' px',v])],v=>mutate(s,()=>{box.size=v;})));
        card.append(group);section.append(card);
      }
    }
    if(!s.isCommon&&item.example!==undefined){
      const examples=s.values['c2.examples'];
      const change=op=>mutate(s,()=>{
        const a=s.values['c2.examples'],i=item.example,old=a.slice(),formats=s.values._studio?.formats||[];let duplicate=-1;
        const boxes=s.values._studio?.boxes||[],scoped=boxes.filter(M().exampleBox);
        if(scoped.length&&!s.exampleBoxesEnabled)return;
        if(op==='duplicate'&&boxes.length+scoped.filter(b=>M().exampleIndex(b)===i).length>50)return;
        if(op==='add'&&a.length<50)a.splice(i+1,0,{title:'New example',thinking:'',typing:'',processing:''});
        if(op==='duplicate'&&a.length<50){a.splice(i+1,0,clone(a[i]));duplicate=i+1;}
        if(op==='up'&&i>0)[a[i-1],a[i]]=[a[i],a[i-1]];
        if(op==='down'&&i<a.length-1)[a[i+1],a[i]]=[a[i],a[i+1]];
        if(op==='remove'&&a.length>1)a.splice(i,1);
        window.AIWiseLayoutSync?.remap(s,'c2.examples',old,a,duplicate,i);
        if(s.values._studio)s.values._studio.formats=formats.flatMap(f=>{
          if(f.slot!=='c2.examples')return [f];const previous=Number(f.path[0]),next=a.indexOf(old[previous]),result=[];
          if(next>=0)result.push({...f,path:[String(next),...f.path.slice(1)]});
          if(duplicate>=0&&previous===i)result.push({...clone(f),path:[String(duplicate),...f.path.slice(1)]});return result;
        });
        if(s.values._studio)s.values._studio.boxes=boxes.flatMap(b=>{
          if(!M().exampleBox(b))return [b];const previous=M().exampleIndex(b),next=a.indexOf(old[previous]),family=M().boxFamily(b),result=[];
          if(next>=0)result.push({...b,example:next,family});
          if(duplicate>=0&&previous===i)result.push({...clone(b),id:'box-'+crypto.randomUUID(),example:duplicate,family});return result;
        });
      },true);
      for(const [label,op] of [['Add same card','add'],['Duplicate card','duplicate'],['Move up','up'],['Move down','down'],['Remove card','remove']]){const control=button(label,()=>change(op));control.disabled=!!s.values._studio?.boxes.some(M().exampleBox)&&!s.exampleBoxesEnabled||op==='duplicate'&&(s.values._studio?.boxes.length||0)+(s.values._studio?.boxes.filter(b=>M().exampleBox(b)&&M().exampleIndex(b)===item.example).length||0)>50;actions.append(control);}
      for(const source of exampleReminders(s,item.example))section.append(reminder(s,source,item.example));

    }
    actions.append(button('Undo',()=>travel(s,'undo','redo')),button('Redo',()=>travel(s,'redo','undo')));container.append(section);
  }
  function translationPanel(s,container,item){
    if(!s.translationSync)return;
    const section=document.createElement('section');section.className='cs-block-actions';
    const note=document.createElement('p');note.textContent='Box positions and order follow approved English. Edit the Dutch text here.';section.append(note);
    for(const box of s.values._studio?.boxes.filter(box=>box.slot===item.path)||[]){
      const card=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Shared box · '+(M().plain(box.fields[0]).trim()||'Untitled');card.append(legend);
      const en=s.englishApproved._studio.boxes.find(en=>en.id===box.id);
      box.fields.forEach((runs,index)=>{const wrap=document.createElement('div'),label=document.createElement('label'),input=document.createElement('textarea');
        label.textContent=index===0?'Title':'Text '+index;input.setAttribute('aria-label',label.textContent);input.rows=index===0?2:5;input.value=M().plain(runs);
        input.oninput=()=>{const f={runs:box.fields[index]};editRuns(f,input.value);box.fields[index]=f.runs;changed(s);};label.append(input);wrap.append(label);
        window.AIWiseCommonStudio.translationField(s,wrap,JSON.stringify(['box',box.id,index]),M().plain(en.fields[index]));card.append(wrap);
      });section.append(card);
    }
    container.append(section);
  }
  function satPanel(s,container,item,field){
    const sat=s.values[item.path], enabled=s.blocksEnabled&&s.satPhasesEnabled&&!s.blocked;
    const note=document.createElement('p');note.className='cs-language-status';
    note.textContent=enabled?'Each box is one Self–AI or Self–Team cycle. Empty boxes are hidden in the module. Delete can be undone before saving.':'Edit the text in each box below. Add and Delete become available after the S.A.T backend update.';
    container.append(note);
    const change=(index,kind)=>{
      if(!s.blocksEnabled||!s.satPhasesEnabled||s.blocked)return;
      if(kind!=='delete'&&sat.phases.length>=50)return;
      mutate(s,()=>{
        const before=sat.phases.slice();
        if(kind==='delete'){sat.phases.splice(index,1);s.satEditingIndex=undefined;}
        else {
          const team=kind==='team', names=team?['Present','Feedback','Integrate','Expand']:['Intent','Operationalize','Judge','Refine'];
          s.satEditingIndex=index;
          sat.phases.splice(index,0,{label:team?'Self–Team':'Self–AI',steps:names.map((name,i)=>({actor:i%2?(team?'team':'ai'):'self',name,text:''}))});
        }
        window.AIWiseLayoutSync?.remap(s,'c2.sat_example',before,sat.phases);
        // Formatting follows the surviving box, not its previous numeric position.
        if(s.values._studio)s.values._studio.formats=s.values._studio.formats.flatMap(f=>{
          if(f.slot!==item.path||f.path[0]!=='phases')return [f];
          const next=sat.phases.indexOf(before[Number(f.path[1])]);
          return next<0?[]:[{...f,path:['phases',String(next),...f.path.slice(2)]}];
        });
      },true);
    };
    function addControls(index){
      const bar=document.createElement('div');bar.className='cs-formatbar';
      for(const [name,kind] of [['Add Self–AI box','ai'],['Add Self–Team box','team']]){
        const b=button(name,()=>change(index,kind));b.disabled=!enabled||sat.phases.length>=50;bar.append(b);
      }
      return bar;
    }
    container.append(addControls(sat.phases.length));
    sat.phases.forEach((phase,i)=>{
      const card=document.createElement('fieldset');card.className='cs-sat-box';
      const legend=document.createElement('legend');legend.textContent=`Box ${i+1} · ${phase.label}`;card.append(legend);
      const status=document.createElement('p');status.className='cs-language-status';
      status.textContent=phase.steps.some(step=>step.text.trim())?'Shown in the module':'Empty · hidden in the module';card.append(status);
      const detail=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Edit this box';detail.append(summary);detail.className='cs-sat-fields';detail.open=s.satEditingIndex===i;
      detail.addEventListener('toggle',()=>{if(detail.open)s.satEditingIndex=i;});
      detail.append(field(phase.label,['phases',String(i),'label'],'label'));
      phase.steps.forEach((step,j)=>detail.append(field(step,['phases',String(i),'steps',String(j)],`Step ${j+1} · ${step.name}`)));card.append(detail);
      const actions=addControls(i+1),remove=button('Delete box',()=>change(i,'delete'));remove.disabled=!enabled;
      remove.setAttribute('aria-label',`Delete box ${i+1} · ${phase.label}`);actions.append(remove);card.append(actions);container.append(card);
      // Keep the visibility explanation in sync while typing, without reopening the panel.
      card.addEventListener('input',()=>{status.textContent=phase.steps.some(step=>step.text.trim())?'Shown in the module':'Empty · hidden in the module';});
    });
    container.append(field(sat.note,['note'],'Note'));
  }
  function move(s,box,delta){mutate(s,()=>{const all=ext(s).boxes,group=all.filter(b=>b.slot===box.slot&&b.template===box.template&&b.anchor===box.anchor&&(!M().exampleBox(box)||M().exampleIndex(b)===M().exampleIndex(box))),i=group.indexOf(box),other=group[i+delta];if(other){const a=all.indexOf(box),b=all.indexOf(other);[all[a],all[b]]=[all[b],all[a]];}},true);}
  function travel(s,from,to){if(!s[from].length)return;s[to].push(historyCopy(s));s.values=s[from].pop();if(s.layoutPlan&&s.layoutHistory?.has(s.values))s.layoutPlan.maps=clone(s.layoutHistory.get(s.values));changed(s);s.blockEditing.open();}
  function mount(s,api){
    s.blockEditing=api;s.undo=[];s.redo=[];
    // A staged front end must never offer submissions the installed backend cannot accept.
    window.AIWiseBackend.getClient().then(client=>client.rpc('workspace_studio_capabilities')).then(({data,error})=>{
      if(s.abort.signal.aborted)return;s.blocksEnabled=!error&&data?.blocks===1;s.satPhasesEnabled=!error&&data?.sat_phases===1;s.exampleBoxesEnabled=!error&&data?.example_boxes===1;s.layoutEnabled=!error&&data?.bidirectional_layout===1;
      const note=document.createElement('p');note.className='cs-language-status';note.textContent=s.layoutEnabled?(s.layoutProblem||'Shared layout · Changes to boxes and item order apply to both languages after review. Each language keeps its own text.') :s.locale==='nl'&&s.isCommon?'Dutch translation · Layout follows approved English; existing translations are preserved.':s.blocksEnabled?'English editing · Add boxes, duplicate cards and format selected words.':'Text editing is available. Box and formatting tools will appear after the Studio backend update.';
      s.host.querySelector('.cs-toolbar').after(note);
      window.AIWiseLayoutSync?.reviewControl(s);
      examplePreview(s);
    }).catch(()=>{});
  }
  window.AIWiseStudioEditing={mount,field,panel,satPanel,remember,textChanged,examplePreview,exampleReminders,addExampleBox};
})();
