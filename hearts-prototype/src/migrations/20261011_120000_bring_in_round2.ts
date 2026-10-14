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

    -- Payload reads these on every save. Preferences only relate to users, so that rels table is unchanged.
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "channel_speakers_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "helper_tokens_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "bring_in_previews_id" integer;

    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_channel_speakers_fk" FOREIGN KEY ("channel_speakers_id") REFERENCES "public"."channel_speakers"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_helper_tokens_fk" FOREIGN KEY ("helper_tokens_id") REFERENCES "public"."helper_tokens"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bring_in_previews_fk" FOREIGN KEY ("bring_in_previews_id") REFERENCES "public"."bring_in_previews"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_channel_speakers_id_idx" ON "payload_locked_documents_rels" USING btree ("channel_speakers_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_helper_tokens_id_idx" ON "payload_locked_documents_rels" USING btree ("helper_tokens_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bring_in_previews_id_idx" ON "payload_locked_documents_rels" USING btree ("bring_in_previews_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_channel_speakers_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_helper_tokens_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_bring_in_previews_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_channel_speakers_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_helper_tokens_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_bring_in_previews_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "channel_speakers_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "helper_tokens_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bring_in_previews_id";
    DROP TABLE IF EXISTS "bring_in_previews";
    DROP TABLE IF EXISTS "helper_tokens";
    DROP TABLE IF EXISTS "channel_speakers";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "ghunya_heading";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "jibril_section";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "publish_state";
    DROP TYPE IF EXISTS "public"."enum_lessons_publish_state";
  `)
}
