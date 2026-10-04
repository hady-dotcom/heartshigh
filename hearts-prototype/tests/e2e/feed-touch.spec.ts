import { expect, test, type Browser, type CDPSession, type Locator, type Page } from '@playwright/test'

// Real touch, not the mouse: a phone context, and touches sent through Chromium's input pipeline (CDP), so the
// browser's own touch-action handling runs. If it claims the pan, it fires pointercancel and no swipe lands.

const PORTAL = '/p/east-london'

async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  const page = await context.newPage()
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await page.goto(`/login?next=${encodeURIComponent(`${PORTAL}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').tap()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  return { page, cdp: await context.newCDPSession(page) }
}

async function touchSwipe(page: Page, cdp: CDPSession, dx: number) {
  const box = (await page.getByTestId('gesture-layer').first().boundingBox())!
  const x = Math.round(box.x + box.width / 2)
  const y = Math.round(box.y + box.height / 3)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  for (let step = 1; step <= 10; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 10, y, id: 1 }] })
    await page.waitForTimeout(12)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

async function settled(feed: Locator, page: Page) {
  let last = ''
  await expect(async () => {
    const now = `${await feed.getAttribute('data-index')}:${await feed.getAttribute('data-mode')}`
    const same = now === last
    last = now
    expect(same).toBe(true)
  }).toPass({ timeout: 10_000, intervals: [400] })
  await page.waitForTimeout(150)
}

/** A left swipe is "more on this topic", a right swipe "more from this speaker"; each answers with a toast. */
async function swipesLand(page: Page, cdp: CDPSession, feed: Locator, mode: 'hors' | 'appetiser') {
  const toast = page.getByTestId('toast')
  for (const [dx, said] of [[-200, /topic/], [200, /from /i]] as const) {
    await expect(toast).toHaveCount(0, { timeout: 5_000 })
    const before = await feed.getAttribute('data-index')
    await touchSwipe(page, cdp, dx)
    await expect(toast).toHaveText(said)
    await settled(feed, page)
    await expect(feed).toHaveAttribute('data-mode', mode)
    if (!/everything|only/.test((await toast.textContent().catch(() => '')) || '')) expect(await feed.getAttribute('data-index')).not.toBe(before)
  }
}

test('touch swipes left and right move the feed, on a talk clip, on a card, and in the appetiser loop', async ({ browser }) => {
  test.setTimeout(120_000)
  const { page, cdp } = await phone(browser)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await expect(feed).toHaveAttribute('data-mode', 'hors')

  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  const step = async () => {
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(feed, page)
  }

  // A talk's hors d'oeuvre clip (the gesture layer over the player).
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'talk'; tries++) await step()
  await expect(feed).toHaveAttribute('data-card', 'talk')
  await swipesLand(page, cdp, feed, 'hors')

  // A film, scenic or question card (the slide layer).
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) === 'talk'; tries++) await step()
  expect(await feed.getAttribute('data-card')).not.toBe('talk')
  await swipesLand(page, cdp, feed, 'hors')

  // The appetiser loop.
  for (let tries = 0; tries < total && !(await page.getByTestId('learn-more').isVisible()); tries++) await step()
  await page.getByTestId('learn-more').tap()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await settled(feed, page)
  await swipesLand(page, cdp, feed, 'appetiser')
  await page.context().close()
})
