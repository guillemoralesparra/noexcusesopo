/**
 * Carrega el temari, els exàmens oficials i les preguntes des de ../content-pipeline/data.
 * És idempotent: actualitza el contingut sense tocar usuaris ni intents.
 *
 * Ús: pnpm db:seed
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { getTableColumns, notInArray, sql } from "drizzle-orm";
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
  // Temes i epígrafs que ja no són al temari (p. ex. T3.5 i T9.3 del temari v1)
  await db.delete(s.topics).where(notInArray(s.topics.id, topicRows.map((t) => t.id)));

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
        secondaryEpigrafId: q.secondary ?? null,
        currency: q.currency ?? "ok",
        currencyReason: q.currency_reason ?? null,
        explanation: null,
      };
      questionRows.push(row);
      fudenQCount++;
    }
  }

  // Cap pregunta pot apuntar a un epígraf que no sigui al temari (p. ex. després d'un canvi de versió)
  const epIds = new Set(topicRows.filter((t) => t.kind === "epigraf").map((t) => t.id));
  const orphan = questionRows.filter((r) => !epIds.has(r.epigrafId) || (r.secondaryEpigrafId && !epIds.has(r.secondaryEpigrafId)));
  if (orphan.length > 0) throw new Error(`${orphan.length} preguntes amb un epígraf que no és al temari (p. ex. ${orphan[0].id} → ${orphan[0].epigrafId})`);

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

  // Fitxes pròpies (resum redactat per la plataforma). Les que no són a data/notes (p. ex. d'epígrafs del temari v1) s'esborren.
  const notesDir = path.join(DATA, "notes");
  const noteFiles = existsSync(notesDir) ? readdirSync(notesDir).filter((f) => f.endsWith(".json")) : [];
  const noteList = noteFiles.map((f) => read<NoteJson>(path.join("notes", f)));
  for (const n of noteList) {
    const row = { epigrafId: n.epigraf, body: n.body_md, keyPoints: n.key_points ?? [], sources: n.sources ?? [], reviewFlags: n.review_flags ?? [], updatedAt: new Date() };
    await db.insert(s.notes).values(row).onConflictDoUpdate({ target: s.notes.epigrafId, set: row });
  }
  if (noteList.length > 0) await db.delete(s.notes).where(notInArray(s.notes.epigrafId, noteList.map((n) => n.epigraf)));

  // Contingut literal del temari: content-pipeline/scripts/temari_build.py → data/fuden/temari/blocs.json
  const blocsRel = path.join("fuden", "temari", "blocs.json");
  const blocs = existsSync(path.join(DATA, blocsRel)) ? read<BlockJson[]>(blocsRel) : [];
  if (blocs.length > 0) {
    const bad = blocs.filter((b) => !epIds.has(b.epigraf));
    if (bad.length > 0) throw new Error(`${bad.length} blocs de contingut amb un epígraf que no és al temari (p. ex. ${bad[0].id})`);
    await db.delete(s.topicBlocks);
    for (let i = 0; i < blocs.length; i += 100)
      await db.insert(s.topicBlocks).values(
        blocs.slice(i, i + 100).map((b) => ({ id: b.id, epigrafId: b.epigraf, part: b.part, sort: b.sort, title: b.title, source: b.source, url: b.url, body: b.body })),
      );
  } else {
    console.warn("No hi ha data/fuden/temari/blocs.json: es manté el contingut del temari que ja hi ha a la base de dades.");
  }

  // Índex de cerca (es reconstrueix sencer): temari i preguntes. El temari es parteix en fragments de ~3.000
  // caràcters perquè el resultat porti a prop del text trobat.
  await db.delete(s.searchDocs);
  const docs: (typeof s.searchDocs.$inferInsert)[] = [];
  const epTitle = new Map(topicRows.map((t) => [t.id, t.title]));
  const blocRows = blocs.length > 0 ? blocs : (await db.select().from(s.topicBlocks)).map((b) => ({ ...b, epigraf: b.epigrafId }));
  for (const b of blocRows) {
    passages(plainText(b.body)).forEach((text, k) =>
      docs.push({ id: `t:${b.id}:${k}`, kind: "temari", epigrafId: b.epigraf, title: `${b.epigraf} ${epTitle.get(b.epigraf) ?? ""} · ${b.title}`, body: text, url: `/temari/${b.epigraf}?b=${b.sort}` }),
    );
  }
  for (const n of noteList) {
    docs.push({ id: `note:${n.epigraf}`, kind: "temari", epigrafId: n.epigraf, title: `${n.epigraf} ${epTitle.get(n.epigraf) ?? ""} · Fitxa resum`, body: plainText([n.body_md, ...(n.key_points ?? [])].join("\n\n")), url: `/temari/${n.epigraf}?vista=fitxa` });
  }
  const allQ = await db.select().from(s.questions);
  for (const q of allQ) {
    if (q.annulled || q.status !== "active" || !epIds.has(q.epigrafId)) continue;
    docs.push({ id: `q:${q.id}`, kind: "question", epigrafId: q.epigrafId, title: q.stem.slice(0, 160), body: [q.stem, ...Object.values(q.options), q.explanation?.summary ?? ""].join(" ") });
  }
  for (let i = 0; i < docs.length; i += 200) await db.insert(s.searchDocs).values(docs.slice(i, i + 200));

  // Codi d'invitació inicial per a la primera administradora
  if ((await db.$count(s.users)) === 0) {
    const code = process.env.ADMIN_INVITE ?? randomBytes(4).toString("hex");
    await db.insert(s.invites).values({ code, usesLeft: 1, role: "admin" }).onConflictDoNothing();
    console.log(`Codi d'invitació d'administració: ${code}`);
  }

  console.log(`Temari: ${topicRows.length} nodes · Exàmens: ${examFiles.length} · Preguntes oficials: ${bank.length} · Històriques: ${histCount} · Explicacions: ${expl.size} · Fitxes: ${noteFiles.length} · Contingut: ${blocRows.length} pàgines · Índex de cerca: ${docs.length} · Preguntes FUDEN: ${fudenQCount}`);
  process.exit(0);
}

type FudenQuestionSet = {
  slug: string;
  label: string;
  kind: "simulacre" | "test";
  title: string;
  date: string | null;
  cases?: { id: string; title: string; text: string }[];
  questions: { n: number; section?: "test" | "case"; case_id?: string | null; stem: string; options: Partial<Record<s.OptionKey, string>>; accepted: s.OptionKey[]; annulled?: boolean; epigraf: string; secondary?: string | null; currency?: "ok" | "check"; currency_reason?: string }[];
};
type BlockJson = { id: string; epigraf: string; part: s.TopicPart; sort: number; title: string; source: string; url: string | null; body: string };

/** Text pla per a la cerca: sense comentaris de pàgina, marques de Markdown ni etiquetes HTML. */
function plainText(md: string): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`|>]+/g, " ")
    .replace(/-{3,}/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

/** Fragments de ~3.000 caràcters tallats per paràgrafs. */
function passages(text: string, size = 3000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n\n/)) {
    if (cur && cur.length + para.length > size) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n\n" : "") + para;
    while (cur.length > size * 2) {
      out.push(cur.slice(0, size));
      cur = cur.slice(size);
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
