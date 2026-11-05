import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Public Vimeo ids for the Guiding Home Learning films that were re-uploaded.
 * Stored on the lesson rows. Films 22 and 75 stay without a video until their files arrive.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "lessons" AS lesson
    SET "vimeo_id" = next.id,
        "source_url" = CASE
          WHEN lesson."source_url" IS NULL OR lesson."source_url" = '' OR lesson."source_url" LIKE '%' || lesson."vimeo_id" || '%'
          THEN 'https://vimeo.com/' || next.id
          ELSE lesson."source_url"
        END
    FROM (VALUES
      ('496862893', '1239173361'),
      ('496862550', '1239173362'),
      ('496862832', '1239173364'),
      ('496880867', '1239173363'),
      ('496879209', '1239173387'),
      ('496880331', '1239173388'),
      ('496879175', '1239173400'),
      ('496893629', '1239173398'),
      ('496893712', '1239173397'),
      ('496943558', '1239173403')
    ) AS next(old_id, id)
    WHERE lesson."vimeo_id" = next.old_id
  `)
  await db.execute(sql`
    UPDATE "lessons"
    SET "vimeo_id" = NULL,
        "video_provider" = NULL,
        "source_url" = CASE
          WHEN "source_url" LIKE '%496861656%' OR "source_url" LIKE '%496895289%' THEN NULL
          ELSE "source_url"
        END
    WHERE "vimeo_id" IN ('496861656', '496895289')
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "lessons" AS lesson
    SET "vimeo_id" = next.old_id,
        "video_provider" = 'vimeo',
        "source_url" = CASE
          WHEN lesson."source_url" = 'https://vimeo.com/' || next.id THEN 'https://vimeo.com/' || next.old_id
          ELSE lesson."source_url"
        END
    FROM (VALUES
      ('496862893', '1239173361'),
      ('496862550', '1239173362'),
      ('496862832', '1239173364'),
      ('496880867', '1239173363'),
      ('496879209', '1239173387'),
      ('496880331', '1239173388'),
      ('496879175', '1239173400'),
      ('496893629', '1239173398'),
      ('496893712', '1239173397'),
      ('496943558', '1239173403')
    ) AS next(old_id, id)
    WHERE lesson."vimeo_id" = next.id
  `)
  await db.execute(sql`
    UPDATE "lessons"
    SET "vimeo_id" = CASE "title"
          WHEN 'Home Learning Approach 5: My Calendar, a Saviour' THEN '496861656'
          WHEN 'Home Learning & Developing as a Teaching Assistant 15: Engaging in School Life' THEN '496895289'
        END,
        "video_provider" = 'vimeo',
        "source_url" = COALESCE("source_url", 'https://vimeo.com/' || CASE "title"
          WHEN 'Home Learning Approach 5: My Calendar, a Saviour' THEN '496861656'
          WHEN 'Home Learning & Developing as a Teaching Assistant 15: Engaging in School Life' THEN '496895289'
        END)
    WHERE "title" IN (
      'Home Learning Approach 5: My Calendar, a Saviour',
      'Home Learning & Developing as a Teaching Assistant 15: Engaging in School Life'
    )
      AND ("vimeo_id" IS NULL OR "vimeo_id" = '')
  `)
}
