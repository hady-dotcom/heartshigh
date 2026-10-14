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

async function openTip(page: Page, topic: string) {
  const tip = page.locator(`[data-testid=desk-help][data-help=${topic}]`)
  await tip.getByRole('button', { name: 'What is this?' }).click()
  const pop = page.locator(`[data-testid=desk-help-pop][data-help=${topic}]`)
  await expect(pop.getByTestId('see-how')).toHaveAttribute('data-see-how', topic)
  return pop
}

test('master desk can replace a See how clip, and Live recordings and Framing include See how', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/see-how')
  await expect(page.getByTestId('see-how-desk')).toBeVisible()
  const home = page.locator('[data-testid=see-how-row][data-page=home]')
  await expect(home).toContainText('The recorded one')
  await expect(home.getByTestId('see-how-play')).toBeVisible()
  await expect(home.getByTestId('see-how-replace')).toBeVisible()
  await expect(home.getByTestId('see-how-reset')).toBeDisabled()
  await home.scrollIntoViewIfNeeded()
  await shot(page, 'see-how-desk-laptop')

  await home.getByTestId('see-how-file').setInputFiles(path.resolve('public/see-how/help.webm'))
  await home.getByTestId('see-how-replace').click()
  await expect(page.getByText('Your video is the one people will see.')).toBeVisible()
  const replaced = page.locator('[data-testid=see-how-row][data-page=home]')
  await expect(replaced).toHaveAttribute('data-custom', 'yes')
  await replaced.getByTestId('see-how-play').click()
  const player = page.getByTestId('see-how-player')
  await expect(player.getByTestId('see-how-video')).toHaveAttribute('src', /see-how-clips/)
  await shot(page, 'see-how-replaced-laptop')
  await player.getByTestId('see-how-close').click()

  await replaced.getByTestId('see-how-reset').click()
  await expect(page.getByText('Back to the recorded one.')).toBeVisible()
  const recorded = page.locator('[data-testid=see-how-row][data-page=home]')
  await expect(recorded).toHaveAttribute('data-custom', 'no')
  await recorded.getByTestId('see-how-play').click()
  await expect(page.getByTestId('see-how-video')).toHaveAttribute('src', /\/see-how\/home\.webm/)
  await page.getByTestId('see-how-close').click()

  await page.goto('/master/framing')
  await expect(page.getByTestId('master-framing')).toBeVisible()
  const framing = await openTip(page, 'master-framing')
  await shot(page, 'framing-tip-laptop')
  await framing.getByTestId('see-how').click()
  await expect(page.getByTestId('see-how-player')).toBeVisible()
  await shot(page, 'framing-player-laptop')
  await page.getByTestId('see-how-close').click()

  await page.goto('/p/east-london/admin/live')
  await expect(page.getByTestId('desk-live')).toBeVisible()
  const live = await openTip(page, 'desk-live')
  await shot(page, 'live-tip-laptop')
  await live.getByTestId('see-how').click()
  await expect(page.getByTestId('see-how-player')).toBeVisible()
  await page.getByTestId('see-how-close').click()

  await page.goto('/master/live')
  await expect(page.getByTestId('master-live')).toBeVisible()
  await openTip(page, 'master-live')
  await shot(page, 'master-live-tip-laptop')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/master/see-how')
  await expect(page.getByTestId('desk-narrow')).toBeVisible()
  await shot(page, 'see-how-desk-phone')
  await page.goto('/master/framing')
  await expect(page.getByTestId('desk-narrow')).toBeVisible()
  await shot(page, 'framing-desk-phone')
  await page.goto('/p/east-london/admin/live')
  await expect(page.getByTestId('desk-narrow')).toBeVisible()
  await shot(page, 'live-desk-phone')
})
