import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildWorkbook } from '../../src/lib/master-sheet'
import { E2E_BASE, seedCode } from '../env'
import { artifactDir } from './artifact-dir'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const RUN = process.env.BRING_IN_RUN || '1'
const ARTIFACTS = artifactDir('bring-in', `run-${RUN}`)
const sfx = `${RUN}${Date.now().toString().slice(-5)}`
const COURSE = `Bring-in films ${sfx}`
const SPEAKER = 'Alauddin Elbakri'
const SHEET_COURSE = `Storage bring-in ${sfx}`
const LINKS = [
  { id: 'B4KtRL_2aXY', label: 'short', url: 'https://www.youtube.com/watch?v=B4KtRL_2aXY' },
  { id: 'UUTnGXyCHZI', label: 'hour', url: 'https://www.youtube.com/watch?v=UUTnGXyCHZI' },
  { id: 'I7o6eqKwWio', label: 'auto', url: 'https://www.youtube.com/watch?v=I7o6eqKwWio' },
  { id: 'kM7LVppIMl0', label: 'none', url: 'https://www.youtube.com/watch?v=kM7LVppIMl0' },
  { id: 'notarealvid', label: 'broken', url: 'https://www.youtube.com/watch?v=notarealvid' },
]
const SAMPLES = {
  boys: '/home/ubuntu/.cursor/projects/workspace/uploads/from_box-G00001_925e.txt',
  speech: '/home/ubuntu/.cursor/projects/workspace/uploads/speech_to_text-G00857_d662.txt',
  auto: '/home/ubuntu/.cursor/projects/workspace/uploads/youtube-G00009_fb19.txt',
}

type LessonRow = {
  id: number
  title?: string
  speaker?: string
  youtubeId?: string
  durationSeconds?: number
  transcript?: string
  transcriptNote?: string
  transcriptSource?: string
}

const report: Record<string, unknown> = { run: RUN, course: COURSE, sheetCourse: SHEET_COURSE }

function saveReport() {
  writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(report, null, 2))
}

