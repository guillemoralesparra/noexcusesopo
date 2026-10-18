ALTER TABLE "search_docs" drop column "tsv";--> statement-breakpoint
ALTER TABLE "search_docs" ADD COLUMN "tsv" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('catalan', coalesce(title, '')), 'A') || setweight(to_tsvector('catalan', coalesce(body, '')), 'B') || setweight(to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(body, '')), 'C')) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_docs_tsv_idx" ON "search_docs" USING gin ("tsv");
