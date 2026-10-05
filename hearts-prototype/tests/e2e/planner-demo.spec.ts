import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { noIssueBadge } from './no-issue-badge'
import { ensureProofCourse, PROOF_COURSE } from './proof-course'

const BASE = '/p/east-london'
const PHONE = { width: 390, height: 844 }
const PROOF = path.join(process.cwd(), 'test-results', 'r5b-proof')

test.use({
  video: { mode: 'on', size: PHONE },
  viewport: PHONE,
})

let master: APIRequestContext

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

async function signInQuiet(page: Page) {
  const login = await page.request.post('/api/users/login', {
    data: { email: 'elm-learner@hearts.test', password: 'portal-learner' },
  })
  expect(login.ok()).toBeTruthy()
}

async function hideInstall(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('hearts.install.dismissed', '1')
    } catch {
      // Private browsing still hides the sheet for this walk.
    }
    document.cookie = 'hearts.install.dismissed=1; Path=/; SameSite=Lax'
    document.documentElement.style.background = '#0e2a2b'
    const style = document.createElement('style')
    style.textContent = 'html,body{background:#0e2a2b!important}.install-card{display:none!important}'
    document.documentElement.appendChild(style)
  })
}

async function hold(page: Page, name: string, ms = 1400) {
  mkdirSync(PROOF, { recursive: true })
  await page.waitForTimeout(ms)
  await noIssueBadge(page)
  await page.screenshot({ path: path.join(PROOF, `${name}.png`), fullPage: false })
}

