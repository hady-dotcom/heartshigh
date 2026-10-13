import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { E2E_BASE } from '../env'

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function as(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function doc(api: APIRequestContext, collection: string, where: string) {
  const body = await json(await api.get(`/api/${collection}?${where}&depth=0&limit=1`))
  return (body.docs?.[0] as { id: number; lesson?: number } | undefined) || null
}

test('a teacher sees typed answers that were shared, not private ones, and a new-answers count', async ({ page }) => {
  const token = `teacher-typed-${Date.now()}`
  const older = `${token} older note`
  const newer = `${token} newer note`
  const kept = `${token} private note`
  const master = await as('master@hearts.test', 'hearts-master')
  const learnerUser = await doc(master, 'users', 'where[email][equals]=elm-learner@hearts.test')
  expect(learnerUser, 'learner').toBeTruthy()
  const existing = await json(await master.get(`/api/answers?where[user][equals]=${learnerUser!.id}&depth=0&limit=200`))
  const answered = new Set(((existing.docs || []) as { point?: number }[]).map((row) => row.point))
  const points = ((await json(await master.get('/api/engagement-points?where[status][not_equals]=rejected&depth=0&limit=40'))).docs || []) as { id: number }[]
  const fresh = points.filter((point) => !answered.has(point.id))
  expect(fresh.length).toBeGreaterThanOrEqual(3)
  await master.dispose()

  const learner = await as('elm-learner@hearts.test', 'portal-learner')
  const plan: [string, boolean][] = [[older, true], [newer, true], [kept, false]]
  let saved = 0
  let waited = false
  for (const point of fresh) {
    if (saved >= plan.length) break
    if (saved === 1 && !waited) {
      await new Promise((resolve) => setTimeout(resolve, 1100))
      waited = true
    }
    const [body, share] = plan[saved]
    const response = await learner.post('/api/answers', {
      headers: { accept: 'application/json' },
      data: { pointId: point.id, body, keepPrivate: !share, shareWithTeacher: share },
    })
    if (!response.ok()) continue
    const created = await json(response)
    expect(created.answerId, body).toBeTruthy()
    saved += 1
  }
  await learner.dispose()
  expect(saved, 'three questions the learner can answer').toBe(3)

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/login?next=/p/east-london/admin')
  await page.getByTestId('login-email').fill('elm-teacher@hearts.test')
  await page.getByTestId('login-password').fill('portal-teacher')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('admin-overview')).toBeVisible({ timeout: 30_000 })
  const count = Number(await page.getByTestId('new-answers-count').textContent())
  expect(count).toBeGreaterThan(0)
  await expect(page.getByTestId('new-answers-badge')).toBeVisible()
  await expect(page.getByTestId('nav-teach')).toContainText(String(count))
  await expect(page.getByTestId('nav-teach')).toHaveAttribute('href', /\/admin\/answers\/\d+$/)
  const placed = page.getByTestId('new-answer-link').filter({ hasText: newer })
  await expect(placed).toBeVisible()
  await expect(placed.getByTestId('new-answer-place')).toContainText('·')
  await expect(page.getByTestId('new-answers')).not.toContainText(kept)
  await placed.click()
  await expect(page).toHaveURL(/\/admin\/teach\?answer=\d+/)
  await expect(page.locator('[data-testid="shared-answer"][data-focused="yes"]')).toBeVisible()
  await expect(page.locator('[data-testid="shared-answer"][data-focused="yes"]')).toContainText(newer)
  await expect(page.locator('[data-testid="shared-answer"][data-focused="yes"] [data-testid="shared-answer-question"]')).toBeVisible()
  await expect(page.locator('[data-testid="shared-answer"][data-focused="yes"] [data-testid="shared-answer-place"]')).toContainText('·')
  await expect(page.getByTestId('new-answers-badge')).toHaveCount(0)

  await page.goto('/p/east-london/admin/teach')
  await expect(page.getByTestId('admin-teach')).toBeVisible()
  await expect(page.getByTestId('shared-answers')).toContainText(older)
  await expect(page.getByTestId('shared-answers')).toContainText(newer)
  await expect(page.getByTestId('shared-answers')).not.toContainText(kept)
  await expect(page.getByTestId('admin-teach')).not.toContainText(kept)
  const texts = await page.getByTestId('shared-answer-text').allTextContents()
  const olderAt = texts.findIndex((text) => text.includes(older))
  const newerAt = texts.findIndex((text) => text.includes(newer))
  expect(newerAt).toBeGreaterThanOrEqual(0)
  expect(olderAt).toBeGreaterThan(newerAt)
  await expect(page.getByTestId('new-answers-badge')).toHaveCount(0)

  await page.goto('/p/east-london/admin')
  await expect(page.getByTestId('new-answers-count')).toHaveText('0')
  await expect(page.getByTestId('new-answers-badge')).toHaveCount(0)
})
