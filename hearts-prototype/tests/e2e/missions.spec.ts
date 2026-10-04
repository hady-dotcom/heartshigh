import { execFileSync } from 'node:child_process'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'
import { artifactDir } from './artifact-dir'
import { fakeYouTube } from './fake-youtube'
import { chromeCentresClear, stepFeed } from './feed-step'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SHOTS = artifactDir('screenshots')

async function assertNoIssuesBadge(page: Page) {
  const issues = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal')
    const root = portal && 'shadowRoot' in portal ? portal.shadowRoot : null
    const painted = [...(root?.querySelectorAll('button, [data-next-badge-root], [data-nextjs-toast]') || [])].filter((el) => {
      const box = (el as HTMLElement).getBoundingClientRect()
      return box.width > 1 && box.height > 1
    })
    const label = painted.map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim()).join(' ').match(/\b(\d+)\s+Issues?\b/)?.[0] || ''
    const detail = painted.map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200)).filter(Boolean)
    return { label, visible: painted.length, detail }
  })
  if (issues.visible || issues.label) {
    const overlay = page.getByRole('button', { name: /open issues overlay/i })
    if (await overlay.count()) await overlay.click()
    await page.waitForTimeout(400)
    const dumped = await page.evaluate(() => {
      const root = document.querySelector('nextjs-portal')?.shadowRoot
      const nodes = [...(root?.querySelectorAll('h1, h2, h3, p, pre, code, li, [data-nextjs-toast], [role="dialog"]') || [])]
        .map((el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 400))
        .filter((text) => text && !text.includes('sourceMappingURL'))
      return nodes.slice(0, 30)
    })
    await page.screenshot({ path: '/tmp/issues-overlay.png', fullPage: true })
    expect(issues, `Next.js Issues badge: ${dumped.join(' | ') || issues.detail.join(' | ')}`).toMatchObject({ label: '', visible: 0 })
  }
  expect(issues).toMatchObject({ label: '', visible: 0 })
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function storageFor(browser: Browser, email: string, password: string) {
  const context = await browser.newContext({ viewport: PHONE })
  const page = await context.newPage()
  await signIn(page, email, password, '/p/east-london')
  await expect(page.getByTestId('home')).toBeVisible({ timeout: 20_000 })
  const state = await context.storageState()
  await context.close()
  return state
}

