import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const sfx = Date.now().toString().slice(-6)

let master: APIRequestContext
let admin: APIRequestContext
let learner: APIRequestContext
let learner2: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}
const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/gather', { form: data, maxRedirects: 0 })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  admin = await as('elm-admin@hearts.test', 'portal-admin')
  learner = await as('elm-learner@hearts.test', 'portal-learner')
  learner2 = await as('elm-learner2@hearts.test', 'portal-learner')
})

test.afterAll(async () => {
  await master?.dispose()
  await admin?.dispose()
  await learner?.dispose()
  await learner2?.dispose()
})

test('RSVP, waitlist promotion, public page, calendar, QR check-in and activation', async ({ page }) => {
  const lessons = (await (await master.get('/api/lessons?limit=1&depth=0&sort=id')).json()) as { docs: { id: number; course: number; title: string }[] }
  const lesson = lessons.docs[0]
  expect(lesson?.id).toBeTruthy()
  const point = await master.post('/api/engagement-points', {
    data: {
      lesson: lesson.id,
      second: 12,
      kind: 'task',
      family: 'task',
      prompt: `Sit with others from your masjid and thank one person this week ${sfx}.`,
      status: 'published',
      evidence: 'note',
      dueDays: 7,
      showImam: true,
    },
  })
  expect(point.ok(), await point.text()).toBeTruthy()
  const pointId = ((await point.json()) as { doc: { id: number } }).doc.id

  const when = '2026-10-08T19:00'
  const saved = await form(admin, {
    action: 'save',
    portal: 'east-london',
    title: `Tea after class ${sfx}`,
    kind: 'tea',
    audience: 'all',
    startsAt: when,
    place: 'East London Mosque hall',
    mapUrl: 'https://maps.example/elm',
    capacity: '1',
    bring: 'Nothing but yourself',
    note: 'We will sit with the talk.',
    hostLabel: 'Amina',
    lesson: String(lesson.id),
    course: String(lesson.course),
    task: String(pointId),
    door: '7',
    next: '/p/east-london/admin/gather',
  })
  expect(loc(saved)).toContain('notice=')
  const listed = (await (await master.get(`/api/gatherings?where[title][equals]=${encodeURIComponent(`Tea after class ${sfx}`)}&depth=0`)).json()) as { docs: { id: number; slug: string; checkinToken: string }[] }
  const gathering = listed.docs[0]
  expect(gathering.slug).toBeTruthy()

  const going = await form(learner, { action: 'rsvp', id: String(gathering.id), choice: 'going', next: `/p/east-london/gather/${gathering.id}` })
  expect(loc(going)).toContain('You’re down as coming')
  const waiting = await form(learner2, { action: 'rsvp', id: String(gathering.id), choice: 'going', next: `/p/east-london/gather/${gathering.id}` })
  expect(loc(waiting)).toContain('head of the list')
  const declined = await form(learner, { action: 'rsvp', id: String(gathering.id), choice: 'cant', next: `/p/east-london/gather/${gathering.id}` })
  expect(loc(declined)).toContain('next person')
  const promoted = (await (await master.get(`/api/gather-rsvps?where[gathering][equals]=${gathering.id}&depth=0&limit=10`)).json()) as { docs: { status: string; user: number }[] }
  const hamza = (await (await master.get('/api/users?where[email][equals]=elm-learner2@hearts.test&depth=0')).json()) as { docs: { id: number }[] }
  expect(promoted.docs.find((row) => row.user === hamza.docs[0].id)?.status).toBe('going')

  const anon = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const pageRes = await anon.get(`/gather/${gathering.slug}`)
  expect(pageRes.status()).toBe(200)
  const html = await pageRes.text()
  expect(html).toContain('Tea after class')
  expect(html).toContain('data-testid="public-gather"')
  expect(html).not.toContain('elm-learner')
  expect(html).not.toContain('Amina Yusuf')
  const guest = await anon.post('/api/gather', {
    form: { action: 'guest', slug: gathering.slug, name: 'Yusuf', contact: 'yusuf@example.com', choice: 'maybe', next: `/gather/${gathering.slug}` },
    maxRedirects: 0,
  })
  expect(loc(guest)).toContain('maybe')
  const ics = await anon.get(`/gather/${gathering.slug}/event.ics`)
  expect(ics.headers()['content-type'] || '').toContain('text/calendar')
  const calendar = await ics.text()
  expect(calendar).toContain('BEGIN:VCALENDAR')
  expect(calendar).toContain('SUMMARY:Tea after class')
  await anon.dispose()

  await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/gather/${gathering.slug}/in?k=${gathering.checkinToken}`)
  await expect(page.getByTestId('qr-checkin')).toBeVisible()
  await page.getByTestId('qr-checkin').click()
  await expect(page.getByTestId('gather-reflect')).toBeVisible()
  await page.getByTestId('reflect-body').fill('I will carry the quiet of sitting with people from the masjid.')
  await page.getByTestId('reflect-submit').click()
  await expect(page.getByTestId('reflection-saved')).toContainText('I will carry the quiet')

  const answers = (await (await master.get(`/api/answers?where[point][equals]=${pointId}&where[viaGathering][equals]=true&depth=0`)).json()) as { docs: { id: number; viaGathering: boolean; sourceLevel: string }[] }
  expect(answers.docs.length).toBeGreaterThan(0)
  expect(answers.docs[0].viaGathering).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/gather')
  await expect(page.getByTestId('desk-gather')).toBeVisible()
  await page.getByTestId('attendance-link').click()
  await expect(page.getByTestId('desk-attendance')).toBeVisible()
  const csv = await admin.get('/api/gather?export=1&portal=east-london')
  expect((await csv.text())).toContain('Tea after class')
})
