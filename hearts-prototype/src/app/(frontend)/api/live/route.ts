import { NextResponse } from 'next/server'
import { json, noStore, readBody } from '@/server/api'
import { getSession } from '@/server/context'
import { idOf, portalIdOf } from '@/lib/ids'
import { canGoLive, canSeeLive } from '@/lib/live'
import {
  askQuestion,
  endSession,
  heartbeat,
  homeLive,
  listQuestions,
  listSessions,
  muxStatus,
  portalOf,
  publicCard,
  questionsCsv,
  saveSession,
  sessionById,
  setReminder,
  startSession,
  moderateQuestion,
  deleteSession,
} from '@/server/live'
import { blocked, READ_ONLY } from '@/server/viewas'

export const dynamic = 'force-dynamic'

function text(value: unknown) {
  return String(value || '').trim()
}

function wantsJson(req: Request) {
  const accept = req.headers.get('accept') || ''
  const type = req.headers.get('content-type') || ''
  return accept.includes('application/json') || type.includes('application/json')
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function reply(req: Request, next: string, error?: string, notice?: string, extra?: Record<string, unknown>) {
  if (wantsJson(req)) return json({ ok: !error, error: error || null, notice: notice || null, ...extra }, error ? 400 : 200)
  return redirectTo(req, next, error, notice)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const session = await getSession()
  if (!session.user) return json({ error: 'Sign in first.' }, 401)
  const portal = await portalOf(session.payload, session.user, url.searchParams.get('portal') || '')
  if (!portal) return json({ error: 'That portal is not yours.' }, 404)
  if (!canSeeLive(session.user.role, portalIdOf(session.user), portal.id)) return json({ error: 'That live session is not for this portal.' }, 403)

  if (url.searchParams.get('export') === '1') {
    if (!canGoLive(session.user.role, portalIdOf(session.user), portal.id)) return json({ error: 'The desk export is for the portal team.' }, 403)
    const id = Number(url.searchParams.get('id') || 0)
    const row = await sessionById(session.payload, id)
    if (!row) return json({ error: 'That session could not be found.' }, 404)
    const questions = await listQuestions(session.payload, id, session.user, true)
    const csv = questionsCsv(String(row.title || 'Live session'), questions)
    return new NextResponse(csv, {
      headers: {
        ...noStore,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="live-questions-${id}.csv"`,
      },
    })
  }

  const id = Number(url.searchParams.get('id') || 0)
  if (id) {
    const row = await sessionById(session.payload, id)
    if (!row || idOf(row.portal) !== portal.id) return json({ error: 'That session could not be found.' }, 404)
    const staff = canGoLive(session.user.role, portalIdOf(session.user), portal.id)
    if (url.searchParams.get('heartbeat') === '1') await heartbeat(session.payload, portal, session.user, id)
    const card = await publicCard(session.payload, portal, row!, session.user.id)
    const questions = await listQuestions(session.payload, id, session.user, staff)
    return json({ ok: true, session: card, questions, mux: muxStatus() })
  }

  if (url.searchParams.get('desk') === '1') {
    if (!canGoLive(session.user.role, portalIdOf(session.user), portal.id)) return json({ error: 'The desk is for the portal team.' }, 403)
    const cards = await listSessions(session.payload, portal, session.user.id)
    const live = cards.find((card) => card.status === 'live') || null
    const questions = live ? await listQuestions(session.payload, live.id, session.user, true) : []
    return json({ ok: true, sessions: cards, live, questions, mux: muxStatus() })
  }

  const home = await homeLive(session.payload, portal, session.user)
  return json({ ok: true, ...home, mux: muxStatus() })
}

export async function POST(req: Request) {
  const body = await readBody(req)
  const action = text(body.action)
  const next = text(body.next) || '/'
  const session = await getSession()
  if (!session.user) return reply(req, `/login?next=${encodeURIComponent(next)}`, 'Sign in first.')
  if (session.viewAs && !session.viewAs.writeEnabled) {
    await blocked(session.payload, session.viewAs, { route: 'live', action })
    return reply(req, next, READ_ONLY === 'VIEW_AS_READ_ONLY' ? 'Read-only while viewing as someone else.' : 'Read-only.')
  }

  const user = session.user
  const payload = session.payload
  const portal = await portalOf(payload, user, text(body.portal))
  if (!portal) return reply(req, next, 'That portal is not yours.')

  if (action === 'save' || action === 'start-now') {
    const result = await saveSession(payload, {
      portal,
      user,
      title: text(body.title),
      door: Number(text(body.door)) || null,
      source: text(body.source) || undefined,
      sourceUrl: text(body.sourceUrl) || text(body.source_url),
      when: text(body.when) || text(body.scheduledAt),
      startNow: action === 'start-now' || text(body.startNow) === '1' || text(body.startNow) === 'on',
    })
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, result.card.status === 'live' ? 'You’re live. Learners on this portal can watch now.' : 'Scheduled. Learners will see it under Coming up.', { session: result.card })
  }

  if (action === 'start') {
    const result = await startSession(payload, portal, user, Number(text(body.id)))
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, 'You’re live. Learners on this portal can watch now.', { session: result.card })
  }

  if (action === 'end') {
    const result = await endSession(payload, portal, user, Number(text(body.id)))
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, result.card.replayLessonId ? 'Live ended. A replay draft is waiting in Content.' : 'Live ended.', { session: result.card })
  }

  if (action === 'question') {
    const result = await askQuestion(payload, portal, user, Number(text(body.id)), text(body.body))
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, 'Question sent.', { question: result.question })
  }

  if (action === 'moderate') {
    const result = await moderateQuestion(payload, portal, user, Number(text(body.question)), {
      hidden: text(body.hidden) === '1' ? true : text(body.hidden) === '0' ? false : undefined,
      answered: text(body.answered) === '1' ? true : text(body.answered) === '0' ? false : undefined,
      pinned: text(body.pinned) === '1' ? true : text(body.pinned) === '0' ? false : undefined,
    })
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, 'Saved.')
  }

  if (action === 'remind') {
    const result = await setReminder(payload, portal, user, Number(text(body.id)))
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, 'We’ll remind you when it starts.')
  }

  if (action === 'forget') {
    const result = await deleteSession(payload, portal, user, Number(text(body.id)))
    if (!result.ok) return reply(req, next, result.error)
    return reply(req, next, undefined, 'That session was removed.')
  }

  if (action === 'heartbeat') {
    const viewers = await heartbeat(payload, portal, user, Number(text(body.id)))
    return json({ ok: true, viewers })
  }

  return reply(req, next, 'That action is not known.')
}
