import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Encrypted per-portal AI connection. Null means the portal has not connected an account. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "ai_connection" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" DROP COLUMN IF EXISTS "ai_connection";`)
}
