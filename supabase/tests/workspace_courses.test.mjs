import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createHandler} from '../functions/workspace-courses/index.ts';
const fixture = JSON.parse(readFileSync(new URL('../../common/courses/registry.json', import.meta.url)));
const pem = generateKeyPairSync('rsa', {modulusLength: 2048}).privateKey.export({type: 'pkcs8', format: 'pem'});
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const course = {bachelor: 'psychology', id: 'test-course', name: 'Test course', short_name: 'Test'};
function setup(options = {}) {
  const state = {registry: structuredClone(fixture), sha: A, writes: [], calls: [], roles: 0, revoked: 0};
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status});
  const env = {SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-public', AIWISE_GITHUB_CLIENT_ID: 'test-app', AIWISE_GITHUB_PRIVATE_KEY: pem};
  const handler = createHandler({env: name => env[name], now: () => 1800000000000, fetch: async (url, init = {}) => {
    const u = new URL(url), method = init.method || 'GET'; state.calls.push(method + ' ' + u.pathname);
    if (u.pathname === '/auth/v1/user') return json(options.invalidAuth ? {} : {id: 'account', is_anonymous: !!options.anonymous}, options.invalidAuth ? 401 : 200);
    if (u.pathname === '/rest/v1/rpc/workspace_role') return json(options.role || (options.revoke && state.roles++ ? 'member' : 'admin'));
    if (u.pathname === '/orgs/AIWise-EUR/installation') return json({id: 12, account: {login: 'AIWise-EUR', type: 'Organization'}, permissions: {contents: 'write'}});
    if (u.pathname === '/app/installations/12/access_tokens') {
      assert.deepEqual(JSON.parse(init.body), {repositories: ['AIWiseModule_Beta'], permissions: {contents: 'write'}});
      return json({token: 'test-installation'});
    }
    if (u.pathname === '/installation/token') { state.revoked++; return new Response(null, {status: 204}); }
    assert.equal(u.pathname, '/repos/AIWise-EUR/AIWiseModule_Beta/contents/common/courses/registry.json');
    if (method === 'GET') { assert.equal(u.searchParams.get('ref'), 'development'); return json({sha: state.sha, encoding: 'base64', content: Buffer.from(JSON.stringify(state.registry)).toString('base64')}); }
    assert.equal(method, 'PUT');
    const input = JSON.parse(init.body); assert.equal(input.branch, 'development'); assert.equal(input.sha, state.sha);
    if (options.conflict) return json({}, 409);
    state.writes.push(input); state.registry = JSON.parse(Buffer.from(input.content, 'base64').toString()); state.sha = B;
    return options.lostResponse ? json({}, 502) : json({content: {sha: B}, commit: {sha: C}});
  }});
  async function call(input, headers = {}) {
    const res = await handler(new Request('https://example.supabase.co/functions/v1/workspace-courses', {method: 'POST', headers: {Authorization: 'Bearer a.b.c', Origin: 'https://aiwise-eur.github.io', ...headers}, body: JSON.stringify(input)}));
    return {status: res.status, body: await res.json()};
  }
  return {state, call};
}
test('shared create is one registry-only commit; a second account can load it; retry does not duplicate', async () => {
  const {state, call} = setup();
  const result = await call({action: 'create', course, expected_sha: A});
  assert.equal(result.status, 200); assert.equal(result.body.commit, C);
  assert.deepEqual(state.registry.bachelors, fixture.bachelors);
  assert.deepEqual(state.registry.courses.slice(0, -1), fixture.courses);
  assert.deepEqual(state.registry.courses.at(-1), course);
  const loaded = await call({action: 'load'}, {Authorization: 'Bearer second.account.token'});
  assert.equal(loaded.body.registry.courses.at(-1).id, course.id);
  assert.equal((await call({action: 'create', course, expected_sha: A})).status, 200);
  assert.equal(state.writes.length, 1); assert.equal(state.revoked, 3);
  assert.ok(!JSON.stringify(state.writes).includes('account'));
});
test('anonymous, member, missing token and revoked admins cannot write or obtain a token unnecessarily', async () => {
  for (const options of [{anonymous: true}, {invalidAuth: true}, {role: 'member'}, {revoke: true}]) {
    const {state, call} = setup(options);
    assert.ok([401, 403].includes((await call({action: 'create', course, expected_sha: A})).status));
    assert.equal(state.writes.length, 0);
    if (!options.revoke) assert.ok(!state.calls.some(c => c.includes('/access_tokens')));
  }
  const {call, state} = setup();
  assert.equal((await call({action: 'load'}, {Authorization: ''})).status, 401);
  assert.equal((await call({action: 'load'}, {Origin: 'https://untrusted.example'})).status, 403);
  assert.equal(state.calls.length, 0);
});
test('field errors reject malformed IDs, wrong bachelor, oversized names and path injection', async () => {
  for (const [change, field] of [[{id: 'DPAS_skills'}, 'id'], [{id: '../test'}, 'id'], [{id: undefined}, 'id'], [{bachelor: 'missing'}, 'bachelor'], [{name: ''}, 'name'], [{short_name: 'x'.repeat(41)}, 'short_name']]) {
    const {state, call} = setup();
    const result = await call({action: 'create', course: {...course, ...change}, expected_sha: A});
    assert.equal(result.status, 400);
    if (change.id !== undefined || Object.hasOwn(change, 'bachelor') || Object.hasOwn(change, 'name') || Object.hasOwn(change, 'short_name')) assert.equal(result.body.field, field);
    assert.equal(state.writes.length, 0);
  }
  const {state, call} = setup();
  assert.equal((await call({action: 'create', course, expected_sha: A, path: 'other.json'})).status, 400);
  assert.equal(state.writes.length, 0);
});
test('stale version and concurrent GitHub changes cannot overwrite another administrator', async () => {
  const {state, call} = setup();
  assert.equal((await call({action: 'create', course, expected_sha: B})).body.code, 'registry_conflict');
  assert.equal(state.writes.length, 0);
  const concurrent = setup({conflict: true});
  assert.equal((await concurrent.call({action: 'create', course, expected_sha: A})).body.code, 'registry_conflict');
  assert.equal(concurrent.state.writes.length, 0); assert.equal(concurrent.state.revoked, 1);
});
test('name update preserves immutable identity, aliases, activity paths and unrelated metadata', async () => {
  const {state, call} = setup(); state.registry.extra = {preserve: true};
  const existing = fixture.courses[0];
  const result = await call({action: 'update', expected_sha: A, course: {bachelor: existing.bachelor, id: existing.id, name: 'Updated course', short_name: 'New'}});
  assert.equal(result.status, 200);
  assert.deepEqual(state.registry.courses[0], {...existing, name: 'Updated course', short_name: 'New'});
  assert.deepEqual(state.registry.extra, {preserve: true});
});
test('duplicate with different names and editing a missing course fail safely', async () => {
  const {state, call} = setup();
  const existing = fixture.courses[0];
  assert.equal((await call({action: 'create', expected_sha: A, course: {...course, bachelor: existing.bachelor, id: existing.id}})).body.code, 'course_exists');
  assert.equal((await call({action: 'update', expected_sha: A, course})).body.code, 'course_missing');
  assert.equal(state.writes.length, 0);
});
test('uncertain response can be retried without another commit', async () => {
  const {state, call} = setup({lostResponse: true});
  assert.equal((await call({action: 'create', expected_sha: A, course})).status, 503);
  assert.equal((await call({action: 'create', expected_sha: A, course})).status, 200);
  assert.equal(state.writes.length, 1);
});
