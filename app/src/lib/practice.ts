import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import {
  attempts,
  cases,
  exams,
  practiceSessions,
  questions,
  reviewCards,
  topics,
  type CaseSegment,
  type Explanation,
  type Confidence,
  type OptionKey,
  type SessionMode,
} from "@/db/schema";
import { Card } from "ts-fsrs";
import { examLabel } from "./exam-label";
import { gradeFor, nextCard, parseCard, retrievability, serializeCard } from "./srs";
import { outcomeOf, scoreExercise, type AnswerOutcome } from "./scoring";

type QuestionRow = typeof questions.$inferSelect;

const usable = (q: QuestionRow) => !q.annulled && q.status === "active";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Últim intent de cada pregunta per a una usuària. */
async function latestAttempts(userId: number) {
  const db = await getDb();
  const rows = await db
    .select({ questionId: attempts.questionId, correct: attempts.correct, selected: attempts.selected, createdAt: attempts.createdAt })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.createdAt));
  const map = new Map<string, { correct: boolean; blank: boolean; count: number }>();
  for (const r of rows) {
    const prev = map.get(r.questionId);
    if (prev) prev.count++;
    else map.set(r.questionId, { correct: r.correct, blank: r.selected.length === 0, count: 1 });
  }
  return map;
}

/** Targetes FSRS de la usuària, per pregunta. */
async function loadCards(userId: number): Promise<Map<string, Card>> {
  const db = await getDb();
  const rows = await db.select().from(reviewCards).where(eq(reviewCards.userId, userId));
  return new Map(rows.map((r) => [r.questionId, parseCard(r.card)]));
}

/** Actualitza la targeta FSRS d'una pregunta amb una resposta. */
async function reviewQuestion(userId: number, questionId: string, outcome: AnswerOutcome, confidence: Confidence | null, now: Date) {
  const grade = gradeFor(outcome, confidence);
  if (grade === null) return;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(reviewCards)
    .where(and(eq(reviewCards.userId, userId), eq(reviewCards.questionId, questionId)));
  const card = nextCard(row ? parseCard(row.card) : null, grade, now);
  const values = { userId, questionId, due: card.due, card: serializeCard(card), updatedAt: now };
  await db
    .insert(reviewCards)
    .values(values)
    .onConflictDoUpdate({ target: [reviewCards.userId, reviewCards.questionId], set: values });
}

const DUE_SHARE = 0.7;

/**
 * Compon una sessió: fins a un 70 % de repassos pendents (els que més s'estan oblidant primer) i la
 * resta material nou, primer el que més cau a l'examen. Si falta de tot, s'omple amb reforç
 * (preguntes ja vistes que encara no toca repassar). Així mai no s'acumula una muntanya de repassos.
 */
function compose(pool: QuestionRow[], all: QuestionRow[], cards: Map<string, Card>, count: number, now: Date, jitter: boolean) {
  const weight = new Map<string, number>();
  for (const q of all) if (q.origin === "official") weight.set(q.epigrafId, (weight.get(q.epigrafId) ?? 0) + 1);
  const j = () => (jitter ? 0.85 + Math.random() * 0.3 : 1);
  // Les preguntes oficials recents primer; les històriques i les possiblement desactualitzades, menys
  const trust = (q: QuestionRow) => (q.origin === "official" ? 1 : q.origin === "historical" ? 0.55 : 0.7) * (q.currency === "check" ? 0.6 : 1);
  const due: { q: QuestionRow; p: number }[] = [];
  const fresh: { q: QuestionRow; p: number }[] = [];
  const extra: { q: QuestionRow; p: number }[] = [];
  for (const q of pool) {
    const c = cards.get(q.id);
    if (!c) fresh.push({ q, p: (1 + (weight.get(q.epigrafId) ?? 0) / 10) * trust(q) * j() });
    else if (c.due <= now) due.push({ q, p: (1 - retrievability(c, now)) * j() });
    else extra.push({ q, p: (1 - retrievability(c, now)) * trust(q) * j() });
  }
  const byP = (x: { q: QuestionRow; p: number }[]) => x.sort((a, b) => b.p - a.p).map((y) => y.q);
  const [d, f, e] = [byP(due), byP(fresh), byP(extra)];
  const takeDue = d.slice(0, Math.ceil(count * DUE_SHARE));
  const takeFresh = f.slice(0, count - takeDue.length);
  const rest = [...d.slice(takeDue.length), ...e].slice(0, count - takeDue.length - takeFresh.length);
  return {
    chosen: [...takeDue, ...takeFresh, ...rest],
    due: takeDue.length + rest.filter((q) => (cards.get(q.id)?.due ?? now) <= now).length,
    fresh: takeFresh.length,
    extra: rest.filter((q) => (cards.get(q.id)?.due ?? now) > now).length,
    pendingTotal: d.length,
  };
}

