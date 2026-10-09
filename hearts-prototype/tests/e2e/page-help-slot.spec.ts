import { expect, test, type Page } from '@playwright/test'

const BASE = '/p/east-london'
const PHONE = { width: 390, height: 844 }

function overlap(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return !(a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1)
}

async function signIn(page: Page) {
  await page.goto(`/login?next=${encodeURIComponent(BASE)}`)
  await page.getByTestId('login-email').fill('elm-learner@hearts.test')
  await page.getByTestId('login-password').fill('portal-learner')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function assertHelpClear(page: Page, label: string) {
  const help = page.getByTestId('page-help-open')
  await expect(help, label).toBeVisible()
  const box = (await help.boundingBox())!
  const nodes = page.locator('a, button, input, select, textarea, [data-testid="day-number"], [data-testid="home-avatar"], [data-testid="back"]')
  const count = await nodes.count()
  for (let i = 0; i < count; i += 1) {
    const el = nodes.nth(i)
    if (await el.evaluate((node) => Boolean(node.closest('[data-testid="page-help"]')))) continue
    if (!(await el.isVisible())) continue
    const other = await el.boundingBox()
    if (!other || other.width < 2 || other.height < 2) continue
    expect(overlap(box, other), `${label}: ? overlaps ${await el.getAttribute('data-testid') || await el.textContent()}`).toBe(false)
  }
}

test('the page ? sits in its own slot on Home, Lanes, Me, the course and join', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page)
  await page.goto(BASE)
  await expect(page.getByTestId('home')).toBeVisible()
  await assertHelpClear(page, 'Home')
  await page.goto(`${BASE}/lanes`)
  await expect(page.getByTestId('lanes')).toBeVisible()
  await assertHelpClear(page, 'Lanes')
  await page.goto(`${BASE}/me`)
  await expect(page.getByTestId('me')).toBeVisible()
  await assertHelpClear(page, 'Me')
  await page.goto(`${BASE}/course/1`)
  await expect(page.getByTestId('course-overview')).toBeVisible()
  await assertHelpClear(page, 'course')
  await page.goto('/join')
  await expect(page.getByTestId('join')).toBeVisible()
  await assertHelpClear(page, 'join')
  await page.goto(`${BASE}/start`)
  await expect(page.getByTestId('lets-play').or(page.getByTestId('pass'))).toBeVisible()
  await assertHelpClear(page, 'opening')
})

test('the help Close sits above the tab bar on a phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page)
  await page.goto(`${BASE}/lanes`)
  await expect(page.getByTestId('lanes')).toBeVisible()
  await page.getByTestId('page-help-open').click()
  const close = page.getByTestId('page-help-close')
  const tab = page.getByTestId('tab-week')
  await expect(close).toBeVisible()
  const closeBox = (await close.boundingBox())!
  const tabBox = (await tab.boundingBox())!
  expect(closeBox.y + closeBox.height, 'Close should sit above My week').toBeLessThanOrEqual(tabBox.y + 1)
  await close.click()
  await expect(page.getByTestId('page-help-sheet')).toHaveCount(0)
})

test('Home and Me use the same day count', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page)
  await page.goto(BASE)
  const banner = await page.getByTestId('days-count').innerText()
  const homeDay = (await page.getByTestId('day-number').innerText()).replace(/\D/g, '')
  expect(banner).toContain(homeDay)
  await page.goto(`${BASE}/me`)
  const meDay = (await page.getByTestId('day-number').innerText()).replace(/\D/g, '')
  expect(meDay).toBe(homeDay)
})

test('? copy matches the page and never shows another page\'s help', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page)
  const pages: [string, string, string][] = [
    [BASE, 'home', 'How to use Home'],
    [`${BASE}/lanes`, 'lanes', 'How to use Lanes'],
    [`${BASE}/week`, 'plan', 'How to use My week'],
    [`${BASE}/garden`, 'garden', 'How to use the Garden'],
    [`${BASE}/me`, 'me', 'How to use Me'],
    [`${BASE}/course/1`, 'course-overview', 'How to use this course'],
    [`${BASE}/feed`, 'feed', 'How to use clips'],
    [`${BASE}/start`, 'start', 'How to use the opening'],
    [`${BASE}/help`, 'help', 'How to use Help'],
    ['/login', 'login', 'How to sign in'],
  ]
  for (const [href, key, title] of pages) {
    await page.goto(href)
    await expect(page.getByTestId('page-help'), key).toHaveAttribute('data-page', key)
    await page.getByTestId('page-help-open').click()
    await expect(page.getByTestId('page-help-title'), key).toHaveText(title)
    await page.getByTestId('page-help-close').click()
  }
})