test('phone walk: buffet, plan, think, swipe, home, workbook, retry, next part', async ({ page }) => {
  test.setTimeout(300_000)
  mkdirSync(PROOF, { recursive: true })
  const proof = await ensureProofCourse(master)
  await hideInstall(page)
  await fakeYouTube(page)
  await signInQuiet(page)
  await page.goto(BASE)
  await expect(page.getByTestId('rings')).toBeVisible()
  await hold(page, '00-home', 800)
  await page.goto(`${BASE}/lanes`)
  await expect(page.getByTestId('lanes')).toBeVisible()
  await expect(page.getByTestId('login-email')).toHaveCount(0)
  await expect(page.getByTestId('day-number')).toContainText('with us')
  await expect(page.getByTestId('lane-card').first()).not.toContainText(/oh allah/i)
  await hold(page, '01-lanes')

  const sittingCard = page.getByTestId('path-course').filter({ hasText: PROOF_COURSE })
  await expect(sittingCard).toBeVisible()
  const href = await sittingCard.locator('[data-testid=lesson-link], [data-testid=peek]').getAttribute('href')
  expect(href).toBeTruthy()
  const sittingId = proof.courseId

  await page.goto(href!)
  await expect(page.getByTestId('course-overview')).toBeVisible()
  await expect(page.getByTestId('question-strip')).toHaveCount(0)
  await expect(page.getByTestId('buffet-talk')).toHaveCount(10)
  const talkHrefs = await page.getByTestId('buffet-talk').evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') || ''))
  const talkIds = talkHrefs.map((link) => Number(/part=(\d+)/.exec(link)?.[1] || 0)).filter(Boolean)
  expect(talkIds.length).toBeGreaterThanOrEqual(2)
  await expect(page.getByTestId('schedule-all')).toContainText('Schedule all of these')
  await hold(page, '02-buffet')

  await page.getByTestId('schedule-all').click()
  await expect(page.getByTestId('plan')).toBeVisible()
  await expect(page.getByTestId('back')).toContainText('Course')
  await expect(page.getByTestId('week-days')).toBeVisible()
  await page.getByTestId('schedule-start').fill('2026-10-05')
  await page.getByTestId('schedule-end').fill('2026-10-08')
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const box = page.getByTestId(`weekday-${day}`)
    if (!(await box.isChecked())) await page.locator(`label:has([data-testid=weekday-${day}])`).click()
  }
  await hold(page, '03-days-before-share', 800)
  await page.getByTestId('schedule-submit').click()
  await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE })).toBeVisible()
  await noIssueBadge(page)
  await expect(page.getByTestId('schedule-course')).toHaveValue(String(sittingId))
  await expect(page.getByTestId('weekday-1')).toBeChecked()
  await expect(page.getByTestId('week-days')).toBeVisible()
  await expect(page.getByTestId('back')).toContainText('Course')
  await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('plan-counts')).toContainText(/3,\s*3,\s*2,\s*2/)
  await expect(page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('schedule-slot').first()).toContainText('›')
  await expect(page.getByTestId('schedule-slot').first()).not.toContainText('|')
  const plan = page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE })
  await expect(plan.getByTestId('plan-day-list')).toBeVisible()
  await expect(plan.getByTestId('plan-day')).toHaveCount(4)
  await plan.getByTestId('plan-day-list').scrollIntoViewIfNeeded()
  const tab = page.getByTestId('tabbar')
  const dayBox = await plan.getByTestId('plan-day-list').boundingBox()
  const tabBox = await tab.boundingBox()
  expect(dayBox, 'the per-day list is on screen').toBeTruthy()
  expect(tabBox, 'the tab bar is on screen').toBeTruthy()
  expect(dayBox!.y + dayBox!.height, 'the per-day list sits above the tab bar').toBeLessThanOrEqual((tabBox!.y || 0) + 2)
  await expect(tab).toBeVisible()
  await hold(page, '04-days-kept-after-share', 1800)

  await page.getByTestId('schedule-plan').filter({ hasText: PROOF_COURSE }).getByTestId('schedule-slot').first().click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('part-label')).toBeVisible()
  await expect(page.getByTestId('up-next')).toContainText('Part 2 · Next')
  await expect(page.getByTestId('garden-next')).toContainText('Part 2 · Next')
  await expect(page.getByTestId('fruit-explain')).toBeVisible()
  await expect(page.getByTestId('player-poster').or(page.locator('[data-fake=youtube]'))).toBeVisible()
  const player = page.getByTestId('player')
  await expect(player.getByTestId('question-strip')).toBeVisible()
  await expect(player.getByTestId('strip-dot').first()).toBeVisible()
  await expect(player.getByTestId('answer-point')).toBeVisible()
  await expect(page.getByTestId('course-overview')).toHaveCount(0)
  await hold(page, '05-player-from-plan-row')
  if (await page.getByTestId('timeline-dot').count()) {
    await page.getByTestId('timeline-dot').first().click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('paused-note')).toContainText('Paused')
    await expect(page.getByTestId('think-about-this')).toContainText('Think about this for this session')
    await expect(page.getByTestId('answer-later')).toBeVisible()
    await hold(page, '06-think-about-this', 1600)
    await page.getByTestId('think-about-this').click()
    await expect(page.getByTestId('popup')).toHaveCount(0)
  }
  const play = page.getByTestId('player-play')
  if (await play.count()) await play.click({ timeout: 3_000 }).catch(() => undefined)
  await page.evaluate(() => (window as unknown as { __HEARTS_FAKE_END?: () => void }).__HEARTS_FAKE_END?.())
  await page.waitForTimeout(700)
  if (await page.getByTestId('popup').isVisible()) {
    await page.getByTestId('answer-later').click()
    await expect(page.getByTestId('popup')).toHaveCount(0)
  }
  await expect(page.getByTestId('up-next-card')).toBeVisible({ timeout: 8_000 })
  await expect(page.getByTestId('up-next-count')).toContainText('Starting in')
  await hold(page, '07-up-next', 800)
  await page.getByTestId('watch-now').click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toContainText('Part 3 · Next')
  await hold(page, '08-next-part')

  await page.goto(`${BASE}/feed`)
  await expect(page.getByTestId('journey')).toBeVisible({ timeout: 15_000 })
  const feed = page.getByTestId('journey')
  if ((await feed.getAttribute('data-phase')) !== 'feed') {
    const play = page.getByTestId('lets-play').or(page.getByRole('button', { name: /play|continue/i }))
    if (await play.count()) await play.first().click()
  }
  await expect(page.getByTestId('learn-more').first()).toBeVisible({ timeout: 15_000 })
  const layer = page.getByTestId('gesture-layer')
  if (await layer.count()) {
    const box = await layer.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + 220, cy, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(800)
    }
  }
  const caption = page.getByTestId('caption')
  if (await caption.count()) {
    const shown = ((await caption.innerText()) || '').replace(/\s+/g, ' ').trim()
    const lessonTitle = (await feed.getAttribute('data-lesson-title')) || ''
    const courseTitle = (await feed.getAttribute('data-course-title')) || ''
    expect(shown).not.toBe(lessonTitle)
    expect(shown).not.toBe(courseTitle)
  }
  await hold(page, '09-feed-swipe', 900)
  if (await page.getByTestId('learn-more').count()) await page.getByTestId('learn-more').first().click()
  await expect(page.getByTestId('level-chip')).toContainText('Ready for more?')
  await hold(page, '10-ready-for-more')

  await page.goto(BASE)
  await expect(page.getByTestId('rings')).toBeVisible()
  await expect(page.getByTestId('install-card')).not.toBeVisible()
  await expect(page.getByTestId('ring-watched')).toBeVisible()
  const dayLabel = (await page.getByTestId('day-number').textContent()) || ''
  const daysCount = (await page.getByTestId('days-count').textContent()) || ''
  const dayMatch = /Day (\d+)/.exec(dayLabel)
  if (dayMatch && Number(dayMatch[1]) > 1) expect(daysCount).toContain(`${dayMatch[1]} days`)
  if (await page.getByTestId('home-plan-line').count()) {
    await expect(page.getByTestId('home-plan-line')).toContainText(/Tonight: Part \d+, \d+ min/)
    await expect(page.getByTestId('home-plan-line')).not.toContainText(', 20 min')
  }
  await hold(page, '11-home-rings', 1800)

  await page.goto(`${BASE}/garden/workbook`)
  await expect(page.getByTestId('workbook-summary')).toBeVisible()
  await expect(page.getByTestId('workbook')).toBeVisible()
  if (await page.getByTestId('open-question').count()) {
    const labels = await page.getByTestId('open-question').allTextContents()
    expect(labels.join(' ')).not.toMatch(/Tawakkul/i)
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await hold(page, '12-workbook', 1600)

  await page.goto(`${BASE}/lanes`)
  const trustCard = page.getByTestId('path-course').filter({ hasText: /Tawakkul/i })
  if (await trustCard.count()) {
    const trustHref = await trustCard.locator('[data-testid=lesson-link], [data-testid=peek]').getAttribute('href')
    await page.goto(trustHref!)
    const partHref = (await page.getByTestId('start-part').getAttribute('href')) || (await page.getByTestId('buffet-talk').first().getAttribute('href')) || trustHref
    await page.evaluate(() => sessionStorage.setItem('heartsFailFirst', '1'))
    await page.goto(partHref!)
    await expect(page.getByTestId('player-retry')).toBeVisible({ timeout: 12_000 })
    await expect(page.getByTestId('back')).not.toContainText('|')
    await hold(page, '13-tawakkul-retry')
    await page.evaluate(() => sessionStorage.removeItem('heartsFailFirst'))
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('player')).toBeVisible()
    await expect(page.getByTestId('player-retry')).toHaveCount(0)
    await hold(page, '14-tawakkul-playing', 800)
  }

  await page.goto(`${BASE}/course/${sittingId}?part=${talkIds[1]}`)
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toContainText('Part 3 · Next')
  await expect(page.getByTestId('garden-next')).toContainText('Part 3 · Next')
  await hold(page, '15-clear-next-part', 1600)
})
