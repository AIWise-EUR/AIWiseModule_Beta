const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const psy=read('course-specific/aws1/course-specific-content_aws1.json').c2;
const ped=read('course-specific/ped/ped.json').c2;
test('Psychology SAT has the PED phases, actors and labels but no copied example prose',()=>{
  const structure=x=>x.phases.map(p=>({label:p.label,steps:p.steps.map(s=>({actor:s.actor,name:s.name}))}));
  assert.deepEqual(structure(psy.sat_example),structure(ped.sat_example));
  assert.equal(psy.sat_example_title,'S.A.T worked example');assert.equal(psy.sat_example.note,'');
  assert.ok(psy.sat_example.phases.every(p=>p.steps.every(s=>s.text==='')));
});
test('adding an empty SAT template preserves saved examples and rich boxes; authored baselines still conflict',()=>{
  const window={addEventListener(){}};
  const source=fs.readFileSync(path.join(root,'workspace/content-studio.js'),'utf8').replace('window.AIWiseContentStudio = {render, supports,','window.AIWiseContentStudio = {extendEmptySAT, render, supports,');
  vm.runInNewContext(source,{window});const upgrade=window.AIWiseContentStudio.extendEmptySAT;
  const base={'c2.examples':structuredClone(psy.examples)},draft=structuredClone(base);
  draft['c2.examples'][0].title='Saved user edit';draft._studio={version:1,formats:[],boxes:[]};
  const expected=structuredClone(draft),full={...base,'c2.sat_example_title':psy.sat_example_title,'c2.sat_example':psy.sat_example};
  assert.equal(upgrade(draft,base,full),true);
  assert.deepEqual(draft['c2.examples'],expected['c2.examples']);assert.deepEqual(draft._studio,expected._studio);
  assert.equal(upgrade(draft,base,full),false,'never replace already authored SAT fields');
  const old={'c2.examples':psy.examples},authored={...full,'c2.sat_example_title':'An approved title'};
  assert.equal(upgrade(structuredClone(old),structuredClone(old),authored),false);
  const narrative=structuredClone(full);narrative['c2.sat_example'].phases[0].steps[0].text='New author content';
  assert.equal(upgrade(structuredClone(old),structuredClone(old),narrative),false);
});
