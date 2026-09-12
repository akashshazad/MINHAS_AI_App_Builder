
import JSZip from "jszip";
import type { ProjectFile } from "../drizzle/schema";
import { storagePut, storageGetSignedUrl } from "./storage";

export function safePath(path: string) {
  const normalized = path.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!normalized || normalized.split("/").some((segment) => segment === ".." || segment === ".")) throw new Error(`Unsafe export path: ${path}`);
  return normalized;
}

export async function createProjectZip(projectId: number, projectName: string, files: ProjectFile[]) {
  if (!files.length) throw new Error("Cannot export an empty workspace");
  const zip = new JSZip();
  for (const file of files) zip.file(safePath(file.path), file.content);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fileName = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `project-${projectId}`}.zip`;
  const stored = await storagePut(`exports/${projectId}/${fileName}`, buffer, "application/zip");
  const signedUrl = await storageGetSignedUrl(stored.key);
  return { ...stored, signedUrl, fileName, size: buffer.length };
}


