import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'
import { bookStillPath, readBookSource, sourceDurationChoice } from '@/lib/book-source'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

type LessonRow = {
  id: number
  title?: string | null
  vimeoId?: string | null
  durationSeconds?: number | null
  posterUrl?: string | null
}

export type BookLengthFlag = { id: string; title: string; stored: number; source: number }

/** Puts source-file lengths and frames on Book Summaries films. Safe to run again. */
export async function applyBookSourceMedia(payload: Payload) {
  const file = path.join(root, 'uploads/book-source-lengths.csv')
  const rows = readBookSource(readFileSync(file, 'utf8'))
  const known = new Map(rows.filter((row) => row.seconds).map((row) => [row.id, row]))
  const flagged: BookLengthFlag[] = []
  let durations = 0
  let posters = 0
  let updated = 0
  for (let page = 1; page <= 20; page += 1) {
    const found = await payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      where: { vimeoId: { exists: true } },
    })
    for (const row of found.docs as LessonRow[]) {
      const id = String(row.vimeoId || '').trim()
      const source = known.get(id)
      if (!source || !(source.seconds && source.seconds > 0)) continue
      const choice = sourceDurationChoice(Number(row.durationSeconds) || 0, source.seconds)
      const still = bookStillPath(id)
      const data: { durationSeconds?: number; posterUrl?: string } = {}
      if (choice.flagged) {
        flagged.push({ id, title: String(row.title || source.title), stored: Number(row.durationSeconds) || 0, source: source.seconds })
      } else if (choice.seconds) {
        data.durationSeconds = choice.seconds
        durations += 1
      }
      if (still && String(row.posterUrl || '').trim() !== still) {
        data.posterUrl = still
        posters += 1
      }
      if (!Object.keys(data).length) continue
      await payload.update({ collection: 'lessons', id: row.id, overrideAccess: true, data })
      updated += 1
    }
    if (!found.hasNextPage) break
  }
  const blank = rows.length - known.size
  if (flagged.length) {
    const detail = flagged.map((row) => `${row.id} ${row.title}: stored ${row.stored}s, source ${row.source}s`).join('; ')
    payload.logger.warn(`Kept ${flagged.length} Vimeo lengths that disagree with the source files by more than 2 seconds. ${detail}`)
  }
  payload.logger.info(`Book source media: wrote ${durations} lengths and ${posters} stills. Left ${blank} films as length not known yet. Flagged ${flagged.length}.`)
  return { updated, durations, posters, blank, flagged }
}
