import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "vertical" boolean DEFAULT false;`)
  await db.execute(sql`UPDATE "lessons" SET "vertical" = true WHERE ("youtube_url" ~* 'youtube\\.com/shorts/' OR "source_url" ~* 'youtube\\.com/shorts/') AND "vertical" IS DISTINCT FROM true;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "vertical";`)
}
