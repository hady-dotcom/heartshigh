import type { Payload } from 'payload'
import { fetchVimeoMetas, shouldFetchVimeo } from '@/lib/vimeo-meta'
import { misplacedHomeAnswers } from '@/lib/said-answers'

type LessonRow = { id: number; vimeoId?: string | null; durationSeconds?: number | null; posterUrl?: string | null }

/** Fills missing Vimeo lengths and thumbnails. Safe to run again. Skipped in tests. */
export async function backfillVimeoFilms(payload: Payload) {
  if (!shouldFetchVimeo()) return { updated: 0 }
  const found = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    where: { vimeoId: { exists: true } },
  })
  const missing = (found.docs as LessonRow[]).filter((row) => {
    const id = String(row.vimeoId || '').trim()
    if (!/^\d{6,12}$/.test(id)) return false
    return !Number(row.durationSeconds) || !String(row.posterUrl || '').trim()
  })
  if (!missing.length) return { updated: 0 }
  const metas = await fetchVimeoMetas(missing.map((row) => String(row.vimeoId)))
  let updated = 0
  for (const row of missing) {
    const meta = metas.get(String(row.vimeoId))
    if (!meta) continue
    const data: { durationSeconds?: number; posterUrl?: string } = {}
    if (!Number(row.durationSeconds) && meta.durationSeconds) data.durationSeconds = meta.durationSeconds
    if (!String(row.posterUrl || '').trim() && meta.posterUrl) data.posterUrl = meta.posterUrl
    if (!Object.keys(data).length) continue
    await payload.update({ collection: 'lessons', id: row.id, overrideAccess: true, data })
    updated += 1
  }
  return { updated }
}

/** Takes Home Learning sample lines off Book Summaries. The parenting course is left as it is. */
export async function clearMisplacedHomeAnswers(payload: Payload) {
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { or: [{ id: { equals: 77 } }, { title: { like: 'Book Summar' } }] },
  })
  let cleared = 0
  for (const course of found.docs as { id: number; title?: string | null; sampleAnswers?: unknown }[]) {
    if (!misplacedHomeAnswers(course)) continue
    await payload.update({ collection: 'courses', id: course.id, overrideAccess: true, data: { sampleAnswers: [] } as never })
    cleared += 1
  }
  return { cleared }
}
