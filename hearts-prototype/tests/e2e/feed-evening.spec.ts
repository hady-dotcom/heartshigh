import { expect, test, type Browser, type CDPSession, type Locator, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'

// Live phone review: evening-garden question cards, no blank pill, no bare side mid-swipe, YouTube's captions and
// titled thumbnails kept off our feed.

const PORTAL = '/p/east-london'
const PARCHMENT = 'rgb(246, 238, 220)'
const GOLD = 'rgb(212, 168, 75)'

async function phone(browser: Browser, options: { blockAutoplay?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, timezoneId: 'Europe/London' })
  const page = await context.newPage()
  // Evening on the phone, so the toast sits on the theme whose parchment ink once made it a blank pill.
  await page.clock.setFixedTime(new Date('2026-10-04T20:30:00+01:00'))
  await fakeYouTube(page, options)
  await page.goto(`/login?next=${encodeURIComponent(`${PORTAL}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').tap()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  return { page, cdp: await context.newCDPSession(page) }
}

async function touchSwipe(page: Page, cdp: CDPSession, dx: number, on?: Locator) {
  await page.waitForFunction(() => !document.querySelector('.j-clip')?.getAnimations().length)
  const box = (await (on || page.getByTestId('gesture-layer').first()).boundingBox())!
  const x = Math.round(box.x + box.width / 2)
  const y = Math.round(box.y + box.height / 3)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  for (let step = 1; step <= 12; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 12, y, id: 1 }] })
    await page.waitForTimeout(16)
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

async function stepTo(page: Page, feed: Locator, card: string) {
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total * 3 && (await feed.getAttribute('data-card')) !== card; tries++) {
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(feed, page)
  }
  await expect(feed).toHaveAttribute('data-card', card)
}

/**
 * Every animation frame: the four edges of the phone are covered by the card or a neighbour whose still has
 * loaded, and any toast on screen has words that can be read against its pill.
 */
