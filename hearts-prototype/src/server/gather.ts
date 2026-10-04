import { randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import {
  applyChoice,
  attendanceCompletesTask,
  bandFromScales,
  bringToken,
  crossPost,
  discussionPrompts,
  firstName,
  goingCount,
  googleCalendarUrl,
  chartLabel,
  doorLearnerHeading,
  doorOnLine,
  groupByDoor,
  isSameDay,
  linkLabel,
  londonIso,
  makeEntryCode,
  matchingGatherings,
  newcomerFollowUp,
  publicNames,
  reflectionSentence,
  suggestedAudience,
  taskWantsCompany,
  toIcs,
  userIdFromBringToken,
  whatsAppHref,
  whenLabel,
  type Audience,
  type GatherKind,
  type GatherRef,
  type RsvpChoice,
  type RsvpRow,
  type TaskRef,
} from '@/lib/gather'
import { capitalAfterColon, doorByNumber, doorCode, doorLabel } from '@/lib/doors'
import { harvestLine } from '@/lib/harvest'
import { idOf, portalIdOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { loadPortal, type SessionUser } from './context'

type Doc = { id: number; [key: string]: any }

const KINDS = new Set(['circle', 'tea', 'volunteer', 'walk', 'youth', 'picnic'])
const AUDIENCES = new Set(['brothers', 'sisters', 'family', 'youth', 'all'])
const CHOICES = new Set(['going', 'maybe', 'cant'])

export type GatherCard = {
  id: number
  slug: string
  title: string
  kind: string
  audience: string
  audienceLabel: string
  startsAt: string
  endsAt: string
  when: string
  place: string
  mapUrl: string
  capacity: number
  going: number
  maybe: number
  waitlist: number
  checkedIn: number
  mine: string
  linkLabel: string
  door: number | null
  doorLabel: string
  doorHeading: string
  onLine: string
  hostLabel: string
  bring: string
  note: string
  status: string
  past: boolean
  today: boolean
  lessonId: number | null
  courseId: number | null
  taskId: number | null
  prompts: string[]
  checkinToken: string
  entryCode: string
  proposedBy: number | null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function all(payload: Payload, collection: string, where: unknown, limit = 200) {
  const found = await payload.find({ collection: collection as 'gatherings', overrideAccess: true, depth: 0, limit, where: where as never, sort: 'startsAt' })
  return found.docs as unknown as Doc[]
}

export async function portalOf(payload: Payload, user: SessionUser, slug: string) {
  const portal = slug ? await loadPortal(payload, slug) : null
  if (!portal) return null
  if (user.role !== 'master' && portalIdOf(user) !== portal.id) return null
  return portal
}

function cardFrom(row: Doc, rsvps: Doc[], checkins: Doc[], userId: number | null, at: Date): GatherCard {
  const mine = userId ? rsvps.find((item) => idOf(item.gathering) === row.id && idOf(item.user) === userId) : undefined
  const forRow = rsvps.filter((item) => idOf(item.gathering) === row.id)
  const startsAt = text(row.startsAt)
  const door = num(row.door)
  const doorRow = door ? doorByNumber(door) : null
  return {
    id: row.id,
    slug: text(row.slug),
    title: text(row.title),
    kind: text(row.kind) || 'circle',
    audience: text(row.audience) || 'all',
    audienceLabel: audienceLabel(text(row.audience) || 'all'),
    startsAt,
    endsAt: text(row.endsAt),
    when: whenLabel(startsAt),
    place: text(row.place),
    mapUrl: text(row.mapUrl) || (text(row.place) ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text(row.place))}` : ''),
    capacity: Number(row.capacity || 0),
    going: forRow.filter((item) => item.status === 'going').length,
    maybe: forRow.filter((item) => item.status === 'maybe').length,
    waitlist: forRow.filter((item) => item.status === 'waitlist').length,
    checkedIn: checkins.filter((item) => idOf(item.gathering) === row.id).length,
    mine: mine ? text(mine.status) : '',
    linkLabel: capitalAfterColon(text(row.linkLabel)) || (doorRow ? linkLabel({ doorTitle: doorRow.title }) : ''),
    door,
    doorLabel: doorRow ? doorLabel(doorRow) : '',
    doorHeading: doorRow ? doorLearnerHeading(doorRow.number, doorRow.title) : '',
    onLine: doorRow ? doorOnLine(doorRow.title) : '',
    hostLabel: text(row.hostLabel) || 'Your host',
    bring: text(row.bring),
    note: text(row.note),
    status: text(row.status) || 'published',
    past: Boolean(startsAt) && new Date(startsAt).getTime() < at.getTime() - 3 * 60 * 60 * 1000,
    today: Boolean(startsAt) && isSameDay(startsAt, at),
    lessonId: idOf(row.lesson),
    courseId: idOf(row.course),
    taskId: idOf(row.task),
    prompts: Array.isArray(row.prompts) ? (row.prompts as unknown[]).map((item) => String(item)).filter(Boolean) : [],
    checkinToken: text(row.checkinToken),
    entryCode: text(row.entryCode).toUpperCase(),
    proposedBy: idOf(row.proposedBy),
  }
}

function audienceLabel(value: string) {
  return ({ brothers: 'Brothers', sisters: 'Sisters', family: 'Families', youth: 'Youth', all: 'Everyone' } as Record<string, string>)[value] || 'Everyone'
}

export async function listGatherings(payload: Payload, portalId: number, userId: number | null, opts?: { includeProposed?: boolean }) {
  const at = now()
  const [rows, rsvps, checkins] = await Promise.all([
    all(payload, 'gatherings', { portal: { equals: portalId } }, 200),
    all(payload, 'gather-rsvps', { portal: { equals: portalId } }, 2000),
    all(payload, 'gather-checkins', { portal: { equals: portalId } }, 2000),
  ])
  const cards = rows
    .map((row) => cardFrom(row, rsvps, checkins, userId, at))
    .filter((card) => card.status !== 'cancelled')
    .filter((card) => opts?.includeProposed || card.status === 'published' || (userId && card.proposedBy === userId))
  return { cards, grouped: groupByDoor(cards), rsvps, checkins, rows }
}

export async function gatheringById(payload: Payload, id: number) {
  const doc = await payload.findByID({ collection: 'gatherings', id, depth: 0, overrideAccess: true }).catch(() => null)
  return (doc as Doc | null) || null
}

export async function gatheringBySlug(payload: Payload, slug: string) {
  const found = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: slug } } })
  return (found.docs[0] as Doc | undefined) || null
}

export function slugifyTitle(title: string) {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return base || 'gather'
}

async function uniqueSlug(payload: Payload, title: string, seed?: string) {
  const root = seed ? `${slugifyTitle(title)}-${seed.slice(0, 10)}` : slugifyTitle(title)
  let slug = root
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await payload.find({ collection: 'gatherings', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: slug } } })
    if (!clash.docs.length) return slug
    slug = `${root}-${randomUUID().slice(0, 4)}`
  }
  return `${root}-${randomUUID().slice(0, 8)}`
}

function cleanUrl(value: string) {
  if (!value) return ''
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

export async function promptsForLesson(payload: Payload, lessonId: number | null) {
  if (!lessonId) return []
  const points = await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 30,
    where: { and: [{ lesson: { equals: lessonId } }, { status: { not_equals: 'rejected' } }] },
    sort: 'second',
  })
  return discussionPrompts(points.docs.map((point) => ({ prompt: text((point as Doc).prompt), kind: text((point as Doc).kind) })))
}

export async function saveGathering(payload: Payload, input: {
  portalId: number
  user: SessionUser
  id?: number
  title: string
  kind: string
  audience: string
  startsAt: string
  endsAt?: string
  place: string
  mapUrl: string
  capacity: number
  bring: string
  note: string
  hostLabel: string
  lessonId?: number | null
  courseId?: number | null
  taskId?: number | null
  door?: number | null
  propose?: boolean
}) {
  const title = input.title.slice(0, 120)
  if (!title) return { ok: false as const, error: 'Give the gathering a name.' }
  const startsAt = londonIso(input.startsAt) || (input.startsAt ? new Date(input.startsAt).toISOString() : '')
  if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) return { ok: false as const, error: 'Choose a date and a time.' }
  const kind = (KINDS.has(input.kind) ? input.kind : 'circle') as GatherKind
  const audience = (AUDIENCES.has(input.audience) ? input.audience : suggestedAudience(kind, title)) as Audience
  const door = input.door && doorByNumber(input.door) ? input.door : null
  const doorRow = door ? doorByNumber(door) : null
  let courseTitle = ''
  let lessonTitle = ''
  if (input.lessonId) {
    const lesson = await payload.findByID({ collection: 'lessons', id: input.lessonId, depth: 0, overrideAccess: true }).catch(() => null)
    lessonTitle = text((lesson as Doc | null)?.title)
    if (!input.courseId) input.courseId = idOf((lesson as Doc | null)?.course)
  }
  if (input.courseId) {
    const course = await payload.findByID({ collection: 'courses', id: input.courseId, depth: 0, overrideAccess: true }).catch(() => null)
    courseTitle = text((course as Doc | null)?.title)
  }
  const prompts = await promptsForLesson(payload, input.lessonId || null)
  const data = {
    title,
    kind,
    audience,
    startsAt,
    endsAt: input.endsAt ? londonIso(input.endsAt) || undefined : undefined,
    place: input.place.slice(0, 160),
    mapUrl: cleanUrl(input.mapUrl),
    capacity: Math.max(0, Math.round(input.capacity || 0)),
    bring: input.bring.slice(0, 400),
    note: input.note.slice(0, 800),
    host: input.user.id,
    hostLabel: (input.hostLabel || firstName(input.user.name || 'Host')).slice(0, 80),
    lesson: input.lessonId || undefined,
    course: input.courseId || undefined,
    task: input.taskId || undefined,
    door: door || undefined,
    linkLabel: linkLabel({ doorCode: doorRow ? doorCode(doorRow.number) : '', doorTitle: doorRow?.title, courseTitle, lessonTitle }).slice(0, 180),
    prompts,
    portal: input.portalId,
    status: input.propose ? 'proposed' : 'published',
    proposedBy: input.propose ? input.user.id : undefined,
  }
  if (input.id) {
    const existing = await gatheringById(payload, input.id)
    if (!existing || idOf(existing.portal) !== input.portalId) return { ok: false as const, error: 'That gathering is not in this portal.' }
    if (input.propose && input.user.role === 'learner' && idOf(existing.proposedBy) !== input.user.id) {
      return { ok: false as const, error: 'You can only change a gathering you proposed.' }
    }
    await payload.update({ collection: 'gatherings', id: input.id, overrideAccess: true, data: { ...data, entryCode: text(existing.entryCode) || makeEntryCode() } as never })
    return { ok: true as const, id: input.id, slug: text(existing.slug) }
  }
  const created = await payload.create({
    collection: 'gatherings',
    overrideAccess: true,
    data: { ...data, slug: await uniqueSlug(payload, title), checkinToken: randomUUID(), entryCode: makeEntryCode() } as never,
  })
  return { ok: true as const, id: created.id as number, slug: text((created as Doc).slug) }
}

export async function setGatheringStatus(payload: Payload, portalId: number, id: number, status: 'published' | 'cancelled') {
  const existing = await gatheringById(payload, id)
  if (!existing || idOf(existing.portal) !== portalId) return { ok: false as const, error: 'That gathering is not in this portal.' }
  await payload.update({ collection: 'gatherings', id, overrideAccess: true, data: { status } as never })
  return { ok: true as const }
}

function rowsOf(rsvps: Doc[], gatheringId: number): RsvpRow[] {
  return rsvps
    .filter((row) => idOf(row.gathering) === gatheringId)
    .map((row) => ({ id: String(row.id), status: (text(row.status) || 'going') as RsvpRow['status'], at: new Date(text(row.createdAt) || 0).getTime() || row.id }))
}

async function writeStatuses(payload: Payload, before: Doc[], after: RsvpRow[]) {
  for (const row of after) {
    if (row.id === 'new') continue
    const previous = before.find((item) => String(item.id) === row.id)
    if (previous && previous.status !== row.status) {
      await payload.update({ collection: 'gather-rsvps', id: Number(row.id), overrideAccess: true, data: { status: row.status } as never })
    }
  }
}

async function notifyUser(payload: Payload, userId: number, portalId: number, title: string, body: string, href: string, key: string) {
  const existing = await payload.find({ collection: 'notifications', overrideAccess: true, limit: 1, where: { and: [{ user: { equals: userId } }, { key: { equals: key } }] } })
  if (existing.docs.length) return
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { user: userId, portal: portalId, title, body, href, channel: 'in-app', key },
  })
}

export async function respondToGathering(payload: Payload, input: {
  gathering: Doc
  choice: RsvpChoice
  user?: SessionUser | null
  guestName?: string
  guestContact?: string
  bringCode?: string
  remind?: boolean
  seedKey?: string
}) {
  if (!CHOICES.has(input.choice)) return { ok: false as const, error: 'Choose going, maybe, or can’t.' }
  if (text(input.gathering.status) === 'cancelled') return { ok: false as const, error: 'That gathering has been called off.' }
  if (text(input.gathering.status) === 'proposed') return { ok: false as const, error: 'That gathering is not open yet.' }
  const portalId = idOf(input.gathering.portal)
  if (!portalId) return { ok: false as const, error: 'That gathering has no portal.' }
  const existing = await all(payload, 'gather-rsvps', { gathering: { equals: input.gathering.id } }, 500)
  const mine = input.user ? existing.find((row) => idOf(row.user) === input.user!.id) : undefined
  const capacity = Number(input.gathering.capacity || 0)
  const stamped = rowsOf(existing, input.gathering.id)
  const id = mine ? String(mine.id) : 'new'
  const placed = applyChoice(stamped, id, input.choice, capacity, Date.now())
  await writeStatuses(payload, existing, placed.rows)
  const broughtBy = userIdFromBringToken(input.bringCode || '')
  const broughtOk = broughtBy && broughtBy !== input.user?.id ? broughtBy : null
  let rsvpId = mine?.id || 0
  let guestToken = mine ? text(mine.guestToken) : ''
  if (mine) {
    await payload.update({
      collection: 'gather-rsvps',
      id: mine.id,
      overrideAccess: true,
      data: {
        status: placed.status,
        remind: Boolean(input.remind),
        broughtBy: broughtOk || idOf(mine.broughtBy) || undefined,
        bringCode: input.bringCode || text(mine.bringCode) || undefined,
      } as never,
    })
  } else {
    guestToken = input.user ? '' : randomUUID()
    const created = await payload.create({
      collection: 'gather-rsvps',
      overrideAccess: true,
      data: {
        gathering: input.gathering.id,
        user: input.user?.id,
        status: placed.status,
        guestName: input.user ? undefined : (input.guestName || '').slice(0, 80),
        guestContact: input.user ? undefined : (input.guestContact || '').slice(0, 120),
        guestToken: guestToken || undefined,
        broughtBy: broughtOk || undefined,
        bringCode: input.bringCode || undefined,
        remind: Boolean(input.remind),
        seedKey: input.seedKey,
        portal: portalId,
      } as never,
    })
    rsvpId = created.id as number
  }
  const promoted = placed.promotedId ? existing.find((row) => String(row.id) === placed.promotedId) : undefined
  const promotedUser = promoted ? idOf(promoted.user) : null
  if (promotedUser) {
    const slug = text(input.gathering.slug)
    const portal = await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null)
    const base = `/p/${text((portal as Doc | null)?.slug)}/gather/${input.gathering.id}`
    await notifyUser(payload, promotedUser, portalId, 'A place opened', `${text(input.gathering.title)} has a place for you.`, base, `gather-promote-${input.gathering.id}-${promotedUser}`)
  }
  if (input.user && input.remind && placed.status === 'going') {
    const portal = await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null)
    await notifyUser(
      payload,
      input.user.id,
      portalId,
      'Reminder set',
      `${text(input.gathering.title)} is ${whenLabel(text(input.gathering.startsAt))}. We’ll keep it on your Gather page.`,
      `/p/${text((portal as Doc | null)?.slug)}/gather/${input.gathering.id}`,
      `gather-remind-${input.gathering.id}-${input.user.id}`,
    )
  }
  return { ok: true as const, status: placed.status, promoted: Boolean(placed.promotedId), rsvpId, guestToken, slug: text(input.gathering.slug) }
}

export async function claimGuestRsvp(payload: Payload, token: string, userId: number) {
  if (!token) return
  const found = await payload.find({ collection: 'gather-rsvps', overrideAccess: true, depth: 0, limit: 1, where: { guestToken: { equals: token } } })
  const row = found.docs[0] as Doc | undefined
  if (!row || idOf(row.user)) return
  const gatheringId = idOf(row.gathering)
  if (gatheringId) {
    const already = await payload.find({
      collection: 'gather-rsvps',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ gathering: { equals: gatheringId } }, { user: { equals: userId } }] },
    })
    if (already.docs.length) return
  }
  await payload.update({ collection: 'gather-rsvps', id: row.id, overrideAccess: true, data: { user: userId } as never })
}

export async function checkIn(payload: Payload, input: { gathering: Doc; user: SessionUser; method: 'qr' | 'host' | 'code'; token?: string; code?: string }) {
  if (input.method === 'qr' && input.token !== text(input.gathering.checkinToken)) {
    return { ok: false as const, error: 'That door code does not match this gathering.' }
  }
  if (input.method === 'code') {
    const expected = text(input.gathering.entryCode).toUpperCase()
    const given = (input.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    if (!expected || given !== expected) return { ok: false as const, error: 'That door code does not match this gathering.' }
  }
  const portalId = idOf(input.gathering.portal)
  if (!portalId || (input.user.role !== 'master' && portalIdOf(input.user) !== portalId)) {
    return { ok: false as const, error: 'This gathering is for another portal.' }
  }
  const already = await payload.find({
    collection: 'gather-checkins',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ gathering: { equals: input.gathering.id } }, { user: { equals: input.user.id } }] },
  })
  if (already.docs.length) return { ok: true as const, already: true, newcomer: Boolean((already.docs[0] as Doc).newcomer) }
  const rsvp = await payload.find({
    collection: 'gather-rsvps',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ gathering: { equals: input.gathering.id } }, { user: { equals: input.user.id } }] },
  })
  const earlier = await payload.find({
    collection: 'gather-checkins',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ portal: { equals: portalId } }, { user: { equals: input.user.id } }, { gathering: { not_equals: input.gathering.id } }] },
  })
  const newcomer = earlier.totalDocs === 0
  await payload.create({
    collection: 'gather-checkins',
    overrideAccess: true,
    data: {
      gathering: input.gathering.id,
      user: input.user.id,
      rsvp: rsvp.docs[0]?.id,
      method: input.method,
      newcomer,
      guestLabel: firstName(input.user.name || ''),
      portal: portalId,
    } as never,
  })
  await completeMatchingTasks(payload, input.gathering, input.user, portalId)
  return { ok: true as const, already: false, newcomer }
}

async function completeMatchingTasks(payload: Payload, gathering: Doc, user: SessionUser, portalId: number) {
  const lessonId = idOf(gathering.lesson)
  const taskId = idOf(gathering.task)
  const where = taskId && lessonId
    ? { or: [{ id: { equals: taskId } }, { lesson: { equals: lessonId } }] }
    : taskId
      ? { id: { equals: taskId } }
      : lessonId
        ? { lesson: { equals: lessonId } }
        : null
  if (!where) return
  const points = await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 40, where: where as never })
  const courseId = idOf(gathering.course)
  const gatherRef: GatherRef = {
    id: gathering.id,
    lessonId,
    courseId,
    door: num(gathering.door),
    taskId,
    startsAt: text(gathering.startsAt),
  }
  for (const point of points.docs as Doc[]) {
    const kind = text(point.kind)
    const family = text(point.family)
    if (kind !== 'task' && family !== 'task') continue
    const task: TaskRef = { id: point.id, lessonId: idOf(point.lesson), courseId, door: num(gathering.door), prompt: text(point.prompt) }
    const matches = taskId === point.id || gatheringMatchesTaskSafe(gatherRef, task)
    const existing = await payload.find({
      collection: 'answers',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ point: { equals: point.id } }, { user: { equals: user.id } }] },
    })
    if (!attendanceCompletesTask({ checkedIn: true, matches, alreadyAnswered: existing.docs.length > 0 })) continue
    const lesson = idOf(point.lesson) || lessonId
    const answer = await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: {
        point: point.id,
        user: user.id,
        lesson: lesson || undefined,
        body: `I went along to ${text(gathering.title)}.`,
        shareWithTeacher: true,
        sourceLevel: 'talk',
        viaGathering: true,
        portal: portalId,
        answeredAt: now().toISOString(),
      } as never,
    })
    await payload.create({
      collection: 'workbook-entries',
      overrideAccess: true,
      data: {
        user: user.id,
        answer: answer.id,
        lesson: lesson || undefined,
        course: courseId || undefined,
        body: `I went along to ${text(gathering.title)}.`,
        consent: true,
        portal: portalId,
      } as never,
    })
  }
}

function gatheringMatchesTaskSafe(gathering: GatherRef, task: TaskRef) {
  if (gathering.taskId && gathering.taskId === task.id) return true
  if (!taskWantsCompany(task.prompt)) return false
  if (gathering.lessonId && task.lessonId && gathering.lessonId === task.lessonId) return true
  if (gathering.courseId && task.courseId && gathering.courseId === task.courseId) return true
  if (gathering.door && task.door && gathering.door === task.door) return true
  return false
}

export async function saveReflection(payload: Payload, gathering: Doc, user: SessionUser, raw: string) {
  const portalId = idOf(gathering.portal)
  if (!portalId || portalIdOf(user) !== portalId && user.role !== 'master') return { ok: false as const, error: 'This gathering is for another portal.' }
  const sentence = reflectionSentence(raw)
  if (!sentence) return { ok: false as const, error: 'Write one full sentence, at least four words.' }
  const checked = await payload.find({
    collection: 'gather-checkins',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ gathering: { equals: gathering.id } }, { user: { equals: user.id } }] },
  })
  if (!checked.docs.length) return { ok: false as const, error: 'Check in first, then tell us what you’ll carry.' }
  const existing = await payload.find({
    collection: 'gather-reflections',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ gathering: { equals: gathering.id } }, { user: { equals: user.id } }] },
  })
  if (existing.docs[0]) {
    await payload.update({ collection: 'gather-reflections', id: (existing.docs[0] as Doc).id, overrideAccess: true, data: { body: sentence } as never })
  } else {
    await payload.create({
      collection: 'gather-reflections',
      overrideAccess: true,
      data: { gathering: gathering.id, user: user.id, body: sentence, portal: portalId } as never,
    })
  }
  const line = harvestLine(sentence, sentence)
  if (line) {
    const prior = await payload.find({
      collection: 'harvest-entries',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: user.id } }, { text: { equals: line } }, { reference: { equals: 'Gather' } }] },
    })
    if (!prior.docs.length) {
      await payload.create({
        collection: 'harvest-entries',
        overrideAccess: true,
        data: {
          user: user.id,
          lesson: idOf(gathering.lesson) || undefined,
          kind: 'line',
          text: line,
          context: line,
          reference: 'Gather',
          surface: 'talk',
          speaker: text(gathering.hostLabel),
          door: num(gathering.door) || undefined,
          gatheredAt: now().toISOString(),
          portal: portalId,
        } as never,
      })
    }
  }
  await payload.create({
    collection: 'rituals',
    overrideAccess: true,
    data: { user: user.id, note: sentence.slice(0, 180), portal: portalId } as never,
  })
  return { ok: true as const, sentence }
}

export async function savePhoto(payload: Payload, gathering: Doc, user: SessionUser, file: File, caption: string, consent: boolean) {
  const portalId = idOf(gathering.portal)
  if (!portalId) return { ok: false as const, error: 'That gathering has no portal.' }
  if (user.role === 'learner' && idOf(gathering.host) !== user.id) return { ok: false as const, error: 'The host keeps the photos.' }
  if (!consent) return { ok: false as const, error: 'Tick the consent box before a photo is kept.' }
  if (!(file instanceof File) || file.size <= 0) return { ok: false as const, error: 'Choose a photo.' }
  const ext = (file.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] || '.jpg').toLowerCase()
  const media = await payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt: caption.slice(0, 120) || 'Gathering photo', portal: portalId } as never,
    file: { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type || 'image/jpeg', name: `${randomUUID()}${ext}`, size: file.size },
  })
  await payload.create({
    collection: 'gather-photos',
    overrideAccess: true,
    data: { gathering: gathering.id, image: media.id, caption: caption.slice(0, 160), consent: true, postedBy: user.id, portal: portalId } as never,
  })
  return { ok: true as const }
}

export async function splitCircles(payload: Payload, gathering: Doc) {
  const portalId = idOf(gathering.portal)
  if (!portalId) return { ok: false as const, error: 'That gathering has no portal.' }
  const [rsvps, checkins] = await Promise.all([
    all(payload, 'gather-rsvps', { and: [{ gathering: { equals: gathering.id } }, { status: { equals: 'going' } }] }, 300),
    all(payload, 'gather-checkins', { portal: { equals: portalId } }, 2000),
  ])
  const userIds = rsvps.map((row) => idOf(row.user)).filter((id): id is number => Boolean(id))
  const attempts = userIds.length
    ? await payload.find({ collection: 'compass-attempts', overrideAccess: true, depth: 0, limit: 300, where: { user: { in: userIds } }, sort: '-createdAt' })
    : { docs: [] as Doc[] }
  const bandOf = new Map<number, string>()
  for (const attempt of attempts.docs as Doc[]) {
    const userId = idOf(attempt.user)
    if (!userId || bandOf.has(userId)) continue
    bandOf.set(userId, bandFromScales((attempt.scales as Record<string, number> | null) || null))
  }
  const seen = new Set(checkins.filter((row) => idOf(row.gathering) !== gathering.id).map((row) => idOf(row.user)))
  const people = rsvps.map((row) => {
    const userId = idOf(row.user)
    const id = userId ? String(userId) : `guest-${row.id}`
    return { id, newcomer: userId ? !seen.has(userId) : true, band: userId ? bandOf.get(userId) || 'open' : 'open' }
  })
  const { balanceGroups } = await import('@/lib/gather')
  const circles = balanceGroups(people).map((circle) => ({ name: circle.name, memberIds: circle.memberIds }))
  await payload.update({ collection: 'gatherings', id: gathering.id, overrideAccess: true, data: { circles } as never })
  return { ok: true as const, circles }
}

export async function welcomeNewcomers(payload: Payload, portalId: number, portalSlug: string) {
  const checkins = await all(payload, 'gather-checkins', { and: [{ portal: { equals: portalId } }, { newcomer: { equals: true } }, { welcomed: { not_equals: true } }] }, 200)
  let sent = 0
  for (const row of checkins) {
    const userId = idOf(row.user)
    if (!userId) continue
    const gatheringId = idOf(row.gathering)
    await notifyUser(payload, userId, portalId, 'Welcome', 'It was good to have you with us. Come again when you can.', `/p/${portalSlug}/gather`, `gather-welcome-${row.id}`)
    await payload.update({ collection: 'gather-checkins', id: row.id, overrideAccess: true, data: { welcomed: true } as never })
    sent += 1
    void gatheringId
  }
  return sent
}

export async function learnerAccessCode(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ portal: { equals: portalId } }, { role: { equals: 'learner' } }] },
  })
  const at = now()
  const open = (found.docs as Doc[]).find((row) => {
    if (row.disabled === true) return false
    if (row.expiresAt && new Date(text(row.expiresAt)).getTime() < at.getTime()) return false
    const max = num(row.maxUses)
    const uses = Number(row.uses || 0)
    if (max && uses >= max) return false
    return Boolean(text(row.code))
  })
  return open ? text(open.code) : ''
}

export async function publicView(payload: Payload, slug: string) {
  const row = await gatheringBySlug(payload, slug)
  if (!row || text(row.status) !== 'published') return null
  const portalId = idOf(row.portal)
  const portal = portalId ? await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null) : null
  const rsvps = await all(payload, 'gather-rsvps', { gathering: { equals: row.id } }, 400)
  const userIds = rsvps.filter((item) => item.status === 'going' && idOf(item.user)).map((item) => idOf(item.user)!)
  const users = userIds.length
    ? await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: userIds.length, where: { id: { in: userIds } } })
    : { docs: [] as Doc[] }
  const nameOf = new Map((users.docs as Doc[]).map((user) => [user.id, text(user.name)]))
  const full = rsvps
    .filter((item) => item.status === 'going')
    .map((item) => text(item.guestName) || nameOf.get(idOf(item.user) || 0) || 'Guest')
  const card = cardFrom(row, rsvps, [], null, now())
  const code = portalId ? await learnerAccessCode(payload, portalId) : ''
  return {
    card,
    portalName: text((portal as Doc | null)?.name) || 'Your masjid',
    portalSlug: text((portal as Doc | null)?.slug),
    names: publicNames(full).slice(0, 12),
    more: Math.max(0, full.length - 12),
    code,
    circles: Array.isArray(row.circles) ? (row.circles as { name: string; memberIds: string[] }[]) : [],
  }
}

export function sharePack(origin: string, card: GatherCard, withToken = '') {
  const url = `${origin}/gather/${card.slug}${withToken ? `?with=${withToken}` : ''}`
  const description = [card.linkLabel, card.when, card.place, card.audienceLabel].filter(Boolean).join(' · ')
  return {
    url,
    description,
    whatsApp: whatsAppHref(url, card.title, card.when),
    google: googleCalendarUrl({ title: card.title, startsAt: card.startsAt, endsAt: card.endsAt || null, place: card.place, description: card.linkLabel || card.note }),
    icsPath: `/gather/${card.slug}/event.ics`,
    crossPost: crossPost({
      title: card.title,
      when: card.when,
      place: card.place,
      mapUrl: card.mapUrl,
      audience: card.audienceLabel,
      bring: card.bring,
      host: card.hostLabel,
      note: card.note,
      url,
      linkLabel: card.linkLabel,
    }),
  }
}

export function icsFor(card: GatherCard, origin: string) {
  return toIcs({
    uid: `gather-${card.slug}@hearts`,
    title: card.title,
    startsAt: card.startsAt,
    endsAt: card.endsAt || null,
    place: card.place,
    description: [card.linkLabel, card.note, card.bring].filter(Boolean).join('\n'),
    url: `${origin}/gather/${card.slug}`,
  })
}

export async function attendanceReport(payload: Payload, portalId: number) {
  const { cards, rsvps, checkins } = await listGatherings(payload, portalId, null, { includeProposed: true })
  const userIds = [...new Set([...rsvps, ...checkins].map((row) => idOf(row.user)).filter((id): id is number => Boolean(id)))]
  const users = userIds.length
    ? await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: userIds.length, where: { id: { in: userIds } } })
    : { docs: [] as Doc[] }
  const nameOf = new Map((users.docs as Doc[]).map((user) => [user.id, text(user.name) || 'Learner']))
  const series = cards
    .filter((card) => card.past)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((card) => {
      const inside = checkins.filter((row) => idOf(row.gathering) === card.id)
      const newcomers = inside.filter((row) => row.newcomer === true).length
      return { label: chartLabel(card.startsAt) || card.title, title: card.title, going: card.going, checkedIn: inside.length, newcomers, regulars: inside.length - newcomers }
    })
  const brought = rsvps
    .filter((row) => idOf(row.broughtBy))
    .map((row) => ({
      host: nameOf.get(idOf(row.broughtBy) || 0) || 'Someone',
      guest: nameOf.get(idOf(row.user) || 0) || text(row.guestName) || 'A guest',
      gathering: cards.find((card) => card.id === idOf(row.gathering))?.title || '',
    }))
  const unwelcomed = checkins.filter((row) => row.newcomer === true && row.welcomed !== true && idOf(row.user))
  const followUp = newcomerFollowUp(unwelcomed.length)
  const followNames = unwelcomed.map((row) => nameOf.get(idOf(row.user) || 0) || 'A learner')
  return { cards, series, brought, followUp, followNames, newcomers: checkins.filter((row) => row.newcomer === true).length, regulars: checkins.filter((row) => row.newcomer !== true).length }
}

export function attendanceCsv(report: Awaited<ReturnType<typeof attendanceReport>>) {
  const lines = [['Title', 'When', 'Door', 'Who it is for', 'Going', 'Waitlist', 'Checked in'].join(',')]
  for (const card of report.cards) {
    const cells = [card.title, card.when, card.doorLabel, card.audienceLabel, String(card.going), String(card.waitlist), String(card.checkedIn)]
    lines.push(cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
  }
  return lines.join('\n')
}

export async function tasksWantingCompany(payload: Payload, portalId: number, userId: number) {
  const { cards } = await listGatherings(payload, portalId, userId)
  const upcoming = cards.filter((card) => card.status === 'published' && !card.past)
  return { cards: upcoming }
}

export function taskMatches(cards: GatherCard[], task: TaskRef, at = now().getTime()) {
  return matchingGatherings(
    cards.map((card) => ({ id: card.id, lessonId: card.lessonId, courseId: card.courseId, door: card.door, taskId: card.taskId, startsAt: card.startsAt })),
    task,
    at,
  )
}

export function bringLink(origin: string, slug: string, userId: number) {
  return `${origin}/gather/${slug}?with=${bringToken(userId)}`
}

export { goingCount }
