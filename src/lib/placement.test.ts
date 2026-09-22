import { describe, expect, it } from "vitest";
import { isPodium, isTitle, placementBadge, placementLabel, placementMedalClass } from "@/lib/placement";

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

describe("placementMedalClass", () => {
  it("gives each podium place its own medal colour", () => {
    expect(placementMedalClass(1)).toBe("placement-1");
    expect(placementMedalClass(2)).toBe("placement-2");
    expect(placementMedalClass(3)).toBe("placement-3");
  });

  it("shares one neutral badge off the podium", () => {
    expect(placementMedalClass(4)).toBe("placement-rest");
    expect(placementMedalClass(9)).toBe("placement-rest");
    expect(placementMedalClass(null)).toBe("placement-rest");
  });
});

describe("placementBadge", () => {
  it("shows the bare position for a ranked finish", () => {
    expect(placementBadge(1)).toBe("1");
    expect(placementBadge(9)).toBe("9");
  });

  it("shows a dash when the position is unknown", () => {
    expect(placementBadge(null)).toBe("–");
    expect(placementBadge(undefined)).toBe("–");
    expect(placementBadge(0)).toBe("–");
  });
});
