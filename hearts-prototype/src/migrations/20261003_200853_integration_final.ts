import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_speakers_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_answers_source_level" AS ENUM('talk', 'hors', 'appetiser');
  CREATE TYPE "public"."enum_talk_tiers_typography_style" AS ENUM('kinetic', 'windows', 'conversation', 'cinema', 'unfold');
  CREATE TYPE "public"."enum_harvest_entries_surface" AS ENUM('hors', 'appetiser', 'talk');
  CREATE TYPE "public"."enum_completions_source_level" AS ENUM('talk', 'hors', 'appetiser');
  ALTER TYPE "public"."enum_harvest_entries_kind" ADD VALUE 'line';
  CREATE TABLE "speakers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"honorific" varchar,
  	"display_name" varchar,
  	"slug" varchar NOT NULL,
  	"aliases" jsonb,
  	"bio" varchar,
  	"photo_id" integer,
  	"photo_url" varchar,
  	"photo_source" varchar,
  	"links" jsonb,
  	"sources" varchar,
  	"status" "enum_speakers_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "drawn_to" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portal_id" integer,
  	"user_id" integer NOT NULL,
  	"speaker" varchar NOT NULL,
  	"speaker_slug" varchar NOT NULL,
  	"linger" numeric DEFAULT 0,
  	"learn_more" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "courses" ADD COLUMN "speaker_profile_id" integer;
  ALTER TABLE "lessons" ADD COLUMN "speaker_profile_id" integer;
  ALTER TABLE "ladder_items" ADD COLUMN "parent_ref" varchar;
  ALTER TABLE "answers" ADD COLUMN "source_level" "enum_answers_source_level";
  ALTER TABLE "talk_tiers" ADD COLUMN "typography_style" "enum_talk_tiers_typography_style";
  ALTER TABLE "talk_tiers" ADD COLUMN "typography_in_place" boolean DEFAULT false;
  ALTER TABLE "talk_tiers" ADD COLUMN "parents" jsonb;
  ALTER TABLE "harvest_entries" ADD COLUMN "speaker" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "door" numeric;
  ALTER TABLE "harvest_entries" ADD COLUMN "surface" "enum_harvest_entries_surface";
  ALTER TABLE "harvest_entries" ADD COLUMN "gathered_at" timestamp(3) with time zone;
  ALTER TABLE "completions" ADD COLUMN "source_level" "enum_completions_source_level" DEFAULT 'talk';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speakers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drawn_to_id" integer;
  ALTER TABLE "speakers" ADD CONSTRAINT "speakers_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drawn_to" ADD CONSTRAINT "drawn_to_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drawn_to" ADD CONSTRAINT "drawn_to_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "speakers_slug_idx" ON "speakers" USING btree ("slug");
  CREATE INDEX "speakers_photo_idx" ON "speakers" USING btree ("photo_id");
  CREATE INDEX "speakers_updated_at_idx" ON "speakers" USING btree ("updated_at");
  CREATE INDEX "speakers_created_at_idx" ON "speakers" USING btree ("created_at");
  CREATE INDEX "drawn_to_portal_idx" ON "drawn_to" USING btree ("portal_id");
  CREATE INDEX "drawn_to_user_idx" ON "drawn_to" USING btree ("user_id");
  CREATE INDEX "drawn_to_speaker_slug_idx" ON "drawn_to" USING btree ("speaker_slug");
  CREATE INDEX "drawn_to_updated_at_idx" ON "drawn_to" USING btree ("updated_at");
  CREATE INDEX "drawn_to_created_at_idx" ON "drawn_to" USING btree ("created_at");
  ALTER TABLE "courses" ADD CONSTRAINT "courses_speaker_profile_id_speakers_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_speaker_profile_id_speakers_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speakers_fk" FOREIGN KEY ("speakers_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drawn_to_fk" FOREIGN KEY ("drawn_to_id") REFERENCES "public"."drawn_to"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_speaker_profile_idx" ON "courses" USING btree ("speaker_profile_id");
  CREATE INDEX "lessons_speaker_profile_idx" ON "lessons" USING btree ("speaker_profile_id");
  CREATE INDEX "ladder_items_parent_ref_idx" ON "ladder_items" USING btree ("parent_ref");
  CREATE INDEX "payload_locked_documents_rels_speakers_id_idx" ON "payload_locked_documents_rels" USING btree ("speakers_id");
  CREATE INDEX "payload_locked_documents_rels_drawn_to_id_idx" ON "payload_locked_documents_rels" USING btree ("drawn_to_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "speakers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "drawn_to" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "speakers" CASCADE;
  DROP TABLE "drawn_to" CASCADE;
  ALTER TABLE "courses" DROP CONSTRAINT "courses_speaker_profile_id_speakers_id_fk";
  
  ALTER TABLE "lessons" DROP CONSTRAINT "lessons_speaker_profile_id_speakers_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_speakers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drawn_to_fk";
  
  ALTER TABLE "harvest_entries" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_harvest_entries_kind";
  CREATE TYPE "public"."enum_harvest_entries_kind" AS ENUM('quran', 'hadith');
  ALTER TABLE "harvest_entries" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_harvest_entries_kind" USING "kind"::"public"."enum_harvest_entries_kind";
  DROP INDEX "courses_speaker_profile_idx";
  DROP INDEX "lessons_speaker_profile_idx";
  DROP INDEX "ladder_items_parent_ref_idx";
  DROP INDEX "payload_locked_documents_rels_speakers_id_idx";
  DROP INDEX "payload_locked_documents_rels_drawn_to_id_idx";
  ALTER TABLE "courses" DROP COLUMN "speaker_profile_id";
  ALTER TABLE "lessons" DROP COLUMN "speaker_profile_id";
  ALTER TABLE "ladder_items" DROP COLUMN "parent_ref";
  ALTER TABLE "answers" DROP COLUMN "source_level";
  ALTER TABLE "talk_tiers" DROP COLUMN "typography_style";
  ALTER TABLE "talk_tiers" DROP COLUMN "typography_in_place";
  ALTER TABLE "talk_tiers" DROP COLUMN "parents";
  ALTER TABLE "harvest_entries" DROP COLUMN "speaker";
  ALTER TABLE "harvest_entries" DROP COLUMN "door";
  ALTER TABLE "harvest_entries" DROP COLUMN "surface";
  ALTER TABLE "harvest_entries" DROP COLUMN "gathered_at";
  ALTER TABLE "completions" DROP COLUMN "source_level";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "speakers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drawn_to_id";
  DROP TYPE "public"."enum_speakers_status";
  DROP TYPE "public"."enum_answers_source_level";
  DROP TYPE "public"."enum_talk_tiers_typography_style";
  DROP TYPE "public"."enum_harvest_entries_surface";
  DROP TYPE "public"."enum_completions_source_level";`)
}
