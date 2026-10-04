import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "schedules" ADD COLUMN IF NOT EXISTS "minutes_per_day" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "schedules" DROP COLUMN IF EXISTS "minutes_per_day";`)
}
