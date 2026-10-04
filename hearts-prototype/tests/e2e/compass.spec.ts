import { execSync } from 'node:child_process'
import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE, E2E_DATABASE } from '../env'

const PORTAL = 'hearts-demo'
const LEARNER = 'demo-learner@hearts.foundation'
const IMAM = 'demo-imam@hearts.foundation'
const PASSWORD = 'compass-demo'

test.beforeAll(() => {
  execSync('npx tsx src/seed/compass-demo.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: E2E_DATABASE } })
})

test('a learner cannot fetch their own scores from any compass API', async () => {
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const me = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER)}&depth=0`)).json()
  const id = me.docs[0].id as number
  await master.dispose()
  const learner = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await learner.post('/api/users/login', { data: { email: LEARNER, password: PASSWORD } })).ok()).toBeTruthy()
  const own = await (await learner.get(`/api/compass?portal=${PORTAL}`)).json()
  const text = JSON.stringify(own)
  expect(text).not.toMatch(/-\d/)
  expect(text).not.toMatch(/"(score|scores|deficit|rung|rank|persona|scales|why)"/)
  expect(own.kind).toBe('path')
  expect(own.focusLine || '').toMatch(/Focusing on/i)
  const self = await (await learner.get(`/api/compass?portal=${PORTAL}&learner=${id}`)).json()
  expect(JSON.stringify(self)).not.toMatch(/"(score|scores|rung|persona|scales|why)"/)
  expect((await learner.get(`/api/compass-attempts?limit=1`)).status()).toBe(403)
  expect((await learner.get(`/api/compass-serves?limit=1`)).status()).toBe(403)
  expect((await learner.get(`/api/compass-mixes?limit=1`)).status()).toBe(403)
  expect((await learner.get(`/api/persona-bands?limit=1`)).status()).toBe(403)
  expect((await learner.get(`/api/heart-scales?limit=1`)).status()).toBe(403)
  await learner.dispose()
})

test('the monthly look is five questions and a life check-in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`/login?next=${encodeURIComponent(`/p/${PORTAL}/recalibrate`)}`)
  await page.getByTestId('login-email').fill(LEARNER)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('recalibrate')).toBeVisible()
  await expect(page.getByTestId('month-scene')).toHaveCount(1)
  for (let index = 0; index < 5; index += 1) {
    await expect(page.getByTestId('progress')).toHaveText(`${index + 1} of 5`)
    await page.getByTestId('month-scene').locator('input[type="radio"]').nth(1).check()
  }
  await expect(page.getByTestId('life-check')).toContainText('Someone I love has gone')
  await expect(page.getByTestId('life-note')).toBeVisible()
  await page.locator('input[name="life-grief"]').check()
  await page.getByTestId('life-note').fill('The week has been quiet.')
  await page.getByTestId('month-save').click()
  await expect(page.getByTestId('learner-path')).toBeVisible()
  await expect(page.getByTestId('focus-line')).toContainText('Focusing on')
  const text = await page.getByTestId('learner-path').innerText()
  expect(text.toLowerCase()).not.toMatch(/greedy|persona|score|deficit/)
})

test('an imam sees the charts, the cohort, and why a talk was chosen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const found = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(LEARNER)}&depth=0`)).json()
  const id = found.docs[0].id as number
  await master.dispose()
  const imam = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await imam.post('/api/users/login', { data: { email: IMAM, password: PASSWORD } })).ok()).toBeTruthy()
  const detail = await (await imam.get(`/api/compass?portal=${PORTAL}&learner=${id}`)).json()
  expect(detail.series.length).toBeGreaterThan(0)
  expect(detail.whyNow.length).toBeGreaterThan(0)
  expect(String(detail.whyNow[0].why)).toMatch(/Low on|Grief|Steady on|door not sat/)
  const summary = await (await imam.get(`/api/compass?portal=${PORTAL}`)).json()
  expect(summary.personas.length).toBeGreaterThan(0)
  expect(JSON.stringify(summary.personas)).not.toContain(LEARNER)
  await imam.dispose()

  await page.goto(`/login?next=${encodeURIComponent(`/p/${PORTAL}/admin/compass/${id}`)}`)
  await page.getByTestId('login-email').fill(IMAM)
  await page.getByTestId('login-password').fill(PASSWORD)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('scale-sparks')).toBeVisible()
  await expect(page.getByTestId('persona-timeline')).toBeVisible()
  const timeline = await page.locator('[data-testid=persona-timeline]').boundingBox()
  const side = await page.locator('.side').boundingBox()
  expect(timeline).toBeTruthy()
  expect(side).toBeTruthy()
  expect(timeline!.x).toBeGreaterThanOrEqual(side!.x + side!.width - 1)
  await expect(page.getByTestId('life-timeline')).toBeVisible()
  await expect(page.getByTestId('why-talk').first()).toBeVisible()
  await page.goto(`/p/${PORTAL}/admin/compass`)
  await expect(page.getByTestId('cohort-personas')).toBeVisible()
  await expect(page.getByTestId('cohort-weak')).toBeVisible()
  await expect(page.getByTestId('cohort')).not.toContainText(LEARNER)
})
