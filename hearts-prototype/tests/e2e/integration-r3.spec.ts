import { expect, test, type Page } from '@playwright/test'

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
