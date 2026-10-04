import { expect, test, request as playwrightRequest, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { E2E_BASE } from '../env'

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
  const empty = page.locator('[data-testid="attendance-chart"] p, [data-testid="brought"] p, [data-testid="follow-up"] p').first()
  await expect(empty).toBeVisible()
  const emptyLook = await empty.evaluate((el) => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) || []).map(Number)
    const lum = ([r, g, b]: number[]) => {
      const c = [r, g, b].map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    let at: HTMLElement | null = el
    let bg = [255, 255, 255]
    while (at) {
      const [r, g, b, a = 1] = rgb(getComputedStyle(at).backgroundColor)
      if (a > 0.5) { bg = [r, g, b]; break }
      at = at.parentElement
    }
    const [hi, lo] = [lum(rgb(getComputedStyle(el).color)), lum(bg)].sort((x, y) => y - x)
    return { ratio: (hi + 0.05) / (lo + 0.05), color: getComputedStyle(el).color, bg }
  })
  expect(emptyLook.ratio, `gather empty ${emptyLook.color} on ${emptyLook.bg}`).toBeGreaterThanOrEqual(4.5)
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
  await expect(page.getByTestId('content-empty-doors')).toContainText('Doors with nothing yet (17)')
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

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const elm = ((await (await master.get('/api/portals?where[slug][equals]=east-london&limit=1')).json()) as { docs?: { id: number }[] }).docs?.[0]
  const existing = ((await (await master.get('/api/users?where[email][equals]=qa-desk@hearts.foundation&limit=1')).json()) as { docs?: { id: number }[] }).docs?.[0]
  if (!existing && elm?.id) {
    const created = await master.post('/api/users', {
      data: {
        email: 'qa-desk@hearts.foundation',
        password: 'portal-learner',
        name: 'QA Desk Learner',
        role: 'learner',
        tenants: [{ tenant: elm.id }],
      },
    })
    expect(created.ok() || created.status() === 400).toBeTruthy()
  }
  await master.dispose()

  await page.goto('/p/east-london/admin/teach')
  await expect(page.getByTestId('hide-test-accounts')).toBeVisible()
  await expect(page.getByTestId('hide-test-toggle')).toBeChecked()
  await expect(page.getByRole('cell', { name: 'QA Desk Learner' })).toHaveCount(0)
  const hiddenCount = Number((await page.getByTestId('learner-count').innerText()).match(/\((\d+)\)/)?.[1] || 0)
  await shot(page, 'teach-hide-test-on')
  await page.getByTestId('hide-test-toggle').click()
  await page.waitForURL((url) => url.searchParams.get('hideTest') === '0')
  await expect(page.getByTestId('hide-test-toggle')).not.toBeChecked()
  await expect(page.getByRole('cell', { name: 'QA Desk Learner' })).toBeVisible()
  const shownCount = Number((await page.getByTestId('learner-count').innerText()).match(/\((\d+)\)/)?.[1] || 0)
  expect(shownCount, 'hide-test off shows more learners than hide-test on').toBeGreaterThan(hiddenCount)
  await shot(page, 'teach-hide-test-off')

  await page.setViewportSize(LAPTOP)
  await page.goto('/p/east-london/admin')
  await expect(page.getByTestId('side-nav')).toBeVisible()
  const address = page.getByTestId('portal-address')
  await expect(address).toBeVisible()
  const wrap = await address.evaluate((el) => ({
    lines: el.getClientRects().length,
    break: getComputedStyle(el).wordBreak,
    overflow: getComputedStyle(el).textOverflow,
  }))
  expect(wrap.lines, 'the portal address stays on one line').toBe(1)
  expect(wrap.break).not.toBe('break-all')
  expect(wrap.overflow).toBe('ellipsis')
  const cue = page.getByTestId('nav-scroll-cue')
  if (await cue.isVisible()) {
    const cueBox = await cue.boundingBox()
    const items = page.locator('[data-testid="side-nav"] a.nav')
    for (const item of await items.all()) {
      const box = await item.boundingBox()
      if (!box || !cueBox || box.height < 8) continue
      const visibleHeight = Math.min(box.y + box.height, cueBox.y) - box.y
      if (box.y < cueBox.y && box.y + box.height > cueBox.y) {
        expect(visibleHeight, 'More below does not cover a clipped nav label').toBeGreaterThan(box.height * 0.55)
      }
    }
  }
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
