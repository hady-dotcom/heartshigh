import type { Payload, Where } from 'payload'
import { now } from '@/lib/clock'
import { hasMarkup } from '@/lib/text-safety'
import { killListHits } from '@/lib/opening-data'
import { idOf, portalIdOf } from '@/lib/ids'
import { minutesTowardAsk, missionProgress, thankYouFanOut, weekMinutesFromSeconds } from '@/lib/mission-maths'
import { sendMail } from './mail'
import { audit } from './viewas'
import type { SessionUser } from './context'

const col = (name: string) => name as 'users'

export type MissionActor = { id: number; role: SessionUser['role']; name?: string | null; email?: string; tenants?: { tenant?: unknown }[] }

export type MissionDoc = {
  id: number
  title: string
  ask: string
  why: string
  minutesAsked: number
  startsAt: string
  endsAt: string
  target: number
  portals: number[]
  experiment?: number | null
  tryPath?: string | null
  status: 'draft' | 'open' | 'closed' | 'shared'
  result?: string | null
  resultAt?: string | null
}

function asDoc(row: Record<string, unknown>): MissionDoc {
  const portals = Array.isArray(row.portals)
    ? (row.portals as unknown[]).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    : []
  return {
    id: Number(row.id),
    title: String(row.title || ''),
    ask: String(row.ask || ''),
    why: String(row.why || ''),
    minutesAsked: Number(row.minutesAsked || 60),
    startsAt: String(row.startsAt || ''),
    endsAt: String(row.endsAt || ''),
    target: Number(row.target || 0),
    portals,
    experiment: idOf(row.experiment),
    tryPath: row.tryPath ? String(row.tryPath) : '',
    status: (['draft', 'open', 'closed', 'shared'] as const).includes(row.status as never) ? (row.status as MissionDoc['status']) : 'draft',
    result: row.result ? String(row.result) : '',
    resultAt: row.resultAt ? String(row.resultAt) : null,
  }
}

export function canViewMissions(actor: MissionActor | null | undefined) {
  return actor?.role === 'master' || actor?.role === 'portal-admin'
}

export function canEditMissions(actor: MissionActor | null | undefined) {
  return actor?.role === 'master'
}

function assertEdit(actor: MissionActor) {
  if (!canEditMissions(actor)) throw new Error('Only the master can write a mission.')
}

export function missionProblems(input: { title?: string; ask?: string; why?: string; minutesAsked?: number; target?: number; startsAt?: string; endsAt?: string }) {
  const problems: string[] = []
  const title = String(input.title || '').trim()
  if (title.length < 3) problems.push('Give the mission a short title.')
  if (title.length > 80) problems.push('Keep the title under 80 characters.')
  if (hasMarkup(title)) problems.push('The title is plain text.')
  const ask = String(input.ask || '').trim()
  if (ask.length < 8) problems.push('Write the ask in a plain sentence.')
  if (hasMarkup(ask) || hasMarkup(String(input.why || ''))) problems.push('Keep the words plain.')
  const hits = killListHits(`${title} ${ask} ${input.why || ''}`)
  if (hits.length) problems.push(`The words ${hits.join(', ')} are not used in HEARTS.`)
  const minutes = Number(input.minutesAsked)
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) problems.push('Ask for between 5 and 600 minutes.')
  const target = Number(input.target)
  if (!Number.isFinite(target) || target < 1) problems.push('Give a target number of learners.')
  if (!input.startsAt || !input.endsAt) problems.push('Write the start and end as 4 October 2026.')
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) problems.push('The end cannot be before the start.')
  return problems
}

export async function loadMission(payload: Payload, id: number): Promise<MissionDoc | null> {
  const row = await payload.findByID({ collection: col('missions'), id, depth: 0, overrideAccess: true }).catch(() => null)
  return row ? asDoc(row as never) : null
}

function portalWhere(actor: MissionActor): Where | undefined {
  if (actor.role === 'master') return undefined
  const portal = portalIdOf(actor)
  if (!portal) return { id: { equals: 0 } }
  return undefined
}

