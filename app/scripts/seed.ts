/**
 * Carrega el temari, els exàmens oficials i les preguntes des de ../content-pipeline/data.
 * És idempotent: actualitza el contingut sense tocar usuaris ni intents.
 *
 * Ús: pnpm db:seed
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getTableColumns, sql } from "drizzle-orm";
import * as s from "../src/db/schema";
import { migrateDb } from "./migrate";

const DATA = path.resolve(process.cwd(), "..", "content-pipeline", "data");
const read = <T>(rel: string): T => JSON.parse(readFileSync(path.join(DATA, rel), "utf-8"));

type TemarioJson = {
  blocs: { id: string; nom: string; temes: { id: string; titol: string; oficial: string; epigrafs: { id: string; titol: string }[] }[] }[];
};
type ExamJson = {
  exam_id: string;
  title: string;
  date: string;
  instructions: string;
  format: { penalty: number | null; time_min: number | null; note: string };
  cases: { id: string; title: string; text: string; segments?: s.CaseSegment[] }[];
};
type BankItem = {
  id: string;
  exam_id: string;
  n: number;
  section: "test" | "case";
  case_id: string | null;
  stem: string;
  options: Record<s.OptionKey, string>;
  accepted: s.OptionKey[];
  annulled: boolean;
};
type VerifiedItem = {
  id: string;
  summary: string;
  options: Partial<Record<s.OptionKey, string>>;
  key_point: string | null;
  sources: s.Explanation["sources"];
  status: s.Explanation["status"];
  notes: string[];
};
type HistoricalItem = {
  id: string;
  exam_id: string | null;
  source_label: string;
  n: number | null;
  section?: "test" | "case";
  case_id?: string | null;
  stem: string;
  options: Partial<Record<s.OptionKey, string>>;
  accepted: s.OptionKey[];
  annulled?: boolean;
  epigraf: string;
  secondary: string | null;
  concept: string | null;
  currency: "ok" | "check";
  currency_reason: string | null;
  explanation?: s.Explanation | null;
};
type NoteJson = { epigraf: string; body_md: string; key_points?: string[]; sources?: s.Explanation["sources"]; review_flags?: string[] };
type NormaJson = { short: string; url: string; chunks: { id: string; unit: string; heading?: string; text: string }[] };
type ClassItem = {
  id: string;
  epigraf: string;
  secondary: string | null;
  concept: string;
  currency: "ok" | "check";
  currency_reason: string | null;
};

async function main() {
  const db = await migrateDb();

  // Temari
  const temario = read<TemarioJson>("temario.json");
  const topicRows: (typeof s.topics.$inferInsert)[] = [];
  let sort = 0;
  for (const bloc of temario.blocs) {
    topicRows.push({ id: bloc.id, parentId: null, kind: "bloc", title: bloc.nom, sort: sort++ });
    for (const tema of bloc.temes) {
      topicRows.push({ id: tema.id, parentId: bloc.id, kind: "tema", title: tema.titol, officialText: tema.oficial, sort: sort++ });
      for (const ep of tema.epigrafs) {
        topicRows.push({ id: ep.id, parentId: tema.id, kind: "epigraf", title: ep.titol, sort: sort++ });
      }
    }
  }
  for (const row of topicRows) {
    await db.insert(s.topics).values(row).onConflictDoUpdate({ target: s.topics.id, set: row });
  }

  // Exàmens i supòsits
  const examFiles = readdirSync(path.join(DATA, "exams")).filter((f) => /^\d{4}[A-Z_]*\.json$/.test(f));
  for (const f of examFiles) {
    const ex = read<ExamJson>(path.join("exams", f));
    const row = { id: ex.exam_id, title: ex.title, date: ex.date, instructions: ex.instructions, format: ex.format };
    await db.insert(s.exams).values(row).onConflictDoUpdate({ target: s.exams.id, set: row });
    for (const c of ex.cases) {
      const crow = { id: `${ex.exam_id}-${c.id}`, examId: ex.exam_id, label: c.id, title: c.title, text: c.text, segments: c.segments ?? [] };
      await db.insert(s.cases).values(crow).onConflictDoUpdate({ target: s.cases.id, set: crow });
    }
  }

  // Les preguntes s'acumulen i es desen per lots (una a una és massa lent contra una base remota)
  const questionRows: (typeof s.questions.$inferInsert)[] = [];

  // Preguntes oficials + classificació
  const bank = read<BankItem[]>("official_bank.json");
  const cls = new Map(read<ClassItem[]>("classification/classification.json").map((c) => [c.id, c]));
  const expl = new Map(read<VerifiedItem[]>("explanations/verified.json").map((e) => [e.id, e]));
  for (const q of bank) {
    const c = cls.get(q.id);
    if (!c) throw new Error(`Pregunta sense classificar: ${q.id}`);
    const row: typeof s.questions.$inferInsert = {
      id: q.id,
      examId: q.exam_id,
      number: q.n,
      section: q.section,
      caseId: q.case_id ? `${q.exam_id}-${q.case_id}` : null,
      stem: q.stem,
      options: q.options,
      accepted: q.accepted,
      annulled: q.annulled,
      origin: "official",
      epigrafId: c.epigraf,
      secondaryEpigrafId: c.secondary,
      concept: c.concept,
      currency: c.currency,
      currencyReason: c.currency_reason,
      explanation: expl.has(q.id)
        ? (({ summary, options, key_point, sources, status, notes }) => ({ summary, options, keyPoint: key_point, sources, status, notes }))(expl.get(q.id)!)
        : null,
    };
    // 'status' no es toca: es gestiona des de l'app (suspensions).
    questionRows.push(row);
  }

  // Exàmens oficials històrics de l'ICS (anteriors al 2015): només pràctica, no fixen pesos
  const histDir = path.join(DATA, "historical");
  let histCount = 0;
  if (existsSync(path.join(histDir, "questions.json"))) {
    for (const f of existsSync(path.join(histDir, "exams")) ? readdirSync(path.join(histDir, "exams")) : []) {
      const ex = read<ExamJson>(path.join("historical", "exams", f));
      const row = { id: ex.exam_id, title: ex.title, date: ex.date, instructions: ex.instructions, format: ex.format };
      await db.insert(s.exams).values(row).onConflictDoUpdate({ target: s.exams.id, set: row });
      for (const c of ex.cases ?? []) {
        const crow = { id: `${ex.exam_id}-${c.id}`, examId: ex.exam_id, label: c.id, title: c.title, text: c.text, segments: c.segments ?? [{ from_question: null, text: c.text }] };
        await db.insert(s.cases).values(crow).onConflictDoUpdate({ target: s.cases.id, set: crow });
      }
    }
    const hist = read<HistoricalItem[]>(path.join("historical", "questions.json"));
    for (const q of hist) {
      const row: typeof s.questions.$inferInsert = {
        id: q.id,
        examId: q.exam_id,
        number: q.n,
        section: q.section ?? "test",
        caseId: q.case_id ? `${q.exam_id}-${q.case_id}` : null,
        stem: q.stem,
        options: q.options,
        accepted: q.accepted,
        annulled: q.annulled ?? false,
        origin: "historical",
        sourceLabel: q.source_label,
        epigrafId: q.epigraf,
        secondaryEpigrafId: q.secondary,
        concept: q.concept,
        currency: q.currency,
        currencyReason: q.currency_reason,
        explanation: q.explanation ?? null,
      };
      questionRows.push(row);
    }
    histCount = hist.length;
  }

  // Preguntes de FUDEN (només a la màquina local; a l'app, només per a qui té accés FUDEN). No fixen pesos.
  const fqDir = path.join(DATA, "fuden", "questions");
  let fudenQCount = 0;
  for (const f of existsSync(fqDir) ? readdirSync(fqDir).filter((x) => x.endsWith(".json") && !x.startsWith("_")) : []) {
    const set = read<FudenQuestionSet>(path.join("fuden", "questions", f));
    const examId = set.kind === "simulacre" ? `fuden-${set.slug}` : null;
    if (examId) {
      const row = { id: examId, title: set.title, date: set.date ?? "2025-01-01", instructions: "", format: { penalty: null, time_min: 120, note: "Simulacre de FUDEN amb la seva clau" } };
      await db.insert(s.exams).values(row).onConflictDoUpdate({ target: s.exams.id, set: row });
      for (const c of set.cases ?? []) {
        const crow = { id: `${examId}-${c.id}`, examId, label: c.id, title: c.title, text: c.text, segments: [{ from_question: null, text: c.text }] };
        await db.insert(s.cases).values(crow).onConflictDoUpdate({ target: s.cases.id, set: crow });
      }
    }
    for (const q of set.questions) {
      const row: typeof s.questions.$inferInsert = {
        id: `fuden-${set.slug}-${q.n}`,
        examId,
        number: q.n,
        section: q.section ?? "test",
        caseId: examId && q.case_id ? `${examId}-${q.case_id}` : null,
        stem: q.stem,
        options: q.options,
        accepted: q.accepted,
        // sense clau no es pot corregir: queda fora de la pràctica
        annulled: (q.annulled ?? false) || q.accepted.length === 0,
        origin: "fuden",
        sourceLabel: `${set.label} · pregunta ${q.n}`,
        epigrafId: q.epigraf,
        currency: q.currency ?? "ok",
        currencyReason: q.currency_reason ?? null,
        explanation: null,
      };
      questionRows.push(row);
      fudenQCount++;
    }
  }

  // 'status' no es toca: es gestiona des de l'app (suspensions)
  const qCols = [...new Set(questionRows.flatMap((r) => Object.keys(r)))].filter((k) => k !== "id" && k !== "status");
  const colName = getTableColumns(s.questions);
  for (let i = 0; i < questionRows.length; i += 300) {
    await db
      .insert(s.questions)
      .values(questionRows.slice(i, i + 300))
      .onConflictDoUpdate({
        target: s.questions.id,
        set: Object.fromEntries(qCols.map((k) => [k, sql.raw(`excluded."${colName[k as keyof typeof colName].name}"`)])),
      });
  }

  // Fitxes pròpies del temari
  const notesDir = path.join(DATA, "notes");
  const noteFiles = existsSync(notesDir) ? readdirSync(notesDir).filter((f) => f.endsWith(".json")) : [];
  for (const f of noteFiles) {
    const n = read<NoteJson>(path.join("notes", f));
    const row = { epigrafId: n.epigraf, body: n.body_md, keyPoints: n.key_points ?? [], sources: n.sources ?? [], reviewFlags: n.review_flags ?? [], updatedAt: new Date() };
    await db.insert(s.notes).values(row).onConflictDoUpdate({ target: s.notes.epigrafId, set: row });
  }

  // Material de FUDEN: només si és a la màquina local (no és al repositori: còpia privada amb drets d'autor)
  const fudenDir = path.join(DATA, "fuden");
  const fudenPages: { docId: number; page: number; text: string }[] = [];
  const fudenDocs: (typeof s.fudenDocs.$inferInsert)[] = [];
  if (existsSync(path.join(fudenDir, "coverage.json"))) {
    const coverage = read<{ documents: FudenCoverageDoc[] }>("fuden/coverage.json");
    const catalog = new Map(read<FudenCatalogDoc[]>("fuden/catalog.json").map((d) => [d.id, d]));
    const moodle = new Map<string, string>();
    const map = JSON.parse(readFileSync(path.join(DATA, "..", "raw", "fuden", "map.json"), "utf-8")) as FudenMap;
    // Clau: apartat + activitat (els fitxers dins de carpetes comparteixen l'enllaç de la carpeta)
    const secName = (t: string) => t.replace(/^Mosaico:\s*/, "").split(" | ")[0].trim();
    for (const sec of map.sections)
      for (const a of sec.activities) {
        moodle.set(`${secName(sec.title)}|${a.name}`, a.url);
        if (!moodle.has(a.name)) moodle.set(a.name, a.url);
      }
    for (const d of coverage.documents) {
      const cat = catalog.get(d.id);
      const txtFile = path.join(fudenDir, "text", `${d.id}.txt`);
      const pages = existsSync(txtFile) ? readFileSync(txtFile, "utf-8").split("\f") : [];
      pages.forEach((raw, i) => {
        const text = cleanFuden(raw);
        if (text) fudenPages.push({ docId: d.id, page: i + 1, text });
      });
      fudenDocs.push({
        id: d.id,
        title: d.title,
        kind: d.kind,
        section: d.section,
        moodleUrl: (cat && (moodle.get(`${cat.section}|${cat.activity}`) ?? moodle.get(cat.activity))) ?? null,
        pages: pages.length,
        epigrafs: d.epigrafs ?? [],
        summary: d.summary ?? null,
        sections: d.sections ?? [],
      });
    }
    await db.delete(s.fudenDocs);
    await db.delete(s.fudenPages);
    for (let i = 0; i < fudenDocs.length; i += 200) await db.insert(s.fudenDocs).values(fudenDocs.slice(i, i + 200));
    for (let i = 0; i < fudenPages.length; i += 200) await db.insert(s.fudenPages).values(fudenPages.slice(i, i + 200));
  }

  // Índex de cerca: es reconstrueix sencer
  await db.delete(s.searchDocs);
  const docs: (typeof s.searchDocs.$inferInsert)[] = [];
  const epTitle = new Map(topicRows.map((t) => [t.id, t.title]));
  for (const f of noteFiles) {
    const n = read<NoteJson>(path.join("notes", f));
    docs.push({ id: `note:${n.epigraf}`, kind: "note", epigrafId: n.epigraf, title: `${n.epigraf} ${epTitle.get(n.epigraf) ?? ""}`, body: [n.body_md, ...(n.key_points ?? [])].join(" ") });
  }
  const allQ = await db.select().from(s.questions);
  for (const q of allQ) {
    if (q.annulled || q.status !== "active") continue;
    docs.push({ id: `q:${q.id}`, kind: "question", restricted: q.origin === "fuden", epigrafId: q.epigrafId, title: q.stem.slice(0, 160), body: [q.stem, ...Object.values(q.options), q.explanation?.summary ?? ""].join(" ") });
  }
  const srcDir = path.join(DATA, "sources");
  for (const f of existsSync(srcDir) ? readdirSync(srcDir).filter((x) => x.endsWith(".json") && x !== "index.json") : []) {
    const norm = read<NormaJson>(path.join("sources", f));
    for (const c of norm.chunks) {
      if (!c.text?.trim()) continue;
      docs.push({ id: `norma:${c.id}`, kind: "norma", epigrafId: null, title: `${norm.short}, ${c.unit}${c.heading ? ` · ${c.heading}` : ""}`, body: c.text.slice(0, 20000), url: norm.url });
    }
  }
  const fudenById = new Map(fudenDocs.map((d) => [d.id as number, d]));
  for (const p of fudenPages) {
    const d = fudenById.get(p.docId)!;
    if (p.text.length < 80) continue;
    const sec = d.sections?.find((x) => inRange(p.page, x.pages));
    const epigrafId = sec?.epigrafs[0] ?? (d.epigrafs?.length === 1 ? d.epigrafs[0] : null);
    docs.push({ id: `fuden:${p.docId}:${p.page}`, kind: "fuden", restricted: true, epigrafId: epigrafId && epTitle.has(epigrafId) ? epigrafId : null, title: `${d.title} · p. ${p.page}`, body: p.text.slice(0, 20000), url: `/fuden/${p.docId}?p=${p.page}` });
  }
  for (let i = 0; i < docs.length; i += 200) await db.insert(s.searchDocs).values(docs.slice(i, i + 200));

  // Codi d'invitació inicial per a la primera administradora
  if ((await db.$count(s.users)) === 0) {
    const code = process.env.ADMIN_INVITE ?? randomBytes(4).toString("hex");
    await db.insert(s.invites).values({ code, usesLeft: 1, role: "admin" }).onConflictDoNothing();
    console.log(`Codi d'invitació d'administració: ${code}`);
  }

  console.log(`Temari: ${topicRows.length} nodes · Exàmens: ${examFiles.length} · Preguntes oficials: ${bank.length} · Històriques: ${histCount} · Explicacions: ${expl.size} · Fitxes: ${noteFiles.length} · Índex de cerca: ${docs.length} · FUDEN: ${fudenDocs.length} documents, ${fudenPages.length} pàgines, ${fudenQCount} preguntes`);
  process.exit(0);
}

