import type { Payload } from 'payload'
import {
  CIRCLE_BODY_MAX,
  CIRCLE_LABEL_DEFAULT,
  CIRCLE_LENGTHS,
  CIRCLE_MAX_COUNT,
  CIRCLE_NAME_MAX,
  CIRCLE_THRESHOLD_DEFAULT,
  CIRCLE_TONES,
  circleProblems,
  circleRequest,
  circleSpread,
  mockCircleAnswers,
  parseCircleReply,
  type CircleDraft,
  type CircleLength,
  type CirclePoint,
  type CircleTone,
} from '@/lib/circle'
import { idOf, portalIdOf } from '@/lib/ids'
import { getLlmClient } from '@/lib/llm'
import { parseTranscript } from '@/lib/transcript'
import type { SessionUser } from './context'
import { tierSourceText } from './tier-source'

type Doc = Record<string, unknown> & { id: number }
type Redirect = (path: string, error?: string, notice?: string) => Response

export async function circleSettings(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as { circleLabel?: string | null; circleThreshold?: number | null } | null
  const threshold = Number(flags?.circleThreshold)
  return {
    label: (flags?.circleLabel || '').trim() || CIRCLE_LABEL_DEFAULT,
    threshold: Number.isFinite(threshold) && threshold >= 1 ? Math.round(threshold) : CIRCLE_THRESHOLD_DEFAULT,
  }
}