export type SuggestionPreview = {
  count: number;
  due: number;
  fresh: number;
  extra: number;
  pendingTotal: number;
  focus: { id: string; title: string; weight: number; seen: boolean }[];
};

/** Què contindria la sessió suggerida per a cada durada (sense crear-la). */
export async function suggestionPreview(userId: number, counts: number[]): Promise<SuggestionPreview[]> {
  const db = await getDb();
  const all = (await db.select().from(questions)).filter(usable);
  const cards = await loadCards(userId);
  const now = new Date();
  const titles = new Map((await db.select({ id: topics.id, title: topics.title }).from(topics)).map((t) => [t.id, t.title]));
  const weight = new Map<string, number>();
  for (const q of all) if (q.origin === "official") weight.set(q.epigrafId, (weight.get(q.epigrafId) ?? 0) + 1);
  const seenEp = new Set(all.filter((q) => cards.has(q.id)).map((q) => q.epigrafId));
  return counts.map((count) => {
    const c = compose(all, all, cards, count, now, false);
    const byEp = new Map<string, number>();
    for (const q of c.chosen) byEp.set(q.epigrafId, (byEp.get(q.epigrafId) ?? 0) + 1);
    const focus = [...byEp.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([id]) => ({ id, title: titles.get(id) ?? id, weight: weight.get(id) ?? 0, seen: seenEp.has(id) }));
    return { count, due: c.due, fresh: c.fresh, extra: c.extra, pendingTotal: c.pendingTotal, focus };
  });
}

export type NewSessionInput =
  | { mode: "topic"; topicIds: string[]; count: number }
  | { mode: "mistakes"; count: number }
  | { mode: "mixed"; count: number }
  | { mode: "exam"; examId: string; penalty: number; timed: boolean; caseLabel?: string };

export async function createSession(userId: number, input: NewSessionInput): Promise<string> {
  const db = await getDb();
  const all = (await db.select().from(questions)).filter(usable);
  let chosen: QuestionRow[] = [];
  let title = "";
  let immediateFeedback = true;
  let penalty = 0;
  let timeLimitS: number | null = null;
  let examId: string | null = null;

  if (input.mode === "exam") {
    const [exam] = await db.select().from(exams).where(eq(exams.id, input.examId));
    if (!exam) throw new Error("Examen inexistent");
    const examQs = (await db.select().from(questions).where(eq(questions.examId, exam.id)).orderBy(asc(questions.number)))
      // en simulacre es mantenen les anul·lades fora, igual que el tribunal
      .filter(usable);
    // Si l'examen té supòsits alternatius (s'escull un), només s'inclou l'escollit
    const alternative = exam.format?.note?.includes("s'escull un");
    const chosenCase = `${exam.id}-${input.caseLabel ?? "C1"}`;
    chosen = examQs.filter((q) => q.section === "test" || !alternative || q.caseId === chosenCase);
    title = `Simulacre · ${examLabel(exam.id, exam.date)}`;
    immediateFeedback = false;
    penalty = input.penalty;
    timeLimitS = input.timed ? (exam.format?.time_min ?? 120) * 60 : null;
    examId = exam.id;
  } else {
    const latest = await latestAttempts(userId);
    let pool = all;
    if (input.mode === "topic") {
      const ids = new Set(input.topicIds);
      const topicRows = await db.select().from(topics);
      // un tema inclou tots els seus epígrafs
      for (const t of topicRows) if (t.parentId && ids.has(t.parentId)) ids.add(t.id);
      pool = all.filter((q) => ids.has(q.epigrafId));
      const names = topicRows.filter((t) => input.topicIds.includes(t.id)).map((t) => t.id);
      title = `Pràctica · ${names.join(", ")}`;
    } else if (input.mode === "mistakes") {
      pool = all.filter((q) => {
        const l = latest.get(q.id);
        return l && !l.correct;
      });
      title = "Repàs de fallades i en blanc";
    } else {
      title = "Barreja de tot el temari";
    }
    chosen = compose(pool, all, await loadCards(userId), input.count, new Date(), true).chosen;
    // Intercalat: es barreja l'ordre final perquè no surtin agrupades per tipus
    chosen = shuffle(chosen);
  }

  if (chosen.length === 0) throw new Error("No hi ha preguntes disponibles per a aquesta selecció");
  const [s] = await db
    .insert(practiceSessions)
    .values({
      userId,
      mode: input.mode as SessionMode,
      title,
      questionIds: chosen.map((q) => q.id),
      immediateFeedback,
      penalty: Math.round(penalty * 100),
      timeLimitS,
      examId,
    })
    .returning({ id: practiceSessions.id });
  return s.id;
}

