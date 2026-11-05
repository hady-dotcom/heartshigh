import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** A teacher can mark a shared answer done without writing a reply. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "workbook_entries" ADD COLUMN IF NOT EXISTS "done_at" timestamp(3) with time zone;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "workbook_entries" DROP COLUMN IF EXISTS "done_at";`)
}
