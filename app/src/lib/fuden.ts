import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { fudenDocs, fudenPages } from "@/db/schema";

export const FUDEN_KIND = {
  ca: { temari: "Temari", presentacio: "Presentació", guia_clinica: "Guia clínica", normativa: "Normativa", test: "Test", simulacre: "Simulacre", altres: "Altres" },
  es: { temari: "Temario", presentacio: "Presentación", guia_clinica: "Guía clínica", normativa: "Normativa", test: "Test", simulacre: "Simulacro", altres: "Otros" },
} as const;

export async function fudenPage(docId: number, page: number) {
  const db = await getDb();
  const [doc] = await db.select().from(fudenDocs).where(eq(fudenDocs.id, docId));
  if (!doc) return null;
  const [p] = await db
    .select({ text: fudenPages.text })
    .from(fudenPages)
    .where(and(eq(fudenPages.docId, docId), eq(fudenPages.page, page)));
  return { doc, text: p?.text ?? "" };
}

export type FudenRef = { docId: number; title: string; kind: string; label: string; pages: string; firstPage: number };

/** Documents de FUDEN que tracten un epígraf, amb l'apartat i les pàgines quan es coneixen. */
export async function fudenRefsFor(epigrafId: string): Promise<FudenRef[]> {
  const db = await getDb();
  const docs = await db
    .select()
    .from(fudenDocs)
    .where(sql`${fudenDocs.epigrafs} @> ${JSON.stringify([epigrafId])}::jsonb or ${fudenDocs.sections} @> ${JSON.stringify([{ epigrafs: [epigrafId] }])}::jsonb`);
  const order = ["temari", "presentacio", "guia_clinica", "normativa", "test", "simulacre", "altres"];
  const refs: FudenRef[] = [];
  for (const d of docs.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
    const secs = d.sections.filter((s) => s.epigrafs.includes(epigrafId));
    if (secs.length === 0) refs.push({ docId: d.id, title: d.title, kind: d.kind, label: "", pages: d.pages > 1 ? `1-${d.pages}` : "1", firstPage: 1 });
    for (const s of secs) {
      const first = Number(s.pages.split(/[-,]/)[0]);
      refs.push({ docId: d.id, title: d.title, kind: d.kind, label: s.label, pages: s.pages, firstPage: Number.isFinite(first) && first > 0 ? first : 1 });
    }
  }
  return refs;
}

/** Escapa el text i marca les paraules de la cerca (sense distingir majúscules ni accents). */
export function highlight(text: string, q: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const words = q
    .split(/\s+/)
    .map((w) => fold(w.replace(/^[-"]+|"+$/g, "")))
    .filter((w) => w.length >= 3);
  if (words.length === 0) return esc(text);
  // Coincidència per arrel: els 5 primers caràcters (prou per a plurals i flexions)
  const stems = words.map((w) => w.slice(0, Math.max(3, Math.min(w.length, 5))));
  const folded = fold(text);
  if (folded.length !== text.length) return esc(text);
  let out = "";
  let i = 0;
  const re = new RegExp(`\\b(${stems.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\w*`, "g");
  for (const m of folded.matchAll(re)) {
    out += esc(text.slice(i, m.index)) + "<mark>" + esc(text.slice(m.index, m.index + m[0].length)) + "</mark>";
    i = m.index + m[0].length;
  }
  return out + esc(text.slice(i));
}
