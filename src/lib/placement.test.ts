import { describe, expect, it } from "vitest";
import { isPodium, isTitle, placementLabel } from "@/lib/placement";

describe("placementLabel", () => {
  it("calls a win Champion, never Winner or an ordinal", () => {
    expect(placementLabel(1)).toBe("Champion");
  });

  it("labels second place Runner-up", () => {
    expect(placementLabel(2)).toBe("Runner-up");
  });

  it("labels every other rank as Top N rather than an ordinal", () => {
    expect(placementLabel(3)).toBe("Top 3");
    expect(placementLabel(5)).toBe("Top 5");
    expect(placementLabel(7)).toBe("Top 7");
    expect(placementLabel(8)).toBe("Top 8");
  });

  it("prefers an explicit label when the exact rank is unknown", () => {
    expect(placementLabel(null, "Finalist")).toBe("Finalist");
    expect(placementLabel(4, "Finalist")).toBe("Finalist");
  });

  it("falls back to a dash when nothing is known", () => {
    expect(placementLabel(null)).toBe("—");
    expect(placementLabel(undefined)).toBe("—");
    expect(placementLabel(0)).toBe("—");
  });
});

describe("isTitle / isPodium", () => {
  it("counts only a win as a title", () => {
    expect(isTitle(1)).toBe(true);
    expect(isTitle(2)).toBe(false);
    expect(isTitle(null)).toBe(false);
  });

  it("counts the top three as a podium", () => {
    expect([1, 2, 3].every(isPodium)).toBe(true);
    expect(isPodium(4)).toBe(false);
    expect(isPodium(null)).toBe(false);
  });
});
