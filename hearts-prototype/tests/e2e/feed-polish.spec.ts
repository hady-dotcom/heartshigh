import { expect, request as playwrightRequest, test, type Locator, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { fakeYouTube } from './fake-youtube'
import { settled as feedSettled, stepFeed, stepToCard } from './feed-step'

// Follow-ups from the live check: no play-gate label, readable chrome on cream cards, scenic cards for talks
// without a voice, tidy harvest lines with one count everywhere, and portal names instead of slugs.

const PHONE = { width: 390, height: 844 }
const PORTAL = '/p/east-london'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function settled(feed: Locator, page: Page) {
  await feedSettled(page, feed)
}

async function stepTo(page: Page, feed: Locator, card: string) {
  const found = await stepToCard(page, card, feed)
  expect(found, `needed a ${card} before the pool ran out`).toBe(true)
}

/** WCAG contrast of each matched element's text against the card's cream. */
async function contrasts(page: Page, selector: string) {
  return page.evaluate((selector) => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const card = (document.querySelector('[data-testid="scene-card"]') || document.querySelector('[data-testid="journey"]')) as HTMLElement
    const bg = rgb(getComputedStyle(card).backgroundColor)
    return [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.offsetParent && el.textContent?.trim()).map((el) => {
      const [r, g, b, a = 1] = rgb(getComputedStyle(el).color)
      const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a))
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      return { text: el.textContent!.trim().slice(0, 30), ratio: (hi + 0.05) / (lo + 0.05) }
    })
  }, selector)
}

