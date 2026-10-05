import { mkdirSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const PHONE = { width: 390, height: 844 }
const SHOTS = process.env.HEARTS_SHOTS

async function shot(page: Page, name: string) {
  if (!SHOTS) return
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test('at phone size, short clips stay off the grow page and a full talk in a course moves it', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/garden/general')
  const sittings = page.getByTestId('stat-sittings')
  const before = Number((await sittings.textContent()) || '0')

  await page.goto('/p/east-london/feed')
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  const lesson = await feed.getAttribute('data-lesson')
  const speaker = await feed.getAttribute('data-speaker')
  const slug = await feed.getAttribute('data-speaker-slug')
  expect(lesson && speaker && slug).toBeTruthy()

  const swipe = async (dx: number, dy: number) => {
    await page.waitForFunction(() => !document.querySelector('.j-clip')?.getAnimations().length)
    const box = (await page.getByTestId('gesture-layer').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
  }
  const opening = await feed.getAttribute('data-cut')
  await swipe(-200, 0)
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).not.toHaveAttribute('data-cut', opening!)
  const beforeDown = await feed.getAttribute('data-cut')
  const beforeCard = await feed.getAttribute('data-card')
  await swipe(0, 200)
  const afterDown = await feed.getAttribute('data-cut')
  const afterCard = await feed.getAttribute('data-card')
  expect(afterDown !== beforeDown || afterCard !== beforeCard, 'a down swipe moves to another clip or card on this level').toBeTruthy()
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await shot(page, 'hors-loop')
  const first = await feed.getAttribute('data-cut')

  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-cut', first!)
  await swipe(0, -200)
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await shot(page, 'appetiser-loop')
  await page.getByTestId('learn-more').click()
  await page.waitForURL(/\/course\/\d+/)
  expect(page.url()).toContain(`part=`)
  expect(page.url()).toContain('t=0')
  await shot(page, 'full-talk')

  await page.goto('/p/east-london/garden/general')
  await expect(sittings).toHaveText(String(before))

  const browsed = await page.request.post('/api/hearts', {
    headers: { accept: 'application/json' },
    form: {
      action: 'browse',
      level: 'appetiser',
      event: 'learn-more',
      lesson: lesson!,
      speaker: speaker!,
      speakerSlug: slug!,
      start: '0',
      end: '120',
      parent: `talk:${lesson}`,
    },
  })
  expect(browsed.ok()).toBeTruthy()
  expect((await browsed.json()).counted).toBe(false)

  const skipped = await page.request.post('/api/hearts', {
    form: { action: 'complete', level: 'hors', lesson: lesson!, seconds: '99999', ended: 'yes', next: '/p/east-london/garden/general' },
    maxRedirects: 0,
  })
  expect(skipped.status()).toBe(303)
  expect(decodeURIComponent((skipped.headers()['location'] || '').replace(/\+/g, ' '))).toMatch(/short clip/i)
  await page.goto('/p/east-london/garden/general')
  await expect(sittings).toHaveText(String(before))
  await shot(page, 'grow-unchanged')

  await expect(async () => {
    await page.goto(`/p/east-london/speaker/${slug}`)
    await expect(page.getByTestId('drawn-to')).toBeVisible()
  }).toPass({ timeout: 15_000 })
  await shot(page, 'drawn-to')

  // The seed has this learner through the Day 1 courses, so look for a part of any open course not yet watched.
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const learner = (await (await master.get('/api/users?where[email][equals]=elm-learner@hearts.test&depth=0')).json()).docs[0] as { id: number }
  const watched = new Set(((await (await master.get(`/api/completions?where[user][equals]=${learner.id}&depth=0&limit=200`)).json()).docs as { lesson: number }[]).map((row) => Number(row.lesson)))
  const lessons = ((await (await master.get('/api/lessons?depth=0&limit=200&sort=id')).json()).docs as { id: number }[]).filter((row) => !watched.has(row.id))
  await master.dispose()
  let fresh = ''
  for (const row of lessons) {
    const tried = await page.request.post('/api/hearts', {
      form: { action: 'complete', level: 'talk', lesson: String(row.id), seconds: '99999', ended: 'yes', next: '/p/east-london/garden/general' },
      maxRedirects: 0,
    })
    expect(tried.status()).toBe(303)
    if (/error=/.test(tried.headers()['location'] || '')) continue
    fresh = String(row.id)
    break
  }
  expect(fresh, 'a course part that has not been watched').toBeTruthy()
  await page.goto('/p/east-london/garden/general')
  await expect(sittings).toHaveText(String(before + 1))
  await shot(page, 'grow-after-talk')
})
