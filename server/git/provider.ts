
import { PLATFORM_CONFIG } from "../platform-config";

export type GitRepository = { owner: string; name: string; defaultBranch: string; url: string };
export type GitBranch = { name: string; sha: string; protected: boolean };
export type GitCommit = { sha: string; message: string; url?: string };
export type GitPullRequest = { number: number; title: string; state: string; url: string; head: string; base: string };
export type GitRemoteSnapshot = { sha: string; files: Array<{ path:string; content:string }> };

export type GitProvider = {
  status(): { configured: boolean; provider: string; reason?: string };
  getRepository(repo: GitRepository): Promise<GitRepository>;
  listBranches(repo: GitRepository): Promise<GitBranch[]>;
  getBranch(repo: GitRepository, branch: string): Promise<GitBranch>;
  getBranchFiles(repo: GitRepository, branch: string): Promise<GitRemoteSnapshot>;
  createBranch(repo: GitRepository, branch: string, sha: string): Promise<GitBranch>;
  createCommit(repo: GitRepository, branch: string, message: string, files: Array<{ path: string; content: string }>, expectedParentSha?: string, deletePaths?: string[]): Promise<GitCommit>;
  createPullRequest(repo: GitRepository, head: string, base: string, title: string, body: string): Promise<GitPullRequest>;
};

function githubStatus() { return { configured:Boolean(PLATFORM_CONFIG.githubToken&&PLATFORM_CONFIG.githubApiUrl), provider:"github", reason:PLATFORM_CONFIG.githubToken&&PLATFORM_CONFIG.githubApiUrl?undefined:"GITHUB_TOKEN and GITHUB_API_URL are required for real GitHub operations." }; }
function parseRepo(url:string):GitRepository { const normalized=url.replace(/^git@github\.com:/,"https://github.com/").replace(/\.git$/,"").replace(/\/$/,""); const m=normalized.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i); if(!m)throw new Error("Only a GitHub repository URL is supported."); return {owner:m[1],name:m[2],defaultBranch:"main",url:normalized}; }
function assertApiUrl(){const raw=PLATFORM_CONFIG.githubApiUrl; if(!raw)throw new Error("GitHub API URL is not configured."); const u=new URL(raw); if(u.protocol!=="https:" || !(u.hostname==="api.github.com" || u.hostname.endsWith(".github.com"))) throw new Error("GitHub API URL must be an approved HTTPS GitHub endpoint."); return u.toString().replace(/\/$/,"");}
async function request(path:string,init?:RequestInit){
  const status=githubStatus(); if(!status.configured)throw new Error(status.reason); const base=assertApiUrl();
  let last="";
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch(`${base}${path}`,{...init,headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${PLATFORM_CONFIG.githubToken}`,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json",...(init?.headers||{})},signal:AbortSignal.timeout(20000)});
    const text=await response.text(); let data:any={}; try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
    if(response.ok)return data;
    last=data.message||`GitHub API request failed (${response.status})`;
    if(response.status!==429 && response.status<500)break;
    await new Promise(r=>setTimeout(r,500*(attempt+1)));
  }
  throw new Error(last);
}
function pathPart(v:string){if(!/^[A-Za-z0-9._-]+$/.test(v))throw new Error("Invalid GitHub path component.");return encodeURIComponent(v);}
function branchPart(v:string){if(!/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,159}$/.test(v)||v.includes(".."))throw new Error("Invalid Git branch name.");return encodeURIComponent(v);}

export function githubRepositoryFromUrl(url:string){return parseRepo(url);}
export function githubProvider():GitProvider{return{
 status:githubStatus,
 async getRepository(repo){const d=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}`);return{owner:d.owner.login,name:d.name,defaultBranch:d.default_branch,url:d.html_url};},
 async listBranches(repo){const rows=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/branches?per_page=100`);return rows.map((b:any)=>({name:b.name,sha:b.commit.sha,protected:Boolean(b.protected)}));},
 async getBranch(repo,branch){const d=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/ref/heads/${branchPart(branch)}`);return{name:branch,sha:d.object.sha,protected:false};},
 async getBranchFiles(repo,branch){
   const ref=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/ref/heads/${branchPart(branch)}`); const treeSha=(await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/commits/${ref.object.sha}`)).tree.sha;
   const tree=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/trees/${treeSha}?recursive=1`); if(tree.truncated)throw new Error("Remote repository tree is too large for a safe sync operation.");
   const blobs=tree.tree.filter((x:any)=>x.type==="blob"&&typeof x.path==="string"); if(blobs.length>2000)throw new Error("Remote repository contains more than 2000 files; sync is blocked until the repository is reduced or an explicit large-repo mode is added.");
   const files=[]; for(const blob of blobs){const d=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/blobs/${blob.sha}`); if(d.encoding!=="base64")throw new Error("Unsupported GitHub blob encoding."); files.push({path:blob.path,content:Buffer.from(d.content.replace(/\n/g,""),"base64").toString("utf8")});}
   return{sha:ref.object.sha,files};
 },
 async createBranch(repo,branch,sha){const d=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/refs`,{method:"POST",body:JSON.stringify({ref:`refs/heads/${branch}`,sha})});return{name:branch,sha:d.object.sha,protected:false};},
 async createCommit(repo,branch,message,files,expectedParentSha,deletePaths=[]){
   if(files.length>2000)throw new Error("Workspace exceeds the safe GitHub push file limit (2000).");
   const current=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/ref/heads/${branchPart(branch)}`); const base=current.object.sha;
   if(expectedParentSha && expectedParentSha!==base)throw new Error(`REMOTE_DIVERGED: remote ${branch} is at ${base.slice(0,8)}, expected ${expectedParentSha.slice(0,8)}. Fetch/reconcile before pushing.`);
   const treeBase=(await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/commits/${base}`)).tree.sha;
   const tree=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:treeBase,tree:[...files.map(f=>({path:f.path,mode:"100644",type:"blob",content:f.content})),...deletePaths.map(path=>({path,mode:"100644",type:"blob",sha:null}))]})});
   const commit=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/commits`,{method:"POST",body:JSON.stringify({message,tree:tree.sha,parents:[base]})});
   await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/git/refs/heads/${branchPart(branch)}`,{method:"PATCH",body:JSON.stringify({sha:commit.sha,force:false})}); return{sha:commit.sha,message:commit.message,url:commit.html_url};
 },
 async createPullRequest(repo,head,base,title,body){const d=await request(`/repos/${pathPart(repo.owner)}/${pathPart(repo.name)}/pulls`,{method:"POST",body:JSON.stringify({head,base,title,body})});return{number:d.number,title:d.title,state:d.state,url:d.html_url,head:d.head.ref,base:d.base.ref};}
};}


