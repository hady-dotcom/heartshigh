import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { mockOutput, stepBySlug, type TalkContext } from '../../src/lib/ai-steps'
import { tierSourceText } from '../../src/server/tier-source'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const ai = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/ai-steps', { form: data, maxRedirects: 0 })
const loc = (response: { headers: () => Record<string, string> }) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))
const json = async (response: { json: () => Promise<unknown> }) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function lessonOf(youtubeId: string) {
  return (await json(await master.get(`/api/lessons?where[youtubeId][equals]=${youtubeId}&depth=0`))).docs[0] as { id: number; unit: number; course: number; title: string; durationSeconds?: number }
}

/** The mock picks a cut from the prompt text. Keep trying suffixes until the draft cut is not the live one. */
function promptThatMoves(livePrompt: string, duration?: number) {
  const hors = stepBySlug('hors-doeuvre')
  if (!hors) throw new Error('The hors d’oeuvre step is missing from the registry.')
  const context: TalkContext = {
    title: 'How to Live Like the Prophet',
    speaker: 'Yasir Fahmy',
    duration: Number(duration || 0),
    transcript: tierSourceText({ youtubeId: 'TLCGBj4AlB0', transcript: '' }),
    hook: '',
    turn: '',
    land: '',
    landAt: 0,
    clauseCards: '',
    rubric: '',
    clip: '',
  }
  const live = JSON.stringify(mockOutput(hors, context, livePrompt))
  for (let index = 0; index < 24; index++) {
    const prompt = `${livePrompt}\nVariant ${index} for the side by side.`
    if (JSON.stringify(mockOutput(hors, context, prompt)) !== live) return prompt
  }
  throw new Error('The mock hors d’oeuvre did not move for any prompt variant.')
}

async function tierOf(lessonId: number) {
  return (await json(await master.get(`/api/talk-tiers?where[lesson][equals]=${lessonId}&depth=0`))).docs[0] as { id: number; status: string; horsQuote: string; horsStart: number; horsEnd: number; source?: string }
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true })
  master = await as('master@hearts.test', 'hearts-master')
})

test.afterAll(async () => {
  await master?.dispose()
})

