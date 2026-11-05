import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "moderation_hides_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "safeguarding_alerts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "announcements_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "announcement_dismissals_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "rate_hits_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "circle_mutes_id" integer;

  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reports_fk" FOREIGN KEY ("reports_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_moderation_hides_fk" FOREIGN KEY ("moderation_hides_id") REFERENCES "public"."moderation_hides"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_safeguarding_alerts_fk" FOREIGN KEY ("safeguarding_alerts_id") REFERENCES "public"."safeguarding_alerts"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcements_fk" FOREIGN KEY ("announcements_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_announcement_dismissals_fk" FOREIGN KEY ("announcement_dismissals_id") REFERENCES "public"."announcement_dismissals"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_rate_hits_fk" FOREIGN KEY ("rate_hits_id") REFERENCES "public"."rate_hits"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_circle_mutes_fk" FOREIGN KEY ("circle_mutes_id") REFERENCES "public"."circle_mutes"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_reports_id_idx" ON "payload_locked_documents_rels" USING btree ("reports_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_moderation_hides_id_idx" ON "payload_locked_documents_rels" USING btree ("moderation_hides_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_safeguarding_alerts_id_idx" ON "payload_locked_documents_rels" USING btree ("safeguarding_alerts_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_announcements_id_idx" ON "payload_locked_documents_rels" USING btree ("announcements_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_announcement_dismissals_id_idx" ON "payload_locked_documents_rels" USING btree ("announcement_dismissals_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_rate_hits_id_idx" ON "payload_locked_documents_rels" USING btree ("rate_hits_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_circle_mutes_id_idx" ON "payload_locked_documents_rels" USING btree ("circle_mutes_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reports_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_moderation_hides_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_safeguarding_alerts_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_announcements_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_announcement_dismissals_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_rate_hits_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_circle_mutes_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_reports_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_moderation_hides_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_safeguarding_alerts_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_announcements_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_announcement_dismissals_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_rate_hits_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_circle_mutes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "moderation_hides_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "safeguarding_alerts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "announcements_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "announcement_dismissals_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "rate_hits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "circle_mutes_id";
  `)
}
