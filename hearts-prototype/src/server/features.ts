import type { Payload } from 'payload'
import { FEATURE_UNAVAILABLE, featureOn, type FeatureKey, type FeatureSource } from '@/lib/features'
import { json } from './api'
import { idOf } from '@/lib/ids'
import { presentPortal } from '@/lib/portal-public'
import type { PortalDoc } from './context'

export { adoptPacksOnAccessCodes, ensurePackAdopted } from './pack-adopt'

export function refuseFeature(portal: FeatureSource, key: FeatureKey) {
  return featureOn(portal, key) ? null : FEATURE_UNAVAILABLE
}

export function featureGoneJson(portal: FeatureSource, key: FeatureKey) {
  const error = refuseFeature(portal, key)
  return error ? json({ error }, 404) : null
}

export async function adoptLibraryCourses(
  payload: Payload,
  portalId: number,
  courseIds: number[],
  sync = false,
) {
  const unique = [...new Set(courseIds.filter((id) => Number.isFinite(id) && id > 0))]
  const library = unique.length
    ? await payload.find({
        collection: 'courses',
        overrideAccess: true,
        depth: 0,
        limit: unique.length,
        where: { and: [{ id: { in: unique } }, { origin: { equals: 'master' } }, { importable: { not_equals: false } }] },
      })
    : { docs: [] as { id: number }[] }
  const allowed = new Set(library.docs.map((course) => course.id))
  const want = unique.filter((id) => allowed.has(id))
  const existing = await payload.find({
    collection: 'adoptions',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    where: { and: [{ portal: { equals: portalId } }, { kind: { equals: 'course' } }] },
  })
  const have = new Map<number, number>()
  for (const row of existing.docs as { id: number; course?: unknown }[]) {
    const courseId = idOf(row.course)
    if (courseId) have.set(courseId, row.id)
  }
  for (const courseId of want) {
    if (have.has(courseId)) continue
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: { kind: 'course', portal: portalId, course: courseId },
    })
  }
  if (sync) {
    for (const [courseId, adoptionId] of have) {
      if (want.includes(courseId)) continue
      await payload.delete({ collection: 'adoptions', id: adoptionId, overrideAccess: true }).catch(() => undefined)
    }
  }
  return want.length
}

export async function loadPortalById(payload: Payload, id: number): Promise<PortalDoc | null> {
  const doc = await payload.findByID({ collection: 'portals', id, overrideAccess: true, depth: 0 }).catch(() => null)
  return doc ? presentPortal(doc as PortalDoc) : null
}
