import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { doorByNumber, doorLabel } from '@/lib/doors'
import { idOf, portalIdOf } from '@/lib/ids'
import {
  LIVE_POLL_MS,
  PRESENCE_WINDOW_MS,
  QUESTION_GAP_MS,
  canGoLive,
  canSeeLive,
  cleanQuestion,
  createMuxLiveStream,
  hostFirstName,
  isLiveSource,
  liveWhenLabel,
  muxConfigured,
  muxPlaybackUrl,
  muxVodUrl,
  parseLiveSource,
  parseLiveWhen,
  questionProblem,
  questionRateProblem,
  replayCourseTitle,
  replayTitle,
  type LiveSource,
} from '@/lib/live'
import { portalTimeZone } from '@/lib/zone-time'
import { loadPortal, type PortalDoc, type SessionUser } from './context'
import { audit } from './viewas'

type Doc = Record<string, unknown> & { id: number }

const col = (name: string) => name as 'users'

export type LiveQuestionCard = {
  id: number
  body: string
  authorName: string
  mine: boolean
  hidden: boolean
  answered: boolean
  pinned: boolean
  at: string
}

export type LiveCard = {
  id: number
  portalId: number
  portalSlug: string
  title: string
  door: number | null
  doorLabel: string
  hostId: number
  hostName: string
  hostFirst: string
  source: LiveSource
  sourceUrl: string
  youtubeId: string
  vimeoId: string
  muxStreamId: string
  muxStreamKey: string
  muxRtmpUrl: string
  muxPlaybackId: string
  embedUrl: string
  vodUrl: string
  status: 'scheduled' | 'live' | 'ended'
  scheduledAt: string
  startedAt: string
  endedAt: string
  when: string
  viewerCount: number
  replayLessonId: number | null
  reminded: boolean
}

export type LiveHomeState = {
  live: LiveCard | null
  upcoming: LiveCard[]
  pollMs: number
}

async function many(payload: Payload, collection: string, where?: Record<string, unknown>, options: { limit?: number; sort?: string } = {}) {
  const found = await payload.find({
    collection: col(collection),
    overrideAccess: true,
    depth: 0,
    limit: options.limit ?? 200,
    sort: options.sort,
    where: where as never,
  })
  return found.docs as unknown as Doc[]
}

