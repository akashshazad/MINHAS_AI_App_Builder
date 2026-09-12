
import { describe, expect, it } from "vitest";
import { auditProject } from "./feature-audit";

describe("feature audit", () => {
  it("marks missing external infrastructure as blocked instead of live", () => {
    const audit = auditProject({ project: { status: "workspace_ready", planJson: "{}", buildStatus: "not_configured", previewUrl: null, deployStatus: "planned" }, filePaths: ["package.json", "README.md"], snapshotCount: 1, reviewCount: 1, exportCount: 0, graphNodeCount: 3 });
    expect(audit.items.find((item) => item.key === "build")?.state).toBe("BLOCKED");
    expect(audit.items.find((item) => item.key === "preview")?.state).toBe("BLOCKED");
    expect(audit.items.find((item) => item.key === "deployment")?.state).toBe("BLOCKED");
  });

  it("reports the persisted foundation as live when evidence exists", () => {
    const audit = auditProject({ project: { status: "workspace_ready", planJson: "{plan:true}", buildStatus: "not_configured", previewUrl: null, deployStatus: "planned" }, filePaths: ["package.json", "README.md", "src/App.tsx"], snapshotCount: 2, reviewCount: 1, exportCount: 1, graphNodeCount: 4 });
    expect(audit.items.filter((item) => item.state === "LIVE").map((item) => item.key)).toEqual(expect.arrayContaining(["planning", "workspace", "validation", "snapshots", "ai-review", "graph"]));
  });
});


