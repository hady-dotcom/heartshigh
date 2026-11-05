import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Null means “use registry defaults” — every feature that exists today stays on. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "features" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "portals" DROP COLUMN IF EXISTS "features";`)
}