async function one(payload: Payload, collection: string, where: Record<string, unknown>) {
  const rows = await many(payload, collection, where, { limit: 1 })
  return rows[0] || null
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function num(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function portalOf(payload: Payload, user: SessionUser, slug: string) {
  const portal = slug ? await loadPortal(payload, slug) : null
  if (!portal) return null
  if (user.role !== 'master' && portalIdOf(user) !== portal.id) return null
  return portal
}

function embedFor(row: Doc) {
  const source = text(row.source)
  const youtubeId = text(row.youtubeId)
  const vimeoId = text(row.vimeoId)
  const playback = text(row.muxPlaybackId)
  if (source === 'youtube' && youtubeId) return `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&controls=0&playsinline=1&rel=0&modestbranding=1`
  if (source === 'vimeo' && vimeoId) return `https://player.vimeo.com/video/${vimeoId}?autoplay=1&controls=0`
  if (source === 'mux' && playback) return muxPlaybackUrl(playback)
  return ''
}

function cardFrom(row: Doc, portal: PortalDoc, reminded: boolean, viewers: number): LiveCard {
  const door = num(row.door) || null
  const doorRow = door ? doorByNumber(door) : null
  const hostName = text(row.hostName) || 'Teacher'
  const zone = portalTimeZone(portal)
  const whenIso = text(row.startedAt) || text(row.scheduledAt)
  return {
    id: row.id,
    portalId: portal.id,
    portalSlug: text(portal.slug),
    title: text(row.title),
    door,
    doorLabel: doorRow ? doorLabel(doorRow) : '',
    hostId: idOf(row.host) || 0,
    hostName,
    hostFirst: hostFirstName(hostName),
    source: (isLiveSource(row.source) ? row.source : 'youtube') as LiveSource,
    sourceUrl: text(row.sourceUrl),
    youtubeId: text(row.youtubeId),
    vimeoId: text(row.vimeoId),
    muxStreamId: text(row.muxStreamId),
    muxStreamKey: text(row.muxStreamKey),
    muxRtmpUrl: text(row.muxRtmpUrl),
    muxPlaybackId: text(row.muxPlaybackId),
    embedUrl: embedFor(row),
    vodUrl: text(row.vodUrl),
    status: row.status === 'live' || row.status === 'ended' ? row.status : 'scheduled',
    scheduledAt: text(row.scheduledAt),
    startedAt: text(row.startedAt),
    endedAt: text(row.endedAt),
    when: liveWhenLabel(whenIso, zone),
    viewerCount: viewers,
    replayLessonId: idOf(row.replayLesson),
    reminded,
  }
}

export async function sessionById(payload: Payload, id: number) {
  if (!id) return null
  return (await payload.findByID({ collection: col('live-sessions'), id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

async function remindersFor(payload: Payload, sessionIds: number[], userId: number) {
  if (!sessionIds.length || !userId) return new Set<number>()
  const rows = await many(payload, 'live-reminders', { and: [{ session: { in: sessionIds } }, { user: { equals: userId } }] }, { limit: 200 })
  return new Set(rows.map((row) => idOf(row.session)).filter((id): id is number => Boolean(id)))
}

async function viewersFor(payload: Payload, sessionId: number, at = now()) {
  const since = new Date(at.getTime() - PRESENCE_WINDOW_MS).toISOString()
  const rows = await many(payload, 'live-presence', { and: [{ session: { equals: sessionId } }, { lastSeenAt: { greater_than_equal: since } }] }, { limit: 500 })
  return rows.length
}

export async function listSessions(payload: Payload, portal: PortalDoc, userId: number | null) {
  const rows = await many(payload, 'live-sessions', { portal: { equals: portal.id } }, { limit: 80, sort: '-createdAt' })
  const reminded = userId ? await remindersFor(payload, rows.map((row) => row.id), userId) : new Set<number>()
  const cards: LiveCard[] = []
  for (const row of rows) {
    const viewers = text(row.status) === 'live' ? await viewersFor(payload, row.id) : num(row.viewerCount)
    cards.push(cardFrom(row, portal, reminded.has(row.id), viewers))
  }
  return cards
}

export async function homeLive(payload: Payload, portal: PortalDoc, user: SessionUser | null): Promise<LiveHomeState> {
  if (!user || !canSeeLive(user.role, portalIdOf(user), portal.id)) return { live: null, upcoming: [], pollMs: LIVE_POLL_MS }
  const cards = await listSessions(payload, portal, user.id)
  const live = cards.find((card) => card.status === 'live') || null
  const upcoming = cards
    .filter((card) => card.status === 'scheduled')
    .sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))
    .slice(0, 3)
  return { live, upcoming, pollMs: LIVE_POLL_MS }
}

export async function publicCard(payload: Payload, portal: PortalDoc, session: Doc, userId: number | null): Promise<LiveCard> {
  const reminded = userId ? (await remindersFor(payload, [session.id], userId)).has(session.id) : false
  const viewers = text(session.status) === 'live' ? await viewersFor(payload, session.id) : num(session.viewerCount)
  return cardFrom(session, portal, reminded, viewers)
}

async function notify(payload: Payload, data: { user: number; portal?: number | null; title: string; body?: string; href?: string; key?: string }) {
  if (data.key) {
    const existing = await payload.find({ collection: 'notifications', overrideAccess: true, limit: 1, where: { and: [{ user: { equals: data.user } }, { key: { equals: data.key } }] } })
    if (existing.docs.length) return
  }
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { user: data.user, portal: data.portal || undefined, title: data.title, body: data.body, href: data.href || '/', channel: 'in-app', key: data.key },
  })
}

type SourceFields = {
  source: LiveSource
  sourceUrl?: string
  youtubeId?: string
  vimeoId?: string
  muxStreamId?: string
  muxStreamKey?: string
  muxRtmpUrl?: string
  muxPlaybackId?: string
}

async function resolveSource(input: { source?: string; sourceUrl?: string }): Promise<{ ok: true; fields: SourceFields } | { ok: false; error: string }> {
  const prefer = isLiveSource(input.source) ? input.source : undefined
  if (prefer === 'mux' && !input.sourceUrl?.trim()) {
    const mux = await createMuxLiveStream()
    if (!mux.ok) return { ok: false, error: mux.error }
    return {
      ok: true,
      fields: {
        source: 'mux',
        muxStreamId: mux.stream.streamId,
        muxStreamKey: mux.stream.streamKey,
        muxRtmpUrl: mux.stream.rtmpUrl,
        muxPlaybackId: mux.stream.playbackId,
      },
    }
  }
  const parsed = parseLiveSource(input.sourceUrl || '', prefer === 'mux' ? undefined : prefer)
  if (!parsed.ok) return parsed
  return {
    ok: true,
    fields: {
      source: parsed.source,
      sourceUrl: parsed.sourceUrl,
      youtubeId: parsed.source === 'youtube' ? parsed.id : undefined,
      vimeoId: parsed.source === 'vimeo' ? parsed.id : undefined,
    },
  }
}

export async function saveSession(
  payload: Payload,
  input: {
    portal: PortalDoc
    user: SessionUser
    title: string
    door?: number | null
    source?: string
    sourceUrl?: string
    when?: string
    startNow?: boolean
    seedKey?: string
  },
): Promise<{ ok: true; card: LiveCard } | { ok: false; error: string }> {
  if (!canGoLive(input.user.role, portalIdOf(input.user), input.portal.id)) {
    return { ok: false, error: 'Only a teacher or the portal admin can go live here.' }
  }
  const title = text(input.title)
  if (title.length < 3) return { ok: false, error: 'Give the session a title.' }
  const source = await resolveSource({ source: input.source, sourceUrl: input.sourceUrl })
  if (!source.ok) return source
  const at = now()
  const startNow = Boolean(input.startNow)
  const scheduled = startNow ? at : parseLiveWhen(input.when || '', at)
  if (!scheduled) return { ok: false, error: 'Say when it starts, or start it now.' }
  const hostName = text(input.user.name) || text(input.user.email)
  const created = await payload.create({
    collection: col('live-sessions'),
    overrideAccess: true,
    data: {
      portal: input.portal.id,
      title,
      door: input.door || undefined,
      host: input.user.id,
      hostName,
      ...source.fields,
      status: startNow ? 'live' : 'scheduled',
      scheduledAt: scheduled.toISOString(),
      startedAt: startNow ? at.toISOString() : undefined,
      seedKey: input.seedKey || undefined,
    } as never,
  })
  const row = created as unknown as Doc
  await audit(payload, startNow ? 'live.start' : 'live.schedule', {
    actor: input.user.id,
    actorRole: input.user.role,
    portal: input.portal.id,
    detail: { session: row.id, title, source: source.fields.source, startNow },
  })
  if (startNow) await notifyReminders(payload, input.portal, row, hostName)
  return { ok: true, card: await publicCard(payload, input.portal, row, input.user.id) }
}

export async function startSession(
  payload: Payload,
  portal: PortalDoc,
  user: SessionUser,
  id: number,
): Promise<{ ok: true; card: LiveCard } | { ok: false; error: string }> {
  if (!canGoLive(user.role, portalIdOf(user), portal.id)) return { ok: false, error: 'Only a teacher or the portal admin can go live here.' }
  const row = await sessionById(payload, id)
  if (!row || idOf(row.portal) !== portal.id) return { ok: false, error: 'That session could not be found.' }
  if (text(row.status) === 'ended') return { ok: false, error: 'That session has already ended.' }
  if (text(row.status) === 'live') return { ok: true, card: await publicCard(payload, portal, row, user.id) }
  const at = now()
  const updated = (await payload.update({
    collection: col('live-sessions'),
    id: row.id,
    overrideAccess: true,
    data: { status: 'live', startedAt: at.toISOString() } as never,
  })) as unknown as Doc
  await audit(payload, 'live.start', { actor: user.id, actorRole: user.role, portal: portal.id, detail: { session: row.id, title: text(row.title) } })
  await notifyReminders(payload, portal, updated, text(row.hostName) || text(user.name))
  return { ok: true, card: await publicCard(payload, portal, updated, user.id) }
}

async function notifyReminders(payload: Payload, portal: PortalDoc, session: Doc, hostName: string) {
  const rows = await many(payload, 'live-reminders', { session: { equals: session.id } }, { limit: 400 })
  const slug = text(portal.slug)
  for (const row of rows) {
    const userId = idOf(row.user)
    if (!userId) continue
    await notify(payload, {
      user: userId,
      portal: portal.id,
      title: `${hostFirstName(hostName)} is live`,
      body: `${text(session.title)} has started.`,
      href: `/p/${slug}/live/${session.id}`,
      key: `live-now-${session.id}-${userId}`,
    })
  }
}

async function replayDraft(payload: Payload, portal: PortalDoc, session: Doc, vodUrl: string) {
  const at = session.startedAt ? new Date(String(session.startedAt)) : now()
  const title = replayTitle(at)
  const existingCourse = await one(payload, 'courses', {
    and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }, { title: { equals: replayCourseTitle() } }],
  })
  const course =
    existingCourse ||
    ((await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title: replayCourseTitle(),
        summary: 'Draft talks from live sessions. Publish a talk, or attach it to a course, before it counts.',
        speaker: text(session.hostName),
        origin: 'local',
        portal: portal.id,
        visibility: 'draft',
        importable: false,
      } as never,
    })) as unknown as Doc)
  const existingUnit = await one(payload, 'units', { course: { equals: course.id } })
  const unit =
    existingUnit ||
    ((await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: 'From live sessions', course: course.id, order: 1 } as never,
    })) as unknown as Doc)
  const source = text(session.source)
  const lesson = (await payload.create({
    collection: 'lessons',
    overrideAccess: true,
    data: {
      title,
      unit: unit.id,
      course: course.id,
      portal: portal.id,
      master: false,
      order: Date.now() % 10_000,
      speaker: text(session.hostName),
      youtubeUrl: source === 'youtube' ? text(session.sourceUrl) : undefined,
      youtubeId: text(session.youtubeId) || undefined,
      videoProvider: source === 'vimeo' ? 'vimeo' : source === 'youtube' ? 'youtube' : undefined,
      vimeoId: text(session.vimeoId) || undefined,
      sourceUrl: vodUrl || text(session.sourceUrl),
      sourceTitle: text(session.title),
    } as never,
  })) as unknown as Doc
  return lesson.id
}

