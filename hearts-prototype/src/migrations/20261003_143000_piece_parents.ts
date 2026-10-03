import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_completions_source_level" AS ENUM('talk', 'hors', 'appetiser');
  CREATE TYPE "public"."enum_answers_source_level" AS ENUM('talk', 'hors', 'appetiser');
  ALTER TABLE "ladder_items" ADD COLUMN "parent_ref" varchar;
  ALTER TABLE "talk_tiers" ADD COLUMN "parents" jsonb;
  ALTER TABLE "completions" ADD COLUMN "source_level" "enum_completions_source_level" DEFAULT 'talk';
  ALTER TABLE "answers" ADD COLUMN "source_level" "enum_answers_source_level";
  CREATE TABLE "drawn_to" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "user_id" integer NOT NULL,
    "speaker" varchar NOT NULL,
    "speaker_slug" varchar NOT NULL,
    "linger" numeric DEFAULT 0,
    "learn_more" numeric DEFAULT 0,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  ALTER TABLE "drawn_to" ADD CONSTRAINT "drawn_to_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "drawn_to" ADD CONSTRAINT "drawn_to_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "ladder_items_parent_ref_idx" ON "ladder_items" USING btree ("parent_ref");
  CREATE INDEX "drawn_to_user_idx" ON "drawn_to" USING btree ("user_id");
  CREATE INDEX "drawn_to_speaker_slug_idx" ON "drawn_to" USING btree ("speaker_slug");
  CREATE INDEX "drawn_to_portal_idx" ON "drawn_to" USING btree ("portal_id");
  CREATE INDEX "drawn_to_updated_at_idx" ON "drawn_to" USING btree ("updated_at");
  CREATE INDEX "drawn_to_created_at_idx" ON "drawn_to" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "drawn_to_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_drawn_to_fk" FOREIGN KEY ("drawn_to_id") REFERENCES "public"."drawn_to"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_drawn_to_id_idx" ON "payload_locked_documents_rels" USING btree ("drawn_to_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_drawn_to_fk";
  DROP INDEX "payload_locked_documents_rels_drawn_to_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "drawn_to_id";
  DROP TABLE "drawn_to" CASCADE;
  ALTER TABLE "answers" DROP COLUMN "source_level";
  ALTER TABLE "completions" DROP COLUMN "source_level";
  ALTER TABLE "talk_tiers" DROP COLUMN "parents";
  DROP INDEX "ladder_items_parent_ref_idx";
  ALTER TABLE "ladder_items" DROP COLUMN "parent_ref";
  DROP TYPE "public"."enum_answers_source_level";
  DROP TYPE "public"."enum_completions_source_level";
  `)
}
