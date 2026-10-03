import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import {
  commentaryFor,
  doorTitle,
  firstCitation,
  kindOfLine,
  lineAt,
  WORKING_DOORS,
  type ScholarCitation,
} from '@/lib/harvest'
import { idOf, portalIdOf } from '@/lib/ids'
import { formatTimestamp, parseTimestamp } from '@/lib/transcript'
import { visibleCourseIds, type SessionUser } from './context'

type Doc = Record<string, unknown> & { id: number }

export type HarvestView = {
  id: number | string
  lessonId: number
  courseId: number | null
  lessonTitle: string
  speaker: string
  door: string
  doorLabel: string
  seconds: number
  timestamp: string
  text: string
  kind: 'quran' | 'hadith' | 'line'
  surface: 'hors' | 'appetiser' | 'talk'
  gatheredAt: string
  commentary: ScholarCitation | null
}

const str = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value))

async function docs(payload: Payload, collection: string, where?: Record<string, unknown>, limit = 200) {
  const found = await payload.find({
    collection: collection as 'lessons',
    overrideAccess: true,
    depth: 0,
    limit,
    ...(where ? { where: where as never } : {}),
  })
  return found.docs as unknown as Doc[]
}

/** Speaker, working door and course for a lesson. The door is the clause core already on the cut. */
export async function placeOfLesson(payload: Payload, lessonId: number) {
  const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
  if (!lesson) return null
  const courseId = idOf(lesson.course)
  const course = courseId ? ((await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null) : null
  const cuts = await docs(payload, 'cuts', { lesson: { equals: lessonId } }, 20)
  const clauseNumber = cuts.map((cut) => Number(cut.bestClause) || 0).find((value) => value >= 1 && value <= 41) || 0
  const clause = clauseNumber ? (await docs(payload, 'clauses', { number: { equals: clauseNumber } }, 1))[0] : null
  const door = WORKING_DOORS.some((row) => row.key === str(clause?.core)) ? str(clause?.core) : ''
  return {
    lesson,
    courseId,
    title: str(lesson.title),
    speaker: str(lesson.speaker) || str(course?.speaker),
    door,
    transcript: str(lesson.transcript),
  }
}

/**
 * Keep one spoken line from a short clip. The text is read from the lesson transcript at `seconds`.
 * The caller's words are never stored. Completions, visits and watch time are left untouched.
 */
export async function captureMoment(
  payload: Payload,
  user: SessionUser,
  portalId: number | null,
  input: { lessonId: number; seconds: number; surface: 'hors' | 'appetiser' },
) {
  const place = await placeOfLesson(payload, input.lessonId)
  if (!place?.courseId) return { saved: false as const, reason: 'missing' }
  const visible = await visibleCourseIds(payload, user)
  if (!visible.includes(place.courseId)) return { saved: false as const, reason: 'hidden' }
  const spoken = lineAt(place.transcript, input.seconds)
  if (!spoken) return { saved: false as const, reason: 'no-line' }
  const mine = await docs(payload, 'harvest-entries', { and: [{ user: { equals: user.id } }, { lesson: { equals: input.lessonId } }] }, 80)
  const duplicate = mine.some((row) => Math.abs(Number(row.seconds) - spoken.seconds) < 1.5 || str(row.text) === spoken.text)
  if (duplicate) return { saved: false as const, reason: 'duplicate' }
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
      context: spoken.context.slice(0, 1200),
      seconds: spoken.seconds,
      speaker: place.speaker,
      door: place.door,
      surface: input.surface,
      gatheredAt: now().toISOString(),
    } as never,
  })
  return { saved: true as const, id: created.id }
}

/** Qur'an and hadith copied when a whole part is marked watched. Still verbatim, and still not a substitute for the short-clip lines. */
export async function saveTranscriptQuotes(payload: Payload, user: SessionUser, portalId: number | null, lessonId: number, transcript: string) {
  const { harvestTranscript } = await import('@/lib/harvest')
  const place = await placeOfLesson(payload, lessonId)
  if (!place) return
  const mine = await docs(payload, 'harvest-entries', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, 80)
  const seen = new Set(mine.map((row) => str(row.text).toLowerCase().replace(/\s+/g, ' ')))
  for (const hit of harvestTranscript(transcript)) {
    const key = hit.text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    const seconds = parseTimestamp(hit.timestamp) ?? 0
    await payload.create({
      collection: 'harvest-entries',
      overrideAccess: true,
      data: {
        user: user.id,
        lesson: lessonId,
        portal: portalId || undefined,
        ...hit,
        seconds,
        speaker: place.speaker,
        door: place.door,
        surface: 'talk',
        gatheredAt: now().toISOString(),
      } as never,
    })
  }
}

