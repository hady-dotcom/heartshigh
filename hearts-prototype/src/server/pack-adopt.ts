import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'

/** Link a master pack to a portal if it is not already there. Portal-owned packs are left alone. */
export async function ensurePackAdopted(payload: Payload, portalId: number, packId: number) {
  if (!Number.isInteger(portalId) || portalId <= 0 || !Number.isInteger(packId) || packId <= 0) return false
  const pack = await payload.findByID({ collection: 'packs', id: packId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!pack || (pack as { owner?: string }).owner !== 'master') return false
  const already = await payload.find({
    collection: 'adoptions',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ portal: { equals: portalId } }, { pack: { equals: packId } }] },
  })
  if (already.docs.length) return true
  await payload.create({
    collection: 'adoptions',
    overrideAccess: true,
    data: { kind: 'pack', portal: portalId, pack: packId },
  })
  return true
}

/** Portals that already hand out a pack via a join code should have that pack adopted. */
export async function adoptPacksOnAccessCodes(payload: Payload) {
  const codes = await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 400,
  })
  let linked = 0
  for (const code of codes.docs as { portal?: unknown; packs?: unknown[] }[]) {
    const portal = idOf(code.portal)
    if (!portal) continue
    for (const pack of code.packs || []) {
      const packId = idOf(pack)
      if (packId && (await ensurePackAdopted(payload, portal, packId))) linked += 1
    }
  }
  return linked
}
