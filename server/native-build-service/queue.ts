
import crypto from "node:crypto";
import { DurableBuildStore, type DurableJob } from "./durable-store";
import { nativeWorkerRequest } from "../native-worker/contract";
import { runNativeBuild } from "../native-worker/runner";
import { runDockerNativeBuild } from "./docker-executor";
import { loadSigningProfileFromEnvironment } from "./signing";
import { LocalArtifactStore } from "./artifact-store";
import { WorkerRegistry } from "./worker-registry";

export class BuildQueue {
  get durable(){ return this.store.configured; }
  readonly workerId = `${process.env.HOSTNAME || "worker"}-${crypto.randomUUID()}`;
  private timer?: ReturnType<typeof setInterval>; private workerTimer?: ReturnType<typeof setInterval>; private stopped=false;
  private readonly registry: WorkerRegistry;
  private readonly controllers = new Map<string, AbortController>();
  constructor(private readonly store=new DurableBuildStore(), private readonly artifactStore=new LocalArtifactStore(), private readonly concurrency=Math.min(8,Math.max(1,Number(process.env.BUILD_WORKER_CONCURRENCY||1))), private readonly leaseMs=Math.min(15*60_000,Math.max(30_000,Number(process.env.BUILD_WORKER_LEASE_MS||120000)))){ this.registry = new WorkerRegistry(this.store, this.leaseMs); }
  async start(){ if(this.store.configured){await this.store.ensure(); await this.registry.start(); await this.store.recoverExpired(); this.timer=setInterval(()=>void this.pump(),1000); this.workerTimer=setInterval(()=>void this.registry.heartbeat(this.controllers.size ? "busy" : "ready"), Math.max(5000, Math.floor(this.leaseMs/3))); void this.pump();} }
  async enqueue(request: unknown){ const parsed=nativeWorkerRequest.parse(request), id=crypto.randomUUID(), now=Date.now(); const job:DurableJob={id,status:"queued",requestJson:JSON.stringify(parsed),logs:"Build queued.",createdAt:now,updatedAt:now,attempts:0}; await this.store.create(job); if(this.store.configured) void this.pump(); return job; }
  async get(id:string){return this.store.get(id)}
  async cancel(id:string){const controller=this.controllers.get(id); if(controller) controller.abort(); return this.store.cancel(id)}
  async stop(){this.stopped=true;if(this.timer)clearInterval(this.timer);if(this.workerTimer)clearInterval(this.workerTimer);for(const c of this.controllers.values())c.abort();await this.registry.stop()}
  async workers(){return this.registry.list()}
  private async pump(){if(this.stopped)return; for(let i=0;i<this.concurrency;i++){const job=await this.store.claim(this.workerId,this.leaseMs);if(job)void this.execute(job)}}
  private async execute(job:DurableJob){let heartbeat:ReturnType<typeof setInterval>|undefined; const controller=new AbortController(); this.controllers.set(job.id,controller); try{const request=nativeWorkerRequest.parse(JSON.parse(job.requestJson)); if (!(await this.store.update(job.id,{status:"running"}, job.executionToken))) throw new Error("Build execution fence lost before start."); heartbeat=setInterval(()=>void this.store.heartbeat(job.id,this.workerId,this.leaseMs,job.executionToken!),Math.max(5000,Math.floor(this.leaseMs/3))); const root=process.env.NATIVE_WORKSPACE_ROOT||".native-build-workspaces"; const useDocker = process.env.NATIVE_BUILD_EXECUTION_MODE === "docker" || (process.env.NATIVE_BUILD_EXECUTION_MODE !== "local" && Boolean(process.env.NATIVE_BUILDER_IMAGE));
      let result;
      if (useDocker) {
        const profile = request.signingProfileId ? loadSigningProfileFromEnvironment(request.signingProfileId) : null;
        const signingSecrets = profile ? {
          [`ANDROID_SIGNING_${profile.profileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_STORE_BASE64`]: profile.storeFileBase64,
          [`ANDROID_SIGNING_${profile.profileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_STORE_PASSWORD`]: profile.storePassword,
          [`ANDROID_SIGNING_${profile.profileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_KEY_ALIAS`]: profile.keyAlias,
          [`ANDROID_SIGNING_${profile.profileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_KEY_PASSWORD`]: profile.keyPassword,
        } : undefined;
        result = await runDockerNativeBuild(request, job.id, root, signingSecrets, undefined, controller.signal);
      } else {
        result = await runNativeBuild(request,root, async (artifactPath,fileName,jobId)=> this.artifactStore.put(jobId,artifactPath,fileName), () => controller.signal.aborted, controller.signal);
      } const latest=await this.store.get(job.id); if(latest?.status==="cancelled")return; if (result.status === "cancelled") { await this.store.cancel(job.id); } else { const resultView = result as { status: string; logs?: string; error?: string; artifact?: unknown }; await this.store.update(job.id,{status:result.status as DurableJob["status"],logs:resultView.logs,error:resultView.error}, job.executionToken); if(result.status === "passed" && result.artifact) await this.store.saveArtifact(job.id,result.artifact, job.executionToken); } }catch(e){
      const latest = await this.store.get(job.id);
      if (latest?.status === "cancelled" || controller.signal.aborted || (e instanceof Error && /cancelled/i.test(e.message))) {
        await this.store.update(job.id,{status:"cancelled",error:"Build cancelled."}, job.executionToken);
      } else {
        await this.store.update(job.id,{status:"failed",error:e instanceof Error?e.message:"Native build failed"}, job.executionToken);
      }
    }finally{if(heartbeat)clearInterval(heartbeat); this.controllers.delete(job.id)}}
}