export type ClientQuestion = {
  id: string;
  number: number | null;
  stem: string;
  options: Partial<Record<OptionKey, string>>;
  /** Nombre de respostes que cal marcar */
  required: number;
  epigrafId: string;
  epigrafTitle: string;
  caseId: string | null;
  source: string;
  currency: "ok" | "check";
  currencyReason: string | null;
  /** Només quan ja s'ha respost (pràctica) o la sessió ha acabat (simulacre) */
  result?: AnswerResult;
  /** Resposta desada en simulacre en curs */
  draft?: { selected: OptionKey[]; confidence: Confidence | null };
};

export type AnswerResult = {
  explanation: Explanation | null;
  selected: OptionKey[];
  confidence: Confidence | null;
  accepted: OptionKey[];
  outcome: AnswerOutcome;
};

export type SessionView = {
  id: string;
  title: string;
  mode: SessionMode;
  immediateFeedback: boolean;
  penalty: number;
  timeLimitS: number | null;
  startedAt: string;
  finishedAt: string | null;
  questions: ClientQuestion[];
  cases: Record<string, { title: string; segments: CaseSegment[] }>;
};

function sourceLabel(q: QuestionRow, examTitles: Map<string, { title: string; date: string }>) {
  if (q.origin === "generated") return "Pregunta pròpia de la plataforma";
  if (q.examId) {
    const e = examTitles.get(q.examId);
    return `${e ? examLabel(q.examId, e.date) : "Examen oficial ICS"}${q.number ? ` · pregunta ${q.number}` : ""}`;
  }
  return q.sourceLabel ?? "Examen oficial ICS (històric)";
}

export async function getSessionView(userId: number, sessionId: string): Promise<SessionView | null> {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(practiceSessions)
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)));
  if (!s) return null;
  const qs = await db.select().from(questions).where(inArray(questions.id, s.questionIds));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const at = await db.select().from(attempts).where(eq(attempts.sessionId, s.id));
  const atBy = new Map(at.map((a) => [a.questionId, a]));
  const epIds = [...new Set(qs.map((q) => q.epigrafId))];
  const eps = new Map((await db.select().from(topics).where(inArray(topics.id, epIds))).map((t) => [t.id, t.title]));
  const examTitles = new Map((await db.select().from(exams)).map((e) => [e.id, { title: e.title, date: e.date }]));
  const caseIds = [...new Set(qs.map((q) => q.caseId).filter((c): c is string => !!c))];
  const caseRows = caseIds.length ? await db.select().from(cases).where(inArray(cases.id, caseIds)) : [];
  const finished = !!s.finishedAt;

  const view: ClientQuestion[] = s.questionIds.map((id) => {
    const q = byId.get(id)!;
    const a = atBy.get(id);
    const base: ClientQuestion = {
      id: q.id,
      number: q.number,
      stem: q.stem,
      options: q.options,
      required: Math.max(1, q.accepted.length),
      epigrafId: q.epigrafId,
      epigrafTitle: eps.get(q.epigrafId) ?? q.epigrafId,
      caseId: q.caseId,
      source: sourceLabel(q, examTitles),
      currency: q.currency,
      currencyReason: q.currencyReason,
    };
    if (a && (s.immediateFeedback || finished)) {
      base.result = {
        explanation: q.explanation,
        selected: a.selected,
        confidence: a.confidence,
        accepted: q.accepted,
        outcome: outcomeOf(a.selected, q.accepted, q.annulled),
      };
    } else if (a) {
      base.draft = { selected: a.selected, confidence: a.confidence };
    } else if (finished) {
      base.result = { explanation: q.explanation, selected: [], confidence: null, accepted: q.accepted, outcome: outcomeOf([], q.accepted, q.annulled) };
    }
    return base;
  });

  return {
    id: s.id,
    title: s.title,
    mode: s.mode,
    immediateFeedback: s.immediateFeedback,
    penalty: s.penalty / 100,
    timeLimitS: s.timeLimitS,
    startedAt: s.startedAt.toISOString(),
    finishedAt: s.finishedAt?.toISOString() ?? null,
    questions: view,
    cases: Object.fromEntries(caseRows.map((c) => [c.id, { title: c.title, segments: c.segments }])),
  };
}

