import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Background pictures are off until a portal admin chooses one.
 * HEARTS keeps the courtyard. Other portals stay on none.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "scene_key" varchar DEFAULT 'plain';
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "scene_url" varchar;
    UPDATE "portals"
      SET "scene_key" = 'courtyard'
      WHERE "shell" = 'hearts'
        AND ("scene_key" IS NULL OR "scene_key" = '' OR "scene_key" = 'plain');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "scene_url";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "scene_key";
  `)
}
