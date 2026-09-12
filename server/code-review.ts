
import { invokeLLM } from "./_core/llm";
import type { ProjectFile } from "../drizzle/schema";

export type ReviewFinding = { path: string; line?: number; severity: "critical" | "warning" | "info"; message: string; suggestion?: string };
export type ReviewResult = { summary: string; findings: ReviewFinding[]; patches?: Array<{ path: string; content: string }> };

function contentText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" && item && "text" in item ? String((item as any).text) : "").join("\n");
  return "";
}
function parseJson<T>(value: string): T {
  const clean = value.trim();
  try { return JSON.parse(clean) as T; } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1)) as T;
    throw new Error("AI review returned invalid JSON");
  }
}
function boundedFiles(files: ProjectFile[]) {
  let budget = 80000;
  return files.map((file) => {
    const content = file.content.slice(0, Math.min(file.content.length, 16000, budget));
    budget -= content.length;
    return { path: file.path, language: file.language, content };
  }).filter((file) => file.content.length > 0);
}

export async function reviewProjectFiles(files: ProjectFile[], mode: "review" | "fix"): Promise<ReviewResult> {
  const payload = boundedFiles(files);
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: mode === "fix"
          ? "You are a cautious code review agent. Analyze the supplied generated project files and return JSON only: {summary:string, findings:[{path,line,severity,message,suggestion}], patches:[{path,content}]}. Apply at most one minimal safe fix pass. Only include complete replacement content for existing files, never new files, never secrets, never shell commands, and never more than 3 patches. If uncertain, return no patches and explain why. Check for obvious TypeScript/React errors, unsafe path handling, missing environment contracts, and broken imports."
          : "You are a code review agent. Return JSON only: {summary:string, findings:[{path,line,severity,message,suggestion}]}. Review the supplied project files for obvious TypeScript/React errors, unsafe path handling, missing environment contracts, broken imports, and build blockers. Do not claim to have executed the code.",
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
    response_format: { type: "json_object" },
  });
  const raw = parseJson<Partial<ReviewResult>>(contentText(response.choices?.[0]?.message?.content));
  const findings = Array.isArray(raw.findings) ? raw.findings.filter((item): item is ReviewFinding => Boolean(item && typeof item.path === "string" && typeof item.message === "string" && ["critical", "warning", "info"].includes(item.severity))) : [];
  const patches = mode === "fix" && Array.isArray(raw.patches)
    ? raw.patches.filter((patch) => patch && typeof patch.path === "string" && typeof patch.content === "string").slice(0, 3).map((patch) => ({ path: patch.path, content: patch.content.slice(0, 200000) }))
    : undefined;
  return { summary: String(raw.summary || (findings.length ? "Review found items that need attention." : "No obvious issues found in the reviewed files.")), findings, patches };
}


