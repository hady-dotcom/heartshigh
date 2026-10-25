import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** The modern shell defaults to the system type stack. Jakarta stays a choice. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ALTER COLUMN "font_pair" SET DEFAULT 'system';
    UPDATE "portals"
      SET "font_pair" = 'system'
      WHERE coalesce("shell", 'modern') <> 'hearts'
        AND ("font_pair" IS NULL OR "font_pair" = 'jakarta');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ALTER COLUMN "font_pair" SET DEFAULT 'jakarta';
  `)
}
