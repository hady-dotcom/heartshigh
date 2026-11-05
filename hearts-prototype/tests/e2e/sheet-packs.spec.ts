import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import { buildWorkbook } from '../../src/lib/master-sheet'

// Importer: new courses can land straight in a pack, and reach existing learners only when asked.

const DESK = { width: 1440, height: 900 }
const sfx = Date.now().toString().slice(-6)
const PACK = `Import pack ${sfx}`
const FIRST = `Pack course one ${sfx}`
const SECOND = `Pack course two ${sfx}`
const LEARNER = { email: `sheet-pack-${sfx}@hearts.test`, password: 'sheet-pack-1', name: 'Pack Holder' }

let master: APIRequestContext
let packId = 0
let learnerId = 0

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function as(email?: string, password?: string, headers: Record<string, string> = { accept: 'application/json' }) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: headers })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function postSheet(ctx: APIRequestContext, buffer: Buffer, fields: Record<string, string>) {
  const response = await ctx.post('/api/hearts/sheet', {
    multipart: { ...fields, response: 'json', file: { name: 'packs.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer } },
  })
  return { response, body: await json(response) }
}

const talk = (key: string, course: string, youtubeId: string, extra: Record<string, string> = {}) => ({ talk_key: key, youtube_id: youtubeId, title: `A sitting for ${course}`, course, speaker: 'Pack Test', ...extra })
const packCourses = async () => ((await json(await master.get(`/api/packs/${packId}?depth=0`))).courses as (number | { id: number })[]).map((row) => (typeof row === 'number' ? row : row.id))
const courseId = async (title: string) => ((await json(await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(title)}&depth=0`))).docs[0]?.id as number | undefined)
const courseList = async () => ((await json(await master.get(`/api/users/${learnerId}?depth=0`))).courseList as number[]).map(Number)
const lastAudit = async (event: string) => (await json(await master.get(`/api/audit-log?where[event][equals]=${event}&sort=-createdAt&limit=1&depth=0`))).docs[0] as { detail?: Record<string, any> } | undefined

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  packId = (await json(await master.post('/api/packs', { data: { title: PACK, owner: 'master', courses: [] } }))).doc.id
  const joiner = await as(undefined, undefined, {})
  await joiner.post('/api/hearts', { form: { action: 'join', code: seedCode('elm-learner'), ...LEARNER }, maxRedirects: 0 })
  await joiner.dispose()
  learnerId = (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER.email)}&depth=0`))).docs[0].id
  expect((await master.patch(`/api/users/${learnerId}`, { data: { extraPacks: [packId] } })).ok()).toBeTruthy()
  expect(Array.isArray(await courseList()), 'the learner holds a course-list snapshot').toBe(true)
})

test.afterAll(async () => {
  for (const title of [FIRST, SECOND]) {
    const id = await courseId(title)
    if (id) {
      await master.delete(`/api/lessons?where[course][equals]=${id}`)
      await master.delete(`/api/units?where[course][equals]=${id}`)
      await master.delete(`/api/courses/${id}`)
    }
  }
  if (packId) await master.delete(`/api/packs/${packId}`)
  await master?.dispose()
})