async function watchFrames(page: Page) {
  await page.evaluate(() => {
    type Frames = { count: number; bare: string[]; blank: string[] }
    const store = window as unknown as { __frames: Frames }
    store.__frames = { count: 0, bare: [], blank: [] }
    const rgb = (value: string) => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
    const luminance = (value: string) => {
      const [r, g, b] = rgb(value).map((channel) => {
        const c = channel / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const inside = (rect: DOMRect, x: number, y: number) => x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
    const tick = () => {
      const root = document.querySelector<HTMLElement>('.journey')
      if (root?.dataset.phase === 'feed') {
        const box = root.getBoundingClientRect()
        const layers: { rect: DOMRect; ready: boolean; name: string }[] = []
        const clip = document.querySelector('.j-clip')
        if (clip) layers.push({ rect: clip.getBoundingClientRect(), ready: true, name: 'card' })
        document.querySelectorAll<HTMLElement>('.j-peek').forEach((peek) => {
          const image = peek.querySelector('img')
          const ready = image ? image.complete && image.naturalWidth > 0 : Boolean(peek.querySelector('.feed-card, .slide'))
          layers.push({ rect: peek.getBoundingClientRect(), ready, name: `peek-${peek.dataset.peek}` })
        })
        const points = [
          [box.left + 4, box.top + box.height / 2],
          [box.right - 5, box.top + box.height / 2],
          [box.left + box.width / 2, box.top + 4],
          [box.left + box.width / 2, box.bottom - 5],
        ]
        for (const [x, y] of points) {
          const hit = layers.find((layer) => inside(layer.rect, x, y))
          if (!hit || !hit.ready) store.__frames.bare.push(`${Math.round(x)},${Math.round(y)}: ${hit ? `${hit.name} not loaded` : 'nothing'}`)
        }
        const toast = document.querySelector('[data-testid="toast"]')
        if (toast) {
          const pill = toast.querySelector('span')
          const text = pill?.textContent?.trim() || ''
          const style = pill ? getComputedStyle(pill) : null
          if (!text || !style || contrast(style.color, style.backgroundColor) < 4.5) store.__frames.blank.push(`${text || '(empty)'} ${style?.color} on ${style?.backgroundColor}`)
        }
        store.__frames.count += 1
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

const frames = (page: Page) => page.evaluate(() => (window as unknown as { __frames: { count: number; bare: string[]; blank: string[] } }).__frames)

test('question cards are the evening garden: teal gradient over a blurred courtyard, parchment words, a gold Continue, and the video Follow row', async ({ browser }) => {
  test.setTimeout(90_000)
  const { page } = await phone(browser, { blockAutoplay: true })
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await stepTo(page, feed, 'talk')
  const followOn = (where: Page) => where.locator('.j-chrome .clip-foot .follow').evaluate((el) => {
    const style = getComputedStyle(el)
    return { color: style.color, border: style.borderColor, background: style.backgroundColor }
  })
  const whoOn = (where: Page) => where.locator('.j-chrome .clip-foot .speaker-row b').evaluate((el) => getComputedStyle(el).color)
  const videoFollow = await followOn(page)
  const videoWho = await whoOn(page)

  await stepTo(page, feed, 'question')
  const card = page.getByTestId('feed-question')
  await expect(card.locator('h2')).toHaveText('What stays with you from this?')
  const look = await card.evaluate((el) => {
    const style = getComputedStyle(el)
    const bg = el.querySelector('.feed-card-bg')!
    const bgStyle = getComputedStyle(bg)
    return {
      image: style.backgroundImage,
      color: style.backgroundColor,
      garden: bgStyle.backgroundImage,
      blur: bgStyle.filter,
      title: getComputedStyle(el.querySelector('h2')!).color,
      kicker: getComputedStyle(el.querySelector('.kicker')!).color,
      cta: getComputedStyle(el.querySelector('[data-testid="feed-card-next"]')!).backgroundColor,
    }
  })
  expect(look.image, 'a deep teal gradient, not a flat page').toMatch(/linear-gradient\(.*rgb\(1[0-5], (3\d|4\d|5\d), (3\d|4\d|5\d)\)/)
  expect(look.color).not.toMatch(/rgb\(24\d, 2[34]\d, 2[12]\d\)/)
  expect(look.garden).toContain('evening-courtyard')
  expect(look.blur).toMatch(/blur\(\d+px\)/)
  expect(look.title).toBe(PARCHMENT)
  expect(look.cta, 'Continue is gold').toBe(GOLD)
  expect(await followOn(page), 'the Follow row matches the video cards').toEqual(videoFollow)
  expect(await whoOn(page)).toBe(videoWho)
  await page.screenshot({ path: test.info().outputPath('question-card.png') })
  await page.context().close()
})

test('a question-card swipe and a scenic-card swipe never show a bare side or a blank pill', async ({ browser }) => {
  test.setTimeout(120_000)
  const { page, cdp } = await phone(browser, { blockAutoplay: true })
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await watchFrames(page)

  for (const card of ['question', 'scene', 'talk']) {
    await stepTo(page, feed, card)
    const peek = page.locator('[data-peek="topic"]')
    await expect(peek, `the next ${card} neighbour is mounted before the gesture`).toHaveCount(1)
    await expect.poll(() => peek.evaluate((el) => {
      const image = el.querySelector('img')
      return image ? image.complete && image.naturalWidth > 0 : Boolean(el.querySelector('.feed-card, .slide'))
    }), { message: 'its still is loaded' }).toBe(true)
    const target = await peek.getAttribute('data-index')
    const before = await feed.getAttribute('data-index')
    await touchSwipe(page, cdp, -230, card === 'question' ? page.getByTestId('feed-question').locator('h2') : undefined)
    await expect(page.getByTestId('toast')).toHaveText(/topic|everything/)
    await settled(feed, page)
    if ((await feed.getAttribute('data-index')) !== before) expect(await feed.getAttribute('data-index')).toBe(target)
    await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 5_000 })
  }
  const seen = await frames(page)
  expect(seen.count, 'frames were sampled through the swipes').toBeGreaterThan(60)
  expect(seen.bare, 'no frame leaves an edge of the phone bare').toEqual([])
  expect(seen.blank, 'no toast is empty or unreadable').toEqual([])
  await page.context().close()
})

test('words in the picture: YouTube captions are dropped, our caption hides, and the speaker and Follow leave the lower quarter', async ({ browser, playwright }) => {
  test.setTimeout(90_000)
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const { page } = await phone(browser)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await stepTo(page, feed, 'talk')
  const lessonId = await feed.getAttribute('data-lesson')
  const cut = await feed.getAttribute('data-cut')
  try {
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: true } })).ok()).toBeTruthy()
    await page.goto(`${PORTAL}/feed?clip=${cut}`)
    await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
    await expect(feed).toHaveAttribute('data-lesson', lessonId!)
    await expect(feed).toHaveAttribute('data-words-in-picture', 'yes')
    await expect(page.getByTestId('caption')).toHaveCount(0)
    const top = page.getByTestId('top-speaker')
    await expect(top.getByRole('button', { name: /follow/i })).toBeVisible()
    const box = (await top.boundingBox())!
    expect(box.y + box.height, 'the speaker and Follow sit above the lower quarter').toBeLessThan(844 * 0.75)
    expect(box.y + box.height).toBeLessThan(844 * 0.4)
    await expect(page.locator('.clip-foot [data-testid="speaker-link"]')).toHaveCount(0)

    await expect.poll(() => page.evaluate(() => (window as unknown as { __unloaded: string[] }).__unloaded)).toContain('captions')
    const vars = (await page.evaluate(() => (window as unknown as { __playerVars: Record<string, unknown>[] }).__playerVars)).at(-1)!
    expect(vars).toMatchObject({ cc_load_policy: 0, iv_load_policy: 3 })
    expect(vars.cc_lang_pref, 'no language hint that would pull captions in').toBeUndefined()
  } finally {
    await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: false } })
    await master.dispose()
    await page.context().close()
  }
})

