// Function name / URL slug: aiwise-release. Verify JWT OFF; both callers authenticate below.
// Existing clever-action remains a read-only connection check.
import { Buffer } from 'node:buffer';
import { createPrivateKey, sign, createHash } from 'node:crypto';

const OWNER = 'AIWise-EUR', REPO = 'AI-Wise', BRANCH = 'main';
const BASE = `/repos/${OWNER}/${REPO}`;
const SHA = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Dependencies = { env: (name: string) => string | undefined; fetch: typeof fetch; now: () => number };
class PublishError extends Error {
  code: string; status: number;
  constructor(code: string, status = 502) { super(code); this.code=code; this.status=status; }
}
export const SOURCE_FILES = [
 ...['c1','c2','c3'].map(c=>`common/aiwise-${c}-final.html`),'common/aiwise-c1-anatomy-2d.html',
 'pipelines/orientation-schema.json','pipelines/published-content.js','pipelines/common-content.js','pipelines/course-loader.js','pipelines/content-language.js','pipelines/feedback-widget.js','common/ui-effects.js',
 'course-specific/aws1/course-specific-content_aws1.json','course-specific/ped/ped.json','common/courses/other.json','common/courses/index.json',
];
export const DEST_FILES = ['aiwise-c1-final.html','aiwise-c2-final.html','aiwise-c3-final.html','aiwise-c1-anatomy-2d.html','published-content.json','published-content.js','published-common-content.js','published-course-loader.js','published-content-language.js','published-ui-effects.js','published-feedback-widget.js'];
function canonical(v:any):string {return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);}
const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function shape(value:any,base:any):boolean {
 if(typeof base==='string')return typeof value==='string'&&value.length<=100000;
 if(Array.isArray(base))return Array.isArray(value)&&base.length===value.length&&base.every((b,i)=>shape(value[i],b));
 if(!object(base)||!object(value))return false;
 const keys=Object.keys(value),expected=Object.keys(base);
 return keys.every(k=>!['__proto__','constructor','prototype'].includes(k)&&(Object.hasOwn(base,k)?shape(value[k],base[k]):k==='typing_note'&&typeof value[k]==='string'))&&expected.every(k=>Object.hasOwn(value,k)||(k==='typing_note'));
}
export function buildRelease(id:string,version:any,sourceSha:string,targetSha:string,source:Record<string,string>):Record<string,string> {
 if(!UUID.test(id)||!UUID.test(version?.id)||!Number.isSafeInteger(version.number)||!SHA.test(sourceSha)||!SHA.test(targetSha)||!Array.isArray(version.content))throw new PublishError('invalid_release',400);
 for(const path of SOURCE_FILES)if(typeof source[path]!=='string'||!source[path])throw new PublishError('source_file_unavailable');
 const parse=(path:string)=>JSON.parse(source[path]);
 const schemas=parse('pipelines/orientation-schema.json');
 const aws1=parse('course-specific/aws1/course-specific-content_aws1.json'),ped=parse('course-specific/ped/ped.json'),other=parse('common/courses/other.json');
 if(other.extends!=='aws1'||Object.keys(other).some(k=>!['extends','course'].includes(k)))throw new PublishError('source_structure_changed');
 const courses:any={aws1,ped,other:{...aws1,course:{...aws1.course,...other.course}}};
 const manifest=parse('common/courses/index.json');
 if(!Array.isArray(manifest)||manifest.map((r:any)=>r.id).sort().join('|')!=='aws1|other|ped')throw new PublishError('source_structure_changed');
 const required=new Set(['common/c1','common/c2','common/c3','common/map',...['aws1','ped','other'].flatMap(c=>[c+'/c2',c+'/c3'])]),seen=new Set();
 const content=version.content.map((row:any)=>{
  const {course,chapter,locale,slots}=row,key=course+'/'+chapter,identity=key+'/'+locale;
  if(!required.has(key)||!['en','nl'].includes(locale)||seen.has(identity)||!object(slots)||(row.submission_id!=null&&!UUID.test(row.submission_id))||(locale==='nl'&&!row.submission_id))throw new PublishError('invalid_version_content',400);
  seen.add(identity);
  let expected:any;
  if(course==='common')expected=schemas[chapter]?.slots;
  else {
   const html=source[`common/aiwise-${chapter}-final.html`];
   const paths=[...html.matchAll(/data-slot="([^"]+)"/g)].map(m=>m[1]).filter(p=>p.startsWith(chapter+'.'));
   expected=Object.fromEntries([...new Set(paths)].map(p=>[p,p.split('.').reduce((v:any,k)=>v?.[k],courses[course])]).filter(([,value])=>value!==undefined));
  }
  if(!object(expected)||Object.keys(slots).sort().join('|')!==Object.keys(expected).sort().join('|')||!Object.keys(expected).every(k=>shape(slots[k],expected[k])))throw new PublishError('version_structure_changed',409);
  return {course,chapter,locale,slots,submission_id:row.submission_id||null};
 });
 for(const key of required)if(!seen.has(key+'/en'))throw new PublishError('incomplete_version',409);
 const out:Record<string,string>={};
 for(const chapter of ['c1','c2','c3','map']){
  const filename=chapter==='map'?'aiwise-c1-anatomy-2d.html':`aiwise-${chapter}-final.html`;
  let html=source['common/'+filename];
  if(createHash('sha256').update(html).digest('hex')!==schemas[chapter]?.html_sha256)throw new PublishError('source_schema_outdated',409);
  html=html.replace('<html ',`<html data-published-release="${id}" `)
   .replace(/<script src="\.\.\/workspace\/supabase-config\.js[^"\n]*"><\/script>\s*/g,'')
   .replace(/\.\.\/pipelines\/(beta-content|common-content|course-loader|content-language|feedback-widget)\.js(?:\?[^"\n]*)?/g,(_,name)=>`published-${name==='beta-content'?'content':name}.js?release=${id}`)
   .replace('src="ui-effects.js"',`src="published-ui-effects.js?release=${id}"`)
   .replaceAll('assets/erasmus-logo.png','erasmus-logo.png').replaceAll('../course-specific/aws1/sub-lobby.html','sub-lobby.html');
  if(/\.\.\/(pipelines|workspace|course-specific)\//.test(html)||!html.includes(`data-published-release="${id}"`))throw new PublishError('source_structure_changed');
  out[filename]=html;
 }
 out['published-content.json']=JSON.stringify({schema:1,release_id:id,version_id:version.id,version_number:version.number,source_sha:sourceSha,target_sha:targetSha,content,courses,manifest},null,2)+'\n';
 for(const name of ['content','common-content','course-loader','content-language','feedback-widget'])out[`published-${name}.js`]=source[`pipelines/${name==='content'?'published-content':name}.js`];
 out['published-ui-effects.js']=source['common/ui-effects.js'];
 let loader=out['published-course-loader.js'];
 const replaceRequired=(text:string,pattern:RegExp,value:string)=>{if(!pattern.test(text))throw new PublishError('source_structure_changed');return text.replace(pattern,value);};
 loader=replaceRequired(loader,/  function fetchCourse\(id, seen\) \{[\s\S]*?(?=  function load\()/,'  function fetchCourse(id) { return window.AIWisePublished.course(id); }\n\n');
 loader=replaceRequired(loader,/  function fetchManifest\(\) \{[\s\S]*?(?=  var UI_CSS)/,'  function fetchManifest() { return window.AIWisePublished.manifest(); }\n\n');
 out['published-course-loader.js']=loader.replace('new URL("../", document.currentScript.src)','new URL("./", document.currentScript.src)').replace('Approved Beta content could not be loaded.','Published content could not be loaded.');
 out['published-content-language.js']=replaceRequired(out['published-content-language.js'],/\/\\\/common\\\/\|\\\/course-specific\\\/\/.test\(next.pathname\)/,'next.pathname.startsWith(new URL("./", location.href).pathname)');
 return out;
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
      let actor='';
      const workerSecret = req.headers.get('x-aiwise-worker');
      if (workerSecret) {
        if (!/^[a-f0-9]{64}$/.test(workerSecret) || await rpc('workspace_release_check_worker',{p_secret:workerSecret}) !== true) throw new PublishError('unauthorized',401);
      } else {
        const authorization = req.headers.get('Authorization') || '';
        if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/i.test(authorization)) throw new PublishError('sign_in_required',401);
        const userHeaders = {apikey:publicKey,Authorization:authorization,'Content-Type':'application/json'};
        const auth = await request(`${url}/auth/v1/user`,{headers:userHeaders});
        if (!auth.ok) throw new PublishError('sign_in_required',401);
        const user = await auth.json();
        if (!user?.id || user.is_anonymous || await rpc('workspace_role',{},userHeaders) !== 'admin') throw new PublishError('administrator_required',403);
        actor=user.id;
        if (await rpc('workspace_release_status',{},userHeaders) !== true) throw new PublishError('publishing_not_enabled',409);
      }

      let action:any={operation:'process'};
      if(!workerSecret){try{action=await req.json();}catch{throw new PublishError('invalid_request',400);}}
      if(!['prepare','process'].includes(action?.operation))throw new PublishError('invalid_request',400);
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
          repositories:action.operation==='prepare'?['AIWiseModule_Beta',REPO]:[REPO],permissions:{contents:action.operation==='prepare'?'read':'write',actions:'read'},
        })},{jwt});
        if(!access?.token)throw new PublishError('github_token_missing');
        token=access.token;
      }
      async function database(path:string,init:RequestInit={}){
        const response=await request(`${url}/rest/v1/${path}`,{...init,headers:serviceHeaders});
        if(!response.ok)throw new PublishError('database_unavailable');
        return response.status===204?null:response.json();
      }
      if(action.operation==='prepare'){
        if(!actor||!UUID.test(action.id||'')||!UUID.test(action.version_id||''))throw new PublishError('invalid_request',400);
        const existing=await database(`workspace_releases?id=eq.${action.id}&select=id,version_id,author_id`);
        if(existing.length){if(existing[0].version_id!==action.version_id||existing[0].author_id!==actor)throw new PublishError('release_identity_changed',409);return reply({ok:true,id:action.id});}
        const versions=await database(`workspace_beta_versions?id=eq.${action.version_id}&select=id,number,content`);
        if(versions.length!==1)throw new PublishError('saved_version_required',400);
        await connect();
        const source=await github('/repos/AIWise-EUR/AIWiseModule_Beta/git/ref/heads/development');
        const target=await github(`${BASE}/git/ref/heads/${BRANCH}`);
        const sourceSha=source?.object?.sha,targetSha=target?.object?.sha;
        if(!SHA.test(sourceSha)||!SHA.test(targetSha))throw new PublishError('invalid_github_response');
        const files:Record<string,string>={};
        await Promise.all(SOURCE_FILES.map(async path=>{
          const response=await request(`https://api.github.com/repos/AIWise-EUR/AIWiseModule_Beta/contents/${path}?ref=${sourceSha}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2026-03-10','User-Agent':'AIWise-Release'}});
          if(!response.ok)throw new PublishError('source_file_unavailable');files[path]=await response.text();
        }));
        const bundle=buildRelease(action.id,versions[0],sourceSha,targetSha,files);
        await rpc('workspace_store_release',{p_id:action.id,p_version:action.version_id,p_author:actor,p_source:sourceSha,p_target:targetSha,p_files:bundle});
        return reply({ok:true,id:action.id});
      }
      async function commit(job:any){
        if(!UUID.test(job.id)||!SHA.test(job.target_sha)||!job.files||Object.keys(job.files).sort().join('|')!==DEST_FILES.slice().sort().join('|'))throw new PublishError('invalid_release');
        await connect();
        const ref=await github(`${BASE}/git/ref/heads/${BRANCH}`),head=ref?.object?.sha;
        if(!SHA.test(head))throw new PublishError('invalid_github_response');
        const previous=await github(`${BASE}/contents/published-content.json?ref=${head}`,{}, {raw:true,missing:true});
        if(previous?.release_id===job.id){
          if(canonical(previous)!==canonical(JSON.parse(job.files['published-content.json'])))throw new PublishError('published_changed');
          const commits=await github(`${BASE}/commits?sha=${head}&path=published-content.json&per_page=1`);
          if(!SHA.test(commits?.[0]?.sha))throw new PublishError('invalid_github_response');return commits[0].sha;
        }
        // A prepared package is approved against an exact student-site revision.
        if(head!==job.target_sha)throw new PublishError('published_changed',409);
        const parent=await github(`${BASE}/git/commits/${head}`);
        if(!SHA.test(parent?.tree?.sha))throw new PublishError('invalid_github_response');
        const tree=await github(`${BASE}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:parent.tree.sha,tree:DEST_FILES.map(path=>({path,mode:'100644',type:'blob',content:job.files[path]}))})});
        if(!SHA.test(tree?.sha))throw new PublishError('invalid_github_response');
        const created=await github(`${BASE}/git/commits`,{method:'POST',body:JSON.stringify({message:`Publish AI-Wise review V${job.version_number}\n\nAIWise-Release: ${job.id}`,tree:tree.sha,parents:[head]})});
        if(!SHA.test(created?.sha))throw new PublishError('invalid_github_response');
        if(await rpc('workspace_release_lease_valid',{p_id:job.id,p_lease:job.lease_token})!==true)throw new PublishError('lease_expired');
        try{await github(`${BASE}/git/refs/heads/${BRANCH}`,{method:'PATCH',body:JSON.stringify({sha:created.sha,force:false})});}
        catch(e){if(e instanceof PublishError&&e.code==='github_conflict')throw new PublishError('published_changed',409);throw e;}
        return created.sha;
      }
      let completed=0,deferred=0;
      const job=await rpc('workspace_release_claim');
      if(job){
        let sha;
        try{sha=await commit(job);}catch(e){await rpc('workspace_release_finish',{p_id:job.id,p_lease:job.lease_token,p_sha:null,p_error:e instanceof PublishError?e.code:'publish_failed'});deferred++;}
        if(sha){await rpc('workspace_release_finish',{p_id:job.id,p_lease:job.lease_token,p_sha:sha,p_error:null});completed++;}
      }
      const pending=await request(`${url}/rest/v1/workspace_releases?select=id,commit_sha,created_at&status=eq.committed&deployment_status=in.(pending,building)&order=deployment_checked_at.asc.nullsfirst&limit=6`,{headers:serviceHeaders});
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
          const update=await request(`${url}/rest/v1/workspace_releases?id=eq.${job.id}`,{method:'PATCH',headers:serviceHeaders,
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
