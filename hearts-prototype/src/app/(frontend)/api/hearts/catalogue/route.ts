import { learnerLessonVisible, asLessonVisibility } from '@/lib/publish-state'
import { json, portalOf } from '@/server/api'
import { getSession, visibleCourseIds } from '@/server/context'
import { guestLibrary } from '@/server/guest-films'
import { idOf, portalIdOf } from '@/lib/ids'

export const dynamic = 'force-dynamic'

/** Courses and films this portal can open. Signed out, the same public list as Courses. Never a 401. */
async function guestItems(session: Awaited<ReturnType<typeof getSession>>, req: Request) {
  const portal = await portalOf(session, req)
  if (!portal) return []
  const base = `/p/${portal.slug}`
  const library = await guestLibrary(session.payload, portal.id, base)
  return [
    ...library.courses.map((course) => ({
      kind: 'course' as const,
      title: course.title,
      detail: 'Course',
      href: course.listHref,
    })),
    ...library.courses.flatMap((course) => (library.lists.get(course.id) || []).map((film) => ({
      kind: 'film' as const,
      title: film.title,
      detail: course.title,
      href: film.href,
    }))),
  ]
}

export async function GET(req: Request) {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ items: await guestItems(session, req) })
  const portalId = portalIdOf(session.user)
  if (!portalId) return json({ items: [] })
  const portal = await session.payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }).catch(() => null)
  const slug = String(portal?.slug || '')
  if (!slug) return json({ items: [] })
  const base = `/p/${slug}`
  const courseIds = await visibleCourseIds(session.payload, session.user)
  if (!courseIds.length) return json({ items: [] })
  const [courses, lessons] = await Promise.all([
    session.payload.find({ collection: 'courses', where: { id: { in: courseIds } }, depth: 0, limit: 40, overrideAccess: true }),
    session.payload.find({ collection: 'lessons', where: { course: { in: courseIds } }, depth: 0, limit: 200, sort: 'order', overrideAccess: true }),
  ])
  const titles = new Map(courses.docs.map((course) => [course.id, String(course.title || 'Course')]))
  const items = [
    ...courses.docs.map((course) => ({
      kind: 'course' as const,
      title: String(course.title || 'Course'),
      detail: 'Course',
      href: `${base}/course/${course.id}`,
    })),
    ...lessons.docs.filter((lesson) => learnerLessonVisible(asLessonVisibility(lesson))).map((lesson) => {
      const courseId = idOf(lesson.course) || 0
      return {
        kind: 'film' as const,
        title: String(lesson.title || 'Film'),
        detail: titles.get(courseId) || 'Film',
        href: `${base}/course/${courseId}?part=${lesson.id}`,
      }
    }),
  ]
  return json({ items })
}
