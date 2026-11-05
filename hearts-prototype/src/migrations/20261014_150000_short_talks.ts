import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Hide talks under five minutes on the live database. This runs with the other Postgres
 * migrations at startup, so a reseed is not required. Rows stay in the library and can be restored.
 * The same mark also runs on each boot, and again is safe if these rows are already hidden.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "too_short" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "short_waived" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "cuts" ADD COLUMN IF NOT EXISTS "too_short" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "ladder_items" ADD COLUMN IF NOT EXISTS "too_short" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "hidden_note" varchar;`)
  await db.execute(sql`
    UPDATE "lessons"
    SET "too_short" = true
    WHERE "duration_seconds" IS NOT NULL
      AND "duration_seconds" > 0
      AND "duration_seconds" < 300
      AND COALESCE("short_waived", false) = false
      AND COALESCE("too_short", false) = false;
  `)
  await db.execute(sql`
    UPDATE "cuts"
    SET "too_short" = true
    WHERE "lesson_id" IN (SELECT "id" FROM "lessons" WHERE "too_short" = true)
      AND COALESCE("too_short", false) = false;
  `)
  await db.execute(sql`
    UPDATE "ladder_items"
    SET "too_short" = true
    WHERE "lesson_id" IN (SELECT "id" FROM "lessons" WHERE "too_short" = true)
      AND COALESCE("too_short", false) = false;
  `)
  await db.execute(sql`
    UPDATE "courses"
    SET "hidden" = true,
        "hidden_note" = 'Hidden because every talk is under 5 minutes.'
    WHERE "id" IN (
      SELECT "course_id"
      FROM "lessons"
      WHERE "course_id" IS NOT NULL
      GROUP BY "course_id"
      HAVING COUNT(*) > 0
        AND COUNT(*) = SUM(CASE WHEN "too_short" = true THEN 1 ELSE 0 END)
    )
      AND COALESCE("hidden", false) = false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "courses"
    SET "hidden" = false, "hidden_note" = NULL
    WHERE "hidden_note" = 'Hidden because every talk is under 5 minutes.';
  `)
  await db.execute(sql`ALTER TABLE "courses" DROP COLUMN IF EXISTS "hidden_note";`)
  await db.execute(sql`ALTER TABLE "ladder_items" DROP COLUMN IF EXISTS "too_short";`)
  await db.execute(sql`ALTER TABLE "cuts" DROP COLUMN IF EXISTS "too_short";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "short_waived";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "too_short";`)
}
