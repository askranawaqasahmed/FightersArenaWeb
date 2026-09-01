import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("lowercases, trims, and collapses separators", () => {
    expect(slugify("  Viper Khan  ")).toBe("viper-khan");
    expect(slugify("A__B--C!!")).toBe("a-b-c");
    expect(slugify("Ali 123")).toBe("ali-123");
  });

  it("strips leading and trailing dashes", () => {
    expect(slugify("--edge case--")).toBe("edge-case");
  });

  it("returns an empty string for names with no usable characters", () => {
    expect(slugify("!!!")).toBe("");
  });
});
