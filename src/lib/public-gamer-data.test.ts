import { describe, expect, it } from "vitest";
import { compareLadder, initialsFor } from "@/lib/public-gamer-data";

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

describe("compareLadder", () => {
  const player = (displayName: string, rankingPoints: number, titles = 0, podiums = 0) =>
    ({ displayName, rankingPoints, record: { titles, podiums } });

  it("puts the higher ranking points first", () => {
    expect(compareLadder(player("Low", 10), player("High", 90))).toBeGreaterThan(0);
  });

  it("breaks a points tie on titles, not the alphabet", () => {
    // "Babarzaki" sorts before "Hazz" alphabetically, so only the title count can fix this.
    const babar = player("Babarzaki", 0, 0, 5);
    const hazz = player("Hazz", 0, 13, 15);
    expect([babar, hazz].sort(compareLadder).map((entry) => entry.displayName))
      .toEqual(["Hazz", "Babarzaki"]);
  });

  it("falls back to podium finishes when titles are level", () => {
    const fewer = player("A", 0, 2, 3);
    const more = player("Z", 0, 2, 9);
    expect([fewer, more].sort(compareLadder).map((entry) => entry.displayName)).toEqual(["Z", "A"]);
  });

  it("uses the name only when the whole record ties", () => {
    const zara = player("Zara", 0, 1, 1);
    const omar = player("Omar", 0, 1, 1);
    expect([zara, omar].sort(compareLadder).map((entry) => entry.displayName)).toEqual(["Omar", "Zara"]);
  });

  it("treats a player with no recorded results as all zeros", () => {
    const unplayed = { displayName: "Newcomer", rankingPoints: 0 };
    const decorated = player("Veteran", 0, 3, 4);
    expect([unplayed, decorated].sort(compareLadder).map((entry) => entry.displayName))
      .toEqual(["Veteran", "Newcomer"]);
  });
});
