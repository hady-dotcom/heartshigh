import { expect, test } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'

const BASE = '/p/east-london'
const PHONE = { width: 390, height: 844 }

test.use({
  video: { mode: 'on', size: PHONE },
  viewport: PHONE,
})

test('phone walk: buffet, plan, think, swipe, home, workbook, retry, next part', async ({ page }) => {
  test.setTimeout(240_000)
  await fakeYouTube(page)
  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/lanes`)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('lanes')).toBeVisible()
  await expect(page.getByTestId('day-number')).toContainText('with us')
  await expect(page.getByTestId('lane-card').first()).not.toContainText(/oh allah/i)

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
  await page.waitForTimeout(1400)

  await page.getByTestId('schedule-all').click()
  await expect(page.getByTestId('plan')).toBeVisible()
  await expect(page.getByTestId('back')).toContainText('Course')
  await expect(page.getByTestId('week-days')).toBeVisible()
  if (!(await page.getByTestId('weekday-1').isChecked())) await page.locator('label:has([data-testid=weekday-1])').click()
  await page.waitForTimeout(700)
  await page.getByTestId('schedule-submit').click()
  await expect(page.getByTestId('schedule-plan').filter({ hasText: 'Long sittings' })).toBeVisible()
  await expect(page.getByTestId('schedule-course')).toHaveValue(String(sittingId))
  await expect(page.getByTestId('weekday-1')).toBeChecked()
  await expect(page.getByTestId('week-days')).toBeVisible()
  await page.waitForTimeout(1200)

  await page.getByTestId('schedule-plan').filter({ hasText: 'Long sittings' }).getByTestId('schedule-slot').first().click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
  await expect(page.getByTestId('fruit-explain')).toBeVisible()
  if (await page.getByTestId('timeline-dot').count()) {
    await page.getByTestId('timeline-dot').first().click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('paused-note')).toContainText('Paused')
    await expect(page.getByTestId('think-about-this')).toContainText('Think about this for this session')
    await page.waitForTimeout(900)
    await page.getByTestId('think-about-this').click()
    await expect(page.getByTestId('popup')).toHaveCount(0)
  }
  await page.waitForTimeout(800)
  await page.getByTestId('up-next').click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
  await page.waitForTimeout(900)

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
  if (await page.getByTestId('learn-more').count()) await page.getByTestId('learn-more').first().click()
  await expect(page.getByTestId('level-chip')).toContainText('Ready for more?')
  await page.waitForTimeout(900)

  await page.goto(BASE)
  await expect(page.getByTestId('rings')).toBeVisible()
  await expect(page.getByTestId('ring-watched')).toBeVisible()
  const watched = Number((await page.getByTestId('ring-watched').locator('.r').textContent()) || '0')
  expect(watched).toBeGreaterThanOrEqual(0)
  await page.waitForTimeout(800)

  await page.goto(`${BASE}/garden/workbook`)
  await expect(page.getByTestId('workbook-summary')).toBeVisible()
  if (await page.getByTestId('open-question').count()) {
    const labels = await page.getByTestId('open-question').allTextContents()
    expect(labels.join(' ')).not.toMatch(/Tawakkul/i)
  }
  await page.waitForTimeout(800)

  await page.addInitScript(() => {
    const gate = window as unknown as { __failFirst?: boolean; __fails?: number }
    gate.__failFirst = true
    gate.__fails = 0
  })
  await page.goto(`${BASE}/lanes`)
  const trustCard = page.getByTestId('path-course').filter({ hasText: /Tawakkul/i })
  if (await trustCard.count()) {
    const trustHref = await trustCard.locator('[data-testid=lesson-link], [data-testid=peek]').getAttribute('href')
    await page.goto(trustHref!)
    if (await page.getByTestId('start-part').count()) await page.getByTestId('start-part').click()
    await expect(page.getByTestId('player-retry')).toBeVisible({ timeout: 12_000 })
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByTestId('player')).toBeVisible()
    await page.waitForTimeout(900)
  }

  await page.goto(`${BASE}/course/${sittingId}?part=${talkIds[1]}`)
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(page.getByTestId('up-next')).toBeVisible()
  await expect(page.getByTestId('up-next')).not.toContainText('last part')
  await expect(page.getByTestId('up-next')).toContainText(/Next|Part 3|part 3/i)
  await page.waitForTimeout(1400)
})
