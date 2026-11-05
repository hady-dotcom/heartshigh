import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { E2E_BASE } from '../env'
import { artifactDir } from './artifact-dir'

const DESK = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const SHOTS = artifactDir('screenshots')
const NOTE = 'Asked for a line a stranger would repeat, for this portal only.'

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const ai = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/ai-steps', { form: data, maxRedirects: 0, timeout: 120_000 })
const loc = (response: { headers: () => Record<string, string> }) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))
const json = async (response: { json: () => Promise<unknown> }) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function openInstructions(page: Page) {
  const techies = page.getByTestId('ai-for-techies')
  await expect(techies.getByText('For techies')).toBeVisible()
  if (!(await techies.evaluate((node) => (node as HTMLDetailsElement).open))) await techies.locator('summary').click()
  await expect(page.getByTestId('ai-prompt')).toBeVisible()
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true })
  master = await as('master@hearts.test', 'hearts-master')
})

test.afterAll(async () => {
  if (master) {
    const found = await json(await master.get(`/api/ai-step-versions?where[note][equals]=${encodeURIComponent(NOTE)}&depth=0&limit=5`)).catch(() => ({ docs: [] }))
    for (const doc of found.docs || []) {
      if (doc?.live && doc.id) await ai(master, { action: 'portal-rollback', version: String(doc.id), next: '/master/ai' }).catch(() => undefined)
    }
    await ai(master, { action: 'grant', value: 'off', next: '/master/ai' }).catch(() => undefined)
    await master.dispose()
  }
})

