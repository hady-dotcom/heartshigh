import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fakeYouTube } from './fake-youtube'

const BASE = '/p/east-london'
const PHONE = { width: 390, height: 844 }
const PROOF = path.join(process.cwd(), 'test-results', 'r5b-proof')

test.use({
  video: { mode: 'on', size: PHONE },
  viewport: PHONE,
})

async function signInQuiet(page: Page) {
  const login = await page.request.post('/api/users/login', {
    data: { email: 'elm-learner@hearts.test', password: 'portal-learner' },
  })
  expect(login.ok()).toBeTruthy()
}

async function hold(page: Page, name: string, ms = 1100) {
  mkdirSync(PROOF, { recursive: true })
  await page.evaluate(() => document.querySelector('nextjs-portal')?.remove())
  await page.screenshot({ path: path.join(PROOF, `${name}.png`), fullPage: false })
  await page.waitForTimeout(ms)
}

test('phone walk: buffet, plan, think, swipe, home, workbook, retry, next part', async ({ page }) => {
  test.setTimeout(240_000)
  mkdirSync(PROOF, { recursive: true })
  await page.addInitScript(() => {
    const hide = () => document.querySelector('nextjs-portal')?.remove()
    hide()
    const watch = new MutationObserver(hide)
    if (document.documentElement) watch.observe(document.documentElement, { childList: true, subtree: true })
  })
  await fakeYouTube(page)
  await signInQuiet(page)
  await page.goto(`${BASE}/lanes`)
  await expect(page.getByTestId('lanes')).toBeVisible()
  await expect(page.getByTestId('login-email')).toHaveCount(0)
  await expect(page.getByTestId('day-number')).toContainText('with us')
  await expect(page.getByTestId('lane-card').first()).not.toContainText(/oh allah/i)
  await hold(page, '01-lanes')

  const sittingCard = page.getByTestId('path-course').filter({ hasText: 'Long sittings' })
  await expect(sittingCard).toBeVisible()
  const href = await sittingCard.locator('[data-testid=lesson-link], [data-testid=peek]').getAttribute('href')
  expect(href).toBeTruthy()
  const sittingId = Number(/course\/(\d+)/.exec(href || '')?.[1] || 0)

  await page.goto(href!)
  await expect(page.getByTestId('course-overview')).toBeVisible()
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
  if (!(await page.getByTestId('weekday-1').isChecked())) await page.locator('label:has([data-testid=weekday-1])').click()
  await hold(page, '03-days-before-share', 800)
  await page.getByTestId('schedule-submit').click()
  await expect(page.getByTestId('schedule-plan').filter({ hasText: 'Long sittings' })).toBeVisible()
  await expect(page.getByTestId('schedule-course')).toHaveValue(String(sittingId))
  await expect(page.getByTestId('weekday-1')).toBeChecked()
  await expect(page.getByTestId('week-days')).toBeVisible()
  await expect(page.getByTestId('back')).toContainText('Course')
  await expect(page.getByTestId('schedule-plan').filter({ hasText: 'Long sittings' }).getByTestId('schedule-slot').first()).toContainText('›')
  await hold(page, '04-days-kept-after-share')

  await page.getByTestId('schedule-plan').filter({ hasText: 'Long sittings' }).getByTestId('schedule-slot').first().click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
  await expect(page.getByTestId('fruit-explain')).toBeVisible()
  await expect(page.getByTestId('player-poster').or(page.locator('[data-fake=youtube]'))).toBeVisible()
  await hold(page, '05-player-from-plan-row')
  if (await page.getByTestId('timeline-dot').count()) {
    await page.getByTestId('timeline-dot').first().click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('paused-note')).toContainText('Paused')
    await expect(page.getByTestId('think-about-this')).toContainText('Think about this for this session')
    await hold(page, '06-think-about-this')
    await page.getByTestId('think-about-this').click()
    await expect(page.getByTestId('popup')).toHaveCount(0)
  }
  await hold(page, '07-up-next', 800)
  await page.getByTestId('up-next').click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
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
      await page.mouse.move(cx, cy - 220, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(800)
    }
  }
  await hold(page, '09-feed-swipe', 700)
  if (await page.getByTestId('learn-more').count()) await page.getByTestId('learn-more').first().click()
  await expect(page.getByTestId('level-chip')).toContainText('Ready for more?')
  await hold(page, '10-ready-for-more')

  await page.goto(BASE)
  await expect(page.getByTestId('rings')).toBeVisible()
  await expect(page.getByTestId('ring-watched')).toBeVisible()
  const watched = Number((await page.getByTestId('ring-watched').locator('.r').textContent()) || '0')
  expect(watched).toBeGreaterThanOrEqual(0)
  await hold(page, '11-home-rings')

  await page.goto(`${BASE}/garden/workbook`)
  await expect(page.getByTestId('workbook-summary')).toBeVisible()
  if (await page.getByTestId('open-question').count()) {
    const labels = await page.getByTestId('open-question').allTextContents()
    expect(labels.join(' ')).not.toMatch(/Tawakkul/i)
  }
  await hold(page, '12-workbook')

  await page.goto(`${BASE}/lanes`)
  const trustCard = page.getByTestId('path-course').filter({ hasText: /Tawakkul/i })
  if (await trustCard.count()) {
    const trustHref = await trustCard.locator('[data-testid=lesson-link], [data-testid=peek]').getAttribute('href')
    await page.goto(trustHref!)
    const partHref = (await page.getByTestId('start-part').getAttribute('href')) || (await page.getByTestId('buffet-talk').first().getAttribute('href')) || trustHref
    await page.evaluate(() => sessionStorage.setItem('heartsFailFirst', '1'))
    await page.goto(partHref!)
    await expect(page.getByTestId('player-retry')).toBeVisible({ timeout: 12_000 })
    await hold(page, '13-tawakkul-retry')
    await page.evaluate(() => sessionStorage.removeItem('heartsFailFirst'))
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('player')).toBeVisible()
    await expect(page.getByTestId('player-retry')).toHaveCount(0)
    await hold(page, '14-tawakkul-playing', 800)
  }

  await page.goto(`${BASE}/course/${sittingId}?part=${talkIds[1]}`)
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
  await expect(page.getByTestId('up-next')).toContainText(/Next|Part 3|part 3/i)
  await hold(page, '15-clear-next-part', 1600)
})
