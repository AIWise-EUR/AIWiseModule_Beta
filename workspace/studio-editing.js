/* Existing Studio shell, menus, preview and authenticated submission remain the entry points. */
(() => {
  'use strict';
  const M=()=>window.AIWiseStudioBlocks, clone=v=>JSON.parse(JSON.stringify(v));
  const valueAt=(s,slot,path)=>path.reduce((v,k)=>v?.[k],s.values[slot]);
  function ext(s){return s.values._studio ||= {version:1,formats:[],boxes:[]};}
  function remember(s){if(!s.blockEditing)return;s.undo.push(clone(s.values));if(s.undo.length>60)s.undo.shift();s.redo=[];}
  function changed(s){s.blockEditing.update();s.blockEditing.controls();s.blockEditing.message('Unsaved edits · Preview only.');}
  function mutate(s,fn,reopen=false){remember(s);fn();changed(s);if(reopen)s.blockEditing.open();}
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
    if(!s.blocksEnabled||s.locale!=='en')return;
    // Attributes and diagram labels stay plain; their DOM does not accept inline spans.
    if(s.isCommon){const block=s.commonBlocks?.find(b=>b.path===slot),i=block&&Object.keys(block.fields).indexOf(path[0]);if(i===undefined||i<0||block.nodes[i].nodeType!==3||block.nodes[i].parentElement.closest('svg,title'))return;}
    toolbar(s,wrap,input,()=>formatRecord(s,slot,path)?.runs||M().rich(input.value),runs=>{
      const records=ext(s).formats,f=formatRecord(s,slot,path);if(f)f.runs=runs;else records.push({slot,path,runs});
    });
  }
  function panel(s,container,item){
    if(!s.blocksEnabled||s.locale!=='en')return;
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
          ext(s).boxes.push({id:'box-'+crypto.randomUUID(),slot:item.path,template:type,anchor:i,fields,align:'left',size:0});
        },true);
        if(choices.length){actions.append(menu('Add same box after…',choices,c=>add(c.type,c.i,c.node,false)),menu('Duplicate box…',choices,c=>add(c.type,c.i,c.node,true)));}
        actions.append(button('Add text box',()=>add('text',0,block.node,false)));
      }
      for(const box of s.values._studio?.boxes.filter(b=>b.slot===item.path)||[]){
        const card=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Added box · '+(M().plain(box.fields[0]).trim()||'Untitled');card.append(legend);
        box.fields.forEach((runs,i)=>{const wrap=document.createElement('label');wrap.textContent=i===0?'Title':'Text '+i;const input=document.createElement('textarea');input.setAttribute('aria-label',i===0?'Title':'Text '+i);input.rows=i===0?2:5;input.value=M().plain(runs);
          input.oninput=()=>{remember(s);const f={runs:box.fields[i]};editRuns(f,input.value);box.fields[i]=f.runs;changed(s);};wrap.append(input);toolbar(s,wrap,input,()=>box.fields[i],runs=>box.fields[i]=runs);card.append(wrap);});
        const group=document.createElement('div');group.className='cs-formatbar';
        group.append(button('Duplicate',()=>mutate(s,()=>{if(ext(s).boxes.length<50){const a=ext(s).boxes;a.splice(a.indexOf(box)+1,0,{...clone(box),id:'box-'+crypto.randomUUID()});}},true)),
          button('Move up',()=>move(s,box,-1)),button('Move down',()=>move(s,box,1)),button('Remove box',()=>mutate(s,()=>{ext(s).boxes=ext(s).boxes.filter(b=>b.id!==box.id);},true)),
          menu('Alignment',[['Left','left'],['Center','center'],['Right','right']],v=>mutate(s,()=>{box.align=v;})),menu('Box text size',[['Original size',0],...M().sizes.map(v=>[v+' px',v])],v=>mutate(s,()=>{box.size=v;})));
        card.append(group);section.append(card);
      }
    }
    if(!s.isCommon&&item.example!==undefined){
      const examples=s.values['c2.examples'];
      const change=op=>mutate(s,()=>{
        const a=s.values['c2.examples'],i=item.example,old=a.slice(),formats=s.values._studio?.formats||[];let duplicate=-1;
        if(op==='add'&&a.length<50)a.splice(i+1,0,{title:'New example',thinking:'',typing:'',processing:''});
        if(op==='duplicate'&&a.length<50){a.splice(i+1,0,clone(a[i]));duplicate=i+1;}
        if(op==='up'&&i>0)[a[i-1],a[i]]=[a[i],a[i-1]];
        if(op==='down'&&i<a.length-1)[a[i+1],a[i]]=[a[i],a[i+1]];
        if(op==='remove'&&a.length>1)a.splice(i,1);
        if(s.values._studio)s.values._studio.formats=formats.flatMap(f=>{
          if(f.slot!=='c2.examples')return [f];const previous=Number(f.path[0]),next=a.indexOf(old[previous]),result=[];
          if(next>=0)result.push({...f,path:[String(next),...f.path.slice(1)]});
          if(duplicate>=0&&previous===i)result.push({...clone(f),path:[String(duplicate),...f.path.slice(1)]});return result;
        });
      },true);
      actions.append(button('Add same card',()=>change('add')),button('Duplicate card',()=>change('duplicate')),button('Move up',()=>change('up')),button('Move down',()=>change('down')),button('Remove card',()=>change('remove')));

    }
    actions.append(button('Undo',()=>travel(s,'undo','redo')),button('Redo',()=>travel(s,'redo','undo')));container.append(section);
  }
  function move(s,box,delta){mutate(s,()=>{const all=ext(s).boxes,group=all.filter(b=>b.slot===box.slot&&b.template===box.template&&b.anchor===box.anchor),i=group.indexOf(box),other=group[i+delta];if(other){const a=all.indexOf(box),b=all.indexOf(other);[all[a],all[b]]=[all[b],all[a]];}},true);}
  function travel(s,from,to){if(!s[from].length)return;s[to].push(clone(s.values));s.values=s[from].pop();changed(s);s.blockEditing.open();}
  function mount(s,api){
    s.blockEditing=api;s.undo=[];s.redo=[];
    // A staged front end must never offer submissions the installed backend cannot accept.
    window.AIWiseBackend.getClient().then(client=>client.rpc('workspace_studio_capabilities')).then(({data,error})=>{
      if(s.abort.signal.aborted)return;s.blocksEnabled=!error&&data?.blocks===1;
      const note=document.createElement('p');note.className='cs-language-status';note.textContent=s.blocksEnabled?'English editing · Add boxes, duplicate cards and format selected words.':'Text editing is available. Box and formatting tools will appear after the Studio backend update.';
      s.host.querySelector('.cs-toolbar').after(note);
    }).catch(()=>{});
  }
  window.AIWiseStudioEditing={mount,field,panel,remember,textChanged};
})();
