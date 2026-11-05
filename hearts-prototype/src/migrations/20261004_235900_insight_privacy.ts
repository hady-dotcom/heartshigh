import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "insight_events" DROP CONSTRAINT IF EXISTS "insight_events_learner_id_fk";
  ALTER TABLE "insight_sessions" DROP CONSTRAINT IF EXISTS "insight_sessions_learner_id_fk";
  DROP INDEX IF EXISTS "insight_events_learner_idx";
  DROP INDEX IF EXISTS "insight_sessions_learner_idx";
  ALTER TABLE "insight_events" DROP COLUMN IF EXISTS "learner_id";
  ALTER TABLE "insight_events" DROP COLUMN IF EXISTS "device_id";
  ALTER TABLE "insight_sessions" DROP COLUMN IF EXISTS "learner_id";
  ALTER TABLE "insight_sessions" DROP COLUMN IF EXISTS "device_id";
  CREATE INDEX IF NOT EXISTS "insight_events_portal_idx" ON "insight_events" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "insight_events_step_idx" ON "insight_events" USING btree ("step");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "insight_events" ADD COLUMN IF NOT EXISTS "learner_id" integer;
  ALTER TABLE "insight_events" ADD COLUMN IF NOT EXISTS "device_id" varchar;
  ALTER TABLE "insight_sessions" ADD COLUMN IF NOT EXISTS "learner_id" integer;
  ALTER TABLE "insight_sessions" ADD COLUMN IF NOT EXISTS "device_id" varchar;
  DO $$ BEGIN ALTER TABLE "insight_events" ADD CONSTRAINT "insight_events_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "insight_sessions" ADD CONSTRAINT "insight_sessions_learner_id_fk" FOREIGN KEY ("learner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE INDEX IF NOT EXISTS "insight_events_learner_idx" ON "insight_events" USING btree ("learner_id");
  DROP INDEX IF EXISTS "insight_events_portal_idx";
  DROP INDEX IF EXISTS "insight_events_step_idx";
  `)
}
