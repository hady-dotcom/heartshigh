import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_compass_serves_kind" AS ENUM('hors', 'appetiser', 'course', 'talk');

  ALTER TABLE "persona_bands" ADD COLUMN IF NOT EXISTS "version" numeric DEFAULT 1;
  ALTER TABLE "persona_bands" ADD COLUMN IF NOT EXISTS "description" varchar;
  ALTER TABLE "persona_bands" ADD COLUMN IF NOT EXISTS "doors" jsonb;
  ALTER TABLE "persona_bands" ADD COLUMN IF NOT EXISTS "talks" jsonb;

  ALTER TABLE "compass_attempts" ADD COLUMN IF NOT EXISTS "life_keys" jsonb;
  ALTER TABLE "compass_attempts" ADD COLUMN IF NOT EXISTS "life_note" varchar;
  ALTER TABLE "compass_attempts" ADD COLUMN IF NOT EXISTS "form_key" varchar;
  ALTER TABLE "compass_attempts" ADD COLUMN IF NOT EXISTS "demo_key" varchar;
  CREATE UNIQUE INDEX IF NOT EXISTS "compass_attempts_demo_key_idx" ON "compass_attempts" USING btree ("demo_key");

  CREATE TABLE IF NOT EXISTS "compass_mixes" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer NOT NULL,
    "deficit" numeric DEFAULT 60,
    "strength" numeric DEFAULT 25,
    "discovery" numeric DEFAULT 15,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "compass_mixes" ADD CONSTRAINT "compass_mixes_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX IF NOT EXISTS "compass_mixes_portal_idx" ON "compass_mixes" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "compass_mixes_updated_at_idx" ON "compass_mixes" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "compass_mixes_created_at_idx" ON "compass_mixes" USING btree ("created_at");

  CREATE TABLE IF NOT EXISTS "compass_serves" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer NOT NULL,
    "lesson_id" integer,
    "title" varchar NOT NULL,
    "kind" "enum_compass_serves_kind" DEFAULT 'talk',
    "why" varchar,
    "mix" jsonb,
    "at" timestamp(3) with time zone NOT NULL,
    "door" numeric,
    "bucket" varchar,
    "demo_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "compass_serves" ADD CONSTRAINT "compass_serves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "compass_serves" ADD CONSTRAINT "compass_serves_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "compass_serves" ADD CONSTRAINT "compass_serves_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "compass_serves_user_idx" ON "compass_serves" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "compass_serves_portal_idx" ON "compass_serves" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "compass_serves_lesson_idx" ON "compass_serves" USING btree ("lesson_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "compass_serves_demo_key_idx" ON "compass_serves" USING btree ("demo_key");
  CREATE INDEX IF NOT EXISTS "compass_serves_updated_at_idx" ON "compass_serves" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "compass_serves_created_at_idx" ON "compass_serves" USING btree ("created_at");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "compass_mixes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "compass_serves_id" integer;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_compass_mixes_fk" FOREIGN KEY ("compass_mixes_id") REFERENCES "public"."compass_mixes"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_compass_serves_fk" FOREIGN KEY ("compass_serves_id") REFERENCES "public"."compass_serves"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_compass_mixes_id_idx" ON "payload_locked_documents_rels" USING btree ("compass_mixes_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_compass_serves_id_idx" ON "payload_locked_documents_rels" USING btree ("compass_serves_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_compass_mixes_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_compass_serves_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_compass_mixes_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_compass_serves_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "compass_mixes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "compass_serves_id";
  DROP TABLE IF EXISTS "compass_serves" CASCADE;
  DROP TABLE IF EXISTS "compass_mixes" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_compass_serves_kind";
  ALTER TABLE "compass_attempts" DROP COLUMN IF EXISTS "life_keys";
  ALTER TABLE "compass_attempts" DROP COLUMN IF EXISTS "life_note";
  ALTER TABLE "compass_attempts" DROP COLUMN IF EXISTS "form_key";
  ALTER TABLE "compass_attempts" DROP COLUMN IF EXISTS "demo_key";
  ALTER TABLE "persona_bands" DROP COLUMN IF EXISTS "version";
  ALTER TABLE "persona_bands" DROP COLUMN IF EXISTS "description";
  ALTER TABLE "persona_bands" DROP COLUMN IF EXISTS "doors";
  ALTER TABLE "persona_bands" DROP COLUMN IF EXISTS "talks";
  `)
}