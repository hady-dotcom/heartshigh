import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Welcome support line. Blank hides it. HEARTS keeps its sentence until an admin clears the field. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" ADD COLUMN IF NOT EXISTS "support_note" varchar;
    UPDATE "portals"
      SET "support_note" = 'This has been powered by donations.'
      WHERE "shell" = 'hearts'
        AND "support_note" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "portals" DROP COLUMN IF EXISTS "support_note";
  `)
}
