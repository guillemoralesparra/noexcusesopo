import "server-only";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attempts, exams, practiceSessions, questions, reviewCards, topics } from "@/db/schema";
import { parseCard, retrievability } from "./srs";
import { examLabel } from "./exam-label";
import { masteryOf, type MasteryState } from "./mastery";

export type TopicStat = {
  id: string;
  parentId: string | null;
  kind: "bloc" | "tema" | "epigraf";
  title: string;
  /** Preguntes disponibles (no anul·lades, actives) */
  available: number;
  /** Preguntes diferents ja respostes */
  seen: number;
  /** Preguntes l'últim intent de les quals és correcte */
  correctNow: number;
  /** Pes als exàmens oficials (preguntes oficials classificades aquí) */
  officialWeight: number;
  mastery: MasteryState;
};

type AttemptLite = { questionId: string; correct: boolean; createdAt: Date };

/** Estat de cada node del temari (els temes i blocs agreguen els epígrafs). `before` limita els intents a una data. */
export async function topicStats(userId: number, before?: Date): Promise<TopicStat[]> {
  const db = await getDb();
  const [topicRows, qs, at] = await Promise.all([
    db.select().from(topics).orderBy(topics.sort),
    db.select({ id: questions.id, epigrafId: questions.epigrafId, annulled: questions.annulled, status: questions.status, origin: questions.origin }).from(questions),
    db.select({ questionId: attempts.questionId, correct: attempts.correct, createdAt: attempts.createdAt })
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt)),
  ]);
  return computeStats(topicRows, qs, before ? at.filter((a) => a.createdAt < before) : at);
}

function computeStats(
  topicRows: (typeof topics.$inferSelect)[],
  qs: { id: string; epigrafId: string; annulled: boolean; status: string; origin: string }[],
  at: AttemptLite[],
): TopicStat[] {
  const latest = new Map<string, boolean>();
  for (const a of at) if (!latest.has(a.questionId)) latest.set(a.questionId, a.correct);

  const stats = new Map<string, TopicStat>(
    topicRows.map((t) => [
      t.id,
      { id: t.id, parentId: t.parentId, kind: t.kind, title: t.title, available: 0, seen: 0, correctNow: 0, officialWeight: 0, mastery: "none" as MasteryState },
    ]),
  );
  const bump = (id: string | null, fn: (s: TopicStat) => void) => {
    while (id) {
      const s = stats.get(id);
      if (!s) break;
      fn(s);
      id = s.parentId;
    }
  };
  for (const q of qs) {
    if (q.origin === "official") bump(q.epigrafId, (s) => s.officialWeight++);
    if (q.annulled || q.status !== "active") continue;
    bump(q.epigrafId, (s) => s.available++);
    if (latest.has(q.id)) {
      bump(q.epigrafId, (s) => s.seen++);
      if (latest.get(q.id)) bump(q.epigrafId, (s) => s.correctNow++);
    }
  }
  for (const s of stats.values()) s.mastery = masteryOf(s.available, s.seen, s.correctNow);
  return [...stats.values()];
}

/**
 * Nota estimada del test (sobre 50): mitjana dels epígrafs ponderada pel seu pes als exàmens oficials.
 * Un epígraf no treballat compta com a resposta a l'atzar (25 %). Interval segons quanta part del pes
 * està realment mesurada: com menys dades, més ample.
 */
export function estimateTest(stats: TopicStat[]) {
  const eps = stats.filter((s) => s.kind === "epigraf" && s.officialWeight > 0);
  const totalW = eps.reduce((a, s) => a + s.officialWeight, 0);
  if (totalW === 0) return null;
  let score = 0;
  let measuredW = 0;
  for (const s of eps) {
    const acc = s.seen > 0 ? s.correctNow / s.seen : 0.25;
    score += acc * s.officialWeight;
    if (s.seen > 0) measuredW += s.officialWeight * Math.min(1, s.seen / Math.max(1, s.available));
  }
  const coverage = measuredW / totalW;
  const point = (score / totalW) * 50;
  const half = 4 + (1 - coverage) * 10;
  return { point, low: Math.max(0, point - half), high: Math.min(50, point + half), coverage };
}

