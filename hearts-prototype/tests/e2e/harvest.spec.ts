import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'

// Harvest: a learner finishes a talk and gets its verses and hadith, word for word, with the real text.

const PORTAL = 'east-london'
const BASE = `/p/${PORTAL}`
const sfx = Date.now().toString().slice(-6)
const TITLE = `Harvest test talk ${sfx}`
const LEARNER = { email: `harvest-${sfx}@hearts.test`, password: 'harvest-learner-1', name: 'Harvest Learner' }
const FIXTURE = readFileSync(path.join(process.cwd(), 'tests/fixtures/harvest-talk.vtt'), 'utf8')
const SAID_25_63 = 'As Allah says, and the servants of the Most Merciful are those who walk upon the earth easily, and when the ignorant address them, they say words of peace.'

let master: APIRequestContext
let lesson: { id: number; course: number }

const json = async (response: APIResponse) => (await response.json().catch(() => ({}))) as Record<string, any>
const loc = (response: APIResponse) => decodeURIComponent((response.headers()['location'] || '').replace(/\+/g, ' '))

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

const card = (page: Page, text: RegExp | string) => page.getByTestId('harvest-item').filter({ has: page.getByTestId('harvest-quote').filter({ hasText: text }) })

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
  const pack = await json(await master.get('/api/packs/1?depth=0'))
  const course = (pack.courses as (number | { id: number })[]).map((row) => (typeof row === 'number' ? row : row.id))[0]
  const sibling = (await json(await master.get(`/api/lessons?where[course][equals]=${course}&limit=1&depth=0`))).docs[0]
  const created = await json(await master.post('/api/lessons', {
    data: { title: TITLE, course, unit: sibling.unit, order: 99, speaker: 'Harvest Test', youtubeId: 'hvTestTalk01', durationSeconds: 90, transcript: FIXTURE },
  }))
  lesson = { id: created.doc.id, course }

  const joiner = await as()
  expect(loc(await joiner.post('/api/hearts', { form: { action: 'join', code: seedCode('elm-learner'), ...LEARNER }, maxRedirects: 0 }))).not.toContain('error=')
  await joiner.dispose()
  const learner = await as(LEARNER.email, LEARNER.password)
  expect(loc(await learner.post('/api/hearts', { form: { action: 'complete', lesson: String(lesson.id), seconds: '90', ended: 'yes', next: '/' }, maxRedirects: 0 }))).not.toContain('error=')
  await learner.dispose()
})

test.afterAll(async () => {
  if (lesson) {
    for (const collection of ['harvest-entries', 'completions', 'lesson-visits', 'watch-sessions']) {
      await master.delete(`/api/${collection}?where[lesson][equals]=${lesson.id}`)
    }
    expect((await master.delete(`/api/lessons/${lesson.id}`)).ok(), 'the test talk is removed').toBeTruthy()
  }
  await master?.dispose()
})

