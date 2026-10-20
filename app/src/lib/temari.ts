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

/** El text ve de PDFs convertits: es treuen etiquetes actives abans de mostrar-lo com a HTML. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, "$1=$2#$2");
}
