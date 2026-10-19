const CENTRES: Record<string, string> = {
  hbcn: "Hospitals de Barcelona",
  primaria: "Atenció Primària",
  hgirona: "Hospital de Girona",
  hlleida: "Hospital de Lleida",
  htarragona: "Hospitals de Tarragona i Tortosa",
};

export const isFudenExam = (id: string) => id.startsWith("fuden-");

/** Nom curt i llegible d'un examen oficial o d'un simulacre de FUDEN (el títol imprès és molt llarg). */
export function examLabel(id: string, date: string): string {
  const sim = id.match(/^fuden-sim-(\d+)$/);
  if (sim) return `FUDEN · Simulacre ${Number(sim[1])}`;
  const year = date.slice(0, 4);
  const hist = id.match(/^ics-dui-([a-z]+)-\d{4}$/);
  if (hist) return `Examen oficial ${year} · ${CENTRES[hist[1]] ?? hist[1]} (històric)`;
  if (id.endsWith("PI")) return `Examen oficial ${year} · promoció interna`;
  const model = id.match(/-([A-D])$/)?.[1];
  return `Examen oficial ${year}${model ? ` · model ${model}` : ""}`;
}