async function filmedAuthed(browser: Browser, dest: string, state: Awaited<ReturnType<BrowserContext['storageState']>>) {
  const context = await browser.newContext({
    viewport: PHONE,
    storageState: state,
    recordVideo: { dir: SHOTS, size: PHONE },
  })
  const page = await context.newPage()
  return {
    page,
    async finish() {
      const video = page.video()
      await page.close()
      await context.close()
      if (!video) return
      const webm = await video.path()
      execFileSync('ffmpeg', ['-y', '-ss', '0.35', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', dest], { stdio: 'ignore' })
    },
  }
}

test.describe('Help shape HEARTS', () => {
  test('admin writes a mission, two learners join, both get the thank-you', async ({ browser }) => {
    const desk = await browser.newPage()
    const deskErrors: string[] = []
    desk.on('pageerror', (error) => deskErrors.push(error.message))
    await desk.setViewportSize(DESK)
    await signIn(desk, 'master@hearts.test', 'hearts-master', '/master/missions')
    await expect(desk.getByTestId('missions-desk')).toBeVisible()
    await expect(desk.getByTestId('nav-group-beginner').locator('summary')).toContainText('Beginner')
    await expect(desk.getByTestId('nav-group-intermediate')).toHaveJSProperty('open', true)
    await expect(desk.getByTestId('nav-group-beginner')).toHaveJSProperty('open', true)
    await expect(desk.getByTestId('desk-nav')).toContainText('Scenes and Lanes')
    await expect(desk.getByTestId('nav-insights')).toBeVisible()
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-pop')).toContainText('warm ask')
    await desk.screenshot({ path: `${SHOTS}/admin-help.png`, fullPage: true })
    await desk.getByTestId('desk-help').click()
    await desk.getByTestId('mission-new').click()
    await expect(desk.getByTestId('mission-form')).toBeVisible()
    await expect(desk.getByTestId('mission-form')).toContainText('No portal picked means every portal')
    await expect(desk.getByTestId('mission-title')).toHaveValue('Give HEARTS an hour this week')
    await expect(desk.getByTestId('mission-start')).toHaveValue(/October 2026|4 October/)
    await expect(desk.getByTestId('mission-form')).not.toContainText('10/04/2026')
    await desk.getByTestId('mission-ask').fill('If you have an hour this week, would you sit with HEARTS and tell us how the feed felt?')
    await desk.getByTestId('mission-why').fill('Your hour helps us choose the words on a button.')
    await desk.getByTestId('mission-target-field').fill('700')
    await desk.screenshot({ path: `${SHOTS}/mission-builder.png`, fullPage: true })
    await desk.getByTestId('mission-save').click()
    await expect(desk.getByTestId('mission-detail')).toBeVisible()
    await expect(desk.getByTestId('mission-result-panel')).toBeVisible()
    await desk.screenshot({ path: `${SHOTS}/mission-decided-empty.png`, fullPage: true })
    await desk.getByTestId('mission-open').click()
    await expect(desk.getByTestId('mission-joined')).toHaveText('0')
    const missionUrl = desk.url()
    const missionId = missionUrl.match(/missions\/(\d+)/)?.[1]
    expect(missionId).toBeTruthy()

    const firstState = await storageFor(browser, 'elm-learner@hearts.test', 'portal-learner')
    const secondState = await storageFor(browser, 'elm-learner2@hearts.test', 'portal-learner')

    const joinFilm = await filmedAuthed(browser, `${SHOTS}/mission-join.mp4`, firstState)
    await joinFilm.page.goto('/p/east-london')
    await expect(joinFilm.page.getByTestId('home')).toBeVisible({ timeout: 20_000 })
    await expect(joinFilm.page.getByTestId('mission-card')).toBeVisible()
    await expect(joinFilm.page.getByTestId('mission-card')).toContainText('Give HEARTS an hour this week')
    await expect(joinFilm.page.getByTestId('continue')).toBeVisible()
    const continueBox = await joinFilm.page.getByTestId('continue').boundingBox()
    expect(continueBox).toBeTruthy()
    expect((continueBox?.y || 0) + 20).toBeLessThan(844)
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-home-mission.png` })
    await joinFilm.page.getByTestId('mission-open').click()
    await expect(joinFilm.page.getByTestId('mission-page')).toBeVisible()
    await expect(joinFilm.page.getByTestId('mission-progress')).toContainText('have joined')
    await expect(joinFilm.page.getByTestId('mission-minutes')).toContainText('minutes')
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-mission-join.png` })
    await joinFilm.page.getByTestId('mission-join').click()
    await expect(joinFilm.page.getByTestId('mission-finish')).toBeVisible()
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-mission-joined.png` })
    await fakeYouTube(joinFilm.page)
    await joinFilm.page.goto('/p/east-london/feed')
    await expect(joinFilm.page.getByTestId('feed-screen')).toBeVisible({ timeout: 20_000 })
    await expect(joinFilm.page.getByTestId('feed-mission')).toBeVisible()
    const journey = joinFilm.page.getByTestId('journey')
    if (await joinFilm.page.getByTestId('swipe-coach').count()) {
      await joinFilm.page.getByTestId('swipe-coach').dispatchEvent('click')
    }
    await expect(joinFilm.page.getByTestId('swipe-coach')).toHaveCount(0)
    await expect(joinFilm.page.getByTestId('learn-more')).toBeVisible()
    if (!(await joinFilm.page.getByTestId('lane-chip').isVisible().catch(() => false))) {
      if ((await stepFeed(joinFilm.page)) === 'ok' && !(await joinFilm.page.getByTestId('learn-more').isVisible().catch(() => false))) {
        await joinFilm.page.getByTestId('gesture-prev').dispatchEvent('click')
        await expect(joinFilm.page.getByTestId('learn-more')).toBeVisible()
      }
    }
    await expect(joinFilm.page.getByTestId('learn-more')).toBeVisible()
    await expect(joinFilm.page.getByTestId('learn-more')).toHaveText(/Watch the 3-minute version/)
    await expect(joinFilm.page.getByTestId('swipe-hint')).toBeVisible()
    await expect(joinFilm.page.getByTestId('lane-chip')).toBeVisible()
    await expect(joinFilm.page.getByTestId('clip-timer')).toBeVisible()
    await expect(joinFilm.page.getByTestId('tab-week')).toHaveText('My week')
    await expect(joinFilm.page.getByTestId('tap-sound').first()).toBeVisible({ timeout: 15_000 })
    const missionBox = await joinFilm.page.getByTestId('feed-mission').boundingBox()
    const clipBox = await joinFilm.page.getByTestId('learn-more').boundingBox()
    expect(missionBox && clipBox).toBeTruthy()
    expect((missionBox?.y || 0) + (missionBox?.height || 0)).toBeLessThan(clipBox?.y || 0)
    await chromeCentresClear(joinFilm.page)
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-feed-mission.png` })
    const lesson = await journey.getAttribute('data-lesson')
    const speaker = await journey.getAttribute('data-speaker')
    const slug = await journey.getAttribute('data-speaker-slug')
    expect(lesson).toBeTruthy()
    await joinFilm.page.request.post('/api/hearts', {
      headers: { accept: 'application/json' },
      form: {
        action: 'browse',
        level: 'appetiser',
        event: 'linger',
        lesson: lesson!,
        speaker: speaker || 'Shaykh',
        speakerSlug: slug || 'speaker',
        start: '0',
        end: '780',
        parent: `talk:${lesson}`,
      },
    })
    await joinFilm.page.goto(`/p/east-london/mission/${missionId}`)
    await expect(joinFilm.page.getByTestId('mission-minutes')).toContainText(/\b1[0-9] of 60 minutes/)
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-mission-minutes.png` })
    await joinFilm.page.getByTestId('mission-finish').click()
    await expect(joinFilm.page.getByTestId('mission-done')).toBeVisible()
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-mission-done.png` })
    await joinFilm.page.goto('/p/east-london/me/help')
    await expect(joinFilm.page.getByTestId('support-page')).toBeVisible()
    await joinFilm.page.getByTestId('support-body').fill('A small note for the team.')
    await joinFilm.page.getByTestId('support-send').click()
    await expect(joinFilm.page.getByTestId('support-message')).toBeVisible()
    await expect(joinFilm.page.getByTestId('error')).toHaveCount(0)
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-ask-help.png` })
    await joinFilm.finish()

    const second = await browser.newContext({ viewport: PHONE, storageState: secondState })
    const secondPage = await second.newPage()
    await secondPage.goto('/p/east-london')
    await expect(secondPage.getByTestId('home')).toBeVisible({ timeout: 20_000 })
    await secondPage.getByTestId('mission-open').click()
    await secondPage.getByTestId('mission-join').click()
    await expect(secondPage.getByTestId('mission-finish')).toBeVisible()
    await secondPage.close()
    await second.close()

    await desk.goto('/master/missions')
    await expect(desk.getByTestId('support-inbox')).toBeVisible()
    await desk.goto(`/master/missions/${missionId}`)
    await expect(desk.getByTestId('mission-joined')).toHaveText('2')
    await desk.getByTestId('mission-result').fill("the button now says 'Stay with this'")
    await desk.getByTestId('mission-share-result').click()
    await expect(desk.getByTestId('mission-decided')).toContainText("the button now says 'Stay with this'")
    await desk.screenshot({ path: `${SHOTS}/mission-decided.png`, fullPage: true })

    const thanksFilm = await filmedAuthed(browser, `${SHOTS}/mission-thankyou.mp4`, firstState)
    await thanksFilm.page.goto('/p/east-london/me')
    await expect(thanksFilm.page.getByTestId('me')).toBeVisible({ timeout: 20_000 })
    await expect(thanksFilm.page.getByTestId('notification').filter({ hasText: 'Thank you' })).toHaveCount(1)
    await expect(thanksFilm.page.getByTestId('notification').filter({ hasText: 'Thank you' })).toBeVisible()
    await expect(thanksFilm.page.getByTestId('shaped-list')).toContainText('You helped decide')
    await expect(thanksFilm.page.getByTestId('start-again')).toContainText('opening questions')
    await thanksFilm.page.getByTestId('notification').first().scrollIntoViewIfNeeded()
    await thanksFilm.page.screenshot({ path: `${SHOTS}/phone-thankyou.png` })
    await thanksFilm.page.goto('/p/east-london/me/shaped')
    await expect(thanksFilm.page.getByTestId('shaped-page')).toBeVisible()
    await expect(thanksFilm.page.getByTestId('shaped-result')).toContainText('You helped decide')
    await thanksFilm.page.screenshot({ path: `${SHOTS}/phone-shaped.png` })
    await thanksFilm.finish()

    const thanksTwo = await browser.newContext({ viewport: PHONE, storageState: secondState })
    const thanksTwoPage = await thanksTwo.newPage()
    await thanksTwoPage.goto('/p/east-london/me')
    await expect(thanksTwoPage.getByTestId('me')).toBeVisible({ timeout: 20_000 })
    await expect(thanksTwoPage.getByTestId('notification').first()).toContainText('Thank you')
    await thanksTwoPage.close()
    await thanksTwo.close()

    await desk.goto('/master/insights')
    await desk.getByTestId('insights-test-data').click()
    await expect(desk.getByTestId('insights-desk')).toBeVisible()
    await expect(desk.getByTestId('test-numbers')).toBeVisible()
    await expect(desk.getByTestId('insights-scroll')).toContainText('feed')
    const replay = desk.getByTestId('insight-replay')
    const replayCount = await replay.locator('li').count()
    expect(replayCount).toBeGreaterThan(1)
    await expect(replay).toContainText('Home')
    await expect(replay).toContainText('opening questions')
    await expect(replay).toContainText('watched 72%')
    await assertNoIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-heatmap.png`, fullPage: true })
    await desk.getByTestId('insights-tab-funnel').click()
    await expect(desk.getByTestId('insights-funnel')).toBeVisible()
    await expect(desk.getByTestId('funnel-step').first()).toContainText(/Opening questions · \d+ sessions/)
    await assertNoIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-funnel.png`, fullPage: true })
    await desk.getByTestId('insights-tab-angry').click()
    await expect(desk.getByTestId('insights-angry')).toBeVisible()
    await expect(desk.getByTestId('angry-row').first()).toContainText('feed')
    await expect(desk.getByTestId('angry-row').first()).toContainText('lower middle')
    await expect(desk.getByTestId('angry-row').first()).not.toContainText('196')
    await assertNoIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-angry.png`, fullPage: true })

    await desk.goto('/master/calendar?date=2026-02-06&hour=10')
    await expect(desk.getByTestId('calendar-desk')).toBeVisible()
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-friday', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText('Watch')
    await expect(desk.getByTestId('calendar-desk')).toContainText('6 February 2026')
    await expect(desk.getByTestId('calendar-desk')).not.toContainText('feed-cta-label')
    await assertNoIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/calendar-friday.png`, fullPage: true })
    const fridayCta = (await desk.getByTestId('calendar-cta').innerText()).trim()
    await desk.getByTestId('make-experiment').click()
    await expect(desk.getByTestId('experiment-detail')).toBeVisible()
    await expect(desk.getByTestId('variant-table')).toContainText('Watch the 3-minute version')
    await expect(desk.getByTestId('variant-table')).toContainText(fridayCta)
    await desk.goto('/master/calendar?date=2027-02-07&hour=16&zone=America/Toronto')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-hijri', /^(29|30) Sha'ban 1448$/)
    await desk.goto('/master/calendar?date=2027-02-07&hour=19&minute=30&zone=America/Toronto')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-hijri', '1 Ramadan 1448')
    await desk.goto('/master/calendar?date=2026-03-01&hour=19')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-ramadan', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-ramadan.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-10&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-last-ten', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-last-ten.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-05-18&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-dhul-hijjah', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText(/Watch|Sit/)
    await expect(desk.getByTestId('calendar-cta')).not.toHaveText('Learn more ›')
    await desk.screenshot({ path: `${SHOTS}/calendar-dhul-hijjah.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-20&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-eid', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText('Eid')
    await desk.screenshot({ path: `${SHOTS}/calendar-eid.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-06-16&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-muharram', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText(/Watch|Sit/)
    await expect(desk.getByTestId('calendar-cta')).not.toHaveText('Learn more ›')
    await desk.screenshot({ path: `${SHOTS}/calendar-muharram.png`, fullPage: true })

    await desk.goto('/master')
    await expect(desk.getByTestId('nav-group-beginner').locator('summary')).toContainText('Beginner')
    await expect(desk.getByTestId('desk-nav')).toContainText('In-depth')
    await desk.getByTestId('nav-group-beginner').locator('summary').click()
    await desk.getByTestId('nav-group-in-depth').locator('summary').click()
    await expect(desk.getByTestId('nav-insights')).toBeVisible()
    await expect(desk.getByTestId('nav-group-beginner')).toHaveJSProperty('open', false)
    await expect(desk.getByTestId('nav-group-intermediate')).toHaveJSProperty('open', false)
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-dialog')).toBeVisible()
    await assertNoIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/admin-nav.png`, fullPage: true })
    expect(deskErrors.join('\n')).not.toContain('Hydration')
    expect(deskErrors.join('\n')).not.toMatch(/did not match|Minified React error/i)
    await desk.close()
  })
})

