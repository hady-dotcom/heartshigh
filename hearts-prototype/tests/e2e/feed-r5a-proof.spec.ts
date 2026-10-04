import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { settled, stepFeed } from './feed-step'

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'
const OUT = path.join(process.cwd(), 'artifacts', 'r5a-feed')
const TAQWA_VIDEOS = ['U_tCg-U0QSY', 'rUIMxBh3aqo', 'xY7hvYifpxo', 'QOpIvu1uJx0', '45XUrfJS68Q']

test.use({ video: { mode: 'on', size: PHONE }, viewport: PHONE })

async function signIn(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent(`${PORTAL}/feed`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function snap(page: Page) {
  return page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { id: string; hidden: boolean; state: number; muted: boolean; currentTime: number; videoId: string }[] }).__HEARTS_FEED_SNAP?.() || []))
}

async function boxesOverlap(page: Page, a: string, b: string) {
  const first = page.locator(a).first()
  const second = page.locator(b).first()
  if (!(await first.count()) || !(await second.count())) return false
  const left = await first.boundingBox()
  const right = await second.boundingBox()
  if (!left || !right) return false
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
}

test('phone feed proof: no repeats, taqwa, caption bar, advancing mute log', async ({ page, playwright }, info) => {
  test.setTimeout(180_000)
  mkdirSync(path.join(OUT, 'frames'), { recursive: true })
  const log: unknown[] = []
  const shot = async (name: string, note: string, live = false) => {
    const file = path.join(OUT, 'frames', `${name}.png`)
    await page.screenshot({ path: file, animations: live ? 'allow' : 'disabled' })
    log.push({
      at: name,
      note,
      snap: await snap(page),
      card: await page.getByTestId('journey').getAttribute('data-card'),
      cut: await page.getByTestId('journey').getAttribute('data-cut'),
      speaker: await page.getByTestId('journey').getAttribute('data-speaker'),
      caption: (await page.getByTestId('caption').count()) ? await page.getByTestId('caption').innerText() : '',
    })
  }

  await fakeYouTube(page)
  await signIn(page)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(page)
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  if ((await feed.getAttribute('data-card')) !== 'talk') {
    for (let tries = 0; tries < 8 && (await feed.getAttribute('data-card')) !== 'talk'; tries++) {
      if ((await stepFeed(page)) === 'end') break
    }
  }
  await expect(page.getByTestId('level-steps')).toBeVisible()
  await expect(page.getByTestId('speaker-link')).toBeVisible()
  expect(await boxesOverlap(page, '[data-testid="level-steps"]', '[data-testid="speaker-link"]'), 'level steps must sit above the speaker, not under the name').toBe(false)
  await shot('01-levels-above-speaker', 'Level steps sit above the speaker, not under the name.')

  if (await page.getByTestId('tap-sound').count()) await page.getByTestId('tap-sound').first().click()
  const mutedBefore = (await snap(page))[0]
  const firstTime = mutedBefore?.currentTime ?? 0
  await page.waitForTimeout(1100)
  const laterSnap = (await snap(page))[0]
  const laterTime = laterSnap?.currentTime ?? 0
  expect(laterTime, 'the fake player must advance while playing').toBeGreaterThan(firstTime + 0.4)
  expect(laterSnap?.muted, 'sound stays off until Tap for sound, then on').toBe(false)
  await shot('02-sound-advancing', `Sound on, player time moving ${firstTime.toFixed(2)} -> ${laterTime.toFixed(2)}.`)

  const seenTalks: string[] = []
  const seenScenes: string[] = []
  const videos: string[] = []
  let ended = false
  for (let at = 0; at < 16; at++) {
    const card = (await feed.getAttribute('data-card')) || 'talk'
    const cut = await feed.getAttribute('data-cut')
    const key = `${cut}:${card}`
    if (card === 'talk') {
      expect(seenTalks.includes(key), `talk ${cut} repeated`).toBe(false)
      seenTalks.push(key)
    }
    if (card === 'scene') {
      expect(seenScenes.includes(key), `scene ${cut} repeated`).toBe(false)
      seenScenes.push(key)
    }
    const now = await snap(page)
    videos.push(now.map((row) => `${row.videoId}@${row.currentTime.toFixed(2)}:${row.hidden ? 'h' : 'v'}:${row.state}:${row.muted ? 'm' : 'u'}`).join('|'))
    log.push({ at: `swipe-${at}`, card, cut, snap: now, hiddenPlaying: now.filter((row) => row.hidden && row.state === 1 && !row.muted) })
    if (card === 'scene' && (await page.getByTestId('scene-credit').count())) {
      const ratio = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="scene-credit"]')
        if (!el) return 0
        const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
        const lum = (channels: number[]) => {
          const [r, g, b] = channels.slice(0, 3).map((channel) => {
            const c = channel / 255
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
          })
          return 0.2126 * r + 0.7152 * g + 0.0722 * b
        }
        const style = getComputedStyle(el)
        const [hi, lo] = [lum(rgb(style.color)), lum(rgb(style.backgroundColor))].sort((x, y) => y - x)
        return (hi + 0.05) / (lo + 0.05)
      })
      expect(ratio, 'scene credit contrast').toBeGreaterThanOrEqual(4.5)
      await shot('03-scene-credit', `Scene credit line at ${ratio.toFixed(2)}:1.`)
    }
    if ((await stepFeed(page)) === 'end') {
      ended = true
      await expect(page.getByTestId('toast')).toContainText("You've seen everything here, try another lane.")
      await shot('04-pool-end', "You've seen everything here, try another lane.", true)
      break
    }
  }
  expect(ended, 'the pool must end instead of wrapping').toBe(true)
  expect(videos.some((row, at) => at > 0 && row === videos[0] && row.includes(':v:1:')), 'later talks must not reuse the first playing host at the same time').toBe(false)

  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const opening = (await (await master.get('/api/hearts/opening?portal=east-london')).json()) as {
    clips: Record<string, { cutId: number; youtubeId?: string; lessonId?: number; hors?: { quote?: string; lines?: { text: string; tidy?: string }[] } }>
  }
  const taqwa = Object.values(opening.clips).find((clip) => {
    const lines = clip.hors?.lines || []
    const blob = [clip.hors?.quote, ...lines.map((line) => `${line.text} ${line.tidy || ''}`)].join(' ')
    return TAQWA_VIDEOS.includes(clip.youtubeId || '') || /\btaqwa\b|\btawa\b/i.test(blob)
  })
  let taqwaCut = taqwa?.cutId
  let restoredTier: { id: number; horsQuote: string; horsLines: unknown } | null = null
  if (!taqwaCut || !/\btaqwa\b|\btawa\b/i.test([taqwa?.hors?.quote, ...(taqwa?.hors?.lines || []).map((line) => `${line.text} ${line.tidy || ''}`)].join(' '))) {
    const talkCut = Number((await feed.getAttribute('data-cut')) || taqwa?.cutId || 0)
    const lessonId = Number((await feed.getAttribute('data-lesson')) || taqwa?.lessonId || 0)
    const tiers = (await (await master.get(`/api/talk-tiers?where[lesson][equals]=${lessonId}&limit=1`)).json()) as { docs?: { id: number; horsStart?: number; horsQuote?: string; horsLines?: unknown }[] }
    const tier = tiers.docs?.[0]
    if (tier) {
      restoredTier = { id: tier.id, horsQuote: tier.horsQuote || '', horsLines: tier.horsLines || [] }
      const at = Number(tier.horsStart) || 0
      const patched = await master.patch(`/api/talk-tiers/${tier.id}`, { data: { horsLines: [{ at, text: 'you know what tawa is' }] } })
      expect(patched.ok(), await patched.text()).toBeTruthy()
      taqwaCut = talkCut
    }
  }
  try {
    if (taqwaCut) {
      await page.goto(`${PORTAL}/feed?clip=${taqwaCut}&fresh=${Date.now()}`)
      await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
      await settled(page)
      if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
      if (await page.getByTestId('caption').count()) {
        await expect(page.getByTestId('caption')).not.toContainText(/\btawa\b/i)
        await expect(page.getByTestId('caption')).toContainText(/taqwa/i)
        await shot('05-taqwa', 'Caption spells taqwa, not tawa.')
      }
    }
  } finally {
    if (restoredTier) await master.patch(`/api/talk-tiers/${restoredTier.id}`, { data: { horsQuote: restoredTier.horsQuote, horsLines: restoredTier.horsLines } })
  }

  if ((await feed.getAttribute('data-card')) !== 'talk') {
    const firstCut = Object.values(opening.clips)[0]?.cutId
    if (firstCut) {
      await page.goto(`${PORTAL}/feed?clip=${firstCut}&fresh=${Date.now()}`)
      await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
      await settled(page)
    }
  }
  const lessonId = (await feed.getAttribute('data-lesson')) || ''
  const cut = (await feed.getAttribute('data-cut')) || ''
  if (lessonId && cut) {
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: true } })).ok()).toBeTruthy()
    await page.goto(`${PORTAL}/feed?clip=${cut}&fresh=${Date.now()}`)
    await expect(feed).toHaveAttribute('data-cut', cut, { timeout: 20_000 })
    await expect(feed).toHaveAttribute('data-words-in-picture', 'yes', { timeout: 20_000 })
    await settled(page)
    if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
    await expect(page.getByTestId('caption')).toHaveAttribute('data-slot', 'bar')
    const cap = (await page.getByTestId('caption').boundingBox())!
    const slot = (await page.getByTestId('player-slot').boundingBox())!
    expect(cap.y, 'caption sits in the bar below the 16:9 band').toBeGreaterThanOrEqual(slot.y + slot.height - 12)
    await shot('06-caption-bar', 'Burned-in film in a 16:9 band; app caption in the bar below.')
    await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: false } })
  }
  await master.dispose()

  writeFileSync(path.join(OUT, 'player-log.json'), JSON.stringify(log, null, 2))
  writeFileSync(path.join(OUT, 'proof.txt'), [
    `viewport 390x844`,
    `video ${info.outputDir}`,
    `talks ${seenTalks.join(' ')}`,
    `scenes ${seenScenes.join(' ')}`,
    `time moved ${firstTime} -> ${laterTime}`,
    `muted then ${mutedBefore?.muted} / later ${laterSnap?.muted}`,
    `pool ended ${ended}`,
  ].join('\n'))
})
