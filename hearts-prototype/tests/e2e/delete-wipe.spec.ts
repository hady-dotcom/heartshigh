import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const sfx = Date.now().toString().slice(-6)
const shots = process.env.HEARTS_ERASE_PROOF || '/opt/cursor/artifacts/delete-and-wipe'
mkdirSync(shots, { recursive: true })
test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } })

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function shot(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: false })
}

async function assertDeskFits(page: Page) {
  await expect(page.locator('.desk')).toHaveCSS('overflow-x', 'hidden')
  const size = await page.locator('.desk').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
  expect(size.scroll, 'desk must not grow wider than the viewport').toBeLessThanOrEqual(size.client + 1)
}

async function assertCentredDialog(page: Page, testId: string) {
  const panel = page.getByTestId(`${testId}-panel`)
  await expect(panel).toBeVisible()
  await expect(panel).toHaveAttribute('role', 'dialog')
  const box = await panel.boundingBox()
  const viewport = page.viewportSize()
  expect(box, 'dialog should have a box').toBeTruthy()
  expect(viewport).toBeTruthy()
  if (box && viewport) {
    const mid = box.x + box.width / 2
    expect(mid).toBeGreaterThan(viewport.width * 0.3)
    expect(mid).toBeLessThan(viewport.width * 0.7)
    expect(box.y).toBeGreaterThan(20)
  }
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function masterApi() {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  return ctx
}

async function adminApi() {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email: 'elm-admin@hearts.test', password: 'portal-admin' } })).ok()).toBeTruthy()
  return ctx
}

async function postOk(api: APIRequestContext, url: string, data: Record<string, unknown>, label: string) {
  const response = await api.post(url, { data })
  expect(response.ok(), `${label}: ${await response.text()}`).toBeTruthy()
}

async function seedWork(
  master: APIRequestContext,
  opts: { userId: number; portalId: number; email: string; password: string },
) {
  const lesson = (await (await master.get('/api/lessons?limit=1&depth=1&where[master][equals]=true')).json()).docs[0] as {
    id: number
    course?: { id?: number } | number
  }
  expect(lesson?.id, 'need a library talk to hang work on').toBeTruthy()
  const courseId = typeof lesson.course === 'object' ? Number(lesson.course?.id) : Number(lesson.course)
  expect(courseId, 'need the talk’s course').toBeTruthy()
  let point = (await (await master.get(`/api/engagement-points?where[lesson][equals]=${lesson.id}&limit=1&depth=0`)).json()).docs[0] as { id: number } | undefined
  if (!point?.id) {
    const made = await master.post('/api/engagement-points', {
      data: { lesson: lesson.id, second: 12, prompt: 'What stayed with you?', kind: 'reflection', status: 'published' },
    })
    expect(made.ok(), await made.text()).toBeTruthy()
    point = (await made.json()).doc
  }
  await master.post('/api/adoptions', { data: { kind: 'course', course: courseId, portal: opts.portalId } })
  const granted = await master.patch(`/api/users/${opts.userId}`, { data: { courseList: [courseId] } })
  expect(granted.ok(), await granted.text()).toBeTruthy()

  const learner = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await learner.post('/api/users/login', { data: { email: opts.email, password: opts.password } })).ok()).toBeTruthy()
  const answered = await learner.post('/api/answers', {
    multipart: {
      pointId: String(point!.id),
      body: 'A seeded answer',
      image: { name: `wipe-${opts.userId}.png`, mimeType: 'image/png', buffer: PNG },
    },
  })
  expect(answered.ok(), await answered.text()).toBeTruthy()
  await learner.dispose()

  await postOk(master, '/api/rituals', { user: opts.userId, portal: opts.portalId, note: 'A garden note' }, 'garden')
  await postOk(master, '/api/completions', { user: opts.userId, portal: opts.portalId, lesson: lesson.id, percent: 100 }, 'completions')
  await postOk(master, '/api/watch-sessions', { user: opts.userId, portal: opts.portalId, lesson: lesson.id, seconds: 40 }, 'watches')
}