test('master grants edit, a portal fork shows under that portal, rollback leaves HEARTS, and the bell groups it', async ({ page }) => {
  expect(loc(await ai(master, { action: 'grant', value: 'off', next: '/master/ai' }))).toContain('no longer edit')
  const admin = await as('elm-admin@hearts.test', 'portal-admin')
  const denied = await ai(admin, {
    action: 'save-version',
    slug: 'hors-doeuvre',
    prompt: 'This must not be saved.',
    note: 'should fail',
    provider: 'anthropic',
    model: 'x',
    temperature: '0',
    maxTokens: '1200',
    next: '/p/east-london/admin/ai/hors-doeuvre',
  })
  expect(loc(denied)).toContain('not granted')
  const deniedLog = await json(await master.get('/api/audit-log?where[event][equals]=ai.step.denied&limit=1&sort=-createdAt'))
  expect(deniedLog.docs?.length, JSON.stringify(deniedLog).slice(0, 400)).toBeGreaterThan(0)
  expect(deniedLog.docs[0].event).toBe('ai.step.denied')

  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/ai/hors-doeuvre')
  await expect(page.getByTestId('ai-what')).toContainText('What this does')
  await openInstructions(page)
  const original = await page.getByTestId('ai-prompt').inputValue()
  expect(original.length).toBeGreaterThan(40)
  await page.goto('/master/ai')
  await page.getByTestId('ai-grant').click()
  await expect(page.getByTestId('notice')).toContainText('can edit')

  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/ai/hors-doeuvre')
  await expect(page.getByTestId('ai-what')).toContainText('What this does')
  await openInstructions(page)
  await expect(page.getByTestId('ai-save')).toBeVisible()
  const prompt = page.getByTestId('ai-prompt')
  await prompt.fill(`${await prompt.inputValue()}\nPrefer a line a stranger would repeat.`)
  await page.getByTestId('ai-note').fill(NOTE)
  await page.getByTestId('ai-save').click()
  await expect(page.getByTestId('notice')).toContainText('your portal only')
  const version = page.getByTestId('ai-version').filter({ hasText: NOTE })
  await expect(version).toContainText('Amina Yusuf')
  await expect(version).toContainText('portal admin')

  const lesson = (await json(await master.get('/api/lessons?where[youtubeId][equals]=TLCGBj4AlB0&depth=0&limit=1'))).docs[0]
  expect(lesson?.id, 'seeded talk').toBeTruthy()
  const started = await ai(admin, {
    action: 'start-job',
    slug: 'hors-doeuvre',
    scope: 'talk',
    lesson: String(lesson.id),
    wait: '1',
    jobBase: '/p/east-london/admin/ai',
    next: '/p/east-london/admin/ai',
  })
  expect(loc(started), loc(started)).not.toContain('error=')

  const savedBody = await json(await master.get(`/api/ai-step-versions?where[note][equals]=${encodeURIComponent(NOTE)}&depth=0&limit=1&sort=-createdAt`))
  const saved = savedBody.docs?.[0]
  expect(saved?.authorName, JSON.stringify(savedBody).slice(0, 500)).toBe('Amina Yusuf')
  expect(saved?.authorRole).toBe('portal-admin')
  expect(saved?.portal).toBeTruthy()
  expect(saved?.live).toBe(true)

  const editLog = await json(await master.get('/api/audit-log?where[event][equals]=ai.step.version&limit=1&sort=-createdAt'))
  expect(editLog.docs[0].actorRole).toBe('portal-admin')
  expect(String(editLog.docs[0].reason)).toContain('stranger')
  const runLog = await json(await master.get('/api/audit-log?where[event][equals]=ai.step.run&limit=3&sort=-createdAt'))
  expect(runLog.docs?.length, 'a run is audited').toBeGreaterThan(0)
  expect(runLog.docs[0].event).toBe('ai.step.run')

  await page.setViewportSize(DESK)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/ai/hors-doeuvre')
  await openInstructions(page)
  await expect(page.getByTestId('ai-prompt')).toHaveValue(original)
  await page.goto('/master/ai')
  const activity = page.getByTestId('portal-activity')
  await expect(activity).toBeVisible()
  await expect(page.getByTestId('portal-activity-new')).toContainText(/\d+ new since you last looked/)
  await expect(page.getByTestId('portal-activity-new')).not.toContainText('Nothing new')
  const group = page.getByTestId('portal-group').filter({ hasText: 'East London Mosque' })
  await expect(group).toContainText('1 change')
  await expect(group).toContainText(NOTE)
  await expect(group.getByTestId('portal-change')).toContainText('Amina Yusuf, portal admin')
  await expect(group.getByTestId('portal-diff').locator('[data-kind=add]').first()).toContainText('stranger')
  await expect(group.getByTestId('portal-run')).toContainText(/Worked|Did not work/)
  await group.getByTestId('portal-run-output').locator('summary').click()
  await expect(group.getByTestId('portal-run-output')).toBeVisible()
  await page.getByTestId('bell').locator('summary').click()
  const bell = page.getByTestId('desk-notification').filter({ hasText: /changed \d+ step/ })
  await expect(bell).toContainText('East London Mosque portal changed')
  await page.screenshot({ path: `${SHOTS}/ai-portal-bell-1280.png` })
  await page.getByTestId('bell').locator('summary').click()
  await activity.evaluate((node) => node.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: `${SHOTS}/ai-portal-activity-1280.png` })

  await page.setViewportSize(PHONE)
  await activity.evaluate((node) => node.scrollIntoView({ block: 'start' }))
  await page.screenshot({ path: `${SHOTS}/ai-portal-activity-390.png` })

  await page.setViewportSize(DESK)
  await page.getByTestId('portal-filter-portal').selectOption({ label: 'Leeds Chapter' })
  await page.getByRole('button', { name: 'Show' }).click()
  await expect(page.getByTestId('portal-activity-empty')).toBeVisible()
  await page.goto('/master/ai')

  await page.getByTestId('portal-group').filter({ hasText: 'East London Mosque' }).getByTestId('portal-rollback').click()
  await expect(page.getByTestId('notice')).toContainText('Rolled back')
  await expect(page.getByTestId('portal-rolled')).toBeVisible()
  await page.goto('/master/ai/hors-doeuvre')
  await openInstructions(page)
  await expect(page.getByTestId('ai-prompt')).toHaveValue(original)
  const fork = await json(await master.get(`/api/ai-step-versions/${saved.id}?depth=0`))
  const forkDoc = fork.doc || fork
  expect(forkDoc.live, JSON.stringify(fork).slice(0, 300)).toBe(false)

  expect(loc(await ai(master, { action: 'grant', value: 'off', next: '/master/ai' }))).toContain('no longer edit')
  await admin.dispose()
})