export async function endSession(
  payload: Payload,
  portal: PortalDoc,
  user: SessionUser,
  id: number,
): Promise<{ ok: true; card: LiveCard } | { ok: false; error: string }> {
  if (!canGoLive(user.role, portalIdOf(user), portal.id)) return { ok: false, error: 'Only a teacher or the portal admin can end a live session.' }
  const row = await sessionById(payload, id)
  if (!row || idOf(row.portal) !== portal.id) return { ok: false, error: 'That session could not be found.' }
  if (text(row.status) === 'ended') return { ok: true, card: await publicCard(payload, portal, row, user.id) }
  const at = now()
  const source = text(row.source)
  const vodUrl =
    source === 'youtube' || source === 'vimeo' ? text(row.sourceUrl) : source === 'mux' ? muxVodUrl(text(row.muxPlaybackId)) : ''
  let replayLessonId = idOf(row.replayLesson)
  if (!replayLessonId && vodUrl) replayLessonId = await replayDraft(payload, portal, row, vodUrl)
  const viewers = await viewersFor(payload, row.id, at)
  const updated = (await payload.update({
    collection: col('live-sessions'),
    id: row.id,
    overrideAccess: true,
    data: {
      status: 'ended',
      endedAt: at.toISOString(),
      vodUrl: vodUrl || undefined,
      viewerCount: viewers,
      replayLesson: replayLessonId || undefined,
    } as never,
  })) as unknown as Doc
  await audit(payload, 'live.end', {
    actor: user.id,
    actorRole: user.role,
    portal: portal.id,
    detail: { session: row.id, title: text(row.title), replayLesson: replayLessonId },
  })
  return { ok: true, card: await publicCard(payload, portal, updated, user.id) }
}

