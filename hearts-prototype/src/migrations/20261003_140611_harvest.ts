import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "scripture_cache" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"kind" varchar,
  	"data" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "harvest_entries" ADD COLUMN "seconds" numeric;
  ALTER TABLE "harvest_entries" ADD COLUMN "surah" numeric;
  ALTER TABLE "harvest_entries" ADD COLUMN "ayah" numeric;
  ALTER TABLE "harvest_entries" ADD COLUMN "matched_by" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "collection" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "hadith_number" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "hadith_text" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "hadith_arabic" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "grading" varchar;
  ALTER TABLE "harvest_entries" ADD COLUMN "seen_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "scripture_cache_id" integer;
  CREATE UNIQUE INDEX "scripture_cache_key_idx" ON "scripture_cache" USING btree ("key");
  CREATE INDEX "scripture_cache_updated_at_idx" ON "scripture_cache" USING btree ("updated_at");
  CREATE INDEX "scripture_cache_created_at_idx" ON "scripture_cache" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scripture_cache_fk" FOREIGN KEY ("scripture_cache_id") REFERENCES "public"."scripture_cache"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_scripture_cache_id_idx" ON "payload_locked_documents_rels" USING btree ("scripture_cache_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "scripture_cache" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "scripture_cache" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_scripture_cache_fk";
  
  DROP INDEX "payload_locked_documents_rels_scripture_cache_id_idx";
  ALTER TABLE "harvest_entries" DROP COLUMN "seconds";
  ALTER TABLE "harvest_entries" DROP COLUMN "surah";
  ALTER TABLE "harvest_entries" DROP COLUMN "ayah";
  ALTER TABLE "harvest_entries" DROP COLUMN "matched_by";
  ALTER TABLE "harvest_entries" DROP COLUMN "collection";
  ALTER TABLE "harvest_entries" DROP COLUMN "hadith_number";
  ALTER TABLE "harvest_entries" DROP COLUMN "hadith_text";
  ALTER TABLE "harvest_entries" DROP COLUMN "hadith_arabic";
  ALTER TABLE "harvest_entries" DROP COLUMN "grading";
  ALTER TABLE "harvest_entries" DROP COLUMN "seen_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "scripture_cache_id";`)
}
