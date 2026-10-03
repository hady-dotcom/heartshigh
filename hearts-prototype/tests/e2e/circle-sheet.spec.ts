import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import path from 'node:path'
import { E2E_BASE } from '../env'
import { buildWorkbook } from '../../src/lib/master-sheet'

// The CircleAnswers tab of the master sheet: circle answers come in and go out with the talks and questions,
// and are never counted as answers, completions or done tasks.

const PORTAL = 'east-london'
const ARTIFACTS = '/opt/cursor/artifacts'
const sfx = Date.now().toString().slice(-6)

type Row = Record<string, any> & { id: number }
type Sheets = Parameters<typeof buildWorkbook>[0]

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}
const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>
const docs = async (query: string) => (await json(await master.get(query))).docs as Row[]
const total = async (collection: string) => Number((await json(await master.get(`/api/${collection}?limit=1&depth=0`))).totalDocs)

async function sheet(ctx: APIRequestContext, sheets: Sheets, fields: Record<string, string>) {
  const buffer = Buffer.from(await buildWorkbook(sheets))
  const file = { name: `circle-${sfx}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer }
  const preview = await ctx.post('/api/hearts/sheet', { multipart: { ...fields, intent: 'preview', response: 'json', file } })
  const body = await json(preview)
  expect(preview.ok(), JSON.stringify(body)).toBeTruthy()
  return body
}

async function apply(ctx: APIRequestContext, previewed: Record<string, any>, fields: Record<string, string>) {
  expect(previewed.errors, JSON.stringify(previewed.errors)).toEqual([])
  const response = await ctx.post('/api/hearts/sheet', { multipart: { ...fields, intent: 'apply', response: 'json', import: String(previewed.importId) } })
  const body = await json(response)
  expect(response.ok(), JSON.stringify(body)).toBeTruthy()
  return body
}

async function undo(ctx: APIRequestContext, fields: Record<string, string>) {
  const response = await ctx.post('/api/hearts/sheet', { multipart: { ...fields, intent: 'undo', response: 'json' } })
  expect(response.ok(), JSON.stringify(await json(response))).toBeTruthy()
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const LIBRARY = { scope: 'library', desk: 'master' }

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})
test.afterAll(async () => {
  await master?.dispose()
})

test('the export carries a CircleAnswers tab, and circle answers on an activation task never count as answers or done tasks', async ({ page }) => {
  const nur = (await docs('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0&limit=1'))[0]
  const task = (await docs(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=task&depth=0&limit=1`))[0]
  expect(task?.id, 'the seed has an activation task on Al-Nur').toBeTruthy()
  const existing = await docs(`/api/circle-answers?where[point][equals]=${task.id}&depth=0&limit=100`)
  expect(existing.length).toBeGreaterThan(0)

  const exported = await master.get('/api/hearts/sheet?kind=export&scope=library&desk=master')
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(Buffer.from(await exported.body()) as unknown as ExcelJS.Buffer)
  const tab = book.getWorksheet('CircleAnswers')!
  expect(tab, 'the export has a CircleAnswers tab').toBeTruthy()
  const ids: number[] = []
  tab.eachRow((row, number) => {
    if (number > 2) ids.push(Number(row.getCell(4).value))
  })
  for (const answer of existing) expect(ids).toContain(answer.id)

  const answers = await total('answers')
  const completions = await total('completions')
  const learner = await as('elm-learner@hearts.test', 'portal-learner')
  const mine = (await docs('/api/users?where[email][equals]=elm-learner@hearts.test&depth=0'))[0].id
  const myAnswers = await total(`answers?where[user][equals]=${mine}`)

  const body = `Did it with my brother after Maghrib ${sfx}, which made it easier.`
  const previewed = await sheet(master, {
    circle: [
      ...existing.map((answer) => ({ question_id: task.id, circle_id: answer.id, name: answer.name, body: answer.body, enabled: 'no' })),
      { talk_key: 'yt-NIR88RRpat4', question_id: task.id, name: 'Bilal', body, tone: 'practical', length: 'short', origin: 'staff' },
    ],
  }, LIBRARY)
  expect(previewed.counts).toMatchObject({ create: 1, update: existing.filter((answer) => answer.enabled !== false).length, delete: 0, errors: 0 })
  expect((previewed.changes as Row[]).every((change) => change.tab === 'CircleAnswers')).toBeTruthy()
  await apply(master, previewed, LIBRARY)

  const added = (await docs(`/api/circle-answers?where[point][equals]=${task.id}&where[body][equals]=${encodeURIComponent(body)}&depth=0`))[0]
  expect(added).toMatchObject({ name: 'Bilal', origin: 'staff', enabled: true, lesson: nur.id })
  expect(added.portal ?? null).toBeNull()
  expect(await total('answers'), 'circle answers are not answers').toBe(answers)
  expect(await total('completions'), 'circle answers complete nothing').toBe(completions)
  expect(await total(`answers?where[user][equals]=${mine}`)).toBe(myAnswers)

  const share = (value: string) => learner.post('/api/hearts', { form: { action: 'me-pref', name: 'shareWithLearners', value, next: '/' }, maxRedirects: 0 })
  await share('on')
  const html = await (await learner.get(`/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)).text()
  expect(html, 'the task shows the circle answer in its swarm').toContain(`after Maghrib ${sfx}`)
  for (const answer of existing) expect(html, 'switched-off circle answers stay out of the swarm').not.toContain(String(answer.body))
  await share('off')
  await learner.dispose()

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/sheet')
  await expect(page.getByTestId('sheet-circle-count')).toContainText('Circle answers')
  await page.screenshot({ path: path.join(ARTIFACTS, 'sheet-circle-count.png'), fullPage: false })

  await undo(master, LIBRARY)
  expect(await docs(`/api/circle-answers?where[id][equals]=${added.id}&depth=0`)).toEqual([])
  const restored = await docs(`/api/circle-answers?where[point][equals]=${task.id}&depth=0&limit=100`)
  expect(restored.map((answer) => [answer.id, answer.enabled]).sort()).toEqual(existing.map((answer) => [answer.id, answer.enabled]).sort())
})

test('deleting a question through the sheet takes its circle answers with it, and undo brings both back together', async () => {
  const prompt = `Which line from this sitting stays with you ${sfx}`
  const created = await sheet(master, { questions: [{ talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 30, text: prompt, source: 'human', status: 'draft' }] }, LIBRARY)
  await apply(master, created, LIBRARY)
  const question = (await docs(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`))[0]

  const written = await sheet(master, {
    circle: [
      { question_id: question.id, name: 'Hana', body: `The line about the heart ${sfx}.`, tone: 'quiet', length: 'short' },
      { question_id: question.id, name: 'Idris', body: `I listened to that part twice ${sfx}.`, tone: 'quiet', length: 'short', enabled: 'no' },
    ],
  }, LIBRARY)
  expect(written.counts.create).toBe(2)
  await apply(master, written, LIBRARY)
  expect(await docs(`/api/circle-answers?where[point][equals]=${question.id}&depth=0`)).toHaveLength(2)

  const removing = await sheet(master, {
    questions: [{ talk_key: 'yt-NIR88RRpat4', question_id: question.id, status: 'delete' }],
    circle: [{ question_id: question.id, body: `One more line ${sfx}.` }],
  }, LIBRARY)
  expect((removing.errors as Row[]).map((issue) => `${issue.tab}:${issue.column}`)).toEqual(['CircleAnswers:question_id'])
  const clean = await sheet(master, { questions: [{ talk_key: 'yt-NIR88RRpat4', question_id: question.id, status: 'delete' }] }, LIBRARY)
  expect(clean.counts.delete).toBe(1)
  await apply(master, clean, LIBRARY)
  expect((await master.get(`/api/engagement-points/${question.id}?depth=0`)).status()).toBe(404)
  expect(await docs(`/api/circle-answers?where[point][equals]=${question.id}&depth=0`)).toEqual([])

  await undo(master, LIBRARY)
  const back = (await docs(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`))[0]
  expect(back?.id, 'the question is back').toBeTruthy()
  const answers = await docs(`/api/circle-answers?where[point][equals]=${back.id}&depth=0&sort=name`)
  expect(answers.map((answer) => [answer.name, answer.enabled, answer.lesson])).toEqual([['Hana', true, back.lesson], ['Idris', false, back.lesson]])

  await apply(master, await sheet(master, { questions: [{ talk_key: 'yt-NIR88RRpat4', question_id: back.id, status: 'delete' }] }, LIBRARY), LIBRARY)
  expect(await docs(`/api/circle-answers?where[point][equals]=${back.id}&depth=0`)).toEqual([])
})

test('a portal admin adds circle answers to their own portal’s questions only, and they belong to that portal', async () => {
  const admin = await as('elm-admin@hearts.test', 'portal-admin')
  const FIELDS = { scope: 'portal', desk: 'portal', portal: PORTAL }
  const portal = (await docs(`/api/portals?where[slug][equals]=${PORTAL}&depth=0`))[0]
  const nur = (await docs('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0&limit=1'))[0]
  const nurTask = (await docs(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=task&depth=0&limit=1`))[0]
  const ownId = `C${sfx}yyyyy`.slice(0, 11)
  const prompt = `What will you carry home from the circle ${sfx}`
  const talk = await sheet(admin, {
    talks: [{ talk_key: `yt-${ownId}`, youtube_id: ownId, title: `Circle sheet ${sfx}`, course: 'East London circle sheet', speaker: 'Amina Yusuf', part: 'Notes', hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: 'A local line for this portal', turn_text: 'A local line for this portal', land_text: 'A local line for this portal', status: 'draft' }],
    questions: [{ talk_key: `yt-${ownId}`, type: 'task', time: 10, text: prompt, source: 'human', status: 'draft', due_days: 7, evidence: 'note', show_imam: 'yes' }],
  }, FIELDS)
  expect(talk.counts.create, JSON.stringify(talk.errors)).toBe(2)
  await apply(admin, talk, FIELDS)
  const question = (await docs(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(prompt)}&depth=0`))[0]
  expect(question.kind).toBe('task')

  const refused = await sheet(admin, { circle: [{ question_id: nurTask.id, body: `Not ours to answer ${sfx}.` }] }, FIELDS)
  expect((refused.errors as Row[]).map((issue) => `${issue.tab}:${issue.column}`)).toEqual(['CircleAnswers:question_id'])
  expect(refused.counts.create).toBe(0)

  const own = await sheet(admin, { circle: [{ talk_key: `yt-${ownId}`, question_id: question.id, name: 'Safiya', body: `Done, quietly ${sfx}.`, tone: 'quiet', length: 'short' }] }, FIELDS)
  await apply(admin, own, FIELDS)
  const answer = (await docs(`/api/circle-answers?where[point][equals]=${question.id}&depth=0`))[0]
  expect(answer).toMatchObject({ name: 'Safiya', portal: portal.id, enabled: true })

  const exported = await admin.get(`/api/hearts/sheet?kind=export&scope=portal&desk=portal&portal=${PORTAL}`)
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(Buffer.from(await exported.body()) as unknown as ExcelJS.Buffer)
  const values: string[] = []
  book.getWorksheet('CircleAnswers')!.eachRow((row, number) => {
    if (number > 2) values.push(String(row.getCell(6).value))
  })
  expect(values).toContain(`Done, quietly ${sfx}.`)

  await undo(admin, FIELDS)
  await undo(admin, FIELDS)
  expect((await master.get(`/api/engagement-points/${question.id}?depth=0`)).status()).toBe(404)
  expect(await docs(`/api/circle-answers?where[point][equals]=${question.id}&depth=0`)).toEqual([])
  await admin.dispose()
})
