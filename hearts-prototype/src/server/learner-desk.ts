import type { Payload, Where } from 'payload'
import { idOf } from '@/lib/ids'
import { JOURNAL_LABEL } from '@/lib/journal-copy'
import { flattenSlots, planAcrossDays, studyDates } from '@/lib/schedule'
import { lessonsByCourseOrder } from '@/lib/slot-course'
import { sortParts } from '@/lib/part-order'
import { partTitle } from '@/lib/talk-title'
import { now } from '@/lib/clock'
import {
  actorScope,
  anonymiseProps,
  canReadLearner,
  diaryDeleteRefusal,
  diaryShowsWords,
  learnerActionRefusal,
  nameMatches,
  planActionRefusal,
  planAfterLearnerGone,
  temporaryPassword,
  tooManyBulk,
  type ActorScope,
  type LearnerAction,
  type LearnerScope,
} from '@/lib/learner-desk'
import type { SessionUser } from './context'
import { audit } from './viewas'

type Doc = Record<string, unknown> & { id: number }

export type DeskActor = {
  id: number
  role: SessionUser['role'] | string
  name?: string | null
  tenants?: { tenant?: unknown }[]
}

type Result = { error?: string; notice?: string; temporaryPassword?: string }

const BY_USER = [
  'workbook-entries',
  'opening-answers',
  'placing-answers',
  'harvest-entries',
  'completions',
  'watch-sessions',
  'lesson-visits',
  'notifications',
  'heart-states',
  'drawn-to',
  'rsvps',
  'checkins',
  'live-reminders',
  'live-presence',
  'gather-rsvps',
  'gather-checkins',
  'gather-reflections',
  'seat-visits',
  'rituals',
  'compass-attempts',
  'compass-serves',
  'announcement-dismissals',
  'circle-mutes',
] as const

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function ids(form: FormData, key: string) {
  return [...new Set(form.getAll(key).map((value) => Number(value)).filter((id) => Number.isFinite(id) && id > 0))]
}

function scopeOf(doc: Doc | null): LearnerScope {
  return { role: String(doc?.role || ''), portalId: idOf((doc?.tenants as { tenant?: unknown }[] | undefined)?.[0]?.tenant) }
}

async function loadUser(payload: Payload, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

async function note(
  payload: Payload,
  event: string,
  actor: DeskActor,
  fields: { target?: number; portal?: number | null; detail?: Record<string, unknown> },
) {
  await audit(payload, event, {
    actor: actor.id,
    actorRole: actor.role,
    target: fields.target,
    portal: fields.portal || undefined,
    detail: fields.detail,
  })
}

async function refuse(
  payload: Payload,
  actor: DeskActor,
  learner: Doc | null,
  action: string,
  reason: string,
): Promise<Result> {
  await note(payload, 'learner.refused', actor, {
    target: learner?.id,
    portal: scopeOf(learner).portalId,
    detail: { action, reason },
  })
  return { error: reason }
}

function guard(actor: ActorScope, learner: Doc, action: LearnerAction) {
  return learnerActionRefusal(actor, scopeOf(learner), action)
}

async function deleteWhere(payload: Payload, collection: string, where: Where) {
  const found = await payload.find({ collection: collection as 'users', overrideAccess: true, depth: 0, limit: 500, where })
  for (const doc of found.docs) {
    await payload.delete({ collection: collection as 'users', id: doc.id, overrideAccess: true })
  }
  if (found.hasNextPage) await deleteWhere(payload, collection, where)
}

async function wipePersonal(payload: Payload, userId: number) {
  for (const collection of BY_USER) {
    await deleteWhere(payload, collection, { user: { equals: userId } })
  }
  await deleteWhere(payload, 'messages', { author: { equals: userId } })
  await deleteWhere(payload, 'reports', { reporter: { equals: userId } })
  await deleteWhere(payload, 'live-questions', { author: { equals: userId } })
  await deleteWhere(payload, 'gather-photos', { postedBy: { equals: userId } })
  const answers = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { user: { equals: userId } },
  })
  const answerIds = answers.docs.map((doc) => doc.id)
  if (answerIds.length) await deleteWhere(payload, 'feedback-notes', { answer: { in: answerIds } })
  await deleteWhere(payload, 'feedback-notes', { author: { equals: userId } })
  await deleteWhere(payload, 'answers', { user: { equals: userId } })
  await releasePlans(payload, userId)
}

