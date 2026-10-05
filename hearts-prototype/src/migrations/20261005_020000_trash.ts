import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** C15: Payload trash adds deletedAt. SQLite creates the column through push. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "courses_deleted_at_idx" ON "courses" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "units_deleted_at_idx" ON "units" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "lessons_deleted_at_idx" ON "lessons" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "engagement_points" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "engagement_points_deleted_at_idx" ON "engagement_points" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "circle_answers" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "circle_answers_deleted_at_idx" ON "circle_answers" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "access_codes" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "access_codes_deleted_at_idx" ON "access_codes" USING btree ("deleted_at");`)
  await db.execute(sql`ALTER TABLE "packs" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "packs_deleted_at_idx" ON "packs" USING btree ("deleted_at");`)
  await db.execute(sql`
    DO $$ BEGIN
      IF to_regclass('public.announcements') IS NOT NULL THEN
        ALTER TABLE "announcements" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp(3) with time zone;
        CREATE INDEX IF NOT EXISTS "announcements_deleted_at_idx" ON "announcements" USING btree ("deleted_at");
      END IF;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "courses_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "courses" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "units_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "units" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "lessons_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "engagement_points_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "engagement_points" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "circle_answers_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "circle_answers" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "access_codes_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "access_codes" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`DROP INDEX IF EXISTS "packs_deleted_at_idx";`)
  await db.execute(sql`ALTER TABLE "packs" DROP COLUMN IF EXISTS "deleted_at";`)
  await db.execute(sql`
    DO $$ BEGIN
      IF to_regclass('public.announcements') IS NOT NULL THEN
        DROP INDEX IF EXISTS "announcements_deleted_at_idx";
        ALTER TABLE "announcements" DROP COLUMN IF EXISTS "deleted_at";
      END IF;
    END $$;
  `)
}
