import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "master_flags" ADD COLUMN IF NOT EXISTS "hijri_offset" numeric DEFAULT 0;
  ALTER TABLE "master_flags" ADD COLUMN IF NOT EXISTS "insight_sample_rate" numeric DEFAULT 25;
  ALTER TABLE "master_flags" ADD COLUMN IF NOT EXISTS "popular_talks_on" boolean DEFAULT false;

  DO $$ BEGIN
    CREATE TYPE "public"."enum_missions_status" AS ENUM('draft', 'open', 'closed', 'shared');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_calendar_copy_source" AS ENUM('staff', 'ai', 'mock');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN
    CREATE TYPE "public"."enum_support_threads_status" AS ENUM('open', 'closed');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE TABLE IF NOT EXISTS "insight_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "kind" varchar NOT NULL,
    "route" varchar NOT NULL,
    "session_id" varchar NOT NULL,
    "subject" varchar,
    "learner_id" integer,
    "device_id" varchar,
    "portal_id" integer,
    "x" numeric,
    "y" numeric,
    "vw" numeric,
    "vh" numeric,
    "depth" numeric,
    "clip_id" varchar,
    "watch_pct" numeric,
    "step" varchar,
    "interactive" boolean DEFAULT false,
    "sampled" boolean DEFAULT true,
    "props" jsonb,
    "at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "insight_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "session_id" varchar NOT NULL,
    "subject" varchar,
    "learner_id" integer,
    "device_id" varchar,
    "portal_id" integer,
    "sampled" boolean DEFAULT true,
    "started_at" timestamp(3) with time zone NOT NULL,
    "ended_at" timestamp(3) with time zone,
    "routes" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "calendar_seasons" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "name" varchar NOT NULL,
    "theme" varchar,
    "start" timestamp(3) with time zone NOT NULL,
    "end" timestamp(3) with time zone NOT NULL,
    "nudge_talks" boolean DEFAULT true,
    "use_popular" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "calendar_copy" (
    "id" serial PRIMARY KEY NOT NULL,
    "slot" varchar NOT NULL,
    "context" varchar NOT NULL,
    "label" varchar NOT NULL,
    "approved" boolean DEFAULT false,
    "source" "enum_calendar_copy_source" DEFAULT 'staff',
    "created_by_id" integer,
    "approved_by_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "missions" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "ask" varchar NOT NULL,
    "why" varchar,
    "minutes_asked" numeric DEFAULT 60 NOT NULL,
    "starts_at" timestamp(3) with time zone NOT NULL,
    "ends_at" timestamp(3) with time zone NOT NULL,
    "target" numeric DEFAULT 500 NOT NULL,
    "experiment_id" integer,
    "try_path" varchar,
    "status" "enum_missions_status" DEFAULT 'draft' NOT NULL,
    "result" varchar,
    "result_at" timestamp(3) with time zone,
    "created_by_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "missions_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "portals_id" integer
  );

  CREATE TABLE IF NOT EXISTS "mission_joins" (
    "id" serial PRIMARY KEY NOT NULL,
    "mission_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer,
    "joined_at" timestamp(3) with time zone NOT NULL,
    "finished_at" timestamp(3) with time zone,
    "minutes" numeric DEFAULT 0,
    "thanked" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "support_threads" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer,
    "status" "enum_support_threads_status" DEFAULT 'open',
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "support_messages" (
    "id" serial PRIMARY KEY NOT NULL,
    "thread_id" integer NOT NULL,
    "author_id" integer NOT NULL,
    "body" varchar NOT NULL,
    "from_desk" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  DO $$ BEGIN ALTER TABLE "insight_events" ADD CONSTRAINT "insight_events_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "insight_events" ADD CONSTRAINT "insight_events_portal_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "insight_sessions" ADD CONSTRAINT "insight_sessions_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "insight_sessions" ADD CONSTRAINT "insight_sessions_portal_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "calendar_copy" ADD CONSTRAINT "calendar_copy_created_by_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "missions" ADD CONSTRAINT "missions_experiment_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "missions" ADD CONSTRAINT "missions_created_by_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "missions_rels" ADD CONSTRAINT "missions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "missions_rels" ADD CONSTRAINT "missions_rels_portals_fk" FOREIGN KEY ("portals_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "mission_joins" ADD CONSTRAINT "mission_joins_mission_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "mission_joins" ADD CONSTRAINT "mission_joins_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "insight_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "insight_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "calendar_seasons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "calendar_copy_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "missions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "mission_joins_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "support_threads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "support_messages_id" integer;

  CREATE UNIQUE INDEX IF NOT EXISTS "insight_sessions_session_id_idx" ON "insight_sessions" USING btree ("session_id");
  CREATE INDEX IF NOT EXISTS "insight_events_kind_idx" ON "insight_events" USING btree ("kind");
  CREATE INDEX IF NOT EXISTS "insight_events_route_idx" ON "insight_events" USING btree ("route");
  CREATE INDEX IF NOT EXISTS "insight_events_session_id_idx" ON "insight_events" USING btree ("session_id");
  CREATE INDEX IF NOT EXISTS "insight_events_at_idx" ON "insight_events" USING btree ("at");
  CREATE INDEX IF NOT EXISTS "insight_events_subject_idx" ON "insight_events" USING btree ("subject");
  CREATE INDEX IF NOT EXISTS "insight_events_learner_idx" ON "insight_events" USING btree ("learner_id");
  CREATE INDEX IF NOT EXISTS "insight_events_portal_idx" ON "insight_events" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "insight_events_step_idx" ON "insight_events" USING btree ("step");
  CREATE UNIQUE INDEX IF NOT EXISTS "calendar_seasons_key_idx" ON "calendar_seasons" USING btree ("key");
  CREATE INDEX IF NOT EXISTS "calendar_copy_slot_idx" ON "calendar_copy" USING btree ("slot");
  CREATE INDEX IF NOT EXISTS "missions_status_idx" ON "missions" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "mission_joins_mission_idx" ON "mission_joins" USING btree ("mission_id");
  CREATE INDEX IF NOT EXISTS "mission_joins_user_idx" ON "mission_joins" USING btree ("user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "mission_joins_mission_user_idx" ON "mission_joins" USING btree ("mission_id", "user_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "insight_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "insight_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "calendar_seasons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "calendar_copy_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "missions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mission_joins_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_threads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_messages_id";
  ALTER TABLE "master_flags" DROP COLUMN IF EXISTS "hijri_offset";
  ALTER TABLE "master_flags" DROP COLUMN IF EXISTS "insight_sample_rate";
  ALTER TABLE "master_flags" DROP COLUMN IF EXISTS "popular_talks_on";
  DROP TABLE IF EXISTS "support_messages";
  DROP TABLE IF EXISTS "support_threads";
  DROP TABLE IF EXISTS "mission_joins";
  DROP TABLE IF EXISTS "missions_rels";
  DROP TABLE IF EXISTS "missions";
  DROP TABLE IF EXISTS "calendar_copy";
  DROP TABLE IF EXISTS "calendar_seasons";
  DROP TABLE IF EXISTS "insight_sessions";
  DROP TABLE IF EXISTS "insight_events";
  DROP TYPE IF EXISTS "public"."enum_missions_status";
  DROP TYPE IF EXISTS "public"."enum_calendar_copy_source";
  DROP TYPE IF EXISTS "public"."enum_support_threads_status";
  `)
}
