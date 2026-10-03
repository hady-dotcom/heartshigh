import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_feedback_summaries_status" AS ENUM('draft', 'included');
  CREATE TYPE "public"."enum_question_rewrites_status" AS ENUM('draft');

  CREATE TABLE "feedback_summaries" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "point_id" integer,
    "question_key" varchar,
    "themes" jsonb,
    "quotes" jsonb,
    "status" "enum_feedback_summaries_status" DEFAULT 'draft',
    "step_slug" varchar,
    "version_number" numeric,
    "author_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "question_rewrites" (
    "id" serial PRIMARY KEY NOT NULL,
    "point_id" integer NOT NULL,
    "prompt" varchar NOT NULL,
    "talk" varchar,
    "family" varchar,
    "reasons" jsonb,
    "rewrite" varchar NOT NULL,
    "status" "enum_question_rewrites_status" DEFAULT 'draft',
    "author_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_point_id_engagement_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "feedback_summaries" ADD CONSTRAINT "feedback_summaries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_rewrites" ADD CONSTRAINT "question_rewrites_point_id_engagement_points_id_fk" FOREIGN KEY ("point_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "question_rewrites" ADD CONSTRAINT "question_rewrites_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "feedback_summaries_portal_idx" ON "feedback_summaries" USING btree ("portal_id");
  CREATE INDEX "feedback_summaries_point_idx" ON "feedback_summaries" USING btree ("point_id");
  CREATE INDEX "feedback_summaries_question_key_idx" ON "feedback_summaries" USING btree ("question_key");
  CREATE INDEX "feedback_summaries_author_idx" ON "feedback_summaries" USING btree ("author_id");
  CREATE INDEX "feedback_summaries_updated_at_idx" ON "feedback_summaries" USING btree ("updated_at");
  CREATE INDEX "feedback_summaries_created_at_idx" ON "feedback_summaries" USING btree ("created_at");
  CREATE INDEX "question_rewrites_point_idx" ON "question_rewrites" USING btree ("point_id");
  CREATE INDEX "question_rewrites_author_idx" ON "question_rewrites" USING btree ("author_id");
  CREATE INDEX "question_rewrites_updated_at_idx" ON "question_rewrites" USING btree ("updated_at");
  CREATE INDEX "question_rewrites_created_at_idx" ON "question_rewrites" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE "feedback_summaries";
  DROP TABLE "question_rewrites";
  DROP TYPE "public"."enum_feedback_summaries_status";
  DROP TYPE "public"."enum_question_rewrites_status";
  `)
}
