import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_lessons_video_provider" AS ENUM('youtube', 'vimeo', 'file');
  CREATE TYPE "public"."enum_engagement_points_family" AS ENUM('popup', 'workbook', 'task');
  CREATE TYPE "public"."enum_engagement_points_evidence" AS ENUM('none', 'note', 'photo');
  CREATE TYPE "public"."enum_sheet_keys_sheet_status" AS ENUM('draft', 'checked', 'live');
  CREATE TYPE "public"."enum_sheet_imports_desk" AS ENUM('master', 'portal');
  CREATE TYPE "public"."enum_sheet_imports_state" AS ENUM('preview', 'applied', 'undone');
  ALTER TYPE "public"."enum_resources_kind" ADD VALUE 'summary';
  ALTER TYPE "public"."enum_resources_kind" ADD VALUE 'quote';
  ALTER TYPE "public"."enum_resources_kind" ADD VALUE 'reading';
  ALTER TYPE "public"."enum_resources_kind" ADD VALUE 'guide';
  ALTER TYPE "public"."enum_resources_kind" ADD VALUE 'transcript';
  CREATE TABLE "sheet_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"talk_key" varchar NOT NULL,
  	"lesson_id" integer NOT NULL,
  	"channel" varchar,
  	"sheet_status" "enum_sheet_keys_sheet_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sheet_imports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"desk" "enum_sheet_imports_desk" NOT NULL,
  	"portal_id" integer,
  	"actor_id" integer,
  	"actor_role" varchar,
  	"file_name" varchar,
  	"state" "enum_sheet_imports_state" DEFAULT 'preview' NOT NULL,
  	"at" timestamp(3) with time zone,
  	"summary" jsonb,
  	"snapshot" jsonb,
  	"workbook" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "lessons" ADD COLUMN "video_provider" "enum_lessons_video_provider";
  ALTER TABLE "lessons" ADD COLUMN "vimeo_id" varchar;
  ALTER TABLE "lessons" ADD COLUMN "film_id" integer;
  ALTER TABLE "resources" ADD COLUMN "file_id" integer;
  ALTER TABLE "resources" ADD COLUMN "body" varchar;
  ALTER TABLE "engagement_points" ADD COLUMN "family" "enum_engagement_points_family";
  ALTER TABLE "engagement_points" ADD COLUMN "due_days" numeric;
  ALTER TABLE "engagement_points" ADD COLUMN "evidence" "enum_engagement_points_evidence";
  ALTER TABLE "engagement_points" ADD COLUMN "show_imam" boolean DEFAULT false;
  ALTER TABLE "talk_tiers" ADD COLUMN "appetiser_spans" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sheet_keys_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sheet_imports_id" integer;
  ALTER TABLE "master_flags" ADD COLUMN "hors_max_seconds" numeric DEFAULT 45;
  ALTER TABLE "sheet_keys" ADD CONSTRAINT "sheet_keys_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sheet_imports" ADD CONSTRAINT "sheet_imports_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sheet_imports" ADD CONSTRAINT "sheet_imports_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "sheet_keys_talk_key_idx" ON "sheet_keys" USING btree ("talk_key");
  CREATE UNIQUE INDEX "sheet_keys_lesson_idx" ON "sheet_keys" USING btree ("lesson_id");
  CREATE INDEX "sheet_keys_updated_at_idx" ON "sheet_keys" USING btree ("updated_at");
  CREATE INDEX "sheet_keys_created_at_idx" ON "sheet_keys" USING btree ("created_at");
  CREATE INDEX "sheet_imports_portal_idx" ON "sheet_imports" USING btree ("portal_id");
  CREATE INDEX "sheet_imports_actor_idx" ON "sheet_imports" USING btree ("actor_id");
  CREATE INDEX "sheet_imports_state_idx" ON "sheet_imports" USING btree ("state");
  CREATE INDEX "sheet_imports_updated_at_idx" ON "sheet_imports" USING btree ("updated_at");
  CREATE INDEX "sheet_imports_created_at_idx" ON "sheet_imports" USING btree ("created_at");
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_film_id_media_id_fk" FOREIGN KEY ("film_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "resources" ADD CONSTRAINT "resources_file_id_media_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sheet_keys_fk" FOREIGN KEY ("sheet_keys_id") REFERENCES "public"."sheet_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sheet_imports_fk" FOREIGN KEY ("sheet_imports_id") REFERENCES "public"."sheet_imports"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "lessons_film_idx" ON "lessons" USING btree ("film_id");
  CREATE INDEX "resources_file_idx" ON "resources" USING btree ("file_id");
  CREATE INDEX "payload_locked_documents_rels_sheet_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("sheet_keys_id");
  CREATE INDEX "payload_locked_documents_rels_sheet_imports_id_idx" ON "payload_locked_documents_rels" USING btree ("sheet_imports_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sheet_keys" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sheet_imports" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sheet_keys" CASCADE;
  DROP TABLE "sheet_imports" CASCADE;
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_film_id_media_id_fk";
  
  ALTER TABLE "resources" DROP CONSTRAINT "resources_file_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sheet_keys_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sheet_imports_fk";
  
  ALTER TABLE "resources" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "resources" ALTER COLUMN "kind" SET DEFAULT 'link'::text;
  DROP TYPE "public"."enum_resources_kind";
  CREATE TYPE "public"."enum_resources_kind" AS ENUM('link', 'file');
  ALTER TABLE "resources" ALTER COLUMN "kind" SET DEFAULT 'link'::"public"."enum_resources_kind";
  ALTER TABLE "resources" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_resources_kind" USING "kind"::"public"."enum_resources_kind";
  DROP INDEX "lessons_film_idx";
  DROP INDEX "resources_file_idx";
  DROP INDEX "payload_locked_documents_rels_sheet_keys_id_idx";
  DROP INDEX "payload_locked_documents_rels_sheet_imports_id_idx";
  ALTER TABLE "lessons" DROP COLUMN "video_provider";
  ALTER TABLE "lessons" DROP COLUMN "vimeo_id";
  ALTER TABLE "lessons" DROP COLUMN "film_id";
  ALTER TABLE "resources" DROP COLUMN "file_id";
  ALTER TABLE "resources" DROP COLUMN "body";
  ALTER TABLE "engagement_points" DROP COLUMN "family";
  ALTER TABLE "engagement_points" DROP COLUMN "due_days";
  ALTER TABLE "engagement_points" DROP COLUMN "evidence";
  ALTER TABLE "engagement_points" DROP COLUMN "show_imam";
  ALTER TABLE "talk_tiers" DROP COLUMN "appetiser_spans";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sheet_keys_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sheet_imports_id";
  ALTER TABLE "master_flags" DROP COLUMN "hors_max_seconds";
  DROP TYPE "public"."enum_lessons_video_provider";
  DROP TYPE "public"."enum_engagement_points_family";
  DROP TYPE "public"."enum_engagement_points_evidence";
  DROP TYPE "public"."enum_sheet_keys_sheet_status";
  DROP TYPE "public"."enum_sheet_imports_desk";
  DROP TYPE "public"."enum_sheet_imports_state";`)
}
