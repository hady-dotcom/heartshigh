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
  { id: 'B4KtRL_2aXY', label: 'short', url: 'https://www.youtube.com/watch?v=B4KtRL_2aXY', speaker: '', clock: 428 },
  { id: 'UUTnGXyCHZI', label: 'hour', url: 'https://www.youtube.com/watch?v=UUTnGXyCHZI', speaker: '', clock: 3898 },
  { id: 'gEqJgd0zB8Q', label: 'hani', url: 'https://www.youtube.com/watch?v=gEqJgd0zB8Q', speaker: 'Hani', clock: 1498 },
  { id: 'kM7LVppIMl0', label: 'none', url: 'https://www.youtube.com/watch?v=kM7LVppIMl0', speaker: '', clock: 0 },
  { id: 'notarealvid', label: 'broken', url: 'https://www.youtube.com/watch?v=notarealvid', speaker: '', clock: 0 },
]
const FIXTURES = path.join(process.cwd(), 'tests/fixtures/transcripts')
const SAMPLES = {
  boys: path.join(FIXTURES, 'from-box-timed.txt'),
  speech: path.join(FIXTURES, 'speech-timed.txt'),
  auto: path.join(FIXTURES, 'youtube-auto-timed.txt'),
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
    await expect(page.getByTestId('youtube-url')).toHaveValue('')
    await expect(page.getByTestId('fetch-transcript')).toBeChecked()
    await expect(page.getByTestId('caption-lang')).toHaveValue('en')
    await page.getByTestId('youtube-url').fill(LINKS.map((row) => (row.speaker ? `${row.url} | ${row.speaker}` : row.url)).join('\n'))
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
      expect(lesson!.speaker).toBe(link.speaker || SPEAKER)
      expect(lesson!.speaker).not.toMatch(/MCA|Yaqeen|Muslim Community|channel/i)
      if (link.label === 'broken') {
        expect(lesson!.transcriptNote || '').toMatch(/^Bring-in: failed\./)
      } else {
        expect(lesson!.transcriptNote || '').toMatch(/^Bring-in: (processed|waiting)\./)
        if ((lesson!.transcriptNote || '').includes('waiting')) expect(lesson!.transcriptNote || '').not.toMatch(/no English captions/)
      }
      if (link.clock && lesson!.durationSeconds) expect(lesson!.durationSeconds).toBe(link.clock)
    }
    const broken = lessons.find((row) => row.youtubeId === 'notarealvid')
    expect(broken!.transcriptNote || '').toMatch(/does not exist or is private/)
    expect((broken!.transcript || '').length).toBe(0)
    report.youtubeCourseId = course!.id

    const failed = lessons.filter((row) => (row.transcriptNote || '').startsWith('Bring-in: failed') && row.youtubeId)
    expect(failed.length).toBeGreaterThan(0)
    await page.goto(`/master/library/${course!.id}?part=${failed[0].id}`)
    await expect(page.getByTestId('bring-in-status')).toHaveAttribute('data-status', 'failed')
    await expect(page.getByTestId('bring-in-retry')).toBeVisible()
    await shot(page, '04-youtube-failed-retry')
    await expect(page.locator('form input[name="captionLang"]')).toHaveValue('en')
    await page.getByTestId('bring-in-retry').click()
    await expect(page.getByTestId('bring-in-status')).toBeVisible()
    await shot(page, '05-youtube-retry')

    const keptId = lessons.find((row) => row.youtubeId === 'B4KtRL_2aXY')!
    await page.goto(`/master/library/${course!.id}?part=${keptId.id}`)
    await expect(page.getByTestId('youtube-url')).toHaveValue('')
    await page.getByTestId('youtube-url').fill('https://www.youtube.com/watch?v=yl7DBZGnhNo')
    await expect(page.getByTestId('replace-film')).not.toBeChecked()
    await page.getByTestId('ingest-submit').click()
    await expect(page.getByTestId('notice').or(page.getByTestId('error'))).toBeVisible()
    const afterAdd = await lessonsFor(master, course!.id)
    expect(afterAdd.find((row) => row.id === keptId.id)?.youtubeId).toBe('B4KtRL_2aXY')
    expect(afterAdd.some((row) => row.youtubeId === 'yl7DBZGnhNo')).toBeTruthy()
    await shot(page, '05b-added-not-replaced')

    await page.getByTestId('caption-lang').selectOption('fr')
    await page.getByTestId('youtube-url').fill('not a link at all')
    await page.getByTestId('ingest-submit').click()
    await expect(page.getByTestId('notice').or(page.getByTestId('error'))).toBeVisible()
    const withJunk = await lessonsFor(master, course!.id)
    const junk = withJunk.find((row) => (row.transcriptNote || '').includes('not a web link'))
    expect(junk, 'the junk line is a failed desk row').toBeTruthy()
    await page.goto(`/master/library/${course!.id}?part=${junk!.id}`)
    await expect(page.getByTestId('bring-in-status')).toHaveAttribute('data-status', 'failed')
    await expect(page.getByTestId('caption-lang')).toHaveValue('fr')
    await expect(page.locator('form input[name="captionLang"]')).toHaveValue('fr')
    report.youtubeLessons = withJunk.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      speaker: lesson.speaker,
      youtubeId: lesson.youtubeId,
      durationSeconds: lesson.durationSeconds || 0,
      note: lesson.transcriptNote,
      transcriptChars: (lesson.transcript || '').length,
    }))
    saveReport()

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
    expect(report.cutsAfter).toBe(before)
    const sameSpan = await page.locator(`[data-testid="cut-draft"][data-cut="${approvedId}"]`).count()
    expect(sameSpan).toBe(1)
    saveReport()
    await shot(page, '11-extractor-rerun')

    const master = await masterApi()
    const auto = (await lessonsFor(master, saved.sheetCourseId!)).find((row) => row.youtubeId === 'SheetAuto01')
    expect(auto?.id).toBeTruthy()
    await page.goto(`/master/library/${saved.sheetCourseId}?part=${auto!.id}`)
    await page.getByTestId('extract-submit').click()
    await expect(page.getByTestId('notice')).toContainText(/no full stops/i)
    await shot(page, '11b-no-full-stops')
    await master.dispose()

    await page.goto('/master/transcripts')
    const sample = path.join(ARTIFACTS, 'desk-transcript.txt')
    writeFileSync(sample, '[0:00:00] A line from the talk.\n[0:00:04] The next line.\n')
    await page.getByTestId('sheet-transcript-file').setInputFiles(sample)
    await page.getByTestId('sheet-transcript-upload').click()
    await expect(page.getByTestId('notice')).toContainText(/media/i)
    await shot(page, '11c-transcript-desk')

    await page.goto('/master/ai')
    await expect(page.getByTestId('ai-mock-mode').or(page.getByTestId('ai-paid-off'))).toBeVisible()
    await shot(page, '12-ai-desk')
  })

  test('a new joiner holding the pack can open a brought-in talk and read its transcript', async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(PHONE)
    const saved = JSON.parse(readFileSync(path.join(ARTIFACTS, 'report.json'), 'utf8')) as { sheetCourseId?: number; sheetLessonId?: number; youtubeCourseId?: number }
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
    await expect(page.getByTestId('context-line')).toContainText('Big salams')
    await shot(page, '13-learner-transcript')
    const play = page.getByTestId('player-play')
    if (await play.count()) await play.click()
    await page.waitForTimeout(2000)
    report.learnerPlaying = await page.getByTestId('player').getAttribute('data-playing')
    report.learnerMode = await page.getByTestId('player').getAttribute('data-mode')
    saveReport()
    await shot(page, '14-learner-play')

    if (saved.youtubeCourseId) {
      await page.goto(`/p/east-london/course/${saved.youtubeCourseId}`)
      const body = await page.locator('body').innerText()
      expect(body).not.toMatch(/not a link at all/i)
      expect(body).not.toMatch(/notarealvid/)
      await shot(page, '15-learner-no-failed-parts')
    }
  })

  test('two identical bring-ins at once do not double the films', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(DESK)
    const title = `Concurrent films ${sfx}`
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
    await page.getByTestId('master-course-title').fill(title)
    await page.getByLabel('Speaker').fill('Hani')
    await page.getByRole('button', { name: 'Add to the library' }).click()
    await page.getByRole('link', { name: title }).click()
    const lesson = await page.locator('input[name="lesson"]').first().inputValue()
    const courseId = page.url().match(/library\/(\d+)/)?.[1]
    expect(lesson).toBeTruthy()
    const stamp = sfx.replace(/\W/g, '').slice(-6).padEnd(6, 'x')
    const url = `https://www.youtube.com/watch?v=Ca${stamp}111\nhttps://www.youtube.com/watch?v=Cb${stamp}222`
    const form = { action: 'ingest', lesson: lesson!, next: `/master/library/${courseId}`, url, fetchTranscript: 'yes', captionLang: 'en' }
    await Promise.all([
      page.request.post('/api/hearts', { form, maxRedirects: 0 }),
      page.request.post('/api/hearts', { form, maxRedirects: 0 }),
    ])
    const master = await masterApi()
    const course = await courseByTitle(master, title)
    const lessons = await lessonsFor(master, course!.id)
    const ids = lessons.map((row) => row.youtubeId).filter(Boolean)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.filter((id) => id === `Ca${stamp}111`).length).toBe(1)
    expect(ids.filter((id) => id === `Cb${stamp}222`).length).toBe(1)
    report.concurrentLessons = lessons.length
    saveReport()
    await master.dispose()
  })

  test('two identical sheet applies at once do not double the course', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/sheet')
    const title = `Concurrent sheet ${sfx}`
    const buffer = Buffer.from(await buildWorkbook({
      talks: [
        { talk_key: `con-${sfx}-a`, youtube_id: 'ConcurA0001', title: 'Concurrent A', course: title, speaker: 'Hani', duration: 400 },
        { talk_key: `con-${sfx}-b`, youtube_id: 'ConcurB0001', title: 'Concurrent B', course: title, speaker: 'Hani', duration: 400 },
      ],
    }))
    const file = path.join(ARTIFACTS, 'concurrent.xlsx')
    writeFileSync(file, buffer)
    const responses = await Promise.all([1, 2].map(() => page.request.post('/api/hearts/sheet', {
      multipart: {
        intent: 'apply',
        response: 'json',
        scope: 'library',
        next: '/master/sheet',
        file: { name: 'concurrent.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer },
      },
      headers: { accept: 'application/json' },
    })))
    for (const response of responses) expect(response.ok(), await response.text()).toBeTruthy()
    const master = await masterApi()
    const found = await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(title)}&limit=10&depth=0`)).json()
    expect(found.docs.length).toBe(1)
    const lessons = await lessonsFor(master, found.docs[0].id)
    expect(lessons.length).toBe(2)
    report.concurrentCourses = found.docs.length
    saveReport()
    await shot(page, '16-concurrent-sheet')
    await master.dispose()
  })
})

mkdirSync(ARTIFACTS, { recursive: true })
