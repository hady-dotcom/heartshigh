import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { LIVE_DEMO_TITLES } from '../../src/lib/live'

const LIVE_TITLE = LIVE_DEMO_TITLES[0]
const COMING_TITLE = LIVE_DEMO_TITLES[1]
const YT = 'https://www.youtube.com/live/jNQXAC9IVRw'
const created = new Set<number>()

let teacher: APIRequestContext
let learner: APIRequestContext
let leeds: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/live', { form: data, maxRedirects: 0, headers: { accept: 'application/json' } })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))

function looksLikeFixtureTitle(title: string) {
  return /^(hadith circle|coming circle)\b/i.test(title.trim()) || /\b\d{6}\b/.test(title)
}

async function forget(id: number) {
  await form(teacher, { action: 'forget', id: String(id), portal: 'east-london', next: '/p/east-london/admin/live' })
  created.delete(id)
}

async function forgetLeftovers() {
  const res = await teacher.get('/api/live?portal=east-london&desk=1', { headers: { accept: 'application/json' } })
  if (!res.ok()) return
  const body = (await res.json()) as { sessions?: { id: number; title?: string; status?: string }[] }
  for (const row of body.sessions || []) {
    if (looksLikeFixtureTitle(row.title || '') || created.has(row.id) || row.title === LIVE_TITLE || row.title === COMING_TITLE) {
      if (row.status === 'live') await form(teacher, { action: 'end', id: String(row.id), portal: 'east-london', next: '/p/east-london/admin/live' })
      await forget(row.id)
    }
  }
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  teacher = await as('elm-teacher@hearts.test', 'portal-teacher')
  learner = await as('elm-learner@hearts.test', 'portal-learner')
  leeds = await as('leeds-learner@hearts.test', 'portal-learner')
  await forgetLeftovers()
})

test.afterAll(async () => {
  await forgetLeftovers()
  for (const id of [...created]) await forget(id)
  await teacher?.dispose()
  await learner?.dispose()
  await leeds?.dispose()
})

