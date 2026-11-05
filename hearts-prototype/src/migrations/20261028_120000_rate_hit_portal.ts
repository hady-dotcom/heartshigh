import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Rate hits are tenant-scoped in the console. The portal column was never created, so the list query failed. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "rate_hits" ADD COLUMN IF NOT EXISTS "portal_id" integer;
    CREATE INDEX IF NOT EXISTS "rate_hits_portal_idx" ON "rate_hits" USING btree ("portal_id");
    DO $$ BEGIN
      ALTER TABLE "rate_hits" ADD CONSTRAINT "rate_hits_portal_id_portals_id_fk" FOREIGN KEY ("portal_id") REFERENCES "public"."portals"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "rate_hits" DROP CONSTRAINT IF EXISTS "rate_hits_portal_id_portals_id_fk";
    DROP INDEX IF EXISTS "rate_hits_portal_idx";
    ALTER TABLE "rate_hits" DROP COLUMN IF EXISTS "portal_id";
  `)
}