test('Today’s clips autoplay with no Tap for sound, and scenic chrome stays readable', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await expect(feed).toHaveAttribute('data-card', 'talk')
  await expect(page.getByTestId('tap-sound')).toHaveCount(0)
  await expect(page.getByTestId('tap-to-play')).toHaveCount(0)
  await expect(page.getByTestId('level-clip')).toBeVisible()
  await expect(page.getByTestId('level-minutes')).toBeVisible()
  await expect(page.getByTestId('level-lecture')).toBeVisible()

  await stepTo(page, feed, 'scene')
  const rows = await contrasts(page, '.j-chrome .rail button, .j-chrome .speaker-row b, [data-testid="scene-card"] h2, [data-testid="scene-quote"], [data-testid="scene-next"]')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.ratio, `${row.text} ${row.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)

  await page.goto(`${PORTAL}/feed?fresh=${Date.now()}`)
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await stepTo(page, feed, 'talk')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('tap-sound')).toHaveCount(0)
  await expect(page.getByTestId('tap-to-play')).toHaveCount(0)
  await expect(page.getByTestId('level-minutes')).toHaveAttribute('aria-pressed', 'true')
})

test('every scenic card in the feed keeps its words inside the card, never shifts the screen, and offers Mute only with audio', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(PHONE)
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  let checked = 0
  for (let at = 0; at < total; at++) {
    if ((await feed.getAttribute('data-card')) === 'scene') {
      const card = page.getByTestId('scene-card')
      const audio = await card.getAttribute('data-audio')
      await expect(page.getByTestId('scene-voice')).toHaveCount(audio === 'yes' ? 1 : 0)
      const beats = 3
      for (let beat = 0; beat < beats; beat++) {
        await page.waitForTimeout(250)
        const peel = page.getByTestId('peel-open')
        if (await peel.isVisible().catch(() => false)) {
          await peel.click()
          await page.waitForTimeout(400)
        }
        const quote = ((await page.getByTestId('scene-quote').textContent()) || '').replace(/\s+/g, ' ').trim()
        if (quote) {
          expect(quote, quote).toMatch(/^["“‘(]?[A-Z0-9\u0600-\u06FF]/)
          expect(quote.split(' ').length, quote).toBeGreaterThan(1)
          expect(quote.split(' ').length, quote).toBeLessThanOrEqual(31)
          expect(quote, quote).not.toMatch(/\b(for|in|of|to|and|the|a|except)[.…]?$/i)
        }
        const box = await page.evaluate(() => {
          const slide = document.querySelector('[data-testid="scene-card"]') as HTMLElement
          const rect = slide.getBoundingClientRect()
          const foot = slide.querySelector('.slide-cta')!.getBoundingClientRect()
          const boxes = [...slide.querySelectorAll<HTMLElement>('.kinetic-body, .scene-stack, .window-card, .bubble-text')]
          let scrolled = 0
          for (let el: HTMLElement | null = slide.parentElement; el; el = el.parentElement) scrolled += el.scrollTop
          return {
            scrolled,
            shift: Math.abs(rect.top - (document.querySelector('[data-testid="journey"]') as HTMLElement).getBoundingClientRect().top),
            footOver: foot.bottom - (rect.bottom - parseFloat(getComputedStyle(slide).paddingBottom)),
            spill: boxes.filter((el) => !el.classList.contains('kinetic-body')).map((el) => el.scrollHeight - el.clientHeight).reduce((a, b) => Math.max(a, b), 0),
          }
        })
        expect(box.scrolled, 'nothing above the card is scrolled').toBe(0)
        expect(box.shift).toBeLessThan(1)
        expect(box.footOver, 'the footer stays on the card').toBeLessThanOrEqual(1)
        expect(box.spill, 'no words spill out of a card or bubble').toBeLessThanOrEqual(1)
        const before = await card.getAttribute('data-beat')
        if (beat < beats - 1) await expect(card).not.toHaveAttribute('data-beat', before!, { timeout: 15_000 }).catch(() => undefined)
      }
      checked++
    }
    if ((await stepFeed(page, feed)) === 'end') break
  }
  expect(checked, 'scenic cards checked').toBeGreaterThan(0)
})

test('Home Your plan heading reads at AA on the teal card', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const portals = (await (await master.get('/api/portals?limit=10&depth=0')).json()) as { docs: { id: number; slug?: string }[] }
  const portal = portals.docs.find((row) => row.slug === 'east-london')
  const users = (await (await master.get('/api/users?where[email][equals]=elm-learner@hearts.test&limit=1&depth=0')).json()) as { docs: { id: number }[] }
  const lessons = (await (await master.get('/api/lessons?limit=40&depth=0&sort=id')).json()) as { docs: { id: number; course?: number | { id: number } }[] }
  const done = (await (await master.get(`/api/completions?where[user][equals]=${users.docs[0]?.id || 0}&limit=100&depth=0`)).json()) as { docs: { lesson?: number | { id: number } }[] }
  const watched = new Set(done.docs.map((row) => (typeof row.lesson === 'object' ? row.lesson?.id : row.lesson)))
  const lesson = lessons.docs.find((row) => row.id && !watched.has(row.id))
  expect(portal && users.docs[0] && lesson, 'Maryam needs an open sitting for the plan card').toBeTruthy()
  const courseId = typeof lesson!.course === 'object' ? lesson!.course.id : lesson!.course
  const made = await master.post('/api/schedules', {
    data: {
      name: 'Tonight contrast',
      owner: users.docs[0].id,
      learners: [users.docs[0].id],
      targetType: 'course',
      course: courseId,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      weekdays: [1],
      minutesPerDay: 30,
      portal: portal!.id,
      slots: [{ date: '2026-10-05', title: 'Tonight sitting', lessonId: lesson!.id }],
    },
  })
  expect(made.ok(), 'the tonight sitting has to be saved').toBeTruthy()
  await master.dispose()
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', PORTAL)
  await page.goto(PORTAL)
  const plan = page.getByTestId('home-plan')
  await expect(plan, 'Home Your plan card must be on the teal card').toBeVisible()
  const rows = await page.evaluate(() => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const card = document.querySelector('[data-testid="home-plan"]') as HTMLElement
    const bg = rgb(getComputedStyle(card).backgroundColor)
    return [...card.querySelectorAll<HTMLElement>('.eyebrow, h2, p')].filter((el) => el.textContent?.trim()).map((el) => {
      const [r, g, b, a = 1] = rgb(getComputedStyle(el).color)
      const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a))
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      return { text: el.textContent!.trim().slice(0, 40), ratio: (hi + 0.05) / (lo + 0.05), color: getComputedStyle(el).color, bg: getComputedStyle(card).backgroundColor }
    })
  })
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) expect(row.ratio, `${row.text} ${row.color} on ${row.bg} ${row.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
})

