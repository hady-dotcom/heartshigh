import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

const SHOTS = process.env.TRANSCRIPT_SHOTS || '/opt/cursor/artifacts/transcripts'
const ROKUA = 'The light of Rokua is something you can sit with.'
const RUKU = 'The light of Ruku is something you can sit with.'
const SAMPLE = `WEBVTT

00:00:02.000 --> 00:00:06.000
${ROKUA}

00:00:08.000 --> 00:00:13.000
But the heart only settles when that light is received.
`
const VIEWS = [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '390x844', width: 390, height: 844 },
] as const

let master: APIRequestContext
let sampleId = 0
let waitingId = 0
let cutId = 0

async function signIn(page: Page) {
  await page.goto('/login?next=/master/transcripts')
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false })
}

async function noOverflow(page: Page, where: string) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(extra, where).toBeLessThanOrEqual(1)
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const local = (await (await master.get(`/api/lessons?where[title][equals]=${encodeURIComponent('How we sit')}&depth=0&limit=1`)).json()) as { docs: { unit: number; course: number; portal?: number }[] }
  const home = local.docs[0]
  expect(home, 'How we sit is seeded').toBeTruthy()
  const make = async (data: Record<string, unknown>) => {
    const response = await master.post('/api/lessons', { data: { unit: home.unit, course: home.course, portal: home.portal, ...data } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const body = (await response.json()) as { id?: number; doc?: { id: number } }
    return body.doc?.id || body.id || 0
  }
  sampleId = await make({
    title: 'Transcript desk sample',
    speaker: 'Amina Yusuf',
    order: 20,
    durationSeconds: 90,
    youtubeId: 'ccccccccccc',
    youtubeUrl: 'https://www.youtube.com/watch?v=ccccccccccc',
    transcript: SAMPLE,
    transcriptSource: 'youtube',
    publishState: 'published',
  })
  waitingId = await make({
    title: 'Transcript desk waiting',
    speaker: 'Amina Yusuf',
    order: 21,
    durationSeconds: 400,
    youtubeId: 'ccccccccccc',
    youtubeUrl: 'https://www.youtube.com/watch?v=ccccccccccc',
    transcript: '',
    transcriptSource: 'none',
    publishState: 'draft',
  })
  await make({
    title: 'Transcript desk plain',
    speaker: 'Hani',
    order: 22,
    durationSeconds: 600,
    transcript: 'These are words from the talk without any clock times on them at all.',
    transcriptSource: 'upload',
    publishState: 'published',
  })
  const cut = await master.post('/api/cuts', {
    data: {
      lesson: sampleId,
      course: home.course,
      status: 'approved',
      start: 2,
      end: 6,
      timestamp: '0:02',
      hook: ROKUA,
      turn: 'But the heart only settles when that light is received.',
      land: 'Carry the light of Rokua into the evening.',
    },
  })
  expect(cut.ok(), await cut.text()).toBeTruthy()
  const cutBody = (await cut.json()) as { id?: number; doc?: { id: number } }
  cutId = cutBody.doc?.id || cutBody.id || 0
})

test.afterAll(async () => {
  await master?.dispose()
})

