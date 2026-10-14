import { expect, test } from '@playwright/test'

const LINE = 'A live four-screen walk-through: master, portal admin, teacher, learner. Practice data only. Nothing here changes real portals.'

test('a signed-out visitor sees the demo stage entry, then the demo master login', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/demo-stage')
  await expect(page.getByTestId('demo-stage-entry')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hady Core Demo stage' })).toBeVisible()
  await expect(page.getByText(LINE)).toBeVisible()
  for (const role of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-stage-dot-${role}`)).toBeVisible()
  }
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/HEARTS/i)
  await expect(page).toHaveTitle('Hady Core Demo stage')
  const background = await page.getByTestId('demo-stage-entry').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(background).toBe('rgb(18, 16, 24)')

  await page.getByTestId('demo-stage-sign-in').click()
  await expect(page).toHaveURL(/\/login/)
  const opened = new URL(page.url())
  expect(opened.searchParams.get('next')).toBe('/demo-stage')
  expect(opened.searchParams.get('demo')).toBe('stage')
  await expect(page.getByTestId('login')).toHaveAttribute('data-demo', 'stage')
  await expect(page.getByRole('heading', { name: 'Master login' })).toBeVisible()
  await expect(page.getByText('This sign-in is for the demo. It uses the master login and returns you to the Demo stage.')).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/HEARTS/i)
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0)

  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('not-the-password')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('error')).toBeVisible()
  await expect(page.getByTestId('login')).toHaveAttribute('data-demo', 'stage')
  const failed = new URL(page.url())
  expect(failed.pathname).toBe('/login')
  expect(failed.searchParams.get('next')).toBe('/demo-stage')
  expect(failed.searchParams.get('demo')).toBe('stage')
  await expect(page.locator('body')).not.toContainText(/HEARTS/i)

  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => url.pathname === '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toBeVisible()
  await expect(page.getByTestId('demo-stage-entry')).toHaveCount(0)
})

test('a learner still cannot open the demo stage', async ({ page }) => {
  await page.goto('/login?next=/demo-stage&demo=stage')
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page.getByTestId('demo-stage-entry')).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/demo-stage$/)
})

test('the ordinary login is unchanged', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('login')).not.toHaveAttribute('data-demo', 'stage')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await expect(page.getByText('HEARTS', { exact: true })).toBeVisible()
})
