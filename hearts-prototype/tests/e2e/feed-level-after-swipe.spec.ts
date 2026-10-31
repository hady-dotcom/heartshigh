import { expect, test, type Browser, type CDPSession, type Page } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'
import { settled } from './feed-step'

const BASE = '/p/east-london'

function phone(browser: Browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
}

async function openFeed(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 30_000 })
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await expect(page.getByTestId('player-slot')).toHaveAttribute('data-framing', 'F')
  await expect(page.getByTestId('spoken-words')).toBeAttached()
  return feed
}

async function touch(page: Page, cdp: CDPSession, from: { x: number; y: number }, dx: number, dy: number) {
  const x = Math.round(from.x)
  const y = Math.round(from.y)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  const steps = 8
  for (let step = 1; step <= steps; step++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: Math.round(x + (dx * step) / steps), y: Math.round(y + (dy * step) / steps), id: 1 }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function filmPoint(page: Page) {
  const box = (await page.getByTestId('film-band').boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + Math.min(40, box.height / 3) }
}

/** A swipe can leave the More sheet holding a finger-down that never lifted. */
async function stickDrag(page: Page) {
  await page.getByTestId('feed-board').evaluate((node) => {
    node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 12, clientY: 24, pointerId: 4 }))
  })
}

async function tapControl(page: Page, cdp: CDPSession, testId: string) {
  const box = (await page.getByTestId(testId).boundingBox())!
  await touch(page, cdp, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, 0)
}

test('after a swipe, extract and the full talk answer the first tap', async ({ browser }) => {
  test.setTimeout(180_000)
  const context = await phone(browser)
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.localStorage.setItem('hearts.feed-coach.v1', 'true')
  })
  await fakeYouTube(page)
  const cdp = await context.newCDPSession(page)
  const size = page.viewportSize()
  expect(size).toEqual({ width: 390, height: 844 })

  const feed = await openFeed(page)
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  const firstCut = await feed.getAttribute('data-cut')
  const firstIndex = await feed.getAttribute('data-index')

  await touch(page, cdp, await filmPoint(page), 0, -220)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-framing', 'F')
  expect(await feed.getAttribute('data-index')).not.toBe(firstIndex)
  const secondCut = await feed.getAttribute('data-cut')
  expect(secondCut).not.toBe(firstCut)
  await expect(page.getByTestId('level-minutes')).toHaveAttribute('data-available', 'yes')
  await expect(page.getByTestId('spoken-words')).toBeAttached()

  await stickDrag(page)
  await tapControl(page, cdp, 'level-minutes')
  await expect(feed).toHaveAttribute('data-mode', 'appetiser', { timeout: 15_000 })
  await expect(feed).toHaveAttribute('data-cut', secondCut || '')
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await tapControl(page, cdp, 'level-minutes')
  await tapControl(page, cdp, 'level-minutes')
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-cut', secondCut || '')
  await expect(page.getByTestId('player-slot')).toHaveAttribute('data-framing', 'F')
  await expect(page.getByTestId('spoken-words')).toBeAttached()

  await tapControl(page, cdp, 'level-clip')
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-cut', secondCut || '')

  const beforeThird = await feed.getAttribute('data-index')
  await touch(page, cdp, await filmPoint(page), 0, -220)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  expect(await feed.getAttribute('data-index')).not.toBe(beforeThird)
  const thirdCut = await feed.getAttribute('data-cut')
  expect(thirdCut).not.toBe(secondCut)
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await expect(page.getByTestId('spoken-words')).toBeAttached()

  await stickDrag(page)
  await tapControl(page, cdp, 'level-minutes')
  await expect(feed).toHaveAttribute('data-mode', 'appetiser', { timeout: 15_000 })
  await expect(feed).toHaveAttribute('data-cut', thirdCut || '')
  await tapControl(page, cdp, 'level-minutes')
  await tapControl(page, cdp, 'level-minutes')
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await expect(page.getByTestId('spoken-words')).toBeAttached()

  await stickDrag(page)
  for (let tap = 0; tap < 3; tap++) {
    if (await page.getByTestId('player').count()) break
    const box = await page.getByTestId('level-lecture').boundingBox()
    if (!box) break
    await touch(page, cdp, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, 0)
    await page.waitForTimeout(120)
  }
  const player = page.getByTestId('player')
  await expect(player).toBeVisible({ timeout: 20_000 })
  await expect(player).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  await context.close()
})