test('a teacher starts a live YouTube session; the same portal sees it and another portal does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/live')
  await expect(page.getByTestId('desk-live')).toBeVisible()
  await expect(page.getByTestId('desk-live-door')).toContainText('Door 16 · Ihsan: Worship as though you see Him')
  await expect(page.getByTestId('desk-live-door')).not.toContainText('W16')
  await expect(page.getByTestId('desk-live-when')).toBeVisible()
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0)
  await page.getByTestId('desk-live-title').fill(LIVE_TITLE)
  await page.getByTestId('desk-live-door').selectOption('16')
  await page.getByTestId('desk-live-url').fill(YT)
  await page.getByTestId('desk-start-now').click()
  await expect(page.getByTestId('desk-live-now')).toBeVisible()
  await expect(page.getByTestId('desk-live-now')).toContainText(LIVE_TITLE)
  await expect(page.getByTestId('desk-live-now')).toContainText('Door 16 · Ihsan: Worship as though you see Him')
  await expect(page.getByTestId('desk-live-now')).not.toContainText('W16')
  await expect(page.getByTestId('desk-live')).not.toContainText(/coming circle|hadith circle/i)

  const elm = await learner.get('/api/live?portal=east-london', { headers: { accept: 'application/json' } })
  expect(elm.ok()).toBeTruthy()
  const elmBody = (await elm.json()) as { live?: { id: number; title: string; doorLabel?: string } | null }
  expect(elmBody.live?.title).toBe(LIVE_TITLE)
  expect(elmBody.live?.doorLabel || '').toContain('Door 16')
  expect(elmBody.live?.doorLabel || '').not.toContain('W16')
  if (elmBody.live?.id) created.add(elmBody.live.id)

  const other = await leeds.get('/api/live?portal=east-london', { headers: { accept: 'application/json' } })
  expect(other.status()).toBe(404)
  const leedsHome = await leeds.get('/api/live?portal=leeds', { headers: { accept: 'application/json' } })
  expect(leedsHome.ok()).toBeTruthy()
  const leedsBody = (await leedsHome.json()) as { live?: { title?: string } | null }
  expect(leedsBody.live?.title || '').not.toBe(LIVE_TITLE)

  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByRole('heading', { name: 'Home' })).toBeVisible()
  await expect(page.getByTestId('live-now')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('live-now')).toContainText(LIVE_TITLE)
  const homeBox = await page.getByRole('heading', { name: 'Home' }).boundingBox()
  const bannerBox = await page.getByTestId('live-now').boundingBox()
  expect(homeBox && bannerBox && bannerBox.y > homeBox.y).toBeTruthy()
  await page.getByTestId('live-now').click()
  await expect(page.getByTestId('live-watch')).toBeVisible()
  await expect(page.getByTestId('live-host')).toBeVisible()
  await expect(page.getByTestId('live-poster')).toBeVisible()
  await expect(page.getByTestId('live-poster')).toContainText('Starting')
  await expect(page.locator('text=Sign in to confirm')).toHaveCount(0)

  await page.getByTestId('live-question-input').fill('What is ihsan in one line?')
  await page.getByTestId('live-question-send').click()
  const mine = page.getByTestId('live-question').filter({ hasText: 'What is ihsan in one line?' })
  await expect(mine).toBeVisible({ timeout: 15_000 })
  await expect(mine).toContainText('Sent')
  await expect(mine).toHaveAttribute('data-sent', 'yes')

  const asked = await learner.get(`/api/live?portal=east-london&id=${elmBody.live!.id}`, { headers: { accept: 'application/json' } })
  const askedBody = (await asked.json()) as { questions?: { body: string; mine?: boolean }[] }
  expect(askedBody.questions?.[0]?.body).toContain('ihsan')
  expect(askedBody.questions?.[0]?.mine).toBeTruthy()

  const ended = await form(teacher, { action: 'end', id: String(elmBody.live!.id), portal: 'east-london', next: '/p/east-london/admin/live' })
  expect(ended.ok() || loc(ended).includes('notice=')).toBeTruthy()
  const after = (await (await teacher.get(`/api/live?portal=east-london&id=${elmBody.live!.id}`, { headers: { accept: 'application/json' } })).json()) as { session?: { status?: string; replayLessonId?: number | null } }
  expect(after.session?.status).toBe('ended')
  expect(after.session?.replayLessonId).toBeTruthy()
})

test('a scheduled session shows Coming up, and I’ll be there sets a reminder', async ({ page }) => {
  const saved = await form(teacher, {
    action: 'save',
    portal: 'east-london',
    title: COMING_TITLE,
    source: 'youtube',
    sourceUrl: YT,
    when: '06/10/2026 16:42',
    next: '/p/east-london/admin/live',
  })
  expect(saved.ok() || loc(saved).includes('notice=')).toBeTruthy()
  const listed = await teacher.get('/api/live?portal=east-london&desk=1', { headers: { accept: 'application/json' } })
  const listedBody = (await listed.json()) as { sessions?: { id: number; title?: string; when?: string }[] }
  const row = listedBody.sessions?.find((item) => item.title === COMING_TITLE)
  expect(row?.id).toBeTruthy()
  if (row?.id) created.add(row.id)
  expect(row?.when || '').toMatch(/[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} [ap]m/)
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('coming-up')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('coming-up')).toContainText(COMING_TITLE)
  await expect(page.getByTestId('coming-up')).not.toContainText(/coming circle|hadith circle|\d{6}/i)
  const card = page.getByTestId('coming-up-row').filter({ hasText: COMING_TITLE })
  await expect(card).toContainText(/[ap]m/)
  await card.getByTestId('ill-be-there').click()
  await expect(card.getByTestId('coming-up-set')).toBeVisible()
})
