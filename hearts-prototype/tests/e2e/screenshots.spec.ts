import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { seedCode } from '../env'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/screenshots'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function openFirstPart(page: Page) {
  if (await page.getByTestId('player').count()) return
  const first = page.getByTestId('buffet-talk').first()
  if (await first.count()) await first.click()
  else if (await page.getByTestId('start-part').count()) await page.getByTestId('start-part').click()
  await expect(page.getByTestId('player')).toBeVisible({ timeout: 15_000 })
}

async function shot(page: Page, name: string, path: string, fullPage = false) {
  mkdirSync(dir, { recursive: true })
  await page.goto(path)
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage, caret: 'initial' })
}

test.describe.configure({ timeout: 300_000 })

test('a week of use, so the garden has something in it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/lanes')
  for (const course of [1, 2, 3]) {
    await page.goto(`/p/east-london/course/${course}`)
    await openFirstPart(page)
    const lesson = await page.locator('form.watched-form input[name=lesson]').getAttribute('value')
    await page.request.post('/api/hearts', { form: { action: 'complete', lesson: lesson!, seconds: '99999', ended: 'yes', next: '/' } })
  }
  await page.goto('/p/east-london/course/1')
  await openFirstPart(page)
  await expect(async () => {
    await page.getByTestId('timeline-dot').first().click({ force: true })
    await expect(page.getByTestId('answer-form')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await page.getByTestId('answer-text').fill('Sending salawat after Fajr, before I pick up my phone.')
  await page.getByTestId('answer-private').uncheck()
  await page.getByTestId('answer-share').check()
  await page.getByTestId('answer-submit').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await page.goto('/p/east-london/garden/jibril/10')
  await expect(page.getByText('Seats from al-Ghuniyya.')).toBeVisible()
  if (await page.getByTestId('seat-read').count()) await page.getByTestId('seat-read').first().click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  const entry = page.getByTestId('workbook-review').filter({ hasText: 'salawat after Fajr' }).first()
  if (await entry.getByTestId('teacher-reply').count() === 0) {
    await entry.getByTestId('reply-text').fill('A lovely habit, Maryam. Try ten each morning this week.')
    await entry.getByTestId('reply-submit').click()
    await expect(page.getByTestId('notice')).toBeVisible()
  }
})

test('learner app at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('home')).toBeVisible()
  const base = '/p/east-london'
  const screens: [string, string][] = [
    ['01-home', base],
    ['01c-feed', `${base}/feed`],
    ['02-lanes', `${base}/lanes`],
    ['02b-speaker', `${base}/speaker/mikaeel-smith`],
    ['03-course-player', `${base}/course/1`],
    ['03-course-player-youtube', `${base}/course/3`],
    ['04-garden', `${base}/garden`],
    ['04-garden-general', `${base}/garden/general`],
    ['04-garden-jibril', `${base}/garden/jibril`],
    ['04-garden-door', `${base}/garden/jibril/10`],
    ['04-garden-ghunya', `${base}/garden/ghunya`],
    ['04-garden-harvest', `${base}/garden/harvest`],
    ['04-garden-workbook', `${base}/garden/workbook`],
    ['05-me', `${base}/me`],
    ['05-me-circle', `${base}/me/circle`],
    ['05-me-plan', `${base}/me/plan`],
    ['05-me-settings', `${base}/me/settings`],
    ['06-welcome-result', `${base}/welcome`],
    ['06-welcome-placing', `${base}/welcome?step=placing`],
    ['06-welcome-splash', `${base}/welcome?step=start`],
  ]
  for (const [name, path] of screens) await shot(page, `learner-${name}`, path)
  await page.goto(`${base}/feed`)
  await expect(async () => {
    await page.getByTestId('learn-more').click()
    await expect(page.getByTestId('journey')).toHaveAttribute('data-mode', 'appetiser', { timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${dir}/learner-01b-appetiser.png`, caret: 'initial' })
  await page.goto(`${base}/course/1`)
  await openFirstPart(page)
  await expect(async () => {
    await page.getByTestId('timeline-dot').first().click({ force: true })
    await expect(page.getByTestId('popup')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${dir}/learner-03b-answer-sheet.png`, caret: 'initial' })
})

test('portal desk at desktop size', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin')
  const base = '/p/east-london/admin'
  for (const [name, path] of [
    ['overview', base],
    ['content', `${base}/content`],
    ['course-builder', `${base}/content/4`],
    ['library-course-editor', `${base}/content/1`],
    ['library', `${base}/library`],
    ['access', `${base}/access`],
    ['teach', `${base}/teach`],
    ['plans', `${base}/plans`],
    ['nights', `${base}/nights`],
    ['settings', `${base}/settings`],
    ['opening', `${base}/opening`],
  ]) await shot(page, `admin-${name}`, path)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  for (const [name, path] of [
    ['portals', '/master'],
    ['library', '/master/library'],
    ['library-course', '/master/library/2'],
    ['packs', '/master/packs'],
    ['questions', '/master/questions'],
    ['opening', '/master/opening'],
    ['lanes', '/master/lanes'],
    ['trends', '/master/trends'],
  ]) await shot(page, `master-${name}`, path)
  await shot(page, 'master-simulator', '/master/simulator')
  for (const [scene, option] of [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['doors', 'calmer']]) {
    await page.getByTestId(`sim-${scene}`).selectOption(option)
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${dir}/master-simulator-picked.png`, caret: 'initial' })
})

test('the opening at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route(/youtube\.com\/(embed|iframe_api)|googlevideo/, (route) => route.abort())
  await shot(page, 'opening-01-opener', '/p/east-london/start')
  await page.getByTestId('lets-play').click()
  const picks: [string, string][] = [['extra', 'pause'], ['queue', 'let-go'], ['thumb', 'lives'], ['visitor', 'spin'], ['news', 'nobody'], ['account', 'lord'], ['doors', 'calmer']]
  for (const [at, [scene, option]] of picks.entries()) {
    await expect(page.locator(`[data-testid="scene"][data-scene="${scene}"]`)).toBeVisible()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${dir}/opening-0${at + 2}-${scene}.png`, caret: 'initial' })
    await page.locator(`[data-testid="scene"][data-scene="${scene}"] [data-testid="tile"][data-option="${option}"]`).click()
  }
  await expect(page.getByTestId('journey')).toHaveAttribute('data-phase', 'feed', { timeout: 15_000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${dir}/opening-09-feed.png`, caret: 'initial' })
  await page.getByTestId('fave').click()
  await expect(page.getByTestId('keep-sheet')).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${dir}/opening-10-keep-sheet.png`, caret: 'initial' })
  await shot(page, 'opening-11-help', '/p/east-london/help')
})

