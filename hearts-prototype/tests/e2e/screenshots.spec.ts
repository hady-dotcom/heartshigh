import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = 'artifacts/screenshots'

async function shot(page: import('@playwright/test').Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true })
}

test('mobile screens of the seeded portal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login?next=/p/east-london/admin')
  await page.getByTestId('login-email').fill('elm-admin@hearts.test')
  await page.getByTestId('login-password').fill('portal-admin')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await shot(page, 'admin-overview')
  await page.goto('/p/east-london/admin/courses')
  await shot(page, 'admin-courses')
  await page.goto('/p/east-london/admin/codes')
  await shot(page, 'admin-codes')
  await page.goto('/p/east-london/admin/settings')
  await shot(page, 'admin-settings')
  await page.goto('/login?next=/p/east-london/feed')
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('feed-cut').first()).toBeVisible()
  await shot(page, 'learner-feed')
  await page.goto('/p/east-london/path')
  await shot(page, 'learner-path')
  await page.goto('/p/east-london/grow')
  await shot(page, 'learner-grow')
  await page.goto('/p/east-london/schedule')
  await shot(page, 'learner-schedule')
  await page.goto('/p/east-london/night')
  await shot(page, 'learner-night')
  const lesson = page.locator('[data-testid=lesson-link]').first()
  await page.goto('/p/east-london/path')
  await lesson.click()
  await shot(page, 'learner-player')
})
