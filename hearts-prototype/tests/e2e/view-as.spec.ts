import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'

// View as (psychometric-opening-build-spec 6A, browser tests 38 to 49).

const PORTAL = 'east-london'
const DESK = { width: 1440, height: 900 }
let master: APIRequestContext

test.use({ viewport: DESK })

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: 'http://127.0.0.1:3000' })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

async function userId(email: string) {
  const found = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0`)).json()
  return found.docs[0].id as number
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function startAsAdmin(page: Page, learner = 'Maryam Begum') {
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/teach`)
  const row = page.getByTestId('learner-row').filter({ hasText: learner })
  await row.getByTestId('view-as').click()
  await row.getByTestId('view-as-reason').fill('Checking what she sees in her workbook')
  await row.getByTestId('view-as-start').click()
  await page.waitForURL((url) => !url.pathname.includes('/admin'))
  await expect(page.getByTestId('viewas-banner')).toBeVisible()
  await page.waitForLoadState('networkidle')
}

async function auditEvents(event: string) {
  const found = await (await master.get(`/api/audit-log?where[event][equals]=${event}&sort=-at&limit=20&depth=0`)).json()
  return found.docs as { event: string; actor: number; target: number; reason?: string; detail?: Record<string, unknown> }[]
}

test.describe('view as', () => {
  test('38. a portal admin views as a learner with a reason, read-only by default', async ({ page }) => {
    await startAsAdmin(page)
    await expect(page.getByTestId('viewas-text')).toContainText('Viewing as Maryam Begum')
    await expect(page.getByTestId('viewas-banner')).toHaveAttribute('data-mode', 'read-only')
    await expect(page.getByTestId('viewas-mode')).toHaveText('Read-only')
  })

  test('39. a view without a reason is refused', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/teach`)
    const refused = await page.request.post('/api/view-as/start', { data: { targetUserId: await userId('elm-learner@hearts.test'), reason: '' } })
    expect(refused.status()).toBe(400)
    const row = page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' })
    await row.getByTestId('view-as').click()
    await row.getByTestId('view-as-start').click()
    await expect(row.getByRole('alert')).toContainText('Say why')
  })

  test('40. while read-only, answers and settings are refused and logged', async ({ page }) => {
    await startAsAdmin(page)
    const answer = await page.request.post('/api/answers', { data: { pointId: 1, body: 'Should not save' } })
    expect(answer.status()).toBe(403)
    const pref = await page.request.post('/api/hearts', { form: { action: 'me-pref', name: 'keepPlace', value: 'on', next: '/' }, maxRedirects: 0 })
    expect(pref.status()).not.toBe(200)
    const blocked = await auditEvents('view_as.blocked_write')
    expect(blocked.length).toBeGreaterThan(0)
  })

  test('41. the learner’s private opening answers are not shown in view-as', async ({ page }) => {
    await startAsAdmin(page)
    await page.goto(`/p/${PORTAL}/garden/workbook`)
    await expect(page.getByTestId('where-you-started')).toBeVisible()
    await expect(page.getByTestId('opening-row')).toHaveCount(3)
    await expect(page.getByTestId('private-lock')).toHaveCount(0)
    await expect(page.getByTestId('garden-workbook')).not.toContainText('Lives and looks better')
  })

  test('42. the viewer’s own device state is left alone, and the view’s keys are wiped on exit', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/teach`)
    await page.evaluate(() => window.localStorage.setItem('hearts.heart.v1', JSON.stringify({ v: 1, mine: true })))
    const row = page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' })
    await row.getByTestId('view-as').click()
    await row.getByTestId('view-as-reason').fill('Device check')
    await row.getByTestId('view-as-start').click()
    await expect(page.getByTestId('viewas-banner')).toBeVisible()
    await page.goto(`/p/${PORTAL}/feed`)
    await expect(page.getByTestId('journey')).toBeVisible()
    await page.waitForTimeout(800)
    const keys = await page.evaluate(() => Object.keys(window.localStorage))
    expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem('hearts.heart.v1'))) || '{}')).toMatchObject({ mine: true })
    expect(keys.some((key) => key.startsWith('hearts.viewas.'))).toBeTruthy()
    await page.getByTestId('viewas-exit').click()
    await page.waitForURL(/admin\/teach/)
    const after = await page.evaluate(() => Object.keys(window.localStorage))
    expect(after.filter((key) => key.startsWith('hearts.viewas.'))).toEqual([])
    expect(after).toContain('hearts.heart.v1')
  })

  test('43. Exit returns to where the view started and ends the session', async ({ page }) => {
    await startAsAdmin(page)
    await page.getByTestId('viewas-exit').click()
    await page.waitForURL(/admin\/teach/)
    await expect(page.getByTestId('viewas-banner')).toHaveCount(0)
    const status = await (await page.request.get('/api/view-as/status')).json()
    expect(status.active).toBe(false)
    expect((await auditEvents('view_as.stop')).length).toBeGreaterThan(0)
  })

  test('44. a teacher has no View as, and the server refuses one', async ({ page }) => {
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', `/p/${PORTAL}/admin/teach`)
    await expect(page.getByTestId('learner-row').first()).toBeVisible()
    await expect(page.getByTestId('view-as')).toHaveCount(0)
    const refused = await page.request.post('/api/view-as/start', { data: { targetUserId: await userId('elm-learner@hearts.test'), reason: 'Trying to look in' } })
    expect(refused.status()).toBe(403)
  })

  test('45. a portal admin cannot view as a learner in another portal', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin`)
    const refused = await page.request.post('/api/view-as/start', { data: { targetUserId: await userId('leeds-learner@hearts.test'), reason: 'Trying to look in' } })
    expect(refused.status()).toBe(403)
    expect((await refused.json()).error).toContain('another portal')
  })

  test('46. the master views as a portal admin, but never as another master', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    const refused = await page.request.post('/api/view-as/start', { data: { targetUserId: await userId('master2@hearts.test'), reason: 'Trying to look in' } })
    expect(refused.status()).toBe(403)
    const card = page.getByTestId('portal-card').filter({ hasText: `/p/${PORTAL}` })
    await card.getByTestId('view-as').click()
    await card.getByTestId('view-as-reason').fill('Seeing the admin desk as they do')
    await card.getByTestId('view-as-start').click()
    await page.waitForURL(new RegExp(`/p/${PORTAL}/admin`))
    await expect(page.getByTestId('viewas-text')).toContainText('Viewing as')
    await page.getByTestId('viewas-exit').click()
    await page.waitForURL(/\/master/)
  })

  test('47. start and stop are written to the audit log with the reason', async ({ page }) => {
    await startAsAdmin(page)
    await page.getByTestId('viewas-exit').click()
    await page.waitForURL(/admin\/teach/)
    const starts = await auditEvents('view_as.start')
    expect(starts[0].reason).toContain('Checking what she sees')
    expect(starts[0].target).toBe(await userId('elm-learner@hearts.test'))
  })

  test('48. allowing changes needs a reason, and then a change goes through and is logged', async ({ page }) => {
    await startAsAdmin(page)
    await page.getByTestId('viewas-allow').click()
    await expect(page.getByTestId('viewas-write-confirm')).toBeDisabled()
    await page.getByTestId('viewas-write-reason').fill('She asked me to turn on haptics')
    const reloaded = page.waitForEvent('load')
    await page.getByTestId('viewas-write-confirm').click()
    await reloaded
    await expect(page.getByTestId('viewas-banner')).toHaveAttribute('data-mode', 'write')
    const pref = await page.request.post('/api/hearts', { form: { action: 'me-pref', name: 'haptics', value: 'on', next: `/p/${PORTAL}/me` }, maxRedirects: 0 })
    expect(pref.status()).toBe(303)
    expect(decodeURIComponent(pref.headers().location || '')).toContain('notice=')
    expect((await auditEvents('view_as.write')).length).toBeGreaterThan(0)
    await page.getByTestId('viewas-write-off').click()
    await expect(page.getByTestId('viewas-banner')).toHaveAttribute('data-mode', 'read-only')
    await page.getByTestId('viewas-exit').click()
  })

  test('49. some things stay closed even with changes allowed: the opening and Start again', async ({ page }) => {
    await startAsAdmin(page)
    await page.request.post('/api/view-as/write', { data: { on: true, reason: 'Testing the never list' } })
    const again = await page.request.post('/api/hearts/start-again')
    expect(again.status()).toBe(403)
    const opening = await page.request.post(`/api/workbook/opening?portal=${PORTAL}`, { data: { scenesVersion: 1, taps: [] } })
    expect(opening.status()).toBe(403)
    await page.getByTestId('viewas-exit').click()
  })
})
