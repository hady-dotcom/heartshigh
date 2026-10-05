import { expect, test, request as playwrightRequest, type Locator, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { E2E_BASE } from '../env'
import { buildWorkbook } from '../../src/lib/master-sheet'

const dir = process.env.PROOF_DIR || '/tmp/r5d-desks-proof'
const DESK = { width: 1440, height: 900 }
const LAPTOP = { width: 1366, height: 700 }
const WIDE = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }

const PORTAL_DESK_PATHS = [
  '/p/east-london/admin',
  '/p/east-london/admin/teach',
  '/p/east-london/admin/feedback',
  '/p/east-london/admin/compass',
  '/p/east-london/admin/plans',
  '/p/east-london/admin/nights',
  '/p/east-london/admin/gather',
  '/p/east-london/admin/gather/attendance',
  '/p/east-london/admin/content',
  '/p/east-london/admin/sheet',
  '/p/east-london/admin/sheet/create',
  '/p/east-london/admin/library',
  '/p/east-london/admin/access',
  '/p/east-london/admin/opening',
  '/p/east-london/admin/circle',
  '/p/east-london/admin/ai',
  '/p/east-london/admin/settings',
]

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

async function assertPopFits(page: Page, pop: Locator, label: string) {
  await expect(pop, label).toBeVisible()
  await expect(pop).toHaveAttribute('data-placed', 'yes')
  const box = await pop.boundingBox()
  const view = page.viewportSize()
  expect(box && view, `${label} has a box`).toBeTruthy()
  if (!box || !view) return
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(-1)
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(view.width + 1)
  expect(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(view.height + 1)
  const clip = await pop.evaluate((el) => {
    const r = el.getBoundingClientRect()
    let at: HTMLElement | null = el.parentElement
    while (at) {
      const style = getComputedStyle(at)
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`
      if (/(hidden|auto|scroll|clip)/.test(overflow)) {
        const pr = at.getBoundingClientRect()
        const clipped = r.left < pr.left - 1 || r.right > pr.right + 1 || r.top < pr.top - 1 || r.bottom > pr.bottom + 1
        if (clipped) return { clipped: true, by: `${at.tagName}.${at.className}`.trim() }
      }
      at = at.parentElement
    }
    return { clipped: false, by: '' }
  })
  expect(clip.clipped, `${label} clipped by ${clip.by}`).toBeFalsy()
}

async function openEveryDeskHelp(page: Page, where: string) {
  const marks = page.locator('[data-testid="desk-help"]')
  const count = await marks.count()
  expect(count, `${where} has at least one ?`).toBeGreaterThan(0)
  let opened = 0
  for (let index = 0; index < count; index += 1) {
    const mark = marks.nth(index)
    if (!(await mark.isVisible())) continue
    await mark.scrollIntoViewIfNeeded()
    await page.keyboard.press('Escape')
    await mark.locator('button').click()
    const pop = page.getByTestId('desk-help-pop')
    await assertPopFits(page, pop, `${where} ? ${index + 1}/${count}`)
    opened += 1
  }
  expect(opened, `${where} opened a visible ?`).toBeGreaterThan(0)
}

test.describe.configure({ timeout: 400_000 })

test.use({ video: { mode: 'on', size: DESK } })

test('r5d desk proof shots', async ({ page, browser }) => {
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
  await expect(page.getByTestId('admin-teach')).toBeVisible()

  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'Teach page ?')
  await shot(page, 'help-teach-page')

  const giveHelp = page.locator('[data-testid="desk-help"][data-help="give-course"]').first()
  await giveHelp.click()
  const givePop = page.getByTestId('desk-help-pop')
  await assertPopFits(page, givePop, 'Give help')
  expect((await givePop.evaluate((el) => getComputedStyle(el).whiteSpace))).toBe('normal')
  expect((await givePop.evaluate((el) => getComputedStyle(el).textTransform))).toBe('none')
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
    let at: Element | null = el
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
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'Gather attendance ?')
  await shot(page, 'help-gather-attendance')

  await page.goto('/p/east-london/admin/nights')
  await expect(page.getByTestId('admin-nights')).toBeVisible()
  const ticketTips = page.locator('[data-testid="desk-help"][data-help="ticket"]')
  if (await ticketTips.count()) {
    await expect(ticketTips).toHaveCount(1)
    await ticketTips.click()
    await assertPopFits(page, page.getByTestId('desk-help-pop'), 'Nights Kind ?')
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

  await page.goto('/p/east-london/admin/plans')
  await expect(page.getByTestId('admin-plans')).toBeVisible()
  const planTitles = await page.getByTestId('schedule-course').locator('option').allTextContents()
  expect(planTitles.length, 'Study plans has courses').toBeGreaterThan(0)
  for (const title of planTitles) {
    expect(title, title).not.toMatch(/\|/)
    expect(title, title).not.toMatch(/Khutbah by/i)
  }
  await shot(page, 'plans-course-picker')

  await page.goto('/p/east-london/admin/compass')
  await expect(page.getByTestId('compass-portal')).toBeVisible()
  await expect(page.getByTestId('compass-portal')).toHaveCSS('background-color', 'rgb(14, 42, 43)')
  await page.getByTestId('compass-learner').first().click()
  const learnerDesk = page.locator('.desk[data-testid="compass-learner"]')
  await expect(learnerDesk).toBeVisible()
  await expect(learnerDesk).toHaveCSS('background-color', 'rgb(14, 42, 43)')
  await expect(learnerDesk).not.toHaveCSS('background-color', 'rgb(228, 207, 160)')
  await shot(page, 'compass-learner-desk')

  const masterDesk = await browser.newContext({ viewport: DESK })
  const masterPage = await masterDesk.newPage()
  await signIn(masterPage, 'master@hearts.test', 'hearts-master', '/master/sheet')
  await expect(masterPage.getByTestId('master-sheet')).toBeVisible()
  const bad = `/tmp/hearts-sheet-error-${Date.now()}.xlsx`
  writeFileSync(bad, Buffer.from(await buildWorkbook({
    talks: [{ talk_key: 'yt-NIR88RRpat4', hook_text: 'Take the quiz on this line now' }],
    questions: [{ talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 99999, text: 'This time is far past the end of the film', source: 'human', status: 'draft' }],
  })))
  await masterPage.getByTestId('sheet-file').setInputFiles(bad)
  await masterPage.getByTestId('sheet-preview-submit').click()
  await expect(masterPage.getByTestId('sheet-error-row').first()).toBeVisible()
  const errorLook = await masterPage.getByTestId('sheet-error-row').first().evaluate((el) => {
    const cell = el.querySelector('td') || el
    const style = getComputedStyle(el)
    const cellStyle = getComputedStyle(cell)
    const rgb = (value: string) => value.replace(/\s/g, '')
    return {
      bg: rgb(style.backgroundColor === 'rgba(0, 0, 0, 0)' ? cellStyle.backgroundColor : style.backgroundColor),
      color: rgb(cellStyle.color),
      shadow: cellStyle.boxShadow,
    }
  })
  expect(errorLook.bg).toBe('rgb(16,46,44)')
  expect(errorLook.color).toBe('rgb(246,238,220)')
  expect(errorLook.shadow).toMatch(/196,\s*92,\s*92/)
  await masterPage.getByTestId('sheet-error-row').first().scrollIntoViewIfNeeded()
  await shot(masterPage, 'sheet-import-error')
  await masterDesk.close()

  await page.setViewportSize(LAPTOP)
  await page.goto('/p/east-london/admin')
  await expect(page.getByTestId('side-nav')).toBeVisible()
  const brandName = page.getByTestId('side-brand-name')
  await expect(brandName).toBeVisible()
  await expect(brandName).toContainText('East London Mosque')
  const brandLook = await brandName.evaluate((el) => ({
    lines: el.getClientRects().length,
    clamp: getComputedStyle(el).webkitLineClamp,
    wrap: getComputedStyle(el).whiteSpace,
    text: el.textContent || '',
  }))
  expect(brandLook.wrap).toBe('normal')
  expect(Number(brandLook.clamp)).toBe(2)
  expect(brandLook.lines, 'portal name can use two lines').toBeLessThanOrEqual(2)
  expect(brandLook.text).not.toMatch(/Mosq…/)
  const address = page.getByTestId('portal-address')
  await expect(address).toBeVisible()
  await expect(address).toHaveText(/127\.0\.0\.1/)
  const wrap = await address.evaluate((el) => ({
    lines: el.getClientRects().length,
    break: getComputedStyle(el).wordBreak,
    overflow: getComputedStyle(el).textOverflow,
    text: (el.textContent || '').trim(),
    clientWidth: el.clientWidth,
  }))
  expect(wrap.lines, 'the portal address stays on one line').toBe(1)
  expect(wrap.break).not.toBe('break-all')
  expect(wrap.overflow).toBe('ellipsis')
  expect(wrap.text, 'address keeps the host').toMatch(/^127\.0\.0\.1/)
  expect(wrap.text).not.toMatch(/^127\.\…/)
  expect(wrap.clientWidth, 'address box is wide enough for the host').toBeGreaterThan(140)
  const linked = page.getByTestId('linked-courses')
  await expect(linked).toBeVisible()
  await linked.scrollIntoViewIfNeeded()
  const linkedBg = await linked.evaluate((el) => getComputedStyle(el.closest('.count-tile') || el).backgroundColor)
  expect(linkedBg, 'Linked from the library is not a cream bar').not.toBe('rgb(251, 239, 210)')
  await shot(page, 'overview-linked-library')
  const cue = page.getByTestId('nav-scroll-cue')
  await expect(cue).toBeVisible()
  const navBox = await page.getByTestId('side-nav').boundingBox()
  const cueBox = await cue.boundingBox()
  expect(navBox && cueBox, 'More below sits under the scrolling nav').toBeTruthy()
  if (navBox && cueBox) {
    expect(cueBox.y, 'More below does not overlap the nav').toBeGreaterThanOrEqual(navBox.y + navBox.height - 1)
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
  const savedTitles = await page.getByTestId('saved-item').allTextContents()
  expect(savedTitles.filter((title) => /How to Live Like the Prophet, Session 6/.test(title)), 'one Session 6 row').toHaveLength(1)
  expect(savedTitles.join('\n')).not.toMatch(/Khutbah/i)
  expect(savedTitles.join('\n')).not.toMatch(/\|/)
  await shot(page, 'phone-me-saved')
  await page.goto('/p/east-london')
  await expect(page.getByTestId('home-saved')).toBeVisible()
  await expect(page.getByTestId('home-saved')).toContainText(/Saved \(2\)/)
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
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin overview')
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/teach')
  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin teach')
  await page.waitForTimeout(800)
  await page.locator('[data-testid="desk-help"][data-help="give-course"]').first().click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin give')
  await page.waitForTimeout(1100)
  await page.goto('/p/east-london/admin/gather/attendance')
  await page.locator('[data-testid="desk-help"][data-help="desk-attendance"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin attendance')
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/nights')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin nights')
  const nightsKind = page.locator('[data-testid="desk-help"][data-help="ticket"]')
  if (await nightsKind.count()) {
    await nightsKind.click()
    await assertPopFits(page, page.getByTestId('desk-help-pop'), 'admin nights kind')
    await page.waitForTimeout(1100)
  }

  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin')
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await page.locator('h1 [data-testid="desk-help"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'teacher overview')
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/teach')
  await page.locator('[data-testid="desk-help"][data-help="admin-teach"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'teacher teach')
  await page.waitForTimeout(800)
  await page.locator('[data-testid="desk-help"][data-help="give-course"]').first().click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'teacher give')
  await page.waitForTimeout(1100)
  await page.goto('/p/east-london/admin/plans')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'teacher plans')
  await page.waitForTimeout(800)
  await page.goto('/p/east-london/admin/nights')
  await page.locator('h1 [data-testid="desk-help"]').click()
  await assertPopFits(page, page.getByTestId('desk-help-pop'), 'teacher nights')
  await page.waitForTimeout(1200)
})

test('every desk help card fits at 1366x700 and 1280x800', async ({ page }) => {
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
  for (const view of [LAPTOP, WIDE]) {
    await page.setViewportSize(view)
    for (const path of PORTAL_DESK_PATHS) {
      await page.goto(path)
      await expect(page.locator('[data-testid="desk-help"]').first()).toBeVisible()
      await openEveryDeskHelp(page, `${path} @ ${view.width}x${view.height}`)
    }
    await page.goto('/p/east-london/admin/compass')
    await page.getByTestId('compass-learner').first().click()
    await expect(page.locator('.desk[data-testid="compass-learner"]')).toBeVisible()
    await openEveryDeskHelp(page, `compass learner @ ${view.width}x${view.height}`)
  }
})