const OPTION_KEYS: OptionKey[] = ["a", "b", "c", "d", "e"];

export async function saveAnswer(
  userId: number,
  sessionId: string,
  questionId: string,
  selected: OptionKey[],
  confidence: Confidence | null,
  timeMs: number | null,
): Promise<AnswerResult | { saved: true }> {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(practiceSessions)
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)));
  if (!s || s.finishedAt || !s.questionIds.includes(questionId)) throw new Error("Sessió no vàlida");
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId));
  const clean = [...new Set(selected)].filter((o) => OPTION_KEYS.includes(o)).sort();
  const outcome = outcomeOf(clean, q.accepted, q.annulled);
  const [existing] = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.sessionId, sessionId), eq(attempts.questionId, questionId)));

  if (s.immediateFeedback) {
    // En pràctica la primera resposta queda fixada (és la que compta per aprendre)
    if (!existing) {
      await db.insert(attempts).values({ userId, sessionId, questionId, selected: clean, confidence, correct: outcome === "correct", timeMs });
      await reviewQuestion(userId, questionId, outcome, confidence, new Date());
    }
    const a = existing ?? { selected: clean, confidence };
    return {
      explanation: q.explanation,
      selected: a.selected,
      confidence: a.confidence,
      accepted: q.accepted,
      outcome: outcomeOf(a.selected, q.accepted, q.annulled),
    };
  }
  // En simulacre es pot canviar la resposta fins a lliurar
  if (existing) {
    await db
      .update(attempts)
      .set({ selected: clean, confidence, correct: outcome === "correct", timeMs })
      .where(eq(attempts.id, existing.id));
  } else {
    await db.insert(attempts).values({ userId, sessionId, questionId, selected: clean, confidence, correct: outcome === "correct", timeMs });
  }
  return { saved: true };
}

export async function finishSession(userId: number, sessionId: string) {
  const db = await getDb();
  const now = new Date();
  // Només la primera vegada (evita programar dues vegades si es prem dos cops)
  const [s] = await db
    .update(practiceSessions)
    .set({ finishedAt: now })
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId), isNull(practiceSessions.finishedAt)))
    .returning();
  if (!s || s.immediateFeedback) return; // la pràctica ja programa en respondre
  // Simulacre: es programen totes les preguntes en lliurar; les que queden en blanc compten com a no sabudes
  const qs = await db.select().from(questions).where(inArray(questions.id, s.questionIds));
  const at = new Map((await db.select().from(attempts).where(eq(attempts.sessionId, s.id))).map((a) => [a.questionId, a]));
  for (const q of qs) {
    const a = at.get(q.id);
    await reviewQuestion(userId, q.id, outcomeOf(a?.selected ?? [], q.accepted, q.annulled), a?.confidence ?? null, now);
  }
}

export type SessionSummary = {
  test: ReturnType<typeof scoreExercise>;
  cases: ReturnType<typeof scoreExercise> | null;
  byConfidence: Record<Confidence | "none", { total: number; correct: number }>;
};

export function summarize(view: SessionView): SessionSummary {
  const outcomes = (section: "test" | "case") =>
    view.questions
      .filter((q) => (section === "case" ? q.caseId : !q.caseId))
      .map((q) => q.result?.outcome ?? "blank");
  const hasCases = view.mode === "exam" && view.questions.some((q) => q.caseId);
  const byConfidence: SessionSummary["byConfidence"] = {
    sure: { total: 0, correct: 0 },
    doubt: { total: 0, correct: 0 },
    guess: { total: 0, correct: 0 },
    none: { total: 0, correct: 0 },
  };
  for (const q of view.questions) {
    const r = q.result;
    if (!r || r.outcome === "blank" || r.outcome === "annulled") continue;
    const k = r.confidence ?? "none";
    byConfidence[k].total++;
    if (r.outcome === "correct") byConfidence[k].correct++;
  }
  if (view.mode !== "exam") {
    return { test: scoreExercise(view.questions.map((q) => q.result?.outcome ?? "blank"), view.penalty), cases: null, byConfidence };
  }
  return {
    test: scoreExercise(outcomes("test"), view.penalty),
    cases: hasCases ? scoreExercise(outcomes("case"), view.penalty) : null,
    byConfidence,
  };
}
