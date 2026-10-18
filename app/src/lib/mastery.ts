/**
 * Estat de domini d'un epígraf a partir de les preguntes disponibles i l'últim intent de cadascuna.
 * Cinc estats (inspirats en Khan Academy) + "sense preguntes" quan encara no n'hi ha cap al banc.
 *
 * Es basa en la precisió sobre les preguntes vistes, amb un mínim de preguntes per estat (fins a 12),
 * perquè amb bancs grans (oficials + històriques) dominar no exigeixi respondre-les totes.
 */
export type MasteryState = "none" | "untouched" | "started" | "familiar" | "competent" | "mastered";

export const MASTERY_ORDER: MasteryState[] = ["untouched", "started", "familiar", "competent", "mastered"];

export function masteryOf(available: number, seen: number, correctNow: number): MasteryState {
  if (available === 0) return "none";
  if (seen === 0) return "untouched";
  const need = (n: number) => Math.min(available, n);
  const accuracy = correctNow / seen;
  if (seen >= need(12) && accuracy >= 0.85) return "mastered";
  if (seen >= need(8) && accuracy >= 0.7) return "competent";
  if (seen >= need(5) && accuracy >= 0.5) return "familiar";
  return "started";
}

/** Mida de la rajola segons el pes als exàmens oficials (preguntes que hi han caigut). */
export function tileSize(officialWeight: number): 1 | 2 {
  return officialWeight >= 8 ? 2 : 1;
}
