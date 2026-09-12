
import { describe, expect, it } from "vitest";
import { detectSourceLanguage, extractJsonCandidate, parseStructured, projectPlanResponseSchema } from "./ai";

describe("MINHAS AI requirement intake", () => {
  it("detects Urdu script", () => {
    expect(detectSourceLanguage("ایک کریانہ اسٹور POS بناؤ")).toBe("urdu");
  });

  it("detects common Roman Urdu phrasing", () => {
    expect(detectSourceLanguage("Mere liye ek CRM banao jo leads manage kare")).toBe("roman_urdu");
  });

  it("defaults to English for Latin-language product ideas", () => {
    expect(detectSourceLanguage("Build a school management app")).toBe("english");
  });

  it("recovers fenced structured output without executing arbitrary text", () => {
    const parsed = extractJsonCandidate("```json\n{\"schemaVersion\":\"1.0\"}\n```");
    expect(JSON.parse(parsed)).toEqual({ schemaVersion: "1.0" });
  });

  it("rejects malformed or unknown structured plan fields", () => {
    expect(() => parseStructured("not json", projectPlanResponseSchema)).toThrow();
    expect(() => parseStructured(JSON.stringify({ schemaVersion: "1.0", action: "create_project", project: {}, injected: true }), projectPlanResponseSchema)).toThrow();
  });

  it("accepts mixed Urdu and English as Urdu input", () => {
    expect(detectSourceLanguage("ایک POS app بناؤ with Inventory")).toBe("urdu");
  });
});

