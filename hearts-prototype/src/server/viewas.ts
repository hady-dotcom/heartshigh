import { createHash, randomUUID } from 'node:crypto'
import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { cookiesSecure } from '@/lib/env'
import { idOf, portalIdOf } from '@/lib/ids'
import { audit } from './audit'

export { audit }

export const VIEWAS_COOKIE = 'hearts_viewas'
export const IDLE_MS = 15 * 60_000
export const MAX_MS = 60 * 60_000
export const WRITE_MS = 10 * 60_000
export const MIN_REASON = 10
export const READ_ONLY = 'VIEW_AS_READ_ONLY'

type Person = { id: number; role?: string | null; name?: string | null; email?: string | null; tenants?: { tenant?: unknown }[]; removed?: boolean | null; suspendedAt?: string | null }
type Row = Record<string, unknown> & { id: number }

export type EndReason = 'exit' | 'idle-timeout' | 'max-timeout' | 'replaced' | 'actor-signed-out' | 'role-changed' | 'target-removed' | 'portal-closed'

export type ViewAs = {
  id: number
  token: string
  actorId: number
  actorRole: string
  target: Person
  targetRole: string
  portal: number | null
  reason: string
  writeEnabled: boolean
  writeUntil: number | null
  startedAt: number
  lastSeenAt: number
  expiresAt: number
  returnTo: string
  idleLeftMs: number
  maxLeftMs: number
}

export function cookieValue(header: string | null | undefined, name = VIEWAS_COOKIE) {
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

/** Secure in production, and also when the request itself is https. Plain-http local servers and test clients still receive the cookie. */
export function viewAsCookie(token: string | null, req?: Request) {
  const proto = req?.headers.get('x-forwarded-proto') || (req ? new URL(req.url).protocol.replace(':', '') : 'https')
  const secure = cookiesSecure() || proto === 'https' ? ' Secure;' : ''
  return token
    ? `${VIEWAS_COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=3600`
    : `${VIEWAS_COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=0`
}

export function hashIp(ip: string | null | undefined) {
  if (!ip) return undefined
  return createHash('sha256').update(`${process.env.PAYLOAD_SECRET || 'hearts'}:${ip}`).digest('hex').slice(0, 16)
}

/** The table in spec 6A. Returns null when allowed, or the reason it is not. */
export function refusal(actor: Person, target: Person | null) {
  if (!target) return 'There is nobody with that id.'
  if (target.id === actor.id) return 'You cannot view as yourself.'
  if (actor.role === 'master') {
    if (target.role === 'master') return 'The master cannot view as another master.'
    if (target.role === 'portal-admin' || target.role === 'learner') return null
    return 'The master can view as portal admins and learners only.'
  }
  if (actor.role === 'portal-admin') {
    if (target.role !== 'learner') return 'Portal admins can view as learners only.'
    if (!portalIdOf(actor) || portalIdOf(actor) !== portalIdOf(target)) return 'That learner is in another portal.'
    return null
  }
  return 'Your role cannot view as anyone.'
}

async function findSession(payload: Payload, token: string) {
  const found = await payload.find({ collection: 'view-as-sessions', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ token: { equals: token } }, { endedAt: { exists: false } }] }, showHiddenFields: true })
  return (found.docs[0] as unknown as Row | undefined) || null
}

export async function endSession(payload: Payload, session: Row, endReason: EndReason) {
  if (session.endedAt) return
  await payload.update({ collection: 'view-as-sessions', id: session.id, overrideAccess: true, data: { endedAt: now().toISOString(), endReason, writeEnabled: false } as never })
  await audit(payload, 'view_as.stop', {
    actor: idOf(session.actor),
    actorRole: session.actorRole as string | null | undefined,
    target: idOf(session.target),
    targetRole: session.targetRole as string | null | undefined,
    portal: idOf(session.portal) || undefined,
    sessionId: String(session.id),
    reason: session.reason as string | null | undefined,
    detail: { endReason },
  })
}

function shape(session: Row, target: Person, at: number): ViewAs {
  const startedAt = new Date(String(session.startedAt)).getTime()
  const lastSeenAt = new Date(String(session.lastSeenAt)).getTime()
  const expiresAt = new Date(String(session.expiresAt)).getTime()
  const writeUntil = session.writeUntil ? new Date(String(session.writeUntil)).getTime() : null
  return {
    id: session.id,
    token: String(session.token),
    actorId: idOf(session.actor) || 0,
    actorRole: String(session.actorRole),
    target,
    targetRole: String(session.targetRole),
    portal: idOf(session.portal),
    reason: String(session.reason || ''),
    writeEnabled: Boolean(session.writeEnabled) && Boolean(writeUntil && writeUntil > at),
    writeUntil,
    startedAt,
    lastSeenAt,
    expiresAt,
    returnTo: String(session.returnTo || '/'),
    idleLeftMs: Math.max(0, lastSeenAt + IDLE_MS - at),
    maxLeftMs: Math.max(0, expiresAt - at),
  }
}