for (const view of VIEWS) {
  test(`the list and the editor fit ${view.name}`, async ({ page }) => {
    test.setTimeout(180_000)
    page.setDefaultTimeout(45_000)
    page.setDefaultNavigationTimeout(90_000)
    await page.setViewportSize({ width: view.width, height: view.height })
    await signIn(page)
    await expect(page.getByTestId('nav-transcripts')).toHaveText('Transcripts')
    await expect(page.getByRole('heading', { name: 'Transcripts' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/media number/i)
    const row = page.locator('[data-testid="transcript-row"][data-lesson="' + sampleId + '"]')
    await expect(row.getByTestId('transcript-title')).toHaveText('Transcript desk sample')
    await expect(row.getByTestId('transcript-speaker')).toHaveText('Amina Yusuf')
    await expect(row.getByTestId('transcript-length')).toHaveText('1:30')
    await expect(row.getByTestId('transcript-source')).toHaveText('YouTube captions')
    await expect(row.getByTestId('transcript-timing')).toHaveText('Has times')
    await expect(row.getByTestId('transcript-courses')).toContainText('East London circle notes')
    await expect(row.getByTestId('transcript-status')).toHaveText('Ready')
    await expect(row.getByTestId('transcript-thumb')).toHaveAttribute('src', /i\.ytimg\.com/)
    await expect(page.locator(`[data-testid="transcript-row"][data-lesson="${waitingId}"]`).getByTestId('transcript-fetch')).toBeVisible()
    await page.getByTestId('desk-help').first().getByRole('button', { name: 'What is this?' }).click()
    await expect(page.getByTestId('desk-help-pop')).toContainText('Open a talk to fix a line')
    await page.keyboard.press('Escape')
    await noOverflow(page, `list ${view.name}`)
    await shot(page, `${view.name}-list`)

    await row.getByTestId('transcript-title').click()
    await expect(page.getByTestId('transcript-editor')).toBeVisible()
    await expect(page.getByTestId('transcript-editor')).toHaveAttribute('data-hydrated', 'yes')
    await expect(page.getByTestId('transcript-player')).toBeVisible()
    await expect(page.getByTestId('transcript-line').first()).toBeVisible()
    await page.getByTestId('transcript-line-play').first().click()
    await expect(page.getByTestId('transcript-player')).toHaveAttribute('data-start', '2')
    await noOverflow(page, `editor ${view.name}`)
    await shot(page, `${view.name}-editor`)
  })
}

test('search, filters, edit, undo, replace, download, fetch and upload', async ({ page }) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(45_000)
  page.setDefaultNavigationTimeout(90_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page)

  await page.getByTestId('transcript-search').fill('Transcript desk')
  await page.getByTestId('filter-short').check()
  await page.getByTestId('transcript-apply').click()
  await expect(page).toHaveURL(/short=1/)
  await expect(page.locator('[data-testid="transcript-row"][data-lesson="' + sampleId + '"]')).toBeVisible()
  await expect(page.locator('[data-testid="transcript-row"][data-lesson="' + waitingId + '"]')).toHaveCount(0)

  await page.goto('/master/transcripts?missing=1')
  await expect(page.locator('[data-testid="transcript-row"][data-lesson="' + waitingId + '"]')).toBeVisible()
  await expect(page.locator('[data-testid="transcript-row"][data-lesson="' + sampleId + '"]')).toHaveCount(0)
  const missing = page.locator('[data-testid="transcript-row"]')
  const missingCount = await missing.count()
  for (let index = 0; index < missingCount; index++) await expect(missing.nth(index)).toHaveAttribute('data-missing', 'yes')

  await page.goto('/master/transcripts?untimed=1')
  const plain = page.locator('[data-testid="transcript-row"]').filter({ hasText: 'Transcript desk plain' })
  await expect(plain).toBeVisible()
  await expect(plain).toHaveAttribute('data-timed', 'no')
  await expect(plain.getByTestId('transcript-source')).toHaveText('Uploaded')
  await expect(plain.getByTestId('transcript-status')).toHaveText('No timing')

  await page.goto(`/master/transcripts/${sampleId}`)
  await page.getByTestId('transcript-find').fill('Rokua')
  await page.getByTestId('transcript-replace').fill('Ruku')
  await page.getByTestId('transcript-replace-all').click()
  await expect(page.getByTestId('transcript-replace-note')).toContainText('Replaced')
  await expect(page.getByTestId('transcript-line-text').first()).toHaveValue(RUKU)
  await page.getByTestId('transcript-save').click()
  await expect(page.getByTestId('notice')).toContainText(/Saved/)
  await expect(page.getByTestId('notice')).toContainText(/approved clip/i)
  const saved = (await (await master.get(`/api/cuts/${cutId}?depth=0`)).json()) as { hook?: string; land?: string }
  expect(saved.hook).toBe(RUKU)
  expect(saved.land).toContain('Ruku')

  await page.getByTestId('transcript-undo').click()
  await expect(page.getByTestId('notice')).toContainText(/previous words/)
  await expect(page.getByTestId('transcript-line-text').first()).toHaveValue(ROKUA)
  const restored = (await (await master.get(`/api/cuts/${cutId}?depth=0`)).json()) as { hook?: string }
  expect(restored.hook).toBe(ROKUA)

  const download = await page.request.get(`/master/transcripts/${sampleId}/vtt`)
  expect(download.ok()).toBeTruthy()
  expect(download.headers()['content-type']).toContain('text/vtt')
  const vtt = await download.text()
  expect(vtt).toContain('WEBVTT')
  expect(vtt).toContain('Rokua')

  await page.goto('/master/transcripts?missing=1')
  await page.locator(`[data-testid="transcript-row"][data-lesson="${waitingId}"]`).getByTestId('transcript-fetch').click()
  await expect(page.getByTestId('notice')).toContainText(/YouTube/)
  await expect(page.getByTestId('transcript-line-text').first()).toHaveValue(/light of the name/)

  const file = path.join(SHOTS, 'upload.vtt')
  mkdirSync(SHOTS, { recursive: true })
  writeFileSync(file, 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nUploaded line for this talk.\n')
  await page.goto('/master/transcripts')
  await page.getByTestId('transcript-talk').selectOption({ label: 'Transcript desk plain' })
  await page.getByTestId('sheet-transcript-file').setInputFiles(file)
  await page.getByTestId('sheet-transcript-upload').click()
  await expect(page.getByTestId('notice')).toContainText(/Transcript desk plain/)
  await expect(page.getByTestId('notice')).not.toContainText(/media \d/i)
  await expect(page.getByTestId('transcript-line-text').first()).toHaveValue('Uploaded line for this talk.')
  await shot(page, '1280x800-saved')
})
