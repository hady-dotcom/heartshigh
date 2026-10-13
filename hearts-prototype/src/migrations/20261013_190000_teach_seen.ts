import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** When each staff member last opened Teach, stored per portal so new shared answers can be counted. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "teach_seen" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "teach_seen";`)
}
