CREATE TABLE "topic_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"epigraf_id" text NOT NULL,
	"part" text NOT NULL,
	"sort" integer NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"url" text,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "topic_blocks_epigraf_idx" ON "topic_blocks" USING btree ("epigraf_id","sort");