import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Lane D: classes, join rules and ops events. SQLite creates these through push. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "classes" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "colour" varchar DEFAULT '#0E2A2B',
      "note" varchar,
      "portal_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "classes_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "users_id" integer
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "class_join_rules" (
      "id" serial PRIMARY KEY NOT NULL,
      "access_code_id" integer,
      "class_id" integer,
      "portal_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ops_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" varchar NOT NULL,
      "ok" boolean DEFAULT true,
      "at" timestamp(3) with time zone NOT NULL,
      "detail" jsonb,
      "portal_id" integer,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "classes_portal_idx" ON "classes" USING btree ("portal_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "classes_created_at_idx" ON "classes" USING btree ("created_at");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "class_join_rules_portal_idx" ON "class_join_rules" USING btree ("portal_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ops_events_kind_idx" ON "ops_events" USING btree ("kind");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "ops_events_at_idx" ON "ops_events" USING btree ("at");`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "classes" ADD CONSTRAINT "classes_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "classes_rels" ADD CONSTRAINT "classes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "class_join_rules" ADD CONSTRAINT "class_join_rules_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "class_join_rules" ADD CONSTRAINT "class_join_rules_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "classes_id" integer;
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "class_join_rules_id" integer;
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "ops_events_id" integer;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "class_join_rules" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "classes_rels" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "classes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "ops_events" CASCADE;`)
}
