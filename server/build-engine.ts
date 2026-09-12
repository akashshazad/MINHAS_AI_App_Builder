
export const BUILD_ENGINES = ["native", "expo"] as const;
export type BuildEngine = typeof BUILD_ENGINES[number];
export type BuildEngineSelection = BuildEngine | "auto";

export function resolveBuildEngine(selection: BuildEngineSelection, framework: string, paths: string[]): BuildEngine {
  if (selection !== "auto") return selection;
  // Native is the primary engine. Expo remains a first-class optional engine.
  // Native workers may run Expo prebuild when an Expo project has no native folders.
  return "native";
}

export function buildEngineLabel(engine: BuildEngine) {
  return engine === "native" ? "MINHAS Native" : "Expo / EAS-compatible";
}

export function buildEngineDescription(engine: BuildEngine) {
  return engine === "native"
    ? "Primary path: React Native native projects, Gradle for Android and Xcode for iOS."
    : "Optional compatibility path for Expo projects and EAS-compatible workflows.";
}

export function isSupportedBuildEngine(value: string): value is BuildEngineSelection {
  return value === "auto" || value === "native" || value === "expo";
}


