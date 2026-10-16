/**
 * Repetició espaciada amb FSRS (l'algorisme d'Anki).
 *
 * Cada resposta a una pregunta actualitza la seva targeta FSRS. La seguretat declarada decideix la
 * valoració: encertar "a l'atzar" no és saber-ho, i fallar amb seguretat és el que més cal tornar a veure.
 */
import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { Confidence } from "@/db/schema";
import type { AnswerOutcome } from "./scoring";

/** Interval màxim: amb l'examen a pocs mesos, tot ha de tornar a sortir abans. */
export const MAX_INTERVAL_DAYS = 60;

export const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: MAX_INTERVAL_DAYS,
  enable_fuzz: true,
  // L'estudi és irregular: treballem a escala de dies, sense passos de minuts dins la sessió
  enable_short_term: false,
});

export function gradeFor(outcome: AnswerOutcome, confidence: Confidence | null): Grade | null {
  if (outcome === "annulled") return null;
  if (outcome !== "correct") return Rating.Again;
  if (confidence === "guess") return Rating.Again;
  if (confidence === "doubt") return Rating.Hard;
  return Rating.Good;
}

/** Dates <-> JSON per desar la targeta a la base de dades. */
export function serializeCard(card: Card): Record<string, unknown> {
  return { ...card, due: card.due.toISOString(), last_review: card.last_review?.toISOString() ?? null };
}

export function parseCard(raw: Record<string, unknown>): Card {
  return {
    ...(raw as unknown as Card),
    due: new Date(raw.due as string),
    last_review: raw.last_review ? new Date(raw.last_review as string) : undefined,
  };
}

export function nextCard(previous: Card | null, grade: Grade, now: Date): Card {
  return scheduler.next(previous ?? createEmptyCard(now), now, grade).card;
}

/** Probabilitat de recordar-la ara mateix (0-1). */
export function retrievability(card: Card, now: Date): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}
