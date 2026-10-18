CREATE TABLE "notes" (
	"epigraf_id" text PRIMARY KEY NOT NULL,
	"body" text NOT NULL,
	"key_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"epigraf_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('catalan', coalesce(title, '')), 'A') || setweight(to_tsvector('catalan', coalesce(body, '')), 'B')) STORED NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "source_label" text;--> statement-breakpoint
CREATE INDEX "search_docs_tsv_idx" ON "search_docs" USING gin ("tsv");--> statement-breakpoint
CREATE INDEX "search_docs_kind_idx" ON "search_docs" USING btree ("kind");