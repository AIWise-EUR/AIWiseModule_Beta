const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require(process.env.LINKEDOM_MODULE||'linkedom'),root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Dutch lobby descriptions retain live course slots and original navigation',()=>{
 const {document}=parseHTML(read('common/lobby.html'));
 const links=[...document.querySelectorAll('a')].map(a=>a.getAttribute('href'));
 const slots=[...document.querySelectorAll('[data-slot="course.short_name"]')];
 vm.runInNewContext(read('common/lobby-language.js'),{document,location:{href:'https://example.test/lobby.html?course=dpas.dpas-skills&fixed=1&lang=nl'},URL});
 assert.match(document.querySelector('.hero-desc').textContent,/Gebruik GenAI/);
 assert.match(document.querySelector('.card-accent .card-desc').textContent,/Ontdek welke rol/);
 assert.equal(document.querySelectorAll('.card-desc[lang="nl"]').length,3);
 assert.equal(document.documentElement.lang,'nl');
 assert.deepEqual([...document.querySelectorAll('a')].map(a=>a.getAttribute('href')),links);
 assert.deepEqual([...document.querySelectorAll('[data-slot="course.short_name"]')],slots);
 for(const slot of slots)slot.textContent='Skills';
 assert.match(document.querySelector('.hero-desc').textContent,/binnen Skills\./);
 assert.match(document.querySelector('.card-accent .card-desc').textContent,/binnen Skills,/);
});
test('English/default lobby stays unchanged and translation precedes course loading',()=>{
 const html=read('common/lobby.html');
 assert.ok(html.indexOf('src="lobby-language.js')<html.indexOf('src="../pipelines/course-loader.js'));
 for(const search of ['', '?lang=en', '?lang=invalid']){
  const {document}=parseHTML(html),before=document.documentElement.outerHTML;
  vm.runInNewContext(read('common/lobby-language.js'),{document,location:{href:'https://example.test/lobby.html'+search},URL});
  assert.equal(document.documentElement.outerHTML,before);
 }
});
