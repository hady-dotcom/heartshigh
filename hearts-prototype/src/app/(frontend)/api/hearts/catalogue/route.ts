import { learnerLessonVisible, asLessonVisibility } from '@/lib/publish-state'
import { json } from '@/server/api'
import { getSession, visibleCourseIds } from '@/server/context'
import { idOf, portalIdOf } from '@/lib/ids'

export const dynamic = 'force-dynamic'

/** Courses and films the signed-in learner can open. The search field filters this list on the phone. */
export async function GET() {
  const session = await getSession({ touch: false })
  if (!session.user) return json({ items: [] }, 401)
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
