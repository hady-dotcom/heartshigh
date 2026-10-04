import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

mkdirSync(SHOTS, { recursive: true })

async function hideIssues(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
}

async function noIssuesBadge(page: Page) {
  const box = await page.evaluate(() => {
    const portal = document.querySelector('nextjs-portal')
    const root = portal && 'shadowRoot' in portal ? portal.shadowRoot : null
    const button = root?.querySelector('button[aria-label="Open issues overlay"]') as HTMLElement | null
    if (!button) return { width: 0, height: 0 }
    const rect = button.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })
  expect(box).toEqual({ width: 0, height: 0 })
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
    await desk.setViewportSize(DESK)
    await signIn(desk, 'master@hearts.test', 'hearts-master', '/master/missions')
    await hideIssues(desk)
    await expect(desk.getByTestId('missions-desk')).toBeVisible()
    await expect(desk.getByTestId('desk-nav')).toContainText('Beginner')
    await expect(desk.getByTestId('desk-nav')).toContainText('Everyday tasks')
    await desk.getByTestId('nav-group-intermediate').locator('summary').click()
    await expect(desk.getByTestId('desk-nav')).toContainText('Scenes and Lanes')
    await desk.getByTestId('nav-group-in-depth').locator('summary').click()
    await expect(desk.getByTestId('nav-insights')).toBeVisible()
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-dialog')).toContainText('warm ask')
    await desk.screenshot({ path: `${SHOTS}/admin-help.png`, fullPage: true })
    await desk.getByTestId('desk-help-close').click()
    await desk.getByTestId('mission-new').click()
    await expect(desk.getByTestId('mission-form')).toBeVisible()
    await expect(desk.getByTestId('mission-title')).toHaveValue('Give HEARTS an hour this week')
    await expect(desk.getByTestId('mission-form')).toContainText(/January|February|March|April|May|June|July|August|September|October|November|December/)
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
    await joinFilm.page.getByTestId('mission-finish').click()
    await expect(joinFilm.page.getByTestId('mission-done')).toBeVisible()
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-mission-done.png` })
    await joinFilm.page.goto('/p/east-london/feed')
    await expect(joinFilm.page.getByTestId('feed-screen')).toBeVisible({ timeout: 20_000 })
    await expect(joinFilm.page.getByTestId('mission-card')).toBeVisible()
    await joinFilm.page.screenshot({ path: `${SHOTS}/phone-feed-mission.png` })
    await joinFilm.page.goto('/p/east-london/me/help')
    await expect(joinFilm.page.getByTestId('support-page')).toBeVisible()
    await joinFilm.page.getByTestId('support-body').fill('A small note for the team.')
    await joinFilm.page.getByTestId('support-send').click()
    await expect(joinFilm.page.getByTestId('support-message')).toBeVisible()
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
    await hideIssues(desk)
    await expect(desk.getByTestId('support-inbox')).toBeVisible()
    await desk.goto(`/master/missions/${missionId}`)
    await hideIssues(desk)
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
    await hideIssues(desk)
    await desk.getByTestId('insights-test-data').click()
    await expect(desk.getByTestId('insights-desk')).toBeVisible()
    await expect(desk.getByTestId('test-numbers')).toBeVisible()
    await expect(desk.getByTestId('insights-scroll')).toContainText('feed')
    const replayCount = await desk.getByTestId('insight-replay').locator('li').count()
    expect(replayCount).toBeGreaterThan(1)
    await noIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-heatmap.png`, fullPage: true })
    await desk.getByTestId('insights-tab-funnel').click()
    await expect(desk.getByTestId('insights-funnel')).toBeVisible()
    await expect(desk.getByTestId('funnel-step').first()).toContainText('Opening questions · 24 sessions')
    await noIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-funnel.png`, fullPage: true })
    await desk.getByTestId('insights-tab-angry').click()
    await expect(desk.getByTestId('insights-angry')).toBeVisible()
    await expect(desk.getByTestId('angry-row').first()).toContainText('feed')
    await expect(desk.getByTestId('angry-row').first()).not.toContainText('196')
    await noIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/insights-angry.png`, fullPage: true })

    await desk.goto('/master/calendar?date=2026-02-06&hour=10')
    await hideIssues(desk)
    await expect(desk.getByTestId('calendar-desk')).toBeVisible()
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-friday', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText('Watch')
    await expect(desk.getByTestId('calendar-desk')).toContainText('6 February 2026')
    await expect(desk.getByTestId('calendar-desk')).not.toContainText('feed-cta-label')
    await noIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/calendar-friday.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-01&hour=19')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-ramadan', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-ramadan.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-10&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-last-ten', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-last-ten.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-05-18&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-dhul-hijjah', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-dhul-hijjah.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-20&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-eid', 'yes')
    await expect(desk.getByTestId('calendar-cta')).toContainText('Eid')
    await desk.screenshot({ path: `${SHOTS}/calendar-eid.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-06-16&hour=10')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-muharram', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-muharram.png`, fullPage: true })

    await desk.goto('/master')
    await hideIssues(desk)
    await expect(desk.getByTestId('desk-nav')).toContainText('In-depth')
    await desk.getByTestId('nav-group-intermediate').locator('summary').click()
    await desk.getByTestId('nav-group-in-depth').locator('summary').click()
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-dialog')).toBeVisible()
    await noIssuesBadge(desk)
    await desk.screenshot({ path: `${SHOTS}/admin-nav.png`, fullPage: true })
    await desk.close()
  })
})

void E2E_BASE
