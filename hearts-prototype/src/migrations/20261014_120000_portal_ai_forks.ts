import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Portal forks of AI steps, and the stamp of when the master last opened portal activity. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "ai_step_versions" ADD COLUMN IF NOT EXISTS "portal_id" integer;
    ALTER TABLE "ai_step_versions" ADD COLUMN IF NOT EXISTS "forked_from" numeric;
    ALTER TABLE "ai_step_versions" ADD COLUMN IF NOT EXISTS "before_prompt" varchar;
    ALTER TABLE "ai_step_versions" ADD COLUMN IF NOT EXISTS "kept" boolean DEFAULT false;
    ALTER TABLE "ai_step_versions" ADD COLUMN IF NOT EXISTS "rolled_back" boolean DEFAULT false;
    CREATE INDEX IF NOT EXISTS "ai_step_versions_portal_idx" ON "ai_step_versions" USING btree ("portal_id");
    ALTER TABLE "ai_step_outputs" ADD COLUMN IF NOT EXISTS "portal_id" integer;
    ALTER TABLE "ai_step_outputs" ADD COLUMN IF NOT EXISTS "actor_name" varchar;
    CREATE INDEX IF NOT EXISTS "ai_step_outputs_portal_idx" ON "ai_step_outputs" USING btree ("portal_id");
    ALTER TABLE "ai_step_jobs" ADD COLUMN IF NOT EXISTS "portal_id" integer;
    CREATE INDEX IF NOT EXISTS "ai_step_jobs_portal_idx" ON "ai_step_jobs" USING btree ("portal_id");
    ALTER TABLE "ai_desk" ADD COLUMN IF NOT EXISTS "activity_seen_at" timestamp(3) with time zone;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "ai_step_versions" ADD CONSTRAINT "ai_step_versions_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "ai_step_outputs" ADD CONSTRAINT "ai_step_outputs_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      ALTER TABLE "ai_step_jobs" ADD CONSTRAINT "ai_step_jobs_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "ai_step_versions" DROP CONSTRAINT IF EXISTS "ai_step_versions_portal_id_portals_id_fk";
    ALTER TABLE "ai_step_outputs" DROP CONSTRAINT IF EXISTS "ai_step_outputs_portal_id_portals_id_fk";
    ALTER TABLE "ai_step_jobs" DROP CONSTRAINT IF EXISTS "ai_step_jobs_portal_id_portals_id_fk";
    DROP INDEX IF EXISTS "ai_step_versions_portal_idx";
    DROP INDEX IF EXISTS "ai_step_outputs_portal_idx";
    DROP INDEX IF EXISTS "ai_step_jobs_portal_idx";
    ALTER TABLE "ai_step_versions" DROP COLUMN IF EXISTS "portal_id";
    ALTER TABLE "ai_step_versions" DROP COLUMN IF EXISTS "forked_from";
    ALTER TABLE "ai_step_versions" DROP COLUMN IF EXISTS "before_prompt";
    ALTER TABLE "ai_step_versions" DROP COLUMN IF EXISTS "kept";
    ALTER TABLE "ai_step_versions" DROP COLUMN IF EXISTS "rolled_back";
    ALTER TABLE "ai_step_outputs" DROP COLUMN IF EXISTS "portal_id";
    ALTER TABLE "ai_step_outputs" DROP COLUMN IF EXISTS "actor_name";
    ALTER TABLE "ai_step_jobs" DROP COLUMN IF EXISTS "portal_id";
    ALTER TABLE "ai_desk" DROP COLUMN IF EXISTS "activity_seen_at";
  `)
}
