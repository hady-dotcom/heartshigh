import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { idOf } from '@/lib/ids'
import { recommendLesson } from '@/lib/placing'
import { visibleCourseIds, type PortalDoc, type SessionUser } from './context'

export type SlideStyle = 'kinetic' | 'cinema' | 'windows' | 'conversation' | 'unfold'

export type FeedItem = {
  id: string
  cutId: number
  lane: string
  laneLabel: string
  speaker: string
  speakerSlug: string
  portrait: string | null
  poster: string | null
  youtubeId: string | null
  courseId: number
  courseTitle: string
  lessonId: number
  hors: { start: number; end: number; quote: string }
  appetiser: { start: number; end: number; quote: string }
  hook: string
  turn: string
  land: string
  style: SlideStyle | null
  clause: number | null
  /** The lane this slot was routed for; null for spine clips and D0. */
  laneKey?: string | null
  laneTags?: { lane: string; weight: number }[]
  lessonTitle?: string
  placeholder?: boolean
  transcriptReady?: boolean
}

export type CourseCard = {
  id: number
  title: string
  summary: string
  speaker: string
  speakerSlug: string
  parts: number
  poster: string | null
  firstLessonId: number | null
  opensOnDay: number
  open: boolean
  recommended: boolean
}

const LANES: [RegExp, string, string][] = [
  [/ease|harsh/i, 'ease', 'Ease'],
  [/light|heart/i, 'light', 'Light'],
  [/lord/i, 'lord', 'Your Lord'],
  [/prayer/i, 'prayer', 'Prayer'],
  [/household/i, 'home', 'Home life'],
  [/prophet/i, 'prophet', 'The Prophet'],
  [/story/i, 'stories', 'Stories'],
]

export function laneOf(theme: string | null | undefined) {
  for (const [pattern, key, label] of LANES) if (pattern.test(theme || '')) return { key, label }
  return { key: 'reflections', label: 'Reflections' }
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/^(shaykh|sheikh|imam|ustadh)\s+/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function publicFile(relative: string) {
  return existsSync(path.join(process.cwd(), 'public', relative)) ? `/${relative}` : null
}

export function portraitFor(slug: string) {
  return publicFile(`speakers/${slug}.jpg`)
}

export function posterFor(youtubeId: string | null | undefined) {
  if (!youtubeId) return null
  return publicFile(`clips/${youtubeId}.jpg`) || `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`
}

export const SLIDE_ART: Record<SlideStyle, string> = {
  kinetic: '/slides/bg-kinetic-truck.jpg',
  cinema: '/slides/bg-cinema-road.jpg',
  windows: '/slides/bg-windows-mist.jpg',
  conversation: '/slides/bg-conversation-night.jpg',
  unfold: '/slides/bg-windows-mist.jpg',
}

export function initials(name: string) {
  return name
    .replace(/^(shaykh|sheikh|imam|ustadh)\s+/i, '')
    .split(/\s+/)
    .map((part) => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function dayNumber(user: SessionUser & { joinedAt?: string | null; createdAt?: string }) {
  const start = new Date(user.joinedAt || user.createdAt || now().toISOString())
  return Math.max(1, Math.floor((now().getTime() - start.getTime()) / 86_400_000) + 1)
}

type Row = Record<string, unknown> & { id: number }

export async function lessonsFor(payload: Payload, courseIds: number[]) {
  if (!courseIds.length) return [] as Row[]
  const found = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 400, where: { course: { in: courseIds } }, sort: 'order' })
  return found.docs as unknown as Row[]
}

export async function loadFeed(payload: Payload, user: SessionUser): Promise<FeedItem[]> {
  const courseIds = await visibleCourseIds(payload, user)
  if (!courseIds.length) return []
  const courses = (await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: courseIds } } })).docs as unknown as Row[]
  const lessons = await lessonsFor(payload, courseIds)
  const lessonIds = lessons.map((lesson) => lesson.id)
  if (!lessonIds.length) return []
  const cuts = (await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 200, where: { and: [{ lesson: { in: lessonIds } }, { status: { equals: 'approved' } }] }, sort: 'start' })).docs as unknown as Row[]
  const ladder = (await payload.find({ collection: 'ladder-items', overrideAccess: true, depth: 0, limit: 400, where: { and: [{ lesson: { in: lessonIds } }, { status: { equals: 'approved' } }] } })).docs as unknown as Row[]
  const styles: SlideStyle[] = ['kinetic', 'cinema', 'windows', 'conversation', 'unfold']
  let slideCount = 0
  const items: FeedItem[] = []
  for (const cut of cuts) {
    const lesson = lessons.find((row) => row.id === idOf(cut.lesson))
    if (!lesson) continue
    const course = courses.find((row) => row.id === idOf(lesson.course))
    if (!course) continue
    const start = Number(cut.start)
    const end = Number(cut.end)
    const within = ladder.filter((item) => idOf(item.lesson) === lesson.id && Number(item.start) >= start - 1 && Number(item.end) <= end + 1)
    const hors = within.find((item) => item.kind === 'hors')
    const appetiser = within.find((item) => item.kind === 'appetiser')
    const speaker = String(lesson.speaker || course.speaker || 'The speaker')
    const slug = slugify(speaker)
    const youtubeId = (lesson.youtubeId as string) || null
    const lane = laneOf(cut.theme as string)
    items.push({
      id: `cut-${cut.id}`,
      cutId: cut.id,
      lane: lane.key,
      laneLabel: lane.label,
      speaker,
      speakerSlug: slug,
      portrait: portraitFor(slug),
      poster: posterFor(youtubeId),
      youtubeId,
      courseId: course.id,
      courseTitle: String(course.title || ''),
      lessonId: lesson.id,
      hors: hors ? { start: Number(hors.start), end: Number(hors.end), quote: String(hors.quote || cut.land) } : { start: Math.max(start, end - 18), end, quote: String(cut.land) },
      appetiser: appetiser ? { start: Number(appetiser.start), end: Number(appetiser.end), quote: String(appetiser.quote || cut.land) } : { start, end, quote: String(cut.land) },
      hook: String(cut.hook || ''),
      turn: String(cut.turn || ''),
      land: String(cut.land || ''),
      style: youtubeId ? null : styles[slideCount++ % styles.length],
      clause: (cut.bestClause as number) || null,
    })
  }
  return items
}

