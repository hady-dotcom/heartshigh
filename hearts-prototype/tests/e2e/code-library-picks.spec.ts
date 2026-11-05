import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { artifactDir } from './artifact-dir'

const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const shots = artifactDir('code-library-picks')

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(shots, { recursive: true })
  await page.screenshot({ path: path.join(shots, `${name}.png`), caret: 'initial' })
}

test('a code picks library courses, and joining with it shows those courses', async ({ page }) => {
  const suffix = Date.now().toString().slice(-7)
  const code = `LIB${suffix}`
  const title = 'Ar-Rabb'

  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await expect(page.getByRole('link', { name: 'Course packs' })).toHaveCount(0)
  await expect(page.getByTestId('nav-packs')).toHaveCount(0)
  await page.goto('/master/packs')
  await expect(page).toHaveURL(/\/master\/library$/)
  await expect(page.getByTestId('opened-by').first()).toBeVisible()
  await shot(page, 'master-library-1280')

  await page.setViewportSize(PHONE)
  await shot(page, 'master-library-390')

  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/access')
  await expect(page.getByTestId('admin-access')).toBeVisible()
  await expect(page.getByText('New set of courses')).toHaveCount(0)
  const picker = page.getByTestId('new-code-courses')
  await expect(picker.getByTestId('all-library-courses')).toBeVisible()
  const door = picker.getByTestId('door-quick').first()
  if (await door.count()) await expect(door).toContainText(/Whole door W\d+/)
  await picker.getByTestId('library-search').fill(title)
  const match = picker.getByTestId('library-course-check').filter({ hasText: title }).first()
  await expect(match).toBeVisible()
  await match.locator('input').check()
  await expect(picker.getByTestId('library-selected')).toContainText('1 course')
  await page.getByTestId('new-code').fill(code)
  await page.getByTestId('new-code-label').fill(`Library pick ${suffix}`)
  await page.getByTestId('new-code-role').selectOption('learner')
  await page.getByTestId('new-code-teacher').selectOption({ index: 1 })
  await shot(page, 'access-picker-1280')

  await page.setViewportSize(PHONE)
  await picker.scrollIntoViewIfNeeded()
  await shot(page, 'access-picker-390')

  await page.setViewportSize(DESK)
  await page.getByTestId('new-code-submit').click()
  await expect(page.getByTestId('notice')).toContainText(code)
  await expect(page.getByTestId('code-card').filter({ hasText: code })).toContainText(title)

  await page.context().clearCookies()
  await page.goto(`/join?code=${encodeURIComponent(code)}`)
  await page.getByTestId('join-name').fill('Library Joiner')
  await page.getByTestId('join-email').fill(`lib-${suffix}@hearts.test`)
  await page.getByTestId('join-password').fill('library-join')
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'))
  await page.goto('/p/east-london/lanes')
  await expect(page.getByTestId('lanes')).toBeVisible()
  await expect(page.getByTestId('path-course').filter({ hasText: title })).toBeVisible()
  await shot(page, 'joined-lanes-1280')

  await page.setViewportSize(PHONE)
  await shot(page, 'joined-lanes-390')
})
