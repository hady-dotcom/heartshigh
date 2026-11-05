import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "time_zone" varchar DEFAULT 'Europe/London';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" DROP COLUMN IF EXISTS "time_zone";`)
}
