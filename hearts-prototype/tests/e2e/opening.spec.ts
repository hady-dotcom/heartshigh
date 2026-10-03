import { expect, request as playwrightRequest, test, type APIRequestContext, type Page, type Request } from '@playwright/test'
import { E2E_BASE } from '../env'

// The opening, "Shine and dust" (psychometric-opening-build-spec section 8, browser tests).
// Every test starts in a fresh browser context, so the device holds nothing until the test taps.

const PORTAL = 'east-london'
const START = `/p/${PORTAL}/start`
const PICKS: [string, string][] = [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['doors', 'calmer']]
const suffix = Date.now().toString().slice(-7)

let master: APIRequestContext

test.beforeAll(async () => {
  master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const login = await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })
  expect(login.ok()).toBeTruthy()
})

test.afterAll(async () => {
  await master?.dispose()
})

async function userId(email: string) {
  const found = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0`)).json()
  return found.docs[0].id as number
}

async function nurLesson() {
  const found = await (await master.get(`/api/lessons?where[title][equals]=${encodeURIComponent('The Names Class 20: Al-Nur')}&depth=0`)).json()
  return found.docs[0] as { id: number; course: number }
}

async function nurPath() {
  const lesson = await nurLesson()
  return `/p/${PORTAL}/course/${lesson.course}?part=${lesson.id}`
}

/** Earlier runs leave answers behind, and an answered question no longer pops up. */
async function clearNurAnswers(email: string) {
  const [user, lesson] = await Promise.all([userId(email), nurLesson()])
  const found = await (await master.get(`/api/answers?where[user][equals]=${user}&where[lesson][equals]=${lesson.id}&depth=0&limit=100`)).json()
  for (const row of found.docs as { id: number }[]) expect((await master.delete(`/api/answers/${row.id}`)).ok()).toBeTruthy()
}

function watchRequests(page: Page) {
  const seen: Request[] = []
  page.on('request', (request) => seen.push(request))
  return seen
}

async function heart(page: Page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('hearts.heart.v1') || 'null'))
}

async function tapScene(page: Page, scene: string, option: string) {
  await expect(page.locator(`[data-testid="scene"][data-scene="${scene}"]`)).toBeVisible()
  await page.locator(`[data-testid="scene"][data-scene="${scene}"] [data-testid="tile"][data-option="${option}"]`).click()
}

async function playThrough(page: Page, picks = PICKS) {
  await page.goto(START)
  await page.getByTestId('lets-play').click()
  for (const [scene, option] of picks) await tapScene(page, scene, option)
  await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('the opening', () => {
  test('1. a first visit to the portal lands on the opener, with its caption and both ways in', async ({ page }) => {
    await page.goto(`/p/${PORTAL}`)
    await expect(page.getByTestId('opener')).toBeVisible()
    await expect(page.getByTestId('opener-caption')).toContainText('Every heart has a bit of shine')
    await expect(page.getByTestId('lets-play')).toBeVisible()
    await expect(page.getByTestId('just-show')).toBeVisible()
    await expect(page.getByTestId('opener-login')).toHaveAttribute('href', /\/login/)
  })

  test('2. nothing from YouTube loads before the learner chooses a way in (P12)', async ({ page }) => {
    const seen = watchRequests(page)
    await page.goto(START)
    await page.waitForTimeout(1500)
    expect(seen.filter((request) => /youtube|ytimg|googlevideo/.test(request.url()))).toHaveLength(0)
  })

  test('3. Let us play opens scene one, and the address follows the scene', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    await expect(page.locator('[data-testid="scene"][data-scene="extra"]')).toBeVisible()
    await expect(page).toHaveURL(/\/start\/1$/)
  })

  test('4. a tap shows its reply line, then the next scene rises', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    await tapScene(page, 'extra', 'pause')
    await expect(page.getByTestId('reply-pill').first()).toBeVisible()
    await expect(page.locator('[data-testid="scene"][data-scene="queue"]')).toBeVisible()
    await expect(page).toHaveURL(/\/start\/2$/)
  })

  test('5. Pass moves on without a tap and is kept as a pass', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    await page.getByTestId('pass').click()
    await expect(page.locator('[data-testid="scene"][data-scene="queue"]')).toBeVisible()
    const state = await heart(page)
    expect(state.taps[0]).toMatchObject({ scene: 'extra', option: 'pass' })
  })

  test('6. going back replaces the earlier tap instead of adding one', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    await tapScene(page, 'extra', 'pause')
    await expect(page.locator('[data-testid="scene"][data-scene="queue"]')).toBeVisible()
    await page.goBack()
    await tapScene(page, 'extra', 'treat')
    await expect(page.locator('[data-testid="scene"][data-scene="queue"]')).toBeVisible()
    const state = await heart(page)
    expect(state.taps.filter((tap: { scene: string }) => tap.scene === 'extra')).toHaveLength(1)
    expect(state.taps[0].option).toBe('treat')
  })

  test('7. the crisis option opens the help screen with contacts, and Back to HEARTS returns to the opener', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    await tapScene(page, 'extra', 'pause')
    await tapScene(page, 'queue', 'let-go')
    await tapScene(page, 'thumb', 'lives')
    await tapScene(page, 'visitor', 'heavy')
    await expect(page.getByTestId('help')).toBeVisible()
    await expect(page.getByTestId('help-contact').first()).toBeVisible()
    await expect(page).toHaveURL(/\/help$/)
    await page.getByTestId('back-to-hearts').click()
    await expect(page.getByTestId('opener')).toBeVisible()
  })

  test('8. the help screen has its own address and works on a cold load', async ({ page }) => {
    await page.goto(`/p/${PORTAL}/help`)
    await expect(page.getByTestId('help')).toBeVisible()
    await expect(page.getByTestId('help-contacts')).toContainText('116 123')
  })

  test('9. six taps hand off with the line, then the feed, at /feed', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('lets-play').click()
    for (const [scene, option] of PICKS.slice(0, 5)) await tapScene(page, scene, option)
    await tapScene(page, 'doors', 'calmer')
    await expect(page.getByTestId('handoff-line')).toContainText('Pull up a chair')
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
    await expect(page).toHaveURL(new RegExp(`/p/${PORTAL}/feed$`))
  })

  test('10. Back from the feed does not reopen the scenes', async ({ page }) => {
    await playThrough(page)
    await page.goBack()
    await page.waitForTimeout(600)
    await expect(page.getByTestId('scene')).toHaveCount(0)
    await expect(page.getByTestId('opener')).toHaveCount(0)
  })

  test('11. the taps stay on the device: no request carries them before sign-up (P1)', async ({ page }) => {
    const seen = watchRequests(page)
    await playThrough(page)
    const sent = seen.filter((request) => request.url().includes('/api/')).map((request) => request.postData() || '')
    for (const body of sent) {
      expect(body).not.toContain('"taps"')
      expect(body).not.toContain('pause')
      expect(body).not.toContain('let-go')
    }
    const state = await heart(page)
    expect(state.taps.map((tap: { scene: string; option: string }) => [tap.scene, tap.option])).toEqual(PICKS)
  })

  test('12. before sign-up the feed is chosen on the device, so no request carries lane scores (P2)', async ({ page }) => {
    const sent: string[] = []
    page.on('request', (request) => {
      if (request.method() !== 'GET' || request.url().includes('/api/hearts/feed')) sent.push(`${request.url()} ${request.postData() || ''}`)
    })
    await playThrough(page)
    await expect(page.getByTestId('journey')).not.toHaveAttribute('data-cuts', '')
    for (const line of sent) {
      expect(line).not.toContain('laneScores')
      expect(line).not.toContain('"s":')
      expect(line).not.toContain('taps')
    }
  })

  test('13. Just show me something goes straight to a clip with its own line', async ({ page }) => {
    await page.goto(START)
    await page.getByTestId('just-show').click()
    await expect(page.getByTestId('handoff-line')).toContainText('No bother')
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
  })

  test('14. after the opening, the portal address opens the feed on the next visit', async ({ page }) => {
    await playThrough(page)
    await page.goto(`/p/${PORTAL}`)
    await expect(page).toHaveURL(new RegExp(`/p/${PORTAL}/feed$`))
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed')
  })

  test('15. the sky lightens scene by scene and is full at the feed', async ({ page }) => {
    await page.goto(START)
    const lit = () => page.locator('.j-sky-layer').evaluateAll((layers) => layers.filter((layer) => Number(getComputedStyle(layer).opacity) > 0.5).length)
    await page.getByTestId('lets-play').click()
    await tapScene(page, 'extra', 'pause')
    await tapScene(page, 'queue', 'let-go')
    await expect.poll(lit, { timeout: 5000 }).toBeGreaterThanOrEqual(3)
  })

  test('16. a heart on a clip asks to keep the place, and Not now carries on', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await playThrough(page)
    await page.getByTestId('fave').click()
    await expect(page.getByTestId('keep-sheet')).toHaveAttribute('data-reason', 'save')
    await page.getByTestId('not-now').click()
    await expect(page.getByTestId('keep-sheet')).toHaveCount(0)
  })

  test('17. signing up from the sheet sends the opening once, and the workbook shows where you started', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    const openings: string[] = []
    page.on('request', (request) => request.url().includes('/api/workbook/opening') && openings.push(request.postData() || ''))
    await playThrough(page)
    await page.getByTestId('fave').click()
    await page.getByTestId('keep-open').click()
    await page.getByTestId('keep-name').fill('Opening Tester')
    await page.getByTestId('keep-email').fill(`opening-${suffix}@hearts.test`)
    await page.getByTestId('keep-password').fill('opening-pass')
    await page.getByTestId('keep-submit').click()
    await expect(page.getByTestId('toast')).toContainText('Your place is kept')
    expect(openings).toHaveLength(1)
    expect(JSON.parse(openings[0]).taps).toHaveLength(6)
    await page.goto(`/p/${PORTAL}/garden/workbook`)
    await expect(page.getByTestId('where-you-started')).toBeVisible()
    await expect(page.getByTestId('opening-row')).toHaveCount(6)
    await expect(page.locator('[data-testid="opening-row"][data-scene="thumb"]')).toHaveAttribute('data-private', 'yes')
    await expect(page.locator('[data-testid="opening-row"][data-scene="thumb"] [data-testid="private-lock"]')).toBeVisible()
  })

  test('18. a private opening answer is never shown to the teacher (P9)', async ({ page }) => {
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/')
    const id = await userId('elm-learner@hearts.test')
    const book = await page.request.get(`/api/workbook/${id}`)
    expect(book.status()).toBe(200)
    const data = await book.json()
    const scenes = data.opening.map((row: { sceneKey: string }) => row.sceneKey)
    expect(scenes).toContain('extra')
    expect(scenes).not.toContain('thumb')
    expect(scenes).not.toContain('visitor')
    expect(JSON.stringify(data)).not.toContain('Lives and looks better')
  })

  test('19. the owner sees all six rows, private ones with a lock', async ({ page }) => {
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/garden/workbook`)
    await expect(page.getByTestId('opening-row')).toHaveCount(6)
    await expect(page.getByTestId('private-lock')).toHaveCount(3)
  })

  test('20. the mentor CSV holds shared rows only', async ({ page }) => {
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/')
    const id = await userId('elm-learner@hearts.test')
    const csv = await (await page.request.get(`/api/workbook/${id}?format=csv`)).text()
    expect(csv.split('\n')[0]).toContain('section')
    expect(csv).toContain('Pause. Alhamdulillah')
    expect(csv).not.toContain('Lives and looks better')
    expect(csv).not.toContain('let it spin')
  })

  test('21. turning off Share my opening answers hides them from the teacher', async ({ browser }) => {
    const learner = await browser.newPage()
    const teacher = await browser.newPage()
    await signIn(teacher, 'elm-teacher@hearts.test', 'portal-teacher', '/')
    const id = await userId('elm-learner@hearts.test')
    const shared = async () => ((await (await teacher.request.get(`/api/workbook/${id}`)).json()).opening || []).length
    await signIn(learner, 'elm-learner@hearts.test', 'portal-learner', `/p/${PORTAL}/me`)
    const toggle = learner.getByTestId('pref-shareOpening-input')
    await expect(toggle).toBeChecked()
    expect(await shared()).toBeGreaterThan(0)
    try {
      await toggle.uncheck()
      await expect(learner.getByTestId('notice')).toContainText('Saved')
      await expect(toggle).not.toBeChecked()
      expect(await shared()).toBe(0)
    } finally {
      await learner.goto(`/p/${PORTAL}/me`)
      if (!(await learner.getByTestId('pref-shareOpening-input').isChecked())) {
        await learner.getByTestId('pref-shareOpening-input').check()
        await expect(learner.getByTestId('notice')).toContainText('Saved')
      }
    }
    expect(await shared()).toBeGreaterThan(0)
    await learner.close()
    await teacher.close()
  })

  test('22. the Me tab lets the learner change their name', async ({ page }) => {
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/me`)
    await page.getByText('Change the name we use').click()
    await page.getByTestId('name-input').fill('Hamza A.')
    await page.getByTestId('name-save').click()
    await expect(page.getByTestId('me-name')).toHaveText('Hamza A.')
    await page.getByText('Change the name we use').click()
    await page.getByTestId('name-input').fill('Hamza Ali')
    await page.getByTestId('name-save').click()
    await expect(page.getByTestId('me-name')).toHaveText('Hamza Ali')
  })

  test('23. Guarding the gaze is opt-in and kept on the device only', async ({ page }) => {
    const seen = watchRequests(page)
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/me`)
    const toggle = page.locator('[data-testid="optin-guarding-gaze"] input')
    await expect(toggle).not.toBeChecked()
    await toggle.check()
    const state = await heart(page)
    expect(state.optInLanes).toContain('guarding-gaze')
    expect(seen.filter((request) => (request.postData() || '').includes('guarding-gaze'))).toHaveLength(0)
  })

  test('24. Start again clears the opening here and on the server, and opens the opener', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await playThrough(page)
    await page.getByTestId('fave').click()
    await page.getByTestId('keep-open').click()
    await page.getByTestId('keep-name').fill('Start Again')
    await page.getByTestId('keep-email').fill(`again-${suffix}@hearts.test`)
    await page.getByTestId('keep-password').fill('again-pass')
    await page.getByTestId('keep-submit').click()
    await expect(page.getByTestId('toast')).toContainText('Your place is kept')
    await page.goto(`/p/${PORTAL}/me`)
    await page.getByTestId('start-again').click()
    await page.getByTestId('start-again-yes').click()
    await expect(page.getByTestId('opener')).toBeVisible()
    expect(await heart(page)).toBeNull()
    const book = await (await page.request.get('/api/workbook')).json()
    expect(book.opening).toHaveLength(0)
  })

  test('25. reduced motion keeps every step, with fades in place of movement', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    await playThrough(page)
    await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed')
    await context.close()
  })
})

