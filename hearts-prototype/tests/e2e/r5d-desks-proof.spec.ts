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
  const elm = ((await (await page.request.get('/api/portals?where[slug][equals]=east-london&limit=1')).json()) as { docs?: { id: number }[] }).docs?.[0]
  if (elm?.id) {
    await page.request.post('/api/users', {
      data: {
        email: 'ux-audit-desk@hearts.foundation',
        password: 'audit-pass-12',
        name: 'UX Audit Desk',
        role: 'learner',
        tenants: [{ tenant: elm.id }],
      },
    }).catch(() => null)
  }

  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await expect(page.locator('[data-testid="desk-help"][data-help="admin-teach"] .desk-help-pop, [data-testid="desk-help"][data-help="admin-teach"] [role="note"]')).toBeVisible()
  await shot(page, 'help-teach-page')

  const giveHelp = page.locator('[data-testid="desk-help"][data-help="give-course"]').first()
  await giveHelp.click()
  await expect(giveHelp.locator('[role="note"]')).toBeVisible()
  await shot(page, 'help-give')

  await page.goto('/p/east-london/admin/gather/attendance')
  await expect(page.getByTestId('desk-attendance')).toBeVisible()
  await page.locator('[data-testid="desk-help"][data-help="desk-attendance"]').click()
  await expect(page.locator('[data-testid="desk-help"][data-help="desk-attendance"] [role="note"]')).toBeVisible()
  await shot(page, 'help-gather-attendance')

  await page.goto('/p/east-london/admin/content')
  await expect(page.getByTestId('admin-content')).toBeVisible()
  await expect(page.locator('[data-testid="content-door"][data-door^="W"]')).toHaveCount(20)
  await expect(page.getByTestId('course-row').first()).toBeVisible()
  await expect(page.getByTestId('content-empty-doors')).toBeVisible()
  await expect(page.getByTestId('content-empty-doors')).not.toHaveAttribute('open')
  await shot(page, 'content-grouped-doors', true)

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
  await shot(page, 'teach-hide-test-on')
  await page.goto('/p/east-london/admin/teach?hideTest=0')
  await expect(page.getByTestId('hide-test-toggle')).toBeVisible()
  await expect(page.getByTestId('hide-test-toggle')).not.toBeChecked()
  await shot(page, 'teach-hide-test-off')

  await page.setViewportSize(LAPTOP)
  await page.goto('/p/east-london/admin')
  await expect(page.getByTestId('side-nav')).toBeVisible()
  await page.locator('[data-testid="side-nav"]').evaluate((el) => {
    el.scrollTop = 80
  })
  await shot(page, 'sidebar-scroll-1366x700')

  await page.setViewportSize(PHONE)
  for (const [name, path, testId] of [
    ['phone-teach', '/p/east-london/admin/teach', 'desk-narrow'],
    ['phone-feedback', '/p/east-london/admin/feedback', 'desk-narrow'],
    ['phone-plans', '/p/east-london/admin/plans', 'desk-narrow'],
    ['phone-nights', '/p/east-london/admin/nights', 'desk-narrow'],
    ['phone-settings', '/p/east-london/admin/settings', 'desk-narrow'],
    ['phone-access', '/p/east-london/admin/access', 'desk-narrow'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByTestId(testId)).toBeVisible()
    await shot(page, name)
  }

  await page.addInitScript(() => {
    localStorage.setItem('hearts.saved.v1', JSON.stringify(['cut-12', 'cut-9', 'cut-41']))
  })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/me')
  await expect(page.getByTestId('saved-list')).toBeVisible()
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
  await shot(phone, 'phone-home-install')
  await safari.close()
})

test('teacher opens a few help tips', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(900)
  await page.goto('/p/east-london/admin/teach')
  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await page.waitForTimeout(900)
  await page.locator('[data-testid="desk-help"][data-help="give-course"]').first().click()
  await page.waitForTimeout(900)
  await page.goto('/p/east-london/admin/plans')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(900)
  await page.goto('/p/east-london/admin/nights')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await page.waitForTimeout(1200)
})
