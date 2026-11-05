import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { placeQuestionTimes } from '../lib/content-sanity'

type PointRow = { id: number; lesson_id: number; second: number; prompt: string; duration_seconds: number | null; shape: string | null }

function rowsOf(result: unknown): PointRow[] {
  if (Array.isArray(result)) return result as PointRow[]
  const rows = (result as { rows?: PointRow[] } | null)?.rows
  return Array.isArray(rows) ? rows : []
}

/**
 * Drops repeated copies of the same question and writes a distinct time inside each film.
 * Learner answers move onto the copy that is kept.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS question_keep;
    CREATE TEMP TABLE question_keep AS
    SELECT id AS drop_id, first_value(id) OVER (
      PARTITION BY lesson_id, lower(regexp_replace(btrim(coalesce(prompt, '')), '\\s+', ' ', 'g'))
      ORDER BY id
    ) AS keep_id
    FROM engagement_points
    WHERE btrim(coalesce(prompt, '')) <> '';

    UPDATE answers AS row SET point_id = map.keep_id
    FROM question_keep AS map
    WHERE row.point_id = map.drop_id AND map.drop_id <> map.keep_id;

    UPDATE circle_answers AS row SET point_id = map.keep_id
    FROM question_keep AS map
    WHERE row.point_id = map.drop_id AND map.drop_id <> map.keep_id;

    UPDATE question_rewrites AS row SET point_id = map.keep_id
    FROM question_keep AS map
    WHERE row.point_id = map.drop_id AND map.drop_id <> map.keep_id;

    UPDATE feedback_summaries AS row SET point_id = map.keep_id
    FROM question_keep AS map
    WHERE row.point_id = map.drop_id AND map.drop_id <> map.keep_id;

    UPDATE gatherings AS row SET task_id = map.keep_id
    FROM question_keep AS map
    WHERE row.task_id = map.drop_id AND map.drop_id <> map.keep_id;

    UPDATE engagement_points AS row SET contingent_id = map.keep_id
    FROM question_keep AS map
    WHERE row.contingent_id = map.drop_id AND map.drop_id <> map.keep_id;

    DELETE FROM engagement_points_rels
    WHERE parent_id IN (SELECT drop_id FROM question_keep WHERE drop_id <> keep_id);

    DELETE FROM engagement_points
    WHERE id IN (SELECT drop_id FROM question_keep WHERE drop_id <> keep_id);

    DROP TABLE IF EXISTS question_keep;
  `)

  const loaded = rowsOf(await db.execute(sql`
    SELECT ep.id, ep.lesson_id, ep.second, ep.prompt, l.duration_seconds, p.shape
    FROM engagement_points ep
    JOIN lessons l ON l.id = ep.lesson_id
    LEFT JOIN courses c ON c.id = l.course_id
    LEFT JOIN portals p ON p.id = COALESCE(l.portal_id, c.portal_id)
    WHERE ep.status IS DISTINCT FROM 'rejected'
    ORDER BY ep.lesson_id, ep.id
  `))
  const groups = new Map<number, PointRow[]>()
  for (const row of loaded) {
    const list = groups.get(row.lesson_id) || []
    list.push(row)
    groups.set(row.lesson_id, list)
  }
  for (const group of groups.values()) {
    const duration = Number(group[0]?.duration_seconds)
    const placed = placeQuestionTimes(
      group.map((row) => ({ id: Number(row.id), second: Number(row.second || 0), prompt: String(row.prompt || '') })),
      Number.isFinite(duration) ? duration : null,
      { pullLate: group[0]?.shape !== 'sequence' },
    )
    for (const row of placed) {
      const before = group.find((item) => Number(item.id) === row.id)
      if (!before || Number(before.second) === row.second) continue
      await db.execute(sql`UPDATE engagement_points SET second = ${row.second} WHERE id = ${row.id}`)
    }
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Times and deleted copies are not put back. The learner list is derived again on read.
}