type FudenCoverageDoc = { id: number; title: string; section: string; kind: NonNullable<(typeof s.fudenDocs.$inferInsert)["kind"]>; epigrafs?: string[]; summary?: string; sections?: { label: string; pages: string; epigrafs: string[] }[] };
type FudenQuestionSet = {
  slug: string;
  label: string;
  kind: "simulacre" | "test";
  title: string;
  date: string | null;
  cases?: { id: string; title: string; text: string }[];
  questions: { n: number; section?: "test" | "case"; case_id?: string | null; stem: string; options: Partial<Record<s.OptionKey, string>>; accepted: s.OptionKey[]; annulled?: boolean; epigraf: string; currency?: "ok" | "check"; currency_reason?: string }[];
};
type FudenCatalogDoc = { id: number; section: string; activity: string };
type FudenMap = { sections: { title: string; activities: { name: string; url: string }[] }[] };

/** Treu la marca d'aigua amb el compte de descàrrega i les línies buides de sobres. */
function cleanFuden(t: string): string {
  return t
    .replace(/Descarga autorizada a[\s\S]{0,120}?desde(\s*oposiciones\.f[a-z.]*)?/g, "")
    .replace(/^.*(JDLHH|138173|Descarga autorizada|desde oposiciones\.f).*$/gm, "")
    .replace(/Scanned by CamScanner/g, "")
    .replace(/\u0000/g, "")
    .replace(/0000/g, "")
    .replace(/0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** "4-5", "9" o "4-5, 8" */
function inRange(page: number, ranges: string): boolean {
  return ranges.split(",").some((r) => {
    const [a, b] = r.split("-").map((x) => Number(x.trim()));
    return Number.isFinite(a) && page >= a && page <= (Number.isFinite(b) ? b : a);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
