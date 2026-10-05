import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "owner_id" integer;
  ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "purpose" varchar;

  DO $$ BEGIN
    CREATE TYPE "public"."enum_reports_reason" AS ENUM('unkind', 'misleading', 'spam', 'at-risk', 'other');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_reports_status" AS ENUM('open', 'hidden', 'kept', 'escalated');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_moderation_hides_source" AS ENUM('report', 'screen', 'staff');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_safeguarding_alerts_source" AS ENUM('crisis', 'screen', 'report');
  EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_announcements_audience" AS ENUM('everyone', 'teachers', 'code');
  EXCEPTION WHEN duplicate_object THEN null; END $$;

  CREATE TABLE IF NOT EXISTS "reports" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "reporter_id" integer NOT NULL,
    "target_type" varchar NOT NULL,
    "target_id" numeric NOT NULL,
    "reason" "enum_reports_reason" NOT NULL,
    "note" varchar,
    "status" "enum_reports_status" DEFAULT 'open',
    "handled_by_id" integer,
    "handled_at" timestamp(3) with time zone,
    "handle_note" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "moderation_hides" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "target_type" varchar NOT NULL,
    "target_id" numeric NOT NULL,
    "reason" varchar,
    "source" "enum_moderation_hides_source" DEFAULT 'report',
    "hidden" boolean DEFAULT true,
    "by_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "safeguarding_alerts" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "learner_id" integer NOT NULL,
    "source" "enum_safeguarding_alerts_source" NOT NULL,
    "target_type" varchar,
    "target_id" numeric,
    "seen_by_id" integer,
    "seen_at" timestamp(3) with time zone,
    "outcome" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "announcements" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "body" varchar NOT NULL,
    "audience" "enum_announcements_audience" DEFAULT 'everyone',
    "access_code_id" integer,
    "publish_at" timestamp(3) with time zone,
    "created_by_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "announcement_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "rate_hits" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "circle_mutes" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "user_id" integer NOT NULL,
    "until" timestamp(3) with time zone NOT NULL,
    "by_id" integer,
    "reason" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  UPDATE "media" SET "purpose" = 'answer'
  WHERE "id" IN (
    SELECT "image_id" FROM "answers" WHERE "image_id" IS NOT NULL
    UNION SELECT "audio_id" FROM "answers" WHERE "audio_id" IS NOT NULL
    UNION SELECT "video_id" FROM "answers" WHERE "video_id" IS NOT NULL
  ) AND "purpose" IS NULL;

  UPDATE "media" SET "purpose" = 'gather-photo'
  WHERE "id" IN (SELECT "image_id" FROM "gather_photos" WHERE "image_id" IS NOT NULL)
    AND "purpose" IS NULL;

  UPDATE "media" SET "purpose" = 'film'
  WHERE "id" IN (SELECT "film_id" FROM "lessons" WHERE "film_id" IS NOT NULL)
    AND "purpose" IS NULL;

  UPDATE "media" SET "purpose" = 'portal-asset' WHERE "purpose" IS NULL;

  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."image_id" = "media"."id";
  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."audio_id" = "media"."id";
  UPDATE "media" SET "owner_id" = a."user_id"
  FROM "answers" a
  WHERE "media"."owner_id" IS NULL AND a."video_id" = "media"."id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "circle_mutes";
  DROP TABLE IF EXISTS "rate_hits";
  DROP TABLE IF EXISTS "announcement_dismissals";
  DROP TABLE IF EXISTS "announcements";
  DROP TABLE IF EXISTS "safeguarding_alerts";
  DROP TABLE IF EXISTS "moderation_hides";
  DROP TABLE IF EXISTS "reports";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "owner_id";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "purpose";
  `)
}