export async function listMissions(payload: Payload, actor: MissionActor) {
  if (!canViewMissions(actor)) throw new Error('Missions are for the master desk and portal admins.')
  const found = await payload.find({
    collection: col('missions'),
    overrideAccess: true,
    depth: 0,
    limit: 80,
    sort: '-updatedAt',
    where: portalWhere(actor),
  })
  return found.docs.map((row) => asDoc(row as never))
}

export async function openMissionsFor(payload: Payload, portalId: number | null) {
  const found = await payload.find({
    collection: col('missions'),
    overrideAccess: true,
    depth: 0,
    limit: 20,
    sort: '-startsAt',
    where: { status: { equals: 'open' } },
  })
  const nowIso = now().toISOString()
  return found.docs
    .map((row) => asDoc(row as never))
    .filter((row) => {
      if (row.startsAt && row.startsAt > nowIso) return false
      if (row.endsAt && row.endsAt < nowIso) return false
      if (!row.portals.length) return true
      return portalId ? row.portals.includes(portalId) : false
    })
}

export async function joinCount(payload: Payload, missionId: number) {
  const counted = await payload.count({ collection: col('mission-joins'), overrideAccess: true, where: { mission: { equals: missionId } } })
  return counted.totalDocs
}

export async function joinOf(payload: Payload, missionId: number, userId: number) {
  const found = await payload.find({
    collection: col('mission-joins'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ mission: { equals: missionId } }, { user: { equals: userId } }] },
  })
  return (found.docs[0] as { id: number; finishedAt?: string; minutes?: number } | undefined) || null
}

export async function weekSeconds(payload: Payload, userId: number) {
  const since = new Date(now().getTime() - 7 * 86_400_000).toISOString()
  const sessions = await payload.find({
    collection: 'watch-sessions',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { and: [{ user: { equals: userId } }, { updatedAt: { greater_than_equal: since } }] },
  })
  return (sessions.docs as { seconds?: number }[]).reduce((sum, row) => sum + Number(row.seconds || 0), 0)
}

/** Personal sitting time for mission minutes. Teachers only see this when shareWatch is on. */
export async function recordPersonalWatch(
  payload: Payload,
  input: { userId: number; lessonId: number; seconds: number; portalId?: number | null },
) {
  const seconds = Math.max(0, Math.round(Number(input.seconds) || 0))
  if (!input.userId || !input.lessonId || seconds <= 0) return null
  let portalId = input.portalId || null
  if (!portalId) {
    const user = await payload.findByID({ collection: 'users', id: input.userId, depth: 0, overrideAccess: true }).catch(() => null)
    portalId = portalIdOf(user as { tenants?: { tenant?: unknown }[] } | null)
  }
  return payload.create({
    collection: 'watch-sessions',
    overrideAccess: true,
    data: {
      user: input.userId,
      lesson: input.lessonId,
      seconds,
      portal: portalId || undefined,
    } as never,
  })
}

export async function createMission(payload: Payload, actor: MissionActor, input: {
  title: string
  ask: string
  why?: string
  minutesAsked: number
  startsAt: string
  endsAt: string
  target: number
  portalIds?: number[]
  experimentId?: number | null
  tryPath?: string
}) {
  assertEdit(actor)
  const problems = missionProblems(input)
  if (problems.length) throw new Error(problems[0])
  const created = await payload.create({
    collection: col('missions'),
    overrideAccess: true,
    data: {
      title: input.title.trim(),
      ask: input.ask.trim(),
      why: (input.why || '').trim(),
      minutesAsked: input.minutesAsked,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      target: input.target,
      portals: input.portalIds || [],
      experiment: input.experimentId || undefined,
      tryPath: input.tryPath || '',
      status: 'draft',
      createdBy: actor.id,
    } as never,
  })
  const doc = asDoc(created as never)
  await audit(payload, 'mission.create', { actor: actor.id, actorRole: actor.role, detail: { id: doc.id, title: doc.title } })
  return doc
}

