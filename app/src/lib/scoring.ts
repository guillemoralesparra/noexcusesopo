import type { OptionKey } from "@/db/schema";

export type AnswerOutcome = "correct" | "wrong" | "blank" | "annulled";

/** Correcta si el conjunt marcat coincideix exactament amb les respostes acceptades. */
export function isCorrect(selected: readonly OptionKey[], accepted: readonly OptionKey[]): boolean {
  if (accepted.length === 0 || selected.length !== accepted.length) return false;
  const set = new Set(accepted);
  return selected.every((o) => set.has(o));
}

export function outcomeOf(selected: readonly OptionKey[] | undefined, accepted: readonly OptionKey[], annulled: boolean): AnswerOutcome {
  if (annulled) return "annulled";
  if (!selected || selected.length === 0) return "blank";
  return isCorrect(selected, accepted) ? "correct" : "wrong";
}

export type ExerciseScore = {
  valid: number;
  correct: number;
  wrong: number;
  blank: number;
  /** Encerts − penalització × errors */
  net: number;
  /** Escalat a `maxPoints` sobre les preguntes vàlides (mínim 0) */
  points: number;
  maxPoints: number;
};

/**
 * Puntua un exercici com fa el tribunal: les anul·lades no compten i la nota
 * s'escala sobre el nombre de preguntes vàlides.
 */
export function scoreExercise(outcomes: readonly AnswerOutcome[], penalty: number, maxPoints = 50): ExerciseScore {
  let correct = 0, wrong = 0, blank = 0;
  for (const o of outcomes) {
    if (o === "correct") correct++;
    else if (o === "wrong") wrong++;
    else if (o === "blank") blank++;
  }
  const valid = correct + wrong + blank;
  const net = correct - penalty * wrong;
  const points = valid === 0 ? 0 : Math.max(0, (net / valid) * maxPoints);
  return { valid, correct, wrong, blank, net, points, maxPoints };
}

/**
 * Valor esperat de respondre una pregunta de 4 opcions havent descartat `discarded` opcions,
 * respecte a deixar-la en blanc.
 */
export function guessExpectedValue(penalty: number, discarded = 0, options = 4): number {
  const remaining = options - discarded;
  return 1 / remaining - penalty * (1 - 1 / remaining);
}
