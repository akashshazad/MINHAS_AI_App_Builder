import { generatePlan, generateStarterFiles } from "../server/ai";

async function main() {
  const idea = "ایک مکمل کریانہ POS بناؤ جس میں Sales، Inventory اور Khata ہوں۔";
  const plan = await generatePlan(idea, "mobile_app");
  if (plan.type !== "mobile_app" || !plan.projectName || !plan.requirements.length || !plan.pages.length) {
    throw new Error("AI runtime returned an incomplete validated plan.");
  }
  const files = await generateStarterFiles(plan);
  if (!files.length || files.some((file) => !file.path || !file.content)) throw new Error("AI runtime returned no validated starter files.");
  console.log(JSON.stringify({ projectName: plan.projectName, type: plan.type, requirements: plan.requirements.length, pages: plan.pages.length, files: files.length, source: idea }));
}

void main();
