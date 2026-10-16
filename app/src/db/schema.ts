import {
  primaryKey,
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

export type OptionKey = "a" | "b" | "c" | "d";
export type Confidence = "sure" | "doubt" | "guess";
export type SessionMode = "topic" | "mistakes" | "exam" | "mixed";
export type CaseSegment = { from_question: number | "end" | null; text: string };
export type Explanation = {
  summary: string;
  options: Partial<Record<OptionKey, string>>;
  keyPoint: string | null;
  sources: { kind: "norma" | "ref"; label: string; url?: string }[];
  /** consistent: la resolució independent coincideix amb la plantilla; disputed: hi ha dubtes fundats */
  status: "consistent" | "disputed";
  notes: string[];
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<"admin" | "student">().notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable("invites", {
  code: text("code").primaryKey(),
  usesLeft: integer("uses_left").notNull().default(1),
  role: text("role").$type<"admin" | "student">().notNull().default("student"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Arbre del temari: blocs (T, E), temes (T1, E3) i epígrafs (E3.5). */
export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  kind: text("kind").$type<"bloc" | "tema" | "epigraf">().notNull(),
  title: text("title").notNull(),
  officialText: text("official_text"),
  sort: integer("sort").notNull(),
});

export const exams = pgTable("exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  instructions: text("instructions"),
  /** { penalty, time_min, note } segons les instruccions impreses */
  format: jsonb("format").$type<{ penalty: number | null; time_min: number | null; note: string }>(),
});

export const cases = pgTable("cases", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull(),
  label: text("label").notNull(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  /** Narració per fases: cada segment es mostra a partir de la pregunta indicada */
  segments: jsonb("segments").$type<CaseSegment[]>().notNull().default([]),
});

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    examId: text("exam_id"),
    number: integer("number"),
    section: text("section").$type<"test" | "case">().notNull(),
    caseId: text("case_id"),
    stem: text("stem").notNull(),
    options: jsonb("options").$type<Record<OptionKey, string>>().notNull(),
    /** Respostes acceptades. Buit si està anul·lada. Més d'una si l'enunciat en demana diverses. */
    accepted: jsonb("accepted").$type<OptionKey[]>().notNull(),
    annulled: boolean("annulled").notNull().default(false),
    origin: text("origin").$type<"official" | "generated">().notNull(),
    epigrafId: text("epigraf_id").notNull(),
    secondaryEpigrafId: text("secondary_epigraf_id"),
    concept: text("concept"),
    currency: text("currency").$type<"ok" | "check">().notNull().default("ok"),
    currencyReason: text("currency_reason"),
    explanation: jsonb("explanation").$type<Explanation | null>(),
    status: text("status").$type<"active" | "suspended">().notNull().default("active"),
  },
  (t) => [index("questions_epigraf_idx").on(t.epigrafId), index("questions_exam_idx").on(t.examId)],
);

export const practiceSessions = pgTable(
  "practice_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: integer("user_id").notNull(),
    mode: text("mode").$type<SessionMode>().notNull(),
    title: text("title").notNull(),
    /** Ordre de les preguntes de la sessió */
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    /** Feedback immediat (pràctica) o al final (simulacre) */
    immediateFeedback: boolean("immediate_feedback").notNull(),
    penalty: integer("penalty_x100").notNull().default(0),
    timeLimitS: integer("time_limit_s"),
    examId: text("exam_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const attempts = pgTable(
  "attempts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    sessionId: uuid("session_id").notNull(),
    questionId: text("question_id").notNull(),
    /** Opcions marcades; buit = en blanc */
    selected: jsonb("selected").$type<OptionKey[]>().notNull(),
    confidence: text("confidence").$type<Confidence>(),
    correct: boolean("correct").notNull(),
    timeMs: integer("time_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("attempts_user_q_idx").on(t.userId, t.questionId),
    index("attempts_session_idx").on(t.sessionId),
  ],
);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  questionId: text("question_id").notNull(),
  message: text("message").notNull(),
  status: text("status").$type<"open" | "resolved">().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Estat FSRS (repetició espaciada) de cada pregunta per a cada usuària. */
export const reviewCards = pgTable(
  "review_cards",
  {
    userId: integer("user_id").notNull(),
    questionId: text("question_id").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    /** Targeta FSRS serialitzada (dates en ISO) */
    card: jsonb("card").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.questionId] }), index("review_cards_due_idx").on(t.userId, t.due)],
);
