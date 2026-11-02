const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
function setup(){const {window}=parseHTML('<html><body><main></main></body></html>');const document=window.document;document.currentScript={hasAttribute:()=>true};const context={window,document,NodeFilter:{SHOW_TEXT:4},setTimeout};
 for(const file of ['pipelines/common-content.js','workspace/draft-recovery.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 return {R:window.AIWiseDraftRecovery,M:window.AIWiseStudioBlocks,window,document};}
const plain=v=>JSON.parse(JSON.stringify(v));
const base=()=>({'c1.block-1':{'Text 1':'Original intro','Text 2':'Original strengths'}});
const box=(id,title)=>({id:'box-'+id.repeat(8)+'-1111-4111-8111-111111111111',slot:'c1.block-1',template:'text',anchor:0,fields:[[{text:title}],[{text:'Box body'}]],align:'left',size:0});
const ext=boxes=>({version:1,formats:[],boxes});
test('independent paragraph edits and newly approved box merge without losing either side',()=>{
 const {R,M}=setup(),original=base(),mine=base(),beta=base();mine['c1.block-1']['Text 2']='My strengths';beta._studio=ext([box('a','Academic responsibility')]);
 const inputs=JSON.stringify([original,mine,beta]),plan=R.plan(original,mine,beta);assert.equal(plan.conflicts.length,0);
 const result=plain(R.combine(plan));assert.equal(result['c1.block-1']['Text 2'],'My strengths');assert.equal(result._studio.boxes[0].fields[0][0].text,'Academic responsibility');assert.ok(M.validCopy(result,beta));assert.equal(JSON.stringify([original,mine,beta]),inputs);
});
test('overlapping edits require an explicit choice; both choices produce valid exact content',()=>{
 const {R,M}=setup(),original=base(),mine=base(),beta=base();mine['c1.block-1']['Text 1']='Mine';beta['c1.block-1']['Text 1']='Approved';
 const model=R.plan(original,mine,beta),id=model.conflicts[0].id;assert.equal(model.conflicts.length,1);assert.throws(()=>R.combine(model),/Choose/);
 for(const choice of ['draft','beta']){const result=plain(R.combine(model,{[id]:choice}));assert.equal(result['c1.block-1']['Text 1'],choice==='draft'?'Mine':'Approved');assert.ok(M.validCopy(result,beta));}
});
test('same edits and JSONB property reordering are not false conflicts',()=>{
 const {R}=setup(),mine=base();mine['c1.block-1']['Text 1']='Same';const beta={'c1.block-1':{'Text 2':'Original strengths','Text 1':'Same'}};
 const model=R.plan(base(),mine,beta);assert.equal(model.conflicts.length,0);assert.equal(model.changes[0].decision,'same');assert.ok(R.equal(mine,beta));assert.ok(R.equal(R.combine(model),beta));
});
test('rich formatting travels with the matching text and conflicts with a different text edit',()=>{
 const {R,M}=setup(),original=base(),mine=base(),beta=base();mine._studio={...ext([]),formats:[{slot:'c1.block-1',path:['Text 1'],runs:[{text:'Original intro',bold:true,size:22}]}]};beta['c1.block-1']['Text 1']='New intro';
 const model=R.plan(original,mine,beta);assert.equal(model.conflicts.length,1);
 for(const choice of ['draft','beta']){const result=plain(R.combine(model,{[model.conflicts[0].id]:choice}));assert.ok(M.validCopy(result,beta));assert.equal(result._studio.formats.length,choice==='draft'?1:0);}
});
test('independent added boxes retain stable IDs, removals are preserved, conflicting box edits require choice',()=>{
 const {R,M}=setup(),original={...base(),_studio:ext([box('a','A')])},mine=plain(original),beta=plain(original);
 mine._studio.boxes.push(box('b','B'));beta._studio.boxes.push(box('c','C'));
 let model=R.plan(original,mine,beta),result=plain(R.combine(model));assert.equal(model.conflicts.length,0);assert.deepEqual(result._studio.boxes.map(b=>b.fields[0][0].text),['A','C','B']);assert.ok(M.validCopy(result,beta));
 mine._studio.boxes=mine._studio.boxes.slice(1);model=R.plan(original,mine,beta);result=plain(R.combine(model));assert.deepEqual(result._studio.boxes.map(b=>b.fields[0][0].text),['C','B']);
 beta._studio.boxes[0].fields[0][0].text='Changed A';model=R.plan(original,mine,beta);assert.equal(model.conflicts.length,1);result=plain(R.combine(model,{[model.conflicts[0].id]:'draft'}));assert.equal(result._studio.boxes.length,2);
});
test('both-side reorder requires explicit order selection; unrelated additions survive it',()=>{
 const {R}=setup(),original={...base(),_studio:ext([box('a','A'),box('b','B'),box('c','C')])},mine=plain(original),beta=plain(original);
 mine._studio.boxes.reverse();beta._studio.boxes=[beta._studio.boxes[1],beta._studio.boxes[0],beta._studio.boxes[2],box('d','D')];
 const model=R.plan(original,mine,beta);assert.equal(model.conflicts.length,1);assert.equal(model.conflicts[0].kind,'order');
 const result=plain(R.combine(model,{[model.conflicts[0].id]:'draft'}));assert.deepEqual(result._studio.boxes.map(b=>b.fields[0][0].text),['C','B','A','D']);
});
test('lists are atomic: reorder and edit cannot accidentally mix different cards',()=>{
 const {R}=setup(),original={'c2.examples':[{title:'A'},{title:'B'}]},mine=plain(original),beta=plain(original);mine['c2.examples'].reverse();beta['c2.examples'][0].title='Edited A';
 const model=R.plan(original,mine,beta);assert.equal(model.conflicts.length,1);assert.deepEqual(plain(R.combine(model,{[model.conflicts[0].id]:'beta'})),beta);
});
test('optional note additions and removals are represented without losing other text',()=>{
 const {R}=setup(),original={'c3.example':{typing:'Prompt',typing_note:'Old'}},mine={'c3.example':{typing:'Prompt'}},beta={'c3.example':{typing:'New prompt',typing_note:'Old'}};
 assert.deepEqual(plain(R.combine(R.plan(original,mine,beta))),{'c3.example':{typing:'New prompt'}});
});
test('unsafe keys are rejected rather than mutating prototypes',()=>{const {R}=setup();assert.throws(()=>R.plan(base(),JSON.parse('{"__proto__":{"polluted":true}}'),base()),/unsupported field/);assert.equal({}.polluted,undefined);});
test('backup precedes replacement; stale tabs and storage failures never discard the original',()=>{
 const {R}=setup(),map=new Map([['draft','original'],['pending','untouched']]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 R.storeRecovered(storage,'draft','original','merged','backup-1');assert.equal(map.get('backup-1'),'original');assert.equal(map.get('draft'),'merged');assert.equal(map.get('pending'),'untouched');
 assert.throws(()=>R.storeRecovered(storage,'draft','original','wrong','backup-2'),/Another tab/);assert.equal(map.has('backup-2'),false);
 storage.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>R.storeRecovered(storage,'draft','merged','wrong','backup-3'),/Quota/);assert.equal(map.get('draft'),'merged');
 storage.setItem=(k,v)=>{if(k==='draft')throw Error('Quota exceeded');map.set(k,v);};assert.throws(()=>R.storeRecovered(storage,'draft','merged','wrong','backup-4'),/Quota/);assert.equal(map.get('backup-4'),'merged');assert.equal(map.get('draft'),'merged');
});
test('popup renders real values safely and uses approved explanation; cancel never applies',async()=>{
 const {R,window,document}=setup(),mine=base(),beta=base();mine['c1.block-1']['Text 1']='<img src=x onerror=alert(1)>';beta['c1.block-1']['Text 1']='Approved actual text';
 let applied=0;R.mount(document.querySelector('main'),{model:R.plan(base(),mine,beta),scope:'C1 English',raw:'original',apply:async()=>{applied++;}});
 const dialog=document.querySelector('dialog');dialog.close=()=>{};const next=dialog.querySelector('[data-dr-next]');dialog.querySelector('#dr-title').focus=()=>{};
 assert.match(dialog.textContent,/Changed in Beta/);assert.match(dialog.textContent,/Changed in your draft/);assert.equal(dialog.querySelector('img'),null);next.click();assert.match(dialog.textContent,/Both versions changed this paragraph. Choose which wording to keep./);assert.equal(next.disabled,true);
 const radio=dialog.querySelector('input[value="draft"]');radio.dispatchEvent(new window.Event('change'));assert.equal(next.disabled,false);next.click();assert.match(dialog.textContent,/<img src=x/);assert.equal(dialog.querySelector('img'),null);dialog.querySelector('[data-dr-close]').click();assert.equal(applied,0);next.click();await Promise.resolve();assert.equal(applied,1);
});
test('cache versions ignore the real language-loader change but preserve functional URL and markup changes',()=>{
 const {R}=setup();const html=v=>`<html><script src="../pipelines/content-language.js?v=${v}"></script><p>Body</p></html>`;
 assert.ok(R.sameSource(html('orientation-languages-v1'),html('fixed-course-v1')));
 assert.equal(R.sameSource(html('a'),html('a').replace('Body','New body')),false);
 assert.equal(R.sameSource(html('a'),html('a').replace('?v=a','?v=a&mode=other')),false);
 assert.equal(R.sameSource(html('a').replace('content-language','unknown'),html('b').replace('content-language','unknown')),false);
 assert.equal(R.sameSource(undefined,html('a')),false);
});
test('structural diagnostics name real changed locations; numbered fields cannot automatically reuse old text',()=>{
 const {R,window}=setup();const source=fs.readFileSync(path.join(root,'common/aiwise-c1-final.html'),'utf8');
 const doc=new window.DOMParser().parseFromString(source,'text/html');const blocks=window.AIWiseCommonContent.catalog(doc,'c1');
 const target=blocks.find(b=>Object.keys(b.fields).some(k=>k.startsWith('Text'))),text=target.nodes.find(n=>n.nodeType===3&&n.nodeValue.trim());
 text.nodeValue='Changed structural fixture text';
 const report=R.sourceReport(source,doc.toString(),'c1');assert.ok(report.affected.includes(target.path));
 assert.ok(report.details.some(d=>d.location===target.path&&d.after.includes('Changed structural fixture text')));
 const original=base(),mine=base(),beta=base();mine['c1.block-1']['Text 1']='Old-position text';
 const model=R.restrictLocations(R.plan(original,mine,beta),{affected:['c1.block-1'],details:[]});
 assert.equal(model.conflicts.length,1);const choices=Object.fromEntries(model.conflicts.map(u=>[u.id,'beta']));
 assert.throws(()=>R.combine(model,{...choices,[model.conflicts[0].id]:'draft'}),/cannot be reused/);
 const result=R.combine(model,{...choices,[model.conflicts[0].id]:{choice:'edit',text:'Explicit current-position text'}});
 assert.equal(result['c1.block-1']['Text 1'],'Explicit current-position text');
});
test('popup offers replacement wording, exact preview, and post-save editor or submission choices',async()=>{
 const {R,window,document}=setup(),mine=base(),beta=base();mine['c1.block-1']['Text 1']='Mine';beta['c1.block-1']['Text 1']='Beta';
 let saved,submitted=0,edited=0;
 R.mount(document.querySelector('main'),{model:R.plan(base(),mine,beta),scope:'Common C1',raw:'original',apply:async v=>{saved=v;},returnToEditor:()=>edited++,sendForReview:()=>submitted++});
 const dialog=document.querySelector('dialog');dialog.close=()=>{};const next=dialog.querySelector('[data-dr-next]');next.click();
 const input=dialog.querySelector('textarea');input.value='<script>not executable</script>';input.dispatchEvent(new window.Event('input'));assert.equal(next.disabled,false);
 next.click();assert.match(dialog.textContent,/Your replacement text/);assert.match(dialog.textContent,/<script>not executable/);assert.equal(dialog.querySelector('script'),null);
 next.click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(saved['c1.block-1']['Text 1'],'<script>not executable</script>');
 assert.match(dialog.textContent,/original draft is backed up/);assert.equal(submitted,0);assert.equal(edited,0);assert.equal(next.disabled,true);
 dialog.querySelector('input[value="submit"]').dispatchEvent(new window.Event('change'));next.click();assert.equal(submitted,1);assert.equal(edited,0);
});
test('unreadable draft requires explicit restart, preview, and callback; pause never writes',async()=>{
 const {R,window,document}=setup();let applied=0;
 R.mount(document.querySelector('main'),{issue:'Draft file: unreadable JSON',latest:base(),scope:'Common C1',raw:'{bad',apply:async(v,options)=>{assert.ok(options.restart);assert.deepEqual(plain(v),base());applied++;}});
 const dialog=document.querySelector('dialog');dialog.close=()=>{};const next=dialog.querySelector('[data-dr-next]');assert.equal(next.disabled,true);
 dialog.querySelector('input[value="pause"]').dispatchEvent(new window.Event('change'));next.click();assert.equal(applied,0);
 dialog.querySelector('input[value="latest"]').dispatchEvent(new window.Event('change'));next.click();assert.match(dialog.textContent,/Original intro/);assert.equal(applied,0);
 next.click();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(applied,1);
});
