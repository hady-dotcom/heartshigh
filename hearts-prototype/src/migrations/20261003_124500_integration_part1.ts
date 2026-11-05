import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_circle_answers_origin" AS ENUM('ai', 'staff');
  CREATE TYPE "public"."enum_persona_bands_ranges_scale" AS ENUM('desire', 'greed', 'anger', 'ego', 'worry', 'belonging', 'gratitude', 'faith', 'compassion', 'discipline');
  CREATE TYPE "public"."enum_persona_bands_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_persona_bands_source" AS ENUM('unassigned', 'doc-a', 'doc-b', 'doc-c', 'ux-draft', 'balanced');
  CREATE TYPE "public"."enum_compass_settings_places_key" AS ENUM('growing', 'steady', 'flourishing');
  CREATE TYPE "public"."enum_compass_settings_life_options_boost" AS ENUM('desire', 'greed', 'anger', 'ego', 'worry', 'belonging', 'gratitude', 'faith', 'compassion', 'discipline');
  CREATE TYPE "public"."enum_compass_settings_frame" AS ENUM('both', 'focusing', 'places');
  CREATE TYPE "public"."enum_compass_attempts_bank" AS ENUM('opening', 'month');
  CREATE TYPE "public"."enum_ai_steps_provider" AS ENUM('anthropic', 'openai');
  CREATE TYPE "public"."enum_ai_step_versions_provider" AS ENUM('anthropic', 'openai');
  CREATE TYPE "public"."enum_ai_step_outputs_mode" AS ENUM('try', 'run');
  CREATE TYPE "public"."enum_ai_step_outputs_disposition" AS ENUM('preview', 'applied', 'pending', 'failed');
  CREATE TYPE "public"."enum_ai_step_jobs_scope" AS ENUM('talk', 'selection', 'course', 'all');
  CREATE TYPE "public"."enum_ai_step_jobs_status" AS ENUM('queued', 'running', 'done', 'failed');
  CREATE TABLE "circle_answers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"point_id" integer NOT NULL,
  	"lesson_id" integer,
  	"portal_id" integer,
  	"name" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"tone" varchar,
  	"length" varchar,
  	"origin" "enum_circle_answers_origin" DEFAULT 'staff',
  	"enabled" boolean DEFAULT true,
  	"author_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "persona_bands_ranges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"scale" "enum_persona_bands_ranges_scale" NOT NULL,
  	"present" boolean DEFAULT false,
  	"min" numeric,
  	"max" numeric
  );
  
  CREATE TABLE "persona_bands" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"status" "enum_persona_bands_status" DEFAULT 'draft',
  	"source" "enum_persona_bands_source" DEFAULT 'unassigned',
  	"placeholder" boolean DEFAULT true,
  	"identical_group" varchar,
  	"note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "compass_settings_places" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" "enum_compass_settings_places_key",
  	"label" varchar NOT NULL,
  	"low" numeric,
  	"high" numeric,
  	"forward" varchar
  );
  
  CREATE TABLE "compass_settings_life_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"boost" "enum_compass_settings_life_options_boost"
  );
  
  CREATE TABLE "compass_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"frame" "enum_compass_settings_frame" DEFAULT 'both',
  	"focus_lead" varchar DEFAULT 'Focusing on',
  	"movement_up" varchar,
  	"movement_same" varchar,
  	"movement_onward" varchar,
  	"life_caption" varchar,
  	"life_subline" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "compass_attempts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"portal_id" integer NOT NULL,
  	"at" timestamp(3) with time zone NOT NULL,
  	"bank" "enum_compass_attempts_bank" DEFAULT 'opening',
  	"life_key" varchar,
  	"scales" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_steps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"placeholders" jsonb NOT NULL,
  	"prompt" varchar NOT NULL,
  	"provider" "enum_ai_steps_provider" DEFAULT 'anthropic',
  	"model" varchar,
  	"temperature" numeric DEFAULT 0,
  	"max_tokens" numeric DEFAULT 1200,
  	"output_schema" jsonb,
  	"fills" varchar,
  	"pipeline_order" numeric DEFAULT 0,
  	"in_pipeline" boolean DEFAULT true,
  	"fills_tier" varchar,
  	"fills_points" varchar,
  	"live_version" numeric DEFAULT 1,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_step_versions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"step_id" integer NOT NULL,
  	"number" numeric NOT NULL,
  	"prompt" varchar NOT NULL,
  	"provider" "enum_ai_step_versions_provider" DEFAULT 'anthropic',
  	"model" varchar,
  	"temperature" numeric,
  	"max_tokens" numeric,
  	"note" varchar NOT NULL,
  	"author_id" integer,
  	"author_name" varchar,
  	"author_role" varchar,
  	"live" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_step_outputs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"step_id" integer,
  	"step_slug" varchar NOT NULL,
  	"version_number" numeric,
  	"lesson_id" integer,
  	"mode" "enum_ai_step_outputs_mode" DEFAULT 'run',
  	"disposition" "enum_ai_step_outputs_disposition" DEFAULT 'preview',
  	"output" jsonb,
  	"written" jsonb,
  	"error" varchar,
  	"job_id" integer,
  	"protects_kind" varchar,
  	"protects_id" numeric,
  	"protects_reason" varchar,
  	"mock" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_step_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"step_slug" varchar NOT NULL,
  	"scope" "enum_ai_step_jobs_scope" DEFAULT 'talk',
  	"lesson_ids" jsonb,
  	"course_id" integer,
  	"status" "enum_ai_step_jobs_status" DEFAULT 'queued',
  	"total" numeric DEFAULT 0,
  	"finished" numeric DEFAULT 0,
  	"failed_count" numeric DEFAULT 0,
  	"results" jsonb,
  	"actor_id" integer,
  	"actor_name" varchar,
  	"note" varchar,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "ai_desk" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"portal_may_edit" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tags" ADD COLUMN "scale_id" integer;
  ALTER TABLE "completions" ADD COLUMN "watched_at" timestamp(3) with time zone;
  ALTER TABLE "heart_scales" ADD COLUMN "focus_name" varchar;
  ALTER TABLE "opening_scenes" ADD COLUMN "month_caption" varchar;
  ALTER TABLE "opening_scenes" ADD COLUMN "month_subline" varchar;
  ALTER TABLE "opening_scenes" ADD COLUMN "month_labels" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "circle_answers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "persona_bands_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "compass_settings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "compass_attempts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_steps_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_step_versions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_step_outputs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_step_jobs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "ai_desk_id" integer;
  ALTER TABLE "master_flags" ADD COLUMN "circle_label" varchar DEFAULT 'From the HEARTS circle';
  ALTER TABLE "master_flags" ADD COLUMN "circle_threshold" numeric DEFAULT 8;
  ALTER TABLE "circle_answers" ADD CONSTRAINT "circle_answers_point_id_engagement_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "circle_answers" ADD CONSTRAINT "circle_answers_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "circle_answers" ADD CONSTRAINT "circle_answers_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "circle_answers" ADD CONSTRAINT "circle_answers_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "persona_bands_ranges" ADD CONSTRAINT "persona_bands_ranges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."persona_bands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "compass_settings_places" ADD CONSTRAINT "compass_settings_places_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."compass_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "compass_settings_life_options" ADD CONSTRAINT "compass_settings_life_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."compass_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "compass_attempts" ADD CONSTRAINT "compass_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "compass_attempts" ADD CONSTRAINT "compass_attempts_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_versions" ADD CONSTRAINT "ai_step_versions_step_id_ai_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."ai_steps"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_versions" ADD CONSTRAINT "ai_step_versions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_outputs" ADD CONSTRAINT "ai_step_outputs_step_id_ai_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."ai_steps"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_outputs" ADD CONSTRAINT "ai_step_outputs_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_outputs" ADD CONSTRAINT "ai_step_outputs_job_id_ai_step_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_step_jobs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_jobs" ADD CONSTRAINT "ai_step_jobs_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "ai_step_jobs" ADD CONSTRAINT "ai_step_jobs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "circle_answers_point_idx" ON "circle_answers" USING btree ("point_id");
  CREATE INDEX "circle_answers_lesson_idx" ON "circle_answers" USING btree ("lesson_id");
  CREATE INDEX "circle_answers_portal_idx" ON "circle_answers" USING btree ("portal_id");
  CREATE INDEX "circle_answers_enabled_idx" ON "circle_answers" USING btree ("enabled");
  CREATE INDEX "circle_answers_author_idx" ON "circle_answers" USING btree ("author_id");
  CREATE INDEX "circle_answers_updated_at_idx" ON "circle_answers" USING btree ("updated_at");
  CREATE INDEX "circle_answers_created_at_idx" ON "circle_answers" USING btree ("created_at");
  CREATE INDEX "persona_bands_ranges_order_idx" ON "persona_bands_ranges" USING btree ("_order");
  CREATE INDEX "persona_bands_ranges_parent_id_idx" ON "persona_bands_ranges" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "persona_bands_key_idx" ON "persona_bands" USING btree ("key");
  CREATE INDEX "persona_bands_updated_at_idx" ON "persona_bands" USING btree ("updated_at");
  CREATE INDEX "persona_bands_created_at_idx" ON "persona_bands" USING btree ("created_at");
  CREATE INDEX "compass_settings_places_order_idx" ON "compass_settings_places" USING btree ("_order");
  CREATE INDEX "compass_settings_places_parent_id_idx" ON "compass_settings_places" USING btree ("_parent_id");
  CREATE INDEX "compass_settings_life_options_order_idx" ON "compass_settings_life_options" USING btree ("_order");
  CREATE INDEX "compass_settings_life_options_parent_id_idx" ON "compass_settings_life_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "compass_settings_key_idx" ON "compass_settings" USING btree ("key");
  CREATE INDEX "compass_settings_updated_at_idx" ON "compass_settings" USING btree ("updated_at");
  CREATE INDEX "compass_settings_created_at_idx" ON "compass_settings" USING btree ("created_at");
  CREATE INDEX "compass_attempts_user_idx" ON "compass_attempts" USING btree ("user_id");
  CREATE INDEX "compass_attempts_portal_idx" ON "compass_attempts" USING btree ("portal_id");
  CREATE INDEX "compass_attempts_updated_at_idx" ON "compass_attempts" USING btree ("updated_at");
  CREATE INDEX "compass_attempts_created_at_idx" ON "compass_attempts" USING btree ("created_at");
  CREATE UNIQUE INDEX "ai_steps_slug_idx" ON "ai_steps" USING btree ("slug");
  CREATE INDEX "ai_steps_updated_at_idx" ON "ai_steps" USING btree ("updated_at");
  CREATE INDEX "ai_steps_created_at_idx" ON "ai_steps" USING btree ("created_at");
  CREATE INDEX "ai_step_versions_step_idx" ON "ai_step_versions" USING btree ("step_id");
  CREATE INDEX "ai_step_versions_author_idx" ON "ai_step_versions" USING btree ("author_id");
  CREATE INDEX "ai_step_versions_live_idx" ON "ai_step_versions" USING btree ("live");
  CREATE INDEX "ai_step_versions_updated_at_idx" ON "ai_step_versions" USING btree ("updated_at");
  CREATE INDEX "ai_step_versions_created_at_idx" ON "ai_step_versions" USING btree ("created_at");
  CREATE INDEX "ai_step_outputs_step_idx" ON "ai_step_outputs" USING btree ("step_id");
  CREATE INDEX "ai_step_outputs_step_slug_idx" ON "ai_step_outputs" USING btree ("step_slug");
  CREATE INDEX "ai_step_outputs_lesson_idx" ON "ai_step_outputs" USING btree ("lesson_id");
  CREATE INDEX "ai_step_outputs_disposition_idx" ON "ai_step_outputs" USING btree ("disposition");
  CREATE INDEX "ai_step_outputs_job_idx" ON "ai_step_outputs" USING btree ("job_id");
  CREATE INDEX "ai_step_outputs_updated_at_idx" ON "ai_step_outputs" USING btree ("updated_at");
  CREATE INDEX "ai_step_outputs_created_at_idx" ON "ai_step_outputs" USING btree ("created_at");
  CREATE INDEX "ai_step_jobs_step_slug_idx" ON "ai_step_jobs" USING btree ("step_slug");
  CREATE INDEX "ai_step_jobs_course_idx" ON "ai_step_jobs" USING btree ("course_id");
  CREATE INDEX "ai_step_jobs_status_idx" ON "ai_step_jobs" USING btree ("status");
  CREATE INDEX "ai_step_jobs_actor_idx" ON "ai_step_jobs" USING btree ("actor_id");
  CREATE INDEX "ai_step_jobs_updated_at_idx" ON "ai_step_jobs" USING btree ("updated_at");
  CREATE INDEX "ai_step_jobs_created_at_idx" ON "ai_step_jobs" USING btree ("created_at");
  CREATE UNIQUE INDEX "ai_desk_key_idx" ON "ai_desk" USING btree ("key");
  CREATE INDEX "ai_desk_updated_at_idx" ON "ai_desk" USING btree ("updated_at");
  CREATE INDEX "ai_desk_created_at_idx" ON "ai_desk" USING btree ("created_at");
  ALTER TABLE "tags" ADD CONSTRAINT "tags_scale_id_heart_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."heart_scales"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_circle_answers_fk" FOREIGN KEY ("circle_answers_id") REFERENCES "public"."circle_answers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_persona_bands_fk" FOREIGN KEY ("persona_bands_id") REFERENCES "public"."persona_bands"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_compass_settings_fk" FOREIGN KEY ("compass_settings_id") REFERENCES "public"."compass_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_compass_attempts_fk" FOREIGN KEY ("compass_attempts_id") REFERENCES "public"."compass_attempts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_steps_fk" FOREIGN KEY ("ai_steps_id") REFERENCES "public"."ai_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_step_versions_fk" FOREIGN KEY ("ai_step_versions_id") REFERENCES "public"."ai_step_versions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_step_outputs_fk" FOREIGN KEY ("ai_step_outputs_id") REFERENCES "public"."ai_step_outputs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_step_jobs_fk" FOREIGN KEY ("ai_step_jobs_id") REFERENCES "public"."ai_step_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_ai_desk_fk" FOREIGN KEY ("ai_desk_id") REFERENCES "public"."ai_desk"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tags_scale_idx" ON "tags" USING btree ("scale_id");
  CREATE INDEX "payload_locked_documents_rels_circle_answers_id_idx" ON "payload_locked_documents_rels" USING btree ("circle_answers_id");
  CREATE INDEX "payload_locked_documents_rels_persona_bands_id_idx" ON "payload_locked_documents_rels" USING btree ("persona_bands_id");
  CREATE INDEX "payload_locked_documents_rels_compass_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("compass_settings_id");
  CREATE INDEX "payload_locked_documents_rels_compass_attempts_id_idx" ON "payload_locked_documents_rels" USING btree ("compass_attempts_id");
  CREATE INDEX "payload_locked_documents_rels_ai_steps_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_steps_id");
  CREATE INDEX "payload_locked_documents_rels_ai_step_versions_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_step_versions_id");
  CREATE INDEX "payload_locked_documents_rels_ai_step_outputs_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_step_outputs_id");
  CREATE INDEX "payload_locked_documents_rels_ai_step_jobs_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_step_jobs_id");
  CREATE INDEX "payload_locked_documents_rels_ai_desk_id_idx" ON "payload_locked_documents_rels" USING btree ("ai_desk_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "circle_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "persona_bands_ranges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "persona_bands" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "compass_settings_places" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "compass_settings_life_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "compass_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "compass_attempts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_steps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_step_versions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_step_outputs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_step_jobs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "ai_desk" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "circle_answers" CASCADE;
  DROP TABLE "persona_bands_ranges" CASCADE;
  DROP TABLE "persona_bands" CASCADE;
  DROP TABLE "compass_settings_places" CASCADE;
  DROP TABLE "compass_settings_life_options" CASCADE;
  DROP TABLE "compass_settings" CASCADE;
  DROP TABLE "compass_attempts" CASCADE;
  DROP TABLE "ai_steps" CASCADE;
  DROP TABLE "ai_step_versions" CASCADE;
  DROP TABLE "ai_step_outputs" CASCADE;
  DROP TABLE "ai_step_jobs" CASCADE;
  DROP TABLE "ai_desk" CASCADE;
  ALTER TABLE "tags" DROP CONSTRAINT "tags_scale_id_heart_scales_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_circle_answers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_persona_bands_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_compass_settings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_compass_attempts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_steps_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_step_versions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_step_outputs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_step_jobs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_ai_desk_fk";
  
  DROP INDEX "tags_scale_idx";
  DROP INDEX "payload_locked_documents_rels_circle_answers_id_idx";
  DROP INDEX "payload_locked_documents_rels_persona_bands_id_idx";
  DROP INDEX "payload_locked_documents_rels_compass_settings_id_idx";
  DROP INDEX "payload_locked_documents_rels_compass_attempts_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_steps_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_step_versions_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_step_outputs_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_step_jobs_id_idx";
  DROP INDEX "payload_locked_documents_rels_ai_desk_id_idx";
  ALTER TABLE "tags" DROP COLUMN "scale_id";
  ALTER TABLE "completions" DROP COLUMN "watched_at";
  ALTER TABLE "heart_scales" DROP COLUMN "focus_name";
  ALTER TABLE "opening_scenes" DROP COLUMN "month_caption";
  ALTER TABLE "opening_scenes" DROP COLUMN "month_subline";
  ALTER TABLE "opening_scenes" DROP COLUMN "month_labels";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "circle_answers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "persona_bands_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "compass_settings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "compass_attempts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_steps_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_step_versions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_step_outputs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_step_jobs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "ai_desk_id";
  ALTER TABLE "master_flags" DROP COLUMN "circle_label";
  ALTER TABLE "master_flags" DROP COLUMN "circle_threshold";
  DROP TYPE "public"."enum_circle_answers_origin";
  DROP TYPE "public"."enum_persona_bands_ranges_scale";
  DROP TYPE "public"."enum_persona_bands_status";
  DROP TYPE "public"."enum_persona_bands_source";
  DROP TYPE "public"."enum_compass_settings_places_key";
  DROP TYPE "public"."enum_compass_settings_life_options_boost";
  DROP TYPE "public"."enum_compass_settings_frame";
  DROP TYPE "public"."enum_compass_attempts_bank";
  DROP TYPE "public"."enum_ai_steps_provider";
  DROP TYPE "public"."enum_ai_step_versions_provider";
  DROP TYPE "public"."enum_ai_step_outputs_mode";
  DROP TYPE "public"."enum_ai_step_outputs_disposition";
  DROP TYPE "public"."enum_ai_step_jobs_scope";
  DROP TYPE "public"."enum_ai_step_jobs_status";`)
}
