const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
function setup(){const c={window:{},document:{currentScript:{hasAttribute:()=>true}},NodeFilter:{SHOW_TEXT:4}};vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),c);return c.window;}
const w=setup(),C=w.AIWiseCommonContent,M=w.AIWiseStudioBlocks,plain=v=>JSON.parse(JSON.stringify(v));
const box=(n,title='English')=>({id:`box-11111111-1111-4111-8111-${String(n).padStart(12,'0')}`,slot:'c2.block-0',template:'text',anchor:0,align:'left',size:0,fields:[[{text:title}],[{text:'Body'}]]});
const slots=(boxes=[])=>({'c2.block-0':{'Heading 1':'Heading'},'c2.block-1':{'Text 1':'Paragraph'},_studio:{version:1,formats:[],boxes}});
test('approved additions, placement and order follow English; Dutch text, runs and inputs survive',()=>{
 const en=slots([box(2),{...box(1),slot:'c2.block-1',align:'right',size:22}]),nl=slots([box(1,'Nederlandse titel')]);nl._studio.boxes[0].fields[1]=[{text:'Mijn tekst',bold:true}];const original=JSON.stringify([en,nl]);
 const out=C.translation(en,nl,null,true);
 assert.deepEqual(plain(out.slots._studio.boxes.map(b=>b.id)),en._studio.boxes.map(b=>b.id));
 assert.equal(out.slots._studio.boxes[1].slot,'c2.block-1');assert.equal(out.slots._studio.boxes[1].align,'right');assert.equal(out.slots._studio.boxes[1].size,22);
 assert.equal(M.plain(out.slots._studio.boxes[1].fields[0]),'Nederlandse titel');assert.equal(out.slots._studio.boxes[1].fields[1][0].bold,true);
 assert.equal(out.state.pending.length,2);assert.ok(out.state.pending.every(i=>i.kind==='translate'));assert.equal(JSON.stringify([en,nl]),original);assert.ok(M.validCopy(out.slots,en));
});
test('deleted boxes are archived; reintroduced identical IDs recover the last translation',()=>{
 const nl=slots([box(1,'Bewaarde vertaling')]),removed=C.translation(slots(),nl,null,true);assert.equal(removed.slots._studio.boxes.length,0);assert.equal(removed.state.retired.length,1);
 const restored=C.translation(slots([box(1)]),removed.slots,removed.state,true);assert.equal(M.plain(restored.slots._studio.boxes[0].fields[0]),'Bewaarde vertaling');assert.ok(restored.state.pending.every(i=>i.kind==='review'));
});
test('review acknowledgements persist, changed English fields alone reopen review',()=>{
 const en=slots([box(1)]),nl=slots([box(1,'Vertaling')]);let out=C.translation(en,nl,null,true);assert.equal(out.state.pending.length,0);
 const changed=structuredClone(en);changed['c2.block-1']['Text 1']='Updated';out=C.translation(changed,out.slots,out.state);assert.equal(out.state.pending.length,1);assert.equal(out.slots['c2.block-1']['Text 1'],'Paragraph');
 assert.equal(C.translation(changed,out.slots,out.state).state.pending.length,1);
 out.state.pending=[];assert.equal(C.translation(changed,out.slots,out.state).state.pending.length,0);
 const newBox=slots([box(1),box(2)]);out=C.translation(newBox,nl,null,true);assert.equal(C.translation(newBox,out.slots,out.state).state.pending.filter(i=>i.kind==='translate').length,2);
});
test('template shape change never positionally reuses incompatible translation',()=>{
 const nl=slots([box(1,'Vertaling')]),en=slots([{...box(1),template:'sl-card',fields:[[{text:'A'}],[{text:'B'}],[{text:'C'}]]}]);
 const out=C.translation(en,nl,null,true);assert.equal(out.state.retired.length,1);assert.equal(out.state.pending.length,3);assert.equal(M.plain(out.slots._studio.boxes[0].fields[0]),'A');
});
test('layout-only changes do not reopen text review; old unknown source requests review conservatively',()=>{
 const en=slots([box(1)]),nl=slots([box(1,'Vertaling')]),first=C.translation(en,nl,null,true);en._studio.boxes[0].align='right';
 assert.equal(C.translation(en,nl,first.state).state.pending.length,0);assert.equal(C.translation(en,nl,null,false).state.pending.length,4);
});
test('real C1 C2 C3 approved added boxes render safely and repeatably without altering original IDs',()=>{
 for(const chapter of ['c1','c2','c3']){
  const doc=parseHTML(fs.readFileSync(path.join(root,`common/aiwise-${chapter}-final.html`),'utf8')).document,blocks=C.catalog(doc,chapter);
  const en=JSON.parse(fs.readFileSync(path.join(root,`content/approved/en/common/${chapter}.json`),'utf8')).slots;
  const nl=Object.fromEntries(blocks.map(b=>[b.path,{...b.fields}]));const id=blocks[0].path,key=Object.keys(nl[id])[0];nl[id][key]='Nederlandse tekst <img src=x onerror=alert(1)>';
  const out=C.translation(en,nl,null,true);assert.equal(out.slots._studio.boxes.length,en._studio.boxes.length);
  for(let i=0;i<2;i++){C.apply(doc,chapter,out.slots,blocks);assert.equal(doc.querySelectorAll('[data-studio-box]').length,en._studio.boxes.length);assert.equal(doc.querySelector('.hero img'),null);}
  assert.equal(out.slots[id][key],nl[id][key]);
 }
});
test('malformed and genuinely changed base catalogs fail without rewriting the draft',()=>{
 const en=slots(),nl=slots();delete nl['c2.block-0'];const original=JSON.stringify(nl);assert.throws(()=>C.translation(en,nl),/no longer match/);assert.equal(JSON.stringify(nl),original);
});
async function moduleRender(rows){
 const html=fs.readFileSync(path.join(root,'common/aiwise-c2-final.html'),'utf8'),{document,Event}=parseHTML(html);Object.defineProperty(document,'currentScript',{value:{hasAttribute:()=>false}});
 const calls=[],window={AIWiseLanguage:{current:()=> 'nl'},AIWiseBetaContent:{read:async(course,locale)=>{calls.push([course,locale]);return rows[locale];}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pipelines/common-content.js'),'utf8'),{window,document,NodeFilter:{SHOW_TEXT:4},URL,location:{href:'https://example.test/common/aiwise-c2-final.html?lang=nl'}});
 document.dispatchEvent(new Event('DOMContentLoaded'));await window.AIWiseCommonReady;return {document,calls};
}
test('module uses its reader’s frozen English structure, preserves Dutch, and labels fallback',async()=>{
 const en=JSON.parse(fs.readFileSync(path.join(root,'content/approved/en/common/c2.json'),'utf8'));
 const nl=structuredClone(en);nl.locale='nl';nl.source_release='old-source';nl.slots._studio.boxes=[];nl.slots['c2.block-0'][Object.keys(nl.slots['c2.block-0'])[0]]='Nederlandse kop';
 const frozen=structuredClone(en);frozen.slots._studio.boxes=frozen.slots._studio.boxes.slice(0,1);
 const rendered=await moduleRender({nl:[nl],en:[frozen]});assert.deepEqual(rendered.calls,[['common','nl'],['common','en']]);assert.equal(rendered.document.querySelectorAll('[data-studio-box]').length,1);assert.equal(rendered.document.querySelector('.hero h2').textContent,'Nederlandse kop');assert.equal(rendered.document.querySelector('[data-language-notice]'),null);
 const fallback=await moduleRender({nl:[],en:[en]});assert.equal(fallback.document.querySelectorAll('[data-studio-box]').length,en.slots._studio.boxes.length);assert.match(fallback.document.querySelector('[data-language-notice]').textContent,/not approved/);
 const alreadyFallback=await moduleRender({nl:[{...en,fallback_locale:'en'}],en:[]});assert.equal(alreadyFallback.calls.length,1,'a frozen English fallback never looks up a newer English source');
});
test('fresh unapproved Dutch seeds are all marked for translation, not silently treated as reviewed',()=>{
 const window=setup();vm.runInNewContext(fs.readFileSync(path.join(root,'workspace/common-studio.js'),'utf8'),{window});
 const s={isCommon:true,locale:'nl',englishApproved:slots([box(1)]),values:slots(),englishRelease:'en-1',reviewedSource:'en-1',translationNew:true,raw:null};
 window.AIWiseCommonStudio.syncTranslation(s);assert.equal(s.translationSync.pending.length,4);assert.ok(s.translationSync.pending.every(i=>i.kind==='translate'));
 const changed=slots([box(1,'New heading')]);assert.equal(C.translation(changed,s.values,s.translationSync).state.pending.find(p=>p.id===JSON.stringify(['box',box(1).id,0])).kind,'translate');
});