test.describe('desk delete flows', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('master desk deletes a portal after a summary and typed name', async ({ page }) => {
    const master = await masterApi()
    const name = `Wipe Gate ${sfx}`
    const slug = `wipe-gate-${sfx}`
    const made = await master.post('/api/portals', { data: { name, slug, kind: 'mosque' } })
    expect(made.ok(), await made.text()).toBeTruthy()
    const portal = (await made.json()).doc
    const learner = await master.post('/api/users', {
      data: {
        email: `gate-learner-${sfx}@example.com`,
        password: 'a-long-password-here',
        name: `Gate Learner ${sfx}`,
        role: 'learner',
        tenants: [{ tenant: portal.id }],
      },
    })
    expect(learner.ok(), await learner.text()).toBeTruthy()
    const learnerDoc = (await learner.json()).doc
    await seedWork(master, {
      userId: learnerDoc.id,
      portalId: portal.id,
      email: `gate-learner-${sfx}@example.com`,
      password: 'a-long-password-here',
    })
    await master.dispose()

    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    await expect(page.getByTestId('master')).toBeVisible()
    await assertDeskFits(page)
    const open = page.getByTestId(`delete-portal-${slug}-open`)
    await open.scrollIntoViewIfNeeded()
    await open.click()
    const panel = page.getByTestId(`delete-portal-${slug}-panel`)
    await assertCentredDialog(page, `delete-portal-${slug}`)
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await open.click()
    await expect(page.getByTestId(`delete-portal-${slug}-summary`)).toBeVisible()
    await expect(page.getByTestId(`delete-portal-${slug}-counts`)).toContainText(/[1-9].*learner/i)
    await expect(page.getByTestId(`delete-portal-${slug}-counts`)).toContainText(/[1-9].*answer/i)
    await expect(page.getByTestId(`delete-portal-${slug}-counts`)).toContainText(/[1-9].*(workbook|garden|file|watch)/i)
    await expect(page.getByTestId(`delete-portal-${slug}-export`)).toBeVisible()
    await shot(page, 'master-delete-summary')
    await page.getByTestId(`delete-portal-${slug}-confirm`).fill(name)
    await page.getByTestId(`delete-portal-${slug}-submit`).click()
    await expect(page.getByText('The portal and everything in it has been wiped.')).toBeVisible()
    await shot(page, 'master-delete-done')
    await expect(page.getByTestId(`delete-portal-${slug}-open`)).toHaveCount(0)

    const check = await playwrightRequest.newContext({ baseURL: E2E_BASE })
    expect((await check.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
    const found = await (await check.get(`/api/portals?where[slug][equals]=${slug}&depth=0`)).json()
    expect(found.docs).toHaveLength(0)
    await check.dispose()
  })

  test('portal admin deletes a learner and that session cannot sign in', async ({ browser }) => {
    const master = await masterApi()
    const portal = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0]
    const email = `wipe-learner-${sfx}@example.com`
    const name = `Wipe Learner ${sfx}`
    const made = await master.post('/api/users', {
      data: { email, password: 'a-long-password-here', name, role: 'learner', tenants: [{ tenant: portal.id }] },
    })
    expect(made.ok(), await made.text()).toBeTruthy()
    const learner = (await made.json()).doc
    await seedWork(master, { userId: learner.id, portalId: portal.id, email, password: 'a-long-password-here' })
    await master.dispose()

    const learnerPage = await browser.newPage()
    await signIn(learnerPage, email, 'a-long-password-here', '/p/east-london/me')
    await expect(learnerPage.getByTestId('me-name')).toContainText(name)

    const adminPage = await browser.newPage()
    await adminPage.setViewportSize({ width: 1440, height: 900 })
    await signIn(adminPage, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach?hideTest=0')
    await assertDeskFits(adminPage)
    const open = adminPage.getByTestId(`delete-person-${learner.id}-open`)
    await open.scrollIntoViewIfNeeded()
    await open.click()
    const panel = adminPage.getByTestId(`delete-person-${learner.id}-panel`)
    await assertCentredDialog(adminPage, `delete-person-${learner.id}`)
    await expect(adminPage.getByTestId(`delete-person-${learner.id}-one-home`)).toBeVisible()
    await expect(adminPage.getByTestId(`delete-person-${learner.id}-counts`)).toContainText(/[1-9].*answer/i)
    await expect(adminPage.getByTestId(`delete-person-${learner.id}-counts`)).toContainText(/[1-9].*(workbook|garden|file|watch)/i)
    await adminPage.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await open.click()
    await expect(adminPage.getByTestId(`delete-person-${learner.id}-confirm`)).toBeVisible()
    await shot(adminPage, 'admin-delete-summary')
    await adminPage.getByTestId(`delete-person-${learner.id}-confirm`).fill(name)
    await adminPage.getByTestId(`delete-person-${learner.id}-submit`).click()
    await expect(adminPage.getByText('That person and their data have been wiped.')).toBeVisible()
    await shot(adminPage, 'admin-delete-done')

    await learnerPage.reload()
    await expect(learnerPage).not.toHaveURL(/\/p\/east-london\/me/)
    await learnerPage.goto('/login?next=/p/east-london/me')
    await learnerPage.getByTestId('login-email').fill(email)
    await learnerPage.getByTestId('login-password').fill('a-long-password-here')
    await learnerPage.getByTestId('login-submit').click()
    await expect(learnerPage.getByText(/did not match|no longer here/i)).toBeVisible()
    await shot(learnerPage, 'admin-delete-session-dead')
    await learnerPage.close()
    await adminPage.close()
  })
})

test('seeded east london and maryam show real wipe counts in a centred dialog', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const master = await masterApi()
  const portal = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0]
  const maryam = (await (await master.get('/api/users?where[email][equals]=elm-learner@hearts.test&depth=0')).json()).docs[0]
  await seedWork(master, { userId: maryam.id, portalId: portal.id, email: 'elm-learner@hearts.test', password: 'portal-learner' })
  await master.dispose()

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  await expect(page.getByTestId('master')).toBeVisible()
  await assertDeskFits(page)
  const portalOpen = page.getByTestId('delete-portal-east-london-open')
  await portalOpen.scrollIntoViewIfNeeded()
  await portalOpen.click()
  await assertCentredDialog(page, 'delete-portal-east-london')
  await expect(page.getByTestId('delete-portal-east-london-counts')).toContainText(/[1-9].*learner/i)
  await expect(page.getByTestId('delete-portal-east-london-counts')).toContainText(/[1-9].*answer/i)
  await expect(page.getByTestId('delete-portal-east-london-counts')).toContainText(/[1-9].*(workbook|garden|file|watch)/i)
  await shot(page, 'master-seeded-portal-summary')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('delete-portal-east-london-panel')).toHaveCount(0)

  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach?hideTest=0')
  await assertDeskFits(page)
  await expect(page.getByText('Aisha Patel')).toBeVisible()
  const open = page.getByTestId(`delete-person-${maryam.id}-open`)
  await open.scrollIntoViewIfNeeded()
  await open.click()
  await assertCentredDialog(page, `delete-person-${maryam.id}`)
  await expect(page.getByTestId(`delete-person-${maryam.id}-counts`)).toContainText(/[1-9].*answer/i)
  await expect(page.getByTestId(`delete-person-${maryam.id}-counts`)).toContainText(/[1-9].*workbook/i)
  await expect(page.getByTestId(`delete-person-${maryam.id}-counts`)).toContainText(/[1-9].*garden/i)
  await expect(page.getByTestId(`delete-person-${maryam.id}-counts`)).toContainText(/[1-9].*file/i)
  await expect(page.getByTestId(`delete-person-${maryam.id}-counts`)).toContainText(/[1-9].*watch/i)
  await shot(page, 'admin-seeded-learner-summary')
  await page.keyboard.press('Escape')
})

