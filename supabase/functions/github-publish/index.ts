// New function: github-publish. Verify JWT OFF: both caller paths authenticate below.
// Existing clever-action remains a read-only connection check.
import { Buffer } from 'node:buffer';
import { createPrivateKey, sign } from 'node:crypto';

const OWNER = 'AIWise-EUR', REPO = 'AIWiseModule_Beta', BRANCH = 'development';
const BASE = `/repos/${OWNER}/${REPO}`;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch; now: () => number };
type Job = { sequence: number; submission_id: string; course: string; chapter: string; locale: string; lease_token: string; payload: Record<string, any> };
class PublishError extends Error {
  code: string; status: number;
  constructor(code: string, status = 502) { super(code); this.code=code; this.status=status; }
}
function canonical(value: any): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function artifact(job: Job) {
  const chapters = job.course === 'common' ? ['c1','c2','c3','map'] : ['c2','c3'];
  if (!Number.isSafeInteger(job.sequence) || job.sequence < 1 || !UUID.test(job.submission_id) ||
      !['common','aws1','ped','other'].includes(job.course) || !chapters.includes(job.chapter) || !['en','nl'].includes(job.locale)) throw new PublishError('invalid_job');
  const p = job.payload;
  if (p?.schema !== 1 || p.course !== job.course || p.chapter !== job.chapter || p.locale !== job.locale || p.submission_id !== job.submission_id ||
      !p.slots || Array.isArray(p.slots) || typeof p.slots !== 'object' || !Number.isFinite(Date.parse(p.approved_at)) ||
      (p.source_release !== null && !UUID.test(p.source_release))) throw new PublishError('invalid_content');
  for (const key of Object.keys(p.slots)) {
    if (!key.startsWith(job.chapter + '.') || key.split('.').some(k => !/^[a-z][a-z0-9_-]*$/i.test(k) || ['__proto__','constructor','prototype'].includes(k))) throw new PublishError('invalid_slot');
  }
  // Only public approved content is serialized; reviewer names, reasons, drafts and memos are omitted.
  const value = {schema:1, sequence:job.sequence, course:job.course, chapter:job.chapter, locale:job.locale,
    submission_id:job.submission_id, source_release:p.source_release, approved_at:p.approved_at, slots:p.slots};
  const content = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(content) > 4000000) throw new PublishError('content_too_large');
  return {path:`content/approved/${job.locale}/${job.course}/${job.chapter}.json`, value, content};
}

