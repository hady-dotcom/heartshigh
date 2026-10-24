import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_live_sessions_source" AS ENUM('youtube', 'vimeo', 'mux');
  CREATE TYPE "public"."enum_live_sessions_status" AS ENUM('scheduled', 'live', 'ended');

  CREATE TABLE "live_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "title" varchar NOT NULL,
    "door" numeric,
    "host_id" integer NOT NULL,
    "host_name" varchar,
    "source" "enum_live_sessions_source" DEFAULT 'youtube' NOT NULL,
    "source_url" varchar,
    "youtube_id" varchar,
    "vimeo_id" varchar,
    "mux_stream_id" varchar,
    "mux_stream_key" varchar,
    "mux_rtmp_url" varchar,
    "mux_playback_id" varchar,
    "vod_url" varchar,
    "status" "enum_live_sessions_status" DEFAULT 'scheduled' NOT NULL,
    "scheduled_at" timestamp(3) with time zone,
    "started_at" timestamp(3) with time zone,
    "ended_at" timestamp(3) with time zone,
    "viewer_count" numeric DEFAULT 0,
    "replay_lesson_id" integer,
    "seed_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "live_questions" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "session_id" integer NOT NULL,
    "author_id" integer NOT NULL,
    "author_name" varchar,
    "body" varchar NOT NULL,
    "hidden" boolean DEFAULT false,
    "answered" boolean DEFAULT false,
    "pinned" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "live_reminders" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "session_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "live_presence" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "session_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "last_seen_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_replay_lesson_id_lessons_id_fk" FOREIGN KEY ("replay_lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_questions" ADD CONSTRAINT "live_questions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_questions" ADD CONSTRAINT "live_questions_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_questions" ADD CONSTRAINT "live_questions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_reminders" ADD CONSTRAINT "live_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_presence" ADD CONSTRAINT "live_presence_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_presence" ADD CONSTRAINT "live_presence_session_id_live_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."live_sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "live_presence" ADD CONSTRAINT "live_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "live_sessions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "live_questions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "live_reminders_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "live_presence_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_live_sessions_fk" FOREIGN KEY ("live_sessions_id") REFERENCES "public"."live_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_live_questions_fk" FOREIGN KEY ("live_questions_id") REFERENCES "public"."live_questions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_live_reminders_fk" FOREIGN KEY ("live_reminders_id") REFERENCES "public"."live_reminders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_live_presence_fk" FOREIGN KEY ("live_presence_id") REFERENCES "public"."live_presence"("id") ON DELETE cascade ON UPDATE no action;

  CREATE UNIQUE INDEX "live_sessions_seed_key_idx" ON "live_sessions" USING btree ("seed_key");
  CREATE INDEX "live_sessions_portal_idx" ON "live_sessions" USING btree ("portal_id");
  CREATE INDEX "live_sessions_status_idx" ON "live_sessions" USING btree ("status");
  CREATE INDEX "live_sessions_updated_at_idx" ON "live_sessions" USING btree ("updated_at");
  CREATE INDEX "live_sessions_created_at_idx" ON "live_sessions" USING btree ("created_at");
  CREATE INDEX "live_questions_session_idx" ON "live_questions" USING btree ("session_id");
  CREATE INDEX "live_questions_portal_idx" ON "live_questions" USING btree ("portal_id");
  CREATE INDEX "live_questions_updated_at_idx" ON "live_questions" USING btree ("updated_at");
  CREATE INDEX "live_questions_created_at_idx" ON "live_questions" USING btree ("created_at");
  CREATE INDEX "live_reminders_session_idx" ON "live_reminders" USING btree ("session_id");
  CREATE INDEX "live_reminders_user_idx" ON "live_reminders" USING btree ("user_id");
  CREATE INDEX "live_reminders_portal_idx" ON "live_reminders" USING btree ("portal_id");
  CREATE INDEX "live_reminders_updated_at_idx" ON "live_reminders" USING btree ("updated_at");
  CREATE INDEX "live_reminders_created_at_idx" ON "live_reminders" USING btree ("created_at");
  CREATE INDEX "live_presence_session_idx" ON "live_presence" USING btree ("session_id");
  CREATE INDEX "live_presence_user_idx" ON "live_presence" USING btree ("user_id");
  CREATE INDEX "live_presence_portal_idx" ON "live_presence" USING btree ("portal_id");
  CREATE INDEX "live_presence_updated_at_idx" ON "live_presence" USING btree ("updated_at");
  CREATE INDEX "live_presence_created_at_idx" ON "live_presence" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_live_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("live_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_live_questions_id_idx" ON "payload_locked_documents_rels" USING btree ("live_questions_id");
  CREATE INDEX "payload_locked_documents_rels_live_reminders_id_idx" ON "payload_locked_documents_rels" USING btree ("live_reminders_id");
  CREATE INDEX "payload_locked_documents_rels_live_presence_id_idx" ON "payload_locked_documents_rels" USING btree ("live_presence_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_live_sessions_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_live_questions_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_live_reminders_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_live_presence_fk";
  DROP INDEX "payload_locked_documents_rels_live_sessions_id_idx";
  DROP INDEX "payload_locked_documents_rels_live_questions_id_idx";
  DROP INDEX "payload_locked_documents_rels_live_reminders_id_idx";
  DROP INDEX "payload_locked_documents_rels_live_presence_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "live_sessions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "live_questions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "live_reminders_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "live_presence_id";
  DROP TABLE "live_presence" CASCADE;
  DROP TABLE "live_reminders" CASCADE;
  DROP TABLE "live_questions" CASCADE;
  DROP TABLE "live_sessions" CASCADE;
  DROP TYPE "public"."enum_live_sessions_status";
  DROP TYPE "public"."enum_live_sessions_source";
  `)
}
