import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { E2E_BASE } from '../env'

const sfx = Date.now().toString().slice(-6)
const slug = `features-${sfx}`
const portalName = `Features ${sfx}`
const learnerEmail = `feat-learner-${sfx}@hearts.test`
const learnerPass = 'portal-learner'
const adminCode = `F${sfx}A`
const teacherCode = `F${sfx}T`
const learnerCode = `F${sfx}L`
const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const PROOF = process.env.PROOF_DIR || '/tmp/portal-features-proof'

let master: APIRequestContext

async function hideDevBadge(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }' }).catch(() => undefined)
}

async function proofShot(page: Page, name: string) {
  mkdirSync(PROOF, { recursive: true })
  await hideDevBadge(page)
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${PROOF}/${name}.png`, caret: 'initial' })
}

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const form = (ctx: APIRequestContext, data: Record<string, string | number>) =>
  ctx.post('/api/hearts', { form: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])), maxRedirects: 0 })

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function json(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  return (await response.json().catch(() => ({}))) as { docs?: { id: number; title?: string }[]; user?: { id: number } }
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})

test.afterAll(async () => {
  await master?.dispose()
})

async function expectFeatureGroups(page: Page) {
  await expect(page.getByRole('heading', { name: 'Open a portal' })).toBeVisible()
  await expect(page.getByTestId('studio-features')).toBeVisible()
  await expect(page.getByTestId('feature-depth-beginner').locator('h3')).toHaveText('Always included')
  await expect(page.getByTestId('feature-depth-line-beginner')).toContainText('cannot switch them off')
  await expect(page.getByTestId('feature-depth-intermediate').locator('h3')).toHaveText('On unless you switch it off')
  await expect(page.getByTestId('feature-depth-in-depth').locator('h3')).toHaveText('Extras you choose')
  await expect(page.getByTestId('preset-standard')).toBeVisible()
  await expect(page.getByTestId('preset-everything')).toBeVisible()
  await expect(page.getByTestId('preset-small')).toHaveCount(0)
  await expect(page.getByTestId('preset-community')).toHaveCount(0)
  await expect(page.getByTestId('feature-garden')).toBeChecked()
  await expect(page.getByTestId('feature-garden')).toBeDisabled()
  await expect(page.getByTestId('feature-workbook')).toBeDisabled()
  await expect(page.getByTestId('feature-planner')).toBeChecked()
  await expect(page.getByTestId('feature-planner')).toBeDisabled()
  await expect(page.getByTestId('feature-announcements')).toBeChecked()
  await expect(page.getByTestId('feature-announcements')).toBeDisabled()
  await expect(page.getByTestId('feature-circle')).toBeChecked()
  await expect(page.getByTestId('feature-circle')).toBeEnabled()
  await expect(page.getByTestId('feature-compass')).toBeEnabled()
  await expect(page.getByTestId('feature-feedback')).toBeEnabled()
  await expect(page.getByTestId('feature-gather')).toBeEnabled()
  await expect(page.getByTestId('feature-gather')).not.toBeChecked()
  await expect(page.getByTestId('feature-live')).not.toBeChecked()
  await expect(page.getByTestId('feature-missions')).not.toBeChecked()
  await expect(page.getByTestId('feature-insights')).not.toBeChecked()
  await expect(page.getByTestId('feature-experiments')).not.toBeChecked()
  await expect(page.getByTestId('feature-calendar')).not.toBeChecked()
  await expect(page.getByTestId('feature-ai')).not.toBeChecked()
}

test('the master creator can switch Gather off, and a learner sees no Gather until it is turned back on', async ({ page, browser }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/create')
  await expect(page.getByTestId('portal-create')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Open a portal' })).toBeVisible()
  await proofShot(page, '1280-open-a-portal')
  await page.getByTestId('create-portal-name').fill(portalName)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.setViewportSize(PHONE)
  await expect(page.getByTestId('portal-create')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Open a portal' })).toBeVisible()
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  await proofShot(page, '390-open-a-portal')
  await page.setViewportSize(DESK)
  await page.getByTestId('studio-next').click()
  await expect(page.getByTestId('studio-courses')).toBeVisible()
  await page.getByTestId('studio-next').click()
  await expect(page.getByTestId('studio-step-features')).toHaveClass(/on/)
  await expectFeatureGroups(page)
  await expect(page.getByTestId('preset-standard')).toHaveClass(/ink/)
  await page.getByTestId('preset-everything').click()
  await expect(page.getByTestId('feature-gather')).toBeChecked()
  await expect(page.getByTestId('feature-calendar')).toBeChecked()
  await expect(page.getByTestId('feature-ai')).toBeChecked()
  await expect(page.getByTestId('feature-garden')).toBeDisabled()
  await page.getByTestId('preset-standard').click()
  await expect(page.getByTestId('feature-gather')).not.toBeChecked()
  await expect(page.getByTestId('feature-circle')).toBeChecked()
  await proofShot(page, '1280-features')
  await page.setViewportSize(PHONE)
  await expectFeatureGroups(page)
  await proofShot(page, '390-features')
  await page.setViewportSize(DESK)
  await proofShot(page, 'creator-features-gather-off')
  await page.getByTestId('create-portal-submit').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await expect(page.getByTestId('portal-card').filter({ hasText: `/p/${slug}` })).toBeVisible()

  expect((await form(master, { action: 'create-pack', portalSlug: slug, title: `Features sittings ${sfx}`, next: '/master' })).status()).toBe(303)
  const packs = await json(await master.get(`/api/packs?where[title][equals]=${encodeURIComponent(`Features sittings ${sfx}`)}&limit=1&depth=0`))
  const packId = packs.docs?.[0]?.id
  expect(packId, 'a pack to hang codes on').toBeTruthy()
  expect((await form(master, { action: 'create-code', portalSlug: slug, code: adminCode, role: 'admin', pack: packId!, next: '/master' })).status()).toBe(303)
  expect((await form(master, { action: 'create-code', portalSlug: slug, code: teacherCode, role: 'teacher', pack: packId!, next: '/master' })).status()).toBe(303)
  const teacher = await json(await master.get(`/api/access-codes?where[code][equals]=${teacherCode}&limit=1&depth=0`))
  const teacherId = teacher.docs?.[0]?.id
  expect(teacherId).toBeTruthy()
  expect((await form(master, { action: 'create-code', portalSlug: slug, code: learnerCode, role: 'learner', pack: packId!, linkedTeacherCode: teacherId!, next: '/master' })).status()).toBe(303)

  const joinPage = await browser.newPage()
  await joinPage.goto(`/join?code=${learnerCode}`)
  await joinPage.getByTestId('join-name').fill('Features Learner')
  await joinPage.getByTestId('join-email').fill(learnerEmail)
  await joinPage.getByTestId('join-password').fill(learnerPass)
  await joinPage.getByTestId('join-submit').click()
  await joinPage.waitForURL((url) => !url.pathname.startsWith('/join'))
  await joinPage.close()

  const found = await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(learnerEmail)}&depth=0`))
  const learnerId = found.docs?.[0]?.id
  expect(learnerId).toBeTruthy()
  expect((await master.patch(`/api/users/${learnerId}`, { data: { onboarded: true, seenWelcome: true } })).ok()).toBeTruthy()

  const phone = await browser.newPage()
  await phone.setViewportSize(PHONE)
  await signIn(phone, learnerEmail, learnerPass, `/p/${slug}`)
  await expect(phone.getByTestId('home')).toBeVisible()
  await expect(phone.getByTestId('tabbar')).toBeVisible()
  await expect(phone.getByTestId('tab-home')).toBeVisible()
  await expect(phone.getByTestId('tab-lanes')).toHaveCount(0)
  await expect(phone.getByTestId('tab-week')).toBeVisible()
  await expect(phone.getByTestId('tab-garden')).toBeVisible()
  await expect(phone.getByTestId('tab-me')).toBeVisible()
  await expect(phone.getByTestId('tab-gather')).toHaveCount(0)
  await expect(phone.getByTestId('tabbar')).not.toContainText('Gather')
  await expect(phone.locator('[data-testid="home-gather"]')).toHaveCount(0)
  await expect(phone.getByTestId('home')).not.toContainText('Gather')
  await proofShot(phone, 'phone-home-gather-off')

  await phone.goto(`/p/${slug}/gather`)
  await expect(phone.getByTestId('feature-unavailable')).toBeVisible()
  await expect(phone.getByTestId('feature-unavailable-body')).toContainText('not switched on')
  const gatherApi = await master.get(`/api/gather?export=1&portal=${slug}`)
  expect(gatherApi.status()).toBe(404)
  expect(((await gatherApi.json()) as { error?: string }).error).toMatch(/not available/i)

  await page.setViewportSize(DESK)
  await page.goto(`/master/portals/${slug}`)
  await expect(page.locator('[data-testid="portal-edit"]').first()).toBeVisible()
  await expect(page.getByTestId('studio-features')).toBeVisible()
  await expect(page.getByTestId('feature-gather')).not.toBeChecked()
  await page.getByTestId('feature-gather').check()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toContainText('live now')

  await phone.goto(`/p/${slug}`)
  await expect(phone.getByTestId('home')).toBeVisible()
  await expect(phone.getByTestId('tab-week')).toBeVisible()
  await expect(phone.getByTestId('tab-gather')).toHaveCount(0)
  await expect(phone.getByTestId('tabbar')).toContainText('My week')
  await proofShot(phone, 'phone-home-gather-on')
  await phone.goto(`/p/${slug}/gather`)
  await expect(phone.getByTestId('feature-unavailable')).toHaveCount(0)
  await expect(phone.getByTestId('tab-week')).toBeVisible()
  await expect(phone.getByTestId('tab-gather')).toHaveCount(0)

  await page.goto(`/master/portals/${slug}`)
  await expect(page.getByTestId('feature-garden')).toBeChecked()
  await expect(page.getByTestId('feature-garden')).toBeDisabled()
  await expect(page.getByTestId('feature-announcements')).toBeDisabled()
  await expect(page.getByTestId('feature-planner')).toBeDisabled()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()

  await phone.goto(`/p/${slug}`)
  await expect(phone.getByTestId('home')).toBeVisible()
  await expect(phone.getByTestId('tab-garden')).toBeVisible()
  await expect(phone.getByTestId('see-sown')).toBeVisible()
  await expect(phone.getByTestId('grow-banner')).toBeVisible()
  await phone.goto(`/p/${slug}/garden`)
  await expect(phone.getByTestId('garden')).toBeVisible()

  await page.goto(`/master/portals/${slug}`)
  await page.getByTestId('feature-compass').uncheck()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await phone.goto(`/p/${slug}/recalibrate`)
  await expect(phone.getByTestId('feature-unavailable')).toBeVisible()
  await expect(phone.getByTestId('feature-unavailable-body')).toContainText('Compass')
  await page.goto(`/master/portals/${slug}`)
  await page.getByTestId('feature-compass').check()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()

  const film = await browser.newContext({
    viewport: PHONE,
    recordVideo: { dir: PROOF, size: PHONE },
    baseURL: E2E_BASE,
  })
  const clip = await film.newPage()
  await signIn(clip, learnerEmail, learnerPass, `/p/${slug}`)
  await expect(clip.getByTestId('tab-week')).toBeVisible()
  await expect(clip.getByTestId('tab-gather')).toHaveCount(0)
  await hideDevBadge(clip)
  await page.goto(`/master/portals/${slug}`)
  await expect(page.getByTestId('feature-gather')).toBeChecked()
  await page.getByTestId('feature-gather').uncheck()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await clip.goto(`/p/${slug}`)
  await expect(clip.getByTestId('home')).toBeVisible()
  await expect(clip.getByTestId('tab-gather')).toHaveCount(0)
  await expect(clip.getByTestId('tab-week')).toBeVisible()
  await hideDevBadge(clip)
  await clip.waitForTimeout(600)
  await clip.close()
  const video = clip.video()
  if (video) await video.saveAs(`${PROOF}/switch-gather-off.mp4`)
  await film.close()
  await phone.close()
})