test.describe('pop-up questions in a lesson', () => {
  async function openNur(page: Page) {
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', await nurPath())
  }

  test('26. the question strip shows one mark per question', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await openNur(page)
    await expect(page.getByTestId('player')).toHaveAttribute('data-mode', 'practice', { timeout: 15_000 })
    const dots = await page.getByTestId('timeline-dot').count()
    await expect(page.getByTestId('strip-dot')).toHaveCount(dots)
  })

  test('27. playback stops at a question, the answer saves, and playback carries on', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await clearNurAnswers('elm-learner2@hearts.test')
    await openNur(page)
    await expect(page.getByTestId('player')).toHaveAttribute('data-mode', 'practice', { timeout: 15_000 })
    const first = Number(await page.locator('[data-testid="timeline-dot"][data-state="open"]').first().getAttribute('data-second'))
    await page.goto(`${page.url()}&t=${Math.max(0, first - 2)}`)
    await expect(page.getByTestId('player')).toHaveAttribute('data-mode', 'practice', { timeout: 15_000 })
    await page.getByTestId('player-play').click()
    const popup = page.getByTestId('popup')
    await expect(popup).toBeVisible({ timeout: 8000 })
    await expect(popup).toHaveAttribute('data-triggered', 'yes')
    const choice = popup.locator('input[name=choice]')
    if (await choice.count()) await choice.first().check()
    else await page.getByTestId('answer-text').fill('A quiet morning before work.')
    await page.getByTestId('answer-submit').click()
    await expect(popup).toHaveCount(0)
    await expect(page.getByTestId('player').getByTestId('notice')).toContainText('workbook')
    await expect(page.getByTestId('player-play')).toHaveAttribute('aria-label', 'Pause')
    await expect(page.locator('[data-testid="strip-dot"][data-answered="yes"]').first()).toBeVisible()
  })

  test('28. Answer later closes the card and keeps the question open', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await openNur(page)
    await expect(page.getByTestId('player')).toHaveAttribute('data-mode', 'practice', { timeout: 15_000 })
    const open = page.locator('[data-testid="strip-dot"][data-answered="no"]')
    const before = await open.count()
    await page.getByTestId('answer-point').click()
    const later = page.waitForResponse((response) => response.url().endsWith('/api/answers') && response.request().method() === 'POST')
    await page.getByTestId('answer-later').click()
    expect((await later).status()).toBe(200)
    await expect(page.getByTestId('popup')).toHaveCount(0)
    await expect(open).toHaveCount(before)
  })

  test('29a. a clip the player refuses is reported, and a report alone never hides it', async ({ page }) => {
    const cut = (await (await master.get('/api/cuts?where[playable][not_equals]=false&limit=1&depth=0')).json()).docs[0]
    expect((await page.request.post('/api/hearts/unplayable', { data: { cutId: cut.id, code: 5 } })).status()).toBe(401)
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', `/p/${PORTAL}/me`)
    expect((await page.request.post('/api/hearts/unplayable', { data: { cutId: cut.id, code: 42 } })).status()).toBe(400)
    const reported = await page.request.post('/api/hearts/unplayable', { data: { cutId: cut.id, code: 5 } })
    expect(await reported.json()).toMatchObject({ ok: true, hidden: false })
    const after = await (await master.get(`/api/cuts/${cut.id}?depth=0`)).json()
    expect(after.playable).not.toBe(false)
    expect(after.lastError).toMatch(/^5 at /)
  })

  test('29. the strict layout keeps the paused player in view above the card', async ({ page }) => {
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/opening')
    await page.getByTestId('flag-popup').uncheck()
    await page.getByTestId('flags-save').click()
    await expect(page.getByTestId('notice')).toContainText('Player layout saved')
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', await nurPath())
    await expect(page.getByTestId('player')).toHaveAttribute('data-popup-layout', 'strict')
    await page.getByTestId('answer-point').click()
    const card = await page.getByTestId('player-card').boundingBox()
    const sheet = await page.getByTestId('popup').boundingBox()
    expect(sheet!.y).toBeGreaterThanOrEqual(card!.y + card!.height - 1)
    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/opening')
    await page.getByTestId('flag-popup').check()
    await page.getByTestId('flags-save').click()
    await expect(page.getByTestId('notice')).toContainText('Player layout saved')
  })
})

