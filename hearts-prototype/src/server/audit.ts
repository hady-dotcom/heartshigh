import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import {
  changedFieldNames,
  eventForStaffChange,
  isAuditedCollection,
  safeAuditDetail,
  SECRET_FIELDS,
} from '@/lib/audit-events'
import { idOf, portalIdOf } from '@/lib/ids'

type ActorLike = { id?: number | null; role?: string | null } | number | string | null | undefined

export type AuditInput = {
  actor?: ActorLike
  actorRole?: string | null
  target?: ActorLike
  targetRole?: string | null
  portal?: unknown
  sessionId?: string
  reason?: string | null
  detail?: Record<string, unknown> | null
  ipHash?: string
  at?: string
}

type ReqLike = {
  user?: { id?: number; role?: string | null } | null
  payload?: Payload
  context?: Record<string, unknown>
}

function personId(value: ActorLike) {
  if (value == null) return undefined
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value && !Number.isNaN(Number(value))) return Number(value)
  if (typeof value === 'object') return idOf(value) || undefined
  return undefined
}

function personRole(value: ActorLike, fallback?: string | null) {
  if (value && typeof value === 'object' && 'role' in value && value.role) return String(value.role)
  return fallback || undefined
}

export function skipAudit(req?: ReqLike | null) {
  return Boolean(req?.context?.skipAudit)
}

export function markSkipAudit(req?: ReqLike | null) {
  if (!req) return
  req.context = { ...(req.context || {}), skipAudit: true }
}

const pendingWrites: Promise<void>[] = []

/** Run after the current request's transaction has committed, so a new user or pack is visible to the audit row. */
export function enqueueAudit(work: () => Promise<void>) {
  const task = new Promise<void>((resolve) => {
    setImmediate(() => {
      Promise.resolve()
        .then(work)
        .catch((error) => {
          console.error('audit write failed', error)
        })
        .finally(resolve)
    })
  })
  pendingWrites.push(task)
}

export async function flushAuditWrites() {
  while (pendingWrites.length) await pendingWrites.shift()
}

/** One row in the audit log. Callers from view-as, feedback and the sheet keep the same arguments. */
export async function audit(payload: Payload, event: string, fields: AuditInput & Record<string, unknown> = {}) {
  const actor = personId(fields.actor as ActorLike)
  const target = personId(fields.target as ActorLike)
  const portal = idOf(fields.portal) || undefined
  const detail = safeAuditDetail((fields.detail as Record<string, unknown>) || undefined)
  try {
    await payload.create({
      collection: 'audit-log',
      overrideAccess: true,
      data: {
        event,
        actor,
        actorRole: personRole(fields.actor as ActorLike, fields.actorRole) || undefined,
        target,
        targetRole: personRole(fields.target as ActorLike, fields.targetRole) || undefined,
        portal,
        sessionId: fields.sessionId || undefined,
        reason: fields.reason || undefined,
        at: fields.at || now().toISOString(),
        ipHash: fields.ipHash || undefined,
        detail,
      } as never,
    })
  } catch (error) {
    console.error('audit write failed', error)
  }
}

function isStaff(user?: { role?: string | null } | null) {
  return user?.role === 'master' || user?.role === 'portal-admin' || user?.role === 'teacher'
}

function portalFromDoc(doc: Record<string, unknown> | null | undefined, user?: { tenants?: { tenant?: unknown }[] } | null, slug?: string) {
  if (slug === 'portals' && doc?.id) return Number(doc.id) || undefined
  return idOf(doc?.portal) || portalIdOf(user || null) || undefined
}

function learnerSelfEdit(req: ReqLike | undefined, doc: Record<string, unknown> | null | undefined) {
  const user = req?.user
  if (!user?.id || !doc) return false
  if (user.role !== 'learner') return false
  return Number(doc.id) === Number(user.id)
}

/** Wipe keeps the event and the portal, and drops the person's name. */
export async function pseudonymiseAuditForUser(payload: Payload, userId: number) {
  const found = await payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 0,
    limit: 500,
    where: { or: [{ actor: { equals: userId } }, { target: { equals: userId } }] },
  })
  for (const row of found.docs as { id: number; actor?: unknown; target?: unknown; detail?: Record<string, unknown> }[]) {
    const actorGone = idOf(row.actor) === userId
    const targetGone = idOf(row.target) === userId
    const detail = { ...(row.detail || {}) }
    if (actorGone) detail.actorWiped = true
    if (targetGone) detail.targetWiped = true
    await payload.update({
      collection: 'audit-log',
      id: row.id,
      overrideAccess: true,
      data: {
        actor: actorGone ? null : row.actor,
        target: targetGone ? null : row.target,
        detail,
      } as never,
    })
  }
  return found.docs.length
}

export async function staffAuditAfterChange(args: {
  doc: Record<string, unknown>
  previousDoc?: Record<string, unknown>
  operation: string
  req?: ReqLike
  collection?: { slug?: string }
}) {
  const req = args.req
  if (skipAudit(req)) return
  const user = req?.user
  if (!isStaff(user)) return
  const slug = args.collection?.slug || ''
  if (!isAuditedCollection(slug)) return
  if (learnerSelfEdit(req, args.doc)) return
  const payload = req?.payload
  if (!payload) return
  const fields = changedFieldNames(args.previousDoc, args.doc)
  if (args.operation === 'update' && !fields.length) return
  if (SECRET_FIELDS.has('password') && fields.length === 1 && fields[0] === 'password' && !isStaff(user)) return
  const event = eventForStaffChange(slug, args.operation === 'create' ? 'create' : 'update', fields)
  const target = slug === 'users' ? args.doc : undefined
  const row = {
    actor: user,
    actorRole: user?.role,
    target,
    targetRole: target ? String(target.role || '') : undefined,
    portal: portalFromDoc(args.doc, user as { tenants?: { tenant?: unknown }[] }, slug),
    detail: { fields, collection: slug, id: args.doc.id },
  }
  enqueueAudit(() => audit(payload, event, row))
}

export async function staffAuditAfterDelete(args: {
  doc: Record<string, unknown>
  req?: ReqLike
  collection?: { slug?: string }
}) {
  const req = args.req
  if (skipAudit(req)) return
  const user = req?.user
  if (!isStaff(user)) return
  const slug = args.collection?.slug || ''
  if (!isAuditedCollection(slug)) return
  const payload = req?.payload
  if (!payload) return
  enqueueAudit(() => audit(payload, eventForStaffChange(slug, 'delete', []), {
    actor: user,
    actorRole: user?.role,
    target: slug === 'users' ? args.doc : undefined,
    targetRole: slug === 'users' ? String(args.doc.role || '') : undefined,
    portal: portalFromDoc(args.doc, user as { tenants?: { tenant?: unknown }[] }, slug),
    detail: { collection: slug, id: args.doc.id },
  }))
}
