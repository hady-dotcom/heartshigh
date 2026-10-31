import { expect, test, type Page } from '@playwright/test'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function fontSize(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
}

test('learner fields stay at 16px so iPhone does not zoom on tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/join')
  for (const id of ['join-code', 'join-name', 'join-email', 'join-password']) {
    expect(await fontSize(page, id), id).toBeGreaterThanOrEqual(16)
  }
  await page.goto('/login')
  for (const id of ['login-email', 'login-password']) {
    expect(await fontSize(page, id), id).toBeGreaterThanOrEqual(16)
  }
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/me/plan')
  await expect(page.getByTestId('plan')).toBeVisible()
  for (const id of ['schedule-course', 'schedule-start', 'schedule-end']) {
    expect(await fontSize(page, id), id).toBeGreaterThanOrEqual(16)
  }
  await page.goto('/p/east-london/me')
  expect(await fontSize(page, 'name-input'), 'name-input').toBeGreaterThanOrEqual(16)
})
