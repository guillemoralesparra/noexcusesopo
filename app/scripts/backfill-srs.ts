/**
 * Reconstrueix les targetes FSRS a partir de l'historial de respostes (idempotent).
 * Repeteix cada resposta en ordre cronològic; als simulacres lliurats, les preguntes sense
 * resposta compten com a en blanc a l'hora de lliurar.
 *
 * Ús: pnpm db:backfill-srs   (amb el servidor de desenvolupament aturat si es fa servir PGlite)
 */
import { asc, eq } from "drizzle-orm";
import type { Card } from "ts-fsrs";
import * as s from "../src/db/schema";
import { outcomeOf } from "../src/lib/scoring";
import { gradeFor, nextCard, serializeCard } from "../src/lib/srs";
import { migrateDb } from "./migrate";

async function main() {
  const db = await migrateDb();
  const qs = new Map((await db.select().from(s.questions)).map((q) => [q.id, q]));
  const users = await db.select({ id: s.users.id }).from(s.users);
  let total = 0;
  for (const { id: userId } of users) {
    const sessions = await db.select().from(s.practiceSessions).where(eq(s.practiceSessions.userId, userId));
    const at = await db.select().from(s.attempts).where(eq(s.attempts.userId, userId)).orderBy(asc(s.attempts.createdAt));
    type Ev = { t: Date; qid: string; selected: s.OptionKey[]; confidence: s.Confidence | null };
    const events: Ev[] = [];
    const bySession = new Map(sessions.map((x) => [x.id, x]));
    for (const a of at) {
      const sess = bySession.get(a.sessionId);
      // Simulacre: compta en lliurar; si no s'ha lliurat, encara no
      if (sess && !sess.immediateFeedback) {
        if (sess.finishedAt) events.push({ t: sess.finishedAt, qid: a.questionId, selected: a.selected, confidence: a.confidence });
      } else events.push({ t: a.createdAt, qid: a.questionId, selected: a.selected, confidence: a.confidence });
    }
    for (const sess of sessions) {
      if (sess.immediateFeedback || !sess.finishedAt) continue;
      const answered = new Set(at.filter((a) => a.sessionId === sess.id).map((a) => a.questionId));
      for (const qid of sess.questionIds) if (!answered.has(qid)) events.push({ t: sess.finishedAt, qid, selected: [], confidence: null });
    }
    events.sort((a, b) => a.t.getTime() - b.t.getTime());

    const cards = new Map<string, Card>();
    for (const e of events) {
      const q = qs.get(e.qid);
      if (!q) continue;
      const grade = gradeFor(outcomeOf(e.selected, q.accepted, q.annulled), e.confidence);
      if (grade === null) continue;
      cards.set(e.qid, nextCard(cards.get(e.qid) ?? null, grade, e.t));
    }
    await db.delete(s.reviewCards).where(eq(s.reviewCards.userId, userId));
    const rows = [...cards.entries()].map(([questionId, card]) => ({ userId, questionId, due: card.due, card: serializeCard(card) }));
    for (let i = 0; i < rows.length; i += 200) await db.insert(s.reviewCards).values(rows.slice(i, i + 200));
    total += rows.length;
  }
  console.log(`Targetes FSRS reconstruïdes: ${total} (${users.length} usuàries)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
