import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Sequenced-course portals keep their own order, colours and length rule. Watch rows can store a resume place. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "shape" varchar DEFAULT 'hearts';
  ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "lock_order" boolean DEFAULT false;
  ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "min_talk_seconds" numeric;
  ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "accent" varchar;
  ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "teacher_cap" numeric;
  ALTER TABLE "watch_sessions" ADD COLUMN IF NOT EXISTS "position" numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "portals" DROP COLUMN IF EXISTS "teacher_cap";
  ALTER TABLE "portals" DROP COLUMN IF EXISTS "accent";
  ALTER TABLE "portals" DROP COLUMN IF EXISTS "min_talk_seconds";
  ALTER TABLE "portals" DROP COLUMN IF EXISTS "lock_order";
  ALTER TABLE "portals" DROP COLUMN IF EXISTS "shape";
  ALTER TABLE "watch_sessions" DROP COLUMN IF EXISTS "position";`)
}