test('Toronto 7 Feb 2027 is Sha\'ban before sunset and 1 Ramadan at 19:30 ET', async ({ browser }) => {
  test.setTimeout(60_000)
  const desk = await browser.newPage()
  await desk.setViewportSize(DESK)
  await signIn(desk, 'master@hearts.test', 'hearts-master', '/master/calendar')
  await desk.goto('/master/calendar?date=2027-02-07&hour=16&zone=America/Toronto')
  await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-hijri', /^(29|30) Sha'ban 1448$/)
  await expect(desk.getByTestId('calendar-context')).toContainText(/16:00 Toronto/)
  await desk.screenshot({ path: `${SHOTS}/calendar-toronto-before-sunset.png`, fullPage: true })
  await desk.goto('/master/calendar?date=2027-02-07&hour=19&minute=30&zone=America/Toronto')
  await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-hijri', '1 Ramadan 1448')
  await expect(desk.getByTestId('calendar-context')).toContainText(/19:30 Toronto/)
  await desk.screenshot({ path: `${SHOTS}/calendar-toronto-1930.png`, fullPage: true })
  await desk.close()
})

test('a Friday calendar window reaches the feed gold button', async ({ browser, playwright }) => {
  test.setTimeout(90_000)
  const api = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await api.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  expect((await api.post('/api/hearts', { form: { action: 'clock', iso: '2026-02-06T10:00:00.000Z', next: '/' } })).ok()).toBeTruthy()
  try {
    const context = await browser.newContext({ viewport: PHONE })
    const page = await context.newPage()
    await fakeYouTube(page)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/feed')
    await expect(page.getByTestId('feed-screen')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('swipe-coach')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('swipe-coach').click()
    await expect(page.getByTestId('swipe-coach')).toHaveCount(0)
    await expect(page.getByTestId('learn-more')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('learn-more')).toContainText(/Friday|Jumu/)
    await expect(page.getByTestId('learn-more')).not.toHaveText(/^Learn more/)
    await expect(page.getByTestId('feed-mission')).toHaveCount(0)
    await expect(page.getByTestId('tap-sound').first()).toBeVisible()
    const plainChrome = await chromeCentresClear(page)
    expect(plainChrome).toContain('tap-sound')
    expect(plainChrome).toContain('learn-more')
    expect(plainChrome).not.toContain('feed-mission')
    await page.screenshot({ path: `${SHOTS}/phone-feed-plain.png` })
    await page.close()
    await context.close()
  } finally {
    await api.post('/api/hearts', { form: { action: 'clock', iso: '', next: '/' } })
    await api.dispose()
  }
})

test('a running experiment label wins over the Friday calendar line on the gold button', async ({ browser, playwright }) => {
  test.setTimeout(90_000)
  const api = await playwright.request.newContext({ baseURL: E2E_BASE })
  expect((await api.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  expect((await api.post('/api/hearts', { form: { action: 'clock', iso: '2026-02-06T10:00:00.000Z', next: '/' } })).ok()).toBeTruthy()
  const json = { accept: 'application/json' }
  const made = await api.post('/api/experiments', { headers: json, form: { action: 'from-label', slot: 'feed-cta-label', label: 'Watch the experiment version ›', reason: 'Round-5 experiment wins' } })
  expect(made.ok(), await made.text()).toBeTruthy()
  const created = await made.json() as { id: number }
  expect((await api.post('/api/experiments', { headers: json, form: { action: 'approve-variant', id: String(created.id), variant: 'a' } })).ok()).toBeTruthy()
  expect((await api.post('/api/experiments', { headers: json, form: { action: 'approve-variant', id: String(created.id), variant: 'b' } })).ok()).toBeTruthy()
  expect((await api.post('/api/experiments', { headers: json, form: { action: 'start', id: String(created.id) } })).ok()).toBeTruthy()
  try {
    const context = await browser.newContext({ viewport: PHONE })
    const page = await context.newPage()
    await fakeYouTube(page)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/feed')
    await expect(page.getByTestId('feed-screen')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('swipe-coach')).toBeVisible({ timeout: 10_000 })
    await page.getByTestId('swipe-coach').click()
    await expect(page.getByTestId('swipe-coach')).toHaveCount(0)
    const cta = page.getByTestId('learn-more')
    await expect(cta).toBeVisible({ timeout: 20_000 })
    await expect(cta).toHaveText(/Watch the 3-minute version|Watch the experiment version/)
    await expect(cta).not.toHaveText(/Friday|Jumu/)
    await expect(cta).not.toHaveText(/^Learn more/)
    await page.close()
    await context.close()
  } finally {
    await api.post('/api/experiments', { headers: json, form: { action: 'finish', id: String(created.id) } })
    await api.post('/api/hearts', { form: { action: 'clock', iso: '', next: '/' } })
    await api.dispose()
  }
})

void E2E_BASE
