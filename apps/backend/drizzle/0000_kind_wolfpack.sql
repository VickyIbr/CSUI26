CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"sks" integer NOT NULL,
	"description" text,
	"prerequisites" jsonb,
	"material_url" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"npm" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"nama_panggilan" text NOT NULL,
	"program_id" text NOT NULL,
	"instagram" text,
	"line" text,
	"github" text,
	"linkedin" text,
	"deskripsi" text,
	"niche" text,
	"quotes" text,
	"foto" jsonb NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	CONSTRAINT "members_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"careers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"course_map_url" text NOT NULL,
	"drive_url" text NOT NULL,
	"created_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	"updated_at" integer DEFAULT extract(epoch from now())::int NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"semester" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "semesters_program_semester_unique" UNIQUE("program_id","semester")
);
--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "semesters" ADD CONSTRAINT "semesters_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_courses_semester" ON "courses" USING btree ("semester_id");--> statement-breakpoint
CREATE INDEX "idx_courses_code" ON "courses" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_members_program" ON "members" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_members_name" ON "members" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_members_role" ON "members" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_programs_name" ON "programs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_semesters_program" ON "semesters" USING btree ("program_id");