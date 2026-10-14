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

test('demo stage on a wide screen and a laptop', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: 2560, height: 1080 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toBeVisible({ timeout: 90_000 })
  for (const slot of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-panel-${slot}`)).toBeVisible()
    await expect(page.getByTestId(`demo-frame-${slot}`)).toBeVisible()
  }
  await expect(page.getByText("Used as if you're the Master")).toBeVisible()
  await expect(page.getByText("Used as if you're the Portal admin (HEARTS Demo)")).toBeVisible()
  await expect(page.getByText("Used as if you're a Teacher")).toBeVisible()
  await expect(page.getByText("Used as if you're a Learner")).toBeVisible()
  const phone = page.getByTestId('demo-phone')
  const box = await phone.boundingBox()
  expect(box?.width || 0).toBeGreaterThan(360)
  expect(box?.width || 0).toBeLessThan(460)
  const learner = page.getByTestId('demo-frame-learner')
  await expect(learner).toHaveAttribute('src', /\/demo-stage\/as\/learner\//)
  await page.getByTestId('demo-layout-row').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${dir}/demo-stage-2560x1080.png`, caret: 'initial' })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('demo-layout-grid').click()
  if (await page.getByTestId('demo-steps').count()) await page.getByTestId('demo-steps-toggle').click()
  await expect(page.getByTestId('demo-steps')).toHaveCount(0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${dir}/demo-stage-1280x800.png`, caret: 'initial' })
})

test('a learner cannot open the demo stage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/demo-stage$/)
})
