import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { expect, test, type Browser, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

mkdirSync(SHOTS, { recursive: true })

async function filmedPage(browser: Browser, dest: string) {
  const context = await browser.newContext({
    viewport: PHONE,
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
      execFileSync('ffmpeg', ['-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an', dest], { stdio: 'ignore' })
    },
  }
}

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('Help shape HEARTS', () => {
  test('admin writes a mission, two learners join, both get the thank-you', async ({ browser }) => {
    const desk = await browser.newPage()
    await desk.setViewportSize(DESK)
    await signIn(desk, 'master@hearts.test', 'hearts-master', '/master/missions')
    await expect(desk.getByTestId('missions-desk')).toBeVisible()
    await expect(desk.getByTestId('desk-nav')).toContainText('Beginner')
    await expect(desk.getByTestId('desk-nav')).toContainText('Everyday tasks')
    await expect(desk.getByTestId('nav-insights')).toBeVisible()
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-dialog')).toContainText('warm ask')
    await desk.getByTestId('desk-help-close').click()
    await desk.getByTestId('mission-new').click()
    await expect(desk.getByTestId('mission-form')).toBeVisible()
    const title = `Please use HEARTS for one hour ${Date.now().toString().slice(-5)}`
    await desk.getByTestId('mission-title').fill(title)
    await desk.getByTestId('mission-ask').fill('If you have an hour this week, would you sit with HEARTS and tell us how the feed felt?')
    await desk.getByTestId('mission-why').fill('We are choosing the words on a button.')
    await desk.getByTestId('mission-target-field').fill('700')
    await desk.getByTestId('mission-save').click()
    await expect(desk.getByTestId('mission-detail')).toBeVisible()
    await desk.getByTestId('mission-open').click()
    await expect(desk.getByTestId('mission-joined')).toHaveText('0')
    const missionUrl = desk.url()
    const missionId = missionUrl.match(/missions\/(\d+)/)?.[1]
    expect(missionId).toBeTruthy()

    let first = true
    for (const person of [
      { email: 'elm-learner@hearts.test', password: 'portal-learner' },
      { email: 'elm-learner2@hearts.test', password: 'portal-learner' },
    ]) {
      const filmed = first ? await filmedPage(browser, `${SHOTS}/mission-join.mp4`) : null
      const page = filmed?.page || await browser.newPage()
      if (!filmed) await page.setViewportSize(PHONE)
      await signIn(page, person.email, person.password, '/p/east-london')
      await expect(page.getByTestId('home')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('mission-card')).toBeVisible()
      if (first) await page.screenshot({ path: `${SHOTS}/phone-home-mission.png` })
      await page.getByTestId('mission-open').click()
      await expect(page.getByTestId('mission-page')).toBeVisible()
      await expect(page.getByTestId('mission-progress')).toContainText('have joined')
      if (first) await page.screenshot({ path: `${SHOTS}/phone-mission-join.png` })
      await page.getByTestId('mission-join').click()
      await expect(page.getByTestId('mission-finish')).toBeVisible()
      if (first) await page.screenshot({ path: `${SHOTS}/phone-mission-joined.png` })
      if (filmed) await filmed.finish()
      else await page.close()
      first = false
    }

    await desk.goto(`/master/missions/${missionId}`)
    await expect(desk.getByTestId('mission-joined')).toHaveText('2')
    await desk.getByTestId('mission-result').fill("the button now says 'Stay with this'")
    await desk.getByTestId('mission-share-result').click()
    await expect(desk.getByTestId('mission-decided')).toContainText("the button now says 'Stay with this'")

    let firstThanks = true
    for (const person of [
      { email: 'elm-learner@hearts.test', password: 'portal-learner' },
      { email: 'elm-learner2@hearts.test', password: 'portal-learner' },
    ]) {
      const filmed = firstThanks ? await filmedPage(browser, `${SHOTS}/mission-thankyou.mp4`) : null
      const page = filmed?.page || await browser.newPage()
      if (!filmed) await page.setViewportSize(PHONE)
      await signIn(page, person.email, person.password, '/p/east-london/me')
      await expect(page.getByTestId('me')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId('notification').first()).toContainText('Thank you')
      await expect(page.getByTestId('shaped-list')).toContainText('You helped decide')
      if (firstThanks) await page.screenshot({ path: `${SHOTS}/phone-thankyou.png` })
      if (filmed) await filmed.finish()
      else await page.close()
      firstThanks = false
    }

    await desk.goto('/master/insights')
    await desk.getByTestId('insights-test-data').click()
    await expect(desk.getByTestId('insights-desk')).toBeVisible()
    await desk.screenshot({ path: `${SHOTS}/insights-heatmap.png`, fullPage: true })
    await desk.getByTestId('insights-tab-funnel').click()
    await expect(desk.getByTestId('insights-funnel')).toBeVisible()
    await desk.screenshot({ path: `${SHOTS}/insights-funnel.png`, fullPage: true })
    await desk.getByTestId('insights-tab-angry').click()
    await expect(desk.getByTestId('insights-angry')).toBeVisible()
    await desk.screenshot({ path: `${SHOTS}/insights-angry.png`, fullPage: true })

    await desk.goto('/master/calendar?date=2026-02-06&hour=10')
    await expect(desk.getByTestId('calendar-desk')).toBeVisible()
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-friday', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-friday.png`, fullPage: true })
    await desk.goto('/master/calendar?date=2026-03-01&hour=19')
    await expect(desk.getByTestId('calendar-phone')).toHaveAttribute('data-ramadan', 'yes')
    await desk.screenshot({ path: `${SHOTS}/calendar-ramadan.png`, fullPage: true })

    await desk.goto('/master/missions/new')
    await expect(desk.getByTestId('mission-form')).toBeVisible()
    await desk.screenshot({ path: `${SHOTS}/mission-builder.png`, fullPage: true })
    await desk.goto('/master')
    await expect(desk.getByTestId('desk-nav')).toContainText('In-depth')
    await desk.screenshot({ path: `${SHOTS}/admin-nav.png`, fullPage: true })
    await desk.close()
  })
})

void E2E_BASE
