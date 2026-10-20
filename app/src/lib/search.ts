import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export type SearchKind = "temari" | "question";

export type SearchHit = {
  id: string;
  kind: SearchKind;
  epigrafId: string | null;
  title: string;
  url: string | null;
  /** Fragment amb les coincidències marcades amb <mark> */
  snippet: string;
  rank: number;
};

const rowsOf = <T,>(res: unknown): T[] => {
  const r = res as { rows?: T[] } & T[];
  return r.rows ?? r;
};

/**
 * Cerca per paraules clau al temari (el text de cada epígraf i les fitxes) i a les preguntes.
 * El temari surt sempre abans que les preguntes; dins de cada grup, per rellevància.
 * Fa servir els diccionaris català i castellà de Postgres (troba "úlcera" en buscar "ulceres")
 * i accepta sintaxi de cercador: "frase exacta", -excloure, OR.
 */
export async function search(q: string, kind: SearchKind | undefined, limit = 40): Promise<{ hits: SearchHit[]; counts: Record<SearchKind, number> }> {
  const query = q.trim().slice(0, 200);
  const counts: Record<SearchKind, number> = { temari: 0, question: 0 };
  if (query.length < 2) return { hits: [], counts };
  const db = await getDb();
  const tsq = sql`(websearch_to_tsquery('catalan', ${query}) || websearch_to_tsquery('spanish', ${query}))`;
  const [countRes, hitRes] = await Promise.all([
    db.execute(sql`select kind, count(*)::int as n from search_docs where tsv @@ ${tsq} group by kind`),
    // Com a màxim dos fragments per pàgina de contingut, perquè una sola pàgina no ompli la llista;
    // el fragment ressaltat es calcula només per als resultats que es mostren.
    db.execute(sql`
      with m as (
        select id, kind, epigraf_id, title, url, body, ts_rank_cd(tsv, ${tsq}) as rank,
          row_number() over (partition by coalesce(url, id) order by ts_rank_cd(tsv, ${tsq}) desc) as rn
        from search_docs
        where tsv @@ ${tsq} ${kind ? sql`and kind = ${kind}` : sql``}
      ), top as (
        select * from m where rn <= 2
        order by (case kind when 'temari' then 0 else 1 end), rank desc
        limit ${limit}
      )
      select id, kind, epigraf_id as "epigrafId", title, url, rank,
        ts_headline('catalan', body, ${tsq},
          'StartSel=<mark>, StopSel=</mark>, MaxWords=38, MinWords=14, MaxFragments=2, FragmentDelimiter=" … "') as snippet
      from top
      order by (case kind when 'temari' then 0 else 1 end), rank desc
    `),
  ]);
  for (const c of rowsOf<{ kind: SearchKind; n: number }>(countRes)) if (c.kind in counts) counts[c.kind] = Number(c.n);
  const hits = rowsOf<SearchHit>(hitRes).map((h) => ({ ...h, rank: Number(h.rank) }));
  return { hits, counts };
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
