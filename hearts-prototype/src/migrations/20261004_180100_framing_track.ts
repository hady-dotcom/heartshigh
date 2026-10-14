import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "cuts" ADD COLUMN IF NOT EXISTS "framing_track" jsonb;`)
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "framing_track" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "cuts" DROP COLUMN IF EXISTS "framing_track";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "framing_track";`)
}
