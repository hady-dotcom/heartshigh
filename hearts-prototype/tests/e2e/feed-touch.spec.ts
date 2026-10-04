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

async function touchSwipe(page: Page, cdp: CDPSession, dx: number, on?: Locator, midway?: () => Promise<void>) {
  const box = (await (on || page.getByTestId('gesture-layer').first()).boundingBox())!
  const x = Math.round(box.x + box.width / 2)
  const y = Math.round(box.y + box.height / 3)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  for (let step = 1; step <= 10; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 10, y, id: 1 }] })
    await page.waitForTimeout(12)
    if (step === 6 && midway) await midway()
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

/** The swipe toast never sits over the words on screen. */
async function toastClearOfWords(page: Page) {
  const hits = await page.evaluate(() => {
    const pill = document.querySelector('[data-testid="toast"] span')?.getBoundingClientRect()
    if (!pill) return []
    return [...document.querySelectorAll<HTMLElement>('.j-chrome .caption, [data-testid="scene-quote"], .slide h2, .slide p, .feed-card h2, .feed-card p, .scenic-lines p')]
      .filter((el) => el.offsetParent && el.textContent?.trim())
      .map((el) => ({ text: el.textContent!.trim().slice(0, 30), box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.left < pill.right && box.right > pill.left && box.top < pill.bottom && box.bottom > pill.top)
      .map(({ text }) => text)
  })
  expect(hits, 'words under the toast').toEqual([])
}

/** A left swipe is "more on this topic", a right swipe "more from this speaker"; each answers with a toast. */
async function swipesLand(page: Page, cdp: CDPSession, feed: Locator, mode: 'hors' | 'appetiser') {
  const toast = page.getByTestId('toast')
  for (const [dx, said] of [[-200, /topic/], [200, /from /i]] as const) {
    await expect(toast).toHaveCount(0, { timeout: 5_000 })
    const before = await feed.getAttribute('data-index')
    await touchSwipe(page, cdp, dx)
    await expect(toast).toHaveText(said)
    await toastClearOfWords(page)
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

test('a question card swipes by touch: the card follows the finger, then the next item comes in from the right', async ({ browser }) => {
  test.setTimeout(120_000)
  const { page, cdp } = await phone(browser)
  await page.evaluate(() => {
    const seen: string[] = []
    ;(window as unknown as { __moves: string[] }).__moves = seen
    const original = Element.prototype.animate
    Element.prototype.animate = function (frames, options) {
      if (this instanceof HTMLElement && this.classList.contains('j-clip') && Array.isArray(frames)) seen.push(frames.map((frame) => String((frame as Keyframe).transform || '')).join(' > '))
      return original.call(this, frames, options)
    }
  })
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total * 3 && (await feed.getAttribute('data-card')) !== 'question'; tries++) {
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(feed, page)
  }
  await expect(feed).toHaveAttribute('data-card', 'question')
  const card = page.getByTestId('feed-question')
  expect(await card.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none')

  const before = await feed.getAttribute('data-index')
  let dragged = 0
  await touchSwipe(page, cdp, -220, card.locator('h2'), async () => {
    dragged = await page.locator('.j-clip').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41)
  })
  expect(dragged, 'the card moves left under the finger').toBeLessThan(-60)
  await expect(page.getByTestId('toast')).toHaveText(/topic|everything/)
  await settled(feed, page)
  if (!/everything/.test((await page.getByTestId('toast').textContent().catch(() => '')) || '')) {
    expect(await feed.getAttribute('data-index')).not.toBe(before)
    const moves = await page.evaluate(() => (window as unknown as { __moves: string[] }).__moves)
    expect(moves.some((move) => /translateX\(-?\d+(\.\d+)?px\) > translateX\(-100%\)/.test(move)), moves.join(' | ')).toBe(true)
    expect(moves, 'the next item comes in from the right').toContain('translateX(100%) > translate(0, 0)')
  }

  // A short drag springs back and stays put; Continue still taps.
  await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 5_000 })
  for (let tries = 0; tries < total * 3 && (await feed.getAttribute('data-card')) !== 'question'; tries++) {
    const at = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', at!)
    await settled(feed, page)
  }
  if ((await feed.getAttribute('data-card')) === 'question') {
    const still = await feed.getAttribute('data-index')
    await touchSwipe(page, cdp, -30, page.getByTestId('feed-question').locator('h2'))
    await page.waitForTimeout(600)
    await expect(feed).toHaveAttribute('data-index', still!)
    expect(await page.locator('.j-clip').evaluate((el) => getComputedStyle(el).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/)
    await page.getByTestId('feed-card-next').tap()
    await expect(feed).not.toHaveAttribute('data-index', still!)
  }
  await page.context().close()
})
