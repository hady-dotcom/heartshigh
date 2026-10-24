import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** The desk bin: a copy of a deleted row, so Undo can put it back. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_desk_bin_mode" AS ENUM('hide', 'gone');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "desk_bin" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" varchar NOT NULL,
      "title" varchar NOT NULL,
      "record_id" numeric,
      "portal_id" integer,
      "actor_id" integer,
      "mode" "enum_desk_bin_mode" NOT NULL,
      "snapshot" jsonb NOT NULL,
      "undone" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "desk_bin_kind_idx" ON "desk_bin" USING btree ("kind");
    CREATE INDEX IF NOT EXISTS "desk_bin_record_id_idx" ON "desk_bin" USING btree ("record_id");
    CREATE INDEX IF NOT EXISTS "desk_bin_undone_idx" ON "desk_bin" USING btree ("undone");
    CREATE INDEX IF NOT EXISTS "desk_bin_updated_at_idx" ON "desk_bin" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "desk_bin_created_at_idx" ON "desk_bin" USING btree ("created_at");
    DO $$ BEGIN
      ALTER TABLE "desk_bin" ADD CONSTRAINT "desk_bin_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "desk_bin" ADD CONSTRAINT "desk_bin_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "desk_bin_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_desk_bin_fk" FOREIGN KEY ("desk_bin_id") REFERENCES "public"."desk_bin"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_desk_bin_id_idx" ON "payload_locked_documents_rels" USING btree ("desk_bin_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_desk_bin_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_desk_bin_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "desk_bin_id";
    DROP TABLE IF EXISTS "desk_bin";
    DROP TYPE IF EXISTS "public"."enum_desk_bin_mode";
  `)
}