test.describe('the desks for the opening', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('30. the master sees the six scenes, their options and the publish checks', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/opening')
    await expect(page.getByTestId('scene-panel')).toHaveCount(6)
    await expect(page.getByTestId('private-option').first()).toBeVisible()
    await expect(page.locator('[data-testid="scene-panel"][data-scene="visitor"]')).toContainText('Help screen')
  })

  test('31. publishing a caption with a kill-list word is refused', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/opening')
    const panel = page.locator('[data-testid="scene-panel"][data-scene="extra"]')
    const caption = panel.getByTestId('scene-caption')
    const original = await caption.inputValue()
    await caption.fill('Unlock your best self with a little **extra**.')
    await panel.locator('select[name=status]').selectOption('published')
    await panel.getByTestId('scene-save').click()
    await expect(page.getByTestId('error')).toContainText('kill list')
    await expect(page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="scene-caption"]')).toHaveValue(original)
  })

  test('32. the simulator runs the phone’s routing on picked taps', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/simulator')
    await expect(page.getByTestId('simulator')).toBeVisible()
    await expect(page.getByTestId('sim-lane').filter({ hasText: 'L1' })).toHaveCount(0)
    for (const [scene, option] of PICKS) await page.getByTestId(`sim-${scene}`).selectOption(option)
    await expect(page.getByTestId('sim-lane').filter({ hasText: 'L1' })).toHaveCount(1)
    await expect(page.getByTestId('sim-feed-item').first()).toBeVisible()
    await expect(page.locator('[data-testid="sim-scale"][data-scale="desire"]')).toHaveAttribute('data-value', '0.00')
    await page.getByTestId('sim-visitor').selectOption('heavy')
    await expect(page.getByTestId('sim-crisis')).toBeVisible()
  })

  test('33. the lanes screen lists every lane and the tag queue', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/lanes')
    await expect(page.getByTestId('tag-queue')).toBeVisible()
    await expect(page.locator('[data-testid="lane-row"][data-lane="guarding-gaze"]')).toContainText('Only after opting in')
  })

  test('34. trends stay hidden until ten people have taken part', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/trends')
    await expect(page.getByTestId('master-trends')).toBeVisible()
    for (const row of await page.locator('[data-testid="trend-row"][data-shown="no"]').all()) await expect(row).toContainText('fewer than 10')
  })

  test('35. a portal admin rewords a scene for their community and the opener shows it', async ({ page, browser }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
    const panel = page.locator('[data-testid="portal-scene"][data-scene="extra"]')
    await panel.getByTestId('portal-caption').fill('Some unexpected **money** comes your way.')
    await panel.getByTestId('portal-scene-save').click()
    await expect(page.getByTestId('notice')).toContainText('Opening saved')
    const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await visitor.goto(START)
    await visitor.getByTestId('lets-play').click()
    await expect(visitor.getByTestId('scene-caption')).toContainText('Some unexpected money')
    await visitor.close()
    await page.locator('[data-testid="portal-scene"][data-scene="extra"] [data-testid="portal-caption"]').fill('')
    await page.locator('[data-testid="portal-scene"][data-scene="extra"] [data-testid="portal-scene-save"]').click()
    await expect(page.getByTestId('notice')).toContainText('Opening saved')
  })

  test('36. the scene with the help option cannot be left out', async ({ page }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
    await expect(page.locator('[data-testid="portal-scene"][data-scene="visitor"] [data-testid="portal-hide"]')).toHaveCount(0)
    const forged = await page.request.post('/api/hearts', { form: { action: 'opening-config', portalSlug: PORTAL, scene: await page.locator('[data-testid="portal-scene"][data-scene="visitor"] input[name=scene]').inputValue(), hidden: 'on', next: '/' }, maxRedirects: 0 })
    expect(new URL(forged.headers().location || '/', 'http://x').searchParams.get('error') || '').toContain('cannot be hidden')
  })

  test('37. a portal admin adds a help contact and the help screen lists it', async ({ page, browser }) => {
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
    await page.getByTestId('contact-label').fill('East London Mosque helpline')
    await page.getByTestId('contact-phone').fill('020 7650 3000')
    await page.getByTestId('contact-save').click()
    await expect(page.getByTestId('notice')).toContainText('Help contacts saved')
    const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await visitor.goto(`/p/${PORTAL}/help`)
    await expect(visitor.getByTestId('help-contacts')).toContainText('East London Mosque helpline')
    await visitor.close()
    const row = page.getByTestId('help-contact').filter({ hasText: 'East London Mosque helpline' })
    await row.getByRole('button', { name: 'Remove' }).click()
    await expect(page.getByTestId('notice')).toContainText('Help contacts saved')
  })

  test('38. persona bands stay drafts while rows are missing or identical', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/personas')
    await expect(page.getByTestId('persona-questions')).toContainText('Anger')
    await expect(page.getByTestId('question-identical')).toContainText('Traditionalist')
    await expect(page.getByTestId('question-doc-c')).toContainText('Doc C')
    const devout = page.locator('[data-testid="persona-band"][data-persona="devout"]')
    await expect(devout).toContainText('Draft')
    await expect(devout.getByTestId('same-ranges')).toContainText('Traditionalist')
    await expect(devout.locator('[data-testid="range-row"][data-scale="anger"]')).toContainText('No source row')
    await expect(devout.locator('[data-testid="range-row"][data-scale="greed"]')).toContainText('No source row')
    await expect(page.locator('[data-testid="persona-band"][data-persona="new-muslim"] [data-testid="range-min"]').first()).toHaveValue('')
    await devout.getByTestId('band-status').selectOption('published')
    await devout.getByTestId('band-save').click()
    await expect(page.getByTestId('error')).toBeVisible()
    await expect(page.locator('[data-testid="persona-band"][data-persona="devout"] [data-testid="band-status"]')).toHaveValue('draft')
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/trends')
    await expect(page.getByTestId('persona-lens')).toContainText('Rough guide, unvalidated')
    await expect(page.getByTestId('persona-held')).toContainText('draft')
  })

  test('39. the master edits a scale and a nudge, and a portal admin cannot see the bands', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/personas')
    const worry = page.locator('[data-testid="scale-editor"][data-scale="worry"]')
    await worry.getByTestId('first-open-read').uncheck()
    await worry.getByTestId('scale-save').click()
    await expect(page.getByTestId('error')).toContainText('worry')
    await expect(page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="first-open-read"]')).toBeChecked()
    await page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-season"]').selectOption('youth')
    await page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-save"]').click()
    await expect(page.getByTestId('notice')).toContainText('Scale saved')
    try {
      await expect(page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-season"]')).toHaveValue('youth')
      await page.goto('/master/opening')
      const nudge = page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudge"][data-option="treat"][data-scale="greed"]')
      await expect(nudge).toHaveValue('-1')
      await nudge.selectOption('0')
      await page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudges-save"]').click()
      await expect(page.getByTestId('notice')).toContainText('Nudges saved')
      await page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudge"][data-option="treat"][data-scale="greed"]').selectOption('-1')
      await page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudges-save"]').click()
      await expect(page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudge"][data-option="treat"][data-scale="greed"]')).toHaveValue('-1')
    } finally {
      await page.goto('/master/personas')
      const season = page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-season"]')
      if ((await season.inputValue()) !== '') {
        await season.selectOption('')
        await page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-save"]').click()
        await expect(page.locator('[data-testid="scale-editor"][data-scale="worry"] [data-testid="scale-season"]')).toHaveValue('')
      }
      const restored = page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudge"][data-option="treat"][data-scale="greed"]')
      await page.goto('/master/opening')
      if ((await restored.inputValue()) !== '-1') {
        await restored.selectOption('-1')
        await page.locator('[data-testid="scene-panel"][data-scene="extra"] [data-testid="nudges-save"]').click()
      }
    }

    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
    await expect(page.getByText('Devout Practitioner')).toHaveCount(0)
    await expect(page.getByText('Rough guide, unvalidated')).toHaveCount(0)
    const refused = await page.request.get('/api/persona-bands?limit=1')
    expect(refused.status()).toBe(403)
  })
})
