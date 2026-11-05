import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_doors_section" AS ENUM('Sitting', 'Islam', 'Iman', 'Ihsan', 'Hour', 'Trunk');
  CREATE TABLE "doors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"number" numeric NOT NULL,
  	"section" "enum_doors_section" NOT NULL,
  	"title" varchar NOT NULL,
  	"clauses" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "doors_id" integer;
  CREATE UNIQUE INDEX "doors_number_idx" ON "doors" USING btree ("number");
  CREATE INDEX "doors_updated_at_idx" ON "doors" USING btree ("updated_at");
  CREATE INDEX "doors_created_at_idx" ON "doors" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_doors_fk" FOREIGN KEY ("doors_id") REFERENCES "public"."doors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_doors_id_idx" ON "payload_locked_documents_rels" USING btree ("doors_id");`)
  // The 20 working doors learners see, each over the clauses it absorbs.
  await db.execute(sql`
  INSERT INTO "doors" ("number", "section", "title", "clauses") VALUES
  (1, 'Sitting', 'One day', '[1]'::jsonb),
  (2, 'Sitting', 'The sitting: how he came and sat with the Messenger', '[2,3,4,5,6,7,8,9,10,11,12]'::jsonb),
  (3, 'Islam', 'About Islam', '[13,19,20]'::jsonb),
  (4, 'Islam', 'Two testimonies', '[14]'::jsonb),
  (5, 'Islam', 'Prayer', '[15]'::jsonb),
  (6, 'Islam', 'Zakat', '[16]'::jsonb),
  (7, 'Islam', 'Fasting Ramadan', '[17]'::jsonb),
  (8, 'Islam', 'Hajj', '[18]'::jsonb),
  (9, 'Iman', 'About iman', '[21,28]'::jsonb),
  (10, 'Iman', 'Believe in Allah', '[22]'::jsonb),
  (11, 'Iman', 'His angels', '[23]'::jsonb),
  (12, 'Iman', 'His Books', '[24]'::jsonb),
  (13, 'Iman', 'His Messengers', '[25]'::jsonb),
  (14, 'Iman', 'The Last Day', '[26]'::jsonb),
  (15, 'Iman', 'Qadar, good and evil', '[27]'::jsonb),
  (16, 'Ihsan', 'Ihsan: worship as though you see Him', '[29,30,31]'::jsonb),
  (17, 'Hour', 'The Hour: when, and what cannot be known', '[32,33]'::jsonb),
  (18, 'Hour', 'The Hour: the two signs', '[34,35]'::jsonb),
  (19, 'Trunk', 'It was Jibril', '[36,37,38,39,40]'::jsonb),
  (20, 'Trunk', 'He came to teach you your religion', '[41]'::jsonb)
  ON CONFLICT ("number") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "doors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "doors" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_doors_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_doors_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "doors_id";
  DROP TYPE "public"."enum_doors_section";`)
}
