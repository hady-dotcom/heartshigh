import ExcelJS from 'exceljs'
import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { DOORS, doorNumberOfClause } from '../../src/lib/doors'
import { buildWorkbook } from '../../src/lib/master-sheet'

// Hadith Jibril as 20 doors: learners see doors only, the desk sees the door first and the clause underneath,
// the sheet takes a door in place of a clause, and the feed's spine and lanes route by door. All on seeded talks.

const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const DESK = { width: 1440, height: 900 }
const LEARNER = { email: 'elm-learner@hearts.test', password: 'portal-learner' }

let master: APIRequestContext

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function as(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function postSheet(buffer: Buffer, fields: Record<string, string>) {
  const response = await master.post('/api/hearts/sheet', {
    multipart: { ...fields, response: 'json', file: { name: 'doors.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer } },
  })
  return { response, body: await json(response) }
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})

test.afterAll(async () => {
  await master?.dispose()
})

test('the 20 doors are seeded with their sections, titles and clauses', async () => {
  const body = await json(await master.get('/api/doors?limit=50&sort=number&depth=0'))
  expect(body.totalDocs).toBe(20)
  const docs = body.docs as { number: number; section: string; title: string; clauses: number[] }[]
  expect(docs.map((door) => door.number)).toEqual(DOORS.map((door) => door.number))
  expect(docs.flatMap((door) => door.clauses).sort((a, b) => a - b)).toEqual(Array.from({ length: 41 }, (_, index) => index + 1))
  expect(docs.find((door) => door.number === 2)?.clauses).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  expect(docs.find((door) => door.number === 10)?.title).toBe('Believe in Allah')
})

test('a learner sees the 20 doors with their titles and never a clause number', async ({ page }) => {
  await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden`)
  // Seeded with starting clause 22, which is door 10.
  await expect(page.getByTestId('starting-door')).toHaveAttribute('data-door', '10')
  await expect(page.getByTestId('starting-door')).toContainText('Door 10: Believe in Allah')

  await page.goto(`${BASE}/garden/jibril`)
  await expect(page.getByTestId('door-cell')).toHaveCount(20)
  await expect(page.getByTestId('section-row')).toHaveCount(6)
  const lit = await page.locator('[data-testid=door-cell][data-lit=yes]').count()
  await expect(page.getByTestId('lit-count')).toHaveText(`${lit} of 20 doors`)
  await expect(page.locator('[data-testid=door-cell][data-start=yes]')).toHaveAttribute('data-door', '10')
  for (const door of DOORS) await expect(page.locator(`[data-testid=door-cell][data-door="${door.number}"]`)).toContainText(door.title)
  const map = await page.getByTestId('garden-jibril').innerText()
  expect(map).not.toMatch(/\bclauses?\b/i)
  expect(map).not.toMatch(/\b41\b/)

  await page.locator('[data-testid=door-cell][data-door="2"]').click()
  await expect(page).toHaveURL(new RegExp(`${BASE}/garden/jibril/2$`))
  await expect(page.getByTestId('door-title')).toHaveText(DOORS[1].title)
  await expect(page.getByTestId('door-words')).toContainText('We were sitting')
  await expect(page.getByTestId('door-words')).toContainText('O Muhammad')
  await expect(page.getByTestId('seat').first()).toBeVisible()
  await page.getByTestId('next-door').click()
  await expect(page.getByTestId('door-title')).toHaveText('About Islam')

  await page.goto(`${BASE}/garden/ghunya`)
  await expect(page.getByTestId('seat-group')).toHaveCount(20)

  expect((await page.goto(`${BASE}/garden/jibril/21`))?.status()).toBe(404)
})

test('every learner screen that shows the spine speaks in doors', async ({ page }) => {
  await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/lanes`)
  const chips = page.getByTestId('door-chip')
  expect(await chips.count()).toBeGreaterThan(0)
  for (const text of await chips.allTextContents()) expect(text).toMatch(/^Door (\d{1,2}) · .+/)
  const doorsShown = await chips.evaluateAll((rows) => rows.map((row) => Number(row.getAttribute('data-door'))))
  expect(doorsShown.every((door) => door >= 1 && door <= 20)).toBe(true)

  const course = (await page.locator('[data-testid=path-course] a').first().getAttribute('href')) || `${BASE}/lanes`
  await page.goto(`${BASE}/garden/harvest?group=door`)
  await expect(page.getByTestId('harvest-group-door')).toHaveClass(/on/)

  for (const screen of ['', '/lanes', '/garden', '/garden/jibril', '/garden/jibril/10', '/garden/ghunya', '/garden/harvest?group=door', '/garden/general']) {
    await page.goto(`${BASE}${screen}`)
    const text = await page.locator('main, body').first().innerText()
    expect(text, `${screen || '/'} mentions a clause`).not.toMatch(/\bclauses?\b/i)
  }
  await page.goto(course)
  expect(await page.locator('body').innerText()).not.toMatch(/\bclauses?\b/i)
})

test('the feed walks the spine door by door and the lanes push talks by door', async () => {
  const learner = await as(LEARNER.email, LEARNER.password)
  const opening = await json(await learner.get(`/api/hearts/opening?portal=${PORTAL}`))
  const cuts = opening.route.cuts as { id: number; clause: number | null; door: number | null }[]
  expect(cuts.some((cut) => cut.door)).toBe(true)
  for (const cut of cuts) expect(cut.door, `cut ${cut.id}`).toBe(doorNumberOfClause(cut.clause))
  const trust = (opening.route.lanes as { key: string; doors: { door: number; rank: number }[]; excludeDoors: number[] }[]).find((lane) => lane.key === 'trust')!
  expect(trust.doors).toEqual(expect.arrayContaining([{ door: 15, rank: 1 }, { door: 10, rank: 2 }, { door: 5, rank: 3 }]))
  expect([...trust.excludeDoors].sort((a, b) => a - b)).toEqual([14, 16, 17, 18])

  const spine = await json(await learner.post(`/api/hearts/feed?portal=${PORTAL}`, { data: { laneScores: {}, served: [], spinePointer: 0, firstOpenAt: Date.now() } }))
  const d0 = opening.d0CutId as number | null
  const spineDoors = (spine.items as { cutId: number; laneKey: string | null; door: number | null; clause: number | null }[]).filter((item) => item.laneKey === null && item.door && item.cutId !== d0)
  expect(spineDoors.length).toBeGreaterThan(0)
  for (const item of spineDoors) expect(item.door).toBe(doorNumberOfClause(item.clause))
  const firstOfEach = spineDoors.map((item) => item.door!).filter((door, index, list) => list.indexOf(door) === index)
  expect(firstOfEach).toEqual([...firstOfEach].sort((a, b) => a - b))
  expect(spine.spinePointer).toBe(Math.max(...spineDoors.map((item) => item.door!)))
  expect(spine.spinePointer).toBeLessThanOrEqual(20)

  const later = await json(await learner.post(`/api/hearts/feed?portal=${PORTAL}`, { data: { laneScores: {}, served: [], spinePointer: spine.spinePointer, firstOpenAt: Date.now() } }))
  for (const item of (later.items as { cutId: number; laneKey: string | null; door: number | null }[]).filter((row) => row.laneKey === null && row.door && row.cutId !== d0)) expect(item.door!).toBeGreaterThan(spine.spinePointer)

  // A worry deficit routes to the trust lane; in the first week nothing it serves sits in an excluded door.
  const pushed = await json(await learner.post(`/api/hearts/feed?portal=${PORTAL}`, { data: { laneScores: { trust: 0.86 }, served: [], spinePointer: 0, firstOpenAt: Date.now() } }))
  const trustItems = (pushed.items as { laneKey: string | null; door: number | null }[]).filter((item) => item.laneKey === 'trust')
  expect(trustItems.length).toBeGreaterThan(0)
  for (const item of trustItems) expect([14, 16, 17, 18]).not.toContain(item.door)
  await learner.dispose()
})

test('the desk shows the door first and keeps the clause beside it', async ({ page }) => {
  const placed = (await json(await master.get('/api/cuts?where[bestClause][exists]=true&where[status][equals]=approved&limit=50&depth=1'))).docs as { id: number; bestClause: number; lesson: { id: number; course: number | { id: number } } }[]
  const cut = placed.find((row) => row.lesson && typeof row.lesson === 'object')!
  expect(cut, 'a seeded approved cut placed on a clause').toBeTruthy()
  const courseId = typeof cut.lesson.course === 'object' ? cut.lesson.course.id : cut.lesson.course
  const door = DOORS.find((row) => row.clauses.includes(cut.bestClause))!
  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', `/master/library/${courseId}?part=${cut.lesson.id}`)
  const row = page.locator(`[data-testid=cut-draft][data-cut="${cut.id}"]`)
  await expect(row.getByTestId('cut-door')).toHaveText(`W${door.number} · ${door.title}`)
  await expect(row.getByTestId('cut-door-clause')).toContainText(`clause ${cut.bestClause}`)
  await expect(row.getByTestId('cut-clause')).toHaveValue(String(cut.bestClause))
  await expect(row.getByTestId('cut-clause').locator('optgroup')).toHaveCount(20)
  await expect(row.getByTestId('cut-clause').locator(`optgroup[label="W${door.number} · ${door.title}"] option[value="${cut.bestClause}"]`)).toHaveCount(1)
})

test('the sheet exports the door beside the clause, takes a door in place of a clause, and undo puts it back', async () => {
  const exported = await master.get('/api/hearts/sheet?kind=export&scope=library&desk=master')
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(Buffer.from(await exported.body()) as unknown as ExcelJS.Buffer)
  const sheet = book.getWorksheet('Talks')!
  const header = (sheet.getRow(2).values as unknown[]).map((value) => String(value ?? ''))
  const col = (name: string) => header.indexOf(name)
  expect(col('jibril_door')).toBe(col('jibril_clause') - 1)
  const placed: { key: string; door: string; clause: number }[] = []
  sheet.eachRow((row, index) => {
    if (index <= 2) return
    const door = String(row.getCell(col('jibril_door')).value ?? '')
    const clause = Number(row.getCell(col('jibril_clause')).value ?? 0)
    if (door || clause) placed.push({ key: String(row.getCell(col('talk_key')).value), door, clause })
  })
  expect(placed.length).toBeGreaterThan(0)
  for (const row of placed) expect(row.door, row.key).toBe(`W${doorNumberOfClause(row.clause)}`)

  const target = placed.find((row) => doorNumberOfClause(row.clause) !== 5)!
  const buffer = Buffer.from(await buildWorkbook({ talks: [{ talk_key: target.key, jibril_door: 'W5' }] }))
  const preview = await postSheet(buffer, { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.body.errors).toEqual([])
  expect(preview.body.counts.update).toBe(1)
  const applied = await postSheet(buffer, { intent: 'apply', scope: 'library', desk: 'master', import: String(preview.body.importId) })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()

  const after = await master.get('/api/hearts/sheet?kind=export&scope=library&desk=master')
  const afterBook = new ExcelJS.Workbook()
  await afterBook.xlsx.load(Buffer.from(await after.body()) as unknown as ExcelJS.Buffer)
  let moved: { door: string; clause: number } | null = null
  afterBook.getWorksheet('Talks')!.eachRow((row, index) => {
    if (index > 2 && String(row.getCell(col('talk_key')).value) === target.key) moved = { door: String(row.getCell(col('jibril_door')).value), clause: Number(row.getCell(col('jibril_clause')).value) }
  })
  expect(moved).toEqual({ door: 'W5', clause: 15 })

  const clash = await postSheet(Buffer.from(await buildWorkbook({ talks: [{ talk_key: target.key, jibril_door: 'W4', jibril_clause: 15 }] })), { intent: 'preview', scope: 'library', desk: 'master' })
  expect(clash.body.errors[0]).toMatchObject({ column: 'jibril_door' })

  const undone = await master.post('/api/hearts/sheet', { multipart: { intent: 'undo', response: 'json', scope: 'library', desk: 'master' } })
  expect(undone.ok()).toBeTruthy()
  const restored = await master.get('/api/hearts/sheet?kind=export&scope=library&desk=master')
  const restoredBook = new ExcelJS.Workbook()
  await restoredBook.xlsx.load(Buffer.from(await restored.body()) as unknown as ExcelJS.Buffer)
  let back = 0
  restoredBook.getWorksheet('Talks')!.eachRow((row, index) => {
    if (index > 2 && String(row.getCell(col('talk_key')).value) === target.key) back = Number(row.getCell(col('jibril_clause')).value)
  })
  expect(back).toBe(target.clause)
})
