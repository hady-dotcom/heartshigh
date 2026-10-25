import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Portal look is data. Existing HEARTS portals keep the courtyard, the donations line and the arch.
 * Course cards is the layout for every portal, including HEARTS. A named brand (Hady Home) is left for its own seed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "scene_key" varchar DEFAULT 'plain';
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "scene_url" varchar;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "course_home" varchar DEFAULT 'cards';
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "support_note" varchar;
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "mark_kind" varchar DEFAULT 'plain';
    UPDATE "portals"
      SET "scene_key" = 'courtyard',
          "course_home" = 'cards',
          "support_note" = 'This has been powered by donations.',
          "mark_kind" = 'hearts'
      WHERE ("brand_name" IS NULL OR "brand_name" = '')
        AND ("scene_key" IS NULL OR "scene_key" = '' OR "scene_key" = 'plain');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "mark_kind";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "support_note";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "course_home";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "scene_url";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "scene_key";
  `)
}
