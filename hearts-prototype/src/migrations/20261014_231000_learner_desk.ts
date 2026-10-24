import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Pause, a one-time password change, and the last time a person signed in. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paused" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false;
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "last_seen_at";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "must_change_password";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "paused";
  `)
}
