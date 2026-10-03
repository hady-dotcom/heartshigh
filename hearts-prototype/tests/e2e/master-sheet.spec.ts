import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { buildWorkbook, QUESTION_COLUMNS, TALK_COLUMNS } from '../../src/lib/master-sheet'

const DESK = { width: 1440, height: 900 }
const ARTIFACTS = '/opt/cursor/artifacts'
const sfx = Date.now().toString().slice(-6)

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function workbookBuffer(sheets: { talks?: Record<string, string | number | null>[]; questions?: Record<string, string | number | null>[]; resources?: Record<string, string | number | null>[] }) {
  return buildWorkbook(sheets)
}

async function postSheet(ctx: APIRequestContext, buffer: Buffer, fields: Record<string, string>) {
  const response = await ctx.post('/api/hearts/sheet', {
    multipart: {
      ...fields,
      response: 'json',
      file: {
        name: 'hearts-sheet.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
      },
    },
  })
  return { response, body: await json(response) }
}

async function undo(ctx: APIRequestContext, fields: Record<string, string>) {
  const response = await ctx.post('/api/hearts/sheet', { multipart: { intent: 'undo', response: 'json', ...fields } })
  return { response, body: await json(response) }
}

function columnsOf(body: { errors?: { tab: string; column: string; message: string }[] }) {
  return new Set((body.errors || []).map((issue) => `${issue.tab}:${issue.column}`))
}

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  mkdirSync(ARTIFACTS, { recursive: true })
})

test.afterAll(async () => {
  await master?.dispose()
})

