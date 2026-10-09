import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { E2E_BASE } from '../env'

const STILLS = path.join(process.cwd(), '..', 'proto-test', 'verify', 'safety')
mkdirSync(STILLS, { recursive: true })
const still = (page: Page, name: string) => page.screenshot({ path: path.join(STILLS, name), fullPage: true })

const DESK = { width: 1440, height: 900 }
const sfx = Date.now().toString().slice(-6)

async function as(email: string, password: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/hearts', { form: data, maxRedirects: 0 })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))
const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('Lane C safety', () => {
  test('N09 N08: a learner reports a concern; staff hide and keep; a learner cannot read reports', async ({ page }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const alice = await as('elm-learner2@hearts.test', 'portal-learner')
    const bob = await as('elm-learner@hearts.test', 'portal-learner')
    const nur = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0'))).docs[0]
    const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`))).docs[0]
    const saved = await alice.post('/api/answers', { data: { pointId: point.id, body: `Safety share ${sfx}`, shareWithLearners: true, keepPrivate: false } })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const answerId = (await json(saved)).answerId

    const reported = await form(bob, { action: 'report', targetType: 'answer', targetId: String(answerId), reason: 'unkind', note: 'A bit sharp.', next: '/p/east-london' })
    expect(loc(reported)).toMatch(/Thank you/)

    const learnerList = await bob.get('/api/reports?limit=20&depth=0')
    const learnerDocs = (await json(learnerList)).docs || []
    expect(learnerList.status() === 403 || learnerDocs.length === 0).toBeTruthy()

    page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/safety')
    await expect(page.getByTestId('admin-safety')).toBeVisible()
    await expect(page.locator('[data-help="admin-safety"]')).toBeVisible()
    await expect(page.getByTestId('report-row').first()).toBeVisible()
    await page.getByTestId('mod-hide').first().click()
    await expect(page.getByTestId('notice')).toContainText(/hidden/)
    await page.goto('/p/east-london/admin/safety')
    await page.getByTestId('mod-keep').first().click()
    await expect(page.getByTestId('notice')).toContainText(/visible/)
    await still(page, 'n08-care-and-safety.png')

    await master.dispose()
    await alice.dispose()
    await bob.dispose()
  })

  test('N10: an at-risk report hides the item and opens Needs a person', async ({ page }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const alice = await as('elm-learner2@hearts.test', 'portal-learner')
    const bob = await as('elm-learner@hearts.test', 'portal-learner')
    const nur = (await json(await master.get('/api/lessons?where[youtubeId][equals]=NIR88RRpat4&depth=0'))).docs[0]
    const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`))).docs[0]
    const saved = await bob.post('/api/answers', { data: { pointId: point.id, body: `At risk share ${sfx}`, shareWithLearners: true } })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const answerId = (await json(saved)).answerId
    const reported = await form(alice, { action: 'report', targetType: 'answer', targetId: String(answerId), reason: 'at-risk', next: '/p/east-london' })
    expect(loc(reported)).toMatch(/Thank you/)

    page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/safety')
    await expect(page.getByTestId('needs-a-person')).toBeVisible()
    await expect(page.getByTestId('safeguard-alert').first()).toBeVisible()
    await expect(page.getByTestId('add-safeguarding-lead')).toBeVisible()
    await still(page, 'n10-needs-a-person.png')

    await master.dispose()
    await alice.dispose()
    await bob.dispose()
  })

  test('N08 hostile: a portal admin cannot moderate another portal', async () => {
    const master = await as('master@hearts.test', 'hearts-master')
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const leeds = (await json(await master.get('/api/portals?where[slug][equals]=leeds&depth=0'))).docs[0]
    const blocked = await form(admin, {
      action: 'safety-hide',
      portal: String(leeds.id),
      targetType: 'answer',
      targetId: '1',
      next: '/p/east-london/admin/safety',
    })
    expect(loc(blocked)).toMatch(/not in your portal/)
    await master.dispose()
    await admin.dispose()
  })

  test('N01: staff announce and a learner sees the card on Home', async ({ page, context }) => {
    const master = await as('master@hearts.test', 'hearts-master')
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const elm = (await json(await master.get('/api/portals?where[slug][equals]=east-london&depth=0'))).docs[0]
    const posted = await form(admin, {
      action: 'announce',
      portal: String(elm.id),
      body: `Eid prayer is at 8:30 this week ${sfx}`,
      audience: 'everyone',
      next: '/p/east-london/admin/announcements',
    })
    expect(loc(posted)).toMatch(/ready/)

    page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/announcements')
    await expect(page.getByTestId('admin-announcements')).toBeVisible()
    await expect(page.getByTestId('announce-row').first()).toBeVisible()

    const learner = await context.newPage()
    await signIn(learner, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    await expect(learner.getByTestId('announce-card')).toBeVisible()
    await expect(learner.getByTestId('announce-text')).toContainText('Eid prayer')
    await still(learner, 'n01-home-announcement.png')
    await learner.getByTestId('announce-dismiss').click()
    await expect(learner.getByTestId('announce-card')).toHaveCount(0)

    await admin.dispose()
    await master.dispose()
  })
})