test('the pack column puts a new course in the pack; without the tick box existing learners are left as they are, and that is logged', async () => {
  const buffer = await buildWorkbook({ talks: [talk(`pk1-${sfx}`, FIRST, `Pk1${sfx}abcd`.slice(0, 11), { pack: PACK })] })
  const preview = await postSheet(master, buffer, { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.body.errors, JSON.stringify(preview.body.errors)).toEqual([])
  expect(preview.body.newCourses).toBe(1)
  expect(preview.body.packLinks).toBe(1)
  expect(preview.body.changes.some((change: { label: string; detail: string }) => change.label === PACK && change.detail.includes(FIRST))).toBe(true)

  const applied = await postSheet(master, buffer, { intent: 'apply', scope: 'library', desk: 'master', import: String(preview.body.importId) })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()
  expect(applied.body.notice).toContain('existing learners were left as they are')
  const first = (await courseId(FIRST))!
  expect(await packCourses()).toEqual([first])
  expect(await courseList()).not.toContain(first)
  const audit = await lastAudit('sheet.import')
  expect(audit?.detail?.push).toBe(false)
  expect(audit?.detail?.packLinks).toEqual([{ pack: packId, course: first }])
})

test('the preview offers the pack choice with the push tick box off by default', async ({ page }) => {
  await page.setViewportSize(DESK)
  const buffer = await buildWorkbook({ talks: [talk(`pk2-${sfx}`, SECOND, `Pk2${sfx}abcd`.slice(0, 11))] })
  const preview = await postSheet(master, buffer, { intent: 'preview', scope: 'library', desk: 'master' })
  await page.goto(`/login?next=${encodeURIComponent(`/master/sheet?preview=${preview.body.importId}`)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => url.pathname.startsWith('/master/sheet'))
  await expect(page.getByTestId('sheet-pack-options')).toBeVisible()
  await expect(page.getByTestId('sheet-new-courses-pack')).toHaveValue('')
  await expect(page.getByTestId('sheet-new-courses-pack').locator('option', { hasText: PACK })).toHaveCount(1)
  await expect(page.getByTestId('sheet-push')).not.toBeChecked()
})

test('choosing a pack for new courses and ticking push gives them to learners who already hold the pack; undo takes both back out', async () => {
  const buffer = await buildWorkbook({ talks: [talk(`pk2-${sfx}`, SECOND, `Pk2${sfx}abcd`.slice(0, 11))] })
  const preview = await postSheet(master, buffer, { intent: 'preview', scope: 'library', desk: 'master' })
  expect(preview.body.newCourses).toBe(1)
  const applied = await postSheet(master, buffer, { intent: 'apply', scope: 'library', desk: 'master', import: String(preview.body.importId), newCoursesPack: String(packId), push: 'on' })
  expect(applied.response.ok(), JSON.stringify(applied.body)).toBeTruthy()
  expect(applied.body.pushedLearners).toBeGreaterThanOrEqual(1)
  const first = (await courseId(FIRST))!
  const second = (await courseId(SECOND))!
  expect(await packCourses()).toEqual([first, second])
  const list = await courseList()
  expect(list).toContain(second)
  expect(list).not.toContain(first)
  const pushed = await lastAudit('sheet.pack_push')
  expect(pushed?.detail?.packs).toEqual([packId])
  expect(pushed?.detail?.courses).toEqual([second])
  expect(pushed?.detail?.users).toContain(learnerId)

  const undone = await master.post('/api/hearts/sheet', { multipart: { intent: 'undo', response: 'json', scope: 'library', desk: 'master' } })
  expect(undone.ok(), JSON.stringify(await json(undone))).toBeTruthy()
  expect(await courseId(SECOND)).toBeUndefined()
  expect(await courseList()).not.toContain(second)
  expect(await packCourses()).toEqual([first])
  await master.post('/api/hearts/sheet', { multipart: { intent: 'undo', response: 'json', scope: 'library', desk: 'master' } })
  expect(await packCourses()).toEqual([])
})

test('a portal admin cannot name a master pack or another portal’s pack', async () => {
  const admin = await as('elm-admin@hearts.test', 'portal-admin')
  const buffer = await buildWorkbook({ talks: [talk(`pk3-${sfx}`, `Elm pack course ${sfx}`, `Pk3${sfx}abcd`.slice(0, 11), { pack: PACK })] })
  const preview = await postSheet(admin, buffer, { intent: 'preview', scope: 'portal', desk: 'portal', portal: 'east-london' })
  expect(preview.body.errors?.map((issue: { tab: string; column: string }) => `${issue.tab}:${issue.column}`)).toContain('Talks:pack')
  expect(preview.body.errors?.find((issue: { column: string }) => issue.column === 'pack')?.message).toMatch(/not one of this portal’s own packs/)
  const refused = await postSheet(admin, buffer, { intent: 'apply', scope: 'portal', desk: 'portal', portal: 'east-london', import: String(preview.body.importId), newCoursesPack: String(packId), push: 'on' })
  expect(refused.response.ok()).toBe(false)
  expect(await packCourses()).toEqual([])
  await admin.dispose()
})
