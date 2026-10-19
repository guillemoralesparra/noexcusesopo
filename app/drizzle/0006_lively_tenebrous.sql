CREATE TABLE "fuden_docs" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"section" text NOT NULL,
	"moodle_url" text,
	"pages" integer DEFAULT 0 NOT NULL,
	"epigrafs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuden_pages" (
	"doc_id" integer NOT NULL,
	"page" integer NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "fuden_pages_doc_id_page_pk" PRIMARY KEY("doc_id","page")
);
--> statement-breakpoint
ALTER TABLE "search_docs" ADD COLUMN "restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "fuden_access" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "fuden_access" = true WHERE "role" = 'admin';
