import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const PORTAL = '/p/east-london'
const dir = 'artifacts/screenshots'

async function signIn(page: Page, email: string, next: string) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('a seeded harvest filters by door and speaker, replays, and cites only a real line', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', `${PORTAL}/garden/harvest`)
  await expect(page.getByTestId('garden-harvest')).toBeVisible()
  await expect(page.getByTestId('harvest-demo')).toHaveCount(0)
  const items = page.getByTestId('harvest-item')
  await expect(items.first()).toBeVisible()
  const count = await items.count()
  expect(count).toBeGreaterThan(1)
  await expect(page.getByTestId('harvest-new').first()).toBeVisible()
  await expect(page.getByTestId('harvest-filter-door')).toBeVisible()
  await expect(page.getByTestId('harvest-filter-speaker')).toBeVisible()
  await expect(page.getByTestId('harvest-group').first()).toBeVisible()

  const scholars = page.getByTestId('scholars')
  const scholarCount = await scholars.count()
  expect(scholarCount).toBeGreaterThan(0)
  expect(scholarCount).toBeLessThan(count)
  const quote = (await scholars.first().getByTestId('scholar-text').textContent()) || ''
  expect(quote.length).toBeGreaterThan(20)
  await scholars.first().locator('summary').click()
  await expect(scholars.first().getByTestId('scholar-source')).toContainText('Named in this talk')

  await page.getByRole('link', { name: 'By speaker' }).click()
  await expect(page).toHaveURL(/group=speaker/)
  const speaker = await items.first().getAttribute('data-speaker')
  const door = await items.first().getAttribute('data-door')
  expect(speaker).toBeTruthy()
  expect(door && door !== 'Other').toBeTruthy()
  await page.getByTestId('harvest-filter-door').getByRole('link', { name: door === 'Sitting' ? 'The sitting' : door === 'Hour' ? 'The Hour' : door === 'Trunk' ? 'The trunk' : door! }).click()
  await expect(page).toHaveURL(new RegExp(`door=${door}`))
  await expect(items.first()).toHaveAttribute('data-door', door!)
  await page.getByRole('link', { name: 'All doors' }).click()
  await page.getByTestId('harvest-filter-speaker').getByRole('link', { name: speaker!, exact: true }).click()
  await expect(page).toHaveURL(/speaker=/)
  await expect(items.first()).toHaveAttribute('data-speaker', speaker!)
  const shown = await items.count()
  for (let index = 0; index < shown; index += 1) {
    await expect(items.nth(index)).toHaveAttribute('data-speaker', speaker!)
  }

  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/harvest-phone.png`, fullPage: true })

  await page.getByTestId('harvest-context-link').first().click()
  await expect(page.getByTestId('context-transcript')).toBeVisible()
  const line = page.getByTestId('context-line')
  await expect(line).toBeVisible()
  const contextText = ((await line.textContent()) || '').replace(/^\d+:\d{2}\s*/, '')
  expect(contextText.length).toBeGreaterThan(10)
  await expect(page.getByTestId('course')).toBeVisible()
  await page.screenshot({ path: `${dir}/harvest-context-phone.png`, fullPage: true })

  await page.goto(`${PORTAL}/garden/harvest`)
  const replay = page.getByTestId('harvest-replay').first()
  const label = (await replay.textContent()) || ''
  await replay.click()
  await expect(page).toHaveURL(/[?&]t=\d+/)
  await expect(page.getByTestId('context-transcript')).toHaveCount(0)
  expect(label).toMatch(/Play from/)
})

test('browsing a short clip fills the harvest and does not mark a course part watched', async ({ page }) => {
  test.setTimeout(240_000)
  await signIn(page, 'elm-learner2@hearts.test', `${PORTAL}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')
  await page.goto(`${PORTAL}/garden/harvest`)
  await expect(page.getByTestId('harvest-demo')).toBeVisible()
  await expect(page.getByTestId('harvest-item').first()).toBeVisible()

  const captured = page.waitForResponse((response) => response.url().includes('/api/hearts/harvest') && response.request().method() === 'POST', { timeout: 60_000 })
  await page.goto(`${PORTAL}/feed`)
  await expect(page.getByTestId('journey')).toBeVisible()
  const response = await captured
  expect(response.status()).toBeLessThan(500)

  await expect(async () => {
    await page.goto(`${PORTAL}/garden/harvest`)
    await expect(page.getByTestId('harvest-demo')).toHaveCount(0)
  }).toPass({ timeout: 30_000 })
  await expect(page.getByTestId('harvest-item').first()).toBeVisible()
  await expect(page.getByTestId('harvest-new').first()).toBeVisible()
  const text = (await page.getByTestId('harvest-item').first().locator('blockquote').first().textContent()) || ''
  expect(text.trim().split(/\s+/).length).toBeGreaterThan(3)

  await page.goto(`${PORTAL}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/harvest-progress-untouched.png` })
})