test.describe('harvest', () => {
  test('finishing a talk fills Harvest with what was said, verses placed only when the match is sure', async () => {
    const entries = (await json(await master.get(`/api/harvest-entries?where[lesson][equals]=${lesson.id}&sort=seconds&depth=0`))).docs as Record<string, any>[]
    expect(entries.map((row) => [row.kind, row.surah ?? null, row.ayah ?? null, row.collection ?? null])).toEqual([
      ['quran', 25, 63, null],
      ['quran', 66, 8, null],
      ['hadith', null, null, 'bukhari'],
      ['hadith', null, null, null],
      ['quran', null, null, null],
    ])
    expect(entries[0].text).toBe(SAID_25_63)
    expect(entries[2].reference).toBe('Sahih al-Bukhari 1')
    expect(entries[4].reference || '').toBe('')
    expect(entries.every((row) => !row.seenAt)).toBe(true)
  })

  test('the Garden counts the new harvest; the cards are verbatim, Arabic above the translation, and the new marker clears once seen', async ({ page }) => {
    await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden`)
    await page.goto(`${BASE}/garden`)
    await expect(page.getByTestId('ring-harvest')).toContainText('5')
    await expect(page.getByTestId('ring-harvest-new')).toHaveText('5 new')
    await page.getByTestId('ring-harvest').click()
    await page.waitForURL(`**${BASE}/garden/harvest`)

    await expect(page.getByTestId('harvest-item')).toHaveCount(5)
    await expect(page.getByTestId('harvest-new')).toHaveCount(5)
    await expect(page.getByTestId('harvest-quote').first()).toHaveText(SAID_25_63)

    const furqan = card(page, 'servants of the Most Merciful')
    await expect(furqan).toHaveAttribute('data-matched', 'yes')
    await expect(furqan.getByTestId('harvest-reference')).toHaveText('Al-Furqaan 25:63')
    const ayah = furqan.getByTestId('harvest-ayah')
    await expect(ayah.locator('small')).toHaveText('Al-Furqaan 25:63 · Saheeh International')
    const arabic = ayah.locator('p.ar')
    await expect(arabic).toHaveAttribute('lang', 'ar')
    await expect(arabic).toHaveAttribute('dir', 'rtl')
    await expect(arabic).toContainText('وَعِبَادُ')
    const [top, under] = [await arabic.boundingBox(), await ayah.locator('p.en').boundingBox()]
    expect(top!.y + top!.height).toBeLessThanOrEqual(under!.y + 1)

    const unplaced = card(page, 'patience is beautiful')
    await expect(unplaced).toHaveAttribute('data-matched', 'no')
    await expect(unplaced.getByTestId('harvest-reference')).toHaveText('')
    await expect(unplaced.getByTestId('harvest-ayah')).toHaveCount(0)
    await expect(unplaced.getByTestId('harvest-context')).toHaveCount(0)
    await expect(unplaced.getByTestId('harvest-scholars')).toHaveCount(0)

    const smile = card(page, 'a smile for your brother')
    await expect(smile).toHaveAttribute('data-matched', 'no')
    await expect(smile.getByTestId('harvest-context')).toHaveCount(0)

    await page.reload()
    await expect(page.getByTestId('harvest-new')).toHaveCount(0)
    await page.goto(`${BASE}/garden`)
    await expect(page.getByTestId('ring-harvest-new')).toHaveCount(0)
  })

  test('filters and grouping', async ({ page }) => {
    await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden/harvest`)
    await expect(page.getByTestId('harvest-filter-all').locator('.count')).toHaveText('5')
    await expect(page.getByTestId('harvest-filter-quran').locator('.count')).toHaveText('3')
    await expect(page.getByTestId('harvest-filter-hadith').locator('.count')).toHaveText('2')
    await page.getByTestId('harvest-filter-quran').click()
    await expect(page).toHaveURL(/kind=quran/)
    await expect(page.getByTestId('harvest-item')).toHaveCount(3)
    for (const kind of await page.getByTestId('harvest-item').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-kind')))) expect(kind).toBe('quran')
    await page.getByTestId('harvest-filter-hadith').click()
    await expect(page).toHaveURL(/kind=hadith/)
    await expect(page.getByTestId('harvest-item')).toHaveCount(2)
    for (const kind of await page.getByTestId('harvest-item').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-kind')))) expect(kind).toBe('hadith')
    await page.getByTestId('harvest-filter-all').click()
    await expect(page).toHaveURL(/\/garden\/harvest$/)
    await expect(page.getByTestId('harvest-item')).toHaveCount(5)
    await expect(page.getByTestId('harvest-group')).toHaveCount(1)
    await expect(page.getByTestId('harvest-group').locator('h3')).toHaveText(TITLE)
    await page.getByTestId('harvest-group-clause').click()
    await expect(page).toHaveURL(/group=clause/)
    await expect(page.getByTestId('harvest-group')).toHaveAttribute('data-group', 'clause-none')
    await expect(page.getByTestId('harvest-item')).toHaveCount(5)
  })

  test('a seeded learner’s harvest groups under the clauses of the hadith of Jibril', async ({ page }) => {
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `${BASE}/garden/harvest?group=clause`)
    const groups = await page.getByTestId('harvest-group').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-group')))
    expect(groups.some((key) => key && /^clause-\d+$/.test(key))).toBe(true)
    expect(await page.getByTestId('harvest-item').count()).toBeGreaterThan(5)
  })

  test('a card replays its talk from a few seconds before the quote', async ({ page }) => {
    await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden/harvest`)
    const replay = card(page, 'servants of the Most Merciful').getByTestId('harvest-replay')
    await expect(replay).toHaveAttribute('href', `${BASE}/course/${lesson.course}?part=${lesson.id}&t=7`)
    await expect(card(page, 'reward of deeds').getByTestId('harvest-replay')).toHaveAttribute('href', `${BASE}/course/${lesson.course}?part=${lesson.id}&t=40`)
    await replay.click()
    await page.waitForURL(/\/course\/\d+\?part=\d+&t=7/)
    await expect(page.getByTestId('part-label')).toContainText(TITLE)
    await expect(page.getByTestId('player-time')).toHaveText('0:07')
  })

  test('See it in context shows the ayah among its neighbours, and the named hadith in full', async ({ page }) => {
    await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden/harvest`)
    await card(page, 'servants of the Most Merciful').getByTestId('harvest-context').click()
    const panel = page.getByTestId('harvest-panel')
    await expect(panel).toHaveAttribute('data-view', 'context')
    await expect(panel.getByTestId('context-ayah')).toHaveCount(7)
    const focus = panel.locator('[data-testid="context-ayah"][data-focus="yes"]')
    await expect(focus).toHaveCount(1)
    await expect(focus.locator('.num')).toHaveText('63')
    await expect(focus.locator('p.ar')).toContainText('وَعِبَادُ')
    await expect(focus.locator('p.en')).toContainText('servants of the Most Merciful')
    await expect(panel).toContainText('Saheeh International')

    await card(page, 'reward of deeds').getByTestId('harvest-context').click()
    const hadith = page.getByTestId('harvest-panel')
    await expect(hadith).toHaveAttribute('data-view', 'context')
    await expect(hadith.getByTestId('hadith-source')).toContainText('Sahih al-Bukhari 1')
    await expect(hadith.getByTestId('hadith-text')).toContainText("Narrated 'Umar bin Al-Khattab")
    await expect(hadith.getByTestId('hadith-text')).toContainText('The reward of deeds depends upon the intentions')
    await expect(hadith.locator('p.ar')).toHaveAttribute('dir', 'rtl')
    await expect(card(page, 'reward of deeds').getByTestId('harvest-scholars')).toHaveCount(0)
  })

  test('What do the scholars say offers a labelled summary or the tafsir itself, each source titled', async ({ page }) => {
    await signIn(page, LEARNER.email, LEARNER.password, `${BASE}/garden/harvest`)
    await card(page, 'servants of the Most Merciful').getByTestId('harvest-scholars').click()
    await expect(page.getByTestId('harvest-panel')).toHaveAttribute('data-view', 'scholars')
    await expect(page.getByTestId('scholars-summary')).toHaveText('A short summary')
    await expect(page.getByTestId('scholars-tafsir')).toHaveText('Read the tafsir')

    await page.getByTestId('scholars-summary').click()
    await expect(page.getByTestId('harvest-panel')).toHaveAttribute('data-view', 'summary')
    const label = (await page.getByTestId('summary-label').textContent()) || ''
    expect(label).toMatch(/^(AI summary of Tafsir .+|No AI summary is available here, so this is Tafsir al-Jalalayn in its own words\. It is itself a short tafsir\.)$/)
    await expect(page.getByTestId('summary-text')).not.toBeEmpty()

    await page.getByTestId('summary-full').click()
    const tafsir = page.getByTestId('harvest-panel')
    await expect(tafsir).toHaveAttribute('data-view', 'tafsir')
    await expect(tafsir.locator('.eyebrow')).toHaveText('Tafsir of Al-Furqaan 25:63')
    const titles = await tafsir.getByTestId('tafsir-title').allTextContents()
    expect(titles).toEqual(['Tafsir Ibn Kathir (English)', 'Tafsir al-Jalalayn (English)', "Tafsir al-Sa'di (Arabic)", 'Tafsir Ibn Kathir (Arabic)', 'Tafsir al-Jalalayn (Arabic)'])
    await expect(tafsir.locator('[data-source="ar-tafseer-al-saddi"] .tafsir-text')).toHaveAttribute('dir', 'rtl')
    await expect(tafsir).toContainText('spa5k')
  })

  test('the harvest is the learner’s own: another portal cannot view it and the records are master-only', async () => {
    const learnerId = (await json(await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER.email)}&depth=0`))).docs[0].id
    const leeds = await as('leeds-admin@hearts.test', 'portal-admin')
    expect((await leeds.get(`/api/harvest-entries?where[user][equals]=${learnerId}`)).status()).toBe(403)
    expect((await leeds.post('/api/view-as/start', { data: { targetUserId: learnerId, reason: 'Checking harvest' } })).ok()).toBe(false)
    await leeds.dispose()
    const learner = await as(LEARNER.email, LEARNER.password)
    expect((await learner.get('/api/harvest-entries')).status()).toBe(403)
    expect((await learner.get('/api/scripture-cache')).status()).toBe(403)
    await learner.dispose()
  })
})
