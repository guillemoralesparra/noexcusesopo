const CENTRES: Record<string, string> = {
  hbcn: "Hospitals de Barcelona",
  primaria: "Atenció Primària",
  hgirona: "Hospital de Girona",
  hlleida: "Hospital de Lleida",
  htarragona: "Hospitals de Tarragona i Tortosa",
};

/** Nom curt i llegible d'un examen oficial (el títol imprès és molt llarg). */
export function examLabel(id: string, date: string): string {
  const year = date.slice(0, 4);
  const hist = id.match(/^ics-dui-([a-z]+)-\d{4}$/);
  if (hist) return `Examen oficial ${year} · ${CENTRES[hist[1]] ?? hist[1]} (històric)`;
  if (id.endsWith("PI")) return `Examen oficial ${year} · promoció interna`;
  const model = id.match(/-([A-D])$/)?.[1];
  return `Examen oficial ${year}${model ? ` · model ${model}` : ""}`;
}