test('harvest lines are whole sentences, and Home, Garden and Harvest show the same counts', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', PORTAL)
  const read = async () => ({
    total: ((await page.getByTestId('ring-harvest').locator('.r').textContent()) || '').trim(),
    fresh: (await page.getByTestId('ring-harvest-new').count()) ? ((await page.getByTestId('ring-harvest-new').textContent()) || '').trim() : '0 new',
  })
  await page.goto(PORTAL)
  const home = await read()
  await page.goto(`${PORTAL}/garden`)
  expect(await read()).toEqual(home)
  await page.goto(`${PORTAL}/garden/general`)
  await expect(page.getByTestId('stat-harvest')).toHaveText(home.total)

  await page.goto(`${PORTAL}/garden/harvest`)
  const quotes = await page.getByTestId('harvest-quote').allTextContents()
  expect(String(quotes.length)).toBe(home.total)
  expect(`${await page.getByTestId('harvest-new').count()} new`).toBe(home.fresh)
  for (const quote of quotes.map((text) => text.trim())) {
    expect(quote, quote).toMatch(/^["“‘(]?[A-Z0-9\u0600-\u06FF]/)
    expect(quote, quote).toMatch(/[.?!…]["”’')\]]*$/)
    expect(quote, quote).not.toMatch(/description|full dua|paraphrasing|subscribe/i)
    expect(quote, quote).not.toMatch(/\b(for|in|of|to|and|or|but|the|a|an|except|with|from)[.?!…]["”’')\]]*$/i)
    expect(quote, quote).not.toMatch(/\ballah\b|\bquran\b|\bthe prophet\b/)
  }
})

test('the portal desk names the portal, never its slug, in the sidebar and on a narrow screen', async ({ page }) => {
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${PORTAL}/admin`)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${PORTAL}/admin`)
  const side = page.locator('.side-brand')
  await expect(side).toBeVisible()
  await expect(side).not.toContainText('east-london')
  await expect(side.locator('small')).toHaveText('Portal desk')
  const name = ((await side.locator('b').textContent()) || '').trim()
  expect(name.length).toBeGreaterThan(2)
  await page.setViewportSize(PHONE)
  const narrow = page.getByTestId('desk-narrow')
  await expect(narrow).toBeVisible()
  await expect(narrow).toContainText(`The ${name} portal desk needs a wider screen`)
  await expect(narrow).not.toContainText('east-london')
})

test('until a clip actually plays, our poster and a gold play button cover the player, never YouTube’s own', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page, { blockAutoplay: true })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  await stepTo(page, feed, 'talk')
  await expect(page.getByTestId('poster-frame')).toBeVisible()
  await expect(page.getByTestId('poster-play')).toBeVisible({ timeout: 15_000 })
  const vars = (await page.evaluate(() => (window as unknown as { __playerVars: Record<string, unknown>[] }).__playerVars)).at(-1)!
  expect(vars).toMatchObject({ controls: 0, playsinline: 1, rel: 0, iv_load_policy: 3, cc_load_policy: 0, modestbranding: 1 })
  await page.evaluate(() => { (window as unknown as { __allowPlay: boolean }).__allowPlay = true })
  if (await page.getByTestId('swipe-coach').count()) await page.getByTestId('swipe-coach').click()
  await page.getByTestId('poster-play').click()
  await expect(page.getByTestId('poster-frame')).toHaveCount(0)
  await expect(page.getByTestId('poster-play')).toHaveCount(0)
})
