import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "burned_captions" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "thumbnail_clean" boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "burned_captions";`)
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "thumbnail_clean";`)
}
