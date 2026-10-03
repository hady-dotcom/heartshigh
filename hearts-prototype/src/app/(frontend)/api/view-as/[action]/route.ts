import { NextResponse } from 'next/server'
import { now } from '@/lib/clock'
import { getSession } from '@/server/context'
import { IDLE_MS, MAX_MS, cookieValue, endSession, setWrite, startViewAs, viewAsCookie } from '@/server/viewas'

export const dynamic = 'force-dynamic'

async function body(req: Request) {
  const type = req.headers.get('content-type') || ''
  if (type.includes('application/json')) return ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
  const form = await req.formData().catch(() => null)
  return form ? Object.fromEntries(form.entries()) : {}
}

function status(viewAs: NonNullable<Awaited<ReturnType<typeof getSession>>['viewAs']>) {
  return {
    active: true,
    target: { id: viewAs.target.id, name: viewAs.target.name || viewAs.target.email, role: viewAs.targetRole },
    writeEnabled: viewAs.writeEnabled,
    writeLeftMs: viewAs.writeUntil ? Math.max(0, viewAs.writeUntil - now().getTime()) : 0,
    idleLeftMs: viewAs.idleLeftMs,
    maxLeftMs: viewAs.maxLeftMs,
    leftMs: Math.min(viewAs.idleLeftMs, viewAs.maxLeftMs),
    idleMs: IDLE_MS,
    maxMs: MAX_MS,
    sessionId: String(viewAs.id),
    returnTo: viewAs.returnTo,
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  if (action === 'exit-redirect') {
    const { payload, viewAs } = await getSession({ touch: false })
    const target = new URL(viewAs?.returnTo || '/admin', req.url)
    if (viewAs) await endSession(payload, (await payload.findByID({ collection: 'view-as-sessions', id: viewAs.id, overrideAccess: true, depth: 0 })) as never, 'exit')
    const response = NextResponse.redirect(target, 303)
    response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  }
  if (action !== 'status') return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { viewAs, viewAsEnded } = await getSession({ touch: false })
  if (!viewAs) {
    const response = NextResponse.json({ active: false, ended: viewAsEnded })
    if (cookieValue(req.headers.get('cookie'))) response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  }
  return NextResponse.json(status(viewAs))
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params
  const session = await getSession({ touch: action === 'keepalive' })
  const { payload, actor, viewAs } = session
  if (!actor) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const input = await body(req)

  if (action === 'start') {
    if (viewAs) return NextResponse.json({ error: 'You are already viewing as someone. Exit first.' }, { status: 409 })
    const result = await startViewAs(payload, actor, {
      targetId: Number(input.targetUserId || input.target || 0),
      reason: String(input.reason || ''),
      returnTo: String(input.returnTo || req.headers.get('referer')?.replace(/^https?:\/\/[^/]+/, '') || '/'),
      ip: req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    })
    if (!result.token) return NextResponse.json({ error: result.error }, { status: result.status })
    const response = NextResponse.json({ ok: true, sessionId: String(result.session!.id) }, { status: 201 })
    response.headers.append('Set-Cookie', viewAsCookie(result.token, req))
    return response
  }

  if (action === 'clear') {
    const response = NextResponse.json({ ok: true })
    response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  }

  if (!viewAs) {
    const response = NextResponse.json({ active: false, ended: session.viewAsEnded }, { status: action === 'stop' ? 200 : 410 })
    response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  }

  if (action === 'stop') {
    const live = await payload.findByID({ collection: 'view-as-sessions', id: viewAs.id, overrideAccess: true, depth: 0 })
    await endSession(payload, live as never, 'exit')
    const response = NextResponse.json({ ok: true, returnTo: viewAs.returnTo })
    response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  }

  if (action === 'write') {
    const on = input.on === true || input.on === 'true' || input.on === 'on'
    const reason = String(input.reason || '').trim()
    if (on && reason.length < 3) return NextResponse.json({ error: 'Say why changes are needed.' }, { status: 400 })
    await setWrite(payload, viewAs, on, reason)
    return NextResponse.json({ ok: true, writeEnabled: on })
  }

  if (action === 'keepalive') return NextResponse.json(status(viewAs))

  return NextResponse.json({ error: 'Not found.' }, { status: 404 })
}
