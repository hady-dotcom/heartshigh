import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS "legal_pages" (
    "id" serial PRIMARY KEY NOT NULL,
    "kind" varchar NOT NULL,
    "version" varchar NOT NULL,
    "title" varchar NOT NULL,
    "summary" varchar NOT NULL,
    "body" varchar NOT NULL,
    "published" boolean DEFAULT false,
    "draft_for_adviser_review" boolean DEFAULT true,
    "updated_label" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "consents" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer,
    "kind" varchar NOT NULL,
    "version" varchar NOT NULL,
    "accepted_at" timestamp(3) with time zone NOT NULL,
    "ip_hash" varchar,
    "by_guardian" boolean DEFAULT false,
    "guardian_email" varchar,
    "staff_actor_id" integer,
    "note" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "age_profiles" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer NOT NULL,
    "age_band" varchar NOT NULL,
    "guardian_email" varchar,
    "guardian_token_hash" varchar,
    "guardian_token_expires_at" timestamp(3) with time zone,
    "waiting_for_guardian" boolean DEFAULT false,
    "guardian_accepted_at" timestamp(3) with time zone,
    "school_offline_at" timestamp(3) with time zone,
    "school_offline_by_id" integer,
    "school_offline_note" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "portal_contacts" (
    "id" serial PRIMARY KEY NOT NULL,
    "portal_id" integer NOT NULL,
    "privacy_name" varchar,
    "privacy_email" varchar,
    "safeguarding_name" varchar,
    "safeguarding_email" varchar,
    "safeguarding_phone" varchar,
    "school_offline_consent" boolean DEFAULT false,
    "agreement_accepted_at" timestamp(3) with time zone,
    "agreement_name" varchar,
    "agreement_version" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "child_code_flags" (
    "id" serial PRIMARY KEY NOT NULL,
    "access_code_id" integer NOT NULL,
    "for_children" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE IF NOT EXISTS "help_requests" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "portal_id" integer,
    "kind" varchar NOT NULL,
    "page" varchar,
    "device" varchar,
    "note" varchar,
    "status" varchar DEFAULT 'open',
    "happened_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "help_requests";
    DROP TABLE IF EXISTS "child_code_flags";
    DROP TABLE IF EXISTS "portal_contacts";
    DROP TABLE IF EXISTS "age_profiles";
    DROP TABLE IF EXISTS "consents";
    DROP TABLE IF EXISTS "legal_pages";
  `)
}
