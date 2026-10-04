import { expect, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'

const PORTAL = '/p/east-london'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('Me loads with no console errors and keeps the evening palette when the phone is not on UTC', async ({ browser }) => {
  // 20:00 in Los Angeles is evening on the phone, while the server's UTC clock reads the next morning.
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Los_Angeles', locale: 'en-US' })
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-10-04T20:00:00-07:00'))
  const errors: string[] = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (error) => errors.push(error.message))
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/me`)
  await expect(page.getByTestId('theme-pin')).toBeVisible()
  await expect(page.getByTestId('theme-now')).toHaveText('Showing Evening.')
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('evening')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(14, 42, 43)')
  await page.reload()
  await expect(page.getByTestId('theme-now')).toHaveText('Showing Evening.')
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('evening')
  expect(errors.filter((text) => !/Failed to load resource|youtube|ytimg/i.test(text)), errors.join('\n')).toEqual([])
  await context.close()
})

for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
  test(`the desk sidebar keeps the learner app link, the name and Sign out in view at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin`)
    for (const target of [page.getByTestId('logout'), page.locator('.side-foot .who'), page.locator('.side-foot a.nav').first()]) {
      await expect(target).toBeVisible()
      await expect(target).toBeInViewport({ ratio: 1 })
    }
    const nav = await page.locator('.side-nav').evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, overflow: getComputedStyle(el).overflowY }))
    expect(nav.overflow).toBe('auto')
    if (nav.scroll > nav.client) {
      await page.locator('.side-nav a.nav').last().scrollIntoViewIfNeeded()
      await expect(page.locator('.side-nav a.nav').last()).toBeInViewport()
      await expect(page.getByTestId('logout')).toBeInViewport({ ratio: 1 })
    }
    await page.mouse.wheel(0, 2000)
    await expect(page.getByTestId('logout')).toBeInViewport({ ratio: 1 })
  })
}

test('a YouTube Short in the feed: no caption over its burned-in words, Follow at the top, and our own poster', async ({ page, playwright }) => {
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  await fakeYouTube(page, { blockAutoplay: true })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(page.getByTestId('poster-frame')).toBeVisible()
  const poster = await page.locator('[data-testid="poster-frame"] img').getAttribute('src')
  expect(poster || '', 'the poster is ours, not a YouTube thumbnail').not.toMatch(/ytimg|youtube|\/clips\//)
  const lessonId = await feed.getAttribute('data-lesson')
  const lesson = (await (await master.get(`/api/lessons/${lessonId}?depth=0`)).json()) as { youtubeId: string; youtubeUrl?: string | null }
  try {
    expect((await master.patch(`/api/lessons/${lessonId}`, { data: { youtubeUrl: `https://www.youtube.com/shorts/${lesson.youtubeId}` } })).ok()).toBeTruthy()
    expect(((await (await master.get(`/api/lessons/${lessonId}?depth=0`)).json()) as { vertical?: boolean }).vertical).toBe(true)
    await page.reload()
    await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
    await expect(feed).toHaveAttribute('data-lesson', lessonId!)
    await expect(feed).toHaveAttribute('data-vertical', 'yes')
    await expect(page.getByTestId('caption')).toHaveCount(0)
    const top = page.getByTestId('top-speaker')
    await expect(top.getByRole('button', { name: /follow/i })).toBeVisible()
    const box = (await top.boundingBox())!
    expect(box.y + box.height, 'the Follow row sits above the lower third').toBeLessThan(844 * 0.4)
    await expect(page.locator('.clip-foot [data-testid="speaker-link"]')).toHaveCount(0)
    await expect(page.locator('.j-poster-who')).toBeHidden()
    expect(await page.locator('[data-testid="poster-frame"] img').getAttribute('src')).not.toMatch(/ytimg|youtube|\/clips\//)
  } finally {
    await master.patch(`/api/lessons/${lessonId}`, { data: { youtubeUrl: lesson.youtubeUrl || null, vertical: false } })
    await master.dispose()
  }
})

test('the export log shows times in the portal\'s zone with a short label, in the viewer\'s language', async ({ browser }) => {
  const { zonedTime } = await import('../../src/lib/zone-time')
  for (const locale of ['en-GB', 'de-DE']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale, timezoneId: 'America/Los_Angeles' })
    const page = await context.newPage()
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/feedback`)
    expect((await page.request.get('/api/feedback?portal=east-london&format=csv')).ok()).toBeTruthy()
    await page.reload()
    await expect(page.getByTestId('audit-zone')).toHaveText('Times in London time')
    const when = page.getByTestId('audit-when').first()
    const at = (await when.getAttribute('data-at'))!
    await expect(when).toHaveText(zonedTime(at, 'Europe/London', locale))
    if (locale === 'en-GB') await expect(when).toHaveText(/\d{1,2} \w{3} \d{4}, \d{2}:\d{2} (BST|GMT)$/)
    else await expect(when).toHaveText(/^\d{1,2}\. \w+\.? \d{4}, \d{2}:\d{2} /)
    await context.close()
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-GB' })
  const page = await context.newPage()
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/settings`)
  await page.getByTestId('time-zone').selectOption('Asia/Dubai')
  await page.getByTestId('save-settings').click()
  await expect(page.getByTestId('time-zone')).toHaveValue('Asia/Dubai')
  try {
    await page.goto(`${PORTAL}/admin/feedback`)
    await expect(page.getByTestId('audit-zone')).toHaveText('Times in Dubai time')
    const when = page.getByTestId('audit-when').first()
    await expect(when).toHaveText(zonedTime((await when.getAttribute('data-at'))!, 'Asia/Dubai', 'en-GB'))
    await expect(when).toHaveText(/GST$/)
  } finally {
    await page.goto(`${PORTAL}/admin/settings`)
    await page.getByTestId('time-zone').selectOption('Europe/London')
    await page.getByTestId('save-settings').click()
    await expect(page.getByTestId('time-zone')).toHaveValue('Europe/London')
    await context.close()
  }
})
