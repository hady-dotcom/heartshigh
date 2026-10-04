import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { cookiesSecure } from '@/lib/env'
import { portalIdOf } from '@/lib/ids'
import { getSession } from '@/server/context'
import { canViewInsights, fillInsightDemo, ingestEvents } from '@/server/insights'

export const dynamic = 'force-dynamic'

const DEVICE = 'hearts_device'

function newId() {
  return `d${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`.slice(0, 24)
}

async function deviceId() {
  const jar = await cookies()
  const held = jar.get(DEVICE)?.value
  if (held && /^[a-zA-Z0-9_-]{8,80}$/.test(held)) return held
  const next = newId()
  try {
    jar.set(DEVICE, next, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 400, secure: cookiesSecure() })
  } catch {
    // ignore
  }
  return next
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/master/insights'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error.slice(0, 400))
  if (notice) url.searchParams.set('notice', notice.slice(0, 400))
  return NextResponse.redirect(url, 303)
}

export async function POST(req: Request) {
  const { payload, user } = await getSession()
  const wantsJson = (req.headers.get('accept') || '').includes('application/json')
  const device = await deviceId()
  const portal = portalIdOf(user)
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = (await req.json().catch(() => null)) as { events?: unknown } | null
      const events = Array.isArray(body?.events) ? body!.events : []
      const result = await ingestEvents(payload, {
        user,
        deviceId: device,
        portalId: portal,
        events: events as never,
      })
      return NextResponse.json({ ok: true, ...result })
    }
    const form = await req.formData()
    const action = String(form.get('action') || '')
    const next = String(form.get('next') || '/master/insights')
    if (action === 'test-data') {
      if (!user || !canViewInsights(user)) return wantsJson ? NextResponse.json({ error: 'Sign in on the desk first.' }, { status: 401 }) : redirectTo(req, next, 'Sign in on the desk first.')
      const n = await fillInsightDemo(payload, user)
      return wantsJson ? NextResponse.json({ ok: true, n }) : redirectTo(req, next, undefined, `Added ${n} labelled test events on this development database.`)
    }
    return wantsJson ? NextResponse.json({ error: 'Unknown action.' }, { status: 400 }) : redirectTo(req, next, 'Unknown action.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'That did not work.'
    return wantsJson ? NextResponse.json({ error: message }, { status: 400 }) : redirectTo(req, '/master/insights', message)
  }
}
