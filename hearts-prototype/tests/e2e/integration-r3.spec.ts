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
  await expect(page.getByTestId('theme-pin')).toHaveCount(0)
  await expect(page.getByText('Light', { exact: true })).toHaveCount(0)
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('evening')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(14, 42, 43)')
  await page.reload()
  await expect(page.getByTestId('me')).toBeVisible()
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
    const caption = page.getByTestId('caption')
    if (await caption.count()) {
      await expect(caption).toHaveAttribute('data-slot', 'bar')
      const cap = (await caption.boundingBox())!
      const slot = (await page.getByTestId('player-slot').boundingBox())!
      expect(cap.y, 'the caption sits in the bar below the picture, not over the film').toBeGreaterThanOrEqual(slot.y + slot.height - 12)
    }
    const top = page.getByTestId('top-speaker')
    await expect(top.getByRole('button', { name: /follow/i })).toBeVisible()
    const box = (await top.boundingBox())!
    expect(box.y + box.height, 'the Follow row sits above the lower third').toBeLessThan(844 * 0.4)
    await expect(page.locator('.clip-foot [data-testid="speaker-link"]')).toHaveCount(0)
    await expect(page.getByTestId('poster-frame').locator('.j-poster-who')).toBeHidden()
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

test('small fixes: favicon, Teach emails end in an ellipsis, and the install card does not push Home down', async ({ page, request, browser }) => {
  const icon = await request.get('/favicon.ico')
  expect(icon.status()).toBe(200)
  expect(icon.headers()['content-type']).toMatch(/icon/)
  for (const size of [16, 32, 48, 96]) expect((await request.get(`/icons/favicon-${size}.png`)).status()).toBe(200)

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/teach`)
  const email = page.getByTestId('learner-email').first()
  await expect(email).toBeVisible()
  expect(await email.getAttribute('title')).toBe((await email.innerText()).trim())
  expect(await email.evaluate((el) => getComputedStyle(el).textOverflow)).toBe('ellipsis')
  for (const cell of await page.getByTestId('learner-email').all()) {
    expect(await cell.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
    expect(await cell.evaluate((el) => el.getClientRects().length)).toBe(1)
  }

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  })
  const app = await phone.newPage()
  await signIn(app, 'elm-learner@hearts.test', 'portal-learner', PORTAL)
  const card = app.getByTestId('install-card')
  const carryOn = app.getByTestId('continue')
  await expect(card).toBeVisible()
  await expect(carryOn).toBeVisible()
  expect(await card.getAttribute('data-variant')).toBe('strip')
  expect(await card.getAttribute('data-surface')).toBe('phone')
  expect(await card.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed')
  await expect(card.locator('h2')).toContainText('phone')
  await expect(card.locator('h2')).not.toContainText('computer')
  const carryBox = await carryOn.boundingBox()
  const box = await card.boundingBox()
  expect(carryBox && box, 'Continue and the install strip both have a box').toBeTruthy()
  if (carryBox && box) {
    expect(box.y, 'the install strip sits below Continue').toBeGreaterThanOrEqual(carryBox.y + carryBox.height - 1)
    expect(carryBox.y + carryBox.height, 'Continue is not covered').toBeLessThanOrEqual(box.y + 1)
  }
  await phone.close()
})

test('an opened pack spans the main area as at most about 20 door tiles, with no seats until a door opens, then one clean heading per Ghunya seat', async ({ page, playwright }) => {
  const master = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const docs = async (path: string) => ((await (await master.get(path)).json()).docs || []) as Record<string, any>[]
  const courses = await docs('/api/courses?where[origin][equals]=master&depth=0&limit=500')
  const made = await master.post('/api/packs', { data: { title: 'HEARTS library: all talks', owner: 'master', summary: '', courses: courses.map((course) => course.id) } })
  expect(made.ok()).toBeTruthy()
  const packId = (await made.json()).doc.id

  // The seed's cuts carry no seat, so give each cut one its clause really has.
  const cuts = (await docs('/api/cuts?where[bestClause][exists]=true&depth=0&limit=2000')).filter((cut) => cut.bestClause)
  const seatsByClause = new Map<number, Record<string, any>[]>()
  for (const seat of await docs('/api/seats?depth=1&limit=500')) {
    const clause = Number(seat.clause?.number || 0)
    seatsByClause.set(clause, [...(seatsByClause.get(clause) || []), seat])
  }
  const changed: { id: number; seat: unknown }[] = []
  for (const cut of cuts) {
    const options = (seatsByClause.get(Number(cut.bestClause)) || []).filter((seat) => /^Vol\./.test(String(seat.text)))
    if (!options.length) continue
    changed.push({ id: cut.id, seat: cut.seat ?? null })
    expect((await master.patch(`/api/cuts/${cut.id}`, { data: { seat: options[changed.length % options.length].id } })).ok()).toBeTruthy()
  }
  expect(changed.length).toBeGreaterThan(2)

  try {
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin/library`)
    await expect(page.getByTestId('admin-library')).toContainText('Courses from the main HEARTS library. Add a pack and it stays up to date.')
    for (const title of ['Library packs', 'Library courses']) {
      const header = page.locator('.panel > header').filter({ hasText: title })
      expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor), title).toBe('rgb(15, 59, 58)')
    }

    const pack = page.getByTestId('library-pack').filter({ hasText: 'HEARTS library: all talks' })
    await pack.getByText('Show the courses').click()
    await expect(page).toHaveURL(new RegExp(`pack=${packId}`))
    const opened = page.getByTestId('pack-open')
    await expect(opened).toBeVisible()
    const main = await page.locator('[data-testid=admin-library] .panel').first().boundingBox()
    const area = await opened.boundingBox()
    expect(area!.width).toBeGreaterThan(main!.width - 2)
    expect(area!.width).toBeGreaterThan(1000)

    const tiles = opened.getByTestId('door-tile')
    const count = await tiles.count()
    expect(count).toBeGreaterThanOrEqual(20)
    expect(count).toBeLessThanOrEqual(21)
    const tops = await tiles.evaluateAll((all) => all.slice(0, 5).map((tile) => Math.round(tile.getBoundingClientRect().top)))
    expect(new Set(tops.slice(0, 4)).size, 'four tiles across').toBe(1)
    expect(tops[4]).toBeGreaterThan(tops[0])
    for (const text of await tiles.allInnerTexts()) expect(text).toMatch(/^(Door \d+ · |Not on a door yet)/)
    const empty = opened.locator('[data-testid=door-tile][data-empty=yes]')
    expect(await empty.count()).toBeGreaterThan(0)
    await expect(empty.first()).toContainText('Nothing here yet')
    await expect(empty.first()).toBeDisabled()
    await expect(opened.getByTestId('seat-label')).toHaveCount(0)
    await expect(opened.getByTestId('seat-group')).toHaveCount(0)
    await expect(opened.getByTestId('door-open')).toHaveCount(0)

    const full = opened.locator('[data-testid=door-tile][data-empty=no]')
    let seated = false
    for (let index = 0; index < (await full.count()) && !seated; index += 1) {
      await full.nth(index).click()
      await expect(opened.getByTestId('door-open')).toHaveCount(1)
      seated = (await opened.getByTestId('seat-label').filter({ hasText: /^Seats? / }).count()) > 0
    }
    expect(seated, 'some door has a Ghunya seat').toBe(true)
    const labels = await opened.locator('[data-testid=seat-label]').filter({ hasText: /^Seats? / }).all()
    const texts: string[] = []
    for (const label of labels) {
      const text = (await label.innerText()).trim()
      texts.push(text)
      expect(text).toMatch(/^Seats? [\d, and]+ · Volume [1-5](, Chapter \d+)?$/)
      expect(await label.getAttribute('title')).toMatch(/^Vol\./)
    }
    expect(new Set(texts).size, 'one heading per seat').toBe(texts.length)
    const seat = opened.getByTestId('seat-group').first()
    await seat.locator('summary').click()
    await expect(seat.getByTestId('pack-course').first()).toBeVisible()
    await expect(opened.getByTestId('door-open').getByTestId('door-tile')).toHaveCount(0)
  } finally {
    for (const row of changed) await master.patch(`/api/cuts/${row.id}`, { data: { seat: row.seat } })
    await master.delete(`/api/packs/${packId}`)
    await master.dispose()
  }
})
