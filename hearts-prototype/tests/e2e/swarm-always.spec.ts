import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { E2E_BASE } from '../env'
import { openReachedQuestion } from './question-moment'

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function as(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function doc(api: APIRequestContext, collection: string, where: string) {
  const body = await json(await api.get(`/api/${collection}?${where}&depth=0&limit=5`))
  return (body.docs || []) as { id: number; course?: number; title?: string }[]
}

test('Who Is Truly Nurturing You shows What others said without a sharing opt-in', async ({ page }) => {
  const master = await as('master@hearts.test', 'hearts-master')
  const lessons = await doc(master, 'lessons', 'where[youtubeId][equals]=ECaTWkof57E')
  const lesson = lessons[0]
  expect(lesson, 'the nurturing talk').toBeTruthy()
  const courseId = Number(lesson.course)
  const parts = await doc(master, 'lessons', `where[course][equals]=${courseId}&sort=order`)
  const part = parts.length >= 2 ? parts[1] : lesson
  const points = await doc(master, 'engagement-points', `where[lesson][equals]=${part.id}&sort=second`)
  await master.dispose()
  expect(points.length, 'questions on that part').toBeGreaterThan(0)
  const question = points.length >= 2 ? 1 : 0

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/login?next=${encodeURIComponent(`/p/east-london/course/${courseId}?part=${part.id}`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('course')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('course')).toContainText(/Ar-Rabb|Nurturing/i)
  await openReachedQuestion(page, question)
  await expect(page.getByTestId('swarm')).toBeVisible()
  await expect(page.getByTestId('swarm-item').first()).toBeVisible()
  const initials = (await page.getByTestId('swarm-initials').first().innerText()).trim()
  expect(initials.length).toBeGreaterThan(0)
  expect(initials.length).toBeLessThanOrEqual(3)
  expect(initials).not.toMatch(/\s/)
  await expect(page.getByTestId('answer-share-learners')).toHaveCount(0)
})