test('view as, from the portal desk', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
  const row = page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' })
  await row.getByTestId('view-as').click()
  await row.getByTestId('view-as-reason').fill('Checking what she sees in her workbook')
  await page.screenshot({ path: `${dir}/viewas-01-ask.png`, caret: 'initial' })
  await row.getByTestId('view-as-start').click()
  await page.waitForURL((url) => !url.pathname.includes('/admin'))
  await expect(page.getByTestId('viewas-banner')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'viewas-02-workbook', '/p/east-london/garden/workbook')
  await page.getByTestId('viewas-exit').click()
  await page.waitForURL(/admin\/teach/)
})

test('door, sign-in and join', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'door', '/')
  await shot(page, 'login', '/login')
  await shot(page, 'join', `/join?code=${seedCode('elm-learner')}`)
})

test('circle answers: the desk and the swarm', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/circle')
  await shot(page, 'master-circle', '/master/circle')
  const lesson = await page.getByTestId('circle-talk').filter({ hasText: 'Al-Nur' }).first().getAttribute('data-lesson')
  await shot(page, 'master-circle-talk', `/master/circle?lesson=${lesson}`)
  await page.getByTestId('circle-edit-open').first().click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/master-circle-edit.png`, caret: 'initial' })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/circle')
  await shot(page, 'admin-circle', '/p/east-london/admin/circle')

  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner2@hearts.test', 'portal-learner', '/p/east-london')
  await page.request.post('/api/hearts', { form: { action: 'me-pref', name: 'shareWithLearners', value: 'on', next: '/' } })
  await page.goto(`/p/east-london/course/3?part=${lesson}`)
  await page.getByTestId('answer-point').click()
  await expect(page.getByTestId('swarm')).toBeVisible()
  await page.getByTestId('swarm').scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${dir}/learner-03c-swarm-circle.png`, caret: 'initial' })
})
