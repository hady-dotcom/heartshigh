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
const DESK = { width: 1366, height: 768 }
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

test('the master creator can switch Gather off, and a learner sees no Gather until it is turned back on', async ({ page, browser }) => {
  test.setTimeout(180_000)
  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/create')
  await expect(page.getByTestId('portal-create')).toBeVisible()
  await page.getByTestId('create-portal-name').fill(portalName)
  await page.getByTestId('create-portal-slug').fill(slug)
  await page.getByTestId('studio-next').click()
  await expect(page.getByTestId('studio-courses')).toBeVisible()
  await page.getByTestId('studio-next').click()
  await expect(page.getByTestId('studio-features')).toBeVisible()
  await expect(page.getByTestId('feature-depth-beginner')).toBeVisible()
  await expect(page.getByTestId('feature-depth-intermediate')).toBeVisible()
  await expect(page.getByTestId('feature-depth-in-depth')).toBeVisible()
  await expect(page.getByTestId('feature-gather')).toBeChecked()
  await page.getByTestId('feature-gather').uncheck()
  await expect(page.getByTestId('feature-gather')).not.toBeChecked()
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

  await page.goto(`/join?code=${learnerCode}`)
  await page.getByTestId('join-name').fill('Features Learner')
  await page.getByTestId('join-email').fill(learnerEmail)
  await page.getByTestId('join-password').fill(learnerPass)
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'))

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
  await expect(phone.getByTestId('tab-lanes')).toBeVisible()
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
  await expect(page.getByTestId('portal-edit')).toBeVisible()
  await expect(page.getByTestId('studio-features')).toBeVisible()
  await expect(page.getByTestId('feature-gather')).not.toBeChecked()
  await page.getByTestId('feature-gather').check()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toContainText('live now')

  await phone.goto(`/p/${slug}`)
  await expect(phone.getByTestId('home')).toBeVisible()
  await expect(phone.getByTestId('tab-gather')).toBeVisible()
  await expect(phone.getByTestId('tab-week')).toHaveCount(0)
  await proofShot(phone, 'phone-home-gather-on')
  await phone.goto(`/p/${slug}/gather`)
  await expect(phone.getByTestId('feature-unavailable')).toHaveCount(0)
  await expect(phone.getByTestId('tab-gather')).toBeVisible()

  await page.goto(`/master/portals/${slug}`)
  await page.getByTestId('feature-garden').uncheck()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()

  await phone.goto(`/p/${slug}`)
  await expect(phone.getByTestId('home')).toBeVisible()
  await expect(phone.getByTestId('tab-garden')).toHaveCount(0)
  await expect(phone.getByTestId('see-sown')).toHaveCount(0)
  await expect(phone.getByTestId('grow-banner')).toHaveCount(0)
  await phone.goto(`/p/${slug}/garden`)
  await expect(phone.getByTestId('feature-unavailable')).toBeVisible()
  await expect(phone.getByTestId('feature-unavailable-body')).toContainText('Garden')

  await page.goto(`/master/portals/${slug}`)
  await page.getByTestId('feature-garden').check()
  await page.getByTestId('save-portal-features').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await phone.goto(`/p/${slug}`)
  await expect(phone.getByTestId('tab-garden')).toBeVisible()
  await expect(phone.getByTestId('see-sown')).toBeVisible()
  await phone.goto(`/p/${slug}/garden`)
  await expect(phone.getByTestId('garden')).toBeVisible()

  const film = await browser.newContext({
    viewport: PHONE,
    recordVideo: { dir: PROOF, size: PHONE },
    baseURL: E2E_BASE,
  })
  const clip = await film.newPage()
  await signIn(clip, learnerEmail, learnerPass, `/p/${slug}`)
  await expect(clip.getByTestId('tab-gather')).toBeVisible()
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
