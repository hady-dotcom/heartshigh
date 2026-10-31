import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Practice rooms live on the Parenting portal, away from real learner rows. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "demo_rooms" jsonb;
    DROP TABLE IF EXISTS "parenting_demo_rooms";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "demo_rooms";
  `)
}
