import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'

// Round 4: one test per item from the retest, named by its label. Each one failed before its fix.

const PORTAL = 'east-london'
const sfx = Date.now().toString().slice(-6)
const DESK = { width: 1440, height: 900 }
const LESSONS_1_TO_3 = ['TLCGBj4AlB0', 'ECaTWkof57E', 'NIR88RRpat4']

type Clip = { cutId: number; youtubeId: string | null; lessonId: number; speakerSlug: string; style: unknown; hors: { start: number; end: number }; appetiser: { start: number; end: number; lines?: { at: number; text: string; role?: string }[] }; hook: string; turn: string; land: string }
type Tier = { id: number; lesson: number; status: string; horsStart: number; horsEnd: number; appetiserStart: number; appetiserEnd: number; hook: string; turn: string; land: string; horsQuote: string; note?: string; offerResume?: boolean; hookAt: number; turnAt: number; landAt: number }

let master: APIRequestContext

async function as(email?: string, password?: string, headers?: Record<string, string>) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: headers })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
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
async function lessonOf(youtubeId: string) {
  return (await json(await master.get(`/api/lessons?where[youtubeId][equals]=${youtubeId}&depth=0`))).docs[0] as { id: number; course: number }
}
async function tierOf(lessonId: number) {
  return (await json(await master.get(`/api/talk-tiers?where[lesson][equals]=${lessonId}&depth=0`))).docs[0] as Tier
}
async function clips(ctx: APIRequestContext = master) {
  return Object.values((await json(await ctx.get(`/api/hearts/opening?portal=${PORTAL}`))).clips || {}) as Clip[]
}
function saveTier(tier: Tier, change: Partial<Tier>, extra: Record<string, string> = {}) {
  const row = { ...tier, ...change }
  return form(master, {
    action: 'tier-save', tier: String(tier.id), next: '/master/tiers',
    horsStart: String(row.horsStart), horsEnd: String(row.horsEnd), appetiserStart: String(row.appetiserStart), appetiserEnd: String(row.appetiserEnd),
    hook: row.hook, turn: row.turn, land: row.land, horsQuote: row.horsQuote, note: row.note || '', ...(row.offerResume !== false ? { offerResume: 'on' } : {}), ...extra,
  })
}
function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1
}
async function resetClockAndLimits() {
  await form(master, { action: 'clock', iso: '', next: '/' })
}

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})
test.afterAll(async () => {
  await resetClockAndLimits()
  await master?.dispose()
})

