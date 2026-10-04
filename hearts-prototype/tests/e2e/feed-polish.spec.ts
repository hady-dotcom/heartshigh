import { expect, test, type Locator, type Page } from '@playwright/test'
import { fakeYouTube } from './fake-youtube'

// Follow-ups from the live check: one Tap for sound, readable chrome on cream cards, scenic cards for talks
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
  let last = ''
  await expect(async () => {
    const now = `${await feed.getAttribute('data-index')}:${await feed.getAttribute('data-mode')}`
    const same = now === last
    last = now
    expect(same).toBe(true)
  }).toPass({ timeout: 10_000, intervals: [400] })
  await page.waitForTimeout(150)
}

async function stepTo(page: Page, feed: Locator, card: string) {
  const total = ((await feed.getAttribute('data-cuts')) || '').split(' ').length
  for (let tries = 0; tries < total * 3 && (await feed.getAttribute('data-card')) !== card; tries++) {
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(feed, page)
  }
  await expect(feed).toHaveAttribute('data-card', card)
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
    const card = document.querySelector('[data-testid="feed-question"]') as HTMLElement
    const bg = rgb(getComputedStyle(card).backgroundColor)
    return [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.offsetParent && el.textContent?.trim()).map((el) => {
      const [r, g, b, a = 1] = rgb(getComputedStyle(el).color)
      const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a))
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x)
      return { text: el.textContent!.trim().slice(0, 30), ratio: (hi + 0.05) / (lo + 0.05) }
    })
  }, selector)
}

test('one Tap for sound on the first clip and on the appetiser; the question card’s chrome reads at AA', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize(PHONE)
  await fakeYouTube(page)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${PORTAL}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await settled(feed, page)
  await expect(feed).toHaveAttribute('data-card', 'talk')
  await expect(page.getByTestId('tap-sound').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('tap-sound')).toHaveCount(1)

  await stepTo(page, feed, 'question')
  const rows = await contrasts(page, '.j-chrome .rail button, .j-chrome .speaker-row b, .j-chrome .speaker-row small, .j-chrome .follow, .feed-card .kicker, .feed-card h2, .feed-card p')
  expect(rows.length).toBeGreaterThanOrEqual(6)
  for (const row of rows) expect(row.ratio, `${row.text} ${row.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)

  await stepTo(page, feed, 'talk')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(page.getByTestId('tap-sound').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('tap-sound')).toHaveCount(1)
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
        const quote = ((await page.getByTestId('scene-quote').textContent()) || '').replace(/\s+/g, ' ').trim()
        if (quote) {
          expect(quote, quote).toMatch(/^["“‘(]?[A-Z0-9\u0600-\u06FF]/)
          expect(quote.split(' ').length, quote).toBeGreaterThan(1)
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
    const before = await feed.getAttribute('data-index')
    await page.getByTestId('gesture-next').dispatchEvent('click')
    await expect(feed).not.toHaveAttribute('data-index', before!)
    await settled(feed, page)
  }
  expect(checked, 'scenic cards checked').toBeGreaterThan(0)
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