function viewFrom(
  row: {
    id: number | string
    lessonId: number
    courseId: number | null
    lessonTitle: string
    speaker: string
    door: string
    seconds: number
    timestamp: string
    text: string
    kind: 'quran' | 'hadith' | 'line'
    surface: 'hors' | 'appetiser' | 'talk'
    gatheredAt: string
    commentary: ScholarCitation | null
  },
): HarvestView {
  return { ...row, doorLabel: doorTitle(row.door) }
}

async function resourcesFor(payload: Payload, lessonIds: number[]) {
  if (!lessonIds.length) return new Map<number, { name?: string; kind?: string; body?: string; url?: string }[]>()
  const rows = await docs(payload, 'resources', { lesson: { in: lessonIds } }, 200)
  const map = new Map<number, { name?: string; kind?: string; body?: string; url?: string }[]>()
  for (const row of rows) {
    const lessonId = idOf(row.lesson)
    if (!lessonId) continue
    const list = map.get(lessonId) || []
    list.push({ name: str(row.name), kind: str(row.kind), body: str(row.body), url: str(row.url) })
    map.set(lessonId, list)
  }
  return map
}

function kindOf(value: unknown): HarvestView['kind'] {
  return value === 'quran' || value === 'hadith' || value === 'line' ? value : 'line'
}

function surfaceOf(value: unknown): HarvestView['surface'] {
  return value === 'hors' || value === 'appetiser' || value === 'talk' ? value : 'hors'
}

