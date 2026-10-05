import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import { completeConsent } from './legal-helpers'

// Spoken lines in the harvest: copied from the transcript at the moment a short clip plays, grouped and filtered
// by the 20 working doors and by speaker, and never counted towards progress.

const PORTAL = '/p/east-london'
const sfx = Date.now().toString(36)
const FRESH = { name: 'Harvest Browser', email: `harvest-lines-${sfx}@hearts.test`, password: 'harvest-lines-1' }

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe.configure({ mode: 'serial' })

test('the seeded lines group and filter by the 20 doors and by speaker, cite only real words, and open their context', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/garden/harvest?kind=line`)
  await page.goto(`${PORTAL}/garden/harvest?kind=line`)
  await expect(page.getByTestId('harvest-sample')).toHaveCount(0)
  const items = page.getByTestId('harvest-item')
  await expect(items.first()).toBeVisible()
  expect(await items.count()).toBeGreaterThan(1)
  for (const kind of await items.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-kind')))) expect(['line', 'quran', 'hadith']).toContain(kind)

  await page.getByTestId('harvest-group-door').click()
  await expect(page).toHaveURL(/group=door/)
  for (const title of await page.locator('.harvest-group-title').allInnerTexts()) expect(title).toMatch(/^Door ([1-9]|1\d|20) · |^Not yet placed/)
  const doors = await items.evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('data-door'))).filter(Boolean))
  expect(doors.length).toBeGreaterThan(0)
  for (const door of doors) expect(door >= 1 && door <= 20).toBeTruthy()
  await expect(page.getByTestId('garden-harvest')).not.toContainText(/\bclauses?\b/i)

  const door = String(doors[0])
  await page.locator(`[data-testid=harvest-door][data-door="${door}"]`).click()
  await expect(page).toHaveURL(new RegExp(`door=${door}`))
  for (const value of await items.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-door')))) expect(value).toBe(door)
  await page.getByRole('link', { name: 'Every door' }).click()

  await page.getByTestId('harvest-group-speaker').click()
  const speaker = (await items.first().getAttribute('data-speaker'))!
  expect(speaker).toBeTruthy()
  await page.locator(`[data-testid=harvest-speaker][data-speaker="${speaker}"]`).click()
  await expect(page).toHaveURL(/speaker=/)
  for (const value of await items.evaluateAll((rows) => rows.map((row) => row.getAttribute('data-speaker')))) expect(value).toBe(speaker)

  await page.goto(`${PORTAL}/garden/harvest?kind=line`)
  const cited = page.getByTestId('harvest-commentary')
  if (await cited.count()) {
    await cited.first().locator('summary').click()
    await expect(cited.first().getByTestId('harvest-commentary-source')).toContainText(/Named in this talk|https:/)
  }

  await page.getByTestId('harvest-line-context').first().click()
  await expect(page.getByTestId('context-transcript')).toBeVisible()
  expect(((await page.getByTestId('context-line').textContent()) || '').replace(/^\d+:\d{2}\s*/, '').length).toBeGreaterThan(10)
  await expect(page.getByTestId('course')).toBeVisible()
})

test('a fresh learner sees the sample, then a short clip keeps a real line and parts watched stays at 0', async ({ page }) => {
  test.setTimeout(240_000)
  const joiner = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { 'x-forwarded-for': '10.5.0.1' } })
  await joiner.post('/api/hearts', { form: { action: 'join', code: seedCode('elm-learner'), ...FRESH }, maxRedirects: 0 })
  await joiner.dispose()

  await signIn(page, FRESH.email, FRESH.password, `${PORTAL}/garden/general`)
  await completeConsent(page)
  await page.goto(`${PORTAL}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')
  await page.goto(`${PORTAL}/garden/harvest`)
  await expect(page.getByTestId('harvest-sample')).toBeVisible()
  await expect(page.getByTestId('harvest-item').first()).toBeVisible()

  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  const captured = page.waitForResponse((response) => response.url().includes('/api/hearts/harvest') && response.request().method() === 'POST', { timeout: 60_000 })
  await page.goto(`${PORTAL}/feed`)
  await expect(page.getByTestId('journey')).toBeVisible()
  expect((await captured).status()).toBeLessThan(500)

  await expect(async () => {
    await page.goto(`${PORTAL}/garden/harvest`)
    await expect(page.getByTestId('harvest-sample')).toHaveCount(0)
  }).toPass({ timeout: 30_000 })
  const first = page.getByTestId('harvest-item').first()
  await expect(first).toHaveAttribute('data-surface', /hors|appetiser/)
  await expect(page.getByTestId('harvest-new').first()).toBeVisible()
  expect(((await first.getByTestId('harvest-quote').textContent()) || '').trim().split(/\s+/).length).toBeGreaterThan(3)

  await page.goto(`${PORTAL}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')
  await expect(page.getByTestId('time-given')).toHaveText('0m')
})
