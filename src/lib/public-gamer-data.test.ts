import { describe, expect, it } from "vitest";
import { initialsFor } from "@/lib/public-gamer-data";

describe("initialsFor", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFor("Ayaan Khan")).toBe("AK");
  });

  it("caps at two letters for longer names", () => {
    expect(initialsFor("Muhammad Bilal Ahmed Khan")).toBe("MB");
  });

  it("handles a single-word name", () => {
    expect(initialsFor("Nova")).toBe("N");
  });

  it("ignores extra whitespace", () => {
    expect(initialsFor("  Zara   Malik  ")).toBe("ZM");
  });

  it("uppercases lowercase input", () => {
    expect(initialsFor("omar farooq")).toBe("OF");
  });
});
