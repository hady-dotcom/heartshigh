import { idOf } from './ids'

/**
 * A course belongs on a portal's learner screens only when it lives on that portal,
 * or it is a library course this portal has adopted.
 * A local course from another portal never crosses, even for a master viewing this portal.
 */
export function courseOnPortal(
  course: { id?: number; origin?: string | null; portal?: unknown },
  portalId: number,
  adopted: ReadonlySet<number>,
) {
  const home = idOf(course.portal)
  if (course.origin === 'local') return home === portalId
  if (home === portalId) return true
  return course.id != null && adopted.has(course.id)
}
