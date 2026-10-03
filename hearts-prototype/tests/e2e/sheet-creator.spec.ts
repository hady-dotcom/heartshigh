import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const ARTIFACTS = '/opt/cursor/artifacts'
const PORTAL = 'east-london'

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

function approveTasks(buffer: Buffer) {
  return (async () => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer)
    const sheet = workbook.getWorksheet('Questions')
    if (!sheet) throw new Error('The draft has no Questions tab.')
    const header = sheet.getRow(2)
    let typeCol = 0
    let statusCol = 0
    header.eachCell((cell, col) => {
      if (cell.value === 'type') typeCol = col
      if (cell.value === 'status') statusCol = col
    })
    sheet.eachRow((row, number) => {
      if (number < 3) return
      if (String(row.getCell(typeCol).value || '') === 'task') row.getCell(statusCol).value = 'approved'
    })
    const out = await workbook.xlsx.writeBuffer()
    return Buffer.from(out)
  })()
}

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  mkdirSync(ARTIFACTS, { recursive: true })
})

test.afterAll(async () => {
  await master?.dispose()
})

test('the creator drafts a sheet, then a learner completes a task the imam can see', async ({ page }) => {
  await page.setViewportSize(DESK)
  const course = (await json(await master.get('/api/courses?where[title][equals]=The%20Names%20Class%2020%3A%20Al-Nur&limit=1&depth=0'))).docs?.[0] as { id: number } | undefined
  expect(course?.id, 'seeded Al-Nur course').toBeTruthy()
  const before = await json(await master.get('/api/lessons?where[youtubeId][equals]=ccccccccccc&limit=1&depth=0'))
  expect(before.docs || []).toHaveLength(0)

  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/sheet/create')
  await expect(page.getByTestId('sheet-creator')).toBeVisible()
  await page.getByTestId('creator-topic').fill('the light of the name')
  await page.getByTestId('creator-speaker').fill('Mikaeel Smith')
  await page.getByTestId('creator-search').click()
  await expect(page.getByTestId('creator-candidate')).toHaveCount(3)
  await page.locator('[data-testid="creator-candidate"][data-id="ccccccccccc"] [data-testid="creator-include"]').check()
  await page.getByTestId('creator-paste').fill('https://vimeo.com/76979871')
  await page.getByTestId('creator-file').setInputFiles(path.join(process.cwd(), 'tests/fixtures/circle-recording.mp4'))
  await expect(page.getByTestId('creator-uploaded')).toBeVisible()
  await page.getByTestId('creator-course').selectOption({ label: 'The Names Class 20: Al-Nur' })
  await page.getByTestId('creator-part').fill('Creator drafts')
  await page.screenshot({ path: path.join(ARTIFACTS, 'creator-search.png'), fullPage: true })

  await page.getByTestId('creator-build').click()
  await page.waitForURL(/\/master\/sheet\?preview=\d+/)
  await expect(page.getByTestId('sheet-preview')).toBeVisible()
  await expect(page.getByTestId('sheet-apply')).toBeVisible()
  await expect(page.getByTestId('sheet-changes')).toContainText('draft')
  const stillGone = await json(await master.get('/api/lessons?where[youtubeId][equals]=ccccccccccc&limit=1&depth=0'))
  expect(stillGone.docs || []).toHaveLength(0)
  await page.screenshot({ path: path.join(ARTIFACTS, 'creator-preview.png'), fullPage: true })

  const previewId = new URL(page.url()).searchParams.get('preview')
  const downloaded = await master.get(`/api/hearts/sheet/create?preview=${previewId}`)
  expect(downloaded.ok()).toBeTruthy()
  const approved = await approveTasks(Buffer.from(await downloaded.body()))
  const applied = await master.post('/api/hearts/sheet', {
    multipart: {
      intent: 'apply',
      response: 'json',
      scope: 'course',
      course: String(course!.id),
      desk: 'master',
      file: { name: 'hearts-draft.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: approved },
    },
  })
  const appliedBody = await json(applied)
  expect(applied.ok(), JSON.stringify(appliedBody.errors?.slice(0, 4) || appliedBody)).toBeTruthy()

  const talk = (await json(await master.get('/api/lessons?where[youtubeId][equals]=ccccccccccc&limit=1&depth=0'))).docs[0] as { id: number; course: number }
  const vimeo = (await json(await master.get('/api/lessons?where[vimeoId][equals]=76979871&limit=1&depth=0'))).docs[0] as { id: number }
  const file = (await json(await master.get('/api/lessons?where[title][equals]=circle-recording&limit=1&depth=0'))).docs[0] as { id: number; videoProvider?: string }
  expect(talk?.id).toBeTruthy()
  expect(vimeo?.id).toBeTruthy()
  expect(file?.videoProvider).toBe('file')
  const points = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${talk.id}&limit=20&depth=0`))).docs as { id: number; kind?: string; status?: string; prompt?: string; dueDays?: number; evidence?: string; showImam?: boolean }[]
  const task = points.find((point) => point.kind === 'task')
  expect(task?.status).toBe('published')
  expect(task?.dueDays).toBe(7)
  expect(task?.evidence).toBe('note')
  expect(task?.showImam).toBe(true)
  expect(points.filter((point) => point.kind !== 'task').every((point) => point.status === 'draft')).toBeTruthy()

  const learner = await as('elm-learner@hearts.test', 'portal-learner')
  const film = await learner.get(`/api/hearts/film/${file.id}`)
  expect(film.status(), 'uploaded film plays for a learner on the course').toBe(200)
  expect(film.headers()['content-type']).toContain('video')
  await learner.dispose()

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${course!.id}?part=${vimeo.id}`)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId('vimeo-player')).toHaveAttribute('src', /player\.vimeo\.com\/video\/76979871/)
  await page.goto(`/p/${PORTAL}/course/${course!.id}?part=${file.id}`)
  await expect(page.getByTestId('file-player')).toHaveAttribute('src', new RegExp(`/api/hearts/film/${file.id}`))
  await page.goto(`/p/${PORTAL}/course/${course!.id}?part=${talk.id}`)
  await page.getByTestId('answer-point').click()
  await expect(page.getByTestId('task-form')).toBeVisible()
  await expect(page.getByTestId('task-due')).toContainText('7')
  await expect(page.getByTestId('task-imam')).toBeVisible()
  await page.screenshot({ path: path.join(ARTIFACTS, 'creator-task.png'), fullPage: true })
  await page.getByTestId('answer-text').fill('I called my mother and asked how she is.')
  await page.getByTestId('answer-submit').click()
  await expect(page.getByTestId('notice')).toBeVisible()

  await page.goto(`/p/${PORTAL}/garden/workbook`)
  await expect(page.getByTestId('workbook-answer').filter({ hasText: 'I called my mother' })).toBeVisible()
  await page.screenshot({ path: path.join(ARTIFACTS, 'creator-workbook.png'), fullPage: true })

  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', `/p/${PORTAL}/admin/teach`)
  await page.setViewportSize(DESK)
  await expect(page.getByTestId('activation-task').first()).toBeVisible()
  await expect(page.getByTestId('workbook-review').filter({ hasText: 'I called my mother' })).toBeVisible()
  await page.screenshot({ path: path.join(ARTIFACTS, 'creator-imam.png'), fullPage: true })

  const undone = await master.post('/api/hearts/sheet', { multipart: { intent: 'undo', response: 'json', scope: 'library', desk: 'master' } })
  const undoneBody = await json(undone)
  expect(undone.ok(), JSON.stringify(undoneBody)).toBeFalsy()
  expect(String(undoneBody.error || '')).toContain('answered')
  const after = await json(await master.get('/api/lessons?where[youtubeId][equals]=ccccccccccc&limit=1&depth=0'))
  expect(after.docs || []).toHaveLength(1)
  const stillThere = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${talk.id}&limit=20&depth=0`))).docs as { kind?: string }[]
  expect(stillThere.some((point) => point.kind === 'task')).toBeTruthy()
})

test('a portal admin searches for their own course and cannot draft the master library', async ({ page }) => {
  await page.setViewportSize(DESK)
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/sheet/create`)
  await expect(page.getByTestId('portal-creator')).toBeVisible()
  await expect(page.getByTestId('sheet-creator')).toBeVisible()
  await expect(page.getByTestId('creator-course')).toContainText('East London circle notes')
  await expect(page.getByTestId('creator-course')).not.toContainText('Al-Nur')

  const admin = await as('elm-admin@hearts.test', 'portal-admin')
  const search = await json(await admin.post('/api/hearts/sheet/create', { data: { intent: 'search', topic: 'the light of the name', speaker: 'Mikaeel Smith', count: 3, minSeconds: 60, maxSeconds: 3600 } }))
  expect(search.via).toBe('fixture')
  expect(search.candidates).toHaveLength(3)
  const masterCourse = (await json(await master.get('/api/courses?where[title][equals]=The%20Names%20Class%2020%3A%20Al-Nur&limit=1&depth=0'))).docs?.[0] as { id: number }
  const refused = await admin.post('/api/hearts/sheet/create', {
    data: { intent: 'draft', course: String(masterCourse.id), topic: 'the light of the name', part: 'Notes', sources: [{ provider: 'vimeo', id: '76979871', title: 'A vimeo film' }] },
  })
  expect(refused.status()).toBe(403)
  const learner = await as('elm-learner@hearts.test', 'portal-learner')
  const blocked = await learner.post('/api/hearts/sheet/create', { data: { intent: 'search', topic: 'the light of the name' } })
  expect(blocked.status()).toBe(403)
  await admin.dispose()
  await learner.dispose()
})
