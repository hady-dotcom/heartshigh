import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const dir = process.env.SCREENSHOT_DIR || 'artifacts/screenshots'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function shot(page: Page, name: string, path: string, fullPage = false) {
  mkdirSync(dir, { recursive: true })
  await page.goto(path)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage, caret: 'initial' })
}

test.describe.configure({ timeout: 180_000 })

test('learner app at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await expect(page.getByTestId('feed')).toBeVisible()
  const base = '/p/east-london'
  const screens: [string, string][] = [
    ['01-home-feed', base],
    ['02-lanes', `${base}/lanes`],
    ['02b-speaker', `${base}/speaker/mikaeel-smith`],
    ['03-course-player', `${base}/course/1`],
    ['03-course-player-youtube', `${base}/course/3`],
    ['04-garden', `${base}/garden`],
    ['04-garden-general', `${base}/garden/general`],
    ['04-garden-jibril', `${base}/garden/jibril`],
    ['04-garden-clause', `${base}/garden/jibril/22`],
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
  await page.goto(`${base}/course/1`)
  await expect(async () => {
    await page.getByTestId('timeline-dot').first().click()
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
  ]) await shot(page, `admin-${name}`, path)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master')
  for (const [name, path] of [
    ['portals', '/master'],
    ['library', '/master/library'],
    ['library-course', '/master/library/2'],
    ['packs', '/master/packs'],
    ['questions', '/master/questions'],
  ]) await shot(page, `master-${name}`, path)
})

test('door, sign-in and join', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await shot(page, 'door', '/')
  await shot(page, 'login', '/login')
  await shot(page, 'join', '/join?code=ELM-LEARN')
})