test.describe('round 4 API', () => {
  test('N4: the tier record is what learners get for lessons 1 to 3, one clip per talk, and an edit reaches them at once', async () => {
    const served = await clips()
    for (const youtubeId of LESSONS_1_TO_3) {
      const lesson = await lessonOf(youtubeId)
      const tier = await tierOf(lesson.id)
      const own = served.filter((clip) => clip.lessonId === lesson.id)
      expect(own.length, `${youtubeId} is served through one carrier cut`).toBe(1)
      const clip = own[0]
      expect([clip.hors.start, clip.hors.end], youtubeId).toEqual([tier.horsStart, tier.horsEnd])
      expect([clip.appetiser.start, clip.appetiser.end], youtubeId).toEqual([tier.appetiserStart, tier.appetiserEnd])
      expect([clip.hook, clip.turn, clip.land], youtubeId).toEqual([tier.hook, tier.turn, tier.land])
      expect(clip.appetiser.lines?.map((line) => line.text), youtubeId).toEqual([tier.hook, tier.turn, tier.land])
    }
    const nur = await lessonOf('NIR88RRpat4')
    const tier = await tierOf(nur.id)
    const moved = Math.round((tier.appetiserEnd - 3) * 100) / 100
    expect(loc(await saveTier(tier, { appetiserEnd: moved }))).not.toContain('error=')
    const after = (await clips()).find((clip) => clip.lessonId === nur.id)!
    expect(after.appetiser.end).toBe(moved)
    expect(loc(await saveTier(tier, {}))).not.toContain('error=')
  })

  test('LOW: lesson 1 plays its video, not slides', async () => {
    const lesson = await lessonOf('TLCGBj4AlB0')
    const clip = (await clips()).find((row) => row.lessonId === lesson.id)!
    expect(clip.youtubeId).toBe('TLCGBj4AlB0')
    expect(clip.style).toBeNull()
  })

  test('K1: pop-up questions and tier lines refuse spaced letters, stretched spellings, quizlet, rating and markup', async () => {
    const lesson = await lessonOf('NIR88RRpat4')
    for (const prompt of ['Take the q u i z on this talk', 'QUIZZ time: what did he say?', 'Open quizlet and note one line', 'Rate yourself out of 10 on trust', 'What stays with you? <img src=x>']) {
      const made = await form(master, { action: 'popup-save', lesson: String(lesson.id), second: '1:00', prompt, kind: 'reflection', next: '/master/tiers' })
      expect(loc(made), prompt).toContain('error=')
    }
    const tier = await tierOf(lesson.id)
    expect(loc(await saveTier(tier, { hook: `${tier.hook} <b>now</b>` }))).toContain('error=')
    expect(loc(await saveTier(tier, { hook: 'Rate your heart out of ten tonight' }))).toContain('error=')
    expect((await tierOf(lesson.id)).hook).toBe(tier.hook)
  })

  test('N2: a portal admin sets any use limit on an admin code, including none; it grants admin in their own portal only, can be switched off, and shows who joined', async () => {
    const admin = await as('elm-admin@hearts.test', 'portal-admin')
    const access = `/p/${PORTAL}/admin/access`
    const five = await form(admin, { action: 'create-code', portalSlug: PORTAL, role: 'admin', pack: '1', maxUses: '5', expiresInDays: '30', label: `r4-five-${sfx}`, next: access })
    expect(loc(five)).not.toContain('error=')
    const open = await form(admin, { action: 'create-code', portalSlug: PORTAL, role: 'admin', pack: '1', label: `r4-open-${sfx}`, next: access })
    expect(loc(open)).not.toContain('error=')
    expect(loc(await form(admin, { action: 'create-code', portalSlug: 'leeds', role: 'admin', pack: '1', label: `r4-leeds-${sfx}`, next: access }))).toContain('not yours')
    const codes = (await json(await master.get(`/api/access-codes?where[label][like]=r4-&limit=20&depth=0`))).docs as { id: number; code: string; label: string; maxUses: number | null; expiresAt: string | null; portal: number; uses: number }[]
    const fiveCode = codes.find((code) => code.label === `r4-five-${sfx}`)!
    const openCode = codes.find((code) => code.label === `r4-open-${sfx}`)!
    expect(fiveCode.maxUses).toBe(5)
    expect(fiveCode.expiresAt).toBeTruthy()
    expect(openCode.maxUses ?? null).toBeNull()
    expect(codes.find((code) => code.label === `r4-leeds-${sfx}`)).toBeUndefined()
    const elm = (await json(await master.get(`/api/portals?where[slug][equals]=${PORTAL}&depth=0`))).docs[0]
    expect(openCode.portal).toBe(elm.id)

    const names: string[] = []
    for (let i = 0; i < 3; i++) {
      const name = `R4 Co-admin ${i} ${sfx}`
      const joiner = await as(undefined, undefined, { 'x-forwarded-for': `10.9.0.${i + 1}` })
      expect(loc(await form(joiner, { action: 'join', code: openCode.code, name, email: `r4-coadmin${i}-${sfx}@hearts.test`, password: 'round-four-1' }))).toContain(`/p/${PORTAL}/admin`)
      await joiner.dispose()
      names.push(name)
    }
    const made = (await json(await master.get(`/api/users?where[accessCode][equals]=${openCode.id}&depth=0&limit=10`))).docs as { role: string; tenants: { tenant: number }[] }[]
    expect(made).toHaveLength(3)
    for (const person of made) {
      expect(person.role).toBe('portal-admin')
      expect(person.tenants.map((row) => row.tenant)).toEqual([elm.id])
    }
    expect((await json(await master.get(`/api/access-codes/${openCode.id}?depth=0`))).uses).toBe(3)
    const page = await (await admin.get(access)).text()
    for (const name of names) expect(page).toContain(name)

    expect(loc(await form(admin, { action: 'code-switch', id: String(openCode.id), disabled: 'true', next: access }))).not.toContain('error=')
    const late = await as(undefined, undefined, { 'x-forwarded-for': '10.9.0.9' })
    expect(loc(await form(late, { action: 'join', code: openCode.code, name: 'Too late', email: `r4-coadmin-late-${sfx}@hearts.test`, password: 'round-four-1' }))).toContain('error=')
    await late.dispose()
    await admin.dispose()
  })

  test('N1: 210 failures from rotating addresses never block a valid code; one address is limited by its own failures, whatever it writes on the left', async () => {
    await resetClockAndLimits()
    for (let i = 0; i < 210; i++) {
      const guesser = await as(undefined, undefined, { 'x-forwarded-for': `10.4.${Math.floor(i / 250)}.${i % 250}` })
      await form(guesser, { action: 'join', code: `ELM-NOPE-${String(i).padStart(4, '0')}`, name: 'x', email: `r4-g${i}-${sfx}@hearts.test`, password: 'round-four-1' })
      await guesser.dispose()
    }
    const person = await as(undefined, undefined, { 'x-forwarded-for': '10.5.0.1' })
    const joined = await form(person, { action: 'join', code: seedCode('elm-learner'), name: 'Round Four Learner', email: `r4-valid-${sfx}@hearts.test`, password: 'round-four-1' })
    expect(joined.status()).not.toBe(429)
    expect(loc(joined)).not.toContain('error=')
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const spoof = await as(undefined, undefined, { 'x-forwarded-for': `203.0.113.${i}, 10.6.0.9` })
      statuses.push((await form(spoof, { action: 'join', code: `ELM-SPOOF-${i}`, name: 'x', email: `r4-s${i}-${sfx}@hearts.test`, password: 'round-four-1' })).status())
      await spoof.dispose()
    }
    expect(statuses.slice(0, 10).every((status) => status !== 429)).toBeTruthy()
    expect(statuses.slice(10).every((status) => status === 429)).toBeTruthy()
    await person.dispose()
    await resetClockAndLimits()
  })

  test('N3: a contribution counts only from an account that has finished a video and is at least a day old', async () => {
    const email = `r4-trend-${sfx}@hearts.test`
    const joiner = await as(undefined, undefined, { 'x-forwarded-for': '10.7.0.1' })
    expect(loc(await form(joiner, { action: 'join', code: seedCode('elm-learner'), name: 'Round Four Trend', email, password: 'round-four-1' }))).not.toContain('error=')
    const learner = await as(email, 'round-four-1')
    await form(learner, { action: 'me-pref', name: 'trendsOptIn', value: 'on', next: '/' })
    const fresh = await learner.post(`/api/hearts/contribute?portal=${PORTAL}`, { data: { doorKey: 'calmer', laneTop2: ['trust', 'company'] } })
    expect(fresh.status()).toBe(202)
    expect((await json(fresh)).counted).toBe(false)
    const pack = await json(await master.get('/api/packs/1?depth=0'))
    const course = (pack.courses as (number | { id: number })[]).map((row) => (typeof row === 'number' ? row : row.id))[0]
    const part = (await json(await master.get(`/api/lessons?where[course][equals]=${course}&limit=1&depth=0`))).docs[0]
    expect(loc(await form(learner, { action: 'complete', lesson: String(part.id), seconds: String(part.durationSeconds || 1), ended: 'yes', next: '/' }))).not.toContain('error=')
    const unaged = await learner.post(`/api/hearts/contribute?portal=${PORTAL}`, { data: { doorKey: 'calmer', laneTop2: ['trust', 'company'] } })
    expect(unaged.status()).toBe(202)
    await form(master, { action: 'clock', iso: new Date(Date.now() + 2 * 86_400_000).toISOString(), next: '/' })
    const aged = await learner.post(`/api/hearts/contribute?portal=${PORTAL}`, { data: { doorKey: 'calmer', laneTop2: ['trust', 'company'] } })
    expect(aged.status()).toBe(201)
    await resetClockAndLimits()
    await joiner.dispose()
    await learner.dispose()
  })

  test('D1: show unchecked talks is a master flag; off, learners get approved talks only; review approves and rejects', async () => {
    const flags = await json(await master.get('/api/globals/master-flags'))
    expect(flags.showUnchecked).toBe(true)
    const nur = await lessonOf('NIR88RRpat4')
    const tier = await tierOf(nur.id)
    expect(loc(await form(master, { action: 'show-unchecked', value: 'off', next: '/master/review' }))).not.toContain('error=')
    const approvedOnly = await clips()
    const checked = (await json(await master.get('/api/talk-tiers?where[status][equals]=checked&limit=100&depth=0'))).docs as Tier[]
    expect(approvedOnly.every((clip) => checked.some((row) => row.lesson === clip.lessonId) || !clip.youtubeId)).toBeTruthy()
    expect(loc(await form(master, { action: 'tier-review', tier: String(tier.id), decision: 'approve', next: '/master/review' }))).toContain('Approved')
    expect((await clips()).some((clip) => clip.lessonId === nur.id)).toBeTruthy()
    expect(loc(await form(master, { action: 'tier-review', tier: String(tier.id), decision: 'reject', next: '/master/review' }))).toContain('Rejected')
    expect((await clips()).some((clip) => clip.lessonId === nur.id)).toBeFalsy()
    await form(master, { action: 'show-unchecked', value: 'on', next: '/master/review' })
    expect((await clips()).some((clip) => clip.lessonId === nur.id)).toBeFalsy()
    await form(master, { action: 'tier-review', tier: String(tier.id), decision: 'reopen', next: '/master/review' })
    expect((await clips()).some((clip) => clip.lessonId === nur.id)).toBeTruthy()
    expect((await tierOf(nur.id)).status).toBe('draft')
  })
})

