
import { describe, expect, it } from "vitest";
import { AGENT_MANIFEST, PIPELINE_STEPS, staticSecurityFindings } from "./orchestrator";

describe("autonomous orchestrator", () => {
  it("keeps a finite, bounded pipeline and agent policy", () => {
    expect(PIPELINE_STEPS).toEqual(["requirements", "workspace", "graph", "build", "tests", "security", "preview", "deploy"]);
    expect(AGENT_MANIFEST.length).toBeGreaterThan(3);
    expect(AGENT_MANIFEST.every((agent) => agent.timeoutSeconds > 0 && agent.tokenBudget > 0 && agent.tools.length > 0)).toBe(true);
  });

  it("blocks critical dynamic code and hard-coded secret patterns", () => {
    const findings = staticSecurityFindings([
      { path: "src/a.ts", language: "typescript", content: "const run = eval(input);", isCritical: true, version: 1 } as any,
      { path: "src/b.ts", language: "typescript", content: "const key = 'sk-abcdefghijklmnopqrstuvwxyz';", isCritical: false, version: 1 } as any,
    ]);
    expect(findings.filter((finding) => finding.severity === "critical")).toHaveLength(2);
  });
});


