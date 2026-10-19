import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type SearchHit = {
  id: string;
  kind: "note" | "question" | "norma" | "fuden";
  epigrafId: string | null;
  title: string;
  url: string | null;
  /** Fragment amb les coincidències marcades amb <mark> */
  snippet: string;
  rank: number;
};

/**
 * Cerca per paraules clau al temari (fitxes), a les preguntes i a la normativa.
 * Fa servir el diccionari català de Postgres: troba "úlcera" en buscar "ulceres" i a l'inrevés.
 * Accepta sintaxi de cercador: "frase exacta", -excloure, OR.
 */
export async function search(q: string, kind: SearchHit["kind"] | undefined, canSeeFuden: boolean, limit = 30): Promise<SearchHit[]> {
  const query = q.trim().slice(0, 200);
  if (query.length < 2) return [];
  const db = await getDb();
  const res = await db.execute(sql`
    select id, kind, epigraf_id as "epigrafId", title, url,
      ts_rank_cd(tsv, websearch_to_tsquery('catalan', ${query}) || websearch_to_tsquery('spanish', ${query})) as rank,
      ts_headline('catalan', body, websearch_to_tsquery('catalan', ${query}) || websearch_to_tsquery('spanish', ${query}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=38, MinWords=14, MaxFragments=2, FragmentDelimiter=" … "') as snippet
    from search_docs
    where tsv @@ (websearch_to_tsquery('catalan', ${query}) || websearch_to_tsquery('spanish', ${query}))
      ${kind ? sql`and kind = ${kind}` : sql``}
      ${canSeeFuden ? sql`` : sql`and not restricted`}
    order by (case kind when 'note' then 0 when 'fuden' then 1 when 'norma' then 2 else 3 end), rank desc
    limit ${limit}
  `);
  const r = res as unknown as { rows?: SearchHit[] } & SearchHit[];
  const rows = r.rows ?? r;
  return rows.map((r) => ({ ...r, rank: Number(r.rank) }));
}

/** Escapa el text i només deixa passar les marques <mark> del fragment. */
export function safeSnippet(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;mark&gt;/g, "<mark>")
    .replace(/&lt;\/mark&gt;/g, "</mark>");
}
