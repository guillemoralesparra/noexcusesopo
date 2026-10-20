DROP TABLE "fuden_docs" CASCADE;--> statement-breakpoint
DROP TABLE "fuden_pages" CASCADE;--> statement-breakpoint
ALTER TABLE "search_docs" DROP COLUMN "restricted";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "fuden_access";