
import { invokeLLM, listLLMModels } from "./_core/llm";
import type { GeneratedFile, ProjectPlan, ProjectType, SourceLanguage } from "../shared/types";

function textFromMessage(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : typeof item === "object" && item && "text" in item ? String((item as any).text) : ""))
      .join("\n");
  }
  return "";
}

function parseJson<T>(value: string): T {
  const trimmed = value.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("AI returned invalid JSON");
  }
}

async function pickModel(preferred: string) {
  try {
    const { data } = await listLLMModels();
    return data.find((model) => model.id === preferred)?.id ?? data.find((model) => model.id.startsWith("gpt-5"))?.id ?? data[0]?.id;
  } catch {
    return undefined;
  }
}

function modelThinking(model: string | undefined) {
  if (model?.startsWith("claude-")) return { thinking: { type: "enabled" as const, budget_tokens: 1024 } };
  if (model?.startsWith("gpt-")) return { reasoning: { effort: "low" as const } };
  return {};
}

function normalizePlan(raw: Partial<ProjectPlan>, idea: string, type: ProjectType): ProjectPlan {
  const array = (value: unknown, fallback: string[]) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : fallback;
  return {
    projectName: String(raw.projectName || "MINHAS AI Project").slice(0, 160),
    type: "mobile_app",
    framework: "Expo + React Native + TypeScript",
    summary: String(raw.summary || idea).slice(0, 1000),
    requirements: array(raw.requirements, [idea]),
    pages: array(raw.pages, ["Home"]),
    components: array(raw.components, ["App shell"]),
    database: array(raw.database, []),
    apis: array(raw.apis, []),
    authenticationRequired: Boolean(raw.authenticationRequired),
    businessRules: array(raw.businessRules, []),
    testingStrategy: array(raw.testingStrategy, ["Run typecheck and production build before deployment"]),
    implementationNotes: array(raw.implementationNotes, ["Review the generated workspace before deploying"]),
  };
}

export function detectSourceLanguage(idea: string): SourceLanguage {
  if (/[^\u0000-\u007f]/.test(idea)) return "urdu";
  if (/\b(banao|banado|chahiye|ke liye|kar do|karo|mein|hai|ka|ki|aur)\b/i.test(idea)) return "roman_urdu";
  return "english";
}

export async function generatePlan(idea: string, type: ProjectType): Promise<ProjectPlan> {
  const model = await pickModel("gpt-5-mini");
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: "You are the MINHAS AI mobile-app planning agent. The only supported target is a real mobile application using Expo + React Native + TypeScript for Android/iOS. Return JSON only with projectName, type, framework, summary, requirements, pages, components, database, apis, authenticationRequired, businessRules, testingStrategy, and implementationNotes. Force type=mobile_app and framework=Expo + React Native + TypeScript. Do not plan websites, PWAs, desktop apps, slides, games, image generation, or research products. Never claim code, deployment, payments, realtime, or integrations already exist unless actually available; keep the plan actionable and implementation-ready.",
      },
      { role: "user", content: `Target project type: mobile_app\nFramework: Expo + React Native + TypeScript\nUser idea:\n${idea}` },
    ],
    response_format: { type: "json_object" },
    ...modelThinking(model),
  });
  const content = textFromMessage(response.choices?.[0]?.message?.content);
  return normalizePlan(parseJson<Partial<ProjectPlan>>(content), idea, type);
}

export async function generateStarterFiles(plan: ProjectPlan): Promise<GeneratedFile[]> {
  const model = await pickModel("claude-sonnet-4-6");
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: "You are the MINHAS AI coding agent. Generate a coherent starter workspace for an Expo + React Native + TypeScript mobile app. Return JSON only in the form {\"files\":[{\"path\":\"...\",\"language\":\"...\",\"content\":\"...\",\"isCritical\":true|false}]}. The generated workspace MUST be compatible with Expo Router: include package.json, app.json or app.config.ts, app/_layout.tsx, app/index.tsx, README.md, and .env.example. Use real implementation code. Do not invent backend endpoints, secrets, payments, authentication, or external integrations. If the plan requires backend behavior, create an explicit typed client/service boundary and document the required environment variables without embedding secrets. Never create src/main.tsx or a second competing application entry point. Never include secrets. Keep output concise enough for the workspace viewer.",
      },
      { role: "user", content: JSON.stringify(plan) },
    ],
    response_format: { type: "json_object" },
    ...modelThinking(model),
  });
  const content = textFromMessage(response.choices?.[0]?.message?.content);
  const raw = parseJson<{ files?: GeneratedFile[] }>(content);
  const files = Array.isArray(raw.files) ? raw.files : [];
  return files
    .filter((file) => file && typeof file.path === "string" && typeof file.content === "string")
    .slice(0, 24)
    .map((file) => ({ path: file.path, language: typeof file.language === "string" ? file.language : "text", content: file.content, isCritical: Boolean(file.isCritical) }));
}


