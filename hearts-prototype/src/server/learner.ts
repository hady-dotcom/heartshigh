import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { idOf } from '@/lib/ids'
import { recommendLesson } from '@/lib/placing'
import { doorOfClause } from '@/lib/doors'
import { loadDoors } from './doors'
import type { PieceRef } from '@/lib/nesting'
import { visibleCourseIds, type PortalDoc, type SessionUser } from './context'

export type SlideStyle = 'kinetic' | 'cinema' | 'windows' | 'conversation' | 'unfold'

export type TimedCaption = { at: number; text: string; role?: 'hook' | 'turn' | 'land' }

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
  /** `lines` are the captions with when each is said, so the caption follows the speaker. */
  hors: { start: number; end: number; quote: string; lines?: TimedCaption[] }
  appetiser: { start: number; end: number; quote: string; lines?: TimedCaption[]; spans?: { role?: 'hook' | 'turn' | 'land'; start: number; end: number }[] }
  hook: string
  turn: string
  land: string
  style: SlideStyle | null
  /** Rendered typography standing in for the hors d'oeuvre, when an admin has chosen one. */
  typography?: { style: SlideStyle; inPlace: true; src: string } | null
  /** Beat films rendered for this talk. The feed alternates one of them with a scenic card. */
  films?: { beat: 'hook' | 'turn' | 'land'; style: SlideStyle; src: string; quote: string }[]
  /** Verbatim hook, turn and land for the scenic card, when the sheet has them. */
  beats?: { beat: 'hook' | 'turn' | 'land'; quote: string; gold: string; audio: string | null; words?: { text: string; at: number }[]; verse?: string | null }[]
  /** Catalogue style, local still, and stored photographic still. A return visit keeps the stored still. */
  cardStyle?: SlideStyle | null
  cardScene?: string | null
  cardBackground?: string | null
  /** Set when this card is a film, a scenic card, a line of the talk, or a question rather than the talk itself. */
  card?: 'talk' | 'film' | 'text' | 'question' | 'scene'
  film?: { beat: 'hook' | 'turn' | 'land'; style: SlideStyle; src: string; quote: string }
  scene?: { style: SlideStyle; scene: string; destination: 'clip' | 'talk'; brightness?: 'light' | 'mid' | 'dark' | null; beats: { beat: 'hook' | 'turn' | 'land'; quote: string; gold: string; audio: string | null; words?: { text: string; at: number }[]; verse?: string | null }[] }
  prompt?: string
  clause: number | null
  door?: number | null
  /** The lane this slot was routed for; null for spine clips and D0. */
  laneKey?: string | null
  laneTags?: { lane: string; weight: number }[]
  lessonTitle?: string
  placeholder?: boolean
  transcriptReady?: boolean
  /** The talk's tier record: a machine draft until a person checks it. */
  tierStatus?: 'draft' | 'checked' | null
  /** Show "Resume from where the appetiser ended" beside the main, which opens at 0:00. */
  offerResume?: boolean
  /** Hors d'oeuvre -> its appetiser -> its full talk. Learn more uses the current piece's parent only. */
  parents: { hors: PieceRef; appetiser: PieceRef }
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
  /** The Jibril doors this course's talks sit in, in door order. */
  doors: { number: number; title: string }[]
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

/** A still safe to paint as a thumbnail. YouTube's stand-in for a missing film is a grey ellipsis, so those fall through to the garden crop. */
export function shownPoster(url: string | null | undefined) {
  if (!url) return null
  if (/i\.ytimg\.com|img\.youtube\.com/i.test(url)) return null
  return url
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

export async function courseCards(payload: Payload, user: SessionUser): Promise<CourseCard[]> {
  const courseIds = await visibleCourseIds(payload, user)
  if (!courseIds.length) return []
  const courses = (await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: courseIds } } })).docs as unknown as Row[]
  const lessons = await lessonsFor(payload, courseIds)
  const lessonOrder = courses.flatMap((course) => lessons.filter((lesson) => idOf(lesson.course) === course.id).map((lesson) => lesson.id))
  const cuts = lessons.length
    ? ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 400, where: { lesson: { in: lessons.map((lesson) => lesson.id) } } })).docs as unknown as Row[])
    : []
  const doors = await loadDoors(payload)
  const firstPick = user.startingClause
    ? recommendLesson(
        Number(user.startingClause),
        cuts.map((cut) => ({ lessonId: idOf(cut.lesson) || 0, bestClause: (cut.bestClause as number) || null, approved: cut.status === 'approved' })),
        lessonOrder,
        doors,
      )
    : null
  const recommendedCourse = firstPick ? idOf(lessons.find((lesson) => lesson.id === firstPick)?.course) : null
  const ordered = [...courses].sort((a, b) => (a.id === recommendedCourse ? -1 : b.id === recommendedCourse ? 1 : a.id - b.id))
  const today = dayNumber(user as SessionUser & { joinedAt?: string })
  return ordered.map((course, index) => {
    const own = lessons.filter((lesson) => idOf(lesson.course) === course.id)
    const speaker = String(course.speaker || own[0]?.speaker || '')
    const ownIds = new Set(own.map((lesson) => lesson.id))
    const courseDoors = new Map<number, string>()
    for (const cut of cuts) {
      if (!ownIds.has(idOf(cut.lesson) || 0) || (cut.status !== 'approved' && !cut.placeholder)) continue
      const door = doorOfClause(Number(cut.bestClause || 0), doors)
      if (door) courseDoors.set(door.number, door.title)
    }
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
      doors: [...courseDoors.entries()].sort((a, b) => a[0] - b[0]).map(([number, title]) => ({ number, title })),
    }
  })
}

export function portalName(portal: PortalDoc) {
  return portal.organisationName || portal.name
}
