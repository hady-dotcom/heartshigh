import { expect, test, type Page } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }
const PORTAL = '/p/east-london'

async function signIn(page: Page, next = `${PORTAL}/feed`) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function settled(page: Page) {
  const feed = page.getByTestId('journey')
  let last = ''
  await expect(async () => {
    const now = `${await feed.getAttribute('data-index')}:${await feed.getAttribute('data-mode')}`
    const same = now === last
    last = now
    expect(same).toBe(true)
  }).toPass({ timeout: 10_000, intervals: [400] })
  await page.waitForTimeout(150)
}

async function step(page: Page) {
  const feed = page.getByTestId('journey')
  const before = await feed.getAttribute('data-index')
  await page.getByTestId('gesture-next').dispatchEvent('click')
  await expect(feed).not.toHaveAttribute('data-index', before!)
  await settled(page)
}

test('the feed has no question cards, shows the coach and tab bar, and never lights Home', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  await expect(page.getByTestId('swipe-coach')).toBeVisible()
  await expect(page.getByTestId('tabbar')).toBeVisible()
  await expect(page.getByTestId('tab-home')).not.toHaveAttribute('aria-current', 'page')
  await page.getByTestId('swipe-coach').click()
  await expect(page.getByTestId('swipe-coach')).toHaveCount(0)
  const kinds: string[] = []
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  const total = Math.min(24, Math.max(8, listed))
  for (let at = 0; at < total; at++) {
    kinds.push((await feed.getAttribute('data-card')) || '')
    expect(await page.locator('[data-card="question"]').count()).toBe(0)
    await expect(page.getByTestId('feed-question')).toHaveCount(0)
    await expect(page.getByText('What stays with you from this')).toHaveCount(0)
    if (at < total - 1) await step(page)
  }
  expect(kinds.includes('question')).toBe(false)
})

test('Ready for more? opens the same speaker, and the step-up names a duration or a talk count', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'talk'; tries++) await step(page)
  await expect(feed).toHaveAttribute('data-card', 'talk')
  const speaker = await feed.getAttribute('data-speaker')
  const lesson = await feed.getAttribute('data-lesson')
  const more = page.getByTestId('learn-more')
  await expect(more).toHaveText(/Watch the 3-minute version|See the whole course|Watch the whole talk/)
  await expect(more).toHaveAttribute('data-speaker', speaker!)
  await expect(page.getByTestId('level-steps')).toContainText('Clip')
  await more.click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-speaker', speaker!)
  await expect(feed).toHaveAttribute('data-lesson', lesson!)
  await expect(page.getByTestId('learn-more')).toHaveText(/Watch the whole talk|See the whole course/)
  await expect(page.getByText('Ready for more?')).toBeVisible()
})

test('Tap for sound unmutes and plays, and the next clip keeps sound', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page, { blockAutoplay: true })
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  await expect(page.getByTestId('tap-sound').first()).toBeVisible({ timeout: 15_000 })
  for (let tryNo = 0; tryNo < 10; tryNo++) {
    if (await page.getByTestId('tap-sound').count()) await page.getByTestId('tap-sound').first().click()
    else if (await page.getByTestId('tap-to-play').count()) await page.getByTestId('tap-to-play').click()
    await expect.poll(async () => feed.getAttribute('data-player-muted')).toBe('no')
    const frozen = (await feed.getAttribute('data-player-state')) === '2' && (await page.getByTestId('tap-to-play').count()) === 0
    expect(frozen, `try ${tryNo + 1} left paused with no Tap to play`).toBe(false)
  }
  await page.getByTestId('gesture-next').dispatchEvent('click')
  await settled(page)
  const mutedAgain = await feed.getAttribute('data-player-muted')
  const pill = await page.getByTestId('tap-sound').count()
  expect(mutedAgain === 'no' || pill > 0).toBe(true)
})

test('hidden hosts stay paused and muted across clip-end, swipe and a sit on a scenic card', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const hiddenPlaying = async () => page.evaluate(() => {
    const rows = (window as unknown as { __HEARTS_FEED_SNAP?: () => { hidden: boolean; state: number; muted: boolean }[] }).__HEARTS_FEED_SNAP?.() || []
    return rows.filter((row) => row.hidden && row.state === 1 && !row.muted)
  })
  for (let at = 0; at < 10; at++) {
    expect(await hiddenPlaying(), `hidden audio after step ${at}`).toEqual([])
    await step(page)
  }
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'scene'; tries++) await step(page)
  if ((await feed.getAttribute('data-card')) === 'scene') {
    const first = await page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { hidden: boolean; currentTime: number; state: number }[] }).__HEARTS_FEED_SNAP?.() || []).map((row) => row.currentTime))
    await page.waitForTimeout(1200)
    const later = await page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { hidden: boolean; currentTime: number; state: number }[] }).__HEARTS_FEED_SNAP?.() || []).map((row) => ({ ...row })))
    expect(later.filter((row) => row.state === 1)).toEqual([])
    expect(later.map((row) => row.currentTime)).toEqual(first)
  }
})

test('leaving the feed and coming back lands on the same clip', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  await step(page)
  await step(page)
  await step(page)
  const cut = await feed.getAttribute('data-cut')
  const index = await feed.getAttribute('data-index')
  await page.goto(`${PORTAL}/garden`)
  await page.goto(`${PORTAL}/feed`)
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  await expect(feed).toHaveAttribute('data-cut', cut!)
  expect(await feed.getAttribute('data-index')).toBe(index)
})

test('the feed still fits at 1440×900', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize(DESKTOP)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(page.getByTestId('tabbar')).toBeVisible()
  await expect(page.getByTestId('learn-more')).toBeVisible()
})
