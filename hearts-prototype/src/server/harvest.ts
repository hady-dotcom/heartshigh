import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { doorNumberOfClause } from '@/lib/doors'
import { commentaryFor, firstCitation, harvestLine, kindOfLine, lineAt, type ScholarCitation } from '@/lib/harvest'
import { idOf, portalIdOf } from '@/lib/ids'
import { wordSlice } from '@/lib/sentences'
import { visibleCourseIds, type SessionUser } from './context'
import { loadDoors } from './doors'

type Doc = Record<string, unknown> & { id: number }

export type HarvestSample = {
  id: string
  lessonId: number
  courseId: number | null
  lessonTitle: string
  speaker: string
  door: number | null
  seconds: number
  timestamp: string
  text: string
  kind: 'quran' | 'hadith' | 'line'
  surface: 'hors' | 'talk'
  gatheredAt: string
  commentary: ScholarCitation | null
}

const str = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))
const words = (text: string | undefined) => (text ? text.split(/\s+/).filter(Boolean).length : 0)

async function docs(payload: Payload, collection: string, where?: Record<string, unknown>, limit = 200) {
  const found = await payload.find({ collection: collection as 'lessons', overrideAccess: true, depth: 0, limit, ...(where ? { where: where as never } : {}) })
  return found.docs as unknown as Doc[]
}

/** The talk's door: the clause of its earliest approved cut, or of its earliest cut when none is approved. */
function doorOfCuts(cuts: Doc[], lessonId: number, doors: Awaited<ReturnType<typeof loadDoors>>) {
  const own = cuts.filter((cut) => idOf(cut.lesson) === lessonId && Number(cut.bestClause) >= 1 && Number(cut.bestClause) <= 41)
  const approved = own.filter((cut) => cut.status === 'approved')
  const first = (approved.length ? approved : own).sort((a, b) => Number(a.start) - Number(b.start))[0]
  return first ? doorNumberOfClause(Number(first.bestClause), doors) : null
}

