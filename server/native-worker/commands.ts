
import fs from "node:fs/promises";
import path from "node:path";

export type NativeBuildPlan = {
  commands: string[][];
  artifactType: "apk" | "aab";
  artifactRelativePath: string;
};

async function exists(file: string) {
  try { await fs.access(file); return true; } catch { return false; }
}

export async function createNativeBuildPlan(root: string, buildType: "android-debug" | "android-release" | "aab" | "test", signingArgs: string[] = []): Promise<NativeBuildPlan> {
  const hasAndroid = await exists(path.join(root, "android"));
  const hasExpo = await exists(path.join(root, "app.json")) || await exists(path.join(root, "app.config.js")) || await exists(path.join(root, "app.config.ts"));
  const commands: string[][] = [];

  if (!hasAndroid && hasExpo) {
    commands.push(["npx", "expo", "prebuild", "--non-interactive", "--clean"]);
  }
  if (!(await exists(path.join(root, "android")))) throw new Error("Native Android project is missing after Expo prebuild.");

  commands.push(["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"]);
  commands.push(["pnpm", "exec", "react-native", "config"]);

  if (buildType === "test") {
    commands.push(["pnpm", "test", "--", "--runInBand"]);
    return { commands, artifactType: "apk", artifactRelativePath: "android/app/build/outputs/apk/debug/app-debug.apk" };
  }

  const gradle = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  if (buildType === "android-debug") {
    commands.push([gradle, "assembleDebug"]);
    return { commands, artifactType: "apk", artifactRelativePath: "android/app/build/outputs/apk/debug/app-debug.apk" };
  }
  if (buildType === "aab") {
    commands.push([gradle, "bundleRelease", ...signingArgs]);
    return { commands, artifactType: "aab", artifactRelativePath: "android/app/build/outputs/bundle/release/app-release.aab" };
  }
  commands.push([gradle, "assembleRelease", ...signingArgs]);
  return { commands, artifactType: "apk", artifactRelativePath: "android/app/build/outputs/apk/release/app-release.apk" };
}


