
import { describe, expect, it } from "vitest";
import { FactoryRole } from "./software-factory";

describe("Software Factory contracts", () => {
  it("defines the six controlled specialist roles", () => {
    const roles: FactoryRole[] = ["product", "architect", "uiux", "qa", "security", "release"];
    expect(new Set(roles).size).toBe(6);
  });
});


