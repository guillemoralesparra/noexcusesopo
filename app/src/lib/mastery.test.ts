import { describe, expect, it } from "vitest";
import { masteryOf } from "./mastery";

describe("masteryOf", () => {
  it("sense preguntes i per posar", () => {
    expect(masteryOf(0, 0, 0)).toBe("none");
    expect(masteryOf(100, 0, 0)).toBe("untouched");
  });
  it("amb un banc gran, n'hi ha prou amb 12 vistes i ≥85 % d'encerts", () => {
    expect(masteryOf(108, 12, 11)).toBe("mastered");
    expect(masteryOf(108, 12, 9)).toBe("competent");
    expect(masteryOf(108, 4, 4)).toBe("started");
  });
  it("amb un banc petit, cal haver-les vist totes", () => {
    expect(masteryOf(3, 3, 3)).toBe("mastered");
    expect(masteryOf(3, 2, 2)).toBe("started");
  });
});
