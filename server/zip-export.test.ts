
import { describe, expect, it } from "vitest";
import { safePath } from "./zip-export";

describe("secure ZIP export", () => {
  it("normalizes safe relative paths", () => {
    expect(safePath("src\\App.tsx")).toBe("src/App.tsx");
  });

  it("rejects traversal segments", () => {
    expect(() => safePath("../secrets.env")).toThrow("Unsafe export path");
    expect(() => safePath("src/../secrets.env")).toThrow("Unsafe export path");
  });
});