export async function overview(userId: number) {
  const db = await getDb();
  const at = await db
    .select({ correct: attempts.correct, selected: attempts.selected, confidence: attempts.confidence, questionId: attempts.questionId, createdAt: attempts.createdAt })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.createdAt));
  const latest = new Map<string, boolean>();
  for (const a of at) if (!latest.has(a.questionId)) latest.set(a.questionId, a.correct);
  const pending = [...latest.values()].filter((c) => !c).length;

  const calibration = { sure: { total: 0, correct: 0 }, doubt: { total: 0, correct: 0 }, guess: { total: 0, correct: 0 } };
  for (const a of at) {
    if (!a.confidence || a.selected.length === 0) continue;
    calibration[a.confidence].total++;
    if (a.correct) calibration[a.confidence].correct++;
  }
  const examRows = await db.select({ id: exams.id, date: exams.date }).from(exams);
  const examDate = new Map(examRows.map((e) => [e.id, e.date]));
  // El títol dels simulacres es calcula en mostrar-lo (les sessions antigues guardaven el títol imprès sencer)
  const sessions = (
    await db.select().from(practiceSessions).where(eq(practiceSessions.userId, userId)).orderBy(desc(practiceSessions.startedAt)).limit(20)
  ).map((s) => (s.examId && examDate.has(s.examId) ? { ...s, title: `Simulacre · ${examLabel(s.examId, examDate.get(s.examId)!)}` } : s));

  // Constància: dies actius de les últimes 8 setmanes (sense ratxes)
  const days = new Map<string, number>();
  for (const a of at) {
    const k = a.createdAt.toISOString().slice(0, 10);
    days.set(k, (days.get(k) ?? 0) + 1);
  }

  // Encerts per sessió acabada (per a la llista de l'inici)
  const finished = sessions.filter((s) => s.finishedAt).slice(0, 5);
  const finishedIds = new Set(finished.map((s) => s.id));
  const perSession = new Map<string, { correct: number; total: number }>();
  if (finishedIds.size) {
    const rows = await db
      .select({ sessionId: attempts.sessionId, correct: attempts.correct })
      .from(attempts)
      .where(eq(attempts.userId, userId));
    for (const r of rows) {
      if (!finishedIds.has(r.sessionId)) continue;
      const v = perSession.get(r.sessionId) ?? { correct: 0, total: 0 };
      v.total++;
      if (r.correct) v.correct++;
      perSession.set(r.sessionId, v);
    }
  }
  const recentFinished = finished.map((s) => ({
    id: s.id,
    title: s.title,
    mode: s.mode,
    finishedAt: s.finishedAt!,
    questions: s.questionIds.length,
    correct: perSession.get(s.id)?.correct ?? 0,
  }));

  // Memòria (FSRS): repassos pendents i retenció mitjana estimada avui
  const now = new Date();
  const cardRows = await db.select().from(reviewCards).where(eq(reviewCards.userId, userId));
  const rs = cardRows.map((r) => retrievability(parseCard(r.card), now));
  const memory = {
    cards: cardRows.length,
    dueNow: cardRows.filter((r) => r.due <= now).length,
    retention: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
  };

  return {
    memory,
    recentFinished,
    answered: at.length,
    distinct: latest.size,
    pendingMistakes: pending,
    calibration,
    recentSessions: sessions,
    unfinished: sessions.find((s) => !s.finishedAt) ?? null,
    activeDays: days,
  };
}

/** Preguntes l'últim intent de les quals va ser erroni o en blanc, agrupades per epígraf. */
export async function mistakesByEpigraf(userId: number) {
  const db = await getDb();
  const [at, qs, tps] = await Promise.all([
    db.select({ questionId: attempts.questionId, correct: attempts.correct, createdAt: attempts.createdAt })
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt)),
    db.select({ id: questions.id, epigrafId: questions.epigrafId, status: questions.status }).from(questions),
    db.select({ id: topics.id, title: topics.title, parentId: topics.parentId }).from(topics),
  ]);
  const latest = new Map<string, boolean>();
  for (const a of at) if (!latest.has(a.questionId)) latest.set(a.questionId, a.correct);
  const epOf = new Map(qs.filter((q) => q.status === "active").map((q) => [q.id, q.epigrafId]));
  const counts = new Map<string, number>();
  for (const [qid, ok] of latest) {
    const ep = epOf.get(qid);
    if (!ok && ep) counts.set(ep, (counts.get(ep) ?? 0) + 1);
  }
  const t = new Map(tps.map((x) => [x.id, x]));
  return [...counts.entries()]
    .map(([id, n]) => ({ id, n, title: t.get(id)?.title ?? id, parentId: t.get(id)?.parentId ?? null }))
    .sort((a, b) => b.n - a.n);
}
