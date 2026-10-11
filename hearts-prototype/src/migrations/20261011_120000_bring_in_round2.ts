import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Draft talks, Jibril and Ghunya on a film, helper tokens, and channel-to-speaker maps. Existing talks stay published. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_lessons_publish_state" AS ENUM('draft', 'published');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "publish_state" "enum_lessons_publish_state" DEFAULT 'published';
    UPDATE "lessons" SET "publish_state" = 'published' WHERE "publish_state" IS NULL;
    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "jibril_section" varchar;
    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "ghunya_heading" varchar;

    CREATE TABLE IF NOT EXISTS "channel_speakers" (
      "id" serial PRIMARY KEY NOT NULL,
      "channel_key" varchar NOT NULL,
      "label" varchar,
      "speaker" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "channel_speakers_channel_key_idx" ON "channel_speakers" ("channel_key");

    CREATE TABLE IF NOT EXISTS "helper_tokens" (
      "id" serial PRIMARY KEY NOT NULL,
      "label" varchar NOT NULL,
      "token_hash" varchar NOT NULL,
      "token_prefix" varchar,
      "created_by_id" integer,
      "revoked_at" timestamp(3) with time zone,
      "last_used_at" timestamp(3) with time zone,
      "shown_once" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "helper_tokens_token_hash_idx" ON "helper_tokens" ("token_hash");

    CREATE TABLE IF NOT EXISTS "bring_in_previews" (
      "id" serial PRIMARY KEY NOT NULL,
      "actor_id" integer,
      "portal_id" integer,
      "body" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "bring_in_previews";
    DROP TABLE IF EXISTS "helper_tokens";
    DROP TABLE IF EXISTS "channel_speakers";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "ghunya_heading";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "jibril_section";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "publish_state";
    DROP TYPE IF EXISTS "public"."enum_lessons_publish_state";
  `)
}
