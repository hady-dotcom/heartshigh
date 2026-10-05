import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "answers" ADD COLUMN IF NOT EXISTS "swarm_hidden" boolean DEFAULT false;`)
  await db.execute(sql`ALTER TABLE "answers" ADD COLUMN IF NOT EXISTS "swarm_reason" varchar;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "answers" DROP COLUMN IF EXISTS "swarm_reason";`)
  await db.execute(sql`ALTER TABLE "answers" DROP COLUMN IF EXISTS "swarm_hidden";`)
}
