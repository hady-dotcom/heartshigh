import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE INDEX IF NOT EXISTS "insight_events_learner_idx" ON "insight_events" USING btree ("learner_id");
  CREATE INDEX IF NOT EXISTS "insight_events_portal_idx" ON "insight_events" USING btree ("portal_id");
  CREATE INDEX IF NOT EXISTS "insight_events_step_idx" ON "insight_events" USING btree ("step");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP INDEX IF EXISTS "insight_events_learner_idx";
  DROP INDEX IF EXISTS "insight_events_portal_idx";
  DROP INDEX IF EXISTS "insight_events_step_idx";
  `)
}
