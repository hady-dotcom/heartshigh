import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

/** HEARTS_ARTIFACTS collects shots for review. Otherwise they stay in test-results/see-how. */
const dir = process.env.HEARTS_ARTIFACTS
  ? path.join(process.env.HEARTS_ARTIFACTS, 'see-how')
  : path.resolve('test-results/see-how')

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(dir, { recursive: true })
  await page.screenshot({ path: path.join(dir, `${name}.png`), animations: 'disabled' })
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

async function playRow(page: Page, row: ReturnType<Page['locator']>) {
  const button = row.getByTestId('see-how-play')
  await button.scrollIntoViewIfNeeded()
  await expect.poll(async () => button.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__react')))).toBe(true)
  await button.click()
  const player = page.getByTestId('see-how-player')
  await expect(player).toBeVisible()
  return player
}

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
  const player = await playRow(page, replaced)
  await expect(player.getByTestId('see-how-video')).toHaveAttribute('src', /see-how-clips/)
  await shot(page, 'see-how-replaced-laptop')
  await player.getByTestId('see-how-close').click()

  await replaced.getByTestId('see-how-sure').check()
  await replaced.getByTestId('see-how-reset').click()
  await expect(page.getByText('Back to the recorded one.')).toBeVisible()
  const recorded = page.locator('[data-testid=see-how-row][data-page=home]')
  await expect(recorded).toHaveAttribute('data-custom', 'no')
  const again = await playRow(page, recorded)
  await expect(again.getByTestId('see-how-video')).toHaveAttribute('src', /\/see-how\/home\.webm/)
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
  await expect(page.getByTestId('see-how-desk')).toBeVisible()
  const phoneHome = page.locator('[data-testid=see-how-row][data-page=home]')
  await phoneHome.scrollIntoViewIfNeeded()
  await expect(phoneHome.getByTestId('see-how-play')).toBeVisible()
  await expect(phoneHome.getByTestId('see-how-replace')).toBeVisible()
  await expect(phoneHome.getByTestId('see-how-reset')).toBeVisible()
  await shot(page, 'see-how-desk-phone')
  const phonePlayer = await playRow(page, phoneHome)
  await shot(page, 'see-how-player-phone')
  await phonePlayer.getByTestId('see-how-close').click()

  await page.goto('/master/framing')
  await expect(page.getByTestId('master-framing')).toBeVisible()
  await openTip(page, 'master-framing')
  await shot(page, 'framing-tip-phone')

  await page.goto('/p/east-london/admin/live')
  await expect(page.getByTestId('desk-live')).toBeVisible()
  await openTip(page, 'desk-live')
  await shot(page, 'live-tip-phone')
})
