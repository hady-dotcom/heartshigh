import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Vimeo stills, and Home Learning sample lines taken off Book Summaries. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "poster_url" varchar;
    UPDATE "courses"
      SET "sample_answers" = '[]'::jsonb
      WHERE "sample_answers" IS NOT NULL
        AND (
          lower("title") LIKE '%book summar%'
          OR (
            "id" = 77
            AND "sample_answers"::text ILIKE '%home learning%'
            AND lower(coalesce("title", '')) NOT LIKE '%guiding home learning%'
          )
        );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "lessons" DROP COLUMN IF EXISTS "poster_url";
  `)
}
