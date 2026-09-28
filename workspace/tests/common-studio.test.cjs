const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
function setup() {
  const store = new Map(); let failWrite = false;
  const localStorage = {getItem: key => store.get(key) ?? null,
    setItem(key, value) { if (failWrite) throw Error('Storage full'); store.set(key, value); }};
  const window = {addEventListener() {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../control-tower.js'), 'utf8'),
    {window, localStorage, crypto: {randomUUID}, location: {hash: ''}});
  function common(chapter = 'c1') {
    const slots = {[chapter + '.block-0']: {'Heading 1': '<img src=x onerror=alert(1)>'}};
    const baseSlots = {[chapter + '.block-0']: {'Heading 1': 'Original'}};
    const raw = JSON.stringify({schema:1, scope:'common', chapter, savedAt:'2026-09-28T00:00:00Z', slots, baseSlots, blockTitles:{[chapter + '.block-0']:'Introduction'}});
    store.set(`aiwise_common_studio_${chapter}_v1`, raw);
    return {chapter, raw, slots, baseSlots, summary:'Clarify the heading', name:'Local test'};
  }
  return {store, common, api:window.AIWiseControlTower, fail:() => {failWrite=true;}};
}
test('C1–C3 submit into the common lane with fixed copies and no course snapshot', () => {
  const {store, common, api} = setup();
  for (const chapter of ['c1','c2','c3']) {
    const input=common(chapter), result=api.submitCommonDraft(input);
    input.slots[chapter + '.block-0']['Heading 1']='Later edit';
    const request=JSON.parse(store.get('aiwise_control_tower_v1')).requests.find(r=>r.id===result.id);
    assert.equal(request.route,'common'); assert.equal(request.status,'pending');
    assert.equal(request.commonSnapshot.slots[chapter+'.block-0']['Heading 1'],'<img src=x onerror=alert(1)>');
    assert.equal(request.commonSnapshot.blockTitles[chapter+'.block-0'],'Introduction');
    assert.equal(request.contentSnapshot,undefined);
  }
  assert.equal(api.overview().pending,3);
});
test('submitting the same saved chapter twice returns the first request', () => {
  const {api,common}=setup(), input=common();
  assert.equal(api.submitCommonDraft(input).id,api.submitCommonDraft(input).id);
  assert.equal(api.overview().pending,1);
});
test('rejects stale tab drafts and mismatched submitted text', () => {
  const {api,common,store}=setup(), input=common();
  input.slots['c1.block-0']['Heading 1']='Unsaved change';
  assert.throws(()=>api.submitCommonDraft(input),/cannot be submitted/);
  store.set('aiwise_common_studio_c1_v1','changed elsewhere');
  assert.throws(()=>api.submitCommonDraft(input),/another tab/);
  assert.equal(store.has('aiwise_control_tower_v1'),false);
});
test('storage failure preserves saved common draft without creating a request', () => {
  const {api,common,store,fail}=setup(), input=common(); fail();
  assert.throws(()=>api.submitCommonDraft(input),/could not be saved/);
  assert.equal(store.get('aiwise_common_studio_c1_v1'),input.raw);
  assert.equal(store.has('aiwise_control_tower_v1'),false);
});
test('corrupt existing request data is preserved', () => {
  const {api,common,store}=setup(), input=common(); store.set('aiwise_control_tower_v1','broken');
  assert.throws(()=>api.submitCommonDraft(input),/left untouched/);
  assert.equal(store.get('aiwise_control_tower_v1'),'broken');
});
test('course draft format and course submission continue to work alongside common', () => {
  const {api,common,store}=setup(); api.submitCommonDraft(common());
  const slots={'c3.full_example':'Course text'}, baseSlots={'c3.full_example':'Original'};
  const raw=JSON.stringify({schema:1,course:'aws1',chapter:'c3',savedAt:'2026-09-28T00:00:00Z',slots,baseSlots});
  store.set('aiwise_content_studio_aws1_c3_v1',raw);
  api.submitStudioDraft({course:'aws1',chapter:'c3',courseName:'AWS1',raw,slots,baseSlots,summary:'Change',name:'Local test'});
  const requests=JSON.parse(store.get('aiwise_control_tower_v1')).requests;
  assert.equal(requests[1].route,'studio'); assert.equal(requests[1].contentSnapshot.course,'aws1');
  assert.equal(requests[1].commonSnapshot,undefined); assert.equal(api.overview().pending,2);
  assert.equal(store.get('aiwise_content_studio_aws1_c3_v1'),raw);
});
test('empty author and summary never create requests', () => {
  const {api,common,store}=setup();
  assert.throws(()=>api.submitCommonDraft({...common(),name:''}),/name/);
  assert.throws(()=>api.submitCommonDraft({...common(),summary:' '}),/Describe/);
  assert.equal(store.has('aiwise_control_tower_v1'),false);
});
