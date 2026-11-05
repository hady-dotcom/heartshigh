import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** New portals are plain. Existing rows keep the colour and kind they already have. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ALTER COLUMN "colour" SET DEFAULT '#2563EB';
    ALTER TABLE "portals" ALTER COLUMN "kind" SET DEFAULT 'other';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ALTER COLUMN "colour" SET DEFAULT '#1f4d3a';
    ALTER TABLE "portals" ALTER COLUMN "kind" SET DEFAULT 'mosque';
  `)
}
