
import { createHash } from "node:crypto";

type FileLike = { path: string; content: string };
type Change = { path: string; status: "added" | "modified" | "deleted"; beforeHash?: string; afterHash?: string; additions: number; deletions: number };

export function contentHash(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function lineDelta(before: string, after: string) {
  const a = before ? before.split(/\r?\n/) : [];
  const b = after ? after.split(/\r?\n/) : [];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1;
  return { additions: Math.max(0, b.length - prefix - suffix), deletions: Math.max(0, a.length - prefix - suffix) };
}

export function diffFiles(before: FileLike[], after: FileLike[]): Change[] {
  const oldMap = new Map(before.map((file) => [file.path, file]));
  const newMap = new Map(after.map((file) => [file.path, file]));
  const paths = [...new Set([...oldMap.keys(), ...newMap.keys()])].sort();
  const changes: Change[] = [];
  for (const path of paths) {
    const oldFile = oldMap.get(path);
    const newFile = newMap.get(path);
    if (!oldFile && newFile) {
      changes.push({ path, status: "added", afterHash: contentHash(newFile.content), ...lineDelta("", newFile.content) });
    } else if (oldFile && !newFile) {
      changes.push({ path, status: "deleted", beforeHash: contentHash(oldFile.content), ...lineDelta(oldFile.content, "") });
    } else if (oldFile && newFile && oldFile.content !== newFile.content) {
      changes.push({ path, status: "modified", beforeHash: contentHash(oldFile.content), afterHash: contentHash(newFile.content), ...lineDelta(oldFile.content, newFile.content) });
    }
  }
  return changes;
}

export function summarizeVersion(before: FileLike[], after: FileLike[]) {
  const changes = diffFiles(before, after);
  return { changes, filesChanged: changes.length, additions: changes.reduce((total, change) => total + change.additions, 0), deletions: changes.reduce((total, change) => total + change.deletions, 0) };
}