test('the extended cut opens on our own poster with the talk title, never a titled YouTube thumbnail', async ({ browser, playwright }) => {
  test.setTimeout(90_000)
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const { page } = await phone(browser, { blockAutoplay: true })
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await stepTo(page, feed, 'talk')
  const lessonId = await feed.getAttribute('data-lesson')
  const cut = await feed.getAttribute('data-cut')
  await page.getByTestId('learn-more').tap()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-video', 'yes')
  const poster = page.getByTestId('poster-frame')
  await expect(poster).toHaveAttribute('data-poster', 'own')
  expect(await poster.locator('img').first().getAttribute('src')).not.toMatch(/ytimg|youtube|\/clips\//)
  await expect(poster.getByTestId('poster-title')).toContainText('Extended cut')
  expect(((await poster.getByTestId('poster-title').locator('b').textContent()) || '').trim().length).toBeGreaterThan(3)
  await expect(page.getByTestId('poster-play')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('extended-cut-poster.png') })

  try {
    // Marked clean, YouTube's large frame is tried; when it cannot load, our own still and title come back.
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { thumbnailClean: true } })).ok()).toBeTruthy()
    await page.goto(`${PORTAL}/feed?clip=${cut}&play=appetiser`)
    await expect(feed).toHaveAttribute('data-mode', 'appetiser', { timeout: 20_000 })
    await expect(page.getByTestId('poster-frame')).toHaveAttribute('data-poster', 'frame')
    await expect(page.getByTestId('poster-frame').getByTestId('poster-title')).toBeVisible()
    expect(await page.getByTestId('poster-frame').locator('img').first().getAttribute('src')).not.toMatch(/ytimg|\/clips\//)
  } finally {
    await master.patch(`/api/lessons/${lessonId}`, { data: { thumbnailClean: false } })
    await master.dispose()
    await page.context().close()
  }
})
