import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_harvest_entries_kind" ADD VALUE IF NOT EXISTS 'line';
  `)
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_harvest_entries_surface" AS ENUM('hors', 'appetiser', 'talk');
   EXCEPTION
    WHEN duplicate_object THEN null;
   END $$;
   ALTER TABLE "harvest_entries" ADD COLUMN IF NOT EXISTS "seconds" numeric;
   ALTER TABLE "harvest_entries" ADD COLUMN IF NOT EXISTS "speaker" varchar;
   ALTER TABLE "harvest_entries" ADD COLUMN IF NOT EXISTS "door" varchar;
   ALTER TABLE "harvest_entries" ADD COLUMN IF NOT EXISTS "surface" "public"."enum_harvest_entries_surface";
   ALTER TABLE "harvest_entries" ADD COLUMN IF NOT EXISTS "gathered_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "harvest_entries" DROP COLUMN IF EXISTS "gathered_at";
   ALTER TABLE "harvest_entries" DROP COLUMN IF EXISTS "surface";
   ALTER TABLE "harvest_entries" DROP COLUMN IF EXISTS "door";
   ALTER TABLE "harvest_entries" DROP COLUMN IF EXISTS "speaker";
   ALTER TABLE "harvest_entries" DROP COLUMN IF EXISTS "seconds";
  `)
}
