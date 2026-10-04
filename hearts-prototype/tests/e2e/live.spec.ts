import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const sfx = Date.now().toString().slice(-6)
const YT = 'https://www.youtube.com/live/jNQXAC9IVRw'

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
})

test.afterAll(async () => {
  await teacher?.dispose()
  await learner?.dispose()
  await leeds?.dispose()
})

test('a teacher starts a live YouTube session; the same portal sees it and another portal does not', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/live')
  await expect(page.getByTestId('desk-live')).toBeVisible()
  await page.getByTestId('desk-live-title').fill(`Hadith circle ${sfx}`)
  await page.getByTestId('desk-live-url').fill(YT)
  await page.getByTestId('desk-start-now').click()
  await expect(page.getByTestId('desk-live-now')).toBeVisible()
  await expect(page.getByTestId('desk-live-now')).toContainText(`Hadith circle ${sfx}`)

  const elm = await learner.get('/api/live?portal=east-london', { headers: { accept: 'application/json' } })
  expect(elm.ok()).toBeTruthy()
  const elmBody = (await elm.json()) as { live?: { id: number; title: string } | null }
  expect(elmBody.live?.title).toContain(`Hadith circle ${sfx}`)

  const other = await leeds.get('/api/live?portal=east-london', { headers: { accept: 'application/json' } })
  expect(other.status()).toBe(404)
  const leedsHome = await leeds.get('/api/live?portal=leeds', { headers: { accept: 'application/json' } })
  expect(leedsHome.ok()).toBeTruthy()
  const leedsBody = (await leedsHome.json()) as { live?: { title?: string } | null }
  expect(leedsBody.live?.title || '').not.toContain(`Hadith circle ${sfx}`)

  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('live-now')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('live-now')).toContainText(`Hadith circle ${sfx}`)
  await page.getByTestId('live-now').click()
  await expect(page.getByTestId('live-watch')).toBeVisible()
  await expect(page.getByTestId('live-host')).toBeVisible()

  await page.getByTestId('live-question-input').fill('What is ihsan in one line?')
  await page.getByTestId('live-question-send').click()
  await expect(page.getByTestId('live-question')).toContainText('What is ihsan in one line?')

  const asked = await learner.get(`/api/live?portal=east-london&id=${elmBody.live!.id}`, { headers: { accept: 'application/json' } })
  const askedBody = (await asked.json()) as { questions?: { body: string }[] }
  expect(askedBody.questions?.some((row) => row.body.includes('ihsan'))).toBeTruthy()

  const ended = await form(teacher, { action: 'end', id: String(elmBody.live!.id), portal: 'east-london', next: '/p/east-london/admin/live' })
  expect(ended.ok() || loc(ended).includes('notice=')).toBeTruthy()
  const after = (await (await teacher.get(`/api/live?portal=east-london&id=${elmBody.live!.id}`, { headers: { accept: 'application/json' } })).json()) as { session?: { status?: string; replayLessonId?: number | null } }
  expect(after.session?.status).toBe('ended')
  expect(after.session?.replayLessonId).toBeTruthy()
})

test('a scheduled session shows Coming up, and I’ll be there sets a reminder', async ({ page }) => {
  const when = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  const saved = await form(teacher, {
    action: 'save',
    portal: 'east-london',
    title: `Coming circle ${sfx}`,
    source: 'youtube',
    sourceUrl: YT,
    when,
    next: '/p/east-london/admin/live',
  })
  expect(saved.ok() || loc(saved).includes('notice=')).toBeTruthy()
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('coming-up')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('coming-up')).toContainText(`Coming circle ${sfx}`)
  const row = page.getByTestId('coming-up-row').filter({ hasText: `Coming circle ${sfx}` })
  await row.getByTestId('ill-be-there').click()
  await expect(row.getByTestId('coming-up-set')).toBeVisible()
})
