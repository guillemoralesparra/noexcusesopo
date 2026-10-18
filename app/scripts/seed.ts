/**
 * Carrega el temari, els exàmens oficials i les preguntes des de ../content-pipeline/data.
 * És idempotent: actualitza el contingut sense tocar usuaris ni intents.
 *
 * Ús: pnpm db:seed
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
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
    await db.insert(s.questions).values(row).onConflictDoUpdate({ target: s.questions.id, set: row });
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
      await db.insert(s.questions).values(row).onConflictDoUpdate({ target: s.questions.id, set: row });
    }
    histCount = hist.length;
  }

  // Fitxes pròpies del temari
  const notesDir = path.join(DATA, "notes");
  const noteFiles = existsSync(notesDir) ? readdirSync(notesDir).filter((f) => f.endsWith(".json")) : [];
  for (const f of noteFiles) {
    const n = read<NoteJson>(path.join("notes", f));
    const row = { epigrafId: n.epigraf, body: n.body_md, keyPoints: n.key_points ?? [], sources: n.sources ?? [], reviewFlags: n.review_flags ?? [], updatedAt: new Date() };
    await db.insert(s.notes).values(row).onConflictDoUpdate({ target: s.notes.epigrafId, set: row });
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
    docs.push({ id: `q:${q.id}`, kind: "question", epigrafId: q.epigrafId, title: q.stem.slice(0, 160), body: [q.stem, ...Object.values(q.options), q.explanation?.summary ?? ""].join(" ") });
  }
  const srcDir = path.join(DATA, "sources");
  for (const f of existsSync(srcDir) ? readdirSync(srcDir).filter((x) => x.endsWith(".json") && x !== "index.json") : []) {
    const norm = read<NormaJson>(path.join("sources", f));
    for (const c of norm.chunks) {
      if (!c.text?.trim()) continue;
      docs.push({ id: `norma:${c.id}`, kind: "norma", epigrafId: null, title: `${norm.short}, ${c.unit}${c.heading ? ` · ${c.heading}` : ""}`, body: c.text.slice(0, 20000), url: norm.url });
    }
  }
  for (let i = 0; i < docs.length; i += 200) await db.insert(s.searchDocs).values(docs.slice(i, i + 200));

  // Codi d'invitació inicial per a la primera administradora
  if ((await db.$count(s.users)) === 0) {
    const code = process.env.ADMIN_INVITE ?? randomBytes(4).toString("hex");
    await db.insert(s.invites).values({ code, usesLeft: 1, role: "admin" }).onConflictDoNothing();
    console.log(`Codi d'invitació d'administració: ${code}`);
  }

  console.log(`Temari: ${topicRows.length} nodes · Exàmens: ${examFiles.length} · Preguntes oficials: ${bank.length} · Històriques: ${histCount} · Explicacions: ${expl.size} · Fitxes: ${noteFiles.length} · Índex de cerca: ${docs.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
