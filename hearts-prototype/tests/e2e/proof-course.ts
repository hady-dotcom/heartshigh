import { expect, type APIRequestContext } from '@playwright/test'

export const PROOF_COURSE = 'Ten sittings'

export async function ensureProofCourse(master: APIRequestContext, portalSlug = 'east-london', title = PROOF_COURSE) {
  const portals = (await (await master.get('/api/portals?limit=10&depth=0')).json()) as { docs: { id: number; slug?: string }[] }
  const portal = portals.docs.find((row) => row.slug === portalSlug)
  expect(portal).toBeTruthy()
  const courses = (await (await master.get('/api/courses?limit=80&depth=0')).json()) as { docs: { id: number; title?: string }[] }
  const existing = courses.docs.find((course) => course.title === title)
  const users = (await (await master.get('/api/users?limit=40&depth=0')).json()) as { docs: { id: number; email?: string; extraCourses?: unknown[] }[] }
  const learner = users.docs.find((row) => row.email === 'elm-learner@hearts.test')
  expect(learner).toBeTruthy()
  let courseId = existing?.id || 0
  if (!courseId) {
    const courseRes = await master.post('/api/courses', {
      data: {
        title,
        speaker: 'Amina Yusuf',
        origin: 'local',
        portal: portal!.id,
        importable: false,
        visibility: 'published',
        summary: 'Ten long talks for a 3, 3, 2, 2 split. Built only in the test database.',
      },
    })
    expect(courseRes.ok()).toBeTruthy()
    const course = (await courseRes.json()) as { id: number; doc?: { id: number } }
    courseId = course.doc?.id || course.id
    const unitRes = await master.post('/api/units', { data: { title: 'Talks', course: courseId, order: 1 } })
    expect(unitRes.ok()).toBeTruthy()
    const unit = (await unitRes.json()) as { id: number; doc?: { id: number } }
    const unitId = unit.doc?.id || unit.id
    const lessonIds: number[] = []
    for (const index of Array.from({ length: 10 }, (_, at) => at)) {
      const created = await master.post('/api/lessons', {
        data: {
          title: `Sitting ${index + 1}`,
          unit: unitId,
          course: courseId,
          portal: portal!.id,
          order: index + 1,
          durationSeconds: 97 * 60,
          youtubeId: 'dQw4w9WgXcQ',
          transcriptSource: 'none',
        },
      })
      expect(created.ok()).toBeTruthy()
      const body = (await created.json()) as { id: number; doc?: { id: number } }
      lessonIds.push(body.doc?.id || body.id)
    }
    for (const [index, second] of [30, 90, 150, 210].entries()) {
      await master.post('/api/engagement-points', {
        data: {
          lesson: lessonIds[0],
          second,
          kind: 'question',
          prompt: `What stayed with you from sitting 1, question ${index + 1}?`,
          status: 'approved',
        },
      })
    }
  }
  const extras = (learner!.extraCourses || []).map((item) => (typeof item === 'object' && item && 'id' in item ? Number((item as { id: number }).id) : Number(item))).filter(Boolean)
  if (!extras.includes(courseId)) {
    const grant = await master.patch(`/api/users/${learner!.id}`, { data: { extraCourses: [...new Set([...extras, courseId])] } })
    expect(grant.ok()).toBeTruthy()
  }
  const lessons = (await (await master.get(`/api/lessons?where[course][equals]=${courseId}&limit=20&depth=0&sort=order`)).json()) as { docs: { id: number; title?: string }[] }
  return { courseId, lessons: lessons.docs, portalId: portal!.id }
}