/** The learner's own lines, newest first. Commentary is read from the transcript or a stored resource, never written in here. */
export async function ownHarvest(payload: Payload, user: SessionUser): Promise<HarvestView[]> {
  const rows = await docs(payload, 'harvest-entries', { user: { equals: user.id } }, 200)
  rows.sort((a, b) => str(b.gatheredAt || b.createdAt).localeCompare(str(a.gatheredAt || a.createdAt)))
  const lessonIds = [...new Set(rows.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await docs(payload, 'lessons', { id: { in: lessonIds } }, lessonIds.length) : []
  const resources = await resourcesFor(payload, lessonIds)
  return rows.map((row) => {
    const lessonId = idOf(row.lesson) || 0
    const lesson = lessons.find((item) => item.id === lessonId)
    const seconds = Number(row.seconds)
    const at = Number.isFinite(seconds) ? seconds : parseTimestamp(str(row.timestamp)) ?? 0
    const transcript = str(lesson?.transcript)
    const commentary = transcript ? commentaryFor(transcript, at, resources.get(lessonId) || []) : commentaryFor('', at, resources.get(lessonId) || [])
    return viewFrom({
      id: row.id,
      lessonId,
      courseId: idOf(lesson?.course),
      lessonTitle: str(lesson?.title),
      speaker: str(row.speaker) || str(lesson?.speaker),
      door: str(row.door),
      seconds: at,
      timestamp: str(row.timestamp) || formatTimestamp(at),
      text: str(row.text),
      kind: kindOf(row.kind),
      surface: surfaceOf(row.surface),
      gatheredAt: str(row.gatheredAt || row.createdAt),
      commentary,
    })
  })
}

type Candidate = Omit<HarvestView, 'id' | 'doorLabel' | 'gatheredAt'> & { commentary: ScholarCitation | null }

let sampleCache: { at: number; items: HarvestView[] } | null = null

/** A handful of real lines from seeded talks, so an empty harvest still shows the shape of the screen. */
export async function sampleHarvest(payload: Payload, at = now()): Promise<HarvestView[]> {
  if (sampleCache && at.getTime() - sampleCache.at < 60_000) return sampleCache.items
  const lessons = await docs(payload, 'lessons', undefined, 80)
  const withText = lessons.filter((lesson) => str(lesson.transcript).length > 80)
  const lessonIds = withText.map((lesson) => lesson.id)
  const [cuts, tiers, courses, resources] = await Promise.all([
    lessonIds.length ? docs(payload, 'cuts', { lesson: { in: lessonIds } }, 400) : Promise.resolve([]),
    lessonIds.length ? docs(payload, 'talk-tiers', { lesson: { in: lessonIds } }, 80) : Promise.resolve([]),
    docs(payload, 'courses', undefined, 40),
    resourcesFor(payload, lessonIds),
  ])
  const clauseNumbers = [...new Set(cuts.map((cut) => Number(cut.bestClause) || 0).filter((value) => value >= 1 && value <= 41))]
  const clauses = clauseNumbers.length ? await docs(payload, 'clauses', { number: { in: clauseNumbers } }, 50) : []
  const doorOf = (lessonId: number) => {
    const cut = cuts.find((row) => idOf(row.lesson) === lessonId && Number(row.bestClause) >= 1 && Number(row.bestClause) <= 41)
    const clause = clauses.find((row) => Number(row.number) === Number(cut?.bestClause))
    const core = str(clause?.core)
    return WORKING_DOORS.some((row) => row.key === core) ? core : ''
  }
  const candidates: Candidate[] = []
  let foundCitation = false
  for (const lesson of withText) {
    const door = doorOf(lesson.id)
    if (!door) continue
    const transcript = str(lesson.transcript)
    const tier = tiers.find((row) => idOf(row.lesson) === lesson.id)
    const horsAt = Number(tier?.horsStart)
    const seconds = Number.isFinite(horsAt) ? horsAt : 0
    let spoken = lineAt(transcript, seconds)
    for (const extra of [15, 30]) {
      if (spoken && spoken.text.split(/\s+/).length >= 8) break
      const next = lineAt(transcript, seconds + extra)
      if (next && next.text.split(/\s+/).length > (spoken?.text.split(/\s+/).length || 0)) spoken = next
    }
    if (!spoken || spoken.text.split(/\s+/).length < 8) continue
    const course = courses.find((row) => row.id === idOf(lesson.course))
    const speaker = str(lesson.speaker) || str(course?.speaker)
    candidates.push({
      lessonId: lesson.id,
      courseId: idOf(lesson.course),
      lessonTitle: str(lesson.title),
      speaker,
      door,
      seconds: spoken.seconds,
      timestamp: spoken.timestamp,
      text: spoken.text,
      kind: kindOfLine(spoken.text),
      surface: 'hors',
      commentary: commentaryFor(transcript, spoken.seconds, resources.get(lesson.id) || []),
    })
    if (!foundCitation) {
      const cited = firstCitation(transcript)
      if (cited) {
        const line = lineAt(transcript, cited.seconds)
        if (line && line.text.split(/\s+/).length >= 8 && !candidates.some((row) => row.text === line.text)) {
          candidates.push({
            lessonId: lesson.id,
            courseId: idOf(lesson.course),
            lessonTitle: str(lesson.title),
            speaker,
            door,
            seconds: line.seconds,
            timestamp: line.timestamp,
            text: line.text,
            kind: kindOfLine(line.text),
            surface: 'talk',
            commentary: cited.citation,
          })
          foundCitation = true
        }
      }
    }
  }
  const picked: Candidate[] = []
  const doors = new Set<string>()
  const speakers = new Set<string>()
  const hors = candidates.filter((row) => row.surface === 'hors' && row.door)
  for (const row of hors) {
    if (picked.length >= 5) break
    const freshDoor = Boolean(row.door) && !doors.has(row.door)
    const freshSpeaker = Boolean(row.speaker) && !speakers.has(row.speaker)
    if (picked.length >= 2 && !freshDoor && !freshSpeaker) continue
    if (picked.some((item) => item.text === row.text)) continue
    picked.push(row)
    if (row.door) doors.add(row.door)
    if (row.speaker) speakers.add(row.speaker)
  }
  const cited = candidates.find((row) => row.commentary && !picked.some((item) => item.text === row.text))
  if (cited) picked.push(cited)
  picked.sort((a, b) => WORKING_DOORS.findIndex((door) => door.key === a.door) - WORKING_DOORS.findIndex((door) => door.key === b.door) || a.speaker.localeCompare(b.speaker))
  const items = picked.map((row, index) => {
    const recent = index >= Math.max(0, picked.length - 2)
    return viewFrom({
      ...row,
      id: `sample-${row.lessonId}-${Math.round(row.seconds)}`,
      gatheredAt: new Date(at.getTime() - (recent ? 2 * 60 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000)).toISOString(),
    })
  })
  sampleCache = { at: at.getTime(), items }
  return items
}

/** Drop the in-memory sample after a reseed in the same process. */
export function clearHarvestSample() {
  sampleCache = null
}
