import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validStudioExtension as archive} from '../functions/github-publish/index.ts';
const id='box-11111111-1111-4111-8111-111111111111',copy='box-22222222-2222-4222-8222-222222222222';
test('archive worker accepts independent boxes and rejects malformed or duplicate ownership',()=>{
 const slots={'c2.examples':[{},{}]},box={id,slot:'c2.examples',template:'text',anchor:0,fields:[[{text:'Title'}],[{text:'Context'}]],align:'left',size:0},ext={version:1,formats:[],boxes:[box,{...structuredClone(box),id:copy,example:1,family:id}]};
 for(const valid of [archive]){
  assert.equal(valid(ext,slots),true);
  for(const change of [b=>b.example=0,b=>b.example=2,b=>b.example=-1,b=>b.example=null,b=>b.example=0.5,b=>delete b.family,b=>delete b.example,b=>b.family='invalid',b=>b.template='dual-card',b=>b.anchor=1]){const bad=structuredClone(ext);change(bad.boxes[1]);assert.equal(valid(bad,slots),false);}
 }
});
