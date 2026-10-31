import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Optional uploaded covers. Empty means the colour preview draws one. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses" ADD COLUMN IF NOT EXISTS "cover_id" integer;
    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "cover_id" integer;
    CREATE INDEX IF NOT EXISTS "courses_cover_idx" ON "courses" USING btree ("cover_id");
    CREATE INDEX IF NOT EXISTS "lessons_cover_idx" ON "lessons" USING btree ("cover_id");
    DO $$ BEGIN
      ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "lessons" ADD CONSTRAINT "lessons_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_cover_id_media_id_fk";
    ALTER TABLE "lessons" DROP CONSTRAINT IF EXISTS "lessons_cover_id_media_id_fk";
    DROP INDEX IF EXISTS "courses_cover_idx";
    DROP INDEX IF EXISTS "lessons_cover_idx";
    ALTER TABLE "courses" DROP COLUMN IF EXISTS "cover_id";
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "cover_id";
  `)
}
