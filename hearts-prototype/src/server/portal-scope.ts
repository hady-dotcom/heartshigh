import type { Payload } from 'payload'
import { cleanPortalScenes } from '@/lib/portal-scenes'
import { adoptedCourseIds } from './context'

/**
 * A portal keeps its own library when it has written its own opening questions,
 * or it has its own courses and has not taken anything from the HEARTS library.
 */
export async function portalOwnsLibrary(payload: Payload, portalId: number) {
  const [configs, local, adopted] = await Promise.all([
    payload.find({
      collection: 'opening-configs',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { portal: { equals: portalId } },
    }),
    payload.count({
      collection: 'courses',
      overrideAccess: true,
      where: { and: [{ portal: { equals: portalId } }, { origin: { equals: 'local' } }] },
    }),
    adoptedCourseIds(payload, portalId),
  ])
  const scenes = cleanPortalScenes(configs.docs[0]?.extraScenes).scenes.length
  return scenes > 0 || (local.totalDocs > 0 && adopted.length === 0)
}
