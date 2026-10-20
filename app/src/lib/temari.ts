import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { topicBlocks, type TopicPart } from "@/db/schema";

export const PARTS: TopicPart[] = ["temari", "resum", "suport", "presentacio", "normativa", "bibliografia"];

export const PART_LABEL: Record<"ca" | "es", Record<TopicPart, string>> = {
  ca: { temari: "Temari", resum: "Resums", suport: "Material de suport", presentacio: "Diapositives", normativa: "Normativa", bibliografia: "Bibliografia" },
  es: { temari: "Temario", resum: "Resúmenes", suport: "Material de apoyo", presentacio: "Diapositivas", normativa: "Normativa", bibliografia: "Bibliografía" },
};

export type BlockEntry = { id: string; part: TopicPart; sort: number; title: string; source: string; words: number };

/** Índex del contingut d'un epígraf, en ordre de lectura (sense el text). */
export async function blockIndex(epigrafId: string): Promise<BlockEntry[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: topicBlocks.id,
      part: topicBlocks.part,
      sort: topicBlocks.sort,
      title: topicBlocks.title,
      source: topicBlocks.source,
      // aproximació: una paraula cada ~6,5 caràcters
      chars: sql<number>`length(${topicBlocks.body})`,
    })
    .from(topicBlocks)
    .where(eq(topicBlocks.epigrafId, epigrafId))
    .orderBy(asc(topicBlocks.sort));
  return rows.map(({ chars, ...r }) => ({ ...r, words: Math.round(Number(chars) / 6.5) }));
}

export async function getBlock(epigrafId: string, sort: number) {
  const db = await getDb();
  const [b] = await db
    .select()
    .from(topicBlocks)
    .where(and(eq(topicBlocks.epigrafId, epigrafId), eq(topicBlocks.sort, sort)));
  return b ?? null;
}

export type PageHeading = { id: string; text: string; level: number };

/**
 * Dona un id als títols de la pàgina (h4-h6) perquè s'hi pugui saltar i en retorna la llista per a
 * l'índex "En aquesta pàgina". Només el primer nivell que tingui almenys dos títols, per no fer-lo inacabable.
 */
export function withAnchors(html: string): { html: string; headings: PageHeading[] } {
  const all: PageHeading[] = [];
  const used = new Map<string, number>();
  const out = html.replace(/<h([4-6])>([\s\S]*?)<\/h\1>/g, (_, lvl: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    const base =
      text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "apartat";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const id = n ? `${base}-${n + 1}` : base;
    if (text) all.push({ id, text, level: Number(lvl) });
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  const level = [4, 5, 6].find((l) => all.filter((h) => h.level === l).length >= 2);
  return { html: out, headings: level ? all.filter((h) => h.level === level).slice(0, 40) : [] };
}

/** El text ve de PDFs convertits: es treuen etiquetes actives abans de mostrar-lo com a HTML. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}
