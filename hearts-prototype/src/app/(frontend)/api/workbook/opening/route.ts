import { getSession, type SessionUser } from '@/server/context'
import { json, portalOf, readBody, viewAsRefusal } from '@/server/api'
import { catalogueCourseIds } from '@/server/opening'
import { writeOpening, type OpeningTap } from '@/server/workbook'
import { now } from '@/lib/clock'

export const dynamic = 'force-dynamic'

const KEY = /^[a-z0-9-]{1,40}$/

function cleanTaps(value: unknown): OpeningTap[] | null {
  if (!Array.isArray(value) || value.length > 12) return null
  const taps: OpeningTap[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') return null
    const { sceneKey, optionKey, answeredAt } = row as Record<string, unknown>
    if (typeof sceneKey !== 'string' || typeof optionKey !== 'string' || !KEY.test(sceneKey) || !KEY.test(optionKey)) return null
    const at = typeof answeredAt === 'number' || typeof answeredAt === 'string' ? new Date(answeredAt) : null
    taps.push({ sceneKey, optionKey, answeredAt: at && !Number.isNaN(at.getTime()) ? at.toISOString() : undefined })
  }
  return taps
}

/**
 * Spec 2.10: the one request that carries the opening off the device. It may also create the account, so the
 * learner keeps their place in the same request that starts their session. Anything other than scenesVersion,
 * taps and the account fields is ignored, including any `private` the client sends.
 */
export async function POST(req: Request) {
  const session = await getSession()
  const refused = await viewAsRefusal(session, 'workbook-opening', true)
  if (refused) return refused
  const body = await readBody(req)
  const taps = cleanTaps(body.taps)
  if (!taps) return json({ error: 'Those answers could not be read.' }, 400)
  const scenesVersion = Number(body.scenesVersion) || 1
  const { payload } = session
  const portal = await portalOf(session, req)
  if (!portal) return json({ error: 'That portal could not be found.' }, 404)
  if (portal.closed) return json({ error: 'This portal is paused at the moment.' }, 403)

  let user = session.actor
  let cookie: string | null = null
  const account = body.account as { name?: unknown; email?: unknown; password?: unknown } | undefined
  if (!user) {
    const name = String(account?.name || '').trim().slice(0, 80)
    const email = String(account?.email || '').trim().toLowerCase()
    const password = String(account?.password || '')
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Add your name and an email address.' }, 400)
    if (password.length < 8) return json({ error: 'Use at least 8 characters for the password.' }, 400)
    const existing = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 1, where: { email: { equals: email } } })
    if (existing.docs.length) return json({ error: 'That email already has an account. Sign in instead.' }, 409)
    const learnerCode = (await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ portal: { equals: portal.id } }, { role: { equals: 'learner' } }] } })).docs[0]
    await payload.create({
      collection: 'users',
      overrideAccess: true,
      data: {
        email,
        password,
        name,
        role: 'learner',
        audience: 'learner',
        accessCode: learnerCode?.id,
        courseList: await catalogueCourseIds(payload, portal),
        tenants: [{ tenant: portal.id }],
        onboarded: true,
        joinedAt: now().toISOString(),
      } as never,
    })
    const login = await payload.login({ collection: 'users', data: { email, password } })
    if (!login.token || !login.user) return json({ error: 'Your account was made but signing in failed. Try signing in.' }, 500)
    cookie = `${payload.config.cookiePrefix}-token=${login.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
    user = (await payload.findByID({ collection: 'users', id: login.user.id, overrideAccess: true, depth: 0 })) as unknown as SessionUser
  } else if (user.role !== 'learner') {
    return json({ error: 'Only learners keep an opening.' }, 403)
  }

  const result = await writeOpening(payload, user, portal.id, scenesVersion, taps)
  if (!user.onboarded) await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { onboarded: true } as never })
  const response = json({ ok: true, userId: user.id, ...result }, cookie ? 201 : 200)
  if (cookie) response.headers.append('Set-Cookie', cookie)
  return response
}
