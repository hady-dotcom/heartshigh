import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** A master sheet is a collection. Each module is its own course, in sheet order. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "sheet_title" varchar;
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "sheet_order" numeric;
    CREATE INDEX IF NOT EXISTS "courses_sheet_title_idx" ON "courses" USING btree ("sheet_title");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "courses_sheet_title_idx";
    ALTER TABLE "courses" DROP COLUMN IF EXISTS "sheet_order";
    ALTER TABLE "courses" DROP COLUMN IF EXISTS "sheet_title";
  `)
}
