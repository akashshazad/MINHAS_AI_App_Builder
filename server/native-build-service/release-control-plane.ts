
import crypto from "node:crypto";
import mysql from "mysql2/promise";

export type ReleaseState = "draft" | "queued" | "building" | "verified" | "blocked" | "published" | "rolled-back";
export type ReleaseManifest = {
  releaseId: string; projectId: number; projectName: string; engine: "native"; buildType: string;
  requestSha256: string; workerId?: string; buildJobId?: string; artifactSha256?: string; artifactBytes?: number;
  createdAt: string; verifiedAt?: string; version?: string;
};

export interface ReleaseRecord { id: string; state: ReleaseState; manifest: ReleaseManifest; gates: Record<string, "PASS" | "BLOCKED">; createdAt: number; updatedAt: number; }

const TRANSITIONS: Record<ReleaseState, readonly ReleaseState[]> = {
  draft: ["queued", "blocked"],
  queued: ["building", "blocked", "rolled-back"],
  building: ["verified", "blocked", "rolled-back"],
  verified: ["published", "blocked", "rolled-back"],
  blocked: ["queued", "rolled-back"],
  published: ["rolled-back"],
  "rolled-back": [],
};

export function canTransition(from: ReleaseState, to: ReleaseState) { return from === to || TRANSITIONS[from].includes(to); }
export function assertTransition(from: ReleaseState, to: ReleaseState) { if (!canTransition(from, to)) throw new Error(`Invalid release transition: ${from} -> ${to}`); }
const REQUIRED_GATES = ["manifest", "build", "artifact", "archive", "security"] as const;
export function canPublish(record: ReleaseRecord) {
  return record.state === "verified"
    && REQUIRED_GATES.every(key => record.gates[key] === "PASS")
    && Boolean(record.manifest.artifactSha256)
    && /^[a-f0-9]{64}$/.test(record.manifest.artifactSha256 ?? "")
    && Number.isSafeInteger(record.manifest.artifactBytes)
    && Number(record.manifest.artifactBytes) > 0;
}

