const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),source=fs.readFileSync(path.join(__dirname,'../select-controls.js'),'utf8');
const settle=()=>new Promise(r=>setTimeout(r,0));
function fixture(html){
 const dom=parseHTML('<html><body>'+html+'</body></html>'),{document,Event}=dom;let poll;
 Object.defineProperty(dom.HTMLSelectElement.prototype,'selectedIndex',{configurable:true,get(){return this._index??[...this.options].findIndex(o=>o.selected);},set(v){this._index=v;}});
 Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.options[this.selectedIndex]?.value||'';},set(v){this.selectedIndex=[...this.options].findIndex(o=>o.value===v);}});
 dom.HTMLElement.prototype.getClientRects=()=>[{}];dom.HTMLElement.prototype.getBoundingClientRect=()=>({left:12,right:312,top:20,bottom:64,width:300});
 const c={document,window:{addEventListener:()=>{}},MutationObserver:class{observe(){} disconnect(){}},Event,queueMicrotask,setInterval:fn=>poll=fn,innerWidth:600,innerHeight:700};vm.runInNewContext(source,c);
 const key=(n,k)=>{const e=new Event('keydown',{bubbles:true,cancelable:true});e.key=k;n.dispatchEvent(e);};
 return{document,api:c.window.AIWiseSelectControls,key,poll};
}
test('styled choices preserve native id/name and emit one input/change; cancellation can restore the original',async()=>{
 const f=fixture('<label for="course">Course</label><select name="course" id="course"><option value="a" selected>Alpha</option><option value="b">Beta</option></select>'),s=f.document.querySelector('select'),b=f.document.querySelector('[role=combobox]');let input=0,change=0;
 s.addEventListener('input',()=>input++);s.addEventListener('change',()=>{change++;s.value='a';});b.click();f.document.querySelector('[data-index="1"]').click();await settle();
 assert.equal(input,1);assert.equal(change,1);assert.equal(s.id,'course');assert.equal(s.name,'course');assert.equal(s.value,'a');assert.equal(b.textContent,'Alpha⌄');assert.equal(b.getAttribute('aria-label'),'Course');
});
test('keyboard navigation previews choices; Escape cancels, Enter commits, disabled choices are skipped',()=>{
 const f=fixture('<label>Language<select><option value="en" selected>English</option><option disabled value="de">German</option><option value="nl">Nederlands</option></select></label>'),s=f.document.querySelector('select'),b=f.document.querySelector('[role=combobox]');
 f.key(b,'ArrowDown');f.key(b,'ArrowDown');assert.equal(s.value,'en');f.key(b,'Escape');assert.equal(s.value,'en');assert.equal(f.document.querySelector('.aw-select-popup'),null);
 f.key(b,'ArrowDown');f.key(b,'End');f.key(b,'Enter');assert.equal(s.value,'nl');assert.equal(b.getAttribute('aria-expanded'),'false');
});
test('long option lists search safely and keep disabled group semantics',()=>{
 const f=fixture('<label>Item<select><optgroup label="Unavailable" disabled><option selected>Locked</option></optgroup>'+Array.from({length:10},(_,i)=>'<option value="'+i+'">Item '+i+'</option>').join('')+'<option>&lt;img src=x&gt;</option></select></label>'),b=f.document.querySelector('[role=combobox]');b.click();
 const search=f.document.querySelector('.aw-select-search');assert.ok(search);search.value='Item 9';search.dispatchEvent(new f.document.defaultView.Event('input'));assert.equal(f.document.querySelectorAll('[role=option]').length,1);assert.match(f.document.querySelector('[role=option]').textContent,/Item 9/);
 search.value='<img';search.dispatchEvent(new f.document.defaultView.Event('input'));assert.equal(f.document.querySelector('.aw-select-list img'),null);assert.match(f.document.querySelector('.aw-select-list').textContent,/<img src=x>/);
 search.value='missing';search.dispatchEvent(new f.document.defaultView.Event('input'));assert.match(f.document.querySelector('.aw-select-empty').textContent,/No matching/);f.api.close();
});
test('programmatic value/options changes synchronize and removed controls close their popup',async()=>{
 const f=fixture('<select aria-label="Version"><option value="1" selected>One</option><option value="2">Two</option></select>'),s=f.document.querySelector('select'),b=f.document.querySelector('[role=combobox]');s.value='2';f.poll();assert.equal(b.textContent,'Two⌄');
 s.innerHTML='<option value="3">Three</option>';s.selectedIndex=0;f.api.refresh();assert.equal(b.textContent,'Three⌄');b.click();s.parentElement.remove();await settle();f.api.refresh();assert.equal(f.document.querySelector('.aw-select-popup'),null);
});
test('multiple selects keep their native interaction',()=>{const f=fixture('<select multiple><option>One</option></select>');assert.equal(f.document.querySelector('.aw-select'),null);assert.equal(f.document.querySelector('select').getAttribute('aria-hidden'),null);});
