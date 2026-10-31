import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Earlier copies of a talk's transcript, so the Transcripts desk can undo a save. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "transcript_edits" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "lessons" DROP COLUMN IF EXISTS "transcript_edits";`)
}
