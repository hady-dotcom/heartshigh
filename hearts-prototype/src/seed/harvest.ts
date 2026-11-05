import type { Payload } from 'payload'
import { giveHarvest, talkHarvest } from '../server/scripture'

type Doc = { id: number; [key: string]: unknown }

const DAY = 86_400_000

/** Talks Maryam finished before her first look, so her Harvest has verses, hadith and something new. */
const MARYAM_TALKS = ['NIR88RRpat4', 'ECaTWkof57E', 'TLCGBj4AlB0']

/**
 * Reads every talk that has a transcript once, so its harvest is cached, and gives the demo learner
 * the harvest of the talks she has finished. The fallback bundle keeps this the same offline.
 */
export async function seedHarvest(payload: Payload, opts: { now: Date; demo: boolean }) {
  process.env.HEARTS_SCRIPTURE_OFFLINE ??= '1'
  const lessons = (await payload.find({ collection: 'lessons', overrideAccess: true, limit: 1000, depth: 0, where: { transcript: { exists: true } } })).docs as unknown as Doc[]
  let talks = 0
  let items = 0
  const empty: string[] = []
  for (const lesson of lessons) {
    const transcript = typeof lesson.transcript === 'string' ? lesson.transcript : ''
    if (!transcript.trim()) continue
    const harvest = await talkHarvest(payload, lesson.id, transcript)
    talks += 1
    items += harvest.length
    if (!harvest.length) empty.push(String(lesson.title))
  }
  console.log(`Harvest: ${items} verses and hadith across ${talks} talks.${empty.length ? ` No quotation found in ${empty.length}: ${empty.join('; ')}.` : ''}`)
  if (!opts.demo) return

  const maryam = (await payload.find({ collection: 'users', overrideAccess: true, limit: 1, depth: 0, where: { email: { equals: 'elm-learner@hearts.test' } } })).docs[0] as unknown as Doc | undefined
  if (!maryam) return
  const portal = ((maryam.tenants as { tenant?: number | { id: number } }[] | undefined)?.[0]?.tenant) as number | { id: number } | undefined
  const portalId = typeof portal === 'object' ? portal.id : portal
  if ((await payload.count({ collection: 'harvest-entries', overrideAccess: true, where: { user: { equals: maryam.id } } })).totalDocs) return

  for (const [index, youtubeId] of MARYAM_TALKS.entries()) {
    const lesson = lessons.find((row) => row.youtubeId === youtubeId)
    if (!lesson) continue
    const exists = await payload.count({ collection: 'completions', overrideAccess: true, where: { and: [{ user: { equals: maryam.id } }, { lesson: { equals: lesson.id } }] } })
    if (!exists.totalDocs) {
      const at = new Date(opts.now.getTime() - (52 - index) * DAY).toISOString()
      await payload.create({ collection: 'completions', overrideAccess: true, data: { user: maryam.id, lesson: lesson.id, percent: 100, onTime: true, portal: portalId, watchedAt: at, createdAt: at, updatedAt: at } as never })
    }
  }
  const completions = (await payload.find({ collection: 'completions', overrideAccess: true, limit: 100, depth: 0, sort: 'createdAt', where: { user: { equals: maryam.id } } })).docs as unknown as Doc[]
  const finished: { lesson: Doc; transcript: string; at: string; count: number }[] = []
  for (const row of completions) {
    const lessonId = typeof row.lesson === 'object' ? (row.lesson as Doc).id : Number(row.lesson)
    const lesson = lessons.find((item) => item.id === lessonId)
    const transcript = typeof lesson?.transcript === 'string' ? lesson.transcript : ''
    if (!lesson || !transcript.trim()) continue
    const count = (await talkHarvest(payload, lesson.id, transcript)).length
    finished.push({ lesson, transcript, at: new Date(String(row.createdAt || opts.now.toISOString())).toISOString(), count })
  }
  const latest = finished.filter((row) => row.count).pop()
  for (const row of finished) {
    await giveHarvest(payload, maryam.id, row.lesson.id, row.transcript, portalId, row === latest ? { createdAt: row.at } : { createdAt: row.at, seenAt: row.at })
  }
}
