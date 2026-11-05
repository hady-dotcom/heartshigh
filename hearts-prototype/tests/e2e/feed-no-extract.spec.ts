import { expect, test, type Page } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'
import { settled } from './feed-step'

const BASE = '/p/east-london'

async function openFeed(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 30_000 })
  await settled(page, feed)
  return feed
}

test('a clip with no appetiser plays without page errors, and says so', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await fakeYouTube(page)
  const feed = await openFeed(page)
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  await page.evaluate(() => {
    ;(window as unknown as { __HEARTS_CLEAR_APPETISER?: () => void }).__HEARTS_CLEAR_APPETISER?.()
  })
  await expect(page.getByTestId('level-minutes')).toHaveAttribute('data-available', 'no')
  await expect(page.getByTestId('level-minutes')).toHaveText('No extract')
  await page.waitForTimeout(1200)
  expect(errors, errors.join('\n')).toEqual([])
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await page.getByTestId('level-minutes').click()
  await expect(page.getByTestId('toast')).toContainText('This clip has no longer extract.')
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  expect(errors, errors.join('\n')).toEqual([])
})

test('a full talk whose part is not there stays on the clip and says so', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/hearts/talk-part**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ open: false }) }))
  await fakeYouTube(page)
  const feed = await openFeed(page)
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  const cut = await feed.getAttribute('data-cut')
  await page.getByTestId('level-lecture').click()
  await expect(page.getByTestId('level-lecture')).toHaveText('No full talk')
  await expect(page.getByTestId('toast')).toContainText('This clip has no full talk.')
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-cut', cut || '')
  await expect(page.getByTestId('player')).toHaveCount(0)
  expect(page.url()).not.toMatch(/\/course\//)
})
