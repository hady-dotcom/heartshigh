import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** How many days a test runs after it is started. The desk form uses 14 and does not ask. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "experiments" ADD COLUMN IF NOT EXISTS "duration_days" numeric DEFAULT 14;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "experiments" DROP COLUMN IF EXISTS "duration_days";`)
}
