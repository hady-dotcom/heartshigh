import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/screenshots'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 })
}

test.describe.configure({ timeout: 180_000 })

async function showCast(page: Page) {
  await expect(page.getByTestId('demo-cast-master')).toBeVisible()
  await expect(page.getByTestId('demo-cast-admin')).toBeVisible()
  await expect(page.getByTestId('demo-cast-teacher')).toBeVisible()
  await expect(page.getByTestId('demo-cast-learner')).toBeVisible()
  await expect(page.getByTestId('demo-cast-master')).toHaveValue('Leon (HEARTS)')
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your mosque?')
  await page.getByTestId('demo-cast-kind-school').click()
  await expect(page.getByTestId('demo-cast-portal-prompt')).toHaveText('Who would look after your school?')
  await page.getByTestId('demo-cast-kind-mosque').click()
  await expect(page.getByTestId('demo-cast-admin')).toHaveValue('Rafiq')
  await expect(page.getByTestId('demo-cast-portal')).toHaveValue('Al-Noor Mosque')
  await expect(page.getByTestId('demo-cast-teacher')).toHaveValue('Sami')
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Abdallah')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Show all four')
  await page.getByTestId('demo-cast-show').click()
}

async function frameWidth(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((el: HTMLIFrameElement) => el.contentWindow?.innerWidth || 0)
}

async function expectDesks(page: Page) {
  const master = page.frameLocator('[data-testid="demo-master-frame"]')
  const portal = page.frameLocator('[data-testid="demo-portal-frame"]')
  const teacher = page.frameLocator('[data-testid="demo-teacher-frame"]')
  const learner = page.frameLocator('[data-testid="demo-learner-frame"]')
  await expect(master.getByTestId('master')).toBeVisible({ timeout: 90_000 })
  await expect(portal.getByTestId('admin-overview')).toBeVisible({ timeout: 90_000 })
  await expect(teacher.getByTestId('admin-teach')).toBeVisible({ timeout: 90_000 })
  await expect(learner.getByTestId('journey')).toBeVisible({ timeout: 90_000 })
  await expect(learner.getByTestId('journey')).toHaveAttribute('data-framing', 'F')
  await expect(learner.getByTestId('tab-garden')).toBeVisible({ timeout: 60_000 })
  await expect(learner.getByTestId('tab-lanes')).toBeVisible()
  await expect(learner.getByTestId('tab-me')).toBeVisible()
  for (const slot of ['master', 'portal', 'teacher']) {
    await expect(page.frameLocator(`[data-testid="demo-${slot}-frame"]`).getByTestId('desk-narrow')).toBeHidden()
    await expect(page.getByTestId(`demo-${slot}-frame`)).toHaveAttribute('width', '1280')
    await expect(page.getByTestId(`demo-${slot}-frame`)).toHaveAttribute('src', /\?stage=1/)
    expect(await frameWidth(page, `demo-${slot}-frame`)).toBe(1280)
    const box = await page.getByTestId(`demo-${slot}-frame`).boundingBox()
    expect(box?.width || 0).toBeGreaterThan(80)
    expect(box?.width || 0).toBeLessThan(1100)
  }
  const phone = page.getByTestId('demo-learner-frame')
  await expect(phone).toHaveAttribute('width', '390')
  await expect(phone).toHaveAttribute('height', '844')
  await expect(phone).toHaveAttribute('src', /\/feed\?stage=1/)
  expect(await frameWidth(page, 'demo-learner-frame')).toBe(390)
  const phoneBox = await page.getByTestId('demo-phone').boundingBox()
  expect(phoneBox?.width || 0).toBeGreaterThan(180)
  expect(phoneBox?.width || 0).toBeLessThan(420)
}

async function loopAndFocus(page: Page) {
  await expect(page.getByTestId('demo-phone-toast').first()).toContainText('Circle meets after Maghrib tonight.')
  await page.getByTestId('demo-loop-note').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-actor', 'portal')
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'portal learner')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(2)
  await expect(page.locator('.demo-cell.is-live')).toHaveCount(2)
  await expect.poll(() => page.getByTestId('demo-panel-teacher').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeLessThan(0.5)
  await expect.poll(() => page.getByTestId('demo-panel-portal').evaluate((el) => Number(getComputedStyle(el.parentElement as HTMLElement).opacity))).toBeGreaterThan(0.95)
  await expect(page.locator('.demo-cell.is-dim').first()).toHaveCSS('pointer-events', 'auto')
  await expect(page.getByTestId('demo-phone-toast').first()).toContainText('Bring a notebook to the circle tonight.')
  await expect(page.getByTestId('demo-ticker')).toContainText('posted an announcement')
  const teacherTint = await page.getByTestId('demo-panel-teacher').locator('.demo-strip').evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(teacherTint).toBe('rgb(196, 143, 44)')
  const teacher = await page.getByTestId('demo-panel-teacher').boundingBox()
  expect(teacher).toBeTruthy()
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y)
    return el?.closest('[data-testid="demo-panel-teacher"]') ? 'teacher' : ''
  }, { x: (teacher?.x || 0) + (teacher?.width || 0) / 2, y: (teacher?.y || 0) + 80 })
  expect(hit).toBe('teacher')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'off')
  await page.getByTestId('demo-loop-note').click()
  await page.locator('.demo-title').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'off')
  await page.getByTestId('demo-loop-course').click()
  await expect(page.getByTestId('demo-alerts-portal')).toContainText('Night walk')
  await expect(page.getByTestId('demo-phone-toast').first()).toContainText('Night walk')
  await page.getByTestId('demo-focus').click()
  await expect(page.getByTestId('demo-board')).toHaveAttribute('data-focus', 'off')
  await expect(page.locator('.demo-cell.is-dim')).toHaveCount(0)
  await page.getByTestId('demo-focus').click()
  await expect(page.getByTestId('demo-focus')).toHaveAttribute('aria-pressed', 'true')
}