export async function updateMission(payload: Payload, actor: MissionActor, id: number, input: Partial<{
  title: string
  ask: string
  why: string
  minutesAsked: number
  startsAt: string
  endsAt: string
  target: number
  portalIds: number[]
  experimentId: number | null
  tryPath: string
  status: MissionDoc['status']
}>) {
  assertEdit(actor)
  const current = await loadMission(payload, id)
  if (!current) throw new Error('That mission was not found.')
  const next = {
    title: input.title ?? current.title,
    ask: input.ask ?? current.ask,
    why: input.why ?? current.why,
    minutesAsked: input.minutesAsked ?? current.minutesAsked,
    startsAt: input.startsAt ?? current.startsAt,
    endsAt: input.endsAt ?? current.endsAt,
    target: input.target ?? current.target,
  }
  const problems = missionProblems(next)
  if (problems.length) throw new Error(problems[0])
  const updated = await payload.update({
    collection: col('missions'),
    id,
    overrideAccess: true,
    data: {
      ...next,
      portals: input.portalIds ?? current.portals,
      experiment: input.experimentId === undefined ? current.experiment : input.experimentId || null,
      tryPath: input.tryPath ?? current.tryPath,
      status: input.status ?? current.status,
    } as never,
  })
  return asDoc(updated as never)
}

export async function openMission(payload: Payload, actor: MissionActor, id: number) {
  return updateMission(payload, actor, id, { status: 'open' })
}

export async function closeMission(payload: Payload, actor: MissionActor, id: number) {
  return updateMission(payload, actor, id, { status: 'closed' })
}

export async function joinMission(payload: Payload, user: SessionUser, missionId: number, portalId?: number | null) {
  if (user.role !== 'learner') throw new Error('Missions are for learners to join.')
  const mission = await loadMission(payload, missionId)
  if (!mission || mission.status !== 'open') throw new Error('That mission is not open just now.')
  if (mission.portals.length && portalId && !mission.portals.includes(portalId)) throw new Error('This mission is for another portal.')
  const held = await joinOf(payload, missionId, user.id)
  if (held) return { already: true, join: held }
  try {
    const created = await payload.create({
      collection: col('mission-joins'),
      overrideAccess: true,
      data: {
        mission: missionId,
        user: user.id,
        portal: portalId || undefined,
        joinedAt: now().toISOString(),
        minutes: weekMinutesFromSeconds(await weekSeconds(payload, user.id)),
      } as never,
    })
    return { already: false, join: created }
  } catch {
    const again = await joinOf(payload, missionId, user.id)
    if (again) return { already: true, join: again }
    throw new Error('That join could not be saved.')
  }
}

export async function finishMission(payload: Payload, user: SessionUser, missionId: number) {
  const held = await joinOf(payload, missionId, user.id)
  if (!held) throw new Error('Join this mission first.')
  const minutes = weekMinutesFromSeconds(await weekSeconds(payload, user.id))
  await payload.update({
    collection: col('mission-joins'),
    id: held.id,
    overrideAccess: true,
    data: { finishedAt: now().toISOString(), minutes } as never,
  })
  return { minutes }
}

export async function shareResult(payload: Payload, actor: MissionActor, id: number, result: string) {
  assertEdit(actor)
  const mission = await loadMission(payload, id)
  if (!mission) throw new Error('That mission was not found.')
  const text = result.trim()
  if (text.length < 4) throw new Error('Write a short “What we decided”.')
  if (hasMarkup(text)) throw new Error('Keep the words plain.')
  const updated = await payload.update({
    collection: col('missions'),
    id,
    overrideAccess: true,
    data: { result: text, resultAt: now().toISOString(), status: 'shared' } as never,
  })
  const joins = await payload.find({
    collection: col('mission-joins'),
    overrideAccess: true,
    depth: 0,
    limit: 2000,
    pagination: false,
    where: { mission: { equals: id } },
  })
  const notes = thankYouFanOut(
    (joins.docs as { user?: unknown; portal?: unknown }[]).map((row) => ({ userId: idOf(row.user) || 0, portalId: idOf(row.portal) })),
    { missionId: id, result: text, href: '/me/shaped' },
  )
  for (const note of notes) {
    const already = await payload.find({
      collection: 'notifications',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { and: [{ user: { equals: note.user } }, { key: { equals: note.key } }] },
    })
    if (already.docs.length) continue
    const person = await payload.findByID({ collection: 'users', id: note.user, overrideAccess: true, depth: 0 }).catch(() => null) as { email?: string; tenants?: { tenant?: unknown }[] } | null
    const portal = note.portal || portalIdOf(person)
    const slug = portal
      ? String(((await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 }).catch(() => null)) as { slug?: string } | null)?.slug || '')
      : ''
    const href = slug ? `/p/${slug}/me/shaped` : '/'
    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: {
        user: note.user,
        portal: portal || undefined,
        title: note.title,
        body: note.body,
        href,
        key: note.key,
        channel: 'in-app',
      },
    })
    if (person?.email) await sendMail({ to: person.email, subject: note.title, text: note.body })
    await payload.update({
      collection: col('mission-joins'),
      id: (joins.docs.find((row) => idOf((row as { user?: unknown }).user) === note.user) as { id: number }).id,
      overrideAccess: true,
      data: { thanked: true } as never,
    }).catch(() => undefined)
  }
  await audit(payload, 'mission.result', { actor: actor.id, actorRole: actor.role, detail: { id, thanked: notes.length } })
  return { mission: asDoc(updated as never), thanked: notes.length }
}

