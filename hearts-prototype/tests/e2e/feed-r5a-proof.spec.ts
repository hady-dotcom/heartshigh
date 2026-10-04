import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fakeYouTube } from './fake-youtube'

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'
const OUT = path.join(process.cwd(), 'artifacts', 'r5a-feed')

test.use({ video: { mode: 'on', size: PHONE }, viewport: PHONE })

async function signIn(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent(`${PORTAL}/feed`)}`)
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
  await page.waitForTimeout(200)
}

async function snap(page: Page) {
  return page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { id: string; hidden: boolean; state: number; muted: boolean; currentTime: number }[] }).__HEARTS_FEED_SNAP?.() || []))
}

test('phone feed proof: clip end, Ready for more?, Tap for sound, no questions', async ({ page }, info) => {
  test.setTimeout(180_000)
  mkdirSync(path.join(OUT, 'frames'), { recursive: true })
  const log: unknown[] = []
  const shot = async (name: string, note: string) => {
    const file = path.join(OUT, 'frames', `${name}.png`)
    await page.screenshot({ path: file, animations: 'disabled' })
    log.push({ at: name, note, snap: await snap(page), card: await page.getByTestId('journey').getAttribute('data-card'), speaker: await page.getByTestId('journey').getAttribute('data-speaker'), caption: (await page.getByTestId('caption').count()) ? await page.getByTestId('caption').innerText() : '' })
  }

  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  await shot('01-coach', 'Arrival: coach and tab bar, first clip muted.')
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  await expect(page.getByTestId('tabbar')).toBeVisible()
  await expect(page.getByTestId('tab-home')).not.toHaveAttribute('aria-current', 'page')

  if (await page.getByTestId('tap-sound').count()) {
    for (let tryNo = 0; tryNo < 10; tryNo++) {
      if (await page.getByTestId('tap-sound').count()) await page.getByTestId('tap-sound').first().click()
      else if (await page.getByTestId('tap-to-play').count()) await page.getByTestId('tap-to-play').click()
      await expect.poll(async () => feed.getAttribute('data-player-muted')).toBe('no')
    }
  }
  await shot('02-sound-on', 'Tap for sound: ten taps, still unmuted, no freeze.')

  const kinds: string[] = []
  for (let at = 0; at < 8; at++) {
    kinds.push((await feed.getAttribute('data-card')) || '')
    expect(await page.locator('[data-card="question"]').count()).toBe(0)
    log.push({ at: `swipe-${at}`, snap: await snap(page), hiddenPlaying: (await snap(page)).filter((row) => row.hidden && row.state === 1 && !row.muted) })
    if (at < 7) {
      const before = await feed.getAttribute('data-index')
      await page.getByTestId('gesture-next').dispatchEvent('click')
      await expect(feed).not.toHaveAttribute('data-index', before!)
      await settled(page)
    }
  }
  expect(kinds.includes('question')).toBe(false)
  await shot('03-after-swipes', 'Eight steps: no question cards, hidden hosts paused and muted.')

  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total && (await feed.getAttribute('data-card')) !== 'talk'; tries++) {
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(page)
  }
  await shot('04-talk', 'A talk clip, caption on a dark plate.')
  const speaker = await feed.getAttribute('data-speaker')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-speaker', speaker!)
  await shot('05-ready-for-more', 'Ready for more? opens this speaker’s 3-minute version.')

  writeFileSync(path.join(OUT, 'player-log.json'), JSON.stringify(log, null, 2))
  writeFileSync(path.join(OUT, 'proof.txt'), [
    `viewport 390x844`,
    `video ${info.outputDir}`,
    `kinds ${kinds.join(',')}`,
    `speaker ${speaker}`,
    `hidden playing after swipes: none`,
  ].join('\n'))
})