test('template downloads as xlsx and the seeded library round-trips with no changes', async () => {
  const template = await master.get('/api/hearts/sheet?kind=template')
  expect(template.ok()).toBeTruthy()
  expect(template.headers()['content-type']).toContain('spreadsheetml')
  const templateBytes = Buffer.from(await template.body())
  expect(templateBytes[0]).toBe(0x50)
  const templateBook = new ExcelJS.Workbook()
  await templateBook.xlsx.load(templateBytes as unknown as ExcelJS.Buffer)
  expect(templateBook.worksheets.map((sheet) => sheet.name)).toEqual(['Talks', 'Questions', 'Resources', 'CircleAnswers'])
  expect(templateBook.getWorksheet('Talks')?.getRow(2).values).toEqual(expect.arrayContaining([...TALK_COLUMNS]))

  const exported = await master.get('/api/hearts/sheet?kind=export&scope=library&desk=master')
  expect(exported.ok()).toBeTruthy()
  const bytes = Buffer.from(await exported.body())
  writeFileSync(path.join(ARTIFACTS, 'hearts-master-sheet-example.xlsx'), bytes)
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(bytes as unknown as ExcelJS.Buffer)
  const talkRows = book.getWorksheet('Talks')!.rowCount - 2
  expect(talkRows).toBeGreaterThan(5)

  const preview = await postSheet(master, bytes, { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.response.ok(), JSON.stringify(preview.body.errors?.slice(0, 6))).toBeTruthy()
  expect(preview.body.counts).toMatchObject({ create: 0, update: 0, delete: 0, errors: 0 })
  expect(preview.body.errors).toEqual([])
})

test('a dry run names every bad cell and does not save the rows', async () => {
  const lesson = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0&limit=1'))).docs[0] as { id: number }
  const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${lesson.id}&limit=1&depth=0`))).docs[0] as { id: number }
  expect(point?.id).toBeTruthy()
  const before = (await json(await master.get('/api/lessons?limit=1'))).totalDocs as number
  const buffer = await workbookBuffer({
    talks: [
      { talk_key: 'yt-NIR88RRpat4', youtube_id: 'https://vimeo.com/1' },
      { talk_key: 'yt-NIR88RRpat4', hook_text: 'Take the quiz on this line now' },
      { talk_key: 'sheet-new-bad', youtube_id: 'SheetBad001', title: 'A bad new sitting', course: 'Sheet dry run', hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: 'Take the quiz with the group', turn_text: 'Take the quiz with the group', land_text: 'Take the quiz with the group' },
    ],
    questions: [
      { talk_key: 'yt-NIR88RRpat4', question_id: 999999, text: 'No such question exists on this talk' },
      { talk_key: 'yt-NIR88RRpat4', question_id: point.id, text: 'Take the quiz with me on this line' },
      { talk_key: 'yt-NIR88RRpat4', question_id: point.id, text: 'A second copy of the same question id here' },
      { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 99999, text: 'This time is far past the end of the film', source: 'human', status: 'draft' },
      { talk_key: 'missing-talk-key', type: 'puzzle', time: 10, text: 'There is no talk for this question' },
    ],
    resources: [
      { talk_key: 'yt-NIR88RRpat4', label: 'Notes', url: 'http://example.com/notes', kind: 'link' },
      { talk_key: 'yt-NIR88RRpat4', label: 'Odd', url: 'https://example.com/notes', kind: 'slide' },
    ],
  })
  const preview = await postSheet(master, bytesSafe(buffer), { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.response.ok()).toBeTruthy()
  const columns = columnsOf(preview.body)
  for (const expected of ['Talks:youtube_id', 'Talks:hook_text', 'Questions:question_id', 'Questions:time', 'Questions:type', 'Questions:text', 'Questions:talk_key', 'Resources:url', 'Resources:kind']) {
    expect(columns.has(expected), `missing ${expected} in ${[...columns].join(', ')}`).toBeTruthy()
  }
  expect((preview.body.errors as { message: string }[]).some((issue) => /quiz/.test(issue.message))).toBeTruthy()
  expect((preview.body.errors as { message: string }[]).some((issue) => /after the end/.test(issue.message))).toBeTruthy()
  const apply = await postSheet(master, bytesSafe(buffer), { intent: 'apply', scope: 'library', desk: 'master' })
  expect(apply.response.status()).toBe(422)
  expect((await json(await master.get('/api/lessons?limit=1'))).totalDocs).toBe(before)
})

test('applying an ai draft keeps it off the learner page until a person approves it, and undo puts the import back', async () => {
  const lesson = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0&limit=1'))).docs[0] as { id: number; course: number; durationSeconds?: number }
  const prompt = `What line from this sitting would you keep for the week ahead ${sfx}`
  const approved = `What line from this sitting would you tell a friend ${sfx}`
  const buffer = await workbookBuffer({
    questions: [{ talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 12, text: prompt, source: 'ai', status: 'draft' }],
  })
  const preview = await postSheet(master, bytesSafe(buffer), { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.body.counts.create, JSON.stringify(preview.body.errors)).toBe(1)
  expect(preview.body.errors).toEqual([])
  const applied = await postSheet(master, bytesSafe(buffer), { intent: 'apply', scope: 'library', desk: 'master', import: String(preview.body.importId) })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()
  const created = (await json(await master.get(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`))).docs[0] as { id: number; status: string; draftNote?: string }
  expect(created.status).toBe('draft')
  expect(created.draftNote || '').toMatch(/machine|Draft/)

  const flags = await json(await master.get('/api/globals/master-flags'))
  await master.post('/api/globals/master-flags', { data: { showUnchecked: false } })
  try {
    const learner = await as('elm-learner@hearts.test', 'portal-learner')
    const hidden = await learner.get(`/p/east-london/course/${lesson.course}?part=${lesson.id}`)
    expect(hidden.ok()).toBeTruthy()
    expect(await hidden.text()).not.toContain(prompt)
    await learner.dispose()
  } finally {
    await master.post('/api/globals/master-flags', { data: { showUnchecked: flags.showUnchecked !== false } })
  }

  const audit = (await json(await master.get('/api/audit-log?where[event][equals]=sheet.import&sort=-createdAt&limit=1'))).docs[0]
  expect(audit?.event).toBe('sheet.import')

  const edited = await workbookBuffer({
    questions: [{ talk_key: 'yt-NIR88RRpat4', question_id: created.id, text: approved, source: 'ai', status: 'approved' }],
  })
  const again = await postSheet(master, bytesSafe(edited), { intent: 'preview', scope: 'library', desk: 'master' })
  expect(again.body.counts.update, JSON.stringify(again.body.errors)).toBe(1)
  const published = await postSheet(master, bytesSafe(edited), { intent: 'apply', scope: 'library', desk: 'master', import: String(again.body.importId) })
  expect(published.response.ok(), JSON.stringify(published.body)).toBeTruthy()
  const after = (await json(await master.get(`/api/engagement-points/${created.id}?depth=0`))) as { status: string }
  expect(after.status).toBe('published')

  const learnerAgain = await as('elm-learner@hearts.test', 'portal-learner')
  const shown = await learnerAgain.get(`/p/east-london/course/${lesson.course}?part=${lesson.id}`)
  expect(shown.ok()).toBeTruthy()
  expect(await shown.text()).toContain(approved)
  await learnerAgain.dispose()

  const firstUndo = await undo(master, { scope: 'library', desk: 'master' })
  expect(firstUndo.response.ok(), JSON.stringify(firstUndo.body)).toBeTruthy()
  expect(((await json(await master.get(`/api/engagement-points/${created.id}?depth=0`))) as { status: string }).status).toBe('draft')
  const secondUndo = await undo(master, { scope: 'library', desk: 'master' })
  expect(secondUndo.response.ok(), JSON.stringify(secondUndo.body)).toBeTruthy()
  expect((await master.get(`/api/engagement-points/${created.id}?depth=0`)).status()).toBe(404)
  const undone = (await json(await master.get('/api/audit-log?where[event][equals]=sheet.undo&sort=-createdAt&limit=1'))).docs[0]
  expect(undone?.event).toBe('sheet.undo')
})

