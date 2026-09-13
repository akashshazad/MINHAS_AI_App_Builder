import { randomUUID } from "node:crypto";
import { z } from "zod";
import { invokeLLM, listLLMModels, type InvokeResult, type ResponseFormat } from "./_core/llm";
import type { GeneratedFile, ProjectPlan, ProjectType, SourceLanguage } from "../shared/types";

const stringArray = z.array(z.string().trim().min(1)).max(128);
export const projectPlanResponseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  action: z.literal("create_project"),
  project: z.object({
    projectName: z.string().trim().min(1).max(160),
    type: z.literal("mobile_app"),
    framework: z.literal("Expo + React Native + TypeScript"),
    summary: z.string().trim().min(1).max(1000),
    requirements: stringArray,
    pages: stringArray,
    components: stringArray,
    database: stringArray,
    apis: stringArray,
    authenticationRequired: z.boolean(),
    businessRules: stringArray,
    testingStrategy: stringArray,
    implementationNotes: stringArray,
  }),
}).strict();

const generatedFileSchema = z.object({
  path: z.string().trim().min(1).max(320),
  language: z.string().trim().min(1).max(40),
  content: z.string().max(200000),
  isCritical: z.boolean(),
}).strict();
export const generatedFilesResponseSchema = z.object({
  schemaVersion: z.literal("1.0"),
  action: z.literal("generate_files"),
  files: z.array(generatedFileSchema).max(24),
}).strict();

type StructuredFailure = { requestId: string; message: string };

function textFromMessage(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => typeof item === "string" ? item : typeof item === "object" && item && "text" in item ? String((item as { text?: unknown }).text ?? "") : "").join("\n");
  }
  return "";
}

export function extractJsonCandidate(value: string): string {
  const withoutFence = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No complete structured object found");
  return withoutFence.slice(start, end + 1);
}

export function parseStructured<T>(value: string, schema: z.ZodType<T>): T {
  const candidate = extractJsonCandidate(value);
  return schema.parse(JSON.parse(candidate));
}

function structuredResponse(format: ResponseFormat): ResponseFormat { return format; }

function modelThinking(model: string | undefined) {
  if (model?.startsWith("claude-")) return { thinking: { type: "enabled" as const, budget_tokens: 1024 } };
  if (model?.startsWith("gpt-")) return { reasoning: { effort: "low" as const } };
  return {};
}

async function pickModel(preferred: string) {
  try {
    const { data } = await listLLMModels();
    return data.find((model) => model.id === preferred)?.id ?? data.find((model) => model.id.startsWith("gpt-5"))?.id ?? data[0]?.id;
  } catch {
    return undefined;
  }
}

function responseText(response: InvokeResult) {
  return textFromMessage(response.choices?.[0]?.message?.content);
}

async function invokeWithRecovery<T>(options: {
  schema: z.ZodType<T>;
  format: ResponseFormat;
  initial: () => Promise<InvokeResult>;
  repair: (invalid: string) => Promise<InvokeResult>;
  retry: () => Promise<InvokeResult>;
}): Promise<T> {
  const requestId = randomUUID();
  let invalid = "";
  let first = "";
  try {
    first = responseText(await options.initial());
    return parseStructured(first, options.schema);
  } catch {
    try {
      invalid = first;
      const repaired = responseText(await options.repair(invalid.slice(0, 12000)));
      return parseStructured(repaired, options.schema);
    } catch {
      try {
        return parseStructured(responseText(await options.retry()), options.schema);
      } catch {
        const failure: StructuredFailure = { requestId, message: "AI structured output failed validation." };
        throw new Error(`${failure.message} Request ID: ${failure.requestId}`);
      }
    }
  }
}

export function detectSourceLanguage(idea: string): SourceLanguage {
  if (/[^\u0000-\u007f]/.test(idea)) return "urdu";
  if (/\b(banao|banado|chahiye|ke liye|kar do|karo|mein|hai|ka|ki|aur)\b/i.test(idea)) return "roman_urdu";
  return "english";
}

export type PlanningAttachment = { name: string; mimeType: string; url: string; textContent?: string };

export function splitPromptIntoChunks(value: string, chunkSize = 16_000): string[] {
  if (!value) return [""];
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += chunkSize) chunks.push(value.slice(offset, offset + chunkSize));
  return chunks;
}

