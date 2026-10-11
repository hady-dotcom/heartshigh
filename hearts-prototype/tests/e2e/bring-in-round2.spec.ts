import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { artifactDir } from './artifact-dir'

const execFileAsync = promisify(execFile)
const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const RUN = process.env.BRING_IN_RUN || '1'
const ARTIFACTS = artifactDir('bring-in-round2', `run-${RUN}`)
const sfx = `${RUN}${Date.now().toString().slice(-6)}`
const COURSE = `Bring in round ${sfx}`
const RACE_COURSE = `Bring in race ${sfx}`
const BULK_COURSE = `Bring in bulk ${sfx}`
const PACK = `Bring in pack ${sfx}`
const SPEAKER = 'Alauddin Elbakri'
const GHUNYA = 'The heart at rest'
const FIXTURE = path.join(process.cwd(), 'tests/fixtures/bring-in/yt-dlp.mjs')
const PASSWORD = 'hearts-join1'
const LINKS = [
  'https://www.youtube.com/watch?v=B4KtRL_2aXY',
  'https://www.youtube.com/watch?v=UUTnGXyCHZI',
  'https://www.youtube.com/watch?v=gEqJgd0zB8Q | Hani',
  'https://www.youtube.com/watch?v=kM7LVppIMl0',
  'https://www.youtube.com/watch?v=yl7DBZGnhNo',
  'https://www.youtube.com/playlist?list=PLheartsround2',
].join('\n')

type Lesson = {
  id: number
  title?: string
  speaker?: string
  youtubeId?: string
  durationSeconds?: number
  transcript?: string
  transcriptNote?: string
  publishState?: string
  jibrilSection?: string
  ghunyaHeading?: string
}

const state: {
  courseId: number
  lessons: Lesson[]
  token: string
  packId: number
  holderEmail: string
  joinerEmail: string
  portalId: number
} = { courseId: 0, lessons: [], token: '', packId: 0, holderEmail: '', joinerEmail: '', portalId: 0 }

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(ARTIFACTS, `${name}.png`), fullPage: true })
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function masterApi() {
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const response = await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return master
}

async function lessonsFor(master: APIRequestContext, courseId: number) {
  const body = await (await master.get(`/api/lessons?where[course][equals]=${courseId}&limit=50&depth=0&sort=order`)).json()
  return (body.docs || []) as Lesson[]
}

