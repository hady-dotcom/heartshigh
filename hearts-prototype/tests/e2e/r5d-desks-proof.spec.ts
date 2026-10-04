import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.PROOF_DIR || '/tmp/r5d-desks-proof'
const DESK = { width: 1440, height: 900 }
const LAPTOP = { width: 1366, height: 700 }
const PHONE = { width: 390, height: 844 }

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string, fullPage = false) {
  mkdirSync(dir, { recursive: true })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${dir}/${name}.png`, caret: 'initial', fullPage })
}

test.describe.configure({ timeout: 400_000 })

test.use({ video: { mode: 'on', size: DESK } })

test('r5d desk proof shots', async ({ page, browser }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
  await expect(page.getByTestId('admin-teach')).toBeVisible()

  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await expect(page.locator('[data-testid="desk-help"][data-help="admin-teach"] [role="note"]')).toBeVisible()
  await shot(page, 'help-teach-page')

  const giveHelp = page.locator('[data-testid="desk-help"][data-help="give-course"]').first()
  await giveHelp.click()
  const givePop = giveHelp.locator('[role="note"]')
  await expect(givePop).toBeVisible()
  const giveBox = await givePop.boundingBox()
  expect(giveBox, 'Give help stays on screen').toBeTruthy()
  if (giveBox) {
    expect(giveBox.x).toBeGreaterThanOrEqual(0)
    expect(giveBox.x + giveBox.width).toBeLessThanOrEqual(1440)
    expect((await givePop.evaluate((el) => getComputedStyle(el).textTransform))).toBe('none')
  }
  await shot(page, 'help-give')

  await page.goto('/p/east-london/admin/gather/attendance')
  await expect(page.getByTestId('desk-attendance')).toBeVisible()
  await expect(page.locator('.desk.gather-desk')).toHaveCSS('background-color', 'rgb(14, 42, 43)')
  await page.locator('[data-testid="desk-help"][data-help="desk-attendance"]').click()
  await expect(page.locator('[data-testid="desk-help"][data-help="desk-attendance"] [role="note"]')).toBeVisible()
  await shot(page, 'help-gather-attendance')

  await page.goto('/p/east-london/admin/nights')
  await expect(page.getByTestId('admin-nights')).toBeVisible()
  const ticketTips = page.locator('[data-testid="desk-help"][data-help="ticket"]')
  if (await ticketTips.count()) {
    await expect(ticketTips).toHaveCount(1)
    await ticketTips.click()
    await expect(ticketTips.locator('[role="note"]')).toBeVisible()
    await shot(page, 'help-nights-kind')
  }

  await page.goto('/p/east-london/admin/content')
  await expect(page.getByTestId('admin-content')).toBeVisible()
  await expect(page.locator('[data-testid="content-door"][data-door^="W"]')).toHaveCount(20)
  await expect(page.getByTestId('course-row').first()).toBeVisible()
  await expect(page.getByTestId('content-empty-doors')).toBeVisible()
  await expect(page.getByTestId('content-empty-doors')).not.toHaveAttribute('open')
  await expect(page.locator('[data-testid="content-door"] summary').first()).toContainText('Door ')
  await expect(page.locator('[data-testid="content-door"] summary').first()).not.toContainText('W2 ·')
  await shot(page, 'content-grouped-doors', true)
  await page.getByTestId('local-course-duration').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('local-course-duration')).toHaveValue('')
  await shot(page, 'content-length-empty')

  await page.goto('/p/east-london/admin/library')
  await expect(page.getByTestId('admin-library')).toBeVisible()
  const packHref = await page.getByTestId('pack-fold').first().getAttribute('href')
  if (packHref) await page.goto(packHref)
  await expect(page.getByTestId('pack-open')).toBeVisible()
  await page.locator('[data-testid="door-tile"][data-empty="no"]').first().click()
  await expect(page.getByTestId('door-open')).toBeVisible()
  await expect(page.getByTestId('seat-group').first()).toBeVisible()
  await shot(page, 'content-ghunya-seats')

  await page.goto('/p/east-london/admin/teach')
  await expect(page.getByTestId('hide-test-accounts')).toBeVisible()
  await expect(page.getByTestId('hide-test-toggle')).toBeChecked()
  await shot(page, 'teach-hide-test-on')
  await page.getByTestId('hide-test-toggle').click()
  await page.waitForURL((url) => url.searchParams.get('hideTest') === '0')
  await expect(page.getByTestId('hide-test-toggle')).not.toBeChecked()
  await shot(page, 'teach-hide-test-off')

  await page.setViewportSize(LAPTOP)
  await page.goto('/p/east-london/admin')
  await expect(page.getByTestId('side-nav')).toBeVisible()
  await page.locator('[data-testid="side-nav"]').evaluate((el) => {
    el.scrollTop = 80
  })
  const address = page.getByTestId('portal-address')
  await expect(address).toBeVisible()
  const wrap = await address.evaluate((el) => ({
    lines: el.getClientRects().length,
    break: getComputedStyle(el).wordBreak,
  }))
  expect(wrap.lines, 'the portal address stays on one line').toBe(1)
  expect(wrap.break).not.toBe('break-all')
  await shot(page, 'sidebar-scroll-1366x700')

  await page.setViewportSize(PHONE)
  await page.goto('/p/east-london/admin/teach')
  await expect(page.getByTestId('desk-narrow')).toBeVisible()
  await shot(page, 'phone-desk-narrow')

  await page.addInitScript(() => {
    localStorage.setItem('hearts.saved.v1', JSON.stringify(['cut-12', 'cut-9', 'cut-41']))
  })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/me')
  await expect(page.getByTestId('saved-list')).toBeVisible()
  await expect(page.getByTestId('saved-item').first()).not.toHaveText(/Saved clip 1/)
  await shot(page, 'phone-me-saved')
  await page.goto('/p/east-london')
  await expect(page.getByTestId('home-saved')).toBeVisible()
  await shot(page, 'phone-home-saved')

  const safari = await browser.newContext({
    viewport: PHONE,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  })
  const phone = await safari.newPage()
  await signIn(phone, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(phone.getByTestId('continue')).toBeVisible()
  const strip = phone.getByTestId('install-card')
  await expect(strip).toBeVisible()
  await expect(strip).toHaveAttribute('data-variant', 'strip')
  await expect(strip.locator('h2')).toContainText('phone')
  await phone.getByTestId('continue').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await phone.waitForTimeout(200)
  await shot(phone, 'phone-home-install')
  await safari.close()

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const computer = await desktop.newPage()
  await signIn(computer, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  const computerStrip = computer.getByTestId('install-card')
  await expect(computerStrip).toBeVisible()
  await expect(computerStrip.locator('h2')).toContainText('computer')
  await expect(computerStrip.locator('h2')).not.toContainText('phone')
  await computer.getByTestId('continue').evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await shot(computer, 'computer-home-install')
  await desktop.close()
})

test('admin and teacher open help tips', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/teach')
  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await page.waitForTimeout(800)
  await page.locator('[data-testid="desk-help"][data-help="give-course"]').first().click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/gather/attendance')
  await page.locator('[data-testid="desk-help"][data-help="desk-attendance"]').click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/nights')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(800)

  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/teach')
  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await page.waitForTimeout(800)
  await page.locator('[data-testid="desk-help"][data-help="give-course"]').first().click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/plans')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/nights')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(1200)
})
