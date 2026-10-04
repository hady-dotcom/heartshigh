import { NextResponse } from 'next/server'
import { json, portalOf, readBody, viewAsRefusal } from '@/server/api'
import { getSession } from '@/server/context'
import { LIFE_EVENTS, LIFE_NOTE_MAX } from '@/lib/compass-bank'
import { canGuide, learnerPath, saveMix, saveMonth, staffLearner, staffPortal } from '@/server/compass'
import type { SessionUser } from '@/server/context'

export const dynamic = 'force-dynamic'

const KEY = /^[a-z0-9-]{1,40}$/

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 300))
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.user) return json({ error: 'Please sign in first.' }, 401)
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  const asked = new URL(req.url).searchParams.get('learner')
  if (session.user.role === 'learner') {
    if (asked && Number(asked) !== session.user.id) return json({ error: 'That path is not yours.' }, 403)
    return json(await learnerPath(session.payload, session.user.id, String(portal.slug || '')))
  }
  if (asked) {
    const learner = (await session.payload.findByID({ collection: 'users', id: Number(asked), overrideAccess: true, depth: 0 }).catch(() => null)) as SessionUser | null
    if (!learner) return json({ error: 'That learner was not found.' }, 404)
    const detail = await staffLearner(session.payload, session.actor || session.user, learner, portal.id)
    if (!detail) return json({ error: 'That compass is not yours to open.' }, 403)
    return json(detail)
  }
  const summary = await staffPortal(session.payload, session.actor || session.user, portal.id)
  if (!summary) return json({ error: 'That compass is not yours to open.' }, 403)
  return json(summary)
}

export async function POST(req: Request) {
  const session = await getSession()
  const refused = await viewAsRefusal(session, 'compass', true)
  if (refused) return refused
  if (!session.user) return json({ error: 'Please sign in first.' }, 401)
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  const body = await readBody(req)
  const wantsJson = (req.headers.get('content-type') || '').includes('application/json')
  const fail = (message: string, status = 400) => (wantsJson ? json({ error: message }, status) : redirectTo(req, String(body.next || `/p/${portal.slug}/recalibrate`), message))
  if (String(body.action || '') === 'mix') {
    if (session.user.role === 'learner' || !canGuide(session.user, portal.id)) return fail('That mix is not yours to set.', 403)
    const saved = await saveMix(session.payload, session.user, portal.id, {
      deficit: Number(body.deficit),
      strength: Number(body.strength),
      discovery: Number(body.discovery),
    })
    if (!saved) return fail('That mix is not yours to set.', 403)
    if (wantsJson) return json({ mix: saved })
    return redirectTo(req, String(body.next || `/p/${portal.slug}/admin/compass`), undefined, 'The mix is saved.')
  }
  if (session.user.role !== 'learner') return json({ error: 'Only a learner keeps a monthly look.' }, 403)
  const formId = String(body.form || '')
  if (!KEY.test(formId)) return fail('Those answers could not be read.')
  let picks: { key: string; option: string }[] = []
  if (Array.isArray(body.picks)) {
    for (const row of body.picks) {
      if (!row || typeof row !== 'object') return fail('Those answers could not be read.')
      const key = String((row as { key?: unknown }).key || '')
      const option = String((row as { option?: unknown }).option || '')
      if (!KEY.test(key) || !KEY.test(option)) return fail('Those answers could not be read.')
      picks.push({ key, option })
    }
  } else {
    picks = Object.entries(body)
      .filter(([key]) => key !== 'life' && key !== 'lifeNote' && key !== 'form' && key !== 'next' && key !== 'portal' && !key.startsWith('life-'))
      .map(([key, value]) => ({ key, option: String(value || '') }))
      .filter((row) => KEY.test(row.key) && KEY.test(row.option))
  }
  const lifeKeys = [
    ...LIFE_EVENTS.filter((event) => body[`life-${event.key}`]).map((event) => event.key),
    ...(Array.isArray(body.lifeKeys) ? body.lifeKeys.map((key) => String(key)) : []),
    ...(body.life ? [String(body.life)] : []),
  ]
  const unknown = lifeKeys.find((key) => !LIFE_EVENTS.some((event) => event.key === key))
  if (unknown) return fail('Choose what is going on just now, or leave it.')
  const problem = await saveMonth(session.payload, session.user.id, portal.id, formId, picks, lifeKeys, String(body.lifeNote || '').slice(0, LIFE_NOTE_MAX))
  if (problem) return fail(problem)
  const summary = await learnerPath(session.payload, session.user.id, String(portal.slug || ''))
  if (wantsJson) return json(summary)
  return redirectTo(req, String(body.next || `/p/${portal.slug}/me/path`), undefined, 'Saved. Here is where to spend a little time.')
}