export async function shapedFor(payload: Payload, userId: number) {
  const joins = await payload.find({
    collection: col('mission-joins'),
    overrideAccess: true,
    depth: 0,
    limit: 40,
    sort: '-joinedAt',
    where: { user: { equals: userId } },
  })
  const ids = joins.docs.map((row) => idOf((row as { mission?: unknown }).mission)).filter((id): id is number => Boolean(id))
  if (!ids.length) return []
  const missions = await payload.find({
    collection: col('missions'),
    overrideAccess: true,
    depth: 0,
    limit: 40,
    where: { id: { in: ids } },
  })
  return missions.docs
    .map((row) => asDoc(row as never))
    .filter((row) => row.result)
}

export async function missionView(payload: Payload, mission: MissionDoc, user?: SessionUser | null) {
  const joined = await joinCount(payload, mission.id)
  const progress = missionProgress(joined, mission.target)
  const join = user?.role === 'learner' ? await joinOf(payload, mission.id, user.id) : null
  const minutes = user?.role === 'learner' ? weekMinutesFromSeconds(await weekSeconds(payload, user.id)) : 0
  const toward = minutesTowardAsk(minutes, mission.minutesAsked)
  return { mission, progress, join, toward }
}

export async function threadFor(payload: Payload, user: SessionUser, portalId?: number | null) {
  const found = await payload.find({
    collection: col('support-threads'),
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { user: { equals: user.id } },
  })
  if (found.docs[0]) return found.docs[0] as { id: number }
  return payload.create({
    collection: col('support-threads'),
    overrideAccess: true,
    data: { user: user.id, portal: portalId || undefined, status: 'open' } as never,
  }) as Promise<{ id: number }>
}

export async function supportMessages(payload: Payload, threadId: number) {
  const found = await payload.find({
    collection: col('support-messages'),
    overrideAccess: true,
    depth: 0,
    limit: 80,
    sort: 'createdAt',
    where: { thread: { equals: threadId } },
  })
  return found.docs as { id: number; body?: string; fromDesk?: boolean; createdAt?: string; author?: unknown }[]
}

export async function postSupport(payload: Payload, user: SessionUser, body: string, portalId?: number | null, fromDesk = false) {
  const text = body.trim()
  if (text.length < 2) throw new Error('Write a short note.')
  if (hasMarkup(text)) throw new Error('Keep the words plain.')
  const portal = portalId || portalIdOf(user)
  const thread = await threadFor(payload, user, portal)
  await payload.create({
    collection: col('support-messages'),
    overrideAccess: true,
    data: { thread: thread.id, author: user.id, body: text, fromDesk } as never,
  })
  if (!fromDesk) {
    const masters = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 10, where: { role: { equals: 'master' } } })
    for (const master of masters.docs) {
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: master.id,
          portal: portal || undefined,
          title: 'A learner asked for help',
          body: `${user.name || 'A learner'} wrote in Ask for help.`,
          href: '/master/missions',
          channel: 'in-app',
        },
      }).catch(() => undefined)
    }
  }
  return thread
}

export async function deskThreads(payload: Payload) {
  const found = await payload.find({
    collection: col('support-threads'),
    overrideAccess: true,
    depth: 1,
    limit: 40,
    sort: '-updatedAt',
  })
  return found.docs as { id: number; user?: { id?: number; name?: string; email?: string }; status?: string; updatedAt?: string }[]
}
