// Read-only check of the live setup: Supabase endpoints, approved content, GitHub commits and both Pages sites.
// Sends no credentials except the public browser key and changes nothing.
//
//   deno run --allow-read=. --allow-net=cvcvdiohckwgpgoxibia.supabase.co,api.github.com,aiwise-eur.github.io,raw.githubusercontent.com checks/live-check.ts
//
// Exit code 0 when every check passes, 1 when any fails. "SKIP" marks a check the public view cannot answer.

const ORG = 'AIWise-EUR', BETA_REPO = 'AIWiseModule_Beta', BETA_BRANCH = 'development';
const STUDENT_REPO = 'AI-Wise', STUDENT_BRANCH = 'main';
const PAGES = 'https://aiwise-eur.github.io';
const root = new URL('../', import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, root));

type Result = { status: 'PASS' | 'FAIL' | 'SKIP'; name: string; detail: string };
const results: Result[] = [];
const record = (status: Result['status'], name: string, detail = '') => { results.push({ status, name, detail }); };
async function check(name: string, run: () => Promise<string | void>) {
  try { record('PASS', name, (await run()) || ''); }
  catch (error) { record(error instanceof Skip ? 'SKIP' : 'FAIL', name, error instanceof Error ? error.message : String(error)); }
}
class Skip extends Error {}
const must = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

async function get(url: string, headers: Record<string, string> = {}) {
  return await fetch(url, { headers, signal: AbortSignal.timeout(20000), cache: 'no-store' });
}
async function github(path: string) {
  const response = await get('https://api.github.com' + path, { Accept: 'application/vnd.github+json', 'User-Agent': 'aiwise-live-check' });
  if (response.status === 403 || response.status === 429) { await response.body?.cancel(); throw new Skip('GitHub rate limit reached; retry later.'); }
  must(response.ok, `GitHub ${path} returned ${response.status}`);
  return await response.json();
}
const sha256 = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');

const config = await read('workspace/supabase-config.js');
const supabaseUrl = config.match(/url:\s*'(https:\/\/[a-z0-9]+\.supabase\.co)'/)?.[1] || '';
const publicKey = config.match(/publishableKey:\s*'([^']+)'/)?.[1] || '';
const publicHeaders = { apikey: publicKey, Authorization: 'Bearer ' + publicKey };

// 1. The URLs the database scheduler calls must be deployed functions that do their own authentication.
for (const file of ['supabase/ENABLE_GITHUB_PUBLISHING.sql', 'supabase/ENABLE_PUBLISHED_RELEASES.sql']) {
  const url = (await read(file)).match(/https:\/\/[a-z0-9]+\.supabase\.co\/functions\/v1\/[A-Za-z0-9_-]+/)?.[0] || '';
  await check(`Edge function called by ${file.split('/').pop()} is deployed`, async () => {
    must(url, 'No function URL found in the SQL file.');
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(20000) });
    const body = await response.json().catch(() => ({}));
    must(response.status !== 404, `${url} is not deployed (404). The scheduler's calls never reach a function.`);
    must(response.status === 401 && body.code === 'sign_in_required', `${url} answered ${response.status} ${JSON.stringify(body).slice(0, 120)}; expected the function's own sign-in rejection (Verify JWT off).`);
    return url.split('/').pop();
  });
}

// 2. Approved Beta content is publicly readable and well-formed.
type BetaRow = { course: string; chapter: string; locale: string; submission_id: string | null; approved_at: string };
let beta: BetaRow[] = [];
await check('Approved Beta content is readable', async () => {
  must(supabaseUrl && publicKey, 'Public Supabase configuration is missing.');
  const response = await get(`${supabaseUrl}/rest/v1/workspace_beta_content?select=course,chapter,locale,submission_id,approved_at&order=approved_at.desc`, publicHeaders);
  must(response.ok, `Supabase returned ${response.status}`);
  beta = await response.json();
  must(Array.isArray(beta), 'Unexpected response shape.');
  return `${beta.length} approved ${beta.length === 1 ? 'copy' : 'copies'}: ` + beta.map(r => `${r.course}/${r.chapter}/${r.locale}`).join(', ');
});