async function find(payload: Payload, collection: string, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: collection as never, id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

/**
 * Who may look after a talk's circle answers: the master desk on any talk, and a portal admin on their own portal's
 * courses only. Answers a portal admin writes show in that portal; the master desk's show in every portal.
 */
export async function circleScope(payload: Payload, user: SessionUser, lessonId: number): Promise<{ ok: true; lesson: Doc; course: Doc; portal: number | null } | { ok: false; error: string }> {
  const lesson = await find(payload, 'lessons', lessonId)
  if (!lesson) return { ok: false, error: 'That talk was not found.' }
  const course = await find(payload, 'courses', idOf(lesson.course) || 0)
  if (!course) return { ok: false, error: 'That talk has no course.' }
  if (user.role === 'master') return { ok: true, lesson, course, portal: null }
  if (user.role !== 'portal-admin') return { ok: false, error: 'Circle answers are looked after by the portal admin.' }
  const mine = portalIdOf(user)
  if (!mine || course.origin === 'master' || idOf(course.portal) !== mine) return { ok: false, error: 'You can add circle answers to your own portal’s courses only.' }
  return { ok: true, lesson, course, portal: mine }
}

/** Points a desk user may see on a talk: master and own-portal questions, never another portal's. */
export function pointsInScope(points: Doc[], user: SessionUser) {
  if (user.role === 'master') return points
  const mine = portalIdOf(user)
  return points.filter((point) => {
    const author = point.author as { role?: string; tenants?: { tenant?: unknown }[] } | null
    if (!author || typeof author !== 'object' || author.role === 'master') return true
    return (author.tenants || []).some((row) => idOf(row.tenant) === mine)
  })
}

function speakerContext(lesson: Doc, second: number) {
  const raw = tierSourceText(lesson as never)
  if (!raw) return ''
  try {
    return parseTranscript(raw).cues.filter((cue) => cue.start >= second - 75 && cue.start <= second + 5).map((cue) => cue.text).join(' ')
  } catch {
    return ''
  }
}

/** Drafts for one question: the AI when a key is set, topped up with the built-in drafts so the count is always met. */
export async function draftCircle(point: CirclePoint, count: number, tones: CircleTone[], lengths: CircleLength[], seed: number): Promise<{ drafts: CircleDraft[]; engine: string }> {
  const spread = circleSpread(count, tones, lengths)
  const client = getLlmClient()
  let drafts: CircleDraft[] = []
  let engine = 'built-in drafts'
  if (client) {
    try {
      drafts = parseCircleReply(await client.complete(circleRequest(point, spread)), spread)
      engine = drafts.length ? client.name : 'built-in drafts (the AI reply did not pass the checks)'
    } catch {
      engine = 'built-in drafts (the AI call failed)'
    }
  }
  if (drafts.length < spread.length) {
    const rest = spread.slice(drafts.length)
    const extra = mockCircleAnswers(point, rest.length, [...new Set(rest.map((row) => row.tone))], [...new Set(rest.map((row) => row.length))], seed)
    drafts = [...drafts, ...extra]
  }
  return { drafts: drafts.slice(0, spread.length), engine }
}

/** Switched-on circle answers for these questions, for one portal (theirs plus the master desk's). */
export async function circleForPoints(payload: Payload, pointIds: number[], portalId: number) {
  const byPoint = new Map<number, { id: number; name: string; body: string }[]>()
  if (!pointIds.length) return byPoint
  const found = await payload.find({
    collection: 'circle-answers' as never,
    overrideAccess: true,
    depth: 0,
    limit: 2000,
    pagination: false,
    sort: 'createdAt',
    where: { and: [{ point: { in: pointIds } }, { enabled: { equals: true } }, { or: [{ portal: { exists: false } }, { portal: { equals: portalId } }] }] } as never,
  })
  for (const row of found.docs as unknown as Doc[]) {
    const point = idOf(row.point)
    if (!point) continue
    const list = byPoint.get(point) || []
    list.push({ id: row.id, name: String(row.name || ''), body: String(row.body || '') })
    byPoint.set(point, list)
  }
  return byPoint
}

/** How many circle answers sit on these talks: all of them for the master desk, the master's and its own for a portal. */
export async function circleAnswerCount(payload: Payload, lessonIds: number[], portalId: number | null) {
  if (!lessonIds.length) return 0
  const where = { and: [{ lesson: { in: lessonIds } }, ...(portalId ? [{ or: [{ portal: { exists: false } }, { portal: { equals: portalId } }] }] : [])] }
  return (await payload.count({ collection: 'circle-answers' as never, overrideAccess: true, where: where as never })).totalDocs
}

function chosen<T extends string>(form: FormData, key: string, allowed: readonly T[]) {
  return form.getAll(key).map(String).filter((value): value is T => (allowed as readonly string[]).includes(value))
}

const text = (form: FormData, key: string) => String(form.get(key) || '').trim()

async function answerInScope(payload: Payload, user: SessionUser, id: number) {
  const answer = await find(payload, 'circle-answers', id)
  if (!answer) return { error: 'That circle answer was not found.' as const }
  const scope = await circleScope(payload, user, idOf(answer.lesson) || 0)
  if (!scope.ok) return { error: scope.error }
  if (user.role !== 'master' && idOf(answer.portal) && idOf(answer.portal) !== scope.portal) return { error: 'That circle answer belongs to another portal.' as const }
  return { answer, scope }
}

function publicMessage(error: unknown, fallback: string) {
  const candidate = error as { isPublic?: boolean; message?: string } | null
  return candidate?.isPublic && candidate.message ? candidate.message : fallback
}

/** Form actions whose names start with "circle-". */
export async function handleCircle(action: string, form: FormData, payload: Payload, user: SessionUser, back: Redirect): Promise<Response> {
  const next = text(form, 'next') || (user.role === 'master' ? '/master/circle' : '/')

  if (action === 'circle-settings') {
    if (user.role !== 'master') return back(next, 'Only the master desk changes the circle label and threshold.')
    const label = text(form, 'label').slice(0, 60)
    const threshold = Number(text(form, 'threshold'))
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100) return back(next, 'The threshold is a whole number from 1 to 100.')
    try {
      await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { circleLabel: label || CIRCLE_LABEL_DEFAULT, circleThreshold: threshold } as never })
    } catch (error) {
      return back(next, publicMessage(error, 'Those settings were not saved.'))
    }
    return back(next, undefined, 'Circle settings saved.')
  }

  if (action === 'circle-generate') {
    const scope = await circleScope(payload, user, Number(text(form, 'lesson')))
    if (!scope.ok) return back(next, scope.error)
    const count = Number(text(form, 'count') || 6)
    if (!Number.isInteger(count) || count < 1 || count > CIRCLE_MAX_COUNT) return back(next, `Choose from 1 to ${CIRCLE_MAX_COUNT} answers.`)
    const tones = chosen(form, 'tone', CIRCLE_TONES)
    const lengths = chosen(form, 'length', CIRCLE_LENGTHS)
    const all = (await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 1, limit: 200, where: { and: [{ lesson: { equals: scope.lesson.id } }, { status: { not_equals: 'rejected' } }] } })).docs as unknown as Doc[]
    const pointId = Number(text(form, 'point'))
    const targets = pointsInScope(all, user).filter((point) => !pointId || point.id === pointId)
    if (!targets.length) return back(next, pointId ? 'That question is not on this talk.' : 'This talk has no questions yet.')
    let made = 0
    let engine = ''
    for (const point of targets) {
      const existing = await payload.count({ collection: 'circle-answers' as never, overrideAccess: true, where: { point: { equals: point.id } } as never })
      const options = Array.isArray(point.options) ? (point.options as unknown[]).map((option) => (typeof option === 'string' ? option : String((option as { label?: string })?.label || ''))).filter(Boolean) : []
      const result = await draftCircle(
        { prompt: String(point.prompt || ''), kind: String(point.kind || 'reflection'), options, context: speakerContext(scope.lesson, Number(point.second || 0)) },
        count,
        tones,
        lengths,
        existing.totalDocs + point.id,
      )
      engine = result.engine
      for (const draft of result.drafts) {
        await payload.create({
          collection: 'circle-answers' as never,
          overrideAccess: true,
          data: { point: point.id, lesson: scope.lesson.id, portal: scope.portal ?? undefined, name: draft.name, body: draft.body, tone: draft.tone, length: draft.length, origin: 'ai', enabled: true, author: user.id } as never,
        })
        made += 1
      }
    }
    return back(next, undefined, `${made} circle answer${made === 1 ? '' : 's'} added for ${targets.length} question${targets.length === 1 ? '' : 's'}, written by ${engine}. Edit or switch off any you do not want.`)
  }

  if (action === 'circle-add') {
    const point = await find(payload, 'engagement-points', Number(text(form, 'point')))
    if (!point) return back(next, 'That question was not found.')
    const scope = await circleScope(payload, user, idOf(point.lesson) || 0)
    if (!scope.ok) return back(next, scope.error)
    const name = text(form, 'name').slice(0, CIRCLE_NAME_MAX) || (user.name || '').split(' ')[0] || 'Someone in the circle'
    const body = text(form, 'body')
    const problems = circleProblems(name, body)
    if (problems.length) return back(next, problems[0])
    await payload.create({
      collection: 'circle-answers' as never,
      overrideAccess: true,
      data: { point: point.id, lesson: scope.lesson.id, portal: scope.portal ?? undefined, name, body: body.slice(0, CIRCLE_BODY_MAX), origin: 'staff', enabled: true, author: user.id } as never,
    })
    return back(next, undefined, 'Your answer is in the circle.')
  }

  if (action === 'circle-edit' || action === 'circle-toggle' || action === 'circle-delete') {
    const found = await answerInScope(payload, user, Number(text(form, 'id')))
    if ('error' in found) return back(next, found.error)
    const { answer } = found
    if (action === 'circle-delete') {
      await payload.delete({ collection: 'circle-answers' as never, id: answer.id, overrideAccess: true })
      return back(next, undefined, 'Circle answer deleted.')
    }
    if (action === 'circle-toggle') {
      const enabled = text(form, 'enabled') === 'on'
      await payload.update({ collection: 'circle-answers' as never, id: answer.id, overrideAccess: true, data: { enabled } as never })
      return back(next, undefined, enabled ? 'Circle answer switched on.' : 'Circle answer switched off. It stays here for you.')
    }
    const name = text(form, 'name').slice(0, CIRCLE_NAME_MAX) || String(answer.name || '')
    const body = text(form, 'body')
    const problems = circleProblems(name, body)
    if (problems.length) return back(next, problems[0])
    await payload.update({ collection: 'circle-answers' as never, id: answer.id, overrideAccess: true, data: { name, body } as never })
    return back(next, undefined, 'Circle answer saved.')
  }

  if (action === 'circle-bulk') {
    const enabled = text(form, 'enabled') === 'on'
    const scope = await circleScope(payload, user, Number(text(form, 'lesson')))
    if (!scope.ok) return back(next, scope.error)
    const lessonIds =
      text(form, 'scope') === 'course'
        ? ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 500, where: { course: { equals: scope.course.id } } })).docs as unknown as Doc[]).map((row) => row.id)
        : [scope.lesson.id]
    const where = { and: [{ lesson: { in: lessonIds } }, ...(scope.portal ? [{ or: [{ portal: { equals: scope.portal } }, { portal: { exists: false } }] }] : [])] }
    const result = await payload.update({ collection: 'circle-answers' as never, overrideAccess: true, where: where as never, data: { enabled } as never })
    const changed = (result as { docs?: unknown[] }).docs?.length || 0
    const where2 = text(form, 'scope') === 'course' ? 'this course' : 'this talk'
    return back(next, undefined, `${changed} circle answer${changed === 1 ? '' : 's'} on ${where2} switched ${enabled ? 'on' : 'off'}.`)
  }

  return back(next, 'That action is not known.')
}
