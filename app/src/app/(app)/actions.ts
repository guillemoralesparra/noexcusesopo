"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { invites, questions, reports, type Confidence, type OptionKey } from "@/db/schema";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createSession, finishSession, saveAnswer, type NewSessionInput } from "@/lib/practice";
import { MINUTES_TO_COUNT } from "@/lib/session-sizes";


export async function setLangAction(form: FormData) {
  const lang = form.get("lang") === "es" ? "es" : "ca";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function startSuggested(form: FormData) {
  const user = await requireUser();
  const count = MINUTES_TO_COUNT[String(form.get("minutes"))] ?? 20;
  const id = await createSession(user.id, { mode: "mixed", count });
  redirect(`/sessio/${id}`);
}

const startSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("topic"), topicIds: z.array(z.string()).min(1), count: z.coerce.number().int().min(5).max(100) }),
  z.object({ mode: z.literal("mistakes"), count: z.coerce.number().int().min(5).max(100) }),
  z.object({ mode: z.literal("mixed"), count: z.coerce.number().int().min(5).max(100) }),
  z.object({
    mode: z.literal("exam"),
    examId: z.string(),
    penalty: z.coerce.number().min(0).max(1),
    timed: z.coerce.boolean(),
    caseLabel: z.string().optional(),
  }),
]);

export async function startPractice(form: FormData) {
  const user = await requireUser();
  const raw = {
    ...Object.fromEntries(form),
    topicIds: form.getAll("topicIds").map(String),
    timed: form.get("timed") === "on",
  };
  const input = startSchema.parse(raw) as NewSessionInput;
  const id = await createSession(user.id, input);
  redirect(`/sessio/${id}`);
}

const answerSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string(),
  selected: z.array(z.enum(["a", "b", "c", "d"])),
  confidence: z.enum(["sure", "doubt", "guess"]).nullable(),
  timeMs: z.number().int().nonnegative().nullable(),
});

export async function answerAction(input: {
  sessionId: string;
  questionId: string;
  selected: OptionKey[];
  confidence: Confidence | null;
  timeMs: number | null;
}) {
  const user = await requireUser();
  const a = answerSchema.parse(input);
  return saveAnswer(user.id, a.sessionId, a.questionId, a.selected, a.confidence, a.timeMs);
}

export async function finishAction(sessionId: string) {
  const user = await requireUser();
  await finishSession(user.id, sessionId);
  redirect(`/sessio/${sessionId}/resultat`);
}

export async function reportAction(questionId: string, message: string) {
  const user = await requireUser();
  const text = message.trim().slice(0, 2000);
  if (!text) return;
  const db = await getDb();
  await db.insert(reports).values({ userId: user.id, questionId, message: text });
}

export async function createInviteAction(form: FormData) {
  await requireAdmin();
  const uses = Math.min(50, Math.max(1, Number(form.get("uses")) || 1));
  const db = await getDb();
  await db.insert(invites).values({ code: randomBytes(4).toString("hex"), usesLeft: uses, role: "student" });
  revalidatePath("/admin");
}

export async function resolveReportAction(form: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = Number(form.get("id"));
  const suspend = form.get("suspend") === "1";
  const [r] = await db.update(reports).set({ status: "resolved" }).where(eq(reports.id, id)).returning();
  if (r && suspend) await db.update(questions).set({ status: "suspended" }).where(eq(questions.id, r.questionId));
  revalidatePath("/admin");
}

export async function setQuestionStatusAction(form: FormData) {
  await requireAdmin();
  const db = await getDb();
  const status = form.get("status") === "active" ? "active" : "suspended";
  await db.update(questions).set({ status }).where(eq(questions.id, String(form.get("questionId"))));
  revalidatePath("/admin");
}