// 3. Every approved copy has reached GitHub as the same submission (Studio approval -> automatic Beta commit).
await check('Each approved copy is committed to the Beta repository', async () => {
  must(beta.length, 'No approved content to compare.');
  // Read at the exact branch head: the branch-name URL is cached for minutes after a commit.
  const head = (await github(`/repos/${ORG}/${BETA_REPO}/commits/${BETA_BRANCH}`)).sha as string;
  const problems: string[] = [];
  for (const row of beta.filter(r => r.submission_id)) {
    const path = `content/approved/${row.locale}/${row.course}/${row.chapter}.json`;
    const response = await get(`https://raw.githubusercontent.com/${ORG}/${BETA_REPO}/${head}/${path}`).catch(() => null);
    if (!response) throw new Skip('raw.githubusercontent.com is not allowed by --allow-net.');
    if (response.status === 404) { await response.body?.cancel(); problems.push(`${path} is missing (approved ${row.approved_at.slice(0, 16)})`); continue; }
    const file = await response.json().catch(() => null);
    if (file?.submission_id !== row.submission_id) problems.push(`${path} holds an older submission than Beta`);
  }
  must(!problems.length, problems.join('; '));
  return `${beta.filter(r => r.submission_id).length} checked at ${head.slice(0, 7)}`;
});

// 4. The Beta site serves the current development branch.
await check('Beta site matches the development branch', async () => {
  const head = (await github(`/repos/${ORG}/${BETA_REPO}/commits/${BETA_BRANCH}`)).sha as string;
  const runs = (await github(`/repos/${ORG}/${BETA_REPO}/actions/runs?branch=${BETA_BRANCH}&head_sha=${head}&per_page=10`)).workflow_runs || [];
  const run = runs.find((r: { name?: string }) => /pages.*(build|deploy)/i.test(r.name || ''));
  must(run, `No Pages run found for ${head.slice(0, 7)}.`);
  must(run.status === 'completed' && run.conclusion === 'success', `Pages run for ${head.slice(0, 7)} is ${run.status}/${run.conclusion}.`);
  const path = 'workspace/index.html';
  const source = await get(`https://api.github.com/repos/${ORG}/${BETA_REPO}/contents/${path}?ref=${head}`, { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'aiwise-live-check' });
  const served = await get(`${PAGES}/${BETA_REPO}/${path}?check=${Date.now()}`);
  must(source.ok && served.ok, `Could not read ${path} (${source.status}/${served.status}).`);
  must(await sha256(await source.text()) === await sha256(await served.text()), `${path} on the site differs from ${head.slice(0, 7)}.`);
  return head.slice(0, 7);
});

// 5. The student site serves one consistent published release.
await check('Student site serves one consistent release', async () => {
  const manifestResponse = await get(`${PAGES}/${STUDENT_REPO}/published-content.json?check=${Date.now()}`);
  if (manifestResponse.status === 404) { await manifestResponse.body?.cancel(); throw new Skip('No release has been published yet.'); }
  must(manifestResponse.ok, `published-content.json returned ${manifestResponse.status}`);
  const manifest = await manifestResponse.json();
  must(manifest.schema === 1 && Array.isArray(manifest.content) && manifest.courses && Array.isArray(manifest.manifest), 'published-content.json has an unexpected shape.');
  const mismatched: string[] = [];
  for (const page of ['aiwise-c1-final.html', 'aiwise-c2-final.html', 'aiwise-c3-final.html', 'aiwise-c1-anatomy-2d.html']) {
    const html = await (await get(`${PAGES}/${STUDENT_REPO}/${page}?check=${Date.now()}`)).text();
    const release = html.match(/data-published-release="([^"]+)"/)?.[1];
    if (release !== manifest.release_id) mismatched.push(`${page} (${release || 'no release id'})`);
  }
  must(!mismatched.length, `Pages do not belong to release ${manifest.release_id}: ${mismatched.join(', ')}`);
  const latest = await github(`/repos/${ORG}/${STUDENT_REPO}/commits/${STUDENT_BRANCH}`);
  const committed = await get(`https://api.github.com/repos/${ORG}/${STUDENT_REPO}/contents/published-content.json?ref=${latest.sha}`, { Accept: 'application/vnd.github.raw+json', 'User-Agent': 'aiwise-live-check' });
  must(committed.ok, `Could not read the committed release (${committed.status}).`);
  must((await committed.json()).release_id === manifest.release_id, 'The site still serves an older release than the latest commit on main.');
  return `V${manifest.version_number} · ${manifest.content.length} content copies`;
});

const width = Math.max(...results.map(r => r.name.length));
for (const r of results) console.log(`${r.status}  ${r.name.padEnd(width)}  ${r.detail}`);
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`\n${results.length - failed - results.filter(r => r.status === 'SKIP').length} passed · ${failed} failed · ${results.filter(r => r.status === 'SKIP').length} skipped`);
Deno.exit(failed ? 1 : 0);