/** Speaker, working door (1 to 20) and course for a lesson. */
export async function placeOfLesson(payload: Payload, lessonId: number) {
  const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
  if (!lesson) return null
  const courseId = idOf(lesson.course)
  const course = courseId ? ((await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null) : null
  const [cuts, doors] = await Promise.all([docs(payload, 'cuts', { lesson: { equals: lessonId } }, 50), loadDoors(payload)])
  return {
    lesson,
    courseId,
    title: str(lesson.title),
    speaker: str(lesson.speaker) || str(course?.speaker),
    door: doorOfCuts(cuts, lessonId, doors),
    transcript: str(lesson.transcript),
  }
}

/**
 * Keep one spoken line from a short clip. The text is read from the lesson transcript at `seconds`; the
 * caller's words are never stored. Completions, visits and watch time are left untouched: browsing fills the
 * harvest and nothing else.
 */
export async function captureMoment(payload: Payload, user: SessionUser, portalId: number | null, input: { lessonId: number; seconds: number; surface: 'hors' | 'appetiser' }) {
  const place = await placeOfLesson(payload, input.lessonId)
  if (!place?.courseId) return { saved: false as const, reason: 'missing' }
  if (!(await visibleCourseIds(payload, user)).includes(place.courseId)) return { saved: false as const, reason: 'hidden' }
  // A one-word caption cue ("fatim") is not a line; the nearest readable cue beside it is kept instead.
  const at = lineAt(place.transcript, input.seconds)
  const spoken = [at, ...(at ? [...at.after, ...[...at.before].reverse()].map((row) => lineAt(place.transcript, row.seconds)) : [])]
    .find((line) => line && harvestLine(line.text, line.context))
  if (!spoken) return { saved: false as const, reason: 'no-line' }
  const mine = await docs(payload, 'harvest-entries', { and: [{ user: { equals: user.id } }, { lesson: { equals: input.lessonId } }] }, 200)
  if (mine.some((row) => Math.abs(Number(row.seconds) - spoken.seconds) < 1.5 || str(row.text) === spoken.text)) return { saved: false as const, reason: 'duplicate' }
  const created = await payload.create({
    collection: 'harvest-entries',
    overrideAccess: true,
    data: {
      user: user.id,
      lesson: input.lessonId,
      portal: portalId || portalIdOf(user) || undefined,
      kind: kindOfLine(spoken.text),
      text: spoken.text,
      reference: '',
      timestamp: spoken.timestamp,
      context: wordSlice(spoken.context, 1200),
      seconds: spoken.seconds,
      speaker: place.speaker,
      door: place.door || undefined,
      surface: input.surface,
      gatheredAt: now().toISOString(),
    } as never,
  })
  return { saved: true as const, id: created.id }
}

export type ResourceRow = { name?: string; kind?: string; body?: string; url?: string }

export async function resourcesFor(payload: Payload, lessonIds: number[]) {
  const map = new Map<number, ResourceRow[]>()
  if (!lessonIds.length) return map
  for (const row of await docs(payload, 'resources', { lesson: { in: lessonIds } }, 400)) {
    const lessonId = idOf(row.lesson)
    if (!lessonId) continue
    map.set(lessonId, [...(map.get(lessonId) || []), { name: str(row.name), kind: str(row.kind), body: str(row.body), url: str(row.url) }])
  }
  return map
}

let sampleCache: { at: number; items: HarvestSample[] } | null = null

/** A handful of real lines from seeded talks across different doors and speakers, so an empty harvest still shows its shape. */
export async function sampleHarvest(payload: Payload, at = now()): Promise<HarvestSample[]> {
  if (sampleCache && at.getTime() - sampleCache.at < 60_000) return sampleCache.items
  const lessons = (await docs(payload, 'lessons', undefined, 120)).filter((lesson) => str(lesson.transcript).length > 80)
  const lessonIds = lessons.map((lesson) => lesson.id)
  const [cuts, tiers, courses, resources, doors] = await Promise.all([
    lessonIds.length ? docs(payload, 'cuts', { lesson: { in: lessonIds } }, 600) : Promise.resolve([]),
    lessonIds.length ? docs(payload, 'talk-tiers', { lesson: { in: lessonIds } }, 200) : Promise.resolve([]),
    docs(payload, 'courses', undefined, 100),
    resourcesFor(payload, lessonIds),
    loadDoors(payload),
  ])
  type Candidate = Omit<HarvestSample, 'id' | 'gatheredAt'>
  const candidates: Candidate[] = []
  let cited = false
  for (const lesson of lessons) {
    const door = doorOfCuts(cuts, lesson.id, doors)
    if (!door) continue
    const transcript = str(lesson.transcript)
    const tier = tiers.find((row) => idOf(row.lesson) === lesson.id)
    const from = Number.isFinite(Number(tier?.horsStart)) ? Number(tier?.horsStart) : 0
    let spoken = lineAt(transcript, from)
    for (const extra of [15, 30]) {
      if (words(spoken?.text) >= 8) break
      const next = lineAt(transcript, from + extra)
      if (words(next?.text) > words(spoken?.text)) spoken = next
    }
    const readable = spoken ? harvestLine(spoken.text, spoken.context) : null
    if (!spoken || !readable || words(spoken.text) < 8) continue
    const speaker = str(lesson.speaker) || str(courses.find((row) => row.id === idOf(lesson.course))?.speaker)
    const base = { lessonId: lesson.id, courseId: idOf(lesson.course), lessonTitle: str(lesson.title), speaker, door }
    candidates.push({ ...base, seconds: spoken.seconds, timestamp: spoken.timestamp, text: readable, kind: kindOfLine(spoken.text), surface: 'hors', commentary: commentaryFor(transcript, spoken.seconds, resources.get(lesson.id) || []) })
    if (!cited) {
      const found = firstCitation(transcript)
      const line = found ? lineAt(transcript, found.seconds) : null
      const lineText = line ? harvestLine(line.text, line.context) : null
      if (found && line && lineText && words(line.text) >= 8 && !candidates.some((row) => row.text === lineText)) {
        candidates.push({ ...base, seconds: line.seconds, timestamp: line.timestamp, text: lineText, kind: kindOfLine(line.text), surface: 'talk', commentary: found.citation })
        cited = true
      }
    }
  }
  const picked: Candidate[] = []
  const seenDoors = new Set<number>()
  const seenSpeakers = new Set<string>()
  for (const row of candidates.filter((item) => item.surface === 'hors')) {
    if (picked.length >= 5) break
    if (picked.length >= 2 && (row.door === null || seenDoors.has(row.door)) && seenSpeakers.has(row.speaker)) continue
    if (picked.some((item) => item.text === row.text)) continue
    picked.push(row)
    if (row.door) seenDoors.add(row.door)
    seenSpeakers.add(row.speaker)
  }
  const withCitation = candidates.find((row) => row.commentary && !picked.some((item) => item.text === row.text))
  if (withCitation) picked.push(withCitation)
  picked.sort((a, b) => (a.door ?? 99) - (b.door ?? 99) || a.speaker.localeCompare(b.speaker))
  const items = picked.map((row, index) => ({
    ...row,
    id: `sample-${row.lessonId}-${Math.round(row.seconds)}`,
    gatheredAt: new Date(at.getTime() - (index >= picked.length - 2 ? 2 : 72) * 60 * 60 * 1000).toISOString(),
  }))
  sampleCache = { at: at.getTime(), items }
  return items
}

/** Drop the in-memory sample after a reseed in the same process. */
export function clearHarvestSample() {
  sampleCache = null
}
