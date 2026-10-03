import type { Payload } from 'payload'
import { harvestTranscript } from '@/lib/harvest'
import { idOf, portalIdOf } from '@/lib/ids'
import { parentIsOwn } from '@/lib/nesting'
import { applyDrawnTo, countsTowardProgress, harvestInWindow, pieceLevel, shortFormEffect } from '@/lib/progress'
import { visibleCourseIds, type SessionUser } from './context'

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
  if (transcript) {
    const hits = harvestInWindow(harvestTranscript(transcript), input.start, input.end)
    const already = await payload.find({
      collection: 'harvest-entries',
      overrideAccess: true,
      depth: 0,
      limit: 80,
      where: { and: [{ user: { equals: user.id } }, { lesson: { equals: input.lessonId } }] },
    })
    const seen = new Set(already.docs.map((row) => String((row as { text?: string }).text || '')))
    for (const hit of hits) {
      if (!hit.text || seen.has(hit.text)) continue
      seen.add(hit.text)
      await payload.create({
        collection: 'harvest-entries',
        overrideAccess: true,
        data: { user: user.id, lesson: input.lessonId, portal, kind: hit.kind, text: hit.text, reference: hit.reference, timestamp: hit.timestamp, context: hit.context },
      })
      harvest += 1
    }
  }
  return { ok: true, counted: false, harvest, drawnTo: speakerSlug }
}