test('the real desks on a 1920 screen and a 1280 screen', async ({ page }) => {
  test.setTimeout(300_000)
  mkdirSync(dir, { recursive: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toBeVisible()
  await expect(page.getByTestId('demo-cast')).toBeVisible()
  await showCast(page)
  for (const slot of ['master', 'portal', 'teacher', 'learner']) {
    await expect(page.getByTestId(`demo-panel-${slot}`)).toBeVisible()
  }
  await expect(page.getByText('Leon (HEARTS), running the whole system')).toBeVisible()
  await expect(page.getByText('Rafiq, looking after Al-Noor Mosque')).toBeVisible()
  await expect(page.getByText('Sami, guiding the learners')).toBeVisible()
  await expect(page.getByText('Abdallah, a learner at Al-Noor Mosque')).toBeVisible()
  await expectDesks(page)
  await loopAndFocus(page)
  await page.screenshot({ path: `${dir}/demo-desks-1920x1080.png`, fullPage: false })

  await page.getByTestId('demo-name-learner').click()
  await page.getByTestId('demo-name-learner-input').fill('Layla')
  await page.getByTestId('demo-name-learner-input').press('Enter')
  await expect(page.getByText('Layla, a learner at Al-Noor Mosque')).toBeVisible()

  await page.getByTestId('demo-edit-cast').click()
  await expect(page.getByTestId('demo-cast-learner')).toHaveValue('Layla')
  await expect(page.getByTestId('demo-cast-show')).toHaveText('Done')
  await page.getByTestId('demo-cast-pick').filter({ hasText: /^Maryam$/ }).click()
  await page.getByTestId('demo-cast-show').click()
  await expect(page.getByText('Maryam, a learner at Al-Noor Mosque')).toBeVisible()

  await page.getByTestId('demo-play').click()
  await expect(page.getByTestId('demo-step-say')).toHaveAttribute('data-status', 'done', { timeout: 30_000 })
  await expect(page.getByTestId('demo-ticker')).toContainText('Night walk')
  await expect(page.getByTestId('demo-phone-toast').first()).toContainText('Ten quiet minutes is enough')
  await expect(page.getByTestId('demo-alerts-master')).toContainText('wrote back')
  await page.screenshot({ path: `${dir}/demo-desks-play-1920x1080.png`, fullPage: false })

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.getByTestId('demo-reset').click()
  await page.getByTestId('demo-layout-row').click()
  await expect(page.getByText('Maryam, a learner at Al-Noor Mosque')).toBeVisible()
  const narrow = await page.getByTestId('demo-phone').boundingBox()
  expect(narrow?.width || 0).toBeGreaterThan(180)
  await expect(page.getByTestId('demo-master-frame')).toHaveAttribute('width', '1280')
  expect(await frameWidth(page, 'demo-teacher-frame')).toBe(1280)
  await expect(page.frameLocator('[data-testid="demo-portal-frame"]').getByTestId('desk-narrow')).toBeHidden()
  await loopAndFocus(page)
  await page.screenshot({ path: `${dir}/demo-desks-1280x800.png`, fullPage: false })

  const origin = new URL(page.url()).origin
  const blocked = await page.request.post('/api/hearts', {
    headers: { referer: `${origin}/master?stage=1` },
    form: { action: 'logout' },
  })
  expect(blocked.status()).toBe(403)
  const looked = await page.request.get('/master/library', {
    headers: { referer: `${origin}/master?stage=1`, 'sec-fetch-dest': 'document' },
    maxRedirects: 0,
  })
  expect(looked.status()).toBeGreaterThanOrEqual(300)
  expect(looked.status()).toBeLessThan(400)
  expect(looked.headers().location || '').toContain('stage=1')
  const quiet = await page.request.get('/master/library?_rsc=1', {
    headers: { referer: `${origin}/master?stage=1`, 'sec-fetch-dest': 'empty' },
    maxRedirects: 0,
  })
  expect(quiet.headers().location || '').not.toContain('stage=1')
})

test('a learner cannot open the demo stage', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/demo-stage')
  await expect(page.getByTestId('demo-stage')).toHaveCount(0)
  await expect(page).not.toHaveURL(/\/demo-stage$/)
})
