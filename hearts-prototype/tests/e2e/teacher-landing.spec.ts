import { expect, test, type Page } from '@playwright/test'
import { seedCode } from '../env'

async function signInTeacher(page: Page) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill('elm-teacher@hearts.test')
  await page.getByTestId('login-password').fill('portal-teacher')
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/p\/east-london\/admin\/teach/, { timeout: 30_000 })
}

test('a teacher signing in at /login lands on Teach and can see it as a learner', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signInTeacher(page)
  await expect(page.getByTestId('admin-teach')).toBeVisible()
  const back = page.locator('.desk').getByTestId('see-as-learner')
  await expect(back).toBeVisible()
  await expect(back).toHaveText('See it as a learner')
  await expect(page.locator('.side-foot a.nav', { hasText: 'See it as a learner' })).toBeVisible()
  await back.click()
  await expect(page.getByTestId('home')).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/p/east-london')
})

test('on a phone the teacher desk says See it as a learner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInTeacher(page)
  const back = page.getByTestId('desk-open-app')
  await expect(back).toBeVisible()
  await expect(back).toHaveText('See it as a learner')
  await expect(back).toHaveAttribute('href', '/p/east-london')
  await back.click()
  await expect(page.getByTestId('home')).toBeVisible()
})

test('joining with a teacher code opens Teach, not the learner feed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const code = seedCode('elm-teacher')
  const email = `teacher-join-${Date.now()}@hearts.test`
  await page.goto(`/join?code=${encodeURIComponent(code)}`)
  await page.getByTestId('join-name').fill('New Teacher')
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill('teacher-join')
  await page.getByTestId('join-submit').click()
  await page.waitForURL(/\/p\/east-london\/admin\/teach/, { timeout: 30_000 })
  await expect(page.getByTestId('admin-teach')).toBeVisible()
  expect(page.url()).not.toMatch(/\/feed/)
  await expect(page.locator('.desk').getByTestId('see-as-learner')).toHaveText('See it as a learner')
})