export type LoadResult = { viewAs: ViewAs | null; ended: EndReason | null }

/**
 * Loads the actor's live session from the cookie and applies every ending rule. `touch` marks activity, which
 * resets the idle timer; status checks pass false so polling does not keep a session alive on its own.
 */
export async function loadViewAs(payload: Payload, actor: Person | null, token: string | null, touch = true): Promise<LoadResult> {
  if (!actor || !token) return { viewAs: null, ended: null }
  const session = await findSession(payload, token)
  if (!session || idOf(session.actor) !== actor.id) return { viewAs: null, ended: null }
  const at = now().getTime()
  const startedAt = new Date(String(session.startedAt)).getTime()
  const lastSeenAt = new Date(String(session.lastSeenAt)).getTime()
  let reason: EndReason | null = null
  if (at >= startedAt + MAX_MS) reason = 'max-timeout'
  else if (at > lastSeenAt + IDLE_MS) reason = 'idle-timeout'
  const target = (await payload.findByID({ collection: 'users', id: idOf(session.target) || 0, overrideAccess: true, depth: 0 }).catch(() => null)) as Person | null
  if (!reason) {
    if (!target || target.removed || target.suspendedAt) reason = 'target-removed'
    else if (actor.role !== session.actorRole || target.role !== session.targetRole) reason = 'role-changed'
  }
  if (!reason && idOf(session.portal)) {
    const portal = (await payload.findByID({ collection: 'portals', id: idOf(session.portal)!, overrideAccess: true, depth: 0 }).catch(() => null)) as { closed?: boolean } | null
    if (!portal || portal.closed) reason = 'portal-closed'
  }
  if (reason) {
    await endSession(payload, session, reason)
    return { viewAs: null, ended: reason }
  }
  const writeUntil = session.writeUntil ? new Date(String(session.writeUntil)).getTime() : null
  const patch: Record<string, unknown> = {}
  if (session.writeEnabled && writeUntil && writeUntil <= at) {
    patch.writeEnabled = false
    await audit(payload, 'view_as.write_off', { actor: actor.id, actorRole: actor.role, target: target!.id, targetRole: target!.role, portal: idOf(session.portal) || undefined, sessionId: String(session.id), reason: session.reason as string | null | undefined, detail: { why: 'time-up' } })
  }
  if (touch) patch.lastSeenAt = new Date(at).toISOString()
  const fresh = Object.keys(patch).length
    ? ((await payload.update({ collection: 'view-as-sessions', id: session.id, overrideAccess: true, data: patch as never, showHiddenFields: true })) as unknown as Row)
    : session
  return { viewAs: shape({ ...fresh, token }, target!, at), ended: null }
}

export async function startViewAs(
  payload: Payload,
  actor: Person,
  input: { targetId: number; reason: string; returnTo?: string; ip?: string | null; userAgent?: string | null },
): Promise<{ status: number; error?: string; token?: string; session?: Row }> {
  const reason = (input.reason || '').trim()
  if (reason.length < MIN_REASON || reason.length > 500) return { status: 400, error: `Give a reason of ${MIN_REASON} to 500 characters.` }
  const target = (await payload.findByID({ collection: 'users', id: input.targetId, overrideAccess: true, depth: 0 }).catch(() => null)) as Person | null
  const refused = refusal(actor, target)
  const portal = actor.role === 'master' ? portalIdOf(target) : portalIdOf(actor)
  if (refused) {
    await audit(payload, 'view_as.denied', { actor: actor.id, actorRole: actor.role, target: target?.id, targetRole: target?.role, portal: portal || undefined, reason, ipHash: hashIp(input.ip), detail: { attemptedTarget: input.targetId, why: refused } })
    return { status: 403, error: refused }
  }
  const live = await payload.find({ collection: 'view-as-sessions', overrideAccess: true, depth: 0, limit: 10, where: { and: [{ actor: { equals: actor.id } }, { endedAt: { exists: false } }] }, showHiddenFields: true })
  for (const old of live.docs as unknown as Row[]) await endSession(payload, old, 'replaced')
  const at = now()
  const token = randomUUID()
  const session = (await payload.create({
    collection: 'view-as-sessions',
    overrideAccess: true,
    data: {
      actor: actor.id,
      actorRole: actor.role,
      target: target!.id,
      targetRole: target!.role,
      portal: portal || undefined,
      reason,
      token,
      startedAt: at.toISOString(),
      lastSeenAt: at.toISOString(),
      expiresAt: new Date(at.getTime() + MAX_MS).toISOString(),
      returnTo: input.returnTo && input.returnTo.startsWith('/') && !input.returnTo.startsWith('//') ? input.returnTo : '/',
      ipHash: hashIp(input.ip),
      userAgent: (input.userAgent || '').slice(0, 200),
    } as never,
  })) as unknown as Row
  await audit(payload, 'view_as.start', { actor: actor.id, actorRole: actor.role, target: target!.id, targetRole: target!.role, portal: portal || undefined, sessionId: String(session.id), reason, ipHash: hashIp(input.ip) })
  return { status: 201, token, session }
}

