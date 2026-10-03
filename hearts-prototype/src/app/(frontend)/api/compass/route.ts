import { NextResponse } from 'next/server'
import { json, portalOf, readBody } from '@/server/api'
import { getSession } from '@/server/context'
import { learnerPath, monthMoments, recordAttempt, readingFromTaps, staffLearner, staffPortal } from '@/server/compass'
import { viewAsRefusal } from '@/server/viewas'
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
  if (session.user.role !== 'learner') return json({ error: 'Only a learner keeps a monthly look.' }, 403)
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  const body = await readBody(req)
  const wantsJson = (req.headers.get('content-type') || '').includes('application/json')
  const fail = (message: string, status = 400) => (wantsJson ? json({ error: message }, status) : redirectTo(req, String(body.next || `/p/${portal.slug}/recalibrate`), message))
  const { scenes, copy } = await monthMoments(session.payload)
  let taps: { sceneKey: string; optionKey: string }[] = []
  if (Array.isArray(body.taps)) {
    for (const row of body.taps) {
      if (!row || typeof row !== 'object') return fail('Those answers could not be read.')
      const sceneKey = String((row as { sceneKey?: unknown }).sceneKey || '')
      const optionKey = String((row as { optionKey?: unknown }).optionKey || '')
      if (!KEY.test(sceneKey) || !KEY.test(optionKey)) return fail('Those answers could not be read.')
      taps.push({ sceneKey, optionKey })
    }
  } else {
    taps = scenes.map((scene) => ({ sceneKey: scene.key, optionKey: String(body[scene.key] || '') }))
  }
  if (scenes.some((scene) => !taps.some((tap) => tap.sceneKey === scene.key && scene.options.some((option) => option.key === tap.optionKey)))) {
    return fail('Choose one answer for each moment.')
  }
  const lifeKey = String(body.life || body.lifeKey || '')
  if (lifeKey && !copy.lifeOptions.some((option) => option.key === lifeKey)) return fail('Choose what is going on just now, or leave it.')
  const scales = await readingFromTaps(session.payload, taps)
  await recordAttempt(session.payload, session.user.id, portal.id, scales, 'month', lifeKey || undefined)
  const summary = await learnerPath(session.payload, session.user.id, String(portal.slug || ''))
  if (wantsJson) return json(summary)
  return redirectTo(req, String(body.next || `/p/${portal.slug}/me/path`), undefined, 'Saved. Here is where to spend a little time.')
}
