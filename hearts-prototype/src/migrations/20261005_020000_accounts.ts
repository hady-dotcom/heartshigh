import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_confirmed_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_confirm_token" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_confirm_expires_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_confirm_sent_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_token" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_expires_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_secret" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_enabled_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totp_pending_secret" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "backup_codes" jsonb;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended_by_id" integer;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspend_reason" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_prefs" jsonb;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_data_export_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_export_token" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_export_expires_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "data_export_file" varchar;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" numeric DEFAULT 0;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" timestamp with time zone;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "circle_muted_until" timestamp with time zone;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "require_email_confirm" boolean DEFAULT false;
    UPDATE "users" SET "email_confirmed_at" = "created_at" WHERE "email_confirmed_at" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_confirmed_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_confirm_token";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "email_confirm_expires_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "last_confirm_sent_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email_token";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "pending_email_expires_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_secret";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_enabled_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "totp_pending_secret";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "backup_codes";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "suspended_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "suspended_by_id";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "suspend_reason";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "deletion_requested_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "must_change_password";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_prefs";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "last_data_export_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "data_export_token";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "data_export_expires_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "data_export_file";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "token_version";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "password_changed_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "circle_muted_until";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "require_email_confirm";
  `)
}