test('a learner can delete their own account from Me', async ({ page }) => {
  const master = await masterApi()
  const portal = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0]
  const email = `self-wipe-${sfx}@example.com`
  const name = `Self Wipe ${sfx}`
  const made = await master.post('/api/users', {
    data: { email, password: 'a-long-password-here', name, role: 'learner', tenants: [{ tenant: portal.id }] },
  })
  expect(made.ok(), await made.text()).toBeTruthy()
  await seedWork(master, {
    userId: (await made.json()).doc.id,
    portalId: portal.id,
    email,
    password: 'a-long-password-here',
  })
  await master.dispose()

  await signIn(page, email, 'a-long-password-here', '/p/east-london/me/settings')
  await expect(page.getByTestId('settings')).toBeVisible()
  await page.getByTestId('delete-account-open').click()
  await expect(page.getByTestId('delete-account-panel')).toBeVisible()
  await expect(page.getByTestId('delete-account-confirm')).toBeVisible()
  await expect(page.getByTestId('delete-account-counts')).toContainText(/[1-9].*answer/i)
  await page.getByTestId('delete-account').scrollIntoViewIfNeeded()
  await shot(page, 'learner-self-delete-confirm')
  await page.getByTestId('delete-account-confirm').fill(name)
  await page.getByTestId('delete-account-submit').click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Your account and its data have been wiped.')).toBeVisible()
  await shot(page, 'learner-self-delete-done')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill('a-long-password-here')
  await page.getByTestId('login-submit').click()
  await expect(page.getByText(/did not match|no longer here/i)).toBeVisible()
})

test('a portal admin cannot delete another portal’s user or a portal', async () => {
  const master = await masterApi()
  const admin = await adminApi()
  const extra = await master.post('/api/portals', { data: { name: `Other Gate ${sfx}`, slug: `other-gate-${sfx}`, kind: 'mosque' } })
  expect(extra.ok()).toBeTruthy()
  const otherPortal = (await extra.json()).doc
  const outsider = await master.post('/api/users', {
    data: {
      email: `other-learner-${sfx}@example.com`,
      password: 'a-long-password-here',
      name: `Other Learner ${sfx}`,
      role: 'learner',
      tenants: [{ tenant: otherPortal.id }],
    },
  })
  expect(outsider.ok()).toBeTruthy()
  const person = (await outsider.json()).doc

  const portalWipe = await admin.post('/api/hearts', {
    form: { action: 'delete-portal', portalSlug: otherPortal.slug, confirmName: otherPortal.name, next: '/master' },
    maxRedirects: 0,
  })
  expect(portalWipe.status()).toBe(303)
  const still = await (await master.get(`/api/portals/${otherPortal.id}`)).json()
  expect(still.id || still.doc?.id).toBeTruthy()

  const personWipe = await admin.post('/api/hearts', {
    form: {
      action: 'delete-person',
      portalSlug: 'east-london',
      person: String(person.id),
      mode: 'account',
      confirmName: person.name,
      next: '/p/east-london/admin/teach',
    },
    maxRedirects: 0,
  })
  expect(personWipe.status()).toBe(303)
  const live = await (await master.get(`/api/users/${person.id}`)).json()
  expect(live.id || live.doc?.id).toBeTruthy()

  const summary = await admin.get(`/api/erase?scope=user&id=${person.id}&portal=east-london`)
  expect(summary.ok()).toBeFalsy()

  await Promise.all([master.dispose(), admin.dispose()])
})
