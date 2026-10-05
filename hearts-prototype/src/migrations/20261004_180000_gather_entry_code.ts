import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "gatherings" ADD COLUMN IF NOT EXISTS "entry_code" varchar;
  ALTER TYPE "public"."enum_gather_checkins_method" ADD VALUE IF NOT EXISTS 'code';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "gatherings" DROP COLUMN IF EXISTS "entry_code";
  `)
}
