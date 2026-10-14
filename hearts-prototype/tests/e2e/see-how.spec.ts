import { expect, test, type Page } from '@playwright/test'
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'

const dir = path.resolve('artifacts/see-how')
const share = '/opt/cursor/artifacts/see-how'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(dir, { recursive: true })
  mkdirSync(share, { recursive: true })
  const file = path.join(dir, `${name}.png`)
  await page.screenshot({ path: file, animations: 'disabled' })
  copyFileSync(file, path.join(share, `${name}.png`))
}

test.describe.configure({ timeout: 120_000 })

test('learner help tip and See how player at phone and laptop size', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  for (const size of [
    { width: 390, height: 844, name: 'phone' },
    { width: 1280, height: 800, name: 'laptop' },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await page.goto('/p/east-london')
    await expect(page.getByTestId('home')).toBeVisible()
    await page.getByTestId('page-help-open').click()
    const sheet = page.getByTestId('page-help-sheet')
    await expect(sheet.getByTestId('see-how')).toBeVisible()
    await expect(sheet.getByTestId('see-how')).toHaveAttribute('data-see-how', 'home')
    await shot(page, `learner-tip-${size.name}`)
    await sheet.getByTestId('see-how').click()
    const player = page.getByTestId('see-how-player')
    await expect(player).toBeVisible()
    await expect(player.getByTestId('see-how-video')).toBeVisible()
    await expect(player.getByTestId('see-how-caption')).toBeVisible()
    await shot(page, `learner-player-${size.name}`)
    await player.getByTestId('see-how-close').click()
    await expect(player).toBeHidden()
  }
})

test('desk help tip and See how player on a laptop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  const tip = page.locator('[data-testid=desk-help][data-help=admin-overview]')
  await tip.getByRole('button', { name: 'What is this?' }).click()
  const pop = page.locator('[data-testid=desk-help-pop][data-help=admin-overview]')
  await expect(pop.getByTestId('see-how')).toBeVisible()
  await shot(page, 'desk-tip-laptop')
  await pop.getByTestId('see-how').click()
  const player = page.getByTestId('see-how-player')
  await expect(player).toBeVisible()
  await expect(player.getByTestId('see-how-video')).toBeVisible()
  await shot(page, 'desk-player-laptop')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(player).toBeVisible()
  await shot(page, 'desk-player-phone-sheet')
})
