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
    "portal_id" integer,
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

  ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "consents" ADD CONSTRAINT "consents_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "age_profiles" ADD CONSTRAINT "age_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "age_profiles" ADD CONSTRAINT "age_profiles_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "portal_contacts" ADD CONSTRAINT "portal_contacts_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "child_code_flags" ADD CONSTRAINT "child_code_flags_access_code_id_access_codes_id_fk" FOREIGN KEY ("access_code_id") REFERENCES "public"."access_codes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "help_requests" ADD CONSTRAINT "help_requests_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;

  CREATE UNIQUE INDEX IF NOT EXISTS "age_profiles_user_idx" ON "age_profiles" USING btree ("user_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "portal_contacts_portal_idx" ON "portal_contacts" USING btree ("portal_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "child_code_flags_access_code_idx" ON "child_code_flags" USING btree ("access_code_id");
  CREATE INDEX IF NOT EXISTS "consents_user_idx" ON "consents" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "consents_portal_idx" ON "consents" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "help_requests_user_idx" ON "help_requests" USING btree ("user_id");

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "legal_pages_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "consents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "age_profiles_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "portal_contacts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "child_code_flags_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "help_requests_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_legal_pages_fk" FOREIGN KEY ("legal_pages_id") REFERENCES "public"."legal_pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consents_fk" FOREIGN KEY ("consents_id") REFERENCES "public"."consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_age_profiles_fk" FOREIGN KEY ("age_profiles_id") REFERENCES "public"."age_profiles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_portal_contacts_fk" FOREIGN KEY ("portal_contacts_id") REFERENCES "public"."portal_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_child_code_flags_fk" FOREIGN KEY ("child_code_flags_id") REFERENCES "public"."child_code_flags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_help_requests_fk" FOREIGN KEY ("help_requests_id") REFERENCES "public"."help_requests"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_legal_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("legal_pages_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_consents_id_idx" ON "payload_locked_documents_rels" USING btree ("consents_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_age_profiles_id_idx" ON "payload_locked_documents_rels" USING btree ("age_profiles_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_portal_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("portal_contacts_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_child_code_flags_id_idx" ON "payload_locked_documents_rels" USING btree ("child_code_flags_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_help_requests_id_idx" ON "payload_locked_documents_rels" USING btree ("help_requests_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_legal_pages_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_consents_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_age_profiles_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_portal_contacts_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_child_code_flags_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_help_requests_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_legal_pages_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_consents_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_age_profiles_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_portal_contacts_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_child_code_flags_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_help_requests_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "legal_pages_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "consents_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "age_profiles_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "portal_contacts_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "child_code_flags_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "help_requests_id";
    DROP TABLE IF EXISTS "help_requests";
    DROP TABLE IF EXISTS "child_code_flags";
    DROP TABLE IF EXISTS "portal_contacts";
    DROP TABLE IF EXISTS "age_profiles";
    DROP TABLE IF EXISTS "consents";
    DROP TABLE IF EXISTS "legal_pages";
  `)
}
