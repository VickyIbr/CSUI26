CREATE TABLE IF NOT EXISTS "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"award" text,
	"year" integer NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"image" jsonb,
	"team_name" text,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text,
	"show_overlay" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_achievements_year" ON "achievements" USING btree ("year");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_achievements_featured" ON "achievements" USING btree ("is_featured");
