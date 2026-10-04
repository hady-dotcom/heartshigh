import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const PHONE = { width: 390, height: 844 }
const SHOTS = path.join(process.cwd(), 'test-results', 'planner-shots')

let master: APIRequestContext

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true })
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

async function json<T>(pathName: string) {
  return (await (await master.get(pathName)).json()) as T
}

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('planner shots', () => {
  test('before and after at 390x844: bunched first week, then spaced across the span', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const portals = await json<{ docs: { id: number; slug?: string }[] }>('/api/portals?limit=10&depth=0')
    const portal = portals.docs.find((row) => row.slug === PORTAL)
    expect(portal).toBeTruthy()
    const users = await json<{ docs: { id: number; email?: string; extraCourses?: unknown[] }[] }>('/api/users?limit=40&depth=0')
    const learner = users.docs.find((row) => row.email === 'elm-learner@hearts.test')
    expect(learner).toBeTruthy()
    const courseRes = await master.post('/api/courses', {
      data: {
        title: 'Three sittings',
        speaker: 'Amina Yusuf',
        origin: 'local',
        portal: portal!.id,
        importable: false,
        visibility: 'published',
        summary: 'Three short talks for a spaced plan.',
      },
    })
    expect(courseRes.ok()).toBeTruthy()
    const course = (await courseRes.json()) as { id: number; doc?: { id: number } }
    const courseId = course.doc?.id || course.id
    const unitRes = await master.post('/api/units', { data: { title: 'Sittings', course: courseId, order: 1 } })
    expect(unitRes.ok()).toBeTruthy()
    const unit = (await unitRes.json()) as { id: number; doc?: { id: number } }
    const unitId = unit.doc?.id || unit.id
    const lessons: { id: number; title: string }[] = []
    for (const [index, title] of ['Lesson 1', 'Lesson 2', 'Lesson 3'].entries()) {
      const created = await master.post('/api/lessons', {
        data: { title, unit: unitId, course: courseId, portal: portal!.id, order: index + 1, durationSeconds: 480, transcriptSource: 'none' },
      })
      expect(created.ok()).toBeTruthy()
      const body = (await created.json()) as { id: number; doc?: { id: number } }
      lessons.push({ id: body.doc?.id || body.id, title })
    }
    const extras = (learner!.extraCourses || []).map((item) => (typeof item === 'object' && item && 'id' in item ? Number((item as { id: number }).id) : Number(item))).filter(Boolean)
    const grant = await master.patch(`/api/users/${learner!.id}`, { data: { extraCourses: [...new Set([...extras, courseId])] } })
    expect(grant.ok()).toBeTruthy()
    const bunched = ['2026-10-04', '2026-10-05', '2026-10-06']
    const scheduleRes = await master.post('/api/schedules', {
      data: {
        name: 'Three sittings',
        owner: learner!.id,
        learners: [learner!.id],
        targetType: 'course',
        course: courseId,
        startDate: '2026-10-04',
        endDate: '2026-10-15',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        minutesPerDay: 20,
        portal: portal!.id,
        slots: lessons.map((lesson, index) => ({ date: bunched[index], title: lesson.title, lessonId: lesson.id })),
      },
    })
    expect(scheduleRes.ok()).toBeTruthy()
    await signIn(page, `${BASE}/week`)
    await expect(page.getByTestId('schedule-plan')).toBeVisible()
    const beforeDates = await page.getByTestId('schedule-slot').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-date')))
    expect(beforeDates).toEqual(bunched)
    await page.screenshot({ path: path.join(SHOTS, 'planner-before-390x844.png'), fullPage: false })
    await page.getByTestId('schedule-plan').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(SHOTS, 'planner-before-list-390x844.png'), fullPage: false })
    await page.goto(`${BASE}/week?course=${courseId}&view=new&start=2026-10-04&end=2026-10-15&days=0,1,2,3,4,5,6&minutes=20`)
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('spread-note')).toContainText('spaced across the span')
    const afterDates = await page.getByTestId('schedule-slot').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-date')))
    expect(afterDates).toEqual(['2026-10-04', '2026-10-08', '2026-10-12'])
    await page.screenshot({ path: path.join(SHOTS, 'planner-after-390x844.png'), fullPage: false })
    await page.getByTestId('schedule-plan').first().scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(SHOTS, 'planner-after-list-390x844.png'), fullPage: false })
  })
})
