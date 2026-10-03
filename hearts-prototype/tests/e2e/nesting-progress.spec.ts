import { mkdirSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

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
    const box = (await page.getByTestId('gesture-layer').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 8 })
    await page.mouse.up()
  }
  const first = await feed.getAttribute('data-cut')
  await swipe(-200, 0)
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).not.toHaveAttribute('data-cut', first!)
  await swipe(200, 0)
  await expect(feed).toHaveAttribute('data-cut', first!)
  await shot(page, 'hors-loop')

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

  await page.goto('/p/east-london/lanes')
  await page.getByTestId('path-course').first().getByRole('link', { name: 'Start' }).click()
  await expect(page.getByTestId('part-link').first()).toBeVisible()
  const links = page.getByTestId('part-link')
  const count = await links.count()
  let fresh = ''
  for (let index = 0; index < count; index += 1) {
    const text = (await links.nth(index).innerText()) || ''
    if (/watched/i.test(text)) continue
    fresh = /part=(\d+)/.exec((await links.nth(index).getAttribute('href')) || '')?.[1] || ''
    if (fresh) break
  }
  expect(fresh, 'a course part that has not been watched').toBeTruthy()
  const finished = await page.request.post('/api/hearts', {
    form: { action: 'complete', level: 'talk', lesson: fresh, seconds: '99999', ended: 'yes', next: '/p/east-london/garden/general' },
    maxRedirects: 0,
  })
  expect(finished.status()).toBe(303)
  expect(decodeURIComponent((finished.headers()['location'] || '').replace(/\+/g, ' '))).not.toMatch(/error=/)
  await page.goto('/p/east-london/garden/general')
  await expect(sittings).toHaveText(String(before + 1))
  await shot(page, 'grow-after-talk')
})
