import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/screenshots'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}

test.describe.configure({ timeout: 180_000 })

test('demo stage on a wide screen and a 1920 screen', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: 2560, height: 1080 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toBeVisible()
  for (const slot of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-panel-${slot}`)).toBeVisible()
  }
  await expect(page.getByText("Used as if you're the Master")).toBeVisible()
  await expect(page.getByText("Used as if you're the Portal admin (HEARTS Demo)")).toBeVisible()
  await expect(page.getByText("Used as if you're a Teacher")).toBeVisible()
  await expect(page.getByText("Used as if you're a Learner")).toBeVisible()
  await expect(page.getByTestId('demo-steps')).toBeVisible()
  await expect(page.getByTestId('demo-learner-empty')).toBeVisible()
  const phone = page.getByTestId('demo-phone')
  const box = await phone.boundingBox()
  expect(box?.width || 0).toBeGreaterThan(360)
  expect(box?.width || 0).toBeLessThan(460)

  await page.getByTestId('demo-scenario-publish').click()
  await expect(page.getByTestId('demo-step-say')).toContainText('Publish')
  await page.locator('[data-demo="publish"]').click()
  await expect(page.getByTestId('demo-learner-course')).toHaveText('A quiet hour')
  await expect(page.getByTestId('demo-ticker')).toContainText('Course published: A quiet hour')
  await expect(page.getByTestId('demo-stat-published')).toHaveText('1')
  await page.screenshot({ path: `${dir}/demo-stage-2560x1080.png`, caret: 'initial' })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.getByTestId('demo-layout-row').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/demo-stage-1920x1080.png`, caret: 'initial' })
})

test('a learner cannot open the demo stage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/demo-stage$/)
})
