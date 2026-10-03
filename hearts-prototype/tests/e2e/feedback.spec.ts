import { mkdirSync, writeFileSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const SHOTS = '/opt/cursor/artifacts/screenshots'
const ARTIFACTS = '/opt/cursor/artifacts'
const SHARED = 'I put my phone in the other room after isha and sat with my uncle.'
const PRIVATE = 'Kept this for my own workbook and nobody else.'
const HAMZA = 'On the bus home I noticed I had not greeted the person beside me, and I did the next day.'
const LEEDS = 'In Leeds I walked to fajr with my brother and we did not hurry the last part.'
const WEAK = 'Did you like the talk?'

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
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

async function doc(collection: string, where: string) {
  const body = await json(await master.get(`/api/${collection}?${where}&depth=0&limit=1`))
  return (body.docs?.[0] as { id: number } | undefined) || null
}

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true })
  mkdirSync(ARTIFACTS, { recursive: true })
  master = await as('master@hearts.test', 'hearts-master')
  const maryam = await doc('users', 'where[email][equals]=elm-learner@hearts.test')
  const hamza = await doc('users', 'where[email][equals]=elm-learner2@hearts.test')
  const yusuf = await doc('users', 'where[email][equals]=leeds-learner@hearts.test')
  const elm = await doc('portals', 'where[slug][equals]=east-london')
  const leeds = await doc('portals', 'where[slug][equals]=leeds')
  const point = (await json(await master.get('/api/engagement-points?where[status][not_equals]=rejected&limit=1&depth=0&sort=second'))).docs?.[0] as { id: number; lesson: number } | undefined
  expect(maryam && hamza && yusuf && elm && leeds && point, 'demo people and a question').toBeTruthy()
  const have = await doc('answers', `where[body][equals]=${encodeURIComponent(SHARED)}`)
  if (!have && point && maryam && hamza && yusuf && elm && leeds) {
    const make = async (user: number, portal: number, body: string, share: boolean, keepPrivate = false) => {
      const created = await json(await master.post('/api/answers', { data: { point: point.id, user, lesson: point.lesson, body, portal, keepPrivate, shareWithTeacher: share && !keepPrivate, answeredAt: '2026-09-20T09:00:00.000Z' } }))
      expect(created.doc?.id || created.id, body).toBeTruthy()
      if (share) {
        await master.post('/api/workbook-entries', { data: { user, answer: created.doc?.id || created.id, lesson: point.lesson, body, consent: true, portal, teacherReply: body === SHARED ? 'Thank you for writing this down. I will sit with it before Thursday.' : '' } })
      }
    }
    await make(maryam.id, elm.id, SHARED, true)
    await make(maryam.id, elm.id, PRIVATE, false, true)
    await make(hamza.id, elm.id, HAMZA, true)
    await make(yusuf.id, leeds.id, LEEDS, true)
    await master.post('/api/messages', { data: { body: 'The Thursday circle is bringing tea again. Come if you can.', author: maryam.id, portal: elm.id } })
  }
  const weak = await doc('engagement-points', `where[prompt][equals]=${encodeURIComponent(WEAK)}`)
  if (!weak && point) {
    const created = await json(await master.post('/api/engagement-points', { data: { lesson: point.lesson, second: 12, kind: 'question', family: 'popup', prompt: WEAK, triggerType: 'timestamp', timing: 'immediate', status: 'draft', draftNote: 'Imported with the talk.', options: [] } }))
    expect(created.doc?.id || created.id, 'weak question').toBeTruthy()
  }
})

test.afterAll(async () => {
  await master?.dispose()
})