test('a portal admin can only import into courses made in their own portal', async () => {
  const admin = await as('elm-admin@hearts.test', 'portal-admin')
  const library = await postSheet(admin, await workbookBuffer({ talks: [{ talk_key: 'nope', title: 'Nope', course: 'Nope', youtube_id: 'PortalNope1' }] }), { intent: 'preview', scope: 'library', desk: 'portal' })
  expect(library.response.status()).toBe(403)

  const stolen = await postSheet(admin, await workbookBuffer({ talks: [{ talk_key: 'yt-NIR88RRpat4', title: 'Stolen title' }] }), { intent: 'preview', scope: 'portal', desk: 'portal', portal: 'east-london' })
  expect(stolen.response.ok()).toBeTruthy()
  expect((stolen.body.errors as { message: string }[]).some((issue) => /outside/i.test(issue.message))).toBeTruthy()
  expect(stolen.body.counts.create).toBe(0)

  const names = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=1&limit=1'))).docs[0] as { course?: { title?: string } | number }
  const masterTitle = typeof names.course === 'object' && names.course ? names.course.title : ''
  expect(masterTitle).toBeTruthy()
  const masterCourse = await postSheet(admin, await workbookBuffer({
    talks: [{ talk_key: 'elm-sheet-master', youtube_id: 'ElmMaster01', title: 'Not our course', course: masterTitle || '', speaker: 'Amina Yusuf', hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: 'A local line for this portal', turn_text: 'A local line for this portal', land_text: 'A local line for this portal' }],
  }), { intent: 'preview', scope: 'portal', desk: 'portal', portal: 'east-london' })
  expect((masterCourse.body.errors as { message: string }[]).some((issue) => /master library/i.test(issue.message)), JSON.stringify(masterCourse.body.errors)).toBeTruthy()

  const ownId = `E${sfx}xxxxx`.slice(0, 11)
  const own = await workbookBuffer({
    talks: [{ talk_key: `yt-${ownId}`, youtube_id: ownId, title: `Circle note ${sfx}`, course: 'East London circle notes', speaker: 'Amina Yusuf', part: 'Notes', hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: 'A local line for this portal', turn_text: 'A local line for this portal', land_text: 'A local line for this portal', status: 'draft' }],
  })
  const preview = await postSheet(admin, bytesSafe(own), { intent: 'preview', scope: 'portal', desk: 'portal', portal: 'east-london' })
  expect(preview.body.counts.create, JSON.stringify(preview.body.errors)).toBe(1)
  const applied = await postSheet(admin, bytesSafe(own), { intent: 'apply', scope: 'portal', desk: 'portal', portal: 'east-london', import: String(preview.body.importId) })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()
  const lesson = (await json(await master.get(`/api/lessons?where[title][equals]=${encodeURIComponent(`Circle note ${sfx}`)}&depth=0`))).docs[0] as { id: number; portal: number }
  expect(lesson?.id).toBeTruthy()
  const removed = await undo(admin, { scope: 'portal', desk: 'portal', portal: 'east-london' })
  expect(removed.response.ok(), JSON.stringify(removed.body)).toBeTruthy()
  expect((await master.get(`/api/lessons/${lesson.id}?depth=0`)).status()).toBe(404)
  await admin.dispose()
})

