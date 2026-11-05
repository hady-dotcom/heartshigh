import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Keep the hash of a private Vimeo link, and let a transcript say it came from Vimeo. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_lessons_transcript_source" ADD VALUE IF NOT EXISTS 'vimeo';
  ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "vimeo_hash" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "lessons" DROP COLUMN IF EXISTS "vimeo_hash";`)
}