test.describe('AI steps', () => {
  test('registry, versions, diff, try-it and mock mode', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/ai')
    await expect(page.getByTestId('ai-mock-mode')).toContainText('Mock mode')
    await expect(page.getByTestId('ai-step')).toHaveCount(12)
    await expect(page.getByTestId('ai-env')).toContainText('ANTHROPIC_API_KEY')
    await expect(page.getByTestId('ai-env')).not.toContainText('sk-')
    await page.screenshot({ path: `${SHOTS}/ai-registry.png`, fullPage: true })

    await page.getByTestId('ai-step').filter({ hasText: "Hors d'oeuvre picker" }).click()
    await expect(page.getByTestId('ai-placeholders')).toContainText('{{TRANSCRIPT}}')
    const prompt = page.getByTestId('ai-prompt')
    const original = await prompt.inputValue()
    await prompt.fill(`${original}\nPrefer the line a stranger would repeat.`)
    await page.getByTestId('ai-note').fill('Asked for a line a stranger would repeat')
    await page.getByTestId('ai-save').click()
    await expect(page.getByTestId('ai-version').filter({ hasText: 'v2' })).toContainText('Asked for a line a stranger would repeat')
    await expect(page.getByTestId('ai-version').filter({ hasText: 'v1' })).toHaveAttribute('data-live', 'yes')

    await page.locator('[data-testid=ai-diff-form] select[name=from]').selectOption('1')
    await page.locator('[data-testid=ai-diff-form] select[name=to]').selectOption('2')
    await page.getByRole('button', { name: 'Show the diff' }).click()
    const diff = page.getByTestId('ai-diff')
    await expect(diff).toBeVisible()
    await expect(diff.locator('[data-kind=add]').first()).toContainText('stranger')
    await page.screenshot({ path: `${SHOTS}/ai-prompt-diff.png`, fullPage: true })

    await page.getByTestId('ai-mark-live').click()
    await expect(page.getByTestId('ai-version').filter({ hasText: 'v2' })).toHaveAttribute('data-live', 'yes')
    await page.getByTestId('ai-rollback').click()
    await expect(page.getByTestId('ai-version').filter({ hasText: 'v1' })).toHaveAttribute('data-live', 'yes')
    await expect(page.getByTestId('ai-prompt')).toHaveValue(original)

    const prophet = await lessonOf('TLCGBj4AlB0')
    await page.getByTestId('ai-try-lesson').selectOption(String(prophet.id))
    const draft = page.getByTestId('ai-try-prompt')
    const livePrompt = await draft.inputValue()
    const moving = promptThatMoves(livePrompt, prophet.durationSeconds)
    await draft.fill(moving)
    expect(await draft.inputValue()).toBe(moving)
    await page.getByTestId('ai-try-submit').click()
    const compare = page.getByTestId('ai-try-compare')
    await expect(compare).toHaveAttribute('data-different', 'yes')
    await expect(page.getByTestId('try-draft')).not.toHaveText(await page.getByTestId('try-live').innerText())
    await page.screenshot({ path: `${SHOTS}/ai-try-compare.png`, fullPage: true })
  })

  test('a re-run does not overwrite an approved tier, and the review screen says a new draft is available', async ({ page }) => {
    const lesson = await lessonOf('TLCGBj4AlB0')
    const before = await tierOf(lesson.id)
    expect(loc(await master.post('/api/hearts', { form: { action: 'tier-review', tier: String(before.id), decision: 'approve', next: '/master/review' }, maxRedirects: 0 }))).toContain('Approved')
    const approved = await tierOf(lesson.id)
    const started = await ai(master, { action: 'start-job', slug: 'hors-doeuvre', scope: 'talk', lesson: String(lesson.id), wait: '1', jobBase: '/master/ai', next: '/master/ai' })
    expect(loc(started), loc(started)).not.toContain('error=')
    const after = await tierOf(lesson.id)
    expect(after.status).toBe('checked')
    expect(after.horsQuote).toBe(approved.horsQuote)
    expect(after.horsStart).toBe(approved.horsStart)
    const jobId = Number((loc(started).match(/job\/(\d+)/) || [])[1])
    const job = await json(await master.get(`/api/ai-steps?job=${jobId}`))
    expect(job.status).toBe('done')
    expect(job.results[0].ok).toBe(true)
    expect(job.results[0].detail.steps[0].disposition).toBe('pending')

    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/review?tier=${before.id}`)
    await expect(page.getByTestId('new-draft-available')).toContainText('New draft available')
    await page.screenshot({ path: `${SHOTS}/ai-new-draft.png`, fullPage: true })
    await page.goto(`/master/ai/ingest/${lesson.id}`)
    await expect(page.getByTestId('ingest-step').filter({ hasText: "Hors d'oeuvre" })).toHaveAttribute('data-status', 'draft-ready')
    await page.screenshot({ path: `${SHOTS}/ai-ingest.png`, fullPage: true })

    expect(loc(await master.post('/api/hearts', { form: { action: 'tier-review', tier: String(before.id), decision: 'reopen', next: '/master/review' }, maxRedirects: 0 }))).not.toContain('error=')
    expect((await tierOf(lesson.id)).status).toBe('draft')
  })

  test('a background re-run reports progress and keeps a per-talk error', async ({ page }) => {
    const lesson = await lessonOf('ECaTWkof57E')
    const before = await tierOf(lesson.id)
    const made = await json(await master.post('/api/lessons', { data: { title: 'AI steps empty transcript', unit: lesson.unit, course: lesson.course, transcript: '', transcriptSource: 'none', durationSeconds: 90 } }))
    const emptyId = made.doc?.id || made.id
    expect(emptyId, JSON.stringify(made)).toBeTruthy()
    const started = await ai(master, { action: 'start-job', slug: 'hors-doeuvre', scope: 'selection', lesson: `${lesson.id},${emptyId}`, gap: '700', jobBase: '/master/ai', next: '/master/ai' })
    expect(loc(started)).not.toContain('error=')
    const jobId = Number((loc(started).match(/job\/(\d+)/) || [])[1])
    let job = await json(await master.get(`/api/ai-steps?job=${jobId}`))
    const seen = new Set<string>([`${job.status}:${job.finished}`])
    const deadline = Date.now() + 30_000
    while (job.status !== 'done' && job.status !== 'failed' && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200))
      job = await json(await master.get(`/api/ai-steps?job=${jobId}`))
      seen.add(`${job.status}:${job.finished}`)
    }
    expect(job.status).toBe('done')
    expect(job.total).toBe(2)
    expect(job.finished).toBe(2)
    expect(job.failed).toBe(1)
    expect(seen.has('running:0') || seen.has('running:1') || [...seen].some((item) => item.startsWith('running'))).toBeTruthy()
    const failed = (job.results as { ok: boolean; error?: string }[]).find((row) => !row.ok)
    expect(failed?.error || '').toMatch(/transcript/i)

    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/ai/job/${jobId}`)
    await expect(page.getByTestId('ai-job-progress')).toContainText('2 of 2')
    await expect(page.getByTestId('ai-job-error')).toContainText(/transcript/i)
    await page.screenshot({ path: `${SHOTS}/ai-rerun-job.png`, fullPage: true })

    const restored = await master.patch(`/api/talk-tiers/${before.id}`, { data: { horsQuote: before.horsQuote, horsStart: before.horsStart, horsEnd: before.horsEnd, status: before.status, source: before.source || '' } })
    expect(restored.ok(), await restored.text()).toBeTruthy()
    const removed = await master.delete(`/api/lessons/${emptyId}`)
    expect(removed.ok(), await removed.text()).toBeTruthy()
  })

  test('portal admins can read the steps and cannot edit them until the master grants it', async ({ page }) => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/ai')
    await expect(page.getByTestId('ai-registry')).toBeVisible()
    await expect(page.getByTestId('ai-step')).toHaveCount(12)
    await page.getByTestId('ai-step').first().click()
    await expect(page.getByTestId('ai-prompt-readonly')).toBeVisible()
    await expect(page.getByTestId('ai-save')).toHaveCount(0)
    const denied = await ai(admin, { action: 'save-version', slug: 'rubric', prompt: 'no', note: 'should fail', provider: 'anthropic', model: 'x', temperature: '0', maxTokens: '200', next: '/p/east-london/admin/ai/rubric' })
    expect(loc(denied)).toContain('not granted')
    const audit = await json(await master.get('/api/audit-log?where[event][equals]=ai.step.denied&limit=5&sort=-createdAt'))
    expect(audit.docs.length).toBeGreaterThan(0)

    expect(loc(await ai(master, { action: 'grant', value: 'on', next: '/master/ai' }))).toContain('can edit')
    await page.goto('/p/east-london/admin/ai/rubric')
    await expect(page.getByTestId('ai-save')).toBeVisible()
    expect(loc(await ai(master, { action: 'grant', value: 'off', next: '/master/ai' }))).toContain('no longer edit')
    await page.reload()
    await expect(page.getByTestId('ai-save')).toHaveCount(0)
    const grantLog = await json(await master.get('/api/audit-log?where[event][equals]=ai.grant&limit=5&sort=-createdAt'))
    expect(grantLog.docs.length).toBeGreaterThan(0)
    await admin.dispose()
  })
})
