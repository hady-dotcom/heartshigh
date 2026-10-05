import { expect, test, type Page } from '@playwright/test'
import { seedCode } from '../env'

const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }
const sfx = Date.now().toString().slice(-6)

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('portal desk can set welcome films, and a first login walks Welcome then Intro', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/settings')
  await expect(page.getByTestId('admin-settings')).toBeVisible()
  await expect(page.getByTestId('welcome-film-slots')).toBeVisible()
  await expect(page.getByTestId('learner-welcome-slot')).toBeVisible()
  await expect(page.getByTestId('learner-intro-slot')).toBeVisible()
  await expect(page.getByTestId('teacher-welcome-slot')).toBeVisible()
  await expect(page.getByTestId('teacher-intro-slot')).toBeVisible()
  await page.getByTestId('learner-welcome-slot').getByTestId('desk-help').click()
  await expect(page.getByTestId('desk-help-pop')).toContainText('personal hello')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('admin-settings')).toContainText('Hady Core')
})

test('a new learner sees Welcome then Intro, can Skip, and is not blocked on return', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  const email = `welcome-${sfx}@hearts.test`
  await page.goto(`/join?code=${seedCode('elm-learner')}`)
  await page.getByTestId('join-name').fill('Welcome Nora')
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill('welcome-learner')
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('splash').or(page.getByTestId('welcome-films'))).toBeVisible({ timeout: 20_000 })
  if (await page.getByTestId('welcome-begin').count()) {
    await page.getByTestId('welcome-begin').click()
  }
  await expect(page.getByTestId('welcome-films')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('welcome-skip')).toBeVisible()
  await expect(page.getByTestId('welcome-film')).toBeVisible()
  await expect(page.locator('.welcome-walk h1')).not.toHaveText(/Welcome to HEARTS|Welcome Video/i)
  await page.getByTestId('welcome-skip').click()
  await expect(page.getByTestId('welcome-intro')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('welcome-skip')).toBeVisible()
  await page.getByTestId('welcome-skip').click()
  await page.waitForURL(/\/p\/east-london\/(start)?/, { timeout: 15_000 })
  await expect(page.getByTestId('welcome-films')).toHaveCount(0)

  const again = await browser.newPage()
  await again.setViewportSize(PHONE)
  await signIn(again, email, 'welcome-learner', '/p/east-london')
  await expect(again.getByTestId('welcome-films')).toHaveCount(0)
  await expect(again.getByTestId('welcome-intro')).toHaveCount(0)
  await again.close()
})

test('a returning seeded learner is never sent back to the films', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('welcome-films')).toHaveCount(0)
  await expect(page.getByTestId('home').or(page.getByTestId('journey'))).toBeVisible({ timeout: 20_000 })
})
