import { expect, test, type Browser, type CDPSession, type Locator, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fakeYouTube } from './fake-youtube'
import { settled } from './feed-step'

const BASE = '/p/east-london'
const SHOTS = '/opt/cursor/artifacts'

type Box = { x: number; y: number; width: number; height: number }

function overlaps(a: Box | null, b: Box | null, slop = 2) {
  if (!a || !b || a.width < 1 || a.height < 1 || b.width < 1 || b.height < 1) return false
  return a.x + slop < b.x + b.width && a.x + a.width - slop > b.x && a.y + slop < b.y + b.height && a.y + a.height - slop > b.y
}

async function phone(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({
    viewport,
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    window.localStorage.setItem('hearts.feed-coach.v1', 'true')
  })
  await fakeYouTube(page)
  return { context, page, cdp: await context.newCDPSession(page) }
}

async function openFeed(page: Page, signedIn: boolean) {
  if (!signedIn) {
    await page.goto(`${BASE}/feed`)
  } else {
    await page.goto(`/login?next=${encodeURIComponent(`${BASE}/feed`)}`)
    await page.getByTestId('login-email').fill('elm-learner@hearts.test')
    await page.getByTestId('login-password').fill('portal-learner')
    await page.getByTestId('login-submit').click()
  }
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 30_000 })
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  await expect(page.getByTestId('feed-board')).toBeVisible()
  await expect(page.getByTestId('more-board')).toBeHidden()
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  return feed
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const board = document.querySelector('[data-testid="feed-board"]')
    const film = document.querySelector('[data-testid="film-band"]')
    const words = document.querySelector('[data-testid="spoken-words"]')
    const lines = [...document.querySelectorAll('.fr-words-line')].map((el) => ({
      text: (el.textContent || '').trim(),
      box: box(el),
    }))
    const buttons = ['level-clip', 'level-minutes', 'level-lecture', 'speed', 'fave', 'save', 'share', 'follow', 'learn-more', 'lecture-speed', 'timeline']
      .map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`)
        return { id, box: box(el) }
      })
      .filter((row) => row.box && row.box.width > 0)
    const boardBox = box(board)
    const visibleButtons = buttons.filter((row) => {
      if (!boardBox || !row.box) return false
      const top = Math.max(row.box.y, boardBox.y)
      const bottom = Math.min(row.box.y + row.box.height, boardBox.y + boardBox.height)
      return bottom - top > 8
    })
    return {
      film: box(film),
      words: box(words),
      board: boardBox,
      lines,
      buttons,
      visibleButtons: visibleButtons.map((row) => row.id),
      boardScroll: board ? board.scrollHeight - board.clientHeight : 0,
      playing: document.querySelector('[data-testid="journey"], [data-testid="player"]')?.getAttribute('data-playing'),
      boardState: document.querySelector('[data-testid="journey"], [data-testid="player"]')?.getAttribute('data-board'),
      iframe: Boolean(document.querySelector('[data-testid="film-band"] iframe, .course-film-band iframe, iframe[data-fake="youtube"]')),
    }
  })
}

function assertClear(report: Awaited<ReturnType<typeof layout>>, label: string) {
  expect(report.film && report.film.height > 40, `${label} film band`).toBeTruthy()
  expect(report.board && report.board.height > 40, `${label} board`).toBeTruthy()
  expect(overlaps(report.film, report.board), `${label} board covers the film`).toBe(false)
  const text = report.lines.filter((line) => line.text)
  for (const line of text) {
    expect(overlaps(line.box, report.board), `${label} board covers “${line.text.slice(0, 40)}”`).toBe(false)
    expect(overlaps(line.box, report.film), `${label} film covers “${line.text.slice(0, 40)}”`).toBe(false)
  }
  if (report.words && report.words.height > 8) {
    expect(overlaps(report.words, report.film), `${label} words box covers the film`).toBe(false)
  }
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

test('guest feed opens the board under the words, swipes, and autoplays', async ({ browser }) => {
  test.setTimeout(180_000)
  const { page, cdp, context } = await phone(browser, { width: 390, height: 844 })
  const feed = await openFeed(page, false)
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  await expect(page.getByTestId('film-band')).toBeVisible()
  const first = await layout(page)
  assertClear(first, 'clip')
  expect(first.iframe, 'film iframe').toBe(true)
  expect(first.visibleButtons).toEqual(expect.arrayContaining(['level-clip', 'level-minutes', 'level-lecture', 'speed', 'share', 'learn-more']))
  await shot(page, 'board-open-feed-clip')

  const before = await feed.getAttribute('data-index')
  await touch(page, cdp, await filmPoint(page), 0, -220)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  expect(await feed.getAttribute('data-index')).not.toBe(before)
  const afterSwipe = await layout(page)
  assertClear(afterSwipe, 'after swipe up')
  await shot(page, 'board-open-after-swipe')

  const laneBefore = await feed.getAttribute('data-index')
  await touch(page, cdp, await filmPoint(page), 0, 220)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)

  await touch(page, cdp, await filmPoint(page), -220, 0)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  await touch(page, cdp, await filmPoint(page), 220, 0)
  await settled(page, feed)
  await expect(feed).toHaveAttribute('data-board', 'open')
  expect(await feed.getAttribute('data-index')).not.toBe(laneBefore)

  await page.getByTestId('level-minutes').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser', { timeout: 15_000 })
  await expect(feed).toHaveAttribute('data-board', 'open')
  await settled(page, feed)
  const extract = await layout(page)
  assertClear(extract, 'extract')
  await shot(page, 'board-open-extract')
  await page.getByTestId('level-clip').click()
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await page.getByTestId('level-minutes').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await page.getByTestId('level-clip').click()
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-board', 'open')

  const speed = page.getByTestId('speed')
  const speedWas = (await speed.innerText()).trim()
  await speed.click()
  await expect(speed).not.toHaveText(speedWas)

  const playing = await feed.getAttribute('data-playing')
  await page.getByTestId('film-catcher').click()
  await expect(feed).not.toHaveAttribute('data-playing', playing || '')
  await page.getByTestId('film-catcher').click()
  await expect(feed).toHaveAttribute('data-playing', 'yes')

  const index = await feed.getAttribute('data-index')
  await page.evaluate(() => {
    const end = (window as unknown as { __HEARTS_FAKE_END?: () => void }).__HEARTS_FAKE_END
    end?.()
  })
  await expect.poll(async () => (await feed.getAttribute('data-index')) !== index || (await page.getByTestId('feed-end').count()) > 0).toBe(true)
  await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  if ((await page.getByTestId('feed-end').count()) === 0) await expect(feed).toHaveAttribute('data-board', 'open')
  await context.close()
})

test('signed-in controls work on the first tap, and the next clip opens the board again', async ({ browser }) => {
  test.setTimeout(180_000)
  const { page, cdp, context } = await phone(browser, { width: 390, height: 844 })
  const feed = await openFeed(page, true)
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })

  const speed = page.getByTestId('speed')
  const speedWas = (await speed.innerText()).trim()
  await speed.click()
  await expect(speed).not.toHaveText(speedWas)

  const like = page.getByTestId('fave')
  const liked = await like.getAttribute('aria-pressed')
  await like.click()
  await expect(like).toHaveAttribute('aria-pressed', liked === 'true' ? 'false' : 'true')
  const save = page.getByTestId('save')
  const saved = await save.getAttribute('aria-pressed')
  await save.click()
  await expect(save).toHaveAttribute('aria-pressed', saved === 'true' ? 'false' : 'true')
  await page.getByTestId('share').click()
  await expect(page.getByTestId('toast')).toContainText('Link copied')
  const follow = page.getByTestId('follow')
  await follow.click()
  await expect(follow).toHaveText(/Follow/)

  const handle = (await page.getByTestId('board-handle').boundingBox())!
  await touch(page, cdp, { x: handle.x + handle.width / 2, y: handle.y + 4 }, 0, 120)
  await expect(page.getByTestId('feed-board')).toHaveCount(0)
  await expect(page.getByTestId('more-board')).toBeVisible()
  await page.getByTestId('more-board').click()
  await expect(page.getByTestId('feed-board')).toBeVisible()
  await expect(feed).toHaveAttribute('data-board', 'open')
  const speedAgain = (await page.getByTestId('speed').innerText()).trim()
  await page.getByTestId('speed').click()
  await expect(page.getByTestId('speed')).not.toHaveText(speedAgain)

  await page.getByTestId('board-handle').dispatchEvent('pointerdown', { clientX: 180, clientY: 500, pointerId: 1, bubbles: true })
  const closed = (await page.getByTestId('board-handle').boundingBox())!
  await touch(page, cdp, { x: closed.x + closed.width / 2, y: closed.y + 4 }, 0, 140)
  await expect(page.getByTestId('more-board')).toBeVisible()
  const index = await feed.getAttribute('data-index')
  await touch(page, cdp, await filmPoint(page), 0, -220)
  await settled(page, feed)
  if ((await feed.getAttribute('data-index')) !== index) {
    await expect(feed).toHaveAttribute('data-board', 'open')
    await expect(page.getByTestId('feed-board')).toBeVisible()
  }

  await page.getByTestId('level-minutes').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await page.getByTestId('level-clip').click()
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await page.getByTestId('level-minutes').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await page.getByTestId('level-lecture').click()
  const player = page.getByTestId('player')
  await expect(player).toBeVisible({ timeout: 20_000 })
  await expect(player).toHaveAttribute('data-board', 'open')
  await expect(page.getByTestId('feed-board')).toBeVisible()
  await expect(page.getByTestId('film-band').first()).toBeVisible()
  await expect(player).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  const talk = await layout(page)
  assertClear(talk, 'full talk')
  const talkSpeed = page.getByTestId('lecture-speed')
  const talkSpeedWas = (await talkSpeed.innerText()).trim()
  await talkSpeed.click()
  await expect(talkSpeed).not.toHaveText(talkSpeedWas)
  await page.getByTestId('player-play').click()
  await expect(player).toHaveAttribute('data-playing', 'no')
  await page.getByTestId('player-play').click()
  await expect(player).toHaveAttribute('data-playing', 'yes')
  const talkHandle = (await page.getByTestId('board-handle').boundingBox())!
  await touch(page, cdp, { x: talkHandle.x + talkHandle.width / 2, y: talkHandle.y + 4 }, 0, 100)
  await expect(page.getByTestId('more-board')).toBeVisible()
  await page.getByTestId('more-board').click()
  await expect(player).toHaveAttribute('data-board', 'open')
  await shot(page, 'board-open-full-talk')
  await context.close()
})

test('a small phone keeps the film and words clear of the open board', async ({ browser }) => {
  test.setTimeout(180_000)
  const { page, context } = await phone(browser, { width: 375, height: 667 })
  await openFeed(page, false)
  await expect(page.getByTestId('journey')).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  const report = await layout(page)
  assertClear(report, '375x667')
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/board-open-375x667.png` })
  const note = {
    viewport: '375x667',
    boardScrollPx: report.boardScroll,
    visibleButtons: report.visibleButtons,
    buttonIds: report.buttons.map((row) => row.id),
    wordsHeight: report.words?.height ?? 0,
    boardHeight: report.board?.height ?? 0,
    filmHeight: report.film?.height ?? 0,
  }
  await page.evaluate((payload) => {
    const el = document.createElement('pre')
    el.id = 'board-measure'
    el.textContent = JSON.stringify(payload)
    document.body.append(el)
  }, note)
  console.log(JSON.stringify(note))
  await context.close()
})
