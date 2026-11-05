import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_gatherings_kind" AS ENUM('circle', 'tea', 'volunteer', 'walk', 'youth', 'picnic');
  CREATE TYPE "public"."enum_gatherings_audience" AS ENUM('brothers', 'sisters', 'family', 'youth', 'all');
  CREATE TYPE "public"."enum_gatherings_status" AS ENUM('proposed', 'published', 'cancelled');
  CREATE TYPE "public"."enum_gather_rsvps_status" AS ENUM('going', 'maybe', 'cant', 'waitlist');
  CREATE TYPE "public"."enum_gather_checkins_method" AS ENUM('qr', 'host');

  CREATE TABLE "gatherings" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "title" varchar NOT NULL,
    "kind" "enum_gatherings_kind" DEFAULT 'circle',
    "audience" "enum_gatherings_audience" DEFAULT 'all',
    "starts_at" timestamp(3) with time zone,
    "ends_at" timestamp(3) with time zone,
    "place" varchar,
    "map_url" varchar,
    "capacity" numeric DEFAULT 0,
    "bring" varchar,
    "note" varchar,
    "host_id" integer,
    "host_label" varchar,
    "status" "enum_gatherings_status" DEFAULT 'published',
    "proposed_by_id" integer,
    "lesson_id" integer,
    "course_id" integer,
    "task_id" integer,
    "door" numeric,
    "link_label" varchar,
    "slug" varchar NOT NULL,
    "checkin_token" varchar NOT NULL,
    "prompts" jsonb,
    "circles" jsonb,
    "seed_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "gather_rsvps" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "gathering_id" integer NOT NULL,
    "user_id" integer,
    "status" "enum_gather_rsvps_status" DEFAULT 'going',
    "guest_name" varchar,
    "guest_contact" varchar,
    "guest_token" varchar,
    "brought_by_id" integer,
    "bring_code" varchar,
    "remind" boolean DEFAULT false,
    "seed_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "gather_checkins" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "gathering_id" integer NOT NULL,
    "user_id" integer,
    "rsvp_id" integer,
    "guest_label" varchar,
    "method" "enum_gather_checkins_method" DEFAULT 'qr',
    "newcomer" boolean DEFAULT false,
    "welcomed" boolean DEFAULT false,
    "seed_key" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "gather_reflections" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "gathering_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "body" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "gather_photos" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer,
    "gathering_id" integer NOT NULL,
    "image_id" integer NOT NULL,
    "caption" varchar,
    "consent" boolean DEFAULT false,
    "posted_by_id" integer,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "answers" ADD COLUMN "via_gathering" boolean DEFAULT false;

  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_proposed_by_id_users_id_fk" FOREIGN KEY ("proposed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gatherings" ADD CONSTRAINT "gatherings_task_id_engagement_points_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."engagement_points"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_rsvps" ADD CONSTRAINT "gather_rsvps_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_rsvps" ADD CONSTRAINT "gather_rsvps_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_rsvps" ADD CONSTRAINT "gather_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_rsvps" ADD CONSTRAINT "gather_rsvps_brought_by_id_users_id_fk" FOREIGN KEY ("brought_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_checkins" ADD CONSTRAINT "gather_checkins_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_checkins" ADD CONSTRAINT "gather_checkins_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_checkins" ADD CONSTRAINT "gather_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_checkins" ADD CONSTRAINT "gather_checkins_rsvp_id_gather_rsvps_id_fk" FOREIGN KEY ("rsvp_id") REFERENCES "public"."gather_rsvps"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_reflections" ADD CONSTRAINT "gather_reflections_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_reflections" ADD CONSTRAINT "gather_reflections_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_reflections" ADD CONSTRAINT "gather_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_photos" ADD CONSTRAINT "gather_photos_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_photos" ADD CONSTRAINT "gather_photos_gathering_id_gatherings_id_fk" FOREIGN KEY ("gathering_id") REFERENCES "public"."gatherings"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_photos" ADD CONSTRAINT "gather_photos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "gather_photos" ADD CONSTRAINT "gather_photos_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gatherings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gather_rsvps_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gather_checkins_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gather_reflections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gather_photos_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gatherings_fk" FOREIGN KEY ("gatherings_id") REFERENCES "public"."gatherings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gather_rsvps_fk" FOREIGN KEY ("gather_rsvps_id") REFERENCES "public"."gather_rsvps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gather_checkins_fk" FOREIGN KEY ("gather_checkins_id") REFERENCES "public"."gather_checkins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gather_reflections_fk" FOREIGN KEY ("gather_reflections_id") REFERENCES "public"."gather_reflections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gather_photos_fk" FOREIGN KEY ("gather_photos_id") REFERENCES "public"."gather_photos"("id") ON DELETE cascade ON UPDATE no action;

  CREATE UNIQUE INDEX "gatherings_slug_idx" ON "gatherings" USING btree ("slug");
  CREATE UNIQUE INDEX "gatherings_seed_key_idx" ON "gatherings" USING btree ("seed_key");
  CREATE INDEX "gatherings_portal_idx" ON "gatherings" USING btree ("portal_id");
  CREATE INDEX "gatherings_updated_at_idx" ON "gatherings" USING btree ("updated_at");
  CREATE INDEX "gatherings_created_at_idx" ON "gatherings" USING btree ("created_at");
  CREATE INDEX "gather_rsvps_gathering_idx" ON "gather_rsvps" USING btree ("gathering_id");
  CREATE INDEX "gather_rsvps_guest_token_idx" ON "gather_rsvps" USING btree ("guest_token");
  CREATE INDEX "gather_rsvps_seed_key_idx" ON "gather_rsvps" USING btree ("seed_key");
  CREATE INDEX "gather_rsvps_portal_idx" ON "gather_rsvps" USING btree ("portal_id");
  CREATE INDEX "gather_rsvps_updated_at_idx" ON "gather_rsvps" USING btree ("updated_at");
  CREATE INDEX "gather_rsvps_created_at_idx" ON "gather_rsvps" USING btree ("created_at");
  CREATE INDEX "gather_checkins_gathering_idx" ON "gather_checkins" USING btree ("gathering_id");
  CREATE INDEX "gather_checkins_seed_key_idx" ON "gather_checkins" USING btree ("seed_key");
  CREATE INDEX "gather_checkins_portal_idx" ON "gather_checkins" USING btree ("portal_id");
  CREATE INDEX "gather_checkins_updated_at_idx" ON "gather_checkins" USING btree ("updated_at");
  CREATE INDEX "gather_checkins_created_at_idx" ON "gather_checkins" USING btree ("created_at");
  CREATE INDEX "gather_reflections_gathering_idx" ON "gather_reflections" USING btree ("gathering_id");
  CREATE INDEX "gather_reflections_portal_idx" ON "gather_reflections" USING btree ("portal_id");
  CREATE INDEX "gather_reflections_updated_at_idx" ON "gather_reflections" USING btree ("updated_at");
  CREATE INDEX "gather_reflections_created_at_idx" ON "gather_reflections" USING btree ("created_at");
  CREATE INDEX "gather_photos_gathering_idx" ON "gather_photos" USING btree ("gathering_id");
  CREATE INDEX "gather_photos_portal_idx" ON "gather_photos" USING btree ("portal_id");
  CREATE INDEX "gather_photos_updated_at_idx" ON "gather_photos" USING btree ("updated_at");
  CREATE INDEX "gather_photos_created_at_idx" ON "gather_photos" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_gatherings_id_idx" ON "payload_locked_documents_rels" USING btree ("gatherings_id");
  CREATE INDEX "payload_locked_documents_rels_gather_rsvps_id_idx" ON "payload_locked_documents_rels" USING btree ("gather_rsvps_id");
  CREATE INDEX "payload_locked_documents_rels_gather_checkins_id_idx" ON "payload_locked_documents_rels" USING btree ("gather_checkins_id");
  CREATE INDEX "payload_locked_documents_rels_gather_reflections_id_idx" ON "payload_locked_documents_rels" USING btree ("gather_reflections_id");
  CREATE INDEX "payload_locked_documents_rels_gather_photos_id_idx" ON "payload_locked_documents_rels" USING btree ("gather_photos_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gatherings_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gather_rsvps_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gather_checkins_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gather_reflections_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gather_photos_fk";
  DROP INDEX "payload_locked_documents_rels_gatherings_id_idx";
  DROP INDEX "payload_locked_documents_rels_gather_rsvps_id_idx";
  DROP INDEX "payload_locked_documents_rels_gather_checkins_id_idx";
  DROP INDEX "payload_locked_documents_rels_gather_reflections_id_idx";
  DROP INDEX "payload_locked_documents_rels_gather_photos_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gatherings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gather_rsvps_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gather_checkins_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gather_reflections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gather_photos_id";
  ALTER TABLE "answers" DROP COLUMN "via_gathering";
  DROP TABLE "gather_photos" CASCADE;
  DROP TABLE "gather_reflections" CASCADE;
  DROP TABLE "gather_checkins" CASCADE;
  DROP TABLE "gather_rsvps" CASCADE;
  DROP TABLE "gatherings" CASCADE;
  DROP TYPE "public"."enum_gather_checkins_method";
  DROP TYPE "public"."enum_gather_rsvps_status";
  DROP TYPE "public"."enum_gatherings_status";
  DROP TYPE "public"."enum_gatherings_audience";
  DROP TYPE "public"."enum_gatherings_kind";
  `)
}
