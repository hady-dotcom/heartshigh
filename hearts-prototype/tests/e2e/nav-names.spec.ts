import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/nav-names'
const desktop = { width: 1280, height: 800 }
const phone = { width: 390, height: 844 }

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${name}.png`), caret: 'initial' })
}

async function navLabels(page: Page) {
  return page.locator('[data-testid="desk-nav"] a.nav').evaluateAll((links) => links.map((link) => (link.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
}

test('renamed desk pages keep unique names at 1280x800', async ({ page }) => {
  await page.setViewportSize(desktop)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await expect(page.getByTestId('desk-nav')).toBeVisible()
  const master = await navLabels(page)
  expect(new Set(master).size).toBe(master.length)
  expect(master).toContain('Live recordings')
  expect(master).toContain('Live in person')
  expect(master).toContain('Event Calendar')
  expect(master).not.toContain('Live')
  expect(master).not.toContain('Calendar')
  await shot(page, '1280-master-nav')

  await page.goto('/master/live')
  await expect(page.locator('h1').first()).toContainText('Live recordings')
  await page.locator('h1').getByRole('button', { name: '?' }).click()
  await expect(page.getByTestId('desk-help-pop')).toContainText('Live recordings')
  await shot(page, '1280-master-live-recordings')

  await page.goto('/master/nights')
  await expect(page.locator('h1').first()).toContainText('Live in person')
  await page.locator('h1').getByRole('button', { name: '?' }).click()
  await expect(page.getByTestId('desk-help-pop')).toContainText('Live in person')
  await shot(page, '1280-master-live-in-person')

  await page.goto('/master/calendar')
  await expect(page.locator('h1').first()).toContainText('Event Calendar')
  await page.locator('h1').getByRole('button', { name: '?' }).click()
  await expect(page.getByTestId('desk-help-pop')).toContainText('Event Calendar')
  await shot(page, '1280-master-event-calendar')

  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
  const portal = await navLabels(page)
  expect(new Set(portal).size).toBe(portal.length)
  expect(portal).toContain('Live recordings')
  expect(portal).toContain('Live in person')
  expect(portal).toContain('Event Calendar')
  expect(portal).toContain('Gatherings')
  expect(portal).not.toContain('Go live')
  expect(portal).not.toContain('Nights')
  expect(portal).not.toContain('Calendar')
  await shot(page, '1280-portal-nav')

  await page.goto('/p/east-london/admin/live')
  await expect(page.locator('h1').first()).toContainText('Live recordings')
  await shot(page, '1280-portal-live-recordings')
  await page.goto('/p/east-london/admin/nights')
  await expect(page.locator('h1').first()).toContainText('Live in person')
  await shot(page, '1280-portal-live-in-person')
  await page.goto('/p/east-london/admin/calendar')
  await expect(page.locator('h1').first()).toContainText('Event Calendar')
  await shot(page, '1280-portal-event-calendar')
})

test('learner labels use the new names at 390x844 and 1280x800', async ({ page }) => {
  for (const [size, prefix] of [[phone, '390'], [desktop, '1280']] as const) {
    await page.setViewportSize(size)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    await expect(page.getByTestId('open-live')).toHaveText('Live recordings')
    await shot(page, `${prefix}-learner-home-live`)
    await page.getByTestId('open-live').click()
    await expect(page.getByRole('heading', { name: 'Live recordings' })).toBeVisible()
    await page.getByTestId('page-help-open').click()
    await expect(page.getByTestId('page-help-title')).toHaveText('How to use Live recordings')
    await shot(page, `${prefix}-learner-live-recordings`)
    await page.getByTestId('page-help-close').click()

    await page.goto('/p/east-london/me')
    await expect(page.getByTestId('me-circle')).toContainText('Circle and Live in person')
    await shot(page, `${prefix}-learner-me`)
    await page.goto('/p/east-london/me/circle')
    await expect(page.getByText('Live in person', { exact: true })).toBeVisible()
    await page.getByTestId('page-help-open').click()
    await expect(page.getByTestId('page-help-sheet')).toContainText('Live in person')
    await shot(page, `${prefix}-learner-live-in-person`)
  }
})