test('five hundred rows are previewed through the import route', async () => {
  const talks = Array.from({ length: 500 }, (_, index) => ({
    talk_key: `bulk-${sfx}-${index}`,
    youtube_id: `c${index.toString(36).padStart(10, '0')}`.slice(0, 11),
    title: `Bulk talk ${index}`,
    course: `Bulk ${sfx}`,
    hors_in: 0,
    hors_out: 16,
    app_in: 0,
    app_out: 40,
    hook_text: `Line ${index} from the speaker`,
    turn_text: `Line ${index} from the speaker`,
    land_text: `Line ${index} from the speaker`,
    status: 'draft',
  }))
  const started = Date.now()
  const preview = await postSheet(master, bytesSafe(await workbookBuffer({ talks })), { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.response.ok(), JSON.stringify(preview.body.errors?.slice(0, 3))).toBeTruthy()
  expect(preview.body.counts.create).toBe(500)
  expect(preview.body.errors).toEqual([])
  expect(Date.now() - started).toBeLessThan(20000)
})

test('the desk shows the error preview, the applied import and the export', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/sheet')
  await expect(page.getByTestId('master-sheet')).toBeVisible()
  await expect(page.getByTestId('sheet-export')).toBeVisible()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('sheet-export-submit').click(),
  ])
  expect(download.suggestedFilename()).toContain('.xlsx')
  await page.screenshot({ path: path.join(ARTIFACTS, 'sheet-export.png'), fullPage: true })

  const bad = path.join('/tmp', `hearts-sheet-bad-${sfx}.xlsx`)
  writeFileSync(bad, bytesSafe(await workbookBuffer({
    talks: [{ talk_key: 'yt-NIR88RRpat4', hook_text: 'Take the quiz on this line now' }],
    questions: [{ talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 99999, text: 'This time is far past the end of the film', source: 'human', status: 'draft' }],
    resources: [{ talk_key: 'yt-NIR88RRpat4', label: 'Notes', url: 'http://example.com/notes', kind: 'link' }],
  })))
  await page.getByTestId('sheet-file').setInputFiles(bad)
  await page.getByTestId('sheet-preview-submit').click()
  await expect(page.getByTestId('sheet-errors')).toBeVisible()
  await expect(page.getByTestId('sheet-blocked')).toBeVisible()
  await expect(page.getByTestId('sheet-apply')).toHaveCount(0)
  await page.screenshot({ path: path.join(ARTIFACTS, 'sheet-preview-errors.png'), fullPage: true })

  const prompt = `What would you carry home from this sitting ${sfx}`
  const good = path.join('/tmp', `hearts-sheet-good-${sfx}.xlsx`)
  writeFileSync(good, bytesSafe(await workbookBuffer({
    questions: [{ talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 12, text: prompt, source: 'ai', status: 'draft' }],
  })))
  await page.goto('/master/sheet')
  await page.getByTestId('sheet-file').setInputFiles(good)
  await page.getByTestId('sheet-preview-submit').click()
  await expect(page.getByTestId('sheet-apply')).toBeVisible()
  await page.getByTestId('sheet-apply').click()
  await expect(page.getByTestId('notice')).toContainText('Imported')
  await expect(page.getByTestId('sheet-undo')).toBeVisible()
  await page.screenshot({ path: path.join(ARTIFACTS, 'sheet-applied.png'), fullPage: true })
  await page.getByTestId('sheet-undo').click()
  await expect(page.getByTestId('notice')).toContainText('undone')
  expect((await master.get(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`)).ok()).toBeTruthy()
  const left = (await json(await master.get(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`))).docs as unknown[]
  expect(left).toEqual([])
})

function bytesSafe(buffer: Buffer) {
  return Buffer.from(buffer)
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

void QUESTION_COLUMNS