async function shot(page: Page, name: string) {
  const file = path.join(ARTIFACTS, `${name}.png`)
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function masterApi() {
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  const response = await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return master
}

async function lessonsFor(master: APIRequestContext, courseId: number) {
  const body = await (await master.get(`/api/lessons?where[course][equals]=${courseId}&limit=50&depth=0&sort=order`)).json()
  return (body.docs || []) as LessonRow[]
}

async function courseByTitle(master: APIRequestContext, title: string) {
  const body = await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(title)}&limit=5&depth=0`)).json()
  return (body.docs || [])[0] as { id: number; speaker?: string; title?: string } | undefined
}

test.describe('round 1 bring-in', () => {
  test.describe.configure({ mode: 'default' })

  test('several YouTube links show a speaker, a length when YouTube allows it, and a clear status', async ({ page }) => {
    test.setTimeout(720_000)
    page.setDefaultNavigationTimeout(700_000)
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
    await page.getByTestId('master-course-title').fill(COURSE)
    await page.getByLabel('Speaker').fill(SPEAKER)
    await page.getByRole('button', { name: 'Add to the library' }).click()
    await expect(page.getByRole('link', { name: COURSE })).toBeVisible()
    await shot(page, '01-library-course')
    await page.getByRole('link', { name: COURSE }).click()
    await expect(page.getByTestId('youtube-url')).toBeVisible()
    await expect(page.getByTestId('fetch-transcript')).toBeChecked()
    await expect(page.getByTestId('caption-lang')).toHaveValue('en')
    await page.getByTestId('youtube-url').fill(LINKS.map((row) => row.url).join('\n'))
    await shot(page, '02-youtube-form')
    await page.getByTestId('ingest-submit').click()
    const flash = page.getByTestId('notice').or(page.getByTestId('error'))
    await expect(flash).toBeVisible()
    const flashText = (await flash.first().innerText()).replace(/\s+/g, ' ').trim()
    report.youtubeFlash = flashText
    await shot(page, '03-youtube-result')

    const master = await masterApi()
    const course = await courseByTitle(master, COURSE)
    expect(course?.id, 'the course was created').toBeTruthy()
    const lessons = await lessonsFor(master, course!.id)
    report.youtubeLessons = lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      speaker: lesson.speaker,
      youtubeId: lesson.youtubeId,
      durationSeconds: lesson.durationSeconds || 0,
      note: lesson.transcriptNote,
      transcriptChars: (lesson.transcript || '').length,
      timed: Boolean(lesson.transcript && lesson.transcript.includes('-->')),
    }))
    saveReport()

    expect(lessons.length).toBe(LINKS.length)
    for (const link of LINKS) {
      const lesson = lessons.find((row) => row.youtubeId === link.id)
      expect(lesson, `${link.label} ${link.id} was saved`).toBeTruthy()
      expect(lesson!.speaker).toBe(SPEAKER)
      expect(lesson!.transcriptNote || '').toMatch(/^Bring-in: (processed|failed)\./)
      expect(lesson!.speaker).not.toMatch(/MCA|Yaqeen|Muslim Community|channel/i)
    }
    const broken = lessons.find((row) => row.youtubeId === 'notarealvid')
    expect(broken!.transcriptNote || '').toMatch(/does not exist or is private|could not be fetched|not a YouTube/i)
    expect((broken!.transcript || '').length).toBe(0)

    const failed = lessons.filter((row) => (row.transcriptNote || '').startsWith('Bring-in: failed') && row.youtubeId)
    expect(failed.length).toBeGreaterThan(0)
    await page.goto(`/master/library/${course!.id}?part=${failed[0].id}`)
    await expect(page.getByTestId('bring-in-status')).toHaveAttribute('data-status', 'failed')
    await expect(page.getByTestId('bring-in-retry')).toBeVisible()
    await shot(page, '04-youtube-failed-retry')
    await page.getByTestId('bring-in-retry').click()
    await expect(page.getByTestId('bring-in-status')).toBeVisible()
    await shot(page, '05-youtube-retry')

    const withTranscript = lessons.filter((row) => (row.transcript || '').includes('-->'))
    report.youtubeTranscripts = withTranscript.map((row) => row.youtubeId)
    report.youtubeDurations = Object.fromEntries(lessons.map((row) => [row.youtubeId, row.durationSeconds || 0]))
    saveReport()

    await page.goto('/master/packs')
    const row = page.getByTestId('pack-row').filter({ hasText: 'Jibril sittings' })
    await row.locator('label', { hasText: COURSE }).locator('input').check()
    await row.getByTestId('pack-save').click()
    await expect(page.getByTestId('notice')).toContainText('Pack updated')
    await master.dispose()
  })

  test('a master sheet saves the clean rows, reads transcripts from storage, and does not copy talks on a second run', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(DESK)
    const master = await masterApi()
    const media: Record<string, number> = {}
    for (const [key, file] of Object.entries(SAMPLES)) {
      const uploaded = await master.post('/api/media', {
        multipart: {
          alt: `${key} transcript`,
          file: { name: `${key}-${sfx}.txt`, mimeType: 'text/plain', buffer: readFileSync(file) },
        },
      })
      const body = await uploaded.json().catch(() => ({}))
      expect(uploaded.ok(), JSON.stringify(body)).toBeTruthy()
      const doc = (body.doc || body) as { id?: number }
      expect(doc.id, `${key} media id`).toBeTruthy()
      media[key] = doc.id!
    }
    report.media = media

    const talks = [
      { talk_key: `store-boys-${sfx}`, youtube_id: 'fr7L491rCLI', title: 'Boys to Men', course: SHEET_COURSE, speaker: 'Abdul Malik Merchant', duration: 1500 },
      { talk_key: `store-speech-${sfx}`, youtube_id: 'AmjadTars01', title: 'Allah praise of His messenger', course: SHEET_COURSE, speaker: 'Amjad Tarsin', duration: 600 },
      { talk_key: `store-auto-${sfx}`, youtube_id: 'SheetAuto01', title: 'Broken homes', course: SHEET_COURSE, speaker: 'Abdul Malik Merchant', duration: 2400 },
      ...Array.from({ length: 7 }, (_, index) => ({
        talk_key: `store-extra-${sfx}-${index}`,
        youtube_id: `S${sfx}${index}`.replace(/[^A-Za-z0-9_-]/g, 'a').slice(0, 11).padEnd(11, 'a'),
        title: `Stored talk ${index + 1}`,
        course: SHEET_COURSE,
        speaker: 'Abdul Malik Merchant',
        duration: 400,
      })),
    ]
    const bad = { talk_key: `store-bad-${sfx}`, youtube_id: 'https://vimeo.com/1', title: 'This row should stay out', course: SHEET_COURSE, speaker: 'Abdul Malik Merchant' }
    const resources = [
      { talk_key: talks[0].talk_key, label: 'Captions', kind: 'transcript', media_id: media.boys },
      { talk_key: talks[1].talk_key, label: 'Captions', kind: 'transcript', media_id: media.speech },
      { talk_key: talks[2].talk_key, label: 'Captions', kind: 'transcript', media_id: media.auto },
    ]
    const buffer = Buffer.from(await buildWorkbook({ talks: [...talks, bad], resources }))
    const file = path.join(ARTIFACTS, 'storage-bring-in.xlsx')
    writeFileSync(file, buffer)

    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/sheet')
    await page.getByTestId('sheet-file').setInputFiles(file)
    await page.getByTestId('sheet-preview-submit').click()
    await expect(page.getByTestId('sheet-errors')).toBeVisible()
    await expect(page.getByTestId('sheet-partial')).toBeVisible()
    await expect(page.getByTestId('sheet-error-row')).toContainText(/vimeo|YouTube id/i)
    const toAdd = Number(await page.getByTestId('sheet-count-create').innerText())
    expect(toAdd).toBeGreaterThanOrEqual(10)
    await shot(page, '06-sheet-preview')
    const packs = await (await master.get('/api/packs?where[title][equals]=Jibril%20sittings&limit=1&depth=0')).json()
    const packId = String(packs.docs?.[0]?.id || '')
    expect(packId).toBeTruthy()
    await page.getByTestId('sheet-new-courses-pack').selectOption(packId)
    await page.getByTestId('sheet-apply').click()
    await expect(page.getByTestId('notice')).toContainText(/left out/i)
    await shot(page, '07-sheet-applied')

    const course = await courseByTitle(master, SHEET_COURSE)
    expect(course?.id).toBeTruthy()
    const first = await lessonsFor(master, course!.id)
    expect(first.length).toBe(10)
    expect(first.some((row) => /stay out/i.test(row.title || ''))).toBeFalsy()
    const boys = first.find((row) => row.youtubeId === 'fr7L491rCLI')
    const speech = first.find((row) => row.youtubeId === 'AmjadTars01')
    const auto = first.find((row) => row.youtubeId === 'SheetAuto01')
    expect(boys?.transcript || '').toMatch(/Big salams/)
    expect(speech?.transcript || '').toMatch(/Muslim Central/)
    expect(auto?.transcript || '').toMatch(/\[0:00:/)
    expect(boys?.speaker).toBe('Abdul Malik Merchant')
    report.sheetLessons = first.length
    report.sheetTranscripts = { boys: (boys?.transcript || '').length, speech: (speech?.transcript || '').length, auto: (auto?.transcript || '').length }
    report.sheetCourseId = course!.id
    report.sheetLessonId = boys!.id
    saveReport()

    await page.goto('/master/sheet')
    await page.getByTestId('sheet-file').setInputFiles(file)
    await page.getByTestId('sheet-preview-submit').click()
    await expect(page.getByTestId('sheet-count-create')).toHaveText('0')
    await shot(page, '08-sheet-rerun-preview')
    if (await page.getByTestId('sheet-apply').count()) await page.getByTestId('sheet-apply').click()
    const second = await lessonsFor(master, course!.id)
    expect(second.length).toBe(first.length)
    const boysAgain = second.find((row) => row.youtubeId === 'fr7L491rCLI')
    expect(boysAgain?.transcript || '').toMatch(/Big salams/)
    report.sheetRerunLessons = second.length
    saveReport()
    await master.dispose()
  })

  test('re-running the extractor keeps a clip that was approved', async ({ page }) => {
    test.setTimeout(180_000)
    page.setDefaultNavigationTimeout(120_000)
    await page.setViewportSize(DESK)
    const saved = JSON.parse(readFileSync(path.join(ARTIFACTS, 'report.json'), 'utf8')) as { sheetCourseId?: number; sheetLessonId?: number }
    expect(saved.sheetLessonId, 'the sheet talk is there').toBeTruthy()
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/library/${saved.sheetCourseId}?part=${saved.sheetLessonId}`)
    await expect(page.getByTestId('paid-ai-tick')).not.toBeChecked()
    await expect(page.getByTestId('paid-ai-cost')).toBeVisible()
    await shot(page, '09-extractor-opt-in')
    await page.getByTestId('extract-submit').click()
    await expect(page.getByTestId('cut-draft').first()).toBeVisible()
    const before = await page.getByTestId('cut-draft').count()
    expect(before).toBeGreaterThan(0)
    const approvedId = await page.getByTestId('cut-draft').first().getAttribute('data-cut')
    await page.getByTestId('approve-cut').first().click()
    await expect(page.locator(`[data-testid="cut-draft"][data-cut="${approvedId}"]`)).toHaveAttribute('data-status', 'approved')
    await shot(page, '10-clip-approved')
    await page.getByTestId('extract-submit').click()
    await expect(page.getByTestId('notice')).toContainText(/approved clip/)
    await expect(page.locator(`[data-testid="cut-draft"][data-cut="${approvedId}"]`)).toHaveAttribute('data-status', 'approved')
    report.approvedCut = approvedId
    report.cutsBefore = before
    report.cutsAfter = await page.getByTestId('cut-draft').count()
    saveReport()
    await shot(page, '11-extractor-rerun')

    await page.goto('/master/ai')
    await expect(page.getByTestId('ai-mock-mode').or(page.getByTestId('ai-paid-off'))).toBeVisible()
    await shot(page, '12-ai-desk')
  })

  test('a new joiner holding the pack can open a brought-in talk and read its transcript', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(PHONE)
    const saved = JSON.parse(readFileSync(path.join(ARTIFACTS, 'report.json'), 'utf8')) as { sheetCourseId?: number; sheetLessonId?: number }
    const code = seedCode('elm-learner')
    const email = `joiner-${sfx}@hearts.test`
    await page.goto(`/join?code=${encodeURIComponent(code)}`)
    await page.getByTestId('join-name').fill('New Joiner')
    await page.getByTestId('join-email').fill(email)
    await page.getByTestId('join-password').fill('hearts-join')
    await page.getByTestId('join-submit').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/join'))
    await page.goto(`/p/east-london/course/${saved.sheetCourseId}?part=${saved.sheetLessonId}&context=1`)
    await expect(page.getByTestId('player')).toBeVisible()
    await expect(page.getByTestId('context-transcript')).toBeVisible()
    await expect(page.getByTestId('context-line').or(page.getByTestId('context-transcript'))).toContainText(/Big salams|0:00/)
    await shot(page, '13-learner-transcript')
    const play = page.getByTestId('player-play')
    if (await play.count()) await play.click()
    await page.waitForTimeout(2000)
    report.learnerPlaying = await page.getByTestId('player').getAttribute('data-playing')
    report.learnerMode = await page.getByTestId('player').getAttribute('data-mode')
    saveReport()
    await shot(page, '14-learner-play')
  })
})

mkdirSync(ARTIFACTS, { recursive: true })
