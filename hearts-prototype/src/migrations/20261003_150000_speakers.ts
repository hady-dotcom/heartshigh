import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_speakers_status" AS ENUM('draft', 'published');
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
  ALTER TABLE "courses" ADD COLUMN "speaker_profile_id" integer;
  ALTER TABLE "lessons" ADD COLUMN "speaker_profile_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "speakers_id" integer;
  ALTER TABLE "speakers" ADD CONSTRAINT "speakers_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_speaker_profile_id_speakers_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "lessons" ADD CONSTRAINT "lessons_speaker_profile_id_speakers_id_fk" FOREIGN KEY ("speaker_profile_id") REFERENCES "public"."speakers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_speakers_fk" FOREIGN KEY ("speakers_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "speakers_slug_idx" ON "speakers" USING btree ("slug");
  CREATE INDEX "speakers_photo_idx" ON "speakers" USING btree ("photo_id");
  CREATE INDEX "speakers_updated_at_idx" ON "speakers" USING btree ("updated_at");
  CREATE INDEX "speakers_created_at_idx" ON "speakers" USING btree ("created_at");
  CREATE INDEX "courses_speaker_profile_idx" ON "courses" USING btree ("speaker_profile_id");
  CREATE INDEX "lessons_speaker_profile_idx" ON "lessons" USING btree ("speaker_profile_id");
  CREATE INDEX "payload_locked_documents_rels_speakers_id_idx" ON "payload_locked_documents_rels" USING btree ("speakers_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "speakers" DISABLE ROW LEVEL SECURITY;
  DROP INDEX IF EXISTS "payload_locked_documents_rels_speakers_id_idx";
  DROP INDEX IF EXISTS "lessons_speaker_profile_idx";
  DROP INDEX IF EXISTS "courses_speaker_profile_idx";
  DROP INDEX IF EXISTS "speakers_created_at_idx";
  DROP INDEX IF EXISTS "speakers_updated_at_idx";
  DROP INDEX IF EXISTS "speakers_photo_idx";
  DROP INDEX IF EXISTS "speakers_slug_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_speakers_fk";
  ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_speaker_profile_id_speakers_id_fk";
  ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_speaker_profile_id_speakers_id_fk";
  ALTER TABLE "speakers" DROP CONSTRAINT IF EXISTS "speakers_photo_id_media_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "speakers_id";
  ALTER TABLE "lessons" DROP COLUMN IF EXISTS "speaker_profile_id";
  ALTER TABLE "courses" DROP COLUMN IF EXISTS "speaker_profile_id";
  DROP TABLE IF EXISTS "speakers";
  DROP TYPE IF EXISTS "public"."enum_speakers_status";`)
}