async function releasePlans(payload: Payload, userId: number) {
  const [owned, listed] = await Promise.all([
    payload.find({ collection: 'schedules', overrideAccess: true, depth: 0, limit: 200, where: { owner: { equals: userId } } }),
    payload.find({ collection: 'schedules', overrideAccess: true, depth: 0, limit: 200, where: { learners: { contains: userId } } }),
  ])
  const plans = new Map<number, Doc>()
  for (const doc of [...owned.docs, ...listed.docs]) plans.set(doc.id, doc as unknown as Doc)
  for (const plan of plans.values()) {
    const learnerIds = ((plan.learners as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const next = planAfterLearnerGone({ ownerId: idOf(plan.owner), learnerIds }, userId)
    if (next === 'delete') {
      await payload.delete({ collection: 'schedules', id: plan.id, overrideAccess: true })
      continue
    }
    await payload.update({
      collection: 'schedules',
      id: plan.id,
      overrideAccess: true,
      data: { learners: next.learnerIds, owner: next.ownerId } as never,
    })
  }
}

async function anonymiseAnalytics(payload: Payload, learner: Doc) {
  const email = typeof learner.email === 'string' ? learner.email : null
  const name = typeof learner.name === 'string' ? learner.name : null
  const hints = { id: learner.id, email, name }
  const personWhere: Where = {
    or: [
      { learner: { equals: learner.id } },
      { subject: { equals: String(learner.id) } },
      { subject: { equals: `learner:${learner.id}` } },
      ...(email ? [{ subject: { equals: email } }] : []),
    ],
  }
  const events = await payload.find({ collection: 'experiment-events', overrideAccess: true, depth: 0, limit: 200, where: personWhere })
  for (const doc of events.docs as unknown as Doc[]) {
    await payload.update({
      collection: 'experiment-events',
      id: doc.id,
      overrideAccess: true,
      data: { learner: null, deviceId: null, subject: 'removed', props: anonymiseProps(doc.props, hints) } as never,
    })
  }
  const assignments = await payload.find({ collection: 'experiment-assignments', overrideAccess: true, depth: 0, limit: 200, where: personWhere })
  for (const doc of assignments.docs as unknown as Doc[]) {
    await payload.update({
      collection: 'experiment-assignments',
      id: doc.id,
      overrideAccess: true,
      data: { learner: null, deviceId: null, subject: 'removed' } as never,
    })
  }
  const or: Where[] = [{ subject: { equals: String(learner.id) } }, { subject: { equals: `learner:${learner.id}` } }]
  if (email) or.push({ subject: { equals: email } })
  const insights = await payload.find({ collection: 'insight-events', overrideAccess: true, depth: 0, limit: 200, where: { or } })
  for (const doc of insights.docs as unknown as Doc[]) {
    await payload.update({
      collection: 'insight-events',
      id: doc.id,
      overrideAccess: true,
      data: { subject: 'removed', props: anonymiseProps(doc.props, hints) } as never,
    })
  }
  const sessions = await payload.find({ collection: 'insight-sessions', overrideAccess: true, depth: 0, limit: 200, where: { or } })
  for (const doc of sessions.docs) {
    await payload.update({ collection: 'insight-sessions', id: doc.id, overrideAccess: true, data: { subject: 'removed' } as never })
  }
}

export async function resetLearnerPassword(payload: Payload, actor: DeskActor, learnerId: number): Promise<Result> {
  const learner = await loadUser(payload, learnerId)
  if (!learner) return refuse(payload, actor, null, 'reset', 'That learner could not be found.')
  const reason = guard(actorScope(actor), learner, 'reset')
  if (reason) return refuse(payload, actor, learner, 'reset', reason)
  const password = temporaryPassword()
  await payload.update({
    collection: 'users',
    id: learner.id,
    overrideAccess: true,
    data: { password, mustChangePassword: true } as never,
  })
  await note(payload, 'learner.reset_password', actor, {
    target: learner.id,
    portal: scopeOf(learner).portalId,
    detail: { learnerId: learner.id, name: learner.name },
  })
  return {
    temporaryPassword: password,
    notice: `New password for ${learner.name}: ${password}. They must choose their own the next time they sign in. This is the only time it is shown.`,
  }
}

export async function moveLearner(payload: Payload, actor: DeskActor, learnerId: number, portalId: number): Promise<Result> {
  const learner = await loadUser(payload, learnerId)
  if (!learner) return refuse(payload, actor, null, 'move', 'That learner could not be found.')
  const reason = guard(actorScope(actor), learner, 'move')
  if (reason) return refuse(payload, actor, learner, 'move', reason)
  const portal = (await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
  if (!portal) return { error: 'That portal could not be found.' }
  if (scopeOf(learner).portalId === portal.id) return { notice: `${learner.name} is already in ${portal.name}.` }
  await payload.update({
    collection: 'users',
    id: learner.id,
    overrideAccess: true,
    data: { tenants: [{ tenant: portal.id }], removed: false } as never,
  })
  await note(payload, 'learner.move', actor, {
    target: learner.id,
    portal: portal.id,
    detail: { learnerId: learner.id, name: learner.name, from: scopeOf(learner).portalId, to: portal.id },
  })
  return { notice: `${learner.name} is now in ${portal.name}.` }
}

export async function setLearnerPaused(payload: Payload, actor: DeskActor, learnerId: number, paused: boolean): Promise<Result> {
  const learner = await loadUser(payload, learnerId)
  if (!learner) return refuse(payload, actor, null, paused ? 'pause' : 'unpause', 'That learner could not be found.')
  const reason = guard(actorScope(actor), learner, paused ? 'pause' : 'unpause')
  if (reason) return refuse(payload, actor, learner, paused ? 'pause' : 'unpause', reason)
  await payload.update({ collection: 'users', id: learner.id, overrideAccess: true, data: { paused } as never })
  await note(payload, paused ? 'learner.pause' : 'learner.unpause', actor, {
    target: learner.id,
    portal: scopeOf(learner).portalId,
    detail: { learnerId: learner.id, name: learner.name },
  })
  return { notice: paused ? `${learner.name} is paused. They cannot sign in until you let them.` : `${learner.name} can sign in again.` }
}

export async function removeLearnerFromPortal(payload: Payload, actor: DeskActor, learnerId: number): Promise<Result> {
  const learner = await loadUser(payload, learnerId)
  if (!learner) return refuse(payload, actor, null, 'remove', 'That learner could not be found.')
  const reason = guard(actorScope(actor), learner, 'remove')
  if (reason) return refuse(payload, actor, learner, 'remove', reason)
  const portal = scopeOf(learner).portalId
  await payload.update({
    collection: 'users',
    id: learner.id,
    overrideAccess: true,
    data: { tenants: [], removed: true } as never,
  })
  await note(payload, 'learner.remove', actor, {
    target: learner.id,
    portal,
    detail: { learnerId: learner.id, name: learner.name, portal },
  })
  return { notice: `${learner.name} is out of the portal. Their account is still here until you delete it.` }
}

export async function deleteLearnerAccount(payload: Payload, actor: DeskActor, learnerId: number, typedName: string): Promise<Result> {
  const learner = await loadUser(payload, learnerId)
  if (!learner) return refuse(payload, actor, null, 'delete', 'That learner could not be found.')
  const reason = guard(actorScope(actor), learner, 'delete')
  if (reason) return refuse(payload, actor, learner, 'delete', reason)
  if (!nameMatches(typedName, String(learner.name || ''))) {
    return refuse(payload, actor, learner, 'delete', `Type ${learner.name} to delete the account. Nothing was deleted.`)
  }
  const portal = scopeOf(learner).portalId
  const name = String(learner.name || 'This learner')
  await wipePersonal(payload, learner.id)
  await anonymiseAnalytics(payload, learner)
  await note(payload, 'learner.delete', actor, {
    portal,
    detail: { learnerId: learner.id, name, email: learner.email },
  })
  await payload.delete({ collection: 'users', id: learner.id, overrideAccess: true })
  return { notice: `${name} is deleted. Their ${JOURNAL_LABEL.one.toLowerCase()}, study plans and answers are gone. Charts keep the numbers, without their name.` }
}

async function eachAllowed(payload: Payload, actor: DeskActor, learnerIds: number[], action: LearnerAction) {
  const scope = actorScope(actor)
  const people: Doc[] = []
  for (const id of learnerIds) {
    const learner = await loadUser(payload, id)
    if (!learner) return { error: 'One of those learners could not be found. Nothing was changed.' as const }
    const reason = guard(scope, learner, action)
    if (reason) {
      await refuse(payload, actor, learner, action, reason)
      return { error: `${reason} Nothing was changed.` as const }
    }
    people.push(learner)
  }
  return { people }
}

export async function bulkLearnerAction(
  payload: Payload,
  actor: DeskActor,
  learnerIds: number[],
  op: string,
  confirm: string,
): Promise<Result> {
  const crowded = tooManyBulk(learnerIds.length)
  if (crowded) return { error: crowded }
  if (op === 'delete' && confirm !== 'delete') return { error: 'Type delete to delete these accounts. Nothing was deleted.' }
  if (op === 'remove' && confirm !== 'remove') return { error: 'Type remove to take them out of the portal. Nothing was changed.' }
  if (op !== 'reset' && op !== 'remove' && op !== 'delete') return { error: 'That action is not known.' }
  const action: LearnerAction = op === 'reset' ? 'reset' : op === 'remove' ? 'remove' : 'delete'
  const checked = await eachAllowed(payload, actor, learnerIds, action)
  if ('error' in checked && checked.error) return { error: checked.error }
  const people = checked.people || []
  if (op === 'reset') {
    const lines: string[] = []
    for (const learner of people) {
      const result = await resetLearnerPassword(payload, actor, learner.id)
      if (result.error) return result
      lines.push(`${learner.name}: ${result.temporaryPassword}`)
    }
    return { notice: `New passwords, shown once. ${lines.join('. ')}. They must choose their own the next time they sign in.` }
  }
  if (op === 'remove') {
    for (const learner of people) {
      const result = await removeLearnerFromPortal(payload, actor, learner.id)
      if (result.error) return result
    }
    return { notice: `${people.length} ${people.length === 1 ? 'person is' : 'people are'} out of the portal.` }
  }
  for (const learner of people) {
    const result = await deleteLearnerAccount(payload, actor, learner.id, String(learner.name || ''))
    if (result.error) return result
  }
  return { notice: `${people.length} ${people.length === 1 ? 'account is' : 'accounts are'} deleted, with their ${JOURNAL_LABEL.one.toLowerCase()}, plans and answers.` }
}

async function loadPlan(payload: Payload, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: 'schedules', id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

export async function deletePlan(payload: Payload, actor: DeskActor, planId: number): Promise<Result> {
  const plan = await loadPlan(payload, planId)
  if (!plan) return { error: 'That study plan could not be found.' }
  const portal = idOf(plan.portal)
  const reason = planActionRefusal(actorScope(actor), portal, 'delete')
  if (reason) {
    await note(payload, 'plan.refused', actor, { portal, detail: { action: 'delete', planId, reason } })
    return { error: reason }
  }
  await payload.delete({ collection: 'schedules', id: plan.id, overrideAccess: true })
  await note(payload, 'plan.delete', actor, { portal, detail: { planId: plan.id, name: plan.name } })
  return { notice: `${plan.name || 'The study plan'} is deleted.` }
}

export async function bulkDeletePlans(payload: Payload, actor: DeskActor, planIds: number[], confirm: string): Promise<Result> {
  if (!planIds.length) return { error: 'Tick at least one study plan.' }
  if (planIds.length > 25) return { error: 'Tick up to 25 study plans at a time.' }
  if (confirm !== 'delete') return { error: 'Type delete to delete these study plans. Nothing was deleted.' }
  const scope = actorScope(actor)
  const plans: Doc[] = []
  for (const id of planIds) {
    const plan = await loadPlan(payload, id)
    if (!plan) return { error: 'One of those study plans could not be found. Nothing was deleted.' }
    const reason = planActionRefusal(scope, idOf(plan.portal), 'delete')
    if (reason) {
      await note(payload, 'plan.refused', actor, { portal: idOf(plan.portal), detail: { action: 'delete', planId: id, reason } })
      return { error: `${reason} Nothing was deleted.` }
    }
    plans.push(plan)
  }
  for (const plan of plans) {
    await payload.delete({ collection: 'schedules', id: plan.id, overrideAccess: true })
    await note(payload, 'plan.delete', actor, { portal: idOf(plan.portal), detail: { planId: plan.id, name: plan.name } })
  }
  return { notice: `${plans.length} ${plans.length === 1 ? 'study plan is' : 'study plans are'} deleted.` }
}

async function orderedLessons(payload: Payload, courseIds: number[]) {
  if (!courseIds.length) return []
  const units = await payload.find({ collection: 'units', overrideAccess: true, depth: 0, limit: 400, where: { course: { in: courseIds } }, sort: 'order' })
  const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 800, where: { course: { in: courseIds } }, sort: 'order' })
  const unitOrder = new Map(units.docs.map((doc, index) => [doc.id, index]))
  const ordered = sortParts(lessons.docs as { id: number; title?: string; course?: unknown; order?: number | null; unit?: unknown }[], (row) => unitOrder.get(idOf(row.unit) || 0) ?? 0)
  return lessonsByCourseOrder(ordered, courseIds)
}

export async function editPlan(payload: Payload, actor: DeskActor, form: FormData): Promise<Result> {
  const plan = await loadPlan(payload, Number(text(form, 'plan')))
  if (!plan) return { error: 'That study plan could not be found.' }
  const portal = idOf(plan.portal)
  const reason = planActionRefusal(actorScope(actor), portal, 'edit')
  if (reason) {
    await note(payload, 'plan.refused', actor, { portal, detail: { action: 'edit', planId: plan.id, reason } })
    return { error: reason }
  }
  const name = text(form, 'name').slice(0, 80)
  if (!name) return { error: 'Give the plan a name.' }
  const weekdays = form.getAll('weekday').map((value) => Number(value)).filter((day) => day >= 0 && day <= 6)
  let dates: string[]
  try {
    dates = studyDates(text(form, 'start'), text(form, 'end'), weekdays)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Those dates did not work.' }
  }
  const courseId = idOf(plan.course)
  const packId = idOf(plan.pack)
  let courseIds: number[] = []
  if (courseId) courseIds = [courseId]
  else if (packId) {
    const pack = (await payload.findByID({ collection: 'packs', id: packId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
    courseIds = ((pack?.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
  }
  const lessons = await orderedLessons(payload, courseIds)
  const course = courseId ? ((await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null) : null
  const data: Record<string, unknown> = {
    name,
    startDate: text(form, 'start'),
    endDate: text(form, 'end'),
    weekdays,
    portal,
  }
  if (lessons.length) {
    const planned = planAcrossDays(
      lessons.map((lesson) => ({ id: lesson.id, title: partTitle(lesson, String(course?.title || '')), courseId: idOf(lesson.course) })),
      dates,
    )
    data.slots = flattenSlots(planned.slots)
  }
  await payload.update({ collection: 'schedules', id: plan.id, overrideAccess: true, data: data as never })
  await note(payload, 'plan.edit', actor, { portal, detail: { planId: plan.id, name } })
  return { notice: lessons.length ? `${name} is saved, and the talks are shared out again.` : `${name} is saved. The talks stayed on the days they already had.` }
}

export async function deleteDiary(payload: Payload, actor: DeskActor, entryId: number): Promise<Result> {
  const entry = entryId
    ? ((await payload.findByID({ collection: 'workbook-entries', id: entryId, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null)
    : null
  if (!entry) return { error: `That ${JOURNAL_LABEL.one.toLowerCase()} entry could not be found.` }
  const portal = idOf(entry.portal)
  const reason = diaryDeleteRefusal(actorScope(actor), portal)
  if (reason) {
    await note(payload, 'diary.refused', actor, { target: idOf(entry.user) || undefined, portal, detail: { action: 'delete', entryId, reason } })
    return { error: reason }
  }
  await payload.delete({ collection: 'workbook-entries', id: entry.id, overrideAccess: true })
  await note(payload, 'diary.delete', actor, {
    target: idOf(entry.user) || undefined,
    portal,
    detail: { entryId: entry.id, learnerId: idOf(entry.user) },
  })
  const word = JOURNAL_LABEL.one.toLowerCase()
  return { notice: `The ${word} entry is deleted. This can't be undone.` }
}

export async function bulkDeleteDiaries(payload: Payload, actor: DeskActor, entryIds: number[], sure: boolean): Promise<Result> {
  if (!sure) return { error: 'Tick Yes, delete it. Nothing was deleted.' }
  if (!entryIds.length) return { error: 'Tick at least one.' }
  if (entryIds.length > 25) return { error: 'Tick up to 25 at a time.' }
  const scope = actorScope(actor)
  const entries: Doc[] = []
  for (const id of entryIds) {
    const entry = id
      ? ((await payload.findByID({ collection: 'workbook-entries', id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null)
      : null
    if (!entry) return { error: `One of those ${JOURNAL_LABEL.one.toLowerCase()} entries could not be found. Nothing was deleted.` }
    const reason = diaryDeleteRefusal(scope, idOf(entry.portal))
    if (reason) return { error: `${reason} Nothing was deleted.` }
    entries.push(entry)
  }
  for (const entry of entries) {
    await payload.delete({ collection: 'workbook-entries', id: entry.id, overrideAccess: true })
    await note(payload, 'diary.delete', actor, {
      target: idOf(entry.user) || undefined,
      portal: idOf(entry.portal),
      detail: { entryId: entry.id, learnerId: idOf(entry.user), bulk: true },
    })
  }
  const count = entries.length
  const word = JOURNAL_LABEL.one.toLowerCase()
  return { notice: `${count} ${count === 1 ? `${word} entry is` : `${word} entries are`} deleted. This can't be undone.` }
}

export function diaryWords(entry: { consent?: boolean | null; body?: unknown }, answer?: { keepPrivate?: boolean | null } | null) {
  if (!diaryShowsWords(entry, answer)) return null
  const body = typeof entry.body === 'string' ? entry.body.trim() : ''
  return body || 'A photo or recording'
}

export async function changeOwnPassword(payload: Payload, user: DeskActor & { mustChangePassword?: boolean | null }, password: string, again: string): Promise<Result> {
  if (!user.mustChangePassword) return { error: 'Your password does not need changing.' }
  if (password.length < 8) return { error: 'Use at least 8 characters.' }
  if (password !== again) return { error: 'Type the same new password in both boxes.' }
  await payload.update({
    collection: 'users',
    id: user.id,
    overrideAccess: true,
    data: { password, mustChangePassword: false } as never,
  })
  await note(payload, 'learner.password_changed', user, { target: user.id, detail: { self: true } })
  return { notice: 'Your new password is saved.' }
}

export function learnerReadable(actor: DeskActor, learner: Doc) {
  return canReadLearner(actorScope(actor), scopeOf(learner))
}

/** Form actions for the learner, plan and diary desks. */
export async function dispatchLearnerDesk(payload: Payload, actor: DeskActor, form: FormData): Promise<Result> {
  const action = text(form, 'action')
  if (action === 'learner-reset') return resetLearnerPassword(payload, actor, Number(text(form, 'learner')))
  if (action === 'learner-move') return moveLearner(payload, actor, Number(text(form, 'learner')), Number(text(form, 'portal')))
  if (action === 'learner-pause') return setLearnerPaused(payload, actor, Number(text(form, 'learner')), true)
  if (action === 'learner-unpause') return setLearnerPaused(payload, actor, Number(text(form, 'learner')), false)
  if (action === 'learner-remove') return removeLearnerFromPortal(payload, actor, Number(text(form, 'learner')))
  if (action === 'learner-delete') return deleteLearnerAccount(payload, actor, Number(text(form, 'learner')), text(form, 'confirm'))
  if (action === 'learner-bulk') return bulkLearnerAction(payload, actor, ids(form, 'learner'), text(form, 'op'), text(form, 'confirm'))
  if (action === 'plan-edit') return editPlan(payload, actor, form)
  if (action === 'plan-delete') {
    if (text(form, 'sure') !== 'yes') return { error: 'Tick Yes, delete it. Nothing was deleted.' }
    return deletePlan(payload, actor, Number(text(form, 'plan')))
  }
  if (action === 'plan-bulk-delete') return bulkDeletePlans(payload, actor, ids(form, 'plan'), text(form, 'confirm'))
  if (action === 'diary-delete') {
    if (text(form, 'sure') !== 'yes') return { error: 'Tick Yes, delete it. Nothing was deleted.' }
    return deleteDiary(payload, actor, Number(text(form, 'entry')))
  }
  if (action === 'diary-bulk-delete') return bulkDeleteDiaries(payload, actor, ids(form, 'id'), text(form, 'sure') === 'yes')
  return { error: 'That action is not known.' }
}
