import { idOf } from '@/lib/ids'
import { portalDisplayName } from '@/lib/portal-name'
import { cleanTitle } from '@/lib/clean-title'
import { sharedAnswerText, sharedAnswersNewestFirst } from '@/lib/shared-answers'

export type QueueStatus = 'unanswered' | 'all' | 'answered'

export type QueueCard = {
  id: number
  entryId: number | null
  learnerId: number
  learner: string
  portalId: number
  portal: string
  portalSlug: string
  talk: string
  minute: string
  second: number
  lessonId: number
  courseId: number
  question: string
  answer: string
  reply: string
  done: boolean
  at: string
}

export type QueueSource = {
  id: number
  createdAt?: string | null
  body?: unknown
  choice?: unknown
  video?: unknown
  audio?: unknown
  image?: unknown
  keepPrivate?: unknown
  shareWithTeacher?: unknown
  atSecond?: number | null
  user?: unknown
  lesson?: unknown
  point?: unknown
  portal?: unknown
}

export type QueueEntry = {
  id: number
  answer?: unknown
  teacherReply?: unknown
  doneAt?: unknown
  consent?: unknown
  portal?: unknown
}

export type QueuePortal = { id: number; name?: string | null; slug?: string | null; organisationName?: string | null }

const MINUTE = 60 * 1000

export function queueStatus(value: string | undefined): QueueStatus {
  if (value === 'all' || value === 'answered') return value
  return 'unanswered'
}

/** "now" when the reply landed in the last two minutes. */
export function shownWhen(iso: string | null | undefined, at: Date) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  if (Math.abs(at.getTime() - then) <= 2 * MINUTE) return 'now'
  return ''
}

export function minuteOf(total: number) {
  const value = Math.max(0, Math.floor(total || 0))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function isAnswered(card: Pick<QueueCard, 'reply' | 'done'>) {
  return Boolean(card.reply.trim()) || card.done
}

export function filterQueue(cards: QueueCard[], opts: { status: QueueStatus; portalSlug: string | null; learnerId: number | null }) {
  return cards.filter((card) => {
    if (opts.portalSlug && card.portalSlug !== opts.portalSlug) return false
    if (opts.learnerId && card.learnerId !== opts.learnerId) return false
    if (opts.status === 'unanswered' && isAnswered(card)) return false
    if (opts.status === 'answered' && !isAnswered(card)) return false
    return true
  }).sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
}

export function leftCount(cards: QueueCard[], opts: { portalSlug: string | null; learnerId: number | null }) {
  return filterQueue(cards, { ...opts, status: 'unanswered' }).length
}

/** The next card that still needs a reply, after this one, then from the top. */
export function nextUnanswered(cards: QueueCard[], currentId: number, opts: { portalSlug: string | null; learnerId: number | null }) {
  const open = filterQueue(cards, { ...opts, status: 'unanswered' })
  const index = open.findIndex((card) => card.id === currentId)
  if (index >= 0) return open[index + 1] || open[index - 1] || null
  return open[0] || null
}

export function stepCard(cards: QueueCard[], currentId: number, dir: 1 | -1) {
  if (!cards.length) return null
  const index = cards.findIndex((card) => card.id === currentId)
  if (index < 0) return dir > 0 ? cards[0] : cards[cards.length - 1]
  return cards[index + dir] || null
}

export function earlierCards(cards: QueueCard[], current: QueueCard) {
  return cards
    .filter((card) => card.learnerId === current.learnerId && card.id !== current.id && card.at < current.at)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
}

export function queuePath(base: string, opts: { status?: QueueStatus; portal?: string | null; learnerId?: number | null; answerId?: number | null }) {
  const params = new URLSearchParams()
  if (opts.status && opts.status !== 'unanswered') params.set('queue', opts.status)
  if (opts.portal) params.set('queuePortal', opts.portal)
  if (opts.learnerId) params.set('learner', String(opts.learnerId))
  if (opts.answerId) params.set('answer', String(opts.answerId))
  const query = params.toString()
  return query ? `${base}?${query}` : base
}

function named(value: unknown, key: 'name' | 'title' | 'slug') {
  if (!value || typeof value !== 'object') return ''
  const text = (value as Record<string, unknown>)[key]
  return typeof text === 'string' ? text : ''
}

export function buildQueueCards(answers: QueueSource[], entries: QueueEntry[], portals: QueuePortal[]): QueueCard[] {
  const consented = new Set(entries.flatMap((entry) => {
    if (entry.consent === false) return []
    const id = idOf(entry.answer)
    return id == null ? [] : [id]
  }))
  const byAnswer = new Map<number, QueueEntry>()
  for (const entry of entries) {
    const answerId = idOf(entry.answer)
    if (answerId == null || entry.consent === false) continue
    byAnswer.set(answerId, entry)
  }
  const portalOf = new Map(portals.map((portal) => [portal.id, portal]))
  return sharedAnswersNewestFirst(answers, consented).flatMap((answer) => {
    const entry = byAnswer.get(answer.id)
    if (entry && entry.consent === false) return []
    const userId = idOf(answer.user)
    if (!userId) return []
    const portalId = idOf(answer.portal) || idOf(entry?.portal) || 0
    const portal = portalOf.get(portalId)
    const lesson = answer.lesson
    const point = answer.point && typeof answer.point === 'object' ? answer.point as { prompt?: string; second?: number } : null
    const second = Number(answer.atSecond ?? point?.second ?? 0)
    const lessonId = idOf(lesson) || 0
    const courseId = lesson && typeof lesson === 'object' ? idOf((lesson as { course?: unknown }).course) || 0 : 0
    const talk = cleanTitle(named(lesson, 'title')) || 'This talk'
    return [{
      id: answer.id,
      entryId: entry ? entry.id : null,
      learnerId: userId,
      learner: named(answer.user, 'name') || 'A learner',
      portalId,
      portal: portal ? portalDisplayName(portal) : 'This portal',
      portalSlug: portal?.slug || '',
      talk,
      minute: minuteOf(second),
      second,
      lessonId,
      courseId,
      question: point?.prompt || '',
      answer: sharedAnswerText(answer),
      reply: String(entry?.teacherReply || '').trim(),
      done: Boolean(entry?.doneAt),
      at: String(answer.createdAt || ''),
    }]
  })
}
