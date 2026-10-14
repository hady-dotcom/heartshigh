import type { Payload } from 'payload'
import { portalIdOf } from '@/lib/ids'
import {
  DEMO_STAGE_SLUG,
  demoWriteDecision,
  eventsAfter,
  isDemoStageEmail,
  type DemoEvent,
  type DemoSlot,
} from '@/lib/demo-stage'
import type { SessionUser } from './context'

const portalCache = new Map<number, boolean>()

export function clearDemoPortalCache() {
  portalCache.clear()
}

export async function portalIsDemo(payload: Payload, id: number | null | undefined) {
  if (!id) return false
  const cached = portalCache.get(id)
  if (cached != null) return cached
  const doc = (await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)) as { isDemo?: boolean } | null
  const flag = Boolean(doc?.isDemo)
  portalCache.set(id, flag)
  return flag
}

export async function findDemoPortal(payload: Payload) {
  const found = await payload.find({
    collection: 'portals',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ slug: { equals: DEMO_STAGE_SLUG } }, { isDemo: { equals: true } }] },
  })
  return (found.docs[0] as { id: number; slug?: string; isDemo?: boolean; name?: string; features?: Record<string, boolean> | null; demoActivity?: DemoEvent[] } | undefined) || null
}

function asEvents(value: unknown): DemoEvent[] {
  if (!Array.isArray(value)) return []
  return value.filter((row): row is DemoEvent => {
    if (!row || typeof row !== 'object') return false
    const event = row as DemoEvent
    return typeof event.id === 'number' && typeof event.text === 'string' && typeof event.slot === 'string'
  })
}

export async function appendDemoActivity(
  payload: Payload,
  event: { slot: DemoSlot; kind: string; text: string },
) {
  const portal = await findDemoPortal(payload)
  if (!portal) return null
  const current = asEvents(portal.demoActivity)
  const id = current.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1
  const next: DemoEvent[] = [...current, { id, slot: event.slot, kind: event.kind, text: event.text, at: Date.now() }].slice(-80)
  await payload.update({ collection: 'portals', id: portal.id, overrideAccess: true, data: { demoActivity: next } as never })
  clearDemoPortalCache()
  return next[next.length - 1]
}

export async function listDemoActivity(payload: Payload, since: number) {
  const portal = await findDemoPortal(payload)
  return eventsAfter(asEvents(portal?.demoActivity), since)
}

export async function refuseDemoWrite(
  payload: Payload,
  user: SessionUser,
  action: string,
  form: { get(key: string): unknown },
) {
  if (!isDemoStageEmail(user.email)) return null
  const demo = await findDemoPortal(payload)
  if (!demo?.id) return 'The demo stage portal is not ready.'
  const slug = String(form.get('portalSlug') || '').trim()
  const namedId = Number(form.get('portal') || 0) || null
  let targetId: number | null = namedId
  let targetIsDemo = false
  if (slug) {
    const found = await payload.find({
      collection: 'portals',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { slug: { equals: slug } },
    })
    const doc = found.docs[0] as { id: number; isDemo?: boolean } | undefined
    targetId = doc?.id ?? null
    targetIsDemo = Boolean(doc?.isDemo)
  } else if (targetId) {
    targetIsDemo = await portalIsDemo(payload, targetId)
  } else {
    targetId = portalIdOf(user)
    targetIsDemo = Boolean(targetId && targetId === demo.id)
  }
  const decision = demoWriteDecision({
    action,
    actorIsDemo: true,
    actorRole: user.role,
    targetPortalId: targetId,
    targetIsDemo,
    demoPortalId: demo.id,
    origin: String(form.get('origin') || ''),
  })
  if (decision === 'refuse') return 'Demo stage accounts only change the HEARTS Demo portal.'
  return null
}