export function createHandler(deps: Dependencies) {
  async function request(url: string, init: RequestInit = {}) {
    try { return await deps.fetch(url, {...init, redirect:'error', signal:AbortSignal.timeout(10000)}); }
    catch { throw new PublishError('connection_unavailable'); }
  }
  return async function handler(req: Request): Promise<Response> {
    const origin = req.headers.get('Origin');
    const headers: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store',Vary:'Origin'};
    if (origin === 'https://aiwise-eur.github.io' || origin === 'https://supabase.com') Object.assign(headers, {
      'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
      'Access-Control-Allow-Methods':'POST,OPTIONS',
    });
    const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status,headers});
    if (origin && !headers['Access-Control-Allow-Origin']) return reply({ok:false,code:'origin_not_allowed'},403);
    if (req.method === 'OPTIONS') return new Response(null,{status:204,headers});
    if (req.method !== 'POST') return reply({ok:false,code:'method_not_allowed'},405);
    let token = '';
    try {
      const url = deps.env('SUPABASE_URL')?.replace(/\/$/,'');
      const service = deps.env('SUPABASE_SERVICE_ROLE_KEY');
      let publicKey = deps.env('SUPABASE_ANON_KEY');
      try { publicKey = JSON.parse(deps.env('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || publicKey; } catch { /* Legacy runtime. */ }
      if (!url || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || !service || !publicKey) throw new PublishError('runtime_configuration_missing',503);
      const serviceHeaders = {apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'};
      async function rpc(name: string, body: unknown = {}, userHeaders = serviceHeaders) {
        const response = await request(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:userHeaders,body:JSON.stringify(body)});
        if (!response.ok) throw new PublishError('database_unavailable');
        return response.status === 204 ? null : response.json();
      }
      const workerSecret = req.headers.get('x-aiwise-worker');
      if (workerSecret) {
        if (!/^[a-f0-9]{64}$/.test(workerSecret) || await rpc('workspace_github_check_worker',{p_secret:workerSecret}) !== true) throw new PublishError('unauthorized',401);
      } else {
        const authorization = req.headers.get('Authorization') || '';
        if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/i.test(authorization)) throw new PublishError('sign_in_required',401);
        const userHeaders = {apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'};
        const auth = await request(`${url}/auth/v1/user`,{headers:userHeaders});
        if (!auth.ok) throw new PublishError('sign_in_required',401);
        const user = await auth.json();
        if (!user?.id || user.is_anonymous || await rpc('workspace_role',{},userHeaders) !== 'admin') throw new PublishError('administrator_required',403);
        if (await rpc('workspace_github_status',{},userHeaders) !== true) throw new PublishError('publishing_not_enabled',409);
      }

      async function github(path: string, init: RequestInit = {}, options: {jwt?:string; missing?:boolean; raw?:boolean} = {}) {
        const response = await request('https://api.github.com' + path, {...init, headers:{
          Accept:options.raw?'application/vnd.github.raw+json':'application/vnd.github+json',
          Authorization:`Bearer ${options.jwt || token}`, 'X-GitHub-Api-Version':'2026-03-10',
          'User-Agent':'AIWise-Approved-Content','Content-Type':'application/json',
        }});
        if (response.status === 404 && options.missing) return null;
        if (!response.ok) throw new PublishError(response.status === 409 || response.status === 422 ? 'github_conflict' :
          response.status === 403 ? 'github_permission_or_rate_limit' : 'github_unavailable');
        return response.status === 204 ? null : response.json();
      }
      async function connect() {
        if (token) return;
        const clientId = deps.env('AIWISE_GITHUB_CLIENT_ID')?.trim();
        const pem = deps.env('AIWISE_GITHUB_PRIVATE_KEY')?.trim().replace(/\\n/g,'\n');
        if (!clientId || !pem) throw new PublishError('github_secrets_missing',503);
        let jwt: string;
        try {
          const key=createPrivateKey(pem), now=Math.floor(deps.now()/1000);
          if(key.asymmetricKeyType!=='rsa')throw Error();
          const encode=(v:unknown)=>Buffer.from(JSON.stringify(v)).toString('base64url');
          const unsigned=`${encode({alg:'RS256',typ:'JWT'})}.${encode({iss:clientId,iat:now-60,exp:now+540})}`;
          jwt=unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),key).toString('base64url');
        } catch {throw new PublishError('invalid_private_key',503);}
        const install=await github(`/orgs/${OWNER}/installation`,{}, {jwt});
        if(!Number.isSafeInteger(install?.id)||install.id<=0||install.account?.login?.toLowerCase()!==OWNER.toLowerCase()||
          install.account?.type!=='Organization'||install.suspended_at||install.permissions?.contents!=='write'||
          !['read','write'].includes(install.permissions?.actions))throw new PublishError('github_installation_unavailable',409);
        const access=await github(`/app/installations/${install.id}/access_tokens`,{method:'POST',body:JSON.stringify({
          repositories:[REPO],permissions:{contents:'write',actions:'read'},
        })},{jwt});
        if(!access?.token)throw new PublishError('github_token_missing');
        token=access.token;
      }
      async function commit(job: Job) {
        const file=artifact(job);
        await connect();
        for(let attempt=0;attempt<3;attempt++) {
          const ref=await github(`${BASE}/git/ref/heads/${BRANCH}`), head=ref?.object?.sha;
          if(!SHA.test(head))throw new PublishError('invalid_github_response');
          const current=await github(`${BASE}/contents/${file.path}?ref=${head}`,{}, {missing:true,raw:true});
          if(current) {
            if(current.schema!==1||!Number.isSafeInteger(current.sequence)||current.course!==job.course||current.chapter!==job.chapter||current.locale!==job.locale)throw new PublishError('artifact_conflict');
            if(current.sequence>job.sequence)return {sha:null,superseded:true};
            if(current.sequence===job.sequence) {
              if(canonical(current)!==canonical(file.value))throw new PublishError('artifact_conflict');
              const commits=await github(`${BASE}/commits?sha=${head}&path=${encodeURIComponent(file.path)}&per_page=1`);
              if(!SHA.test(commits?.[0]?.sha))throw new PublishError('invalid_github_response');
              return {sha:commits[0].sha,superseded:false};
            }
          }
          const parent=await github(`${BASE}/git/commits/${head}`);
          if(!SHA.test(parent?.tree?.sha))throw new PublishError('invalid_github_response');
          const tree=await github(`${BASE}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:parent.tree.sha,
            tree:[{path:file.path,mode:'100644',type:'blob',content:file.content}],
          })});
          if(!SHA.test(tree?.sha))throw new PublishError('invalid_github_response');
          const created=await github(`${BASE}/git/commits`,{method:'POST',body:JSON.stringify({
            message:`Approve ${job.course} ${job.chapter.toUpperCase()} (${job.locale})\n\nAIWise-Submission: ${job.submission_id}`,
            tree:tree.sha,parents:[head],
          })});
          if(!SHA.test(created?.sha))throw new PublishError('invalid_github_response');
          if(await rpc('workspace_github_lease_valid',{p_sequence:job.sequence,p_lease:job.lease_token})!==true)throw new PublishError('lease_expired');
          try {
            await github(`${BASE}/git/refs/heads/${BRANCH}`,{method:'PATCH',body:JSON.stringify({sha:created.sha,force:false})});
            return {sha:created.sha,superseded:false};
          } catch(error) {
            if(!(error instanceof PublishError)||error.code!=='github_conflict'||attempt===2)throw error;
            // Re-read the newest tree; never force-push over a concurrent editor.
          }
        }
        throw new PublishError('github_conflict');
      }

      let completed=0, deferred=0;
      // Bounded work per invocation; the durable schedule resumes after termination.
      for(let i=0;i<3;i++) {
        const job=await rpc('workspace_github_claim') as Job|null;
        if(!job)break;
        let result: {sha:string|null;superseded:boolean};
        try { result=await commit(job); }
        catch(error) {
          await rpc('workspace_github_finish',{p_sequence:job.sequence,p_lease:job.lease_token,p_sha:null,
            p_error:error instanceof PublishError?error.code:'publish_failed',p_superseded:false});
          deferred++;break;
        }
        // A failed acknowledgement leaves the lease for recovery. Retrying recognizes the committed file.
        await rpc('workspace_github_finish',{p_sequence:job.sequence,p_lease:job.lease_token,p_sha:result.sha,p_error:null,p_superseded:result.superseded});
        completed++;
      }
      const pending=await request(`${url}/rest/v1/workspace_github_jobs?select=sequence,commit_sha,created_at&status=eq.committed&deployment_status=in.(pending,building)&order=deployment_checked_at.asc.nullsfirst&limit=6`,{headers:serviceHeaders});
      if(!pending.ok)throw new PublishError('database_unavailable');
      const jobs=await pending.json();
      if(!Array.isArray(jobs))throw new PublishError('database_unavailable');
      for(const job of jobs) {
        if(!SHA.test(job.commit_sha))continue;
        try {
          await connect();
          const runs=await github(`${BASE}/actions/runs?branch=${BRANCH}&head_sha=${job.commit_sha}&per_page=20`);
          const run=runs?.workflow_runs?.filter((r:any)=>r.head_sha===job.commit_sha&&r.head_branch===BRANCH&&/pages.*(build|deploy)/i.test(r.name||''))
            .sort((a:any,b:any)=>b.id-a.id)[0];
          const status=run ? (run.status==='completed'?(run.conclusion==='success'?'success':'failure'):'building') :
            deps.now()-Date.parse(job.created_at)>86400000?'unknown':'pending';
          const update=await request(`${url}/rest/v1/workspace_github_jobs?sequence=eq.${job.sequence}`,{method:'PATCH',headers:serviceHeaders,
            body:JSON.stringify({deployment_status:status,deployment_run_id:run?.id||null,deployment_checked_at:new Date(deps.now()).toISOString()})});
          if(!update.ok)throw new PublishError('database_unavailable');
        } catch { /* A later scheduled run retries status checks without repeating commits. */ }
      }
      return reply({ok:true,completed,deferred,repository:`${OWNER}/${REPO}`,branch:BRANCH});
    } catch(error) {
      return reply({ok:false,code:error instanceof PublishError?error.code:'publish_failed'},error instanceof PublishError?error.status:500);
    } finally {
      if(token)try { await request('https://api.github.com/installation/token',{method:'DELETE',headers:{Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'AIWise-Approved-Content'}}); } catch { /* Token expires automatically. */ }
    }
  };
}

if(typeof Deno!=='undefined')Deno.serve(createHandler({env:name=>Deno.env.get(name),fetch,now:Date.now}));