export async function courseCards(payload: Payload, user: SessionUser): Promise<CourseCard[]> {
  const courseIds = await visibleCourseIds(payload, user)
  if (!courseIds.length) return []
  const courses = (await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: courseIds } } })).docs as unknown as Row[]
  const lessons = await lessonsFor(payload, courseIds)
  const lessonOrder = courses.flatMap((course) => lessons.filter((lesson) => idOf(lesson.course) === course.id).map((lesson) => lesson.id))
  const cuts = lessons.length
    ? ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 400, where: { lesson: { in: lessons.map((lesson) => lesson.id) } } })).docs as unknown as Row[])
    : []
  const firstPick = user.startingClause
    ? recommendLesson(
        Number(user.startingClause),
        cuts.map((cut) => ({ lessonId: idOf(cut.lesson) || 0, bestClause: (cut.bestClause as number) || null, approved: cut.status === 'approved' })),
        lessonOrder,
      )
    : null
  const recommendedCourse = firstPick ? idOf(lessons.find((lesson) => lesson.id === firstPick)?.course) : null
  const ordered = [...courses].sort((a, b) => (a.id === recommendedCourse ? -1 : b.id === recommendedCourse ? 1 : a.id - b.id))
  const today = dayNumber(user as SessionUser & { joinedAt?: string })
  return ordered.map((course, index) => {
    const own = lessons.filter((lesson) => idOf(lesson.course) === course.id)
    const speaker = String(course.speaker || own[0]?.speaker || '')
    return {
      id: course.id,
      title: String(course.title || ''),
      summary: String(course.summary || ''),
      speaker,
      speakerSlug: slugify(speaker),
      parts: own.length,
      poster: posterFor((own.find((lesson) => lesson.youtubeId)?.youtubeId as string) || null),
      firstLessonId: own[0]?.id ?? null,
      opensOnDay: index + 1,
      open: index + 1 <= today,
      recommended: course.id === recommendedCourse,
    }
  })
}

export function portalName(portal: PortalDoc) {
  return portal.organisationName || portal.name
}
