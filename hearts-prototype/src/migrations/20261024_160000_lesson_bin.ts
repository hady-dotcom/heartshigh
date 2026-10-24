import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** A binned talk stays in the database. Learners and courses skip it until it is put back. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "binned" boolean DEFAULT false;`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "lessons_binned_idx" ON "lessons" ("binned");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "lessons_binned_idx";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "binned";`)
}
