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
  await expect(page.getByTestId('course')).toBeVisible()
  await assertHelpClear(page, 'course')
  await page.goto('/join')
  await expect(page.getByTestId('join')).toBeVisible()
  await assertHelpClear(page, 'join')
  await page.goto(`${BASE}/start`)
  await expect(page.getByTestId('lets-play').or(page.getByTestId('pass'))).toBeVisible()
  await assertHelpClear(page, 'opening')
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
