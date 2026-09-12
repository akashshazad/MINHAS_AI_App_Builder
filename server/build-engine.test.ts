
import { describe, expect, it } from "vitest";
import { buildEngineDescription, buildEngineLabel, resolveBuildEngine } from "./build-engine";

describe("build engine strategy", () => {
  it("keeps Expo optional while making native the auto primary", () => {
    expect(resolveBuildEngine("auto", "Expo + React Native", ["package.json", "app/_layout.tsx"])).toBe("native");
    expect(resolveBuildEngine("expo", "Expo + React Native", [])).toBe("expo");
    expect(resolveBuildEngine("native", "Expo + React Native", [])).toBe("native");
  });
  it("exposes truthful engine labels", () => {
    expect(buildEngineLabel("native")).toContain("Native");
    expect(buildEngineLabel("expo")).toContain("Expo");
    expect(buildEngineDescription("native")).toContain("Gradle");
    expect(buildEngineDescription("expo")).toContain("EAS");
  });
});


