import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import { horsNestingProblem } from '../../src/lib/tiers'

// The product rule. A full talk holds its appetiser and the appetiser holds its hors d'oeuvre, each linking up to
// the one above. Browsing short-form (hors d'oeuvres, appetisers, films, cards) never counts towards a course, the
// Garden or time given: only a full talk watched in its course, and that course's questions, do.

const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const sfx = Date.now().toString(36)
const LEARNER = { name: 'Nesting Learner', email: `nest-${sfx}@hearts.test`, password: 'nesting-learner' }

type Tier = { id: number; lesson: number; horsStart: number; horsEnd: number; appetiserStart: number; appetiserEnd: number; appetiserSpans?: { start: number; end: number }[] | null }
type Clip = { cutId: number; courseId: number; lessonId: number; hors: { start: number; end: number }; appetiser: { start: number; end: number; spans?: { start: number; end: number }[] } }
type Point = { id: number; lesson: { id: number; course: number; durationSeconds?: number } }

let master: APIRequestContext
let learner: APIRequestContext
const chosen: { point?: Point; cutId?: number } = {}

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>
const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/hearts', { form: data, maxRedirects: 0 })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))

async function as(email?: string, password?: string, headers: Record<string, string> = {}) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json', ...headers } })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function clips(ctx: APIRequestContext) {
  return Object.values((await json(await ctx.get(`/api/hearts/opening?portal=${PORTAL}`))).clips || {}) as Clip[]
}

const fruits = async (page: Page) => (await page.getByTestId('fruit-count').innerText()).trim()

async function garden(page: Page) {
  await page.goto(`${BASE}/garden/general`)
  return {
    sittings: (await page.getByTestId('stat-sittings').innerText()).trim(),
    answers: (await page.getByTestId('stat-answers').innerText()).trim(),
    time: (await page.getByTestId('time-given').innerText()).trim(),
  }
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  const joiner = await as(undefined, undefined, { 'x-forwarded-for': '10.6.0.1' })
  expect(loc(await form(joiner, { action: 'join', code: seedCode('elm-learner'), ...LEARNER }))).not.toContain('error=')
  await joiner.dispose()
  learner = await as(LEARNER.email, LEARNER.password)
})

test.afterAll(async () => {
  await learner?.dispose()
  await master?.dispose()
})

test('every seeded hors d\'oeuvre sits inside its appetiser, and every appetiser inside its full talk', async () => {
  const tiers = (await json(await master.get('/api/talk-tiers?limit=500&depth=0'))).docs as Tier[]
  const lessons = (await json(await master.get('/api/lessons?limit=1000&depth=0'))).docs as { id: number; course?: number; durationSeconds?: number }[]
  expect(tiers.length).toBeGreaterThan(20)
  for (const tier of tiers) {
    expect(horsNestingProblem(tier), `tier ${tier.id}`).toBeNull()
    const lesson = lessons.find((row) => row.id === tier.lesson)
    expect(lesson?.course, `tier ${tier.id} belongs to a talk in a course`).toBeTruthy()
    if (lesson?.durationSeconds) expect(tier.appetiserEnd, `tier ${tier.id} ends inside the talk`).toBeLessThanOrEqual(lesson.durationSeconds)
  }

  const cuts = (await json(await master.get('/api/cuts?limit=1000&depth=0'))).docs as { id: number; lesson?: number }[]
  for (const cut of cuts) expect(lessons.find((row) => row.id === cut.lesson)?.course, `cut ${cut.id} links up to a talk in a course`).toBeTruthy()

  const shown = await clips(learner)
  expect(shown.length).toBeGreaterThan(10)
  for (const clip of shown) {
    expect(clip.lessonId && clip.courseId, `clip ${clip.cutId} links up`).toBeTruthy()
    const spans = clip.appetiser.spans?.length ? clip.appetiser.spans : [clip.appetiser]
    const inside = spans.some((span) => clip.hors.start >= span.start - 0.05 && clip.hors.end <= span.end + 0.05)
    expect(inside, `clip ${clip.cutId}: hors ${clip.hors.start}-${clip.hors.end} inside the appetiser`).toBeTruthy()
  }
})

test('a tier whose hors d\'oeuvre leaves the appetiser is refused', async () => {
  const tiers = (await json(await master.get('/api/talk-tiers?limit=500&depth=0'))).docs as Tier[]
  const tier = tiers.find((row) => !row.appetiserSpans?.length && row.appetiserStart >= 30) || tiers.find((row) => !row.appetiserSpans?.length)!
  const outside = tier.appetiserStart >= 30
    ? { horsStart: tier.appetiserStart - 25, horsEnd: tier.appetiserStart - 5 }
    : { horsStart: tier.appetiserEnd + 5, horsEnd: tier.appetiserEnd + 25 }
  const refused = await master.patch(`/api/talk-tiers/${tier.id}`, { data: outside })
  expect(refused.status()).toBe(400)
  expect(JSON.stringify(await json(refused))).toContain('inside the appetiser')
  const after = (await json(await master.get(`/api/talk-tiers/${tier.id}?depth=0`))) as Tier
  expect([after.horsStart, after.horsEnd]).toEqual([tier.horsStart, tier.horsEnd])
})

test('browsing answers and short watching never move the course, the Garden or time given', async ({ page }) => {
  const shown = await clips(learner)
  const visible = new Set(shown.map((clip) => clip.courseId))
  const points = (await json(await master.get('/api/engagement-points?where[status][equals]=published&where[timing][equals]=immediate&where[kind][equals]=reflection&where[audience][equals]=everyone&depth=1&limit=100'))).docs as Point[]
  const point = points.find((row) => visible.has(row.lesson.course) && Number(row.lesson.durationSeconds) > 600)
  expect(point, 'a published question on a long talk the learner can see').toBeTruthy()
  chosen.point = point
  chosen.cutId = (shown.find((clip) => clip.lessonId === point!.lesson.id) || shown[0]).cutId
  const course = `${BASE}/course/${point!.lesson.course}?part=${point!.lesson.id}`

  await signIn(page, LEARNER.email, LEARNER.password, course)
  await page.goto(course)
  const before = await fruits(page)
  const start = await garden(page)
  expect(start).toEqual({ sittings: '0', answers: '0', time: '0m' })

  const browsing = await learner.post('/api/answers', { data: { pointId: point!.id, body: `Answered from the feed ${sfx}`, cutId: chosen.cutId } })
  expect(browsing.ok()).toBeTruthy()
  const appetiser = await form(learner, { action: 'complete', lesson: String(point!.lesson.id), seconds: '180', ended: 'yes', next: '/' })
  expect(loc(appetiser)).toContain('error=')
  const hors = await form(learner, { action: 'complete', lesson: String(point!.lesson.id), seconds: '30', next: '/' })
  expect(loc(hors)).toContain('error=')

  await page.goto(course)
  expect(await fruits(page)).toBe(before)
  expect(await garden(page)).toEqual(start)
})

test('the course page sends only the seconds played there, so opening near the end counts nothing', async ({ page }) => {
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  const point = chosen.point!
  const late = Math.max(0, Number(point.lesson.durationSeconds) - 20)
  const course = `${BASE}/course/${point.lesson.course}?part=${point.lesson.id}&t=${late}`
  await signIn(page, LEARNER.email, LEARNER.password, course)
  await page.goto(course)
  await expect(page.locator('form.watched-form input[name=seconds]')).toHaveValue('0')
  await page.getByTestId('mark-watched').click()
  await expect(page).toHaveURL(/error=/)
  expect((await garden(page)).sittings).toBe('0')
})

test('answering in the course and watching the full talk there do count', async ({ page }) => {
  const point = chosen.point!
  const course = `${BASE}/course/${point.lesson.course}?part=${point.lesson.id}`
  await signIn(page, LEARNER.email, LEARNER.password, course)
  await page.goto(course)
  const [doneBefore, total] = (await fruits(page)).match(/\d+/g)!.map(Number)

  expect((await learner.post('/api/answers', { data: { pointId: point.id, body: `Answered in the course ${sfx}` } })).ok()).toBeTruthy()
  await page.goto(course)
  expect(await fruits(page)).toBe(`${doneBefore + 1} of ${total} fruits`)
  expect((await garden(page)).answers).toBe('1')

  const full = await form(learner, { action: 'complete', lesson: String(point.lesson.id), seconds: String(point.lesson.durationSeconds), ended: 'yes', next: '/' })
  expect(loc(full)).not.toContain('error=')
  await page.goto(course)
  expect(await fruits(page)).toBe(`${doneBefore + 2} of ${total} fruits`)
  const after = await garden(page)
  expect(after.sittings).toBe('1')
  expect(after.time).not.toBe('0m')
})

test('swipes stay on the level being watched, and "Learn more" goes to the parent of that same item', async ({ page }) => {
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${BASE}/feed`)
  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-cuts', /\d+ \d+/)

  const index = await feed.getAttribute('data-index')
  await page.getByTestId('gesture-left').dispatchEvent('click')
  await expect(feed).not.toHaveAttribute('data-index', index!)
  await expect(feed).toHaveAttribute('data-mode', 'hors')

  const lesson = await feed.getAttribute('data-lesson')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-lesson', lesson!)
  await page.getByTestId('appetiser-back').click()
  await expect(feed).toHaveAttribute('data-mode', 'hors')

  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  for (const gesture of ['gesture-left', 'gesture-down', 'gesture-up', 'gesture-right']) {
    const at = await feed.getAttribute('data-index')
    await page.getByTestId(gesture).dispatchEvent('click')
    if (gesture === 'gesture-left') await expect(feed).not.toHaveAttribute('data-index', at!)
    await expect(feed, `${gesture} keeps the appetiser level`).toHaveAttribute('data-mode', 'appetiser')
    const shownLesson = await feed.getAttribute('data-lesson')
    await expect(page.getByTestId('learn-more')).toHaveAttribute('href', new RegExp(`/course/\\d+\\?part=${shownLesson}&t=0$`))
  }
})
