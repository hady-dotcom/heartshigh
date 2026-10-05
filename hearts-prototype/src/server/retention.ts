import type { Payload, Where } from 'payload'
import { now } from '@/lib/clock'
import { planRetention } from '@/lib/retention'
import { audit } from './audit'
import { emptyExpiredTrash } from './trash'

type Doc = { id: number } & Record<string, unknown>

async function collectionExists(payload: Payload, slug: string) {
  return Boolean((payload.config.collections || []).some((collection) => collection.slug === slug))
}

export type RetentionResult = {
  id: string
  collection: string
  mode: string
  removed: number
  asked: number
  skipped?: string
}

export async function runRetention(payload: Payload, actor?: { id: number; role?: string | null } | null) {
  const when = now()
  const plan = planRetention(when)
  const results: RetentionResult[] = []

  for (const item of plan) {
    if (item.mode === 'empty-trash') {
      const removed = await emptyExpiredTrash(payload)
      results.push({ id: item.id, collection: item.collection, mode: item.mode, removed, asked: 0 })
      continue
    }

    if (!(await collectionExists(payload, item.collection))) {
      results.push({ id: item.id, collection: item.collection, mode: item.mode, removed: 0, asked: 0, skipped: item.optional ? 'collection not on this branch' : 'collection missing' })
      continue
    }
    const where: Where = {
      and: [{ [item.dateField]: { less_than: item.before } }, ...(item.extraWhere ? [item.extraWhere as Where] : [])],
    }

    if (item.mode === 'clear-ip') {
      const found = await payload.find({ collection: item.collection as never, overrideAccess: true, depth: 0, limit: 200, where })
      let removed = 0
      for (const row of found.docs as Doc[]) {
        if (!(row as { ipHash?: string }).ipHash) continue
        await payload.update({ collection: item.collection as never, id: row.id, overrideAccess: true, data: { ipHash: null } as never })
        removed += 1
      }
      results.push({ id: item.id, collection: item.collection, mode: item.mode, removed, asked: 0 })
      continue
    }

    if (item.mode === 'ask-master') {
      const found = await payload.find({ collection: item.collection as never, overrideAccess: true, depth: 0, limit: 50, where })
      for (const row of found.docs as Doc[]) {
        await payload.create({
          collection: 'ops-events' as never,
          overrideAccess: true,
          data: {
            kind: 'closed-portal',
            ok: true,
            at: when.toISOString(),
            portal: row.id,
            detail: { name: row.name, slug: row.slug, message: 'This portal has been closed for 90 days. Wipe it, or keep it on purpose.' },
          } as never,
        })
      }
      results.push({ id: item.id, collection: item.collection, mode: item.mode, removed: 0, asked: found.docs.length })
      continue
    }

    const found = await payload.find({ collection: item.collection as never, overrideAccess: true, depth: 0, limit: 200, where })
    let removed = 0
    for (const row of found.docs as Doc[]) {
      if (item.id === 'audit-log' && item.mode === 'delete') {
        await payload.delete({ collection: item.collection as never, id: row.id, overrideAccess: true })
        removed += 1
      } else if (item.collection !== 'portals') {
        await payload.delete({ collection: item.collection as never, id: row.id, overrideAccess: true })
        removed += 1
      }
    }
    results.push({ id: item.id, collection: item.collection, mode: item.mode, removed, asked: 0 })
  }

  await payload.create({
    collection: 'ops-events' as never,
    overrideAccess: true,
    data: { kind: 'retention', ok: true, at: when.toISOString(), detail: { results } } as never,
  })
  if (actor) {
    await audit(payload, 'retention.run', { actor, actorRole: actor.role, detail: { results } })
  }
  return results
}
