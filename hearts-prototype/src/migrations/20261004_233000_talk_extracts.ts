import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Talk extracts: many hors d'oeuvres and appetisers on one talk.
 * Copies the old single pair from talk_tiers with no data loss, then points
 * each hors at the appetiser that holds it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_talk_extracts_kind" AS ENUM('hors', 'appetiser');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_talk_extracts_status" AS ENUM('draft', 'suggested', 'approved', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_talk_extracts_arc" AS ENUM('hook', 'turn', 'land');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "talk_extracts" (
      "id" serial PRIMARY KEY NOT NULL,
      "lesson_id" integer NOT NULL,
      "kind" "enum_talk_extracts_kind" NOT NULL,
      "start" numeric NOT NULL,
      "end" numeric NOT NULL,
      "quote" varchar,
      "words" jsonb,
      "score" numeric,
      "status" "enum_talk_extracts_status" DEFAULT 'suggested',
      "door" numeric,
      "seat_id" integer,
      "order" numeric DEFAULT 1,
      "parent_id" integer,
      "arc" "enum_talk_extracts_arc",
      "hook" varchar,
      "turn" varchar,
      "land" varchar,
      "source" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "talk_extracts_lesson_idx" ON "talk_extracts" USING btree ("lesson_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "talk_extracts_parent_idx" ON "talk_extracts" USING btree ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "talk_extracts_seat_idx" ON "talk_extracts" USING btree ("seat_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "talk_extracts_updated_at_idx" ON "talk_extracts" USING btree ("updated_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "talk_extracts_created_at_idx" ON "talk_extracts" USING btree ("created_at");`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "talk_extracts" ADD CONSTRAINT "talk_extracts_lesson_id_lessons_id_fk"
        FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "talk_extracts" ADD CONSTRAINT "talk_extracts_parent_id_talk_extracts_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."talk_extracts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "talk_extracts" ADD CONSTRAINT "talk_extracts_seat_id_seats_id_fk"
        FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "talk_extracts_id" integer;`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_talk_extracts_fk"
        FOREIGN KEY ("talk_extracts_id") REFERENCES "public"."talk_extracts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_talk_extracts_id_idx" ON "payload_locked_documents_rels" USING btree ("talk_extracts_id");`)

  await db.execute(sql`
    INSERT INTO "talk_extracts" (
      "lesson_id", "kind", "start", "end", "quote", "hook", "turn", "land",
      "status", "order", "source", "created_at", "updated_at"
    )
    SELECT
      t."lesson_id",
      'appetiser',
      t."appetiser_start",
      t."appetiser_end",
      COALESCE(t."land", t."hook", ''),
      t."hook",
      t."turn",
      t."land",
      CASE t."status" WHEN 'checked' THEN 'approved'::"enum_talk_extracts_status" WHEN 'rejected' THEN 'rejected'::"enum_talk_extracts_status" ELSE 'suggested'::"enum_talk_extracts_status" END,
      1,
      'talk-tier',
      now(),
      now()
    FROM "talk_tiers" t
    WHERE t."lesson_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "talk_extracts" e
        WHERE e."lesson_id" = t."lesson_id" AND e."kind" = 'appetiser'
          AND e."start" = t."appetiser_start" AND e."end" = t."appetiser_end"
      );
  `)
  await db.execute(sql`
    INSERT INTO "talk_extracts" (
      "lesson_id", "kind", "start", "end", "quote", "words", "status", "order",
      "parent_id", "arc", "source", "created_at", "updated_at"
    )
    SELECT
      t."lesson_id",
      'hors',
      t."hors_start",
      t."hors_end",
      t."hors_quote",
      t."hors_lines",
      CASE t."status" WHEN 'checked' THEN 'approved'::"enum_talk_extracts_status" WHEN 'rejected' THEN 'rejected'::"enum_talk_extracts_status" ELSE 'suggested'::"enum_talk_extracts_status" END,
      1,
      a."id",
      CASE
        WHEN t."hors_start" + (t."hors_end" - t."hors_start") / 2 < t."appetiser_start" + (t."appetiser_end" - t."appetiser_start") / 3 THEN 'hook'::"enum_talk_extracts_arc"
        WHEN t."hors_start" + (t."hors_end" - t."hors_start") / 2 < t."appetiser_start" + 2 * (t."appetiser_end" - t."appetiser_start") / 3 THEN 'turn'::"enum_talk_extracts_arc"
        ELSE 'land'::"enum_talk_extracts_arc"
      END,
      'talk-tier',
      now(),
      now()
    FROM "talk_tiers" t
    JOIN "talk_extracts" a
      ON a."lesson_id" = t."lesson_id"
     AND a."kind" = 'appetiser'
     AND a."start" = t."appetiser_start"
     AND a."end" = t."appetiser_end"
    WHERE t."lesson_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "talk_extracts" e
        WHERE e."lesson_id" = t."lesson_id" AND e."kind" = 'hors'
          AND e."start" = t."hors_start" AND e."end" = t."hors_end"
      );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_talk_extracts_fk";`)
  await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_rels_talk_extracts_id_idx";`)
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "talk_extracts_id";`)
  await db.execute(sql`DROP TABLE IF EXISTS "talk_extracts";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_talk_extracts_arc";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_talk_extracts_status";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_talk_extracts_kind";`)
}
