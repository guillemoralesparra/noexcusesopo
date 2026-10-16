/**
 * Carrega el temari, els exàmens oficials i les preguntes des de ../content-pipeline/data.
 * És idempotent: actualitza el contingut sense tocar usuaris ni intents.
 *
 * Ús: pnpm db:seed
 */
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
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
  cases: { id: string; title: string; text: string; segments: s.CaseSegment[] }[];
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
      const crow = { id: `${ex.exam_id}-${c.id}`, examId: ex.exam_id, label: c.id, title: c.title, text: c.text, segments: c.segments };
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

  // Codi d'invitació inicial per a la primera administradora
  if ((await db.$count(s.users)) === 0) {
    const code = process.env.ADMIN_INVITE ?? randomBytes(4).toString("hex");
    await db.insert(s.invites).values({ code, usesLeft: 1, role: "admin" }).onConflictDoNothing();
    console.log(`Codi d'invitació d'administració: ${code}`);
  }

  console.log(`Temari: ${topicRows.length} nodes · Exàmens: ${examFiles.length} · Preguntes: ${bank.length} · Explicacions: ${expl.size}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
