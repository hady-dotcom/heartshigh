import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * The white look is the default. Existing HEARTS portals (no learner-facing brand name) keep the evening theme.
 * A named brand such as Hady Home stays on Modern. This does not name a portal slug.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "shell" varchar DEFAULT 'modern';
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "font_pair" varchar DEFAULT 'jakarta';
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "course_home" varchar DEFAULT 'cards';
    UPDATE "portals"
      SET "shell" = 'hearts'
      WHERE ("brand_name" IS NULL OR "brand_name" = '')
        AND ("shell" IS NULL OR "shell" = '' OR "shell" = 'modern');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "course_home";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "font_pair";
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "shell";
  `)
}
