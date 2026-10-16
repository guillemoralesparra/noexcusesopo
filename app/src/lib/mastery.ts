/**
 * Estat de domini d'un epígraf a partir de les preguntes disponibles i l'últim intent de cadascuna.
 * Cinc estats (inspirats en Khan Academy) + "sense preguntes" quan encara no n'hi ha cap al banc.
 */
export type MasteryState = "none" | "untouched" | "started" | "familiar" | "competent" | "mastered";

export const MASTERY_ORDER: MasteryState[] = ["untouched", "started", "familiar", "competent", "mastered"];

export function masteryOf(available: number, seen: number, correctNow: number): MasteryState {
  if (available === 0) return "none";
  if (seen === 0) return "untouched";
  const coverage = seen / available;
  const accuracy = correctNow / available;
  // Dominat: gairebé tot vist i encertat en l'últim intent
  if (accuracy >= 0.8 && coverage >= 0.9) return "mastered";
  if (accuracy >= 0.6) return "competent";
  if (accuracy >= 0.3) return "familiar";
  return "started";
}

/** Mida de la rajola segons el pes als exàmens oficials (preguntes que hi han caigut). */
export function tileSize(officialWeight: number): 1 | 2 {
  return officialWeight >= 8 ? 2 : 1;
}