export async function setWrite(payload: Payload, viewAs: ViewAs, on: boolean, reason: string) {
  const at = now()
  await payload.update({
    collection: 'view-as-sessions',
    id: viewAs.id,
    overrideAccess: true,
    data: (on ? { writeEnabled: true, writeUntil: new Date(at.getTime() + WRITE_MS).toISOString() } : { writeEnabled: false, writeUntil: null }) as never,
  })
  await audit(payload, on ? 'view_as.write_on' : 'view_as.write_off', { actor: viewAs.actorId, actorRole: viewAs.actorRole, target: viewAs.target.id, targetRole: viewAs.targetRole, portal: viewAs.portal || undefined, sessionId: String(viewAs.id), reason: on ? reason : viewAs.reason, detail: on ? { writeReason: reason } : { why: 'turned off' } })
}

/** Things a viewer may never do as the learner, whether or not changes are allowed (spec 6A). */
export const NEVER_ACTIONS = new Set(['join', 'answer', 'reply', 'start-again', 'keep-place', 'share-opening', 'delete-account', 'delete-portal', 'delete-person', 'change-email', 'change-password', 'opening-answers', 'heart-state', 'popup-answer', 'workbook-consent', 'request-delete', 'setup-totp', 'confirm-totp', 'verify-totp', 'resend-confirm', 'download-data', 'save-notify-prefs'])
export const NEVER_COLLECTIONS = new Set(['heart-states', 'opening-answers', 'answers', 'workbook-entries'])

export async function blocked(payload: Payload, viewAs: ViewAs, what: Record<string, unknown>) {
  await audit(payload, 'view_as.blocked_write', { actor: viewAs.actorId, actorRole: viewAs.actorRole, target: viewAs.target.id, targetRole: viewAs.targetRole, portal: viewAs.portal || undefined, sessionId: String(viewAs.id), reason: viewAs.reason, detail: what })
}

export async function wrote(payload: Payload, viewAs: ViewAs, what: Record<string, unknown>) {
  await audit(payload, 'view_as.write', { actor: viewAs.actorId, actorRole: viewAs.actorRole, target: viewAs.target.id, targetRole: viewAs.targetRole, portal: viewAs.portal || undefined, sessionId: String(viewAs.id), reason: viewAs.reason, detail: what })
}

/** Payload hook: every REST or admin mutation inside a view-as session is refused unless changes are allowed. */
export const viewAsGuard = async ({ operation, req, collection }: { operation: string; req: { headers?: Headers; user?: unknown; payload: Payload }; collection?: { slug?: string } }) => {
  if (!['create', 'update', 'delete', 'updateByID', 'deleteByID'].includes(operation)) return
  const token = cookieValue(req.headers?.get?.('cookie'))
  if (!token || !req.user) return
  const { viewAs } = await loadViewAs(req.payload, req.user as Person, token, false)
  if (!viewAs) return
  const slug = collection?.slug || ''
  if (!viewAs.writeEnabled || NEVER_COLLECTIONS.has(slug) || slug === 'users') {
    await blocked(req.payload, viewAs, { collection: slug, operation, via: 'rest' })
    const { APIError } = await import('payload')
    throw new APIError(READ_ONLY, 403)
  }
  await wrote(req.payload, viewAs, { collection: slug, operation, via: 'rest' })
}

/** Globals have no beforeOperation hook, so this runs before every global change: none while viewing as someone. */
export const viewAsGlobalGuard = async ({ data, req, global }: { data: Record<string, unknown>; req: { headers?: Headers; user?: unknown; payload: Payload }; global?: { slug?: string } }) => {
  const token = cookieValue(req.headers?.get?.('cookie'))
  if (!token || !req.user) return data
  const { viewAs } = await loadViewAs(req.payload, req.user as Person, token, false)
  if (!viewAs) return data
  await blocked(req.payload, viewAs, { global: global?.slug || '', operation: 'update', via: 'rest', never: true })
  const { APIError } = await import('payload')
  throw new APIError(READ_ONLY, 403)
}