test.describe('round 4 screens', () => {
  test('L1: each lane card opens that lane’s own feed, starting on its first clip', async ({ page }) => {
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/lanes`)
    await page.goto(`/p/${PORTAL}/lanes`)
    const cards = page.getByTestId('lane-card')
    expect(await cards.count()).toBeGreaterThanOrEqual(2)
    const seen = new Set<string>()
    for (let i = 0; i < Math.min(3, await cards.count()); i++) {
      const card = cards.nth(i)
      const lane = (await card.getAttribute('data-lane'))!
      const first = (await card.getAttribute('data-first-cut'))!
      expect(await card.getAttribute('href')).toContain(`feed?lane=${lane}`)
      await page.goto(`/p/${PORTAL}/feed?lane=${lane}`)
      const journey = page.getByTestId('journey')
      await expect(journey).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
      await expect(journey).toHaveAttribute('data-lane', lane)
      expect((await journey.getAttribute('data-cuts'))!.split(' ')[0]).toBe(first)
      seen.add(first)
      await page.goto(`/p/${PORTAL}/lanes`)
    }
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })

  test('LOW: a speaker’s Watch intro plays the tier’s appetiser and stops at its out point', async ({ page }) => {
    const nur = await lessonOf('NIR88RRpat4')
    const tier = await tierOf(nur.id)
    const clip = (await clips()).find((row) => row.lessonId === nur.id)!
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/speaker/${clip.speakerSlug}`)
    await page.goto(`/p/${PORTAL}/speaker/${clip.speakerSlug}`)
    const intro = page.getByTestId('watch-intro')
    const cut = Number(/clip=(\d+)/.exec((await intro.getAttribute('href')) || '')?.[1])
    const introClip = (await clips()).find((row) => row.cutId === cut)!
    const introTier = await tierOf(introClip.lessonId)
    expect(await intro.getAttribute('href')).toContain('play=appetiser')
    expect(Number(await intro.getAttribute('data-start'))).toBe(introTier.appetiserStart)
    expect(Number(await intro.getAttribute('data-stop'))).toBe(introTier.appetiserEnd)
    void tier
    await intro.click()
    await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'appetiser', { timeout: 20_000 })
  })

  test('A1 and A2: at 390 by 844 the appetiser plays its clip with nothing overlapping, and no transcript over the picture', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const lesson = await lessonOf('TLCGBj4AlB0')
    const clip = (await clips()).find((row) => row.lessonId === lesson.id)!
    expect(clip.youtubeId).toBeTruthy()
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/feed?clip=${clip.cutId}&play=appetiser`)
    await page.goto(`/p/${PORTAL}/feed?clip=${clip.cutId}&play=appetiser`)
    const journey = page.getByTestId('journey')
    await expect(journey).toHaveAttribute('data-mode', 'appetiser', { timeout: 20_000 })
    await expect(journey).toHaveAttribute('data-appetiser-video', 'yes')
    await expect(page.getByTestId('start-course')).toBeVisible()
    await expect(page.getByTestId('caption')).toHaveCount(0)
    await expect(page.getByTestId('scenic-lines')).toHaveCount(0)
    const parts = ['share', 'fave', 'save', 'start-course', 'resume-main', 'mains-shelf', 'speaker-bio-link']
    const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {}
    for (const id of parts) {
      const box = (await page.getByTestId(id).count()) ? await page.getByTestId(id).boundingBox() : null
      if (box) boxes[id] = box
    }
    for (const id of ['share', 'start-course', 'resume-main']) expect(boxes[id], id).toBeTruthy()
    const speakerCard = (await page.locator('.speaker-card').count()) ? await page.locator('.speaker-card').boundingBox() : null
    if (speakerCard) boxes['speaker-card'] = speakerCard
    delete boxes['speaker-bio-link']
    const names = Object.keys(boxes)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) expect(overlaps(boxes[names[i]], boxes[names[j]]), `${names[i]} overlaps ${names[j]}`).toBeFalsy()
    }
    for (const box of Object.values(boxes)) expect(box.y + box.height).toBeLessThanOrEqual(844)
    expect(await page.getByTestId('learn-more').getAttribute('data-parent-level')).toBe('talk')
    expect(clip.appetiser.lines?.map((line) => line.role)).toEqual(['hook', 'turn', 'land'])
    const film = await page.locator('.yt-host iframe').first().evaluate((el) => {
      const box = el.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom }
    })
    expect(film.top, 'YouTube’s title bar sits above the screen').toBeLessThanOrEqual(-60)
    expect(film.bottom, 'YouTube’s control bar sits below the screen').toBeGreaterThanOrEqual(844 + 60)
  })

  test('G1: the Garden rings are readable and Your path is styled with one number per lesson', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/garden`)
    await page.goto(`/p/${PORTAL}/garden`)
    const card = page.getByTestId('garden-rings')
    const look = await card.evaluate((el) => {
      const ring = el.querySelector('.ring-stat .r') as HTMLElement
      const label = el.querySelector('.ring-stat') as HTMLElement
      return { background: getComputedStyle(el).backgroundImage + getComputedStyle(el).backgroundColor, ring: getComputedStyle(ring).color, label: getComputedStyle(label).color }
    })
    expect(look.background).toContain('gradient')
    expect(look.ring).toBe('rgb(255, 255, 255)')
    const path = page.getByTestId('garden-path')
    await expect(path).toBeVisible()
    const list = await path.locator('ol').evaluate((el) => ({ style: getComputedStyle(el).listStyleType, padding: getComputedStyle(el).paddingLeft }))
    expect(list.style).toBe('none')
    const node = page.getByTestId('garden-node').first()
    const dot = await node.locator('.gp-dot').boundingBox()
    expect(dot!.width).toBeGreaterThanOrEqual(44)
    expect((await node.innerText()).trim()).not.toMatch(/^1\.\s*1/)
  })

  test('LOW: each Still open row in the workbook keeps the question and the talk on separate lines', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const email = `r4-book-${sfx}@hearts.test`
    const joiner = await as(undefined, undefined, { 'x-forwarded-for': '10.8.0.1' })
    expect(loc(await form(joiner, { action: 'join', code: seedCode('elm-learner'), name: 'Round Four Book', email, password: 'round-four-1' }))).not.toContain('error=')
    await joiner.dispose()
    const nur = await lessonOf('NIR88RRpat4')
    await signIn(page, email, 'round-four-1', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await page.goto(`/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await expect(page.getByTestId('player')).toBeVisible()
    await page.goto(`/p/${PORTAL}/garden/workbook`)
    const row = page.getByTestId('open-question').first()
    await expect(row).toBeVisible()
    const [question, talk] = await Promise.all([row.locator('span').boundingBox(), row.locator('small').boundingBox()])
    expect(talk!.y).toBeGreaterThanOrEqual(question!.y + question!.height - 1)
  })

  test('E1: at 1440 the tier editor labels, number boxes, sliders, headings and note do not overlap', async ({ page }) => {
    await page.setViewportSize(DESK)
    const nur = await lessonOf('NIR88RRpat4')
    const tier = await tierOf(nur.id)
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/tiers/${tier.id}`)
    await page.goto(`/master/tiers/${tier.id}`)
    await expect(page.getByTestId('tier-editor')).toBeVisible()
    for (const id of ['hors-start', 'hors-end', 'appetiser-start', 'appetiser-end']) {
      const row = page.getByTestId(id)
      const [label, number, range] = await Promise.all([row.locator('label').boundingBox(), page.getByTestId(`${id}-seconds`).boundingBox(), page.getByTestId(`${id}-range`).boundingBox()])
      expect(overlaps(label!, number!), `${id} label over its number box`).toBeFalsy()
      expect(overlaps(number!, range!), `${id} number box over its slider`).toBeFalsy()
    }
    const headings = page.locator('.tier-h')
    await expect(headings.nth(1)).toContainText('Appetiser')
    const appetiserHeading = await headings.nth(1).boundingBox()
    const horsEndRow = await page.getByTestId('hors-end').boundingBox()
    expect(appetiserHeading!.y).toBeGreaterThanOrEqual(horsEndRow!.y + horsEndRow!.height - 1)
    const note = await page.locator('.tier-note').boundingBox()
    const lastRange = await page.getByTestId('appetiser-end-range').boundingBox()
    expect(overlaps(note!, lastRange!)).toBeFalsy()
  })

  test('D1: the review screen plays both tiers, shows hook, turn and land, and takes keyboard shortcuts', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/review')
    await page.goto('/master/review')
    const card = page.getByTestId('review-card')
    await expect(card).toBeVisible()
    for (const id of ['review-hook', 'review-turn', 'review-land']) expect(((await page.getByTestId(id).textContent()) || '').length).toBeGreaterThan(5)
    await page.keyboard.press('h')
    await expect(page.getByTestId('review-frame')).toHaveAttribute('data-segment', 'h')
    await page.keyboard.press('p')
    await expect(page.getByTestId('review-frame')).toHaveAttribute('data-segment', 'p')
    const first = await card.getAttribute('data-tier')
    await page.keyboard.press('j')
    await expect(page.getByTestId('review-card')).not.toHaveAttribute('data-tier', first!)
    await page.keyboard.press('k')
    await expect(page.getByTestId('review-card')).toHaveAttribute('data-tier', first!)
    await page.keyboard.press('a')
    await expect(page.getByTestId('notice')).toContainText('Approved')
    const approved = (await json(await master.get(`/api/talk-tiers/${first}?depth=0`))) as Tier
    expect(approved.status).toBe('checked')
    await form(master, { action: 'tier-review', tier: String(first), decision: 'reopen', next: '/master/review' })

    await page.goto('/master/review/popups')
    await expect(page.getByTestId('review-counts')).toContainText('pop-ups are live')
    const point = await page.getByTestId('review-card').getAttribute('data-point')
    await page.waitForFunction(() => document.documentElement.dataset.reviewKeys === 'on')
    await page.keyboard.press('a')
    await expect(page.getByTestId('notice')).toContainText('published')
    expect((await json(await master.get(`/api/engagement-points/${point}?depth=0`))).status).toBe('published')
    await form(master, { action: 'popup-review', point: String(point), decision: 'reopen', next: '/master/review/popups' })
  })

  test('LOW: a question paused over the film fades YouTube’s pause panel under a soft scrim', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const nur = await lessonOf('NIR88RRpat4')
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    await page.goto(`/p/${PORTAL}/course/${nur.course}?part=${nur.id}`)
    const player = page.getByTestId('player')
    await expect(player).toHaveAttribute('data-popup-layout', 'over')
    const ready = await expect(player).toHaveAttribute('data-mode', 'youtube', { timeout: 20_000 }).then(() => true, () => false)
    test.skip(!ready, 'YouTube did not load in this browser, so there is no film to pause')
    await page.getByTestId('answer-point').click()
    await expect(page.getByTestId('popup')).toBeVisible()
    await expect(page.getByTestId('paused-scrim')).toBeVisible()
    const [scrim, film] = await Promise.all([page.getByTestId('paused-scrim').boundingBox(), page.locator('.player-card .yt').boundingBox()])
    expect(Math.abs(scrim!.y - film!.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(scrim!.height - film!.height)).toBeLessThanOrEqual(1)
  })
})
