CREATE TABLE "attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"selected" jsonb NOT NULL,
	"confidence" text,
	"correct" boolean NOT NULL,
	"time_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text NOT NULL,
	"label" text NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"instructions" text,
	"format" jsonb
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"code" text PRIMARY KEY NOT NULL,
	"uses_left" integer DEFAULT 1 NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"mode" text NOT NULL,
	"title" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"immediate_feedback" boolean NOT NULL,
	"penalty_x100" integer DEFAULT 0 NOT NULL,
	"time_limit_s" integer,
	"exam_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text,
	"number" integer,
	"section" text NOT NULL,
	"case_id" text,
	"stem" text NOT NULL,
	"options" jsonb NOT NULL,
	"accepted" jsonb NOT NULL,
	"annulled" boolean DEFAULT false NOT NULL,
	"origin" text NOT NULL,
	"epigraf_id" text NOT NULL,
	"secondary_epigraf_id" text,
	"concept" text,
	"currency" text DEFAULT 'ok' NOT NULL,
	"currency_reason" text,
	"explanation" jsonb,
	"status" text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_id" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"official_text" text,
	"sort" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'student' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE INDEX "attempts_user_q_idx" ON "attempts" USING btree ("user_id","question_id");--> statement-breakpoint
CREATE INDEX "attempts_session_idx" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "practice_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "questions_epigraf_idx" ON "questions" USING btree ("epigraf_id");--> statement-breakpoint
CREATE INDEX "questions_exam_idx" ON "questions" USING btree ("exam_id");