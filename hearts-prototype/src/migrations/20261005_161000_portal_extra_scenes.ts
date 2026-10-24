import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "opening_configs" ADD COLUMN IF NOT EXISTS "extra_scenes" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "opening_configs" DROP COLUMN IF EXISTS "extra_scenes";
  `)
}
