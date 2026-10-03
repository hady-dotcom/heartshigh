import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'

// Round 3: one test per bug from the hostile pass, named by its number. Each one failed before its fix.

const PORTAL = 'east-london'
const sfx = Date.now().toString().slice(-6)
const DESK = { width: 1440, height: 900 }

let master: APIRequestContext

async function as(email?: string, password?: string, headers?: Record<string, string>) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: headers })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}
const form = (ctx: APIRequestContext, data: Record<string, string>) => ctx.post('/api/hearts', { form: data, maxRedirects: 0 })
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))
const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>

async function user(email: string) {
  return (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0`))).docs[0] as { id: number; tenants?: { tenant: number | { id: number } }[] }
}
async function lessonBy(where: string) {
  return (await json(await master.get(`/api/lessons?${where}&depth=0`))).docs[0] as { id: number; course: number; youtubeId?: string; durationSeconds?: number }
}
async function scenes() {
  return (await json(await master.get('/api/opening-scenes?depth=0&limit=20&sort=order'))).docs as { id: number; key: string }[]
}
async function resetClockAndLimits() {
  await form(master, { action: 'clock', iso: '', next: '/' })
}
async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}
const tile = (scene: string, option: string) => `[data-testid="scene"][data-scene="${scene}"] [data-testid="tile"][data-option="${option}"]`
const PICKS: [string, string][] = [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['doors', 'calmer']]

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})
test.afterAll(async () => {
  await resetClockAndLimits()
  await master?.dispose()
})

test.describe('round 3 API', () => {
  test('Bug 1: one account adds at most one trend row a week, whatever nonce it sends', async () => {
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    await form(learner, { action: 'me-pref', name: 'trendsOptIn', value: 'on', next: '/' })
    // Round 4 N3: only an account with a finished video that is at least a day old counts towards trends.
    const pack = await json(await master.get('/api/packs/1?depth=0'))
    const course = (pack.courses as (number | { id: number })[]).map((row) => (typeof row === 'number' ? row : row.id))[0]
    const part = (await json(await master.get(`/api/lessons?where[course][equals]=${course}&limit=1&depth=0`))).docs[0]
    await form(learner, { action: 'complete', lesson: String(part.id), ended: 'yes', next: '/' })
    await form(master, { action: 'clock', iso: new Date(Date.now() + 2 * 86_400_000).toISOString(), next: '/' })
    let created = 0
    let repeats = 0
    for (let i = 0; i < 6; i++) {
      const response = await learner.post('/api/hearts/contribute', { data: { isoWeek: '2026-W40', nonceHash: `${sfx}${i}`.padEnd(16, 'a'), doorKey: 'calmer', laneTop2: ['trust', 'company'] } })
      expect(response.status()).toBeLessThan(300)
      if (response.status() === 201) created++
      if ((await json(response)).duplicate) repeats++
    }
    expect(created).toBeLessThanOrEqual(1)
    expect(repeats).toBeGreaterThanOrEqual(5)
    await form(learner, { action: 'me-pref', name: 'trendsOptIn', value: 'off', next: '/' })
    await resetClockAndLimits()
  })

  test('Bug 2: codes have expiry, max uses and a switch; a one-use code refuses a second person; guessing is throttled; seed codes are random', async () => {
    const codes = (await json(await master.get('/api/access-codes?limit=100&depth=0'))).docs as Record<string, any>[]
    expect(codes.length).toBeGreaterThan(0)
    for (const key of ['expiresAt', 'maxUses', 'uses', 'disabled']) expect(Object.keys(codes[0])).toContain(key)
    expect(codes.map((code) => code.code)).not.toContain('ELM-LEARN')
    expect(codes.map((code) => code.code)).not.toContain('ELM-ADMIN')
    expect(seedCode('elm-learner')).toMatch(/^ELM-[A-Z0-9]{4}-[A-Z0-9]{4}$/)

    const elm = codes.find((code) => code.code === seedCode('elm-learner'))!
    const portalSlug = PORTAL
    const made = await form(master, { action: 'create-code', portalSlug, role: 'admin', pack: '1', maxUses: '1', label: `r3-admin-${sfx}`, next: '/master' })
    const adminCode = /(?:code|Code) ([A-Z0-9-]{8,})/.exec(loc(made))?.[1]
    expect(adminCode, loc(made)).toBeTruthy()
    const first = await form(await as(), { action: 'join', code: adminCode!, name: 'First admin', email: `r3-adm1-${sfx}@hearts.test`, password: 'round-three-1' })
    expect(loc(first)).toContain('/admin')
    const second = await form(await as(), { action: 'join', code: adminCode!, name: 'Second admin', email: `r3-adm2-${sfx}@hearts.test`, password: 'round-three-1' })
    expect(loc(second)).toMatch(/error=.*already been used/)

    await master.patch(`/api/access-codes/${elm.id}`, { data: { disabled: true } })
    const off = await form(await as(), { action: 'join', code: elm.code, name: 'Off', email: `r3-off-${sfx}@hearts.test`, password: 'round-three-1' })
    expect(loc(off)).toContain('not recognised')
    await master.patch(`/api/access-codes/${elm.id}`, { data: { disabled: false, expiresAt: '2020-01-01T00:00:00.000Z' } })
    const expired = await form(await as(), { action: 'join', code: elm.code, name: 'Late', email: `r3-late-${sfx}@hearts.test`, password: 'round-three-1' })
    expect(loc(expired)).toContain('expired')
    await master.patch(`/api/access-codes/${elm.id}`, { data: { expiresAt: null } })

    const guesser = await as(undefined, undefined, { 'x-forwarded-for': `10.3.${Number(sfx) % 250}.7` })
    const statuses: number[] = []
    for (let i = 0; i < 14; i++) statuses.push((await form(guesser, { action: 'join', code: `ELM-GUESS-${i}`, name: 'x', email: `r3-g${i}-${sfx}@hearts.test`, password: 'round-three-1' })).status())
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0)
    await resetClockAndLimits()
  })

  test('Bug 3: a portal admin cannot get round the opening rules over REST, and cannot move the setup to another portal', async () => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const config = (await json(await admin.get('/api/opening-configs?depth=0'))).docs[0]
    expect(config).toBeTruthy()
    const all = await scenes()
    const hideAll = await admin.patch(`/api/opening-configs/${config.id}`, { data: { hiddenScenes: all.map((scene) => scene.id) } })
    expect(hideAll.status()).toBeGreaterThanOrEqual(400)
    const noHelp = await admin.patch(`/api/opening-configs/${config.id}`, { data: { helpContacts: [{ label: 'Bad', url: 'javascript:alert(1)' }] } })
    expect(noHelp.status()).toBeGreaterThanOrEqual(400)
    const leeds = (await json(await master.get('/api/portals?where[slug][equals]=leeds&depth=0'))).docs[0]
    const move = await admin.patch(`/api/opening-configs/${config.id}`, { data: { portal: leeds.id } })
    expect(move.status()).toBeGreaterThanOrEqual(400)
    const after = (await json(await master.get(`/api/opening-configs/${config.id}?depth=0`)))
    expect(after.portal).toBe(config.portal)
    expect(after.hiddenScenes?.length || 0).toBe(config.hiddenScenes?.length || 0)
  })

  test('Bug 4: a heart-state row is always the signed-in person, and only with Keep my place on', async () => {
    const hamza = await as('elm-learner2@hearts.test', 'portal-learner')
    const maryam = await user('elm-learner@hearts.test')
    const me = await user('elm-learner2@hearts.test')
    await form(hamza, { action: 'me-pref', name: 'keepPlace', value: 'off', next: '/' })
    expect((await hamza.post('/api/heart-states', { data: { user: me.id, state: { taps: [] } } })).status()).toBe(403)
    await form(hamza, { action: 'me-pref', name: 'keepPlace', value: 'on', next: '/' })
    const forged = await hamza.post('/api/heart-states', { data: { user: maryam.id, state: { taps: [] } } })
    const doc = (await json(forged)).doc
    if (forged.ok()) expect(typeof doc.user === 'object' ? doc.user.id : doc.user).toBe(me.id)
    const rows = (await json(await master.get(`/api/heart-states?where[user][equals]=${maryam.id}&depth=0`))).docs as unknown[]
    expect(rows.length).toBe(0)
    await form(hamza, { action: 'me-pref', name: 'keepPlace', value: 'off', next: '/' })
  })

  test('Bug 6: a private answer is read by its owner only, not the teacher, the admin or the master', async () => {
    const nur = await lessonBy(`where[youtubeId][equals]=NIR88RRpat4`)
    const point = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&where[kind][equals]=reflection&where[status][equals]=published&depth=0&limit=10`))).docs[0]
    const hamza = await as('elm-learner2@hearts.test', 'portal-learner')
    const saved = await hamza.post('/api/answers', { data: { pointId: point.id, body: `Private round three ${sfx}`, keepPrivate: true } })
    expect(saved.ok(), await saved.text()).toBeTruthy()
    const mine = (await json(await hamza.get('/api/answers?limit=200&depth=0'))).docs as { body?: string }[]
    expect(mine.some((row) => row.body === `Private round three ${sfx}`)).toBeTruthy()
    for (const [email, password] of [['elm-teacher@hearts.test', 'portal-teacher'], ['elm-admin@hearts.test', 'portal-admin'], ['elm-learner@hearts.test', 'portal-learner'], ['master@hearts.test', 'hearts-master']]) {
      const other = await as(email, password)
      const rows = (await json(await other.get('/api/answers?limit=500&depth=0'))).docs as { body?: string; keepPrivate?: boolean; user?: number }[]
      expect(rows.some((row) => row.body === `Private round three ${sfx}`), email).toBeFalsy()
    }
  })

  test('Bug 7: nothing is written while viewing as someone, globals and new portals included', async () => {
    const elmAdmin = await user('elm-admin@hearts.test')
    const viewer = await as('master@hearts.test', 'hearts-master')
    const start = await viewer.post('/api/view-as/start', { data: { targetUserId: elmAdmin.id, reason: 'Round three read-only check' } })
    expect(start.ok(), await start.text()).toBeTruthy()
    const flags = await viewer.post('/api/globals/master-flags', { data: { popupOverPlayer: false } })
    expect(flags.status()).toBe(403)
    const portal = await viewer.post('/api/portals', { data: { name: 'Made in view-as', slug: `viewas-${sfx}` } })
    expect(portal.status()).toBeGreaterThanOrEqual(400)
    await viewer.post('/api/view-as/stop')
    expect((await json(await master.get('/api/globals/master-flags'))).popupOverPlayer).not.toBe(false)
  })

  test('Bug 8: joining is refused and audited while viewing as someone, even with changes allowed', async () => {
    const maryam = await user('elm-learner@hearts.test')
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    await admin.post('/api/view-as/stop')
    expect((await admin.post('/api/view-as/start', { data: { targetUserId: maryam.id, reason: 'Round three join check' } })).ok()).toBeTruthy()
    expect((await admin.post('/api/view-as/write', { data: { on: true, reason: 'Fixing a name typo for her' } })).ok()).toBeTruthy()
    const email = `r3-viewas-join-${sfx}@hearts.test`
    const joined = await form(admin, { action: 'join', code: seedCode('elm-learner'), name: 'Made during view-as', email, password: 'round-three-1' })
    expect(joined.status()).toBe(403)
    expect((await json(await master.get(`/api/users?where[email][equals]=${email}&depth=0`))).docs.length).toBe(0)
    const audit = (await json(await master.get('/api/audit-log?sort=-createdAt&limit=10&depth=0'))).docs as { event?: string; detail?: { action?: string } }[]
    expect(audit.some((row) => row.event === 'view_as.blocked_write' && row.detail?.action === 'join')).toBeTruthy()
    await admin.post('/api/view-as/stop')
  })

  test('Bug 9: only the master moves the test clock, and signed-out reads of it are refused', async () => {
    const anon = await as()
    expect((await anon.get('/api/hearts?clock=1')).status()).toBe(403)
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    expect((await learner.get('/api/hearts?clock=1')).status()).toBe(403)
    const moved = await form(learner, { action: 'clock', iso: '2030-01-01T00:00:00Z', next: '/' })
    expect(moved.status()).toBe(403)
    expect((await json(await master.get('/api/hearts?clock=1'))).now).not.toMatch(/^2030/)
  })

  test('Bug 11: a portal hides at most two scenes and never the one with the help option', async () => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const all = await scenes()
    const byKey = Object.fromEntries(all.map((scene) => [scene.key, scene.id]))
    const hide = (key: string, hidden: boolean) => form(admin, { action: 'opening-config', portalSlug: PORTAL, scene: String(byKey[key]), caption: '', ...(hidden ? { hidden: 'on' } : {}), next: `/p/${PORTAL}/admin/opening` })
    expect(loc(await hide('visitor', true))).toContain('help option cannot be hidden')
    expect(loc(await hide('extra', true))).not.toContain('error=')
    expect(loc(await hide('queue', true))).not.toContain('error=')
    expect(loc(await hide('thumb', true))).toContain('error=')
    const served = (await json(await (await as()).get(`/api/hearts/opening?portal=${PORTAL}`))).scenes as { key: string }[]
    expect(served.length).toBe(4)
    expect(served.map((scene) => scene.key)).toContain('visitor')
    for (const key of ['extra', 'queue', 'thumb']) await hide(key, false)
  })

  test('Bug 12: reserved portal addresses are refused by the form and by REST', async () => {
    for (const slug of ['api', 'master', 'www']) {
      const made = await form(master, { action: 'create-portal', name: `Reserved ${slug}`, slug, kind: 'church', next: '/master' })
      expect(loc(made)).toContain('reserved')
    }
    expect((await master.post('/api/portals', { data: { name: 'Bad admin', slug: 'admin' } })).status()).toBeGreaterThanOrEqual(400)
  })

  test('Bug 13: help contacts take tel and https only, and the help screen shows plain text', async ({ page }) => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const bad = await form(admin, { action: 'help-contact', portalSlug: PORTAL, label: '<img src=x onerror=alert(1)>Help', url: 'javascript:alert(document.cookie)', phone: '<b>999</b>', next: `/p/${PORTAL}/admin/opening` })
    expect(loc(bad)).toContain('error=')
    await page.goto(`/p/${PORTAL}/help`)
    await expect(page.getByTestId('help-contact').first()).toBeVisible()
    const hrefs = await page.getByTestId('help-contacts').locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href') || ''))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) expect(href).toMatch(/^(tel:\+?\d+|https:\/\/)/)
    expect(await page.getByTestId('help-contacts').innerHTML()).not.toContain('<img')
  })

  test('Bug 15: Al-Nur plays the full class and the seed holds every timing inside its talk', async () => {
    const nur = await lessonBy(`where[title][equals]=${encodeURIComponent('The Names Class 20: Al-Nur')}`)
    expect(nur.youtubeId).toBe('NIR88RRpat4')
    expect(nur.durationSeconds).toBe(2861)
    const points = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${nur.id}&depth=0&limit=50`))).docs as { second: number }[]
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) expect(point.second).toBeLessThanOrEqual(2861)
  })

  test('Bug 21: plans are capped at a year, take a season name, and say 1 sitting', async () => {
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    const nur = await lessonBy(`where[youtubeId][equals]=NIR88RRpat4`)
    const long = await form(learner, { action: 'schedule', name: '', targetType: 'course', course: String(nur.course), start: '2026-10-05', end: '2036-10-05', weekday: '1', next: `/p/${PORTAL}/me/plan` })
    expect(loc(long)).toContain('a year or less')
    const one = await form(learner, { action: 'schedule', name: '', targetType: 'course', course: String(nur.course), start: '2026-10-05', end: '2026-10-05', weekday: '1', next: `/p/${PORTAL}/me/plan` })
    expect(loc(one)).toContain('The 1 sitting is spread across 1 study day')
    const plan = (await json(await master.get('/api/schedules?sort=-createdAt&limit=1&depth=0'))).docs[0]
    expect(plan.name).toMatch(/^(Winter|Spring|Summer|Autumn) study days$/)
  })

  test('Bug 24: master flags are not readable signed out; unplayable reports need sign-in and are rate-limited', async () => {
    const anon = await as()
    expect((await anon.get('/api/globals/master-flags')).status()).toBeGreaterThanOrEqual(401)
    const cut = (await json(await master.get('/api/cuts?limit=1&depth=0'))).docs[0]
    expect((await anon.post('/api/hearts/unplayable', { data: { cutId: cut.id, code: 5 } })).status()).toBe(401)
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) statuses.push((await learner.post('/api/hearts/unplayable', { data: { cutId: cut.id, code: 5 } })).status())
    expect(statuses).toContain(429)
    await resetClockAndLimits()
  })

  test('Bug 25: leaving view-as goes back to a path on this site, never localhost', async () => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const maryam = await user('elm-learner@hearts.test')
    await admin.post('/api/view-as/stop')
    await admin.post('/api/view-as/start', { data: { targetUserId: maryam.id, reason: 'Round three exit check', returnTo: 'https://evil.example/phish' } })
    const exit = await admin.get('/api/view-as/exit-redirect', { maxRedirects: 0 })
    const location = exit.headers()['location'] || ''
    expect(location.startsWith('/')).toBeTruthy()
    expect(location).not.toContain('localhost')
    expect(location).not.toContain('evil.example')
  })

  test('Bug 26: a view-as reason, and a reason to allow changes, need at least 10 characters', async () => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const maryam = await user('elm-learner@hearts.test')
    await admin.post('/api/view-as/stop')
    expect((await admin.post('/api/view-as/start', { data: { targetUserId: maryam.id, reason: 'too short' } })).status()).toBe(400)
    expect((await admin.post('/api/view-as/start', { data: { targetUserId: maryam.id, reason: 'Checking her plan page' } })).ok()).toBeTruthy()
    expect((await admin.post('/api/view-as/write', { data: { on: true, reason: 'fix' } })).status()).toBe(400)
    expect((await admin.post('/api/view-as/write', { data: { on: true, reason: 'Fixing a typo' } })).ok()).toBeTruthy()
    await admin.post('/api/view-as/stop')
  })
})

test.describe('round 3 screens', () => {
  test('Bug 5: nothing tap-derived leaves the device before sign-up, and the feed API refuses strangers', async ({ page }) => {
    const bodies: string[] = []
    page.on('request', (request) => {
      if (request.method() !== 'GET') bodies.push(`${request.url()} ${request.postData() || ''}`)
    })
    await page.goto(`/p/${PORTAL}/start`)
    await page.getByTestId('lets-play').click()
    for (const [scene, option] of PICKS) await page.locator(tile(scene, option)).click()
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
    await page.waitForTimeout(1500)
    for (const body of bodies) expect(body).not.toMatch(/laneScores|"taps"|"served"|"lead"|optionKey|sceneKey/)
    expect((await page.request.post(`/api/hearts/feed?portal=${PORTAL}`, { data: { laneScores: { trust: 1 } } })).status()).toBe(401)
    expect(await page.getByTestId('journey').getAttribute('data-cuts')).toBeTruthy()
  })

  test('Bug 14: the 14-day chart bars have width', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin`)
    await page.goto(`/p/${PORTAL}/admin`)
    const slots = page.getByTestId('chart-slot')
    await expect(slots).toHaveCount(14)
    const widths = await slots.evaluateAll((els) => els.map((el) => (el.querySelector('i') as HTMLElement).getBoundingClientRect().width))
    for (const width of widths) expect(width).toBeGreaterThan(10)
  })

  test('Bug 16: a reload in the middle of the opening keeps the taps and the scene', async ({ page }) => {
    await page.goto(`/p/${PORTAL}/start`)
    await page.getByTestId('lets-play').click()
    for (const [scene, option] of PICKS.slice(0, 3)) await page.locator(tile(scene, option)).click()
    await expect(page.locator('[data-testid="scene"][data-scene="visitor"]')).toBeVisible()
    await page.reload()
    await expect(page.locator('[data-testid="scene"][data-scene="visitor"]')).toBeVisible()
    expect(page.url()).toMatch(/\/start\/4$/)
    const taps = await page.evaluate(() => (JSON.parse(localStorage.getItem('hearts.heart.v1') || '{}').taps || []).map((tap: { scene: string }) => tap.scene))
    expect(taps).toEqual(['extra', 'queue', 'thumb'])
    await page.goBack()
    await expect(page.locator('[data-testid="scene"][data-scene="thumb"]')).toBeVisible()
  })

  test('Bug 17: a double tap moves one scene and adds one history entry', async ({ page }) => {
    await page.goto(`/p/${PORTAL}/start`)
    await page.getByTestId('lets-play').click()
    await expect(page.locator(tile('extra', 'pause'))).toBeVisible()
    await page.waitForTimeout(400)
    const before = await page.evaluate(() => history.length)
    await page.evaluate(() => {
      const option = document.querySelector('[data-scene="extra"] [data-option="pause"]') as HTMLElement
      option.click()
      option.click()
    })
    await expect(page.locator('[data-testid="scene"][data-scene="queue"]')).toBeVisible()
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => history.length)).toBe(before + 1)
    expect(page.url()).toMatch(/\/start\/2$/)
    const taps = await page.evaluate(() => (JSON.parse(localStorage.getItem('hearts.heart.v1') || '{}').taps || []).length)
    expect(taps).toBe(1)
  })

  test('Bug 18: a narrow screen gets a laptop note instead of the desk', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 })
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin`)
    await expect(page.getByTestId('desk-narrow')).toBeVisible()
    await expect(page.getByTestId('desk-narrow')).toContainText('Open this on a laptop or desktop')
    await expect(page.getByTestId('admin-overview')).toBeHidden()
    await page.setViewportSize(DESK)
    await expect(page.getByTestId('desk-narrow')).toBeHidden()
    await expect(page.getByTestId('admin-overview')).toBeVisible()
  })

  test('Bug 19: the question sheet never covers the film, in either layout', async ({ page }) => {
    const nur = await lessonBy(`where[youtubeId][equals]=NIR88RRpat4`)
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    for (const over of [true, false]) {
      await master.post('/api/globals/master-flags', { data: { popupOverPlayer: over } })
      await page.goto(`/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
      await expect(page.getByTestId('player')).toHaveAttribute('data-popup-layout', over ? 'over' : 'strict')
      await page.evaluate(() => window.scrollTo(0, 400))
      await page.getByTestId('answer-point').click()
      await expect(page.getByTestId('popup')).toBeVisible()
      await page.waitForTimeout(400)
      const geo = await page.evaluate(() => {
        const box = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() || null
        return { film: box('.player-card .yt'), card: box('[data-testid=player-card]'), popup: box('[data-testid=popup]'), scrim: box('[data-testid=popup-scrim]') }
      })
      const guard = over ? geo.film! : geo.card!
      expect(geo.film!.height).toBeGreaterThan(50)
      expect(geo.film!.top).toBeGreaterThanOrEqual(-1)
      expect(geo.popup!.top).toBeGreaterThanOrEqual(guard.bottom - 1)
      expect(geo.scrim!.top).toBeGreaterThanOrEqual(guard.bottom - 1)
      await page.getByTestId('popup-close').click()
    }
    await master.post('/api/globals/master-flags', { data: { popupOverPlayer: true } })
  })

  test('Bug 22: a brand-new portal can choose courses from the central library', async ({ page }) => {
    const slug = `r3-church-${sfx}`
    expect(loc(await form(master, { action: 'create-portal', name: `Round three church ${sfx}`, slug, kind: 'church', next: '/master' }))).not.toContain('error=')
    expect(loc(await form(master, { action: 'create-pack', portalSlug: slug, title: `Round three pack ${sfx}`, next: '/master' }))).not.toContain('error=')
    const pack = (await json(await master.get(`/api/packs?where[title][equals]=${encodeURIComponent(`Round three pack ${sfx}`)}&depth=0`))).docs[0]
    const made = await form(master, { action: 'create-code', portalSlug: slug, role: 'admin', pack: String(pack.id), code: `R3ADM${sfx}`, next: '/master' })
    expect(loc(made)).not.toContain('error=')
    await page.setViewportSize(DESK)
    await page.goto(`/join?code=R3ADM${sfx}`)
    await page.getByTestId('join-name').fill('Round Three Admin')
    await page.getByTestId('join-email').fill(`r3-church-${sfx}@hearts.test`)
    await page.getByTestId('join-password').fill('round-three-1')
    await page.getByTestId('join-submit').click()
    await page.waitForURL(/\/admin/)
    await page.goto(`/p/${slug}/admin/library`)
    const offered = page.getByTestId('split-course')
    expect(await offered.count()).toBeGreaterThan(0)
    await expect(offered.first()).toContainText('from the library')
  })

  test('Bug 23: Home Continue rows put the title and the speaker line on separate lines', async ({ page }) => {
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}`)
    await page.goto(`/p/${PORTAL}`)
    const row = page.getByTestId('continue-row').first()
    await expect(row).toBeVisible()
    const [title, sub] = await Promise.all([row.locator('b').boundingBox(), row.locator('small').boundingBox()])
    expect(sub!.y).toBeGreaterThanOrEqual(title!.y + title!.height - 1)
    expect(await row.locator('.t').textContent()).toMatch(/\. \S/)
  })

  test('Bug 27: What others said stays hidden until the learner opts in', async ({ page }) => {
    const nur = await lessonBy(`where[youtubeId][equals]=NIR88RRpat4`)
    const learner = await as('elm-learner2@hearts.test', 'portal-learner')
    await form(learner, { action: 'me-pref', name: 'shareWithLearners', value: 'off', next: '/' })
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await page.getByTestId('answer-point').click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('swarm')).toHaveCount(0)
    await form(learner, { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: '/' })
    await page.reload()
    await page.getByTestId('answer-point').click()
    await expect(page.getByTestId('swarm')).toHaveCount(1)
    await form(learner, { action: 'me-pref', name: 'shareWithLearners', value: 'off', next: '/' })
  })

  test('Bug 28: no hydration warnings on the desks', async ({ page }) => {
    const problems: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat|did not match|server rendered/i.test(message.text())) problems.push(message.text().slice(0, 200))
    })
    page.on('pageerror', (error) => {
      if (/hydrat/i.test(error.message)) problems.push(error.message.slice(0, 200))
    })
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin`)
    for (const screen of ['', '/library', '/access', '/plans', '/opening', '/teach', '/settings']) {
      await page.goto(`/p/${PORTAL}/admin${screen}`)
      await page.waitForLoadState('networkidle')
    }
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
    for (const screen of ['', '/library', '/tiers', '/opening', '/lanes', '/trends']) {
      await page.goto(`/master${screen}`)
      await page.waitForLoadState('networkidle')
    }
    expect(problems).toEqual([])
  })

  test('Section T: the appetiser offers the main from 0:00 and a resume link at its out point; drafts stay off the learner side', async ({ page }) => {
    await page.goto(`/p/${PORTAL}/start`)
    await page.getByTestId('lets-play').click()
    for (const [scene, option] of PICKS) await page.locator(tile(scene, option)).click()
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
    await page.getByTestId('watch-full').click()
    const start = page.getByTestId('start-course')
    await expect(start).toBeVisible()
    expect(await start.getAttribute('href')).toMatch(/&t=0$/)
    await expect(start).toContainText('from the start')
    const resume = page.getByTestId('resume-main')
    await expect(resume).toBeVisible()
    const href = (await resume.getAttribute('href')) || ''
    const lessonId = Number(/part=(\d+)/.exec(href)?.[1])
    const at = Number(/&t=(\d+)/.exec(href)?.[1])
    const tier = (await json(await master.get(`/api/talk-tiers?where[lesson][equals]=${lessonId}&depth=0`))).docs[0]
    expect(tier).toBeTruthy()
    expect(at).toBe(Math.floor(tier.appetiserEnd))
    expect(tier.appetiserEnd - tier.appetiserStart).toBeLessThanOrEqual(195)
    expect(tier.horsEnd - tier.horsStart).toBeGreaterThanOrEqual(15)
    expect(tier.horsEnd - tier.horsStart).toBeLessThanOrEqual(20)

    const tiers = (await json(await master.get('/api/talk-tiers?limit=100&depth=0'))).docs as { status: string; note?: string }[]
    expect(tiers.length).toBeGreaterThanOrEqual(31)
    expect(tiers.filter((row) => row.status === 'draft').length).toBeGreaterThanOrEqual(30)
    const drafts = (await json(await master.get(`/api/engagement-points?where[lesson][equals]=${lessonId}&where[status][equals]=draft&depth=0`))).docs as unknown[]
    expect(drafts.length).toBeGreaterThanOrEqual(2)
    const lesson = await lessonBy(`where[id][equals]=${lessonId}`)
    const flags = await json(await master.get('/api/globals/master-flags'))
    await master.post('/api/globals/master-flags', { data: { showUnchecked: false } })
    try {
      await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${lesson.course}?part=${lessonId}`)
      await expect(page.getByTestId('player')).toBeVisible()
      await expect(page.getByTestId('timeline-dot')).toHaveCount(0)
    } finally {
      await master.post('/api/globals/master-flags', { data: { showUnchecked: flags.showUnchecked !== false } })
    }
  })

  test('Section T: the master checks a talk in the tier editor and publishes a pop-up', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/tiers')
    await expect(page.getByTestId('tier-row')).toHaveCount(31)
    await page.getByTestId('tier-open').first().click()
    await expect(page.getByTestId('tier-editor')).toBeVisible()
    const start = Number(await page.getByTestId('hors-start-seconds').inputValue())
    await page.getByTestId('hors-end-seconds').fill(String(start + 30))
    await expect(page.getByTestId('tier-warnings')).toContainText('between 15 and 20')
    await page.getByTestId('hors-end-seconds').fill(String(start + 60))
    await expect(page.getByTestId('tier-warnings')).toContainText('Keep it to')
    await page.getByTestId('tier-save').click()
    await expect(page.getByTestId('error')).toContainText('Keep it to')
    await expect(async () => {
      await page.getByTestId('hors-end-seconds').fill(String(start + 18))
      await page.getByTestId('preview-appetiser').click()
      await expect(page.getByTestId('tier-preview-frame')).toHaveAttribute('src', /start=\d+&end=\d+/, { timeout: 2000 })
    }).toPass()
    await expect(page.getByTestId('tier-ok')).toBeVisible()
    await page.getByTestId('use-land').first().click()
    await page.getByTestId('tier-check').click()
    await expect(page.getByTestId('notice')).toContainText('checked')
    const row = page.getByTestId('popup-row').first()
    await expect(row).toHaveAttribute('data-status', 'draft')
    await row.getByTestId('popup-publish').click()
    await expect(page.getByTestId('popup-row').first()).toHaveAttribute('data-status', 'published')
    await page.getByTestId('popup-row').first().getByTestId('popup-publish').click()
    await expect(page.getByTestId('popup-row').first()).toHaveAttribute('data-status', 'draft')

    await page.goto('/master/review')
    await expect(page.getByTestId('hors-max')).toHaveValue('45')
    await page.getByTestId('hors-max').fill('40')
    await page.getByTestId('hors-max-save').click()
    await expect(page.getByTestId('notice')).toContainText('40 seconds')
    await expect(page.getByTestId('hors-max')).toHaveValue('40')
    await page.getByTestId('hors-max').fill('45')
    await page.getByTestId('hors-max-save').click()
    await expect(page.getByTestId('notice')).toContainText('45 seconds')
  })
})
