CREATE TABLE "review_cards" (
	"user_id" integer NOT NULL,
	"question_id" text NOT NULL,
	"due" timestamp with time zone NOT NULL,
	"card" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_cards_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE INDEX "review_cards_due_idx" ON "review_cards" USING btree ("user_id","due");