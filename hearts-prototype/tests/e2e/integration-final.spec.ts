import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import { buildWorkbook } from '../../src/lib/master-sheet'

// The whole learner path after the final integration, at phone size, end to end.

const PHONE = { width: 390, height: 844 }
const DESK = { width: 1440, height: 900 }
const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const sfx = Date.now().toString().slice(-6)
const LEARNER = { name: 'Integration Learner', email: `final-${sfx}@hearts.test`, password: 'final-learner-1' }
const PACK = `Final pack ${sfx}`
const COURSE = `Imported sitting ${sfx}`
const PROMPT = `What would you say back to this speaker ${sfx}`
const ANSWER = `I would thank them for the reminder ${sfx}`
const BY_PROPHET = ['The Prophet', 'A calm place to start', 'I go quiet', 'With the Prophet']
const VIDEO = process.env.HEARTS_VIDEO

let master: APIRequestContext
let packId = 0
let adoptionId = 0

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function postSheet(buffer: Buffer, fields: Record<string, string>) {
  const response = await master.post('/api/hearts/sheet', {
    multipart: { ...fields, response: 'json', file: { name: 'final.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer } },
  })
  return { response, body: await json(response) }
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  packId = (await json(await master.post('/api/packs', { data: { title: PACK, owner: 'master', courses: [] } }))).doc.id
  const portal = (await json(await master.get(`/api/portals?where[slug][equals]=${PORTAL}&depth=0`))).docs[0].id
  adoptionId = (await json(await master.post('/api/adoptions', { data: { portal, kind: 'pack', pack: packId } }))).doc.id
  expect(adoptionId).toBeTruthy()
})

test.afterAll(async () => {
  const course = (await json(await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(COURSE)}&depth=0`))).docs?.[0]?.id
  if (course) {
    await master.delete(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(PROMPT)}`)
    await master.delete(`/api/lessons?where[course][equals]=${course}`)
    await master.delete(`/api/units?where[course][equals]=${course}`)
    await master.delete(`/api/courses/${course}`)
  }
  if (adoptionId) await master.delete(`/api/adoptions/${adoptionId}`)
  if (packId) await master.delete(`/api/packs/${packId}`)
  await master?.dispose()
})

test('a learner joins by code, takes the persona quiz, stays on level, steps up by Learn more, answers an imported pop-up and finds it all again', async ({ browser }) => {
  test.setTimeout(240_000)
  const context = await browser.newContext({ viewport: PHONE, ...(VIDEO ? { recordVideo: { dir: path.dirname(VIDEO), size: PHONE } } : {}) })
  const page = await context.newPage()
  await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())

  await page.goto(`/join?code=${seedCode('elm-learner')}`)
  await page.getByTestId('join-name').fill(LEARNER.name)
  await page.getByTestId('join-email').fill(LEARNER.email)
  await page.getByTestId('join-password').fill(LEARNER.password)
  await page.getByTestId('join-submit').click()
  await expect(page.getByTestId('splash')).toBeVisible()

  await page.getByTestId('welcome-begin').click()
  await page.waitForURL(/step=films|\/start/)
  if (page.url().includes('step=films')) await page.getByTestId('welcome-continue').click()
  await page.goto(`${BASE}/welcome?step=placing`)
  const questions = page.getByTestId('placing-question')
  await expect(questions).toHaveCount(BY_PROPHET.length)
  for (const [index, pick] of BY_PROPHET.entries()) await questions.nth(index).getByLabel(pick, { exact: true }).check()
  await page.getByTestId('placing-submit').click()
  await expect(async () => {
    if (await page.getByTestId('lets-play').isVisible()) await page.getByTestId('lets-play').click()
    await expect(page.locator('[data-testid="scene"][data-scene="extra"]')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  for (const scene of ['extra', 'queue', 'thumb', 'visitor', 'news', 'account', 'doors']) {
    if (await page.getByTestId('starting-door').count()) break
    const card = page.locator(`[data-testid="scene"][data-scene="${scene}"]`)
    const shown = await card.first().waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false)
    if (!shown) continue
    await card.last().getByTestId('pass').click()
  }
  await expect(page.getByTestId('starting-door')).toHaveAttribute('data-door', '2')
  await expect(page.getByTestId('first-course')).toBeVisible()
  await page.getByTestId('go-feed').click()

  const feed = page.getByTestId('journey')
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(feed).toHaveAttribute('data-mode', 'hors')
  await expect(feed).toHaveAttribute('data-cuts', /\d+ \d+/)
  const beforeLeft = await feed.getAttribute('data-cut')
  await page.getByTestId('gesture-left').dispatchEvent('click')
  await page.waitForTimeout(900)
  const afterLeft = await feed.getAttribute('data-cut')
  const toast = ((await page.getByTestId('toast').textContent().catch(() => '')) || '')
  expect(afterLeft !== beforeLeft || /everything|only/.test(toast), 'a left swipe moves to another talk or names the end of the pool').toBeTruthy()
  if (afterLeft === beforeLeft) {
    await page.goto(`${BASE}/feed?fresh=${Date.now()}`)
    await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  }
  await expect(feed).toHaveAttribute('data-card', 'talk')
  await page.waitForTimeout(600)
  const cut = (await feed.getAttribute('data-cut'))!
  const lesson = (await feed.getAttribute('data-lesson'))!
  const speaker = (await feed.getAttribute('data-speaker'))!
  const speakerSlug = (await feed.getAttribute('data-speaker-slug'))!
  expect(cut && lesson && speaker && speakerSlug).toBeTruthy()
  await expect(page.getByTestId('learn-more')).toHaveAttribute('data-parent-level', 'appetiser')
  await page.getByTestId('learn-more').click()
  await expect(feed).toHaveAttribute('data-mode', 'appetiser')
  await expect(feed).toHaveAttribute('data-cut', cut)
  expect(page.url()).toContain('play=appetiser')
  for (const move of ['gesture-next', 'gesture-left', 'gesture-prev']) {
    await page.getByTestId(move).dispatchEvent('click')
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(feed).toHaveAttribute('data-card', 'talk')
    await page.waitForTimeout(900)
  }
  await expect(page.getByTestId('learn-more')).toHaveAttribute('data-parent-level', 'talk')
  await page.getByTestId('learn-more').click()
  await page.waitForURL(/\/course\/\d+\?part=\d+/)
  expect(page.url()).toContain('t=0')

  const linger = await page.request.post('/api/hearts', {
    headers: { accept: 'application/json' },
    form: { action: 'browse', level: 'hors', event: 'linger', lesson, speaker, speakerSlug, start: '0', end: '100000' },
  })
  expect(linger.ok(), await linger.text()).toBeTruthy()
  expect((await linger.json()).counted).toBe(false)
  await page.goto(`${BASE}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')

  await page.goto(`${BASE}/garden/harvest?group=door`)
  await expect(page.getByTestId('harvest-group-door')).toHaveClass(/on/)
  const groups = page.getByTestId('harvest-group')
  if (await groups.count()) {
    for (const key of await groups.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-group') || ''))) {
      const match = /^door-(\d+)$/.exec(key)
      expect(match || key === 'door-none', key).toBeTruthy()
      if (match) expect(Number(match[1])).toBeLessThanOrEqual(20)
    }
  }

  await page.goto(`${BASE}/feed`)
  await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
  await expect(async () => {
    if ((await feed.getAttribute('data-card')) !== 'talk') await page.getByTestId('gesture-left').dispatchEvent('click')
    await expect(page.getByTestId('speaker-link')).toBeVisible({ timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  const shownSpeaker = (await feed.getAttribute('data-speaker'))!
  await page.getByTestId('speaker-link').click()
  await page.waitForURL(/\/speaker\//)
  await expect(page.getByTestId('speaker-name')).toContainText(shownSpeaker.split(' ').slice(-1)[0])
  await expect(page.getByTestId('speaker-course').first()).toBeVisible()

  const learnerId = (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER.email)}&depth=0`))).docs[0].id
  expect((await master.patch(`/api/users/${learnerId}`, { data: { extraPacks: [packId] } })).ok()).toBeTruthy()
  const youtubeId = `Fin${sfx}xyz`.slice(0, 11)
  const buffer = await buildWorkbook({
    talks: [{ talk_key: `fin-${sfx}`, youtube_id: youtubeId, title: `A sitting ${sfx}`, course: COURSE, speaker: 'Final Speaker', duration: 600, pack: PACK }],
    questions: [{ talk_key: `fin-${sfx}`, type: 'reflection', time: 5, text: PROMPT, source: 'human' }],
  })
  const preview = await postSheet(buffer, { intent: 'preview', scope: 'library', desk: 'master', approveQuestions: 'on' })
  expect(preview.body.errors, JSON.stringify(preview.body.errors)).toEqual([])
  const applied = await postSheet(buffer, { intent: 'apply', scope: 'library', desk: 'master', import: String(preview.body.importId), approveQuestions: 'on', push: 'on' })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()
  const point = (await json(await master.get(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(PROMPT)}&depth=0`))).docs[0] as { status: string }
  expect(point.status).toBe('published')
  const course = (await json(await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(COURSE)}&depth=0`))).docs[0].id

  await page.goto(`${BASE}/course/${course}`)
  if (await page.getByTestId('buffet-talk').count()) await page.getByTestId('buffet-talk').first().click()
  else if (await page.getByTestId('start-part').count()) await page.getByTestId('start-part').click()
  await expect(page.getByTestId('player')).toBeVisible()
  await expect(async () => {
    await page.getByTestId('timeline-dot').first().click()
    await expect(page.getByTestId('popup-prompt')).toContainText(PROMPT, { timeout: 1500 })
  }).toPass({ timeout: 20_000 })
  await page.getByTestId('answer-text').fill(ANSWER)
  await page.getByTestId('answer-submit').click()
  await expect(page.getByTestId('player').getByTestId('notice')).toContainText('workbook')
  await page.goto(`${BASE}/garden/workbook`)
  await expect(page.getByTestId('workbook-entry').filter({ hasText: ANSWER })).toBeVisible()
  await page.goto(`${BASE}/garden/general`)
  await expect(page.getByTestId('stat-sittings')).toHaveText('0')

  await context.close()
  if (VIDEO) {
    mkdirSync(path.dirname(VIDEO), { recursive: true })
    await page.video()?.saveAs(VIDEO)
  }
})

test('a portal admin walks the short setup and lands back on the overview', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${BASE}/admin/wizard`)
  await expect(page.getByTestId('wizard')).toBeVisible()
  await expect(page.getByTestId('wizard-welcome')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForURL(/step=2/)
  await expect(page.getByTestId('wizard-course')).toBeVisible()
  await page.getByRole('link', { name: 'Skip' }).click()
  await page.waitForURL(/step=3/)
  await page.getByTestId('wizard-finish').click()
  await page.waitForURL((url) => url.pathname === `${BASE}/admin`)
  await expect(page.getByTestId('admin-overview')).toBeVisible()
  await expect(page.getByText('The short setup is not finished yet')).toHaveCount(0)
})
