import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Copy each access code's pack courses onto the code itself.
 * The access_codes.code column is not updated, so live join codes keep the same letters.
 * Running this again adds only course links that are not already on the code.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "access_codes_rels" ("order", "parent_id", "path", "courses_id")
    SELECT
      COALESCE(existing.max_order, 0) + ROW_NUMBER() OVER (PARTITION BY picked.parent_id ORDER BY picked.courses_id),
      picked.parent_id,
      'courses',
      picked.courses_id
    FROM (
      SELECT DISTINCT code_pack."parent_id" AS parent_id, pack_course."courses_id" AS courses_id
      FROM "access_codes_rels" code_pack
      JOIN "packs_rels" pack_course
        ON pack_course."parent_id" = code_pack."packs_id"
       AND pack_course."path" = 'courses'
       AND pack_course."courses_id" IS NOT NULL
      WHERE code_pack."path" = 'packs'
        AND code_pack."packs_id" IS NOT NULL
    ) picked
    LEFT JOIN (
      SELECT "parent_id", MAX("order") AS max_order
      FROM "access_codes_rels"
      WHERE "path" = 'courses'
      GROUP BY "parent_id"
    ) existing ON existing."parent_id" = picked.parent_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM "access_codes_rels" already
      WHERE already."parent_id" = picked.parent_id
        AND already."path" = 'courses'
        AND already."courses_id" = picked.courses_id
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "access_codes_rels" AS rel
    WHERE rel."path" = 'courses'
      AND EXISTS (
        SELECT 1
        FROM "access_codes_rels" code_pack
        JOIN "packs_rels" pack_course
          ON pack_course."parent_id" = code_pack."packs_id"
         AND pack_course."path" = 'courses'
         AND pack_course."courses_id" = rel."courses_id"
        WHERE code_pack."parent_id" = rel."parent_id"
          AND code_pack."path" = 'packs'
      );
  `)
}
