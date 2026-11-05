import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

// A lane opens its own page. Tapping a talk plays it, and Back returns to that page, not the list.

const PORTAL = 'east-london'
const LEARNER = { email: 'elm-learner2@hearts.test', password: 'portal-learner' }

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}
const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(LEARNER.email)
  await page.getByTestId('login-password').fill(LEARNER.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})
test.afterAll(async () => {
  await master?.dispose()
})

test.describe('lane page has no bounce', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    test(`tap a lane, tap a talk, then Back, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await signIn(page, `/p/${PORTAL}/lanes`)
      await page.goto(`/p/${PORTAL}/lanes`)
      const card = page.getByTestId('lane-card').first()
      const lane = (await card.getAttribute('data-lane'))!
      const first = (await card.getAttribute('data-first-cut'))!
      expect(lane).toBeTruthy()
      const open = card.getByTestId('lane-open')
      expect(await open.getAttribute('href')).toBe(`/p/${PORTAL}/lanes/${lane}`)
      await open.click()
      await page.waitForURL((url) => url.pathname === `/p/${PORTAL}/lanes/${lane}`)
      await expect(page.getByTestId('lane')).toBeVisible()
      await expect(page.getByTestId('lanes')).toHaveCount(0)
      expect(new URL(page.url()).pathname).toBe(`/p/${PORTAL}/lanes/${lane}`)

      const progress = page.getByTestId('lane').locator('[data-testid="lane-progress"], [data-testid="lane-progress-example"]')
      await expect(progress.first()).toBeVisible()
      await expect(progress.first().getByTestId('lane-done')).toContainText(/of \d+ done/)
      await expect(progress.first().getByTestId('lane-minutes')).toContainText(/watched/)
      await expect(progress.first().locator('.bar')).toBeVisible()

      const item = page.getByTestId('lane-item').first()
      await expect(item).toHaveAttribute('data-cut', first)
      expect(await item.getAttribute('href')).toContain(`from=lane`)
      expect(await item.getAttribute('href')).toContain(`lane=${lane}`)
      await item.click()
      const journey = page.getByTestId('journey')
      await expect(journey).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
      const back = page.getByTestId('feed-back')
      await expect(back).toHaveAttribute('data-back', `/p/${PORTAL}/lanes/${lane}`)
      await back.click()
      await page.waitForURL((url) => url.pathname === `/p/${PORTAL}/lanes/${lane}`)
      await expect(page.getByTestId('lane')).toBeVisible()
      await expect(page.getByTestId('lanes')).toHaveCount(0)
      await expect(page.getByTestId('lane-title')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, 'the lane page stays inside the screen').toBeLessThanOrEqual(1)
    })
  }
})

test('a real completion replaces the example with that learner’s count', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, `/p/${PORTAL}/lanes`)
  await page.goto(`/p/${PORTAL}/lanes`)
  const card = page.getByTestId('lane-card').first()
  const lane = (await card.getAttribute('data-lane'))!
  await page.goto(`/p/${PORTAL}/lanes/${lane}`)
  const item = page.getByTestId('lane-item').first()
  const lessonId = Number(await item.getAttribute('data-lesson'))
  const total = await page.getByTestId('lane-item').count()
  expect(lessonId).toBeGreaterThan(0)
  const hamza = (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER.email)}&limit=1&depth=0`))).docs[0]
  const portal = (await json(await master.get(`/api/portals?where[slug][equals]=${PORTAL}&limit=1&depth=0`))).docs[0]
  const created = await master.post('/api/completions', {
    data: { user: hamza.id, lesson: lessonId, percent: 100, sourceLevel: 'talk', portal: portal.id },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const row = await json(created)
  try {
    await page.goto(`/p/${PORTAL}/lanes/${lane}`)
    const unit = page.getByTestId('lane-progress')
    await expect(unit).toBeVisible()
    await expect(page.getByTestId('lane-progress-example')).toHaveCount(0)
    await expect(unit.getByTestId('lane-done')).toHaveText(new RegExp(`^[1-9]\\d* of ${total} done$`))
    await expect(unit.getByTestId('lane-minutes')).toContainText('watched')
    await expect(page.getByTestId('lane-continue')).toBeVisible()
    await expect(item).toHaveAttribute('data-done', 'yes')
  } finally {
    if (row?.doc?.id || row?.id) await master.delete(`/api/completions/${row.doc?.id || row.id}`)
  }
})
