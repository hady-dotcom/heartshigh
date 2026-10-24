import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DO $$ BEGIN
    CREATE TYPE "public"."enum_experiments_status" AS ENUM('draft', 'running', 'paused', 'finished');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_experiments_allocation" AS ENUM('fixed', 'auto');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_experiments_variants_source" AS ENUM('staff', 'ai', 'mock');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_experiment_assignments_subject_kind" AS ENUM('learner', 'device');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_experiment_events_kind" AS ENUM('exposure', 'conversion');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS "experiments" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "name" varchar NOT NULL,
    "description" varchar,
    "status" "enum_experiments_status" DEFAULT 'draft' NOT NULL,
    "slot" varchar NOT NULL,
    "surface" varchar DEFAULT 'feed' NOT NULL,
    "portal_id" integer,
    "allocation" "enum_experiments_allocation" DEFAULT 'fixed' NOT NULL,
    "primary_metric" varchar DEFAULT 'clip_cta_tap' NOT NULL,
    "secondary_metrics" jsonb,
    "guardrail_note" varchar,
    "default_variant" varchar,
    "winner_key" varchar,
    "promoted" boolean DEFAULT false,
    "created_by_id" integer,
    "approved_by_id" integer,
    "started_at" timestamp(3) with time zone,
    "finished_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "experiments_variants" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "label" varchar NOT NULL,
    "payload" jsonb NOT NULL,
    "weight" numeric DEFAULT 1 NOT NULL,
    "approved" boolean DEFAULT false,
    "source" "enum_experiments_variants_source" DEFAULT 'staff'
  );

  CREATE TABLE IF NOT EXISTS "experiment_assignments" (
    "id" serial PRIMARY KEY NOT NULL,
    "experiment_id" integer NOT NULL,
    "experiment_key" varchar NOT NULL,
    "variant_key" varchar NOT NULL,
    "subject_kind" "enum_experiment_assignments_subject_kind" NOT NULL,
    "learner_id" integer,
    "device_id" varchar,
    "subject" varchar NOT NULL,
    "portal_id" integer,
    "sticky" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "experiment_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "experiment_id" integer NOT NULL,
    "experiment_key" varchar NOT NULL,
    "variant_key" varchar NOT NULL,
    "kind" "enum_experiment_events_kind" DEFAULT 'exposure' NOT NULL,
    "event" varchar NOT NULL,
    "learner_id" integer,
    "device_id" varchar,
    "subject" varchar NOT NULL,
    "session_id" varchar,
    "portal_id" integer,
    "props" jsonb,
    "at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "master_flags" ADD COLUMN IF NOT EXISTS "experiments_off" boolean DEFAULT false;
  ALTER TABLE "master_flags" ADD COLUMN IF NOT EXISTS "experiment_defaults" jsonb;

  DO $$ BEGIN
  ALTER TABLE "experiments" ADD CONSTRAINT "experiments_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiments" ADD CONSTRAINT "experiments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiments" ADD CONSTRAINT "experiments_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiments_variants" ADD CONSTRAINT "experiments_variants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_portal_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_portal_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "experiments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "experiment_assignments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "experiment_events_id" integer;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experiments_fk" FOREIGN KEY ("experiments_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experiment_assignments_fk" FOREIGN KEY ("experiment_assignments_id") REFERENCES "public"."experiment_assignments"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_experiment_events_fk" FOREIGN KEY ("experiment_events_id") REFERENCES "public"."experiment_events"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE UNIQUE INDEX IF NOT EXISTS "experiments_key_idx" ON "experiments" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "experiments_status_idx" ON "experiments" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "experiments_slot_idx" ON "experiments" USING btree ("slot");
  CREATE INDEX IF NOT EXISTS "experiments_surface_idx" ON "experiments" USING btree ("surface");
  CREATE INDEX IF NOT EXISTS "experiments_portal_idx" ON "experiments" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "experiments_updated_at_idx" ON "experiments" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "experiments_created_at_idx" ON "experiments" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "experiments_variants_order_idx" ON "experiments_variants" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "experiments_variants_parent_idx" ON "experiments_variants" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_experiment_idx" ON "experiment_assignments" USING btree ("experiment_id");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_experiment_key_idx" ON "experiment_assignments" USING btree ("experiment_key");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_variant_key_idx" ON "experiment_assignments" USING btree ("variant_key");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_learner_idx" ON "experiment_assignments" USING btree ("learner_id");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_device_id_idx" ON "experiment_assignments" USING btree ("device_id");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_subject_idx" ON "experiment_assignments" USING btree ("subject");
  CREATE INDEX IF NOT EXISTS "experiment_assignments_portal_idx" ON "experiment_assignments" USING btree ("portal_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "experiment_assignments_learner_uidx" ON "experiment_assignments" USING btree ("experiment_id", "learner_id") WHERE "learner_id" IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS "experiment_assignments_device_uidx" ON "experiment_assignments" USING btree ("experiment_id", "device_id") WHERE "device_id" IS NOT NULL;
  CREATE INDEX IF NOT EXISTS "experiment_events_experiment_idx" ON "experiment_events" USING btree ("experiment_id");
  CREATE INDEX IF NOT EXISTS "experiment_events_experiment_key_idx" ON "experiment_events" USING btree ("experiment_key");
  CREATE INDEX IF NOT EXISTS "experiment_events_variant_key_idx" ON "experiment_events" USING btree ("variant_key");
  CREATE INDEX IF NOT EXISTS "experiment_events_kind_idx" ON "experiment_events" USING btree ("kind");
  CREATE INDEX IF NOT EXISTS "experiment_events_event_idx" ON "experiment_events" USING btree ("event");
  CREATE INDEX IF NOT EXISTS "experiment_events_learner_idx" ON "experiment_events" USING btree ("learner_id");
  CREATE INDEX IF NOT EXISTS "experiment_events_device_id_idx" ON "experiment_events" USING btree ("device_id");
  CREATE INDEX IF NOT EXISTS "experiment_events_subject_idx" ON "experiment_events" USING btree ("subject");
  CREATE INDEX IF NOT EXISTS "experiment_events_session_id_idx" ON "experiment_events" USING btree ("session_id");
  CREATE INDEX IF NOT EXISTS "experiment_events_portal_idx" ON "experiment_events" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "experiment_events_at_idx" ON "experiment_events" USING btree ("at");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_experiments_id_idx" ON "payload_locked_documents_rels" USING btree ("experiments_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_experiment_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("experiment_assignments_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_experiment_events_id_idx" ON "payload_locked_documents_rels" USING btree ("experiment_events_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "experiments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "experiment_assignments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "experiment_events_id";
  ALTER TABLE "master_flags" DROP COLUMN IF EXISTS "experiments_off";
  ALTER TABLE "master_flags" DROP COLUMN IF EXISTS "experiment_defaults";
  DROP TABLE IF EXISTS "experiment_events";
  DROP TABLE IF EXISTS "experiment_assignments";
  DROP TABLE IF EXISTS "experiments_variants";
  DROP TABLE IF EXISTS "experiments";
  DROP TYPE IF EXISTS "public"."enum_experiments_status";
  DROP TYPE IF EXISTS "public"."enum_experiments_allocation";
  DROP TYPE IF EXISTS "public"."enum_experiments_variants_source";
  DROP TYPE IF EXISTS "public"."enum_experiment_assignments_subject_kind";
  DROP TYPE IF EXISTS "public"."enum_experiment_events_kind";
  `)
}
