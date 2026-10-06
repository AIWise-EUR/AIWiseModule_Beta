const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function fixture({published=false,course='psychology.psychodiagnostics',search='',file='aiwise-c3-final.html',fixed=true,force=''}={}){
 const base='https://example.test/AI-Wise/',prefix=published?'':'common/';
 const {document}=parseHTML(read('common/'+file));
 if(published)for(const a of document.querySelectorAll('a[href]'))a.setAttribute('href',a.getAttribute('href').replace('../course-specific/aws1/',''));
 if(force)document.documentElement.setAttribute('data-force-course',force);
 const location={href:base+prefix+file+'?course='+course+(fixed?'&fixed=1':'')+search,replace(value){this.redirect=value;}};
 location.origin=new URL(location.href).origin;
 const script=base+(published?'published-content-language.js':'pipelines/content-language.js');
 Object.defineProperty(document,'currentScript',{value:{src:script,hasAttribute:()=>false}});
 const window={location},callbacks=[];
 const context={window,document,location,URL,MutationObserver:class{constructor(fn){callbacks.push(fn);}observe(){}}};
 vm.runInNewContext(read('pipelines/content-language.js'),context);
 document.dispatchEvent(new document.defaultView.Event('DOMContentLoaded'));
 return {window,document,location,context,callbacks,base,prefix};
}
test('fixed course follows chapters, home, the embedded map, language, hashes and late links',()=>{
 for(const published of [false,true]){
  const f=fixture({published,search:'&lang=nl'}),pin=f.window.AIWiseCourseLink.pin;
  for(const dest of ['lobby.html','aiwise-c2-final.html?x=1#section-3','aiwise-c1-anatomy-2d.html']){
   const target=new URL(pin(dest));assert.equal(target.searchParams.get('course'),'psychology.psychodiagnostics');assert.equal(target.searchParams.get('fixed'),'1');assert.equal(target.searchParams.get('lang'),'nl');
   if(dest.includes('#')){assert.equal(target.hash,'#section-3');assert.equal(target.searchParams.get('x'),'1');}
  }
  const late=f.document.createElement('a');late.setAttribute('href','aiwise-c1-final.html');f.document.body.append(late);f.callbacks[0]([{addedNodes:[late]}]);assert.match(late.getAttribute('href'),/fixed=1/);
  const frame=f.document.createElement('iframe');frame.setAttribute('src','aiwise-c1-anatomy-2d.html');f.callbacks[0]([{addedNodes:[frame]}]);assert.match(frame.getAttribute('src'),/course=psychology.psychodiagnostics/);
  for(const dest of ['https://other.test/lobby.html','https://example.test/another/lobby.html','https://example.test/AI-Wise/workspace/','https://example.test/AI-Wise/paper.pdf'])assert.equal(pin(dest),dest);
 }
});
test('other fixed courses cannot enter AWS activities through the footer or home card',()=>{
 for(const published of [false,true])for(const course of ['psychology.psychodiagnostics','pedagogical-sciences.inleiding']){
  for(const file of ['aiwise-c3-final.html','lobby.html']){
   const f=fixture({published,course,file});
   const activity=f.document.querySelector(file==='lobby.html'?'.card-dark':'.next-bar > a:last-child');
   assert.equal(activity.hidden,true);assert.equal(activity.style.display,'none');assert.match(activity.getAttribute('href'),/aiwise-c1-final.html\?course=/);
   if(file!=='lobby.html'){assert.equal(f.document.querySelector('.next-bar-text').hidden,true);assert.equal(f.document.querySelector('.next-bar > a:first-child').hidden,false);}
  }
 }
 const aws=fixture({published:true,course:'psychology.aws1'});assert.equal(aws.document.querySelector('.next-bar > a:last-child').hidden,false);assert.match(aws.document.querySelector('.next-bar > a:last-child').getAttribute('href'),/sub-lobby.html\?course=psychology.aws1&fixed=1/);
});
test('unfixed links stay open; fixed links are independent and forced pages win',()=>{
 const open=fixture({fixed:false});assert.equal(open.window.AIWiseCourseLink.pin('lobby.html'),'lobby.html');assert.equal(open.document.querySelector('.next-bar > a:last-child').hidden,false);
 const a=fixture({course:'psychology.aws1'}),b=fixture({course:'pedagogical-sciences.inleiding'});
 assert.match(a.window.AIWiseCourseLink.pin('lobby.html'),/psychology.aws1/);assert.match(b.window.AIWiseCourseLink.pin('lobby.html'),/pedagogical-sciences.inleiding/);
 const forced=fixture({force:'psychology.aws1'});assert.match(forced.window.AIWiseCourseLink.pin('lobby.html'),/psychology.aws1/);
});
test('programmatic activity navigation keeps questionnaire parameters and fixed course',()=>{
 const f=fixture({published:true,course:'psychology.aws1'});
 Object.assign(f.window,{matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>fn(),addEventListener(){}});
 vm.runInNewContext(read('common/ui-effects.js'),f.context);
 f.window.uiNavigate('writing-sections.html?from=questionnaire&stage=writing&use_ai=yes');
 const next=new URL(f.location.href);assert.equal(next.searchParams.get('course'),'psychology.aws1');assert.equal(next.searchParams.get('fixed'),'1');assert.equal(next.searchParams.get('use_ai'),'yes');assert.equal(next.searchParams.get('stage'),'writing');
});
test('every AWS activity entry loads the navigation helper before its scripts',()=>{
 for(const name of fs.readdirSync(path.join(root,'course-specific/aws1')).filter(n=>n.endsWith('.html'))){
  const html=read('course-specific/aws1/'+name);assert.match(html,/<head>\s*<script src="\.\.\/\.\.\/pipelines\/content-language.js\?v=fixed-course-v1"><\/script>/,name);
 }
});
