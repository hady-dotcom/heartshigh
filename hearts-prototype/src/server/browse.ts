import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { idOf, portalIdOf } from '@/lib/ids'
import { parentIsOwn } from '@/lib/nesting'
import { applyDrawnTo, countsTowardProgress, pieceLevel, shortFormEffect } from '@/lib/progress'
import { visibleCourseIds, type SessionUser } from './context'
import { placeOfLesson } from './harvest'
import { giveHarvest } from './scripture'

export type BrowseInput = {
  level: string
  event: string
  lessonId: number
  speaker: string
  speakerSlug: string
  start: number
  end: number
  parent: string
}

type Ok = { ok: true; counted: false; harvest: number; drawnTo: string }
type Fail = { ok: false; status: number; error: string }

/**
 * A hors d'oeuvre or appetiser fills the harvest and the drawn-to signal.
 * It never writes a completion, a lesson visit, or anything the grow page counts.
 */
export async function recordShortBrowse(payload: Payload, user: SessionUser, input: BrowseInput): Promise<Ok | Fail> {
  const level = pieceLevel(input.level)
  if (level === 'talk' || countsTowardProgress({ level, inCourse: true, event: 'watch' })) {
    return { ok: false, status: 400, error: 'A full talk is marked from the course, not from browsing.' }
  }
  const effect = shortFormEffect(level)
  if (!effect.harvest || !effect.drawnTo) return { ok: false, status: 400, error: 'That is not a short clip.' }
  const event = input.event === 'linger' ? 'linger' : 'learn-more'
  if (event === 'learn-more' && !parentIsOwn(level, input.parent)) {
    return { ok: false, status: 400, error: "Learn more stays with this clip's own parent." }
  }
  const lesson = input.lessonId
    ? await payload.findByID({ collection: 'lessons', id: input.lessonId, depth: 0, overrideAccess: true }).catch(() => null)
    : null
  const courseId = lesson ? idOf((lesson as { course?: unknown }).course) : null
  if (!lesson || !courseId || !(await visibleCourseIds(payload, user)).includes(courseId)) {
    return { ok: false, status: 403, error: 'That film is not in your portal.' }
  }
  const speakerSlug = input.speakerSlug.trim()
  const speaker = input.speaker.trim() || speakerSlug
  if (!speakerSlug) return { ok: false, status: 400, error: 'Name the speaker.' }
  const portal = portalIdOf(user) || undefined
  const existing = await payload.find({
    collection: 'drawn-to',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ user: { equals: user.id } }, { speakerSlug: { equals: speakerSlug } }] },
  })
  const held = existing.docs[0] as { id: number; linger?: number | null; learnMore?: number | null } | undefined
  const next = applyDrawnTo(held ? [{ speakerSlug, linger: Number(held.linger || 0), learnMore: Number(held.learnMore || 0) }] : [], speakerSlug, event)
  const signal = next.find((row) => row.speakerSlug === speakerSlug) || { speakerSlug, linger: 0, learnMore: 0 }
  if (held) {
    await payload.update({ collection: 'drawn-to', id: held.id, overrideAccess: true, data: { linger: signal.linger, learnMore: signal.learnMore, speaker } })
  } else {
    await payload.create({
      collection: 'drawn-to',
      overrideAccess: true,
      data: { user: user.id, speaker, speakerSlug, linger: signal.linger, learnMore: signal.learnMore, portal },
    })
  }
  let harvest = 0
  const transcript = String((lesson as { transcript?: string }).transcript || '')
  if (transcript && event === 'linger') {
    const place = await placeOfLesson(payload, input.lessonId)
    harvest = await giveHarvest(payload, user.id, input.lessonId, transcript, portal, { speaker: place?.speaker || speaker, door: place?.door || undefined, surface: level, gatheredAt: now().toISOString() }, { start: input.start, end: input.end })
  }
  const clipSeconds = Math.max(0, Math.round(Number(input.end) - Number(input.start)))
  if (event === 'linger' && clipSeconds > 0) {
    const { recordPersonalWatch } = await import('./missions')
    await recordPersonalWatch(payload, { userId: user.id, lessonId: input.lessonId, seconds: clipSeconds, portalId: portal })
  }
  try {
    const { recordLearnerEvent } = await import('./experiments')
    if (event === 'linger' && level === 'hors') {
      await recordLearnerEvent(payload, { user, event: 'clip_watch_completion', props: { lesson: input.lessonId, start: input.start, end: input.end }, portalId: portal })
    }
    if (event === 'linger' && level === 'appetiser') {
      await recordLearnerEvent(payload, { user, event: 'appetiser_complete', props: { lesson: input.lessonId }, portalId: portal })
    }
    if (event === 'learn-more') {
      await recordLearnerEvent(payload, { user, event: 'clip_cta_tap', props: { lesson: input.lessonId, level }, portalId: portal })
    }
  } catch {
    // ignore
  }
  return { ok: true, counted: false, harvest, drawnTo: speakerSlug }
}
