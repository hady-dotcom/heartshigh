import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { COPY_PACK_COURSES_SQL } from '../lib/code-courses-sql'

/**
 * Copy each access code's pack courses onto the code itself.
 * The access_codes.code column is not updated, so live join codes keep the same letters.
 * Running this again adds only course links that are not already on the code.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(COPY_PACK_COURSES_SQL))
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
