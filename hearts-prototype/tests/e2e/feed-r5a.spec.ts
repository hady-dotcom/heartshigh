import { expect, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { captionIsSpoken, chromeBoxesClear, chromeCentresClear, settled, stepFeed, type OpeningClip } from './feed-step'

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

async function step(page: Page) {
  return stepFeed(page)
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
  await expect(page.getByTestId('tab-week')).toHaveText('My week')
  await expect(page.getByTestId('tab-gather')).toHaveCount(0)
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
    if (at < total - 1 && (await step(page)) === 'end') break
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
  await expect(page.locator('.chip.gold')).toHaveText('Ready for more?')
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
    if ((await step(page)) === 'end') break
  }
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'scene'; tries++) {
    if ((await step(page)) === 'end') break
  }
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
  await page.goto(`${PORTAL}/garden`)
  await page.goto(`${PORTAL}/feed`)
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  await expect(feed).toHaveAttribute('data-cut', cut!)
})

test('the caption is the timed transcript for now and never the talk title', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const opening = (await (await page.request.get('/api/hearts/opening?portal=east-london')).json()) as { clips: Record<string, OpeningClip> }
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  const total = Math.min(16, Math.max(6, listed))
  let talks = 0
  for (let at = 0; at < total; at++) {
    if ((await feed.getAttribute('data-card')) === 'talk') {
      talks += 1
      await captionIsSpoken(page, opening.clips)
    }
    if (at < total - 1 && (await step(page)) === 'end') break
  }
  expect(talks, 'the mix must include a talk so the caption rule is checked').toBeGreaterThan(0)
})

test('talk captions spell taqwa, not tawa, and sit in the bar when words are in the picture', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  const total = Math.min(16, Math.max(6, listed))
  for (let at = 0; at < total; at++) {
    if ((await feed.getAttribute('data-card')) === 'talk' && (await page.getByTestId('caption').count())) {
      const text = await page.getByTestId('caption').innerText()
      expect(text, 'auto-captions must not leave tawa for taqwa').not.toMatch(/\btawa\b/i)
      expect(text).not.toMatch(/\btawakul\b/i)
      expect(text, 'display tidy drops the raw transcript stumble').not.toMatch(/I was doing your I was/i)
      if ((await feed.getAttribute('data-words-in-picture')) === 'yes') {
        await expect(page.getByTestId('caption')).toHaveAttribute('data-slot', 'bar')
        const cap = (await page.getByTestId('caption').boundingBox())!
        const slot = (await page.getByTestId('player-slot').boundingBox())!
        expect(cap.y).toBeGreaterThanOrEqual(slot.y + slot.height - 12)
      }
    }
    if (at < total - 1 && (await step(page)) === 'end') break
  }
})

test('a session does not repeat a talk or a scene card until the pool is used up', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const seenTalks = new Set<string>()
  const seenScenes = new Set<string>()
  for (let at = 0; at < 20; at++) {
    const card = (await feed.getAttribute('data-card')) || 'talk'
    const cut = await feed.getAttribute('data-cut')
    const key = `${cut}:${card}`
    if (card === 'talk') {
      expect(seenTalks.has(key), `talk ${cut} repeated`).toBe(false)
      seenTalks.add(key)
    }
    if (card === 'scene') {
      expect(seenScenes.has(key), `scene ${cut} repeated`).toBe(false)
      seenScenes.add(key)
    }
    if ((await step(page)) === 'end') {
      await expect(page.getByTestId('toast')).toContainText("You've seen everything here, try another lane.")
      break
    }
  }
})

test('every chrome pair is clear at its centre, with and without words in the picture', async ({ page, playwright }) => {
  test.setTimeout(90_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  const listed = ((await feed.getAttribute('data-cuts')) || '').split(' ').filter(Boolean).length
  for (let tries = 0; tries < listed && (await feed.getAttribute('data-card')) !== 'talk'; tries++) {
    if ((await step(page)) === 'end') break
  }
  await expect(feed).toHaveAttribute('data-card', 'talk')
  await chromeBoxesClear(page)
  await expect(page.getByTestId('tap-sound').first()).toBeVisible({ timeout: 15_000 })
  await chromeCentresClear(page)
  const lessonId = await feed.getAttribute('data-lesson')
  const cut = await feed.getAttribute('data-cut')
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  try {
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: true } })).ok()).toBeTruthy()
    await page.goto(`${PORTAL}/feed?clip=${cut}&fresh=${Date.now()}`)
    await expect(feed).toHaveAttribute('data-words-in-picture', 'yes', { timeout: 20_000 })
    await settled(page)
    if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
    await expect(page.getByTestId('top-speaker')).toBeVisible()
    await expect(page.getByTestId('lane-chip')).toBeVisible()
    await expect(page.getByTestId('clip-timer')).toBeVisible()
    await chromeBoxesClear(page)
    await chromeCentresClear(page)
  } finally {
    await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: false } })
    await master.dispose()
  }
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
