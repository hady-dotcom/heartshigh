import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** A public upload row for each See how page whose filmed clip was replaced from the master desk. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "see_how_clips" (
      "id" serial PRIMARY KEY NOT NULL,
      "page" varchar NOT NULL,
      "alt" varchar,
      "prefix" varchar DEFAULT '',
      "_objectkey" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "url" varchar,
      "thumbnail_u_r_l" varchar,
      "filename" varchar,
      "mime_type" varchar,
      "filesize" numeric,
      "width" numeric,
      "height" numeric,
      "focal_x" numeric,
      "focal_y" numeric
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "see_how_clips_page_idx" ON "see_how_clips" USING btree ("page");
    CREATE UNIQUE INDEX IF NOT EXISTS "see_how_clips_filename_idx" ON "see_how_clips" USING btree ("filename");
    CREATE INDEX IF NOT EXISTS "see_how_clips_updated_at_idx" ON "see_how_clips" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "see_how_clips_created_at_idx" ON "see_how_clips" USING btree ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "see_how_clips_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_see_how_clips_fk" FOREIGN KEY ("see_how_clips_id") REFERENCES "public"."see_how_clips"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_see_how_clips_id_idx" ON "payload_locked_documents_rels" USING btree ("see_how_clips_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_see_how_clips_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_see_how_clips_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "see_how_clips_id";
    DROP TABLE IF EXISTS "see_how_clips";
  `)
}