const planFormat = structuredResponse({
  type: "json_schema",
  json_schema: {
    name: "minhas_project_plan_v1",
    strict: true,
    schema: {
      type: "object", additionalProperties: false,
      required: ["schemaVersion", "action", "project"],
      properties: {
        schemaVersion: { type: "string", enum: ["1.0"] },
        action: { type: "string", enum: ["create_project"] },
        project: { type: "object", additionalProperties: false, required: ["projectName", "type", "framework", "summary", "requirements", "pages", "components", "database", "apis", "authenticationRequired", "businessRules", "testingStrategy", "implementationNotes"], properties: {
          projectName: { type: "string" }, type: { type: "string", enum: ["mobile_app"] }, framework: { type: "string", enum: ["Expo + React Native + TypeScript"] }, summary: { type: "string" },
          requirements: { type: "array", items: { type: "string" } }, pages: { type: "array", items: { type: "string" } }, components: { type: "array", items: { type: "string" } }, database: { type: "array", items: { type: "string" } }, apis: { type: "array", items: { type: "string" } }, authenticationRequired: { type: "boolean" }, businessRules: { type: "array", items: { type: "string" } }, testingStrategy: { type: "array", items: { type: "string" } }, implementationNotes: { type: "array", items: { type: "string" } },
        } },
      },
    },
  },
});

const filesFormat = structuredResponse({
  type: "json_schema", json_schema: { name: "minhas_generated_files_v1", strict: true, schema: {
    type: "object", additionalProperties: false, required: ["schemaVersion", "action", "files"], properties: {
      schemaVersion: { type: "string", enum: ["1.0"] }, action: { type: "string", enum: ["generate_files"] }, files: { type: "array", maxItems: 24, items: { type: "object", additionalProperties: false, required: ["path", "language", "content", "isCritical"], properties: { path: { type: "string" }, language: { type: "string" }, content: { type: "string" }, isCritical: { type: "boolean" } } } },
    },
  } },
});

function normalizePlan(raw: z.infer<typeof projectPlanResponseSchema>["project"], idea: string, type: ProjectType): ProjectPlan {
  return { ...raw, type: type === "mobile_app" ? "mobile_app" : "mobile_app", summary: raw.summary || idea };
}

export async function generatePlan(idea: string, type: ProjectType, attachments: PlanningAttachment[] = []): Promise<ProjectPlan> {
  const model = await pickModel("gpt-5-mini");
  const attachmentText = attachments.filter((attachment) => attachment.textContent).map((attachment) => `\n\n[Attachment: ${attachment.name}]\n${attachment.textContent}`).join("");
  const promptBody = `Target project type: mobile_app\nFramework: Expo + React Native + TypeScript\nUser idea (preserve every requirement):\n${idea}${attachmentText}`;
  const promptChunks = splitPromptIntoChunks(promptBody);
  const userContent: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "auto" } }> = [...promptChunks.map((text, index) => ({ type: "text" as const, text: `[Prompt chunk ${index + 1}/${promptChunks.length}]\n${text}` })), ...attachments.filter((attachment) => attachment.mimeType.startsWith("image/")).map((attachment) => ({ type: "image_url" as const, image_url: { url: attachment.url, detail: "auto" as const } }))];
  const baseMessages = [
    { role: "system" as const, content: "You are the MINHAS AI mobile-app planning agent. Convert the user's natural-language request in Urdu, Roman Urdu, English, or mixed language into the exact versioned structured project plan. Never output markdown, code fences, unknown fields, or claims that are not supported. Include concrete requirements for every requested feature." },
    { role: "user" as const, content: userContent },
  ];
  const result = await invokeWithRecovery({
    schema: projectPlanResponseSchema,
    format: planFormat,
    initial: () => invokeLLM({ model, messages: baseMessages, response_format: planFormat, ...modelThinking(model) }),
    repair: (invalid) => invokeLLM({ model, messages: [{ role: "system", content: `Repair this failed output into the exact required structured project plan. Return only the schema-valid object. Failed output:\n${invalid}` }, ...baseMessages], response_format: planFormat, ...modelThinking(model) }),
    retry: () => invokeLLM({ model, messages: [...baseMessages, { role: "user", content: "Retry strictly. Return only the required schema-valid object; no markdown or prose." }], response_format: planFormat, ...modelThinking(model) }),
  });
  return normalizePlan(result.project, idea, type);
}

export async function generateStarterFiles(plan: ProjectPlan): Promise<GeneratedFile[]> {
  const model = await pickModel("claude-sonnet-4-6");
  const baseMessages = [
    { role: "system" as const, content: "You are the MINHAS AI coding agent. Generate real Expo + React Native + TypeScript starter files for the supplied plan. Return only the exact versioned structured response. Never include secrets, invented endpoints, markdown, or unknown fields." },
    { role: "user" as const, content: JSON.stringify(plan) },
  ];
  const result = await invokeWithRecovery({
    schema: generatedFilesResponseSchema,
    format: filesFormat,
    initial: () => invokeLLM({ model, messages: baseMessages, response_format: filesFormat, ...modelThinking(model) }),
    repair: (invalid) => invokeLLM({ model, messages: [{ role: "system", content: `Repair the failed output into the exact required versioned files schema. Return only a schema-valid object. Failed output:\n${invalid}` }, ...baseMessages], response_format: filesFormat, ...modelThinking(model) }),
    retry: () => invokeLLM({ model, messages: [...baseMessages, { role: "user", content: "Retry strictly with only the required schema-valid files object." }], response_format: filesFormat, ...modelThinking(model) }),
  });
  return result.files;
}
