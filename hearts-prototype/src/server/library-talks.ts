import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import { doorNumberOfClause } from '@/lib/doors'
import {
  parseLibraryDoor,
  talkStatus,
  videoSource,
  type LibraryTalk,
} from '@/lib/library-talks'
import { isUnderMinTalk } from '@/lib/talk-length'

type Doc = Record<string, unknown> & { id: number }

const LESSON_FIELDS = {
  title: true,
  speaker: true,
  sourceTitle: true,
  course: true,
  unit: true,
  jibrilSection: true,
  ghunyaHeading: true,
  durationSeconds: true,
  publishState: true,
  transcript: true,
  transcriptSource: true,
  transcriptNote: true,
  videoProvider: true,
  youtubeId: true,
  vimeoId: true,
  createdAt: true,
  binned: true,
  tooShort: true,
} as const

async function every(payload: Payload, collection: string, where?: Record<string, unknown>, select?: Record<string, boolean>) {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection: collection as 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: 200,
      page,
      sort: 'id',
      ...(select ? { select: select as never } : {}),
      ...(where ? { where: where as never } : {}),
    })
    docs.push(...(found.docs as unknown as Doc[]))
    if (!found.docs.length || page >= found.totalPages) break
    page += 1
    if (page > 40) break
  }
  return docs
}

function lessonIdOfTag(tag: Doc) {
  const item = tag.item
  if (!item || typeof item !== 'object') return 0
  const rel = item as { relationTo?: unknown; value?: unknown }
  if (rel.relationTo !== 'lessons') return 0
  return idOf(rel.value) || 0
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function toTalk(lesson: Doc, ctx: {
  courseTitle: Map<number, string>
  courseSpeaker: Map<number, string>
  unitTitle: Map<number, string>
  tags: Map<number, string[]>
  cutDoor: Map<number, number>
}): LibraryTalk {
  const courseId = idOf(lesson.course) || 0
  const fromSection = parseLibraryDoor(text(lesson.jibrilSection))
  const door = fromSection || ctx.cutDoor.get(lesson.id) || null
  const duration = Number(lesson.durationSeconds)
  const durationSeconds = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null
  const heading = text(lesson.ghunyaHeading)
  const tags = [...(ctx.tags.get(lesson.id) || [])]
  if (heading) tags.push(heading)
  return {
    id: lesson.id,
    title: text(lesson.title) || 'Untitled talk',
    teacher: text(lesson.speaker) || ctx.courseSpeaker.get(courseId) || '',
    series: ctx.courseTitle.get(courseId) || '',
    unit: ctx.unitTitle.get(idOf(lesson.unit) || 0) || '',
    tags,
    also: text(lesson.sourceTitle),
    door,
    status: talkStatus({
      publishState: text(lesson.publishState) || null,
      transcript: typeof lesson.transcript === 'string' ? lesson.transcript : '',
      transcriptSource: text(lesson.transcriptSource) || null,
      transcriptNote: text(lesson.transcriptNote) || null,
    }),
    durationSeconds,
    source: videoSource({
      videoProvider: text(lesson.videoProvider) || null,
      youtubeId: text(lesson.youtubeId) || null,
      vimeoId: text(lesson.vimeoId) || null,
    }),
    addedAt: text(lesson.createdAt),
    binned: lesson.binned === true,
    tooShort: lesson.tooShort === true || isUnderMinTalk(durationSeconds),
    courseId,
    youtubeId: text(lesson.youtubeId),
    vimeoId: text(lesson.vimeoId),
  }
}

async function contextFor(payload: Payload, lessons: Doc[]) {
  const [courses, units, tags, cuts, lanes, clauses] = await Promise.all([
    every(payload, 'courses'),
    every(payload, 'units'),
    every(payload, 'tags', { 'item.relationTo': { equals: 'lessons' } }),
    every(payload, 'cuts'),
    every(payload, 'lanes'),
    every(payload, 'clauses'),
  ])
  const courseTitle = new Map(courses.map((course) => [course.id, text(course.title)]))
  const courseSpeaker = new Map(courses.map((course) => [course.id, text(course.speaker)]))
  const unitTitle = new Map(units.map((unit) => [unit.id, text(unit.title)]))
  const laneTitle = new Map(lanes.map((lane) => [lane.id, text(lane.title)]))
  const clauseText = new Map(clauses.map((clause) => [clause.id, text(clause.fragment)]))
  const tagMap = new Map<number, string[]>()
  for (const tag of tags) {
    const lessonId = lessonIdOfTag(tag)
    if (!lessonId) continue
    const bits = [text(tag.note), laneTitle.get(idOf(tag.lane) || 0) || '', clauseText.get(idOf(tag.clause) || 0) || ''].filter(Boolean)
    if (!bits.length) continue
    const list = tagMap.get(lessonId) || []
    list.push(...bits)
    tagMap.set(lessonId, list)
  }
  const cutDoor = new Map<number, number>()
  for (const cut of cuts) {
    const lessonId = idOf(cut.lesson) || 0
    if (!lessonId || cutDoor.has(lessonId)) continue
    const door = doorNumberOfClause(Number(cut.bestClause || 0))
    if (door) cutDoor.set(lessonId, door)
  }
  void lessons
  return { courseTitle, courseSpeaker, unitTitle, tags: tagMap, cutDoor }
}

function isLibraryCourse(course: Doc | null | undefined) {
  return Boolean(course && course.origin === 'master' && course.importable !== false)
}

export async function loadLibraryTalks(payload: Payload) {
  const courses = await every(payload, 'courses', { and: [{ origin: { equals: 'master' } }, { importable: { not_equals: false } }] })
  const ids = courses.map((course) => course.id)
  if (!ids.length) return []
  const lessons = await every(payload, 'lessons', { course: { in: ids } }, LESSON_FIELDS)
  const ctx = await contextFor(payload, lessons)
  return lessons.map((lesson) => toTalk(lesson, ctx))
}

export async function loadLibraryTalk(payload: Payload, id: number) {
  if (!Number.isInteger(id) || id <= 0) return null
  const found = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { id: { equals: id } },
    select: LESSON_FIELDS as never,
  }).catch(() => null)
  const lesson = (found?.docs?.[0] as Doc | undefined) || null
  if (!lesson) return null
  const courseId = idOf(lesson.course)
  const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null) : null
  if (!isLibraryCourse(course as Doc | null | undefined)) return null
  const ctx = await contextFor(payload, [lesson])
  return toTalk(lesson, ctx)
}
