import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

// HEARTS circle answers: drafted or written answers that sit in a question's swarm until real answers arrive.

const PORTAL = 'east-london'
const sfx = Date.now().toString().slice(-6)
const DESK = { width: 1440, height: 900 }
const LABEL = 'From the Hady Core circle'

type Row = Record<string, any> & { id: number }

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}
const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/hearts', { form: data, maxRedirects: 0 })
const formMulti = (ctx: APIRequestContext, data: [string, string][]) => ctx.post('/api/hearts', { data: new URLSearchParams(data).toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))
const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>
async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
async function lessonOf(youtubeId: string) {
  return (await json(await master.get(`/api/lessons?where[youtubeId][equals]=${youtubeId}&depth=0`))).docs[0] as { id: number; course: number }
}
async function circleRows(query: string) {
  return (await json(await master.get(`/api/circle-answers?${query}&depth=0&limit=500`))).docs as Row[]
}
async function answerCount() {
  return Number((await json(await master.get('/api/answers?limit=1&depth=0'))).totalDocs)
}
async function settings(label: string, threshold: number) {
  const response = await form(master, { action: 'circle-settings', label, threshold: String(threshold), next: '/master/circle' })
  expect(loc(response)).toContain('notice=')
}
async function openFirstQuestion(page: Page) {
  await page.getByTestId('answer-point').click()
  await expect(page.getByTestId('popup')).toBeVisible()
  return Number(await page.getByTestId('popup').getAttribute('data-point'))
}
const textOf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})
test.afterAll(async () => {
  await form(master, { action: 'circle-settings', label: LABEL, threshold: '8', next: '/master/circle' })
  await master?.dispose()
})

