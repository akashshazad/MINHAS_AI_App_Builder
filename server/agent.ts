
import { invokeLLM } from "./_core/llm";
import type { ProjectPlan } from "../shared/types";

export type AgentPatch = { path: string; content: string };
export type AgentTaskResult = {
  summary: string;
  plan: string[];
  patches: AgentPatch[];
  warnings: string[];
  verification: string[];
};

function textFromMessage(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((item) => typeof item === "string" ? item : typeof item === "object" && item && "text" in item ? String((item as any).text) : "").join("\n");
  return "";
}

function parseJson<T>(value: string): T {
  const trimmed = value.trim();
  try { return JSON.parse(trimmed) as T; } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("AI returned invalid task JSON");
  }
}

const forbiddenPath = /(^|\/)(\.env(?:\.|$)|\.git|node_modules|credentials?|secrets?|id_rsa|\.npmrc$)/i;
const allowedPath = /\.(tsx?|jsx?|json|md|css|scss|sql|yml|yaml|xml|svg)$/i;

export async function executeCodingTask(input: {
  instruction: string;
  plan: ProjectPlan;
  files: Array<{ path: string; content: string; language: string }>;
}): Promise<AgentTaskResult> {
  const model = "gpt-5-mini";
  const fileContext = input.files.slice(0, 80).map((file) => `FILE: ${file.path}\n${file.content.slice(0, 18000)}`).join("\n\n---\n\n");
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: `You are the MINHAS AI Builder autonomous senior mobile engineer. Modify an existing Expo + React Native + TypeScript project from a natural-language task. Work only on the requested task. Preserve existing behavior unless the task explicitly changes it. Never invent successful integrations. Never add secrets. Never return files outside the supplied workspace. Return JSON only: {summary:string,plan:string[],patches:[{path:string,content:string}],warnings:string[],verification:string[]}. Patches must contain COMPLETE replacement file contents, not diffs. Maximum 6 patches. Prefer the smallest safe set of changes. Do not modify package.json unless absolutely necessary. Do not create binary/media files. Do not create .env files. If the task cannot be safely implemented with the supplied context, return zero patches and explain why.`,
      },
      {
        role: "user",
        content: JSON.stringify({ task: input.instruction, approvedPlan: input.plan, workspace: fileContext }),
      },
    ],
    response_format: { type: "json_object" },
    reasoning: { effort: "medium" },
  });
  const parsed = parseJson<Partial<AgentTaskResult>>(textFromMessage(response.choices?.[0]?.message?.content));
  const known = new Map(input.files.map((file) => [file.path, file.content]));
  const patches = Array.isArray(parsed.patches) ? parsed.patches : [];
  const safePatches: AgentPatch[] = [];
  for (const patch of patches.slice(0, 6)) {
    if (!patch || typeof patch.path !== "string" || typeof patch.content !== "string") continue;
    const normalized = patch.path.replaceAll("\\", "/").replace(/^\.\//, "");
    if (!known.has(normalized) || forbiddenPath.test(normalized) || !allowedPath.test(normalized)) continue;
    if (patch.content.length > 50000) continue;
    if (normalized.includes("package-lock.json") || normalized.includes("pnpm-lock.yaml") || normalized.includes("yarn.lock")) continue;
    safePatches.push({ path: normalized, content: patch.content });
  }
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((x): x is string => typeof x === "string").slice(0, 12) : [];
  if (safePatches.length !== patches.length) warnings.push("One or more AI patches were rejected by the workspace safety policy.");
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Task analyzed.",
    plan: Array.isArray(parsed.plan) ? parsed.plan.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
    patches: safePatches,
    warnings,
    verification: Array.isArray(parsed.verification) ? parsed.verification.filter((x): x is string => typeof x === "string").slice(0, 12) : ["Run validation, tests, and an isolated build before release."],
  };
}


