
import * as db from "./db";

export async function snapshotProject(projectId: number, label: string, reason: string, planJson: string, files: Array<{ path: string; language: string; content: string; isCritical?: boolean; version?: number }>) {
  return db.createSnapshot({
    projectId,
    label,
    reason,
    planJson,
    filesJson: JSON.stringify(files.map((file) => ({ path: file.path, language: file.language, content: file.content, isCritical: Boolean(file.isCritical), version: file.version ?? 1 }))),
  });
}