test.describe('Feedback for teachers', () => {
  test('anonymised export, private answers left out, and a draft question check', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/feedback')
    await expect(page.getByTestId('feedback-desk')).toBeVisible()
    await expect(page.getByTestId('nav-feedback')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('private-count')).not.toHaveText('0')
    await expect(page.getByTestId('feedback-desk')).toContainText('kept private')
    await expect(page.getByTestId('grouped-view')).toBeVisible()
    await expect(page.getByTestId('feedback-desk')).toContainText(SHARED)
    await expect(page.getByTestId('feedback-desk')).not.toContainText(PRIVATE)
    await expect(page.getByTestId('feedback-desk')).not.toContainText(LEEDS)
    await expect(page.getByTestId('feedback-desk')).not.toContainText('elm-learner@hearts.test')
    await expect(page.getByTestId('feedback-desk')).not.toContainText('Maryam Begum')
    await expect(page.getByTestId('feedback-desk')).toContainText(/Learner [A-Z]/)
    await page.screenshot({ path: `${SHOTS}/feedback-summary.png` })

    const group = page.getByTestId('door-group').first()
    await group.scrollIntoViewIfNeeded()
    await expect(group.getByTestId('question-group').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/feedback-grouped.png` })

    await page.getByTestId('export-dialog').locator('summary').click()
    await expect(page.getByTestId('export-mode')).toContainText('Anonymise is on')
    await page.screenshot({ path: `${SHOTS}/feedback-export.png` })

    const csvResponse = await page.request.get('/api/feedback?portal=east-london&format=csv')
    expect(csvResponse.ok()).toBeTruthy()
    const csv = await csvResponse.text()
    writeFileSync(`${ARTIFACTS}/feedback-anonymised.csv`, csv)
    expect(csv).toContain(SHARED)
    expect(csv).not.toContain(PRIVATE)
    expect(csv).not.toContain(LEEDS)
    expect(csv).not.toContain('Maryam')
    expect(csv).not.toContain('@hearts.test')
    expect(csv.split('\n')[0]).toContain('door,seat,course,talk,question,family,answer,date,learner,teacher reply')

    const xlsx = await page.request.get('/api/feedback?portal=east-london&format=xlsx')
    expect(xlsx.ok()).toBeTruthy()
    expect(xlsx.headers()['content-type']).toContain('spreadsheet')

    const pdf = await page.request.get('/api/feedback?portal=east-london&format=pdf')
    expect(pdf.ok()).toBeTruthy()
    const pdfBytes = Buffer.from(await pdf.body())
    writeFileSync(`${ARTIFACTS}/feedback-digest.pdf`, pdfBytes)
    expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
    const pdfText = pdfBytes.toString('latin1')
    expect(pdfText).toContain('sat with my uncle')
    expect(pdfText).not.toContain('Kept this')

    await page.reload()
    await expect(page.getByTestId('audit-row').first()).toBeVisible()
    await expect(page.getByTestId('export-audit')).toContainText('Anonymised')

    await page.getByTestId('anonymise').uncheck()
    await page.getByTestId('apply-filters').click()
    await expect(page.getByTestId('feedback-desk')).toContainText('Maryam Begum')
    await expect(page.getByTestId('feedback-desk')).not.toContainText(PRIVATE)
    const named = await page.request.get('/api/feedback?portal=east-london&format=csv&named=1')
    const namedCsv = await named.text()
    expect(namedCsv).toContain('Maryam Begum')
    expect(namedCsv).not.toContain('elm-learner@hearts.test')
    expect(namedCsv).not.toContain(PRIVATE)

    await page.getByTestId('view-learner').click()
    await expect(page.getByTestId('learner-view')).toBeVisible()
    await expect(page.getByTestId('learner-view')).toContainText(SHARED)

    await page.getByTestId('view-door').click()
    const summaryButton = page.getByTestId('draft-summary').first()
    await summaryButton.scrollIntoViewIfNeeded()
    await summaryButton.click()
    await expect(page.getByTestId('ai-summary-draft').first()).toBeVisible()
    await expect(page.getByTestId('ai-summary-draft').first()).toContainText('AI summary')
    await expect(page.getByTestId('ai-summary-draft').first()).toContainText('draft')

    await page.getByTestId('check-questions').click()
    await expect(page.getByTestId('weak-question').filter({ hasText: WEAK })).toBeVisible()
    const weakCard = page.getByTestId('weak-question').filter({ hasText: WEAK })
    await expect(weakCard).toContainText('Draft')
    await expect(weakCard.getByTestId('weak-rewrite')).toContainText('ordinary moment')
    const still = await json(await master.get(`/api/engagement-points?where[prompt][equals]=${encodeURIComponent(WEAK)}&depth=0`))
    expect(still.docs[0].status).toBe('draft')
    const report = page.getByTestId('weak-questions')
    writeFileSync(`${ARTIFACTS}/weak-questions-report.txt`, await report.innerText())
  })

  test('a teacher can open feedback, a learner cannot, and Leeds cannot read East London', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/feedback')
    await expect(page.getByTestId('feedback-desk')).toContainText(SHARED)
    await expect(page.getByTestId('feedback-desk')).not.toContainText(PRIVATE)
    await expect(page.getByTestId('export-audit')).toHaveCount(0)

    const learner = await as('elm-learner@hearts.test', 'portal-learner')
    const blocked = await learner.get('/p/east-london/admin/feedback', { maxRedirects: 0 })
    expect(blocked.status()).toBeGreaterThanOrEqual(300)
    expect(blocked.headers().location || '').not.toContain('/admin/feedback')
    const learnerFile = await learner.get('/api/feedback?portal=east-london&format=csv')
    expect(learnerFile.status()).toBe(401)
    await learner.dispose()

    const leeds = await as('leeds-admin@hearts.test', 'portal-admin')
    const cross = await leeds.get('/api/feedback?portal=east-london&format=csv')
    expect(cross.status()).toBe(403)
    const own = await leeds.get('/api/feedback?portal=leeds&format=csv')
    expect(own.ok()).toBeTruthy()
    const ownCsv = await own.text()
    expect(ownCsv).toContain(LEEDS)
    expect(ownCsv).not.toContain(SHARED)
    await leeds.dispose()
  })
})
