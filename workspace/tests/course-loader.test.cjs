/* The module loader resolves a course through the registry and reads its bachelor's approved examples. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom');
const registry=require('./registry.cjs');
const root=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const settle=()=>new Promise(resolve=>setTimeout(resolve,20));
// Values created inside the loaded scripts belong to another realm; compare their plain data.
const plain=value=>JSON.parse(JSON.stringify(value));
async function page({search='',force='',stored=null,missing=false}={}){
 const {document}=parseHTML(read('common/aiwise-c2-final.html')),store=new Map(stored?[['aiwise-course',stored]]:[]),scopes=[],requests=[];
 if(force)document.documentElement.setAttribute('data-force-course',force);
 Object.defineProperty(document,'currentScript',{value:{src:'https://example.test/repo/pipelines/course-loader.js',hasAttribute:()=>false},configurable:true});
 Object.defineProperty(document,'readyState',{value:'complete',configurable:true});
 const window={location:{search,pathname:'/repo/common/aiwise-c2-final.html'},AIWiseBetaContent:{read:async(scope,locale)=>{scopes.push([scope,locale]);return [];},apply:data=>data}};
 const fetch=async url=>{const file=String(url).replace('https://example.test/repo/','');requests.push(file);
  if(missing&&file.endsWith('registry.json'))return {ok:false,status:404};
  return {ok:true,json:async()=>JSON.parse(read(file))};};
 const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
 vm.runInNewContext(read('pipelines/course-loader.js'),{window,document,localStorage,fetch,URL,URLSearchParams,CustomEvent:document.defaultView.CustomEvent,console:{warn(){},error(){}}});
 await window.AIWiseCourseReady;await settle();
 return {window,document,store,scopes,requests};
}
const psychology=JSON.parse(read('course-specific/aws1/course-specific-content_aws1.json'));
test('a course shows its bachelor\'s examples under its own name',async()=>{
 const p=await page({search:'?course=psychology.psychodiagnostics'});
 assert.equal(p.window.AIWISE_COURSE_ID,'psychology.psychodiagnostics');
 assert.deepEqual(plain(p.window.AIWISE_COURSE.course),{id:'psychology.psychodiagnostics',short_name:'Psychodiagnostics',full_name:'Psychology – B1 – Psychodiagnostics',bachelor:'psychology'});
 assert.deepEqual(plain(p.window.AIWISE_COURSE.c2.examples),psychology.c2.examples);
 assert.deepEqual(p.scopes,[['psychology','en']],'approved examples are read for the bachelor, not the course');
 assert.equal(p.store.get('aiwise-course'),'psychology.psychodiagnostics');
 assert.ok(p.requests.includes('common/courses/registry.json'));assert.ok(p.requests.includes('course-specific/aws1/course-specific-content_aws1.json'));
});
test('earlier ids resolve to the course they now name and replace the remembered value',async()=>{
 const ped=await page({search:'?course=ped'});
 assert.equal(ped.window.AIWISE_COURSE_ID,'pedagogical-sciences.inleiding');assert.deepEqual(ped.scopes,[['pedagogical-sciences','en']]);
 assert.equal(ped.store.get('aiwise-course'),'pedagogical-sciences.inleiding');
 const remembered=await page({stored:'other'});
 assert.equal(remembered.window.AIWISE_COURSE_ID,'psychology.aws1');assert.equal(remembered.store.get('aiwise-course'),'psychology.aws1');
});
test('an unknown course falls back to the default',async()=>{
 const p=await page({search:'?course=not-a-course'});
 assert.equal(p.window.AIWISE_COURSE_ID,'psychology.aws1');assert.deepEqual(p.scopes,[['psychology','en']]);
});
test('the chooser lists every registered course; a pinned course has no chooser',async()=>{
 const open=await page({search:'?course=psychology.aws1'});
 const options=[...open.document.querySelectorAll('.acm-option')];
 assert.deepEqual(options.map(o=>o.querySelector('span').textContent),plain(registry().courses().map(c=>c.full_name)));
 assert.equal(open.document.querySelector('.acm-option.active strong').textContent,'AWS I');
 assert.equal(open.document.querySelector('#aiwiseCourseSwitch .acs-name').textContent,'AWS I');
 const pinned=await page({search:'?course=psychology.aws1',force:'pedagogical-sciences.inleiding',stored:'psychology.aws1'});
 assert.equal(pinned.window.AIWISE_COURSE_ID,'pedagogical-sciences.inleiding');
 assert.equal(pinned.document.getElementById('aiwiseCourseSwitch'),null);
 assert.equal(pinned.store.get('aiwise-course'),'psychology.aws1','a pinned page leaves the remembered choice alone');
});
test('a missing registry leaves the page announced without a course rather than hanging',async()=>{
 const p=await page({missing:true});
 assert.equal(p.window.AIWISE_COURSE_READY,true);assert.equal(p.window.AIWISE_COURSE,null);
});
test('workspace registry names scopes, including the ids saved versions still use',()=>{
 const r=registry();
 assert.deepEqual(plain(r.bachelors().map(b=>b.id)),['psychology','pedagogical-sciences']);
 assert.deepEqual(plain(r.courses().map(c=>[c.id,c.path])),[['psychology.aws1','psychology/aws1/'],['psychology.psychodiagnostics','psychology/psychodiagnostics/'],['pedagogical-sciences.inleiding','pedagogical-sciences/inleiding/']]);
 assert.equal(r.scope('aws1'),'psychology');assert.equal(r.scope('ped'),'pedagogical-sciences');assert.equal(r.scope('common'),'common');assert.equal(r.scope('other'),null);
 assert.equal(r.scopeName('ped'),'Pedagogical Sciences');assert.equal(r.scopeName('common'),'Common');assert.equal(r.scopeName('other'),'other');
 assert.equal(r.previewCourse('psychology'),'psychology.aws1');assert.equal(r.previewCourse('pedagogical-sciences'),'pedagogical-sciences.inleiding');assert.equal(r.previewCourse('common'),'psychology.aws1');
 assert.equal(r.course('other').id,'psychology.aws1');assert.equal(r.course('nope'),null);
 assert.deepEqual(plain(r.coursesOf('psychology').map(c=>c.name)),['B1 – Academic Writing Skills I','B1 – Psychodiagnostics']);
 for(const broken of [{},{schema:1,bachelors:[],courses:[]},{schema:1,bachelors:[{id:'common',name:'X',content:'x.json'}],courses:[{bachelor:'common',id:'a',name:'A',short_name:'A'}]},{schema:1,bachelors:[{id:'b',name:'B',content:'x.json'}],courses:[{bachelor:'missing',id:'a',name:'A',short_name:'A'}]}])assert.throws(()=>registry().use(broken));
});
