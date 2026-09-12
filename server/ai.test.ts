
import { describe, expect, it } from "vitest";
import { detectSourceLanguage } from "./ai";

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
});