export class ReleaseControlPlane {
  private pool: mysql.Pool | null = null;
  private ready = false;
  constructor(private readonly url = process.env.BUILD_SERVICE_DATABASE_URL || process.env.DATABASE_URL) {}
  get configured(){ return Boolean(this.url); }
  private async db(){ if(!this.url) throw new Error("Release control database is not configured"); this.pool ??= mysql.createPool(this.url); return this.pool; }
  async ensure(){ if(this.ready || !this.url) return; const db=await this.db(); await db.execute(`CREATE TABLE IF NOT EXISTS nativeReleases (id varchar(64) primary key, state varchar(24) not null, manifestJson longtext not null, gatesJson longtext not null, createdAt bigint not null, updatedAt bigint not null, index idx_nativeReleases_state(state), index idx_nativeReleases_created(createdAt))`); await db.execute(`CREATE TABLE IF NOT EXISTS nativeBuildAuditEvents (id BIGINT AUTO_INCREMENT PRIMARY KEY, entityType VARCHAR(32) NOT NULL, entityId VARCHAR(128) NOT NULL, action VARCHAR(64) NOT NULL, actor VARCHAR(128) NOT NULL, metadataJson LONGTEXT NULL, createdAt BIGINT NOT NULL, INDEX idx_nativeBuildAudit_entity (entityType, entityId, createdAt))`); this.ready=true; }
  async create(input:{projectId:number;projectName:string;buildType:string;requestJson:string;version?:string;buildJobId?:string}){
    const now=Date.now(), id=crypto.randomUUID();
    const manifest:ReleaseManifest={releaseId:id,projectId:input.projectId,projectName:input.projectName,engine:"native",buildType:input.buildType,requestSha256:crypto.createHash("sha256").update(input.requestJson).digest("hex"),createdAt:new Date(now).toISOString(),version:input.version,buildJobId:input.buildJobId};
    const record:ReleaseRecord={id,state:input.buildJobId?"queued":"draft",manifest,gates:{manifest:"PASS"},createdAt:now,updatedAt:now};
    await this.ensure(); const db=await this.db(); await db.execute(`INSERT INTO nativeReleases (id,state,manifestJson,gatesJson,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,[id,record.state,JSON.stringify(manifest),JSON.stringify(record.gates),now,now]); return record;
  }
  async get(id:string){await this.ensure(); const db=await this.db();const [rows]=await db.execute(`SELECT * FROM nativeReleases WHERE id=? LIMIT 1`,[id]);const r=(rows as any[])[0];return r?this.map(r):null;}
  async update(id:string, patch:Partial<Pick<ReleaseRecord,"state"|"gates">> & {manifest?:Partial<ReleaseManifest>}){
    const current=await this.get(id); if(!current) return null;
    if (current.state === "published" || current.state === "rolled-back") throw new Error(`Release is terminal: ${current.state}`);
    if (patch.state) assertTransition(current.state, patch.state);
    const manifest={...current.manifest,...patch.manifest}; const gates={...current.gates,...patch.gates}; const state=patch.state||current.state;
    if (state === "verified" && !canPublish({ ...current, state, manifest, gates })) throw new Error("Release verification requires all required gates to PASS and valid artifact metadata.");
    const db=await this.db(); await db.execute(`UPDATE nativeReleases SET state=?,manifestJson=?,gatesJson=?,updatedAt=? WHERE id=? AND state NOT IN ('published','rolled-back')`,[state,JSON.stringify(manifest),JSON.stringify(gates),Date.now(),id]); return {...current,state,manifest,gates,updatedAt:Date.now()};
  }
  async publish(id:string){ const current=await this.get(id); if(!current) return null; if(!canPublish(current)) throw new Error("Release is not eligible for publication: verification gates, artifact metadata, and verified state are required."); return this.update(id,{state:"published"}); }
  async rollback(id:string){ const current=await this.get(id); if(!current) return null; if(current.state === "rolled-back") return current; assertTransition(current.state,"rolled-back"); return this.update(id,{state:"rolled-back"}); }
  async audit(id:string, action:string, actor:string, metadata?:unknown){ await this.ensure(); const db=await this.db(); await db.execute(`INSERT INTO nativeBuildAuditEvents (entityType,entityId,action,actor,metadataJson,createdAt) VALUES (?,?,?,?,?,?)`,["release",id,action,actor,metadata === undefined ? null : JSON.stringify(metadata),Date.now()]); }
  async auditTrail(id:string, limit=100){ await this.ensure(); const db=await this.db(); const bounded=Math.min(500,Math.max(1,Math.floor(limit))); const [rows]=await db.execute(`SELECT id,entityType,entityId,action,actor,metadataJson,createdAt FROM nativeBuildAuditEvents WHERE entityType=? AND entityId=? ORDER BY createdAt DESC, id DESC LIMIT ${bounded}`,["release",id]); return (rows as any[]).map((row)=>({...row,metadata:row.metadataJson ? JSON.parse(row.metadataJson) : undefined,createdAt:Number(row.createdAt)})); }
  async close(){await this.pool?.end();this.pool=null;this.ready=false;}
  private map(r:any):ReleaseRecord{return {id:r.id,state:r.state,manifest:JSON.parse(r.manifestJson),gates:JSON.parse(r.gatesJson),createdAt:Number(r.createdAt),updatedAt:Number(r.updatedAt)}}
}

export function createReleaseManifest(input:{projectId:number;projectName:string;buildType:string;requestJson:string;version?:string;buildJobId?:string}):ReleaseManifest{
 const releaseId=crypto.randomUUID(); return {releaseId,projectId:input.projectId,projectName:input.projectName,engine:"native",buildType:input.buildType,requestSha256:crypto.createHash("sha256").update(input.requestJson).digest("hex"),createdAt:new Date().toISOString(),version:input.version,buildJobId:input.buildJobId};
}
