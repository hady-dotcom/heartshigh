import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Hady Home is stored on the portal. Real parent answers stay in the sheet files and are loaded on boot, not onto learner accounts. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "brand_name" varchar;
    UPDATE "portals" SET "brand_name" = 'Hady Home' WHERE "slug" = 'parenting' AND ("brand_name" IS NULL OR "brand_name" = '');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "brand_name";
  `)
}
