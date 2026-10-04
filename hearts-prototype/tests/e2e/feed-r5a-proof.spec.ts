import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
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
  return page.evaluate(() => ((window as unknown as { __HEARTS_FEED_SNAP?: () => { id: string; hidden: boolean; state: number; muted: boolean; currentTime: number; videoId: string }[] }).__HEARTS_FEED_SNAP?.() || []))
}

test('phone feed proof: no repeats, taqwa, caption bar, advancing mute log', async ({ page, playwright }, info) => {
  test.setTimeout(180_000)
  mkdirSync(path.join(OUT, 'frames'), { recursive: true })
  const log: unknown[] = []
  const shot = async (name: string, note: string) => {
    const file = path.join(OUT, 'frames', `${name}.png`)
    await page.screenshot({ path: file, animations: 'disabled' })
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
  await shot('01-levels-above-speaker', 'Level steps sit above the speaker, not under the name.')

  if (await page.getByTestId('tap-sound').count()) await page.getByTestId('tap-sound').first().click()
  const firstTime = (await snap(page))[0]?.currentTime ?? 0
  await page.waitForTimeout(900)
  const laterTime = (await snap(page))[0]?.currentTime ?? 0
  expect(laterTime, 'the fake player must advance while playing').toBeGreaterThan(firstTime)
  await shot('02-sound-advancing', 'Sound on, player time moving.')

  const seenTalks: string[] = []
  const seenScenes: string[] = []
  const videos: string[] = []
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
    if (card === 'scene' && !(await page.locator('.slide-foot').count())) {
      // keep looking
    } else if (card === 'scene') {
      await shot('03-scene-credit', 'Scene credit line at readable contrast.')
    }
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await page.waitForTimeout(400)
    const ended = (await page.getByTestId('toast').count()) > 0 && /seen everything/i.test(await page.getByTestId('toast').innerText())
    if (ended) {
      await shot('04-pool-end', "You've seen everything here, try another lane.")
      break
    }
    if ((await feed.getAttribute('data-index')) !== before) await settled(page)
  }
  expect(videos.some((row, at) => at > 0 && row === videos[0] && row.includes(':v:1:')), 'later talks must not reuse the first playing host at the same time').toBe(false)

  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const opening = (await (await master.get('/api/hearts/opening?portal=east-london')).json()) as {
    clips: Record<string, { cutId: number; hors?: { lines?: { text: string; tidy?: string }[] } }>
  }
  const taqwa = Object.values(opening.clips).find((clip) => (clip.hors?.lines || []).some((line) => /\btawa\b/i.test(line.text) || /\btaqwa\b/i.test(line.tidy || '')))
  if (taqwa) {
    await page.goto(`${PORTAL}/feed?clip=${taqwa.cutId}`)
    await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
    await settled(page)
    if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
    if (await page.getByTestId('caption').count()) {
      await expect(page.getByTestId('caption')).not.toContainText(/tawa/i)
      await shot('05-taqwa', 'Caption spells taqwa, not tawa.')
    }
  }

  const talk = Object.values(opening.clips)[0]
  const lessonId = (await feed.getAttribute('data-lesson')) || ''
  const cut = talk?.cutId || (await feed.getAttribute('data-cut'))
  if (lessonId) {
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { burnedCaptions: true } })).ok()).toBeTruthy()
    await page.goto(`${PORTAL}/feed?clip=${cut}`)
    await expect(feed).toHaveAttribute('data-words-in-picture', 'yes', { timeout: 20_000 })
    await settled(page)
    if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
    await expect(page.getByTestId('caption')).toHaveAttribute('data-slot', 'bar')
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
  ].join('\n'))
})
