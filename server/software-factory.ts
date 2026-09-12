
import { invokeLLM } from "./_core/llm";

export type FactoryRole = "product" | "architect" | "uiux" | "qa" | "security" | "release";
export type FactoryReport = { role: FactoryRole; summary: string; findings: string[]; actions: string[]; risks: string[] };

const roleInstructions: Record<FactoryRole, string> = {
  product: "Act as a product analyst. Check requirements, acceptance criteria, missing edge cases, and scope drift for a real Expo React Native mobile app.",
  architect: "Act as a senior mobile architect. Check architecture, module boundaries, state/data flow, API contracts, persistence, scalability, and maintainability.",
  uiux: "Act as a senior mobile UI/UX engineer. Check navigation, usability, accessibility, responsive tablet behavior, loading/empty/error states, and consistency.",
  qa: "Act as a QA lead. Derive concrete test scenarios, regression risks, failure paths, and acceptance checks from the workspace and previous findings.",
  security: "Act as an application security engineer. Identify realistic vulnerabilities involving secrets, auth, input handling, generated code, network calls, storage, and unsafe execution.",
  release: "Act as a release engineer. Check build/test/security/preview/deployment readiness and identify any evidence that is missing before production release.",
};

function text(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((x) => typeof x === "string" ? x : typeof x === "object" && x && "text" in x ? String((x as any).text) : "").join("\n");
  return "";
}
function parse(value: string): FactoryReport {
  const clean = value.trim();
  try { return JSON.parse(clean) as FactoryReport; } catch {
    const a = clean.indexOf("{"); const b = clean.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(clean.slice(a, b + 1)) as FactoryReport;
    throw new Error("Factory agent returned invalid JSON");
  }
}

export async function runSoftwareFactory(input: { instruction: string; plan: unknown; files: Array<{path:string; content:string}> }): Promise<FactoryReport[]> {
  const workspace = input.files.slice(0, 80).map((f) => `FILE: ${f.path}\n${f.content.slice(0, 12000)}`).join("\n\n---\n\n");
  const reports: FactoryReport[] = [];
  for (const role of Object.keys(roleInstructions) as FactoryRole[]) {
    const previous = reports.map((r) => `${r.role}: ${r.summary}\nFindings: ${r.findings.join(" | ")}`).join("\n");
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: `${roleInstructions[role]} You are one controlled agent in MINHAS AI Software Factory. Do not modify files. Do not claim tests or integrations ran unless evidence is supplied. Return JSON only: {role,summary,findings:string[],actions:string[],risks:string[]}. Keep findings concrete and actionable. Never invent credentials or provider success.` },
        { role: "user", content: JSON.stringify({ task: input.instruction, approvedPlan: input.plan, previousAgents: previous, workspace }) },
      ],
      response_format: { type: "json_object" },
      reasoning: { effort: "medium" },
    });
    const report = parse(text(response.choices?.[0]?.message?.content));
    report.role = role;
    report.findings = Array.isArray(report.findings) ? report.findings.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    report.actions = Array.isArray(report.actions) ? report.actions.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    report.risks = Array.isArray(report.risks) ? report.risks.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
    reports.push(report);
  }
  return reports;
}