export async function listQuestions(payload: Payload, sessionId: number, viewer: SessionUser, staff: boolean): Promise<LiveQuestionCard[]> {
  const rows = await many(payload, 'live-questions', { session: { equals: sessionId } }, { limit: 200, sort: '-createdAt' })
  return rows
    .filter((row) => staff || row.hidden !== true)
    .sort((a, b) => Number(b.pinned === true) - Number(a.pinned === true) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .map((row) => ({
      id: row.id,
      body: text(row.body),
      authorName: staff ? text(row.authorName) || 'Learner' : hostFirstName(text(row.authorName) || 'Learner'),
      mine: idOf(row.author) === viewer.id,
      hidden: row.hidden === true,
      answered: row.answered === true,
      pinned: row.pinned === true,
      at: text(row.createdAt),
    }))
}

export async function askQuestion(
  payload: Payload,
  portal: PortalDoc,
  user: SessionUser,
  sessionId: number,
  raw: string,
): Promise<{ ok: true; question: LiveQuestionCard } | { ok: false; error: string }> {
  if (!canSeeLive(user.role, portalIdOf(user), portal.id)) return { ok: false, error: 'That live session is not for this portal.' }
  const session = await sessionById(payload, sessionId)
  if (!session || idOf(session.portal) !== portal.id) return { ok: false, error: 'That session could not be found.' }
  if (text(session.status) !== 'live') return { ok: false, error: 'Questions can be sent while it is live.' }
  const problem = questionProblem(raw)
  if (problem) return { ok: false, error: problem }
  const at = now()
  const recent = await many(payload, 'live-questions', { and: [{ session: { equals: sessionId } }, { author: { equals: user.id } }] }, { limit: 50, sort: '-createdAt' })
  const last = recent[0]
  const hourAgo = at.getTime() - 60 * 60 * 1000
  const hourCount = recent.filter((row) => new Date(String(row.createdAt || 0)).getTime() >= hourAgo).length
  const rate = questionRateProblem(last ? new Date(String(last.createdAt || 0)).getTime() : null, at.getTime(), hourCount)
  if (rate) return { ok: false, error: rate }
  const created = (await payload.create({
    collection: col('live-questions'),
    overrideAccess: true,
    data: {
      portal: portal.id,
      session: sessionId,
      author: user.id,
      authorName: text(user.name) || text(user.email),
      body: cleanQuestion(raw),
    } as never,
  })) as unknown as Doc
  return {
    ok: true,
    question: {
      id: created.id,
      body: text(created.body),
      authorName: text(created.authorName) || 'You',
      mine: true,
      hidden: false,
      answered: false,
      pinned: false,
      at: text(created.createdAt),
    },
  }
}

export async function moderateQuestion(
  payload: Payload,
  portal: PortalDoc,
  user: SessionUser,
  questionId: number,
  patch: { hidden?: boolean; answered?: boolean; pinned?: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canGoLive(user.role, portalIdOf(user), portal.id)) return { ok: false, error: 'Only the teacher can moderate questions.' }
  const row = await payload.findByID({ collection: col('live-questions'), id: questionId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!row || idOf((row as unknown as Doc).portal) !== portal.id) return { ok: false, error: 'That question could not be found.' }
  await payload.update({ collection: col('live-questions'), id: questionId, overrideAccess: true, data: patch as never })
  return { ok: true }
}

export async function setReminder(
  payload: Payload,
  portal: PortalDoc,
  user: SessionUser,
  sessionId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSeeLive(user.role, portalIdOf(user), portal.id)) return { ok: false, error: 'That session is not for this portal.' }
  const session = await sessionById(payload, sessionId)
  if (!session || idOf(session.portal) !== portal.id) return { ok: false, error: 'That session could not be found.' }
  if (text(session.status) === 'ended') return { ok: false, error: 'That session has already ended.' }
  const existing = await one(payload, 'live-reminders', { and: [{ session: { equals: sessionId } }, { user: { equals: user.id } }] })
  if (existing) return { ok: true }
  await payload.create({
    collection: col('live-reminders'),
    overrideAccess: true,
    data: { portal: portal.id, session: sessionId, user: user.id } as never,
  })
  await notify(payload, {
    user: user.id,
    portal: portal.id,
    title: 'We’ll remind you',
    body: `${text(session.title)} is coming up. We’ll tap you when it starts.`,
    href: `/p/${text(portal.slug)}/live/${sessionId}`,
    key: `live-remind-${sessionId}-${user.id}`,
  })
  return { ok: true }
}

export async function heartbeat(payload: Payload, portal: PortalDoc, user: SessionUser, sessionId: number) {
  if (!canSeeLive(user.role, portalIdOf(user), portal.id)) return 0
  const session = await sessionById(payload, sessionId)
  if (!session || idOf(session.portal) !== portal.id || text(session.status) !== 'live') return 0
  const existing = await one(payload, 'live-presence', { and: [{ session: { equals: sessionId } }, { user: { equals: user.id } }] })
  const at = now().toISOString()
  if (existing) await payload.update({ collection: col('live-presence'), id: existing.id, overrideAccess: true, data: { lastSeenAt: at } as never })
  else await payload.create({ collection: col('live-presence'), overrideAccess: true, data: { portal: portal.id, session: sessionId, user: user.id, lastSeenAt: at } as never })
  return viewersFor(payload, sessionId)
}

export function muxStatus() {
  return { configured: muxConfigured(), message: muxConfigured() ? 'Mux is ready. A stream key will be made when you go live with Mux.' : 'Mux is not configured. Paste a YouTube or Vimeo link, or add MUX_TOKEN_ID and MUX_TOKEN_SECRET.' }
}

export function questionsCsv(title: string, questions: LiveQuestionCard[]) {
  const header = ['session', 'asked', 'from', 'question', 'pinned', 'answered', 'hidden']
  const lines = [header.join(',')]
  for (const row of questions) {
    const cells = [title, row.at, row.authorName, row.body, row.pinned ? 'yes' : '', row.answered ? 'yes' : '', row.hidden ? 'yes' : '']
    lines.push(cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  }
  return `${lines.join('\n')}\n`
}

export { LIVE_POLL_MS, QUESTION_GAP_MS }
