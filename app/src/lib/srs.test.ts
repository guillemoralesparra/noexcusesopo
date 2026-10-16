import { describe, expect, it } from "vitest";
import { Rating } from "ts-fsrs";
import { gradeFor, nextCard, parseCard, retrievability, serializeCard, MAX_INTERVAL_DAYS } from "./srs";

const DAY = 86_400_000;

describe("gradeFor", () => {
  it("fallada o en blanc → Again", () => {
    expect(gradeFor("wrong", "sure")).toBe(Rating.Again);
    expect(gradeFor("blank", null)).toBe(Rating.Again);
  });
  it("encert a l'atzar no compta com a sabut", () => {
    expect(gradeFor("correct", "guess")).toBe(Rating.Again);
  });
  it("encert amb dubte → Hard; segura o sense indicar → Good", () => {
    expect(gradeFor("correct", "doubt")).toBe(Rating.Hard);
    expect(gradeFor("correct", "sure")).toBe(Rating.Good);
    expect(gradeFor("correct", null)).toBe(Rating.Good);
  });
  it("anul·lada no programa res", () => {
    expect(gradeFor("annulled", null)).toBeNull();
  });
});

describe("nextCard", () => {
  const now = new Date("2026-10-17T10:00:00Z");
  it("una fallada torna aviat; un encert, més tard", () => {
    const again = nextCard(null, Rating.Again, now);
    const good = nextCard(null, Rating.Good, now);
    expect(again.due.getTime() - now.getTime()).toBeLessThanOrEqual(DAY + 1000);
    expect(good.due.getTime()).toBeGreaterThan(again.due.getTime());
  });
  it("els intervals creixen amb encerts seguits però no passen del màxim", () => {
    let card = nextCard(null, Rating.Good, now);
    let t = now;
    for (let i = 0; i < 12; i++) {
      t = card.due;
      card = nextCard(card, Rating.Good, t);
    }
    const days = (card.due.getTime() - t.getTime()) / DAY;
    expect(days).toBeGreaterThan(20);
    expect(days).toBeLessThanOrEqual(MAX_INTERVAL_DAYS + 1);
  });
  it("es pot desar i recuperar", () => {
    const card = nextCard(null, Rating.Hard, now);
    const back = parseCard(JSON.parse(JSON.stringify(serializeCard(card))));
    expect(back.due.getTime()).toBe(card.due.getTime());
    expect(back.stability).toBe(card.stability);
  });
  it("la retenció baixa amb el temps", () => {
    const card = nextCard(null, Rating.Good, now);
    const soon = retrievability(card, new Date(now.getTime() + DAY));
    const later = retrievability(card, new Date(now.getTime() + 30 * DAY));
    expect(soon).toBeGreaterThan(later);
  });
});
