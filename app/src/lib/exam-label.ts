/** Nom curt i llegible d'un examen oficial (el títol imprès és molt llarg). */
export function examLabel(id: string, date: string): string {
  const year = date.slice(0, 4);
  if (id.endsWith("PI")) return `Examen oficial ${year} · promoció interna`;
  const model = id.match(/-([A-D])$/)?.[1];
  return `Examen oficial ${year}${model ? ` · model ${model}` : ""}`;
}