async function ready(page: Page, email: string) {
  const master = await masterApi()
  const found = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`)).json()
  const id = found.docs?.[0]?.id
  expect(id, `${email} joined`).toBeTruthy()
  const patched = await master.patch(`/api/users/${id}`, { data: { onboarded: true, seenWelcome: true } })
  expect(patched.ok(), await patched.text()).toBeTruthy()
  await master.dispose()
  await page.goto('/p/east-london/lanes')
  await expect(page.getByTestId('lanes')).toBeVisible()
}

async function join(browser: Browser, code: string, email: string, name: string) {
  const context = await browser.newContext({ viewport: PHONE })
  const page = await context.newPage()
  await page.goto(`/join?code=${encodeURIComponent(code)}`)
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill(PASSWORD)
  await page.getByTestId('join-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/join'))
  await ready(page, email)
  return { context, page }
}

async function helper(token: string, dryRun: boolean) {
  const env: NodeJS.ProcessEnv = { ...process.env, HEARTS_BASE: E2E_BASE, HEARTS_HELPER_TOKEN: token, YT_DLP_PATH: FIXTURE, YT_DLP_ROLE: 'helper', STT_ENGINE: 'fixture', HELPER_GAP_MS: '0' }
  delete env.HEARTS_CAPTION_BOT_WALL
  delete env.HEARTS_YT_FIXTURE
  if (dryRun) env.HEARTS_HELPER_DRY_RUN = '1'
  else delete env.HEARTS_HELPER_DRY_RUN
  const result = await execFileAsync('npx', ['tsx', 'scripts/bring-in-helper/run.ts'], { env, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
  return `${result.stdout}\n${result.stderr}`
}

test.describe('round 2 bring in', () => {
  test.describe.configure({ mode: 'serial' })

  test('five links and a playlist skip the short film and the duplicate, and save drafts', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/bring-in')
    await expect(page.getByTestId('bring-in')).toBeVisible()
    await expect(page.getByTestId('bring-in')).not.toContainText(/ingest/i)
    await page.getByTestId('bring-in-urls').fill(LINKS)
    await page.getByTestId('bring-in-course').selectOption('new')
    await page.getByTestId('bring-in-new-title').fill(COURSE)
    await page.getByTestId('bring-in-speaker').fill(SPEAKER)
    await page.getByTestId('bring-in-jibril').selectOption('W10')
    await page.getByTestId('bring-in-ghunya').fill(GHUNYA)
    await shot(page, '01-paste')
    await page.getByTestId('bring-in-lookup').click()
    await expect(page.getByTestId('bring-in-preview')).toBeVisible()
    const short = page.locator('[data-testid="bring-in-row"][data-id="short000001"]')
    await expect(short).toHaveAttribute('data-skip', 'short')
    await expect(short.getByTestId('bring-in-pick')).not.toBeChecked()
    await expect(short.getByTestId('bring-in-captions')).toContainText('Captions listed')
    const copies = page.locator('[data-testid="bring-in-row"][data-id="B4KtRL_2aXY"]')
    await expect(copies).toHaveCount(2)
    await expect(copies.nth(1)).toHaveAttribute('data-skip', 'duplicate')
    await expect(copies.nth(1).getByTestId('bring-in-pick')).toBeDisabled()
    await expect(page.locator('[data-testid="bring-in-row"][data-id="nocaps00001"]')).toHaveAttribute('data-skip', 'no')
    await expect(page.locator('[data-testid="bring-in-row"][data-id="nocaps00001"] [data-testid="bring-in-captions"]')).toHaveText('No captions')
    await expect(page.locator('[data-testid="bring-in-row"][data-id="gEqJgd0zB8Q"] [data-testid="bring-in-row-speaker"]')).toHaveValue('Hani')
    await expect(copies.first().locator('[data-testid="bring-in-row-speaker"]')).toHaveValue(SPEAKER)
    await expect(copies.first().locator('[data-testid="bring-in-row-speaker"]')).not.toHaveValue(/HEARTS/)
    await expect(copies.first().locator('[data-testid="bring-in-row-jibril"]')).toHaveValue('W10')
    await expect(copies.first().locator('[data-testid="bring-in-row-ghunya"]')).toHaveValue(GHUNYA)
    await shot(page, '02-preview')
    await page.getByTestId('bring-in-commit').click()
    await expect(page.getByTestId('bring-in-result')).toBeVisible()
    await expect(page.getByTestId('notice')).toContainText('saved as drafts')
    await expect(page.getByTestId('notice')).toContainText('waiting for a transcript')
    await expect(page.getByTestId('bring-in-live-row').first()).toHaveAttribute('data-status', 'waiting')
    await expect(page.getByTestId('bring-in-live-row').first()).toHaveAttribute('data-publish', 'draft')
    await expect(page.getByTestId('bring-in-retry').first()).toBeVisible()
    await shot(page, '03-drafts')

    const master = await masterApi()
    const courses = await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(COURSE)}&limit=1`)).json()
    state.courseId = courses.docs?.[0]?.id
    expect(state.courseId).toBeTruthy()
    state.lessons = await lessonsFor(master, state.courseId)
    await master.dispose()
    const ids = state.lessons.map((lesson) => lesson.youtubeId)
    expect(ids.sort()).toEqual(['B4KtRL_2aXY', 'UUTnGXyCHZI', 'fresh000001', 'gEqJgd0zB8Q', 'kM7LVppIMl0', 'nocaps00001', 'yl7DBZGnhNo'].sort())
    for (const lesson of state.lessons) {
      expect(lesson.publishState).toBe('draft')
      expect(lesson.transcriptNote || '').toMatch(/^Bring-in: waiting/)
      expect(lesson.jibrilSection).toBe('W10')
      expect(lesson.ghunyaHeading).toBe(GHUNYA)
      expect(lesson.transcript || '').not.toContain('-->')
      expect(lesson.speaker).toBe(lesson.youtubeId === 'gEqJgd0zB8Q' ? 'Hani' : SPEAKER)
      expect(lesson.speaker).not.toMatch(/HEARTS channel/)
    }
    expect(state.lessons.find((lesson) => lesson.youtubeId === 'B4KtRL_2aXY')?.durationSeconds).toBe(428)
    expect(state.lessons.find((lesson) => lesson.youtubeId === 'B4KtRL_2aXY')?.title).toBe('Goals for the month')
  })

  test('drafts stay hidden, and publishing reaches a new joiner only when asked to reach an existing holder', async ({ page, browser }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/packs')
    const master = await masterApi()
    const portals = await (await master.get('/api/portals?where[slug][equals]=east-london&limit=1')).json()
    state.portalId = portals.docs?.[0]?.id
    expect(state.portalId).toBeTruthy()
    const teacher = await master.post('/api/access-codes', { data: { code: `TCH${sfx}`, label: `bring-teacher-${sfx}`, role: 'teacher', portal: state.portalId } })
    const teacherText = await teacher.text()
    expect(teacher.ok(), teacherText).toBeTruthy()
    const teacherDoc = JSON.parse(teacherText) as { doc?: { id: number }; id?: number }
    const teacherId = teacherDoc.doc?.id || teacherDoc.id
    expect(teacherId).toBeTruthy()
    const pack = await master.post('/api/packs', { data: { title: PACK, owner: 'master', courses: [] } })
    const packText = await pack.text()
    expect(pack.ok(), packText).toBeTruthy()
    const packDoc = JSON.parse(packText) as { doc?: { id: number }; id?: number }
    state.packId = packDoc.doc?.id || packDoc.id || 0
    expect(state.packId).toBeGreaterThan(0)
    const holderCode = `HLD${sfx}`
    const joinerCode = `NEW${sfx}`
    for (const [code, label] of [[holderCode, 'holder'], [joinerCode, 'joiner']] as const) {
      const created = await master.post('/api/access-codes', { data: { code, label: `bring-${label}-${sfx}`, role: 'learner', portal: state.portalId, packs: [state.packId], linkedTeacherCode: teacherId } })
      const createdText = await created.text()
      expect(created.ok(), createdText).toBeTruthy()
    }
    await master.dispose()

    state.holderEmail = `holder-${sfx}@hearts.test`
    const holder = await join(browser, holderCode, state.holderEmail, 'Existing Holder')
    await expect(holder.page.getByTestId('lanes')).not.toContainText(COURSE)
    await holder.page.goto(`/p/east-london/course/${state.courseId}`)
    await expect(holder.page.getByTestId('lanes')).toBeVisible()
    await expect(holder.page.getByText('not in your pack')).toBeVisible()
    await shot(holder.page, '04-holder-before')

    await page.goto('/master/packs')
    const row = page.getByTestId('pack-row').filter({ hasText: PACK })
    await row.locator('label', { hasText: COURSE }).locator('input').check()
    await expect(row.getByTestId('pack-give-holders')).not.toBeChecked()
    await row.getByTestId('pack-save').click()
    await expect(page.getByTestId('notice')).toContainText('Pack updated')
    await expect(page.getByTestId('notice')).toContainText('keep the course list they had')
    await expect(page.getByTestId('notice')).not.toContainText('see the change now')
    await shot(page, '05-pack-notice')

    await holder.page.goto('/p/east-london/lanes')
    await expect(holder.page.getByTestId('lanes')).not.toContainText(COURSE)
    await shot(holder.page, '06-holder-still-without')

    state.joinerEmail = `joiner-${sfx}@hearts.test`
    const joiner = await join(browser, joinerCode, state.joinerEmail, 'New Joiner')
    await expect(joiner.page.getByTestId('path-course').filter({ hasText: COURSE })).toBeVisible()
    await joiner.page.goto(`/p/east-london/course/${state.courseId}`)
    await expect(joiner.page.getByText('no parts yet')).toBeVisible()
    await expect(joiner.page.locator('body')).not.toContainText('Goals for the month')
    await expect(joiner.page.locator('body')).not.toContainText('No captions film')
    await shot(joiner.page, '07-joiner-drafts-hidden')

    await page.goto('/master/bring-in')
    await page.getByTestId('helper-label').fill(`Home machine ${sfx}`)
    await page.getByTestId('helper-create').click()
    await expect(page.getByTestId('helper-token-value')).toBeVisible()
    state.token = (await page.getByTestId('helper-token-value').innerText()).trim()
    expect(state.token).toMatch(/^hlp_[0-9a-f]{48}$/)
    const cookie = (await page.context().cookies()).find((item) => item.name === 'hearts_helper_once')
    expect(cookie?.value).toBe(state.token)
    expect(cookie?.httpOnly).toBeTruthy()
    await shot(page, '08-helper-token')
    await page.reload()
    await expect(page.getByTestId('helper-token-value')).toHaveCount(0)

    const dry = await helper(state.token, true)
    expect(dry).toMatch(/Dry run/)
    expect(dry).toMatch(/would not attach/)
    const beforeHelper = await masterApi()
    const still = await lessonsFor(beforeHelper, state.courseId)
    await beforeHelper.dispose()
    for (const lesson of still) expect(lesson.transcript || '').not.toContain('-->')

    const real = await helper(state.token, false)
    expect(real).toMatch(/"speech":1/)
    expect(real).toMatch(/"attached":7/)
    const again = await helper(state.token, false)
    expect(again).toMatch(/"talks":0/)
    const filled = await (async () => {
      const api = await masterApi()
      const rows = await lessonsFor(api, state.courseId)
      await api.dispose()
      return rows
    })()
    state.lessons = filled
    for (const lesson of filled) {
      expect(lesson.publishState).toBe('draft')
      expect(lesson.transcript || '').toContain('-->')
      expect(lesson.transcriptNote || '').toMatch(/^Bring-in: processed/)
    }
    const speech = filled.find((lesson) => lesson.youtubeId === 'nocaps00001')
    expect(speech?.transcript || '').toMatch(/The light enters the heart\./)
    expect(speech?.transcript || '').toMatch(/Sit with that for a moment\./)
    const caption = filled.find((lesson) => lesson.youtubeId === 'B4KtRL_2aXY')
    expect(caption?.transcript || '').toMatch(/People gather and listen\./)
    expect(caption?.transcript || '').not.toMatch(/The light enters the heart/)

    await joiner.page.goto(`/p/east-london/course/${state.courseId}`)
    await expect(joiner.page.getByText('no parts yet')).toBeVisible()

    const goals = filled.find((lesson) => lesson.youtubeId === 'B4KtRL_2aXY')!
    const sitting = filled.find((lesson) => lesson.youtubeId === 'UUTnGXyCHZI')!
    await page.goto(`/master/library/${state.courseId}?part=${goals.id}`)
    await expect(page.getByTestId('publish-state')).toHaveAttribute('data-state', 'draft')
    await expect(page.getByTestId('give-holders')).not.toBeChecked()
    await page.getByTestId('publish-talk').click()
    await expect(page.getByTestId('notice')).toContainText('Published 1 talk')
    await expect(page.getByTestId('notice')).toContainText('left as they are')
    await expect(page.getByTestId('publish-state')).toHaveAttribute('data-state', 'published')
    await shot(page, '09-publish-one')

    await joiner.page.goto(`/p/east-london/course/${state.courseId}`)
    await expect(joiner.page.getByTestId('course-title')).toContainText(COURSE)
    await expect(joiner.page.getByTestId('buffet-talk')).toContainText('Goals for the month')
    await expect(joiner.page.locator('body')).not.toContainText('A long sitting')
    await expect(joiner.page.locator('body')).not.toContainText('Quiet hour')
    await shot(joiner.page, '10-joiner-sees-one')
    await holder.page.goto('/p/east-london/lanes')
    await expect(holder.page.getByTestId('lanes')).not.toContainText(COURSE)

    await page.goto(`/master/library/${state.courseId}?part=${sitting.id}`)
    await page.getByTestId('give-holders').check()
    await page.getByTestId('publish-talk').click()
    await expect(page.getByTestId('notice')).toContainText('Published 1 talk')
    await expect(page.getByTestId('notice')).toContainText('who already hold the pack')
    await shot(page, '11-publish-holders')

    await holder.page.goto('/p/east-london/lanes')
    await expect(holder.page.getByTestId('path-course').filter({ hasText: COURSE })).toBeVisible()
    await holder.page.goto(`/p/east-london/course/${state.courseId}`)
    await expect(holder.page.getByTestId('buffet-talk').filter({ hasText: 'Goals for the month' })).toBeVisible()
    await expect(holder.page.getByTestId('buffet-talk').filter({ hasText: 'A long sitting' })).toBeVisible()
    await expect(holder.page.locator('body')).not.toContainText('Quiet hour')
    await expect(holder.page.locator('body')).not.toContainText('No captions film')
    await shot(holder.page, '12-holder-sees-published')

    await holder.context.close()
    await joiner.context.close()
  })

  test('a helper token cannot publish or read the rest of the desk, and revoke stops it', async ({ page }) => {
    const token = state.token
    const outsider = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { authorization: `Bearer ${token}` } })
    const waiting = await outsider.get('/api/hearts/awaiting-transcript')
    expect(waiting.status()).toBe(200)
    const status = await outsider.get('/api/hearts/bring-in-status?ids=1')
    expect(status.status()).toBe(403)
    const publish = await outsider.post('/api/hearts/awaiting-transcript', { data: { lesson: state.lessons[0].id, transcript: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nNo.\n', publish: true } })
    expect(publish.status()).toBe(403)
    const users = await outsider.get('/api/users?limit=1')
    expect([401, 403]).toContain(users.status())
    const lessons = await outsider.post('/api/lessons', { data: { title: 'Should not' } })
    expect([401, 403]).toContain(lessons.status())
    const hearts = await outsider.post('/api/hearts', { form: { action: 'publish-talks', lesson: String(state.lessons[0].id), next: '/' }, maxRedirects: 0 })
    expect(hearts.status()).not.toBe(200)
    await outsider.dispose()

    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/bring-in')
    await page.locator('[data-testid="helper-row"][data-revoked="no"]').getByTestId('helper-revoke').click()
    await expect(page.getByTestId('notice')).toContainText('revoked')
    const after = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { authorization: `Bearer ${token}` } })
    expect((await after.get('/api/hearts/awaiting-transcript')).status()).toBe(401)
    await after.dispose()
    await shot(page, '13-token-revoked')
  })

  test('two identical submits create the film once', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/bring-in')
    await page.getByTestId('bring-in-urls').fill('https://www.youtube.com/watch?v=race0000001')
    await page.getByTestId('bring-in-new-title').fill(RACE_COURSE)
    await page.getByTestId('bring-in-speaker').fill(SPEAKER)
    await page.getByTestId('bring-in-lookup').click()
    await expect(page.getByTestId('bring-in-preview')).toBeVisible()
    const preview = new URL(page.url()).searchParams.get('preview')
    expect(preview).toBeTruthy()
    const body = new URLSearchParams()
    body.set('action', 'commit-bring-in')
    body.set('next', '/master/bring-in')
    body.set('preview', preview || '')
    body.append('pick', '0')
    const post = () => page.request.post('/api/hearts', { headers: { 'content-type': 'application/x-www-form-urlencoded' }, data: body.toString(), maxRedirects: 0 })
    const [first, second] = await Promise.all([post(), post()])
    expect([301, 302, 303, 307, 308]).toContain(first.status())
    expect([301, 302, 303, 307, 308]).toContain(second.status())
    const master = await masterApi()
    const courses = await (await master.get(`/api/courses?where[title][equals]=${encodeURIComponent(RACE_COURSE)}&limit=5`)).json()
    expect(courses.docs).toHaveLength(1)
    const lessons = await lessonsFor(master, courses.docs[0].id)
    await master.dispose()
    expect(lessons.filter((lesson) => lesson.youtubeId === 'race0000001')).toHaveLength(1)
    await shot(page, '14-concurrency')
  })

  test('bulk publish says who can see the talks', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/bring-in')
    await page.getByTestId('bring-in-urls').fill('https://www.youtube.com/watch?v=bulk0000001')
    await page.getByTestId('bring-in-new-title').fill(BULK_COURSE)
    await page.getByTestId('bring-in-lookup').click()
    await page.getByTestId('bring-in-commit').click()
    await expect(page.getByTestId('bring-in-result')).toBeVisible()
    await expect(page.getByTestId('bring-in-give')).not.toBeChecked()
    await page.getByTestId('bring-in-publish').click()
    await expect(page.getByTestId('notice')).toContainText('Published 1 talk')
    await expect(page.getByTestId('notice')).toContainText('still waiting')
    await expect(page.getByTestId('notice')).toContainText('left as they are')
    await shot(page, '15-bulk-publish')
  })

  test('a learner phone still opens home, lanes and a course', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', '/p/east-london')
    await expect(page.getByTestId('home')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(COURSE)
    await shot(page, '16-learner-home')
    await page.goto('/p/east-london/lanes')
    await expect(page.getByTestId('lanes')).toBeVisible()
    await expect(page.getByTestId('path-course').first()).toBeVisible()
    await expect(page.locator('body')).not.toContainText('Goals for the month')
    await shot(page, '17-learner-lanes')
    const start = page.getByTestId('lesson-link').first()
    if (await start.count()) await start.click()
    else await page.getByTestId('peek').first().click()
    await expect(page.getByTestId('course-overview')).toBeVisible()
    await expect(page.getByTestId('course-title')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(COURSE)
    await shot(page, '18-learner-course')
  })
})
