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

async function showCast(page: Page) {
  await expect(page.getByTestId('demo-cast-master')).toBeVisible()
  await expect(page.getByTestId('demo-cast-admin')).toBeVisible()
  await expect(page.getByTestId('demo-cast-teacher')).toBeVisible()
  await expect(page.getByTestId('demo-cast-learner')).toBeVisible()
  await expect(page.getByTestId('demo-cast-master')).toHaveValue('Leon (HEARTS)')
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your mosque?')
  await page.getByTestId('demo-cast-kind-school').click()
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your school?')
  await page.getByTestId('demo-cast-kind-mosque').click()
  await expect(page.getByTestId('demo-cast-admin')).toHaveValue('Rafiq')
  await expect(page.getByTestId('demo-cast-portal')).toHaveValue('Al-Noor Mosque')
  await expect(page.getByTestId('demo-cast-teacher')).toHaveValue('Sami')
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Abdallah')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Show all four')
  await page.getByTestId('demo-cast-show').click()
}

test('demo stage on a wide screen and a 1920 screen', async ({ page }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: 2560, height: 1080 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toBeVisible()
  await expect(page.getByTestId('demo-cast')).toBeVisible()
  await page.screenshot({ path: `${dir}/demo-cast-2560x1080.png`, caret: 'initial' })
  await showCast(page)
  for (const slot of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-panel-${slot}`)).toBeVisible()
  }
  await expect(page.getByText('Leon (HEARTS), running the whole system')).toBeVisible()
  await expect(page.getByText('Rafiq, looking after Al-Noor Mosque')).toBeVisible()
  await expect(page.getByText('Sami, guiding the learners')).toBeVisible()
  await expect(page.getByText('Abdallah, a learner at Al-Noor Mosque')).toBeVisible()
  await expect(page.getByTestId('demo-welcome')).toHaveText('Salaam Abdallah')
  await expect(page.getByTestId('demo-steps')).toBeVisible()
  await expect(page.getByTestId('demo-learner-empty')).toBeVisible()
  const phone = page.getByTestId('demo-phone')
  const box = await phone.boundingBox()
  expect(box?.width || 0).toBeGreaterThan(360)
  expect(box?.width || 0).toBeLessThan(460)

  await page.getByTestId('demo-scenario-publish').click()
  await expect(page.getByTestId('demo-step-say')).toContainText('Publish')
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'portal')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(3)
  await expect(page.locator('.demo-cell.is-live')).toHaveCount(1)
  await expect.poll(() => page.getByTestId('demo-panel-master').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeLessThan(0.5)
  await expect.poll(() => page.getByTestId('demo-panel-portal').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeGreaterThan(0.95)
  const teacherTint = await page.getByTestId('demo-panel-teacher').locator('.demo-strip').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(teacherTint).toBe('rgb(196, 143, 44)')
  await page.screenshot({ path: `${dir}/demo-focus-2560x1080.png`, caret: 'initial' })
  await page.getByTestId('demo-focus').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'off')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(0)
  await page.getByTestId('demo-focus').click()
  await page.locator('[data-demo="publish"]').click()
  await expect(page.getByTestId('demo-learner-course')).toHaveText('A quiet hour')
  await expect(page.getByTestId('demo-ticker')).toContainText('Course published: A quiet hour')
  await expect(page.getByTestId('demo-stat-published')).toHaveText('1')
  await page.screenshot({ path: `${dir}/demo-stage-2560x1080.png`, caret: 'initial' })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.getByTestId('demo-layout-row').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/demo-stage-1920x1080.png`, caret: 'initial' })

  await page.getByTestId('demo-name-learner').click()
  await page.getByTestId('demo-name-learner-input').fill('Layla')
  await page.getByTestId('demo-name-learner-input').press('Enter')
  await expect(page.getByTestId('demo-welcome')).toHaveText('Salaam Layla')

  await page.getByTestId('demo-edit-cast').click()
  await expect(page.getByTestId('demo-cast-master')).toBeVisible()
  await expect(page.getByTestId('demo-cast-learner')).toBeVisible()
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Layla')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Done')
  await page.getByTestId('demo-cast-pick').filter({ hasText: /^Maryam$/ }).click()
  await page.getByTestId('demo-cast-show').click()
  await expect(page.getByTestId('demo-welcome')).toHaveText('Salaam Maryam')
  await expect(page.getByText('Maryam, a learner at Al-Noor Mosque')).toBeVisible()
})

test('a learner cannot open the demo stage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/demo-stage$/)
})
