/* Exercise both the emergency legacy loader and the next generated release. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const root=path.resolve(__dirname,'../..');
const sources={aws1:JSON.parse(fs.readFileSync(path.join(root,'course-specific/aws1/course-specific-content_aws1.json'),'utf8')),ped:JSON.parse(fs.readFileSync(path.join(root,'course-specific/ped/ped.json'),'utf8'))};
async function page(loader,{modern=false,search='',stored=null,scoped=null,force='',storageFails=false,networkFails=false}={}) {
 const {document}=parseHTML(fs.readFileSync(path.join(root,'common/aiwise-c2-final.html'),'utf8'));
 if(force)document.documentElement.setAttribute('data-force-course',force);
 Object.defineProperty(document,'currentScript',{value:{src:'https://example.test/AI-Wise/published-course-loader.js',hasAttribute:()=>false},configurable:true});
 Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
 const entries=modern?[
  {id:'psychology.aws1',short_name:'AWS I',full_name:'Psychology – AWS I',bachelor:'psychology',aliases:['aws1','other']},
  {id:'psychology.psychodiagnostics',short_name:'Psychodiagnostics',full_name:'Psychology – Psychodiagnostics',bachelor:'psychology',aliases:[]},
  {id:'pedagogical-sciences.inleiding',short_name:'PED',full_name:'Pedagogical Sciences – Inleiding',bachelor:'pedagogical-sciences',aliases:['ped']}
 ]:[{id:'aws1',short_name:'AWS I',full_name:'Academic Writing Skills I'},{id:'ped',short_name:'PED',full_name:'Pedagogical Sciences'},{id:'other',short_name:'Others',full_name:'All other courses'}];
 const store=new Map([['aiwise-beta-course','psychology.psychodiagnostics']]);
 if(stored!==null)store.set('aiwise-course',stored);if(scoped!==null)store.set('aiwise-published-course',scoped);
 const reads=[],errors=[];
 const window={location:{search,pathname:'/AI-Wise/aiwise-c2-final.html'},AIWisePublished:{manifest:async()=>{if(networkFails)throw Error('Network unavailable');return entries;},course:async id=>{const e=entries.find(e=>e.id===id);if(!e)throw Error('Unknown course.');return {...structuredClone(sources[e.id.includes('ped')?'ped':'aws1']),course:{...e}};}},AIWiseBetaContent:{read:async(scope)=>{reads.push(scope);return [];},apply:data=>data}};
 vm.runInNewContext(loader,{window,document,URL,URLSearchParams,localStorage:{getItem:k=>{if(storageFails)throw Error('Storage unavailable');return store.get(k)??null;},setItem:(k,v)=>{if(storageFails)throw Error('Storage unavailable');store.set(k,v);}},CustomEvent:document.defaultView.CustomEvent,console:{error:(...args)=>errors.push(args),warn(){}}});
 await window.AIWiseCourseReady;await new Promise(r=>setTimeout(r,0));
 return {window,document,store,reads,errors};
}
async function check(loader,modern=false) {
 const aws=modern?'psychology.aws1':'aws1',ped=modern?'pedagogical-sciences.inleiding':'ped';
 for(const [input,expected] of [['psychology.aws1',aws],['aws1',aws],['pedagogical-sciences.inleiding',ped],['ped',ped]]) {
  const p=await page(loader,{modern,stored:input});
  assert.equal(p.window.AIWISE_COURSE_ID,expected,input);
  assert.equal(p.store.get('aiwise-course'),input,'legacy preference is read-only');
  assert.equal(p.store.get('aiwise-published-course'),expected);
  assert.equal(p.store.get('aiwise-beta-course'),'psychology.psychodiagnostics');
  assert.equal(p.document.querySelector('#aiwise-beta-error'),null);
  assert.equal(p.errors.length,0);
  assert.deepEqual(p.reads,[modern?(expected===ped?'pedagogical-sciences':'psychology'):expected]);
 }
 const own=await page(loader,{modern,stored:'psychology.psychodiagnostics',scoped:'ped'});
 assert.equal(own.window.AIWISE_COURSE_ID,ped,'namespaced preference wins over old shared key');
 const param=await page(loader,{modern,stored:'ped',search:'?course=psychology.aws1'});
 assert.equal(param.window.AIWISE_COURSE_ID,aws,'URL alias wins over remembered preference');
 const unknown=await page(loader,{modern,search:'?course=unpublished-course',scoped:'ped'});
 assert.equal(unknown.window.AIWISE_COURSE,null,'do not show another course silently');
 assert.equal(unknown.store.get('aiwise-published-course'),'ped','invalid URL cannot overwrite valid preference');
 assert.ok(unknown.document.getElementById('aiwise-course-unavailable'));
 assert.equal(unknown.document.querySelector('.aiwise-course-modal').hidden,false,'existing chooser opens');
 assert.equal(unknown.document.querySelector('#aiwiseCourseSwitch .acs-name').textContent,'Choose your course');
 assert.equal(unknown.document.getElementById('aiwise-beta-error'),null,'not a generic network/version error');
 const pinned=await page(loader,{modern,force:'ped',scoped:'aws1'});
 assert.equal(pinned.window.AIWISE_COURSE_ID,ped);assert.equal(pinned.store.get('aiwise-published-course'),'aws1');
 assert.equal(pinned.document.getElementById('aiwiseCourseSwitch'),null);
 const unavailable=await page(loader,{modern,search:'?course=psychology.aws1',storageFails:true});
 assert.equal(unavailable.window.AIWISE_COURSE_ID,aws,'disabled storage cannot block loading');
 const network=await page(loader,{modern,networkFails:true});assert.ok(network.document.getElementById('aiwise-beta-error'),'real load failures remain visible');
 if(!modern){const absent=await page(loader,{stored:'psychology.psychodiagnostics'});assert.equal(absent.window.AIWISE_COURSE,null,'no prefix mapping to AWS I');}
}
module.exports={check,page};
