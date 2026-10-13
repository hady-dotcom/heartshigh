import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fakeYouTube } from './fake-youtube'

const SHOTS = '/opt/cursor/artifacts'
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const

type Box = { x: number; y: number; width: number; height: number }

function columnWidth(viewport: number) {
  return Math.min(430, viewport)
}

function assertSixteenNine(box: Box, label: string, viewportWidth: number) {
  const expectedWidth = columnWidth(viewportWidth)
  expect(Math.abs(box.width - expectedWidth), `${label} width ${box.width} vs column ${expectedWidth}`).toBeLessThanOrEqual(4)
  expect(Math.abs(box.height - (box.width * 9) / 16), `${label} is ${box.width}x${box.height}, not 16:9`).toBeLessThanOrEqual(2)
}

function assertFilled(outer: Box, inner: Box, label: string) {
  expect(Math.abs(inner.x - outer.x), `${label} left gap`).toBeLessThanOrEqual(2)
  expect(Math.abs(inner.y - outer.y), `${label} top gap`).toBeLessThanOrEqual(2)
  expect(Math.abs(inner.width - outer.width), `${label} width`).toBeLessThanOrEqual(2)
  expect(Math.abs(inner.height - outer.height), `${label} height`).toBeLessThanOrEqual(2)
}

async function signIn(page: Page) {
  await page.goto('/login?next=%2Fp%2Feast-london%2Fcourse%2F3')
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function openCourse(page: Page) {
  await page.goto('/p/east-london/course/3')
  if ((await page.getByTestId('player-card').count()) === 0) {
    const start = page.getByTestId('start-part')
    if (await start.count()) await start.click()
    else await page.getByTestId('buffet-talk').first().click()
  }
  const player = page.getByTestId('player')
  await expect(page.getByTestId('player-card')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('.course-film-band iframe, .course-film-band video').first()).toBeAttached({ timeout: 20_000 })
  await expect(player).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  await expect(player).toHaveAttribute('data-cover', 'no', { timeout: 20_000 })
}

async function openFeed(page: Page) {
  await page.goto('/p/east-london/feed')
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 30_000 })
  await expect(feed).toHaveAttribute('data-framing', 'F')
  await expect(feed).toHaveAttribute('data-playing', 'yes', { timeout: 20_000 })
  await expect(feed).toHaveAttribute('data-cover', 'no', { timeout: 20_000 })
  await expect(page.getByTestId('film-band')).toBeVisible()
  await expect(page.locator('[data-testid="film-band"] iframe').first()).toBeAttached({ timeout: 20_000 })
}

async function boxes(page: Page, outer: string, inner: string) {
  return page.evaluate(({ outer, inner }) => {
    const rect = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    return { outer: rect(outer), inner: rect(inner) }
  }, { outer, inner })
}

test('course and feed film stay 16:9 of the column at phone and laptop widths', async ({ page }) => {
  test.setTimeout(180_000)
  mkdirSync(SHOTS, { recursive: true })
  await page.addInitScript(() => {
    window.localStorage.setItem('hearts.feed-coach.v1', 'true')
  })
  await fakeYouTube(page)
  await signIn(page)

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ ...viewport })
    await openCourse(page)
    const course = await boxes(page, '[data-testid="player-card"]', '.course-film-band iframe, .course-film-band video')
    expect(course.outer, 'course card').toBeTruthy()
    expect(course.inner, 'course film').toBeTruthy()
    assertSixteenNine(course.outer!, 'course card', viewport.width)
    assertFilled(course.outer!, course.inner!, 'course film')
    await page.screenshot({ path: `${SHOTS}/player-16x9-course-${viewport.width}x${viewport.height}.png` })

    await openFeed(page)
    const feed = await boxes(page, '[data-testid="film-band"]', '[data-testid="film-band"] iframe')
    expect(feed.outer, 'feed band').toBeTruthy()
    expect(feed.inner, 'feed film').toBeTruthy()
    assertSixteenNine(feed.outer!, 'feed band', viewport.width)
    assertFilled(feed.outer!, feed.inner!, 'feed film')
    await page.screenshot({ path: `${SHOTS}/player-16x9-feed-${viewport.width}x${viewport.height}.png` })
  }
})
