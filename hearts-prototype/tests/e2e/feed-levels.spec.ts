import { expect, test, type Page } from '@playwright/test'
import { settled, stepFeed } from './feed-step'

// Navigation stays on one level: swipes loop within hors d'oeuvres (films and cards included) or within appetisers,
// and only Learn more goes down, to the parent of the item being watched.

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function swipe(page: Page, dx: number, dy: number) {
  await page.waitForFunction(() => !document.querySelector('.j-clip')?.getAnimations().length)
  const box = (await page.getByTestId('gesture-layer').first().boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 3
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx, cy + dy, { steps: 8 })
  await page.mouse.up()
}

async function step(page: Page, feed: ReturnType<Page['getByTestId']>, move: string) {
  const before = await feed.getAttribute('data-index')
  await page.getByTestId(move).dispatchEvent('click')
  await expect.poll(async () => (await feed.getAttribute('data-index')) !== before || /seen everything|only clip|everything from|everything on this topic/i.test((await page.getByTestId('toast').innerText().catch(() => '')) || '')).toBe(true)
  if ((await feed.getAttribute('data-index')) === before) return 'end' as const
  await settled(page, feed)
  return 'ok' as const
}

test('swipes keep to the level being watched, and Learn more goes to the watched item’s own parent', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await signIn(page, `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(feed).toHaveAttribute('data-cuts', /\d+ \d+/)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-mode', 'hors')

  // Walk until a film or scene, collecting each talk's own parent. Do not wrap.
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  const kinds = new Set<string>()
  const talkParent = new Map<string, string>()
  for (let at = 0; at < total; at++) {
    const kind = (await feed.getAttribute('data-card')) || ''
    kinds.add(kind)
    if (kind === 'talk' && (await page.getByTestId('learn-more').count())) talkParent.set((await feed.getAttribute('data-cut'))!, (await page.getByTestId('learn-more').getAttribute('data-parent'))!)
    await expect(feed).toHaveAttribute('data-mode', 'hors')
    if (kind !== 'talk') break
    if ((await stepFeed(page, feed)) === 'end') break
  }
  expect([...kinds].some((kind) => kind !== 'talk'), `cards met: ${[...kinds].join(', ')}`).toBe(true)
  expect(await feed.getAttribute('data-card')).not.toBe('talk')
  for (const [dx, dy] of [[-220, 0], [0, 220], [220, 0], [0, -220]] as const) {
    await swipe(page, dx, dy)
    await settled(page, feed)
    await expect(feed).toHaveAttribute('data-mode', 'hors')
  }

  const card = await feed.getAttribute('data-card')
  expect(card).not.toBe('talk')
  const cut = (await feed.getAttribute('data-cut'))!
  expect(talkParent.get(cut)).toMatch(/^appetiser:/)
  await expect(page.getByTestId('learn-more')).toHaveAttribute('data-parent', talkParent.get(cut)!)
  await expect(page.getByTestId('learn-more')).toHaveAttribute('data-parent-level', 'appetiser')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-cut', cut)
  await expect(feed).toHaveAttribute('data-card', 'talk')
  expect(new URL(page.url()).searchParams.get('clip')).toBe(cut)
  expect(new URL(page.url()).searchParams.get('play')).toBe('appetiser')
  await settled(page, feed)

  // The appetiser loop: next, previous and every swipe direction stay on appetisers, never on a card.
  const talkCuts = new Set<string>()
  for (const move of ['gesture-next', 'gesture-next', 'gesture-prev']) {
    const moved = await step(page, feed, move)
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(feed).toHaveAttribute('data-card', 'talk')
    if (moved === 'ok') talkCuts.add((await feed.getAttribute('data-cut'))!)
  }
  talkCuts.add((await feed.getAttribute('data-cut'))!)
  expect(talkCuts.size).toBeGreaterThan(1)
  for (const [dx, dy] of [[-220, 0], [0, 220], [220, 0], [0, -220]] as const) {
    await swipe(page, dx, dy)
    await settled(page, feed)
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(feed).toHaveAttribute('data-card', 'talk')
  }

  // Learn more on the appetiser opens its own full talk, from the start.
  const lesson = (await feed.getAttribute('data-lesson'))!
  const own = page.getByTestId('learn-more')
  await expect(own).toHaveAttribute('data-parent', `talk:${lesson}`)
  await own.click()
  await page.waitForURL(new RegExp(`/course/\\d+\\?part=${lesson}&t=0$`))
})
