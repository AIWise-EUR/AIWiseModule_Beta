// Dashboard deployment: see supabase/WORKSPACE_COURSES_SETUP.md. No service-role key needed.
import { Buffer } from 'node:buffer';
import { createPrivateKey, sign } from 'node:crypto';

const OWNER = 'AIWise-EUR', REPO = 'AIWiseModule_Beta', BRANCH = 'development';
const BASE = `/repos/${OWNER}/${REPO}`, PATH = 'common/courses/registry.json';
const SHA = /^[a-f0-9]{40}$/, ID = /^[a-z][a-z0-9-]{0,39}$/;
const reserved = new Set(['new', 'edit', 'common', 'constructor', 'prototype']);
class CourseError extends Error {
  code: string; status: number; field: string;
  constructor(code: string, status = 400, field = '') { super(code); this.code = code; this.status = status; this.field = field; }
}
type Course = {bachelor: string; id: string; short_name: string; name: string};
type Dependencies = {env: (name: string) => string | undefined; fetch: typeof fetch; now: () => number};
const label = (value: unknown, max: number) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
export function courseInput(value: any): Course {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'bachelor,id,name,short_name') throw new CourseError('invalid_request');
  if ((typeof value.bachelor !== 'string' || !ID.test(value.bachelor))) throw new CourseError('bachelor_required', 400, 'bachelor');
  if ((typeof value.id !== 'string' || !ID.test(value.id)) || reserved.has(value.id)) throw new CourseError('invalid_course_id', 400, 'id');
  if (!label(value.short_name, 40)) throw new CourseError('invalid_short_name', 400, 'short_name');
  if (!label(value.name, 160)) throw new CourseError('invalid_course_name', 400, 'name');
  return value;
}
function validateRegistry(raw: any) {
  const bachelors = new Set(), courses = new Set();
  if (raw?.schema !== 1 || !Array.isArray(raw.bachelors) || !raw.bachelors.length || !Array.isArray(raw.courses)) throw new CourseError('invalid_registry', 502);
  for (const b of raw.bachelors) {
    if ((typeof b?.id !== 'string' || !ID.test(b.id)) || b.id === 'common' || bachelors.has(b.id) || !label(b.name, 160) || !label(b.content, 160)) throw new CourseError('invalid_registry', 502);
    bachelors.add(b.id);
  }
  for (const c of raw.courses) {
    const key = c?.bachelor + '.' + c?.id;
    if (!bachelors.has(c?.bachelor) || (typeof c?.id !== 'string' || !ID.test(c.id)) || courses.has(key) || !label(c?.name, 160) || !label(c?.short_name, 160)) throw new CourseError('invalid_registry', 502);
    courses.add(key);
  }
  return raw;
}
export function createHandler(deps: Dependencies) {
  async function request(url: string, init: RequestInit = {}) {
    try { return await deps.fetch(url, {...init, redirect: 'error', signal: AbortSignal.timeout(10000)}); }
    catch { throw new CourseError('connection_unavailable', 503); }
  }
  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('Origin');
    const headers: Record<string, string> = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin'};
    if (origin === 'https://aiwise-eur.github.io' || origin === 'https://supabase.com') Object.assign(headers, {
      'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS',
    });
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
    if (origin && !headers['Access-Control-Allow-Origin']) return reply({ok: false, code: 'origin_not_allowed'}, 403);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (req.method !== 'POST') return reply({ok: false, code: 'method_not_allowed'}, 405);
    let token = '';
    try {
      const url = deps.env('SUPABASE_URL')?.replace(/\/$/, '');
      let publicKey = deps.env('SUPABASE_ANON_KEY');
      try { publicKey = JSON.parse(deps.env('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || publicKey; } catch { /* Legacy runtime. */ }
      if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !publicKey) throw new CourseError('setup_required', 503);
      const authorization = req.headers.get('Authorization') || '';
      if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/i.test(authorization)) throw new CourseError('sign_in_required', 401);
      const userHeaders = {apikey: publicKey, Authorization: authorization, 'Content-Type': 'application/json'};
      async function requireAdmin() {
        const auth = await request(url + '/auth/v1/user', {headers: userHeaders});
        if (!auth.ok) throw new CourseError('sign_in_required', 401);
        const user = await auth.json();
        if (!user?.id || user.is_anonymous) throw new CourseError('sign_in_required', 401);
        const role = await request(url + '/rest/v1/rpc/workspace_role', {method: 'POST', headers: userHeaders, body: '{}'});
        if (!role.ok || await role.json() !== 'admin') throw new CourseError('administrator_required', 403);
      }
      await requireAdmin();
      const text = await req.text();
      if (text.length > 3000) throw new CourseError('invalid_request');
      let input;
      try { input = JSON.parse(text); } catch { throw new CourseError('invalid_request'); }
      if (!input || !['load', 'create', 'update'].includes(input.action)) throw new CourseError('invalid_request');
      const mutation = input.action !== 'load';
      if (Object.keys(input).sort().join(',') !== (mutation ? 'action,course,expected_sha' : 'action')) throw new CourseError('invalid_request');
      const course = mutation ? courseInput(input.course) : null;
      if (mutation && !SHA.test(input.expected_sha || '')) throw new CourseError('refresh_required', 409);
      async function github(path: string, init: RequestInit = {}, jwt = '') {
        const res = await request('https://api.github.com' + path, {...init, headers: {
          Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + (jwt || token),
          'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'AIWise-Course-Registry', 'Content-Type': 'application/json',
        }});
        if (!res.ok) throw new CourseError([409, 422].includes(res.status) ? 'registry_conflict' : 'github_unavailable', [409, 422].includes(res.status) ? 409 : 503);
        return res.status === 204 ? null : res.json();
      }
      const clientId = deps.env('AIWISE_GITHUB_CLIENT_ID')?.trim();
      const pem = deps.env('AIWISE_GITHUB_PRIVATE_KEY')?.trim().replace(/\\n/g, '\n');
      if (!clientId || !pem) throw new CourseError('setup_required', 503);
      let jwt;
      try {
        const key = createPrivateKey(pem), now = Math.floor(deps.now() / 1000);
        if (key.asymmetricKeyType !== 'rsa') throw Error();
        const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
        const unsigned = `${encode({alg: 'RS256', typ: 'JWT'})}.${encode({iss: clientId, iat: now - 60, exp: now + 540})}`;
        jwt = unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url');
      } catch { throw new CourseError('setup_required', 503); }
      const install = await github(`/orgs/${OWNER}/installation`, {}, jwt);
      if (!Number.isSafeInteger(install?.id) || install.id <= 0 || install.account?.login?.toLowerCase() !== OWNER.toLowerCase() || install.account?.type !== 'Organization' || install.suspended_at || install.permissions?.contents !== 'write') throw new CourseError('setup_required', 503);
      const access = await github(`/app/installations/${install.id}/access_tokens`, {method: 'POST', body: JSON.stringify({repositories: [REPO], permissions: {contents: 'write'}})}, jwt);
      if (typeof access?.token !== 'string' || !access.token) throw new CourseError('github_unavailable', 503);
      token = access.token;
      const blob = await github(`${BASE}/contents/${PATH}?ref=${BRANCH}`);
      if (!SHA.test(blob?.sha) || blob.encoding !== 'base64' || typeof blob.content !== 'string' || blob.content.length > 1400000) throw new CourseError('invalid_registry', 502);
      let raw;
      try { raw = validateRegistry(JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'))); }
      catch { throw new CourseError('invalid_registry', 502); }
      const result = (sha: string, commit: string | null = null) => ({ok: true, capability: 'workspace-courses-v1', registry: raw, sha, commit});
      if (!course) return reply(result(blob.sha));
      if (!raw.bachelors.some((b: any) => b.id === course.bachelor)) throw new CourseError('unknown_bachelor', 400, 'bachelor');
      const existing = raw.courses.find((c: any) => c.bachelor === course.bachelor && c.id === course.id);
      // Lost-response retries are safe; preserve existing aliases and activity metadata.
      if (existing?.name === course.name && existing.short_name === course.short_name) return reply(result(blob.sha));
      if (input.expected_sha !== blob.sha) throw new CourseError('registry_conflict', 409);
      if (input.action === 'create' && existing) throw new CourseError('course_exists', 409, 'id');
      if (input.action === 'update' && !existing) throw new CourseError('course_missing', 409);
      if (existing) Object.assign(existing, {name: course.name, short_name: course.short_name});
      else raw.courses.push(course);
      await requireAdmin();
      const saved = await github(`${BASE}/contents/${PATH}`, {method: 'PUT', body: JSON.stringify({
        message: input.action === 'create' ? 'Register Workspace course' : 'Update Workspace course names',
        branch: BRANCH, sha: blob.sha, content: Buffer.from(JSON.stringify(raw, null, 2) + '\n').toString('base64'),
      })});
      if (!SHA.test(saved?.content?.sha) || !SHA.test(saved?.commit?.sha)) throw new CourseError('save_unconfirmed', 502);
      return reply(result(saved.content.sha, saved.commit.sha));
    } catch (e) {
      const error = e instanceof CourseError ? e : new CourseError('connection_unavailable', 503);
      return reply({ok: false, code: error.code, field: error.field}, error.status);
    } finally {
      if (token) try { await request('https://api.github.com/installation/token', {method: 'DELETE', headers: {Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2026-03-10'}}); } catch { /* Short-lived installation token. */ }
    }
  };
}
if (typeof Deno !== 'undefined') Deno.serve(createHandler({env: name => Deno.env.get(name), fetch, now: Date.now}));
