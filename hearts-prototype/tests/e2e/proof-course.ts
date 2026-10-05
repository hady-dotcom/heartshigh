import { expect, type APIRequestContext } from '@playwright/test'

export const PROOF_COURSE = 'Ten sittings'

function allowTestFixture() {
  const db = process.env.DATABASE_URL || ''
  return process.env.HEARTS_E2E === '1' || process.env.HEARTS_TEST_CLOCK === '1' || /hearts-test|hearts_[^\s]*e2e|_e2e/.test(db)
}

export async function ensureProofCourse(master: APIRequestContext, portalSlug = 'east-london', title = PROOF_COURSE) {
  if (!allowTestFixture()) throw new Error('Ten sittings is a test fixture and is never planted in a demo portal.')
  const portals = (await (await master.get('/api/portals?limit=10&depth=0')).json()) as { docs: { id: number; slug?: string }[] }
  const portal = portals.docs.find((row) => row.slug === portalSlug)
  expect(portal).toBeTruthy()
  const courses = (await (await master.get('/api/courses?limit=80&depth=0')).json()) as { docs: { id: number; title?: string }[] }
  const existing = courses.docs.find((course) => course.title === title)
  const users = (await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent('elm-learner@hearts.test')}&limit=1&depth=0`)).json()) as { docs: { id: number; email?: string; extraCourses?: unknown[] }[] }
  const learner = users.docs[0]
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
    for (const index of Array.from({ length: 10 }, (_, at) => at)) {
      const created = await master.post('/api/lessons', {
        data: {
          title: `Sitting ${index + 1}`,
          unit: unitId,
          course: courseId,
          portal: portal!.id,
          order: index + 1,
          durationSeconds: 97 * 60,
          youtubeId: 'xxTESTFAKEid',
          transcriptSource: 'none',
        },
      })
      expect(created.ok()).toBeTruthy()
    }
  }
  const extras = (learner!.extraCourses || []).map((item) => (typeof item === 'object' && item && 'id' in item ? Number((item as { id: number }).id) : Number(item))).filter(Boolean)
  if (!extras.includes(courseId)) {
    const grant = await master.patch(`/api/users/${learner!.id}`, { data: { extraCourses: [...new Set([...extras, courseId])] } })
    expect(grant.ok()).toBeTruthy()
  }
  const lessons = (await (await master.get(`/api/lessons?where[course][equals]=${courseId}&limit=20&depth=0&sort=order`)).json()) as { docs: { id: number; title?: string }[] }
  const firstLesson = lessons.docs[0]
  if (firstLesson) {
    const points = (await (await master.get(`/api/engagement-points?where[lesson][equals]=${firstLesson.id}&limit=10&depth=0`)).json()) as { docs: { id: number }[] }
    if (!points.docs.length) {
      for (const [index, second] of [30, 90, 150, 210].entries()) {
        const point = await master.post('/api/engagement-points', {
          data: {
            lesson: firstLesson.id,
            second,
            kind: 'question',
            prompt: `What stayed with you from sitting 1, question ${index + 1}?`,
            status: 'published',
            audience: 'everyone',
          },
        })
        expect(point.ok()).toBeTruthy()
      }
    }
  }
  return { courseId, lessons: lessons.docs, portalId: portal!.id }
}
