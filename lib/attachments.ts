import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type LocalAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uri: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  error?: string;
  textContent?: string;
  remoteUrl?: string;
};

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/markdown", "application/json", "text/javascript", "application/javascript", "text/typescript", "text/css", "application/sql", "text/xml", "application/xml", "text/yaml", "application/zip"]);
const TEXT_TYPES = new Set(["text/plain", "text/markdown", "application/json", "text/javascript", "application/javascript", "text/typescript", "text/css", "application/sql", "text/xml", "application/xml", "text/yaml"]);

function extensionMime(name: string) {
  const ext = name.toLowerCase().split(".").pop();
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf", txt: "text/plain", md: "text/markdown", json: "application/json", js: "application/javascript", jsx: "application/javascript", ts: "text/typescript", tsx: "text/typescript", css: "text/css", sql: "application/sql", xml: "application/xml", yaml: "text/yaml", yml: "text/yaml", zip: "application/zip" } as Record<string, string>)[ext ?? ""] ?? "application/octet-stream";
}

function validate(name: string, mimeType: string, size: number) {
  const resolved = ALLOWED.has(mimeType) ? mimeType : extensionMime(name);
  if (!ALLOWED.has(resolved)) throw new Error(`Unsupported attachment type: ${name}`);
  if (!Number.isFinite(size) || size <= 0) throw new Error(`Attachment is empty or unreadable: ${name}`);
  if (size > MAX_BYTES) throw new Error(`Attachment exceeds the 12 MB limit: ${name}`);
  return resolved;
}

async function toAttachment(asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }): Promise<LocalAttachment> {
  const name = asset.name || `attachment-${Date.now()}`;
  const info = asset.size ? null : await FileSystem.getInfoAsync(asset.uri);
  const size = asset.size || (info?.exists && "size" in info ? info.size : 0);
  const mimeType = validate(name, asset.mimeType || extensionMime(name), size);
  const textContent = TEXT_TYPES.has(mimeType) ? await FileSystem.readAsStringAsync(asset.uri).catch(() => undefined) : undefined;
  return { id: `${name}:${asset.uri}`, name, mimeType, size, uri: asset.uri, status: "ready", textContent };
}

export async function pickFromGallery(): Promise<LocalAttachment[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo library permission was denied.");
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 1 });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => toAttachment({ uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType, size: asset.fileSize })));
}

export async function captureFromCamera(): Promise<LocalAttachment[]> {
  if (Platform.OS === "web") throw new Error("Camera capture is unavailable in the web preview.");
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error("Camera permission was denied.");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => toAttachment({ uri: asset.uri, name: asset.fileName || `camera-${Date.now()}.jpg`, mimeType: asset.mimeType || "image/jpeg", size: asset.fileSize })));
}

export async function pickFiles(): Promise<LocalAttachment[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["image/*", "application/pdf", "text/*", "application/json", "application/zip"], multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return Promise.all(result.assets.map((asset) => toAttachment({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size })));
}

export async function readBase64(uri: string) {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
