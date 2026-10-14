import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "talk_tiers" ADD COLUMN IF NOT EXISTS "line_tidy" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "talk_tiers" DROP COLUMN IF EXISTS "line_tidy";`)
}