test.describe('HEARTS circle answers', () => {
  test('generation: the master desk drafts answers with the chosen count, tones and lengths, with the built-in drafts when there is no AI key', async ({ page }) => {
    const nur = await lessonOf('NIR88RRpat4')
    const before = await circleRows(`where[lesson][equals]=${nur.id}`)
    const points = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[status][not_equals]=rejected&depth=0&limit=50`))).docs as Row[]
    expect(points.length).toBeGreaterThan(0)
    const answers = await answerCount()
    const response = await formMulti(master, [
      ['action', 'circle-generate'], ['lesson', String(nur.id)], ['count', '3'], ['tone', 'warm'], ['tone', 'quiet'], ['length', 'short'], ['next', '/master/circle'],
    ])
    const message = loc(response)
    expect(message).toContain('notice=')
    expect(message).toContain(`${3 * points.length} circle answers added for ${points.length} questions`)
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) expect(message).toContain('written by built-in drafts')
    const after = await circleRows(`where[lesson][equals]=${nur.id}`)
    const added = after.filter((row) => !before.some((old) => old.id === row.id))
    expect(added).toHaveLength(3 * points.length)
    for (const row of added) {
      expect(row.origin).toBe('ai')
      expect(row.enabled).toBe(true)
      expect(['warm', 'quiet']).toContain(row.tone)
      expect(row.length).toBe('short')
      expect(row.portal ?? null).toBeNull()
      expect(String(row.body).length).toBeGreaterThan(5)
    }
    expect(await answerCount(), 'circle answers are not answers').toBe(answers)

    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/circle')
    await expect(page.getByTestId('master-circle')).toBeVisible()
    await page.getByTestId('circle-talk').filter({ has: page.locator(`[href$="lesson=${nur.id}"]`) }).getByTestId('circle-open').click()
    await expect(page.getByTestId('circle-talk-detail')).toBeVisible()
    await expect(page.getByTestId('circle-answer').first()).toBeVisible()
    expect(await page.getByTestId('circle-answer').count()).toBe(after.length)
    await page.getByTestId('circle-count').first().fill('2')
    await page.getByTestId('circle-generate-all-submit').click()
    await expect(page.getByTestId('notice')).toContainText(`${2 * points.length} circle answers added`)
    expect(await page.getByTestId('circle-answer').count()).toBe(after.length + 2 * points.length)
  })

  test('label: a learner who shares sees circle answers in the swarm with the light label, and the CMS wording reaches them', async ({ page }) => {
    const nur = await lessonOf('NIR88RRpat4')
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    await form(learner, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: '/' })
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await openFirstQuestion(page)
    const circle = page.getByTestId('swarm-item').and(page.locator('[data-source="circle"]'))
    await expect(circle.first()).toBeVisible()
    await expect(circle.first().getByTestId('circle-label')).toHaveText(LABEL)
    expect(await page.getByTestId('circle-label').count()).toBe(await circle.count())
    expect(await page.locator('[data-source="learner"] [data-testid="circle-label"]').count(), 'real answers carry no label').toBe(0)
    const box = await circle.first().evaluate((element) => getComputedStyle(element).borderStyle + getComputedStyle(element).backgroundColor)
    const plain = await page.locator('.other').first().evaluate((element) => getComputedStyle(element).borderStyle + getComputedStyle(element).backgroundColor)
    expect(box, 'circle answers are not boxed off').toBe(plain)

    expect(loc(await form(master, { action: 'circle-settings', label: 'Quiz corner', threshold: '8', next: '/master/circle' }))).toContain('error=')
    await settings(`Shared in the Hady Core circle ${sfx}`, 8)
    await page.reload()
    await openFirstQuestion(page)
    await expect(page.getByTestId('circle-label').first()).toHaveText(`Shared in the Hady Core circle ${sfx}`)
    await settings(LABEL, 8)

    await expect(page.getByTestId('swarm')).toHaveCount(1)
    await learner.dispose()
  })

  test('fade-out: circle answers step back once real answers reach the threshold, and stay on the desk', async ({ page, browser }) => {
    const nur = await lessonOf('NIR88RRpat4')
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    const point = await openFirstQuestion(page)
    const circle = page.locator('[data-testid="swarm-item"][data-source="circle"]')
    const real = page.locator('[data-testid="swarm-item"][data-source="learner"]')
    const realBefore = await real.count()
    const shownBefore = await circle.count()
    expect(shownBefore).toBeGreaterThan(0)
    expect(shownBefore).toBeLessThanOrEqual(6)

    await settings(LABEL, realBefore + 1)
    await page.reload()
    await openFirstQuestion(page)
    const fewer = await circle.count()
    if (realBefore > 0) expect(fewer).toBeLessThan(shownBefore)
    expect(fewer).toBeGreaterThan(0)

    const maryam = await as('elm-learner@hearts.test', 'portal-learner')
    await form(maryam, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: '/' })
    const body = `The bit about light stayed with me all evening ${sfx}`
    expect(loc(await form(maryam, { action: 'answer', point: String(point), body, choice: 'You start to incline towards the Akhira', shareWithLearners: 'on', next: `/p/${PORTAL}` }))).not.toContain('error=')
    await maryam.dispose()

    await page.reload()
    await openFirstQuestion(page)
    await expect(real.filter({ hasText: body })).toBeVisible()
    await expect(circle).toHaveCount(0)

    const desk = await browser.newPage({ viewport: DESK })
    await signIn(desk, 'master@hearts.test', 'hearts-master', `/master/circle?lesson=${nur.id}`)
    const section = desk.locator(`[data-testid="circle-point"][data-point="${point}"]`)
    expect(await section.getByTestId('circle-answer').count(), 'still there for the admin').toBeGreaterThan(0)
    await expect(section.getByTestId('circle-balance')).toContainText('sees 0 of')
    await expect(section.getByTestId('circle-balance')).toContainText('reached the threshold')
    await desk.close()

    await settings(LABEL, 8)
    await page.reload()
    await openFirstQuestion(page)
    expect(await circle.count()).toBeGreaterThan(0)
  })

  test('exclusion: circle answers never reach analytics, trends, the profile, the workbook or progress views', async () => {
    const nur = await lessonOf('NIR88RRpat4')
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const teacher = await as('elm-teacher@hearts.test', 'portal-teacher')
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    const me = (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent('elm-learner2@hearts.test')}&depth=0`))).docs[0] as Row
    const views = async () => ({
      answers: await answerCount(),
      teach: textOf(await (await teacher.get(`/p/${PORTAL}/admin/teach`)).text()).match(/Learners \(\d+\).*?(?=Workbook entries shared with you|$)/)?.[0] || '',
      overview: textOf(await (await admin.get(`/p/${PORTAL}/admin`)).text()),
      trends: textOf(await (await master.get('/master/trends')).text()),
      me: textOf(await (await learner.get(`/p/${PORTAL}/me`)).text()),
      garden: textOf(await (await learner.get(`/p/${PORTAL}/garden`)).text()),
      csv: await (await teacher.get(`/api/workbook/${me.id}?format=csv`)).text(),
    })
    const before = await views()
    const marker = `Marigold mornings by the window ${sfx}`
    const points = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&depth=0&limit=50&sort=second`))).docs as Row[]
    expect(loc(await form(master, { action: 'circle-add', point: String(points[0].id), name: 'Ruqayyah', body: marker, next: '/master/circle' }))).toContain('notice=')
    expect(loc(await form(master, { action: 'circle-generate', lesson: String(nur.id), count: '4', next: '/master/circle' }))).toContain('notice=')
    const staff = (await circleRows(`where[body][equals]=${encodeURIComponent(marker)}`))[0]
    expect(staff.origin).toBe('staff')
    const after = await views()
    expect(after.answers).toBe(before.answers)
    expect(after.teach).toBe(before.teach)
    for (const [name, text] of Object.entries(after)) expect(String(text), name).not.toContain(marker)
    expect(after.trends.replace(/\d{1,2}:\d{2}/g, '')).toBe(before.trends.replace(/\d{1,2}:\d{2}/g, ''))
    for (const ctx of [admin, teacher, learner]) {
      const response = await ctx.get('/api/circle-answers?limit=5')
      const docs = (await json(response)).docs || []
      expect(docs, 'only the master desk reads the collection over REST').toHaveLength(0)
    }
    await Promise.all([admin.dispose(), teacher.dispose(), learner.dispose()])
  })

  test('portal scope: a portal admin looks after circle answers on their own courses only, and their answers stay in their portal', async ({ page }) => {
    const nur = await lessonOf('NIR88RRpat4')
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const leedsAdmin = await as('leeds-admin@hearts.test', 'portal-admin')
    const refused = loc(await form(admin, { action: 'circle-generate', lesson: String(nur.id), count: '2', next: `/p/${PORTAL}/admin/circle` }))
    expect(refused).toContain('error=You can add circle answers to your own portal’s courses only.')
    const masterRow = (await circleRows(`where[lesson][equals]=${nur.id}`))[0]
    expect(loc(await form(admin, { action: 'circle-toggle', id: String(masterRow.id), enabled: 'off', next: `/p/${PORTAL}/admin/circle` }))).toContain('error=')
    expect(loc(await form(admin, { action: 'circle-delete', id: String(masterRow.id), next: `/p/${PORTAL}/admin/circle` }))).toContain('error=')
    expect(loc(await form(admin, { action: 'circle-settings', label: 'Ours', threshold: '3', next: `/p/${PORTAL}/admin/circle` }))).toContain('error=Only the master desk')
    expect((await circleRows(`where[id][equals]=${masterRow.id}`))[0].enabled).toBe(masterRow.enabled)

    const local = (await json(await master.get(`/api/lessons?where[title][equals]=${encodeURIComponent('How we sit')}&depth=0`))).docs[0] as Row
    expect(loc(await form(admin, { action: 'create-point', lesson: String(local.id), second: '2', kind: 'reflection', prompt: `What did you notice about how we sit ${sfx}?`, audience: 'everyone', next: `/p/${PORTAL}/admin/content` }))).not.toContain('error=')
    const made = loc(await form(admin, { action: 'circle-generate', lesson: String(local.id), count: '3', next: `/p/${PORTAL}/admin/circle` }))
    expect(made).toContain('notice=')
    const own = await circleRows(`where[lesson][equals]=${local.id}`)
    const elm = Number(own[0]?.portal)
    expect(own.length).toBeGreaterThanOrEqual(3)
    expect(own.every((row) => Number(row.portal) === elm && elm > 0)).toBe(true)
    expect(loc(await form(admin, { action: 'circle-toggle', id: String(own[0].id), enabled: 'off', next: `/p/${PORTAL}/admin/circle` }))).toContain('notice=')
    expect(loc(await form(leedsAdmin, { action: 'circle-generate', lesson: String(local.id), count: '2', next: '/p/leeds/admin/circle' }))).toContain('error=')
    expect(loc(await form(leedsAdmin, { action: 'circle-delete', id: String(own[1].id), next: '/p/leeds/admin/circle' }))).toContain('error=')

    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/circle`)
    await expect(page.getByTestId('portal-circle')).toBeVisible()
    await expect(page.getByTestId('circle-settings')).toHaveCount(0)
    await expect(page.locator(`[data-testid="circle-talk"][data-lesson="${local.id}"]`)).toBeVisible()
    await expect(page.locator(`[data-testid="circle-talk"][data-lesson="${nur.id}"]`)).toHaveCount(0)
    await page.goto(`/p/${PORTAL}/admin/circle?lesson=${nur.id}`)
    await expect(page.getByTestId('circle-refused')).toBeVisible()
    await page.goto(`/p/${PORTAL}/admin/circle?lesson=${local.id}`)
    await expect(page.getByTestId('circle-answer').first()).toBeVisible()

    const teacherPage = await (await as('elm-teacher@hearts.test', 'portal-teacher')).get(`/p/${PORTAL}/admin/circle`, { maxRedirects: 0 })
    expect(teacherPage.status(), 'teachers do not get the circle desk').not.toBe(200)

    const only = `Only East London reads this ${sfx}`
    const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&depth=0&limit=50&sort=second`))).docs[0] as Row
    expect(loc(await form(master, { action: 'circle-bulk', lesson: String(nur.id), scope: 'talk', enabled: 'off', next: '/master/circle' }))).toContain('notice=')
    const created = await master.post('/api/circle-answers', { data: { point: point.id, lesson: nur.id, portal: elm, name: 'Noor', body: only, origin: 'staff', enabled: true } })
    expect(created.ok()).toBeTruthy()
    for (const email of ['leeds-learner@hearts.test', 'elm-learner2@hearts.test']) {
      const viewer = await as(email, 'portal-learner')
      await form(viewer, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: '/' })
      await viewer.dispose()
    }
    const seen = async (email: string, slug: string) => {
      const viewer = await page.context().browser()!.newPage()
      await signIn(viewer, email, 'portal-learner', `/p/${slug}/course/${nur.course}?part=${nur.id}`)
      await viewer.getByTestId('answer-point').click()
      await expect(viewer.getByTestId('popup')).toBeVisible()
      await settleSwarm(viewer)
      const text = await viewer.getByTestId('swarm').textContent()
      await viewer.close()
      return text || ''
    }
    await settings(LABEL, 100)
    expect(await seen('elm-learner2@hearts.test', PORTAL)).toContain(only)
    expect(await seen('leeds-learner@hearts.test', 'leeds')).not.toContain(only)
    await settings(LABEL, 8)
    expect(loc(await form(master, { action: 'circle-bulk', lesson: String(nur.id), scope: 'talk', enabled: 'on', next: '/master/circle' }))).toContain('notice=')
    await Promise.all([admin.dispose(), leedsAdmin.dispose()])
  })

  test('word checks and switches: kill-list text is refused, and bulk off clears the swarm while the desk keeps the answers', async ({ page }) => {
    const nur = await lessonOf('NIR88RRpat4')
    const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&depth=0&limit=50&sort=second`))).docs[0] as Row
    for (const body of ['You should pray more.', 'Take the q u i z first.', 'It was <b>lovely</b>.', '']) {
      expect(loc(await form(master, { action: 'circle-add', point: String(point.id), name: 'Sami', body, next: '/master/circle' })), body).toContain('error=')
    }
    expect(loc(await form(master, { action: 'circle-add', point: String(point.id), name: '<i>Sami</i>', body: 'A quiet yes from me.', next: '/master/circle' }))).toContain('error=')
    const row = (await circleRows(`where[point][equals]=${point.id}&where[origin][equals]=ai`))[0]
    expect(loc(await form(master, { action: 'circle-edit', id: String(row.id), name: row.name, body: 'I need to fix this.', next: '/master/circle' }))).toContain('error=')
    expect((await master.post('/api/circle-answers', { data: { point: point.id, lesson: nur.id, name: 'Sami', body: 'Give your rating of this talk', origin: 'staff' } })).ok(), 'the collection hook refuses it too').toBeFalsy()
    expect(loc(await form(master, { action: 'circle-edit', id: String(row.id), name: row.name, body: `Edited by the desk ${sfx}.`, next: '/master/circle' }))).toContain('notice=')

    expect(loc(await form(master, { action: 'circle-bulk', lesson: String(nur.id), scope: 'course', enabled: 'off', next: '/master/circle' }))).toMatch(/notice=\d+ circle answers on this course switched off/)
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await page.getByTestId('answer-point').click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.locator('[data-testid="swarm-item"][data-source="circle"]')).toHaveCount(0)
    const off = await circleRows(`where[lesson][equals]=${nur.id}`)
    expect(off.length).toBeGreaterThan(0)
    expect(off.every((answer) => answer.enabled === false)).toBe(true)
    expect(loc(await form(master, { action: 'circle-bulk', lesson: String(nur.id), scope: 'talk', enabled: 'on', next: '/master/circle' }))).toContain('switched on')
    await page.reload()
    await page.getByTestId('answer-point').click()
    expect(await page.locator('[data-testid="swarm-item"][data-source="circle"]').count()).toBeGreaterThan(0)
  })
})

async function settleSwarm(page: Page) {
  await expect(page.getByTestId('swarm')).toBeVisible()
}
