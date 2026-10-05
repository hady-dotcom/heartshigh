import { execSync } from 'node:child_process'
import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE, e2eDatabase } from '../env'

const PORTAL = 'hearts-demo'
const LEARNER = 'demo-learner@hearts.foundation'
const IMAM = 'demo-imam@hearts.foundation'
const PASSWORD = 'compass-demo'

test.beforeAll(() => {
  execSync('npx tsx src/seed/compass-demo.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: e2eDatabase } })
})

test('a learner cannot fetch their own scores from any compass API', async () => {
  const learner = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const login = await learner.post('/api/users/login', { data: { email: LEARNER, password: PASSWORD } })
  const loginBody = await login.json().catch(() => ({})) as { user?: { id?: number } }
  expect(login.ok(), JSON.stringify(loginBody)).toBeTruthy()
  const id = loginBody.user?.id
  expect(id, JSON.stringify(loginBody)).toBeTruthy()
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
    if (index === 0) {
      const label = await page.getByTestId('progress').boundingBox()
      const bar = await page.locator('.progress-line').boundingBox()
      expect(label).toBeTruthy()
      expect(bar).toBeTruthy()
      expect(label!.x).toBeGreaterThan(bar!.x + bar!.width - 8)
      expect(label!.height).toBeGreaterThan(10)
    }
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
  const overlaps = await page.getByTestId('learner-path').evaluate((root) => {
    const nodes = [...root.querySelectorAll('h1, .lead, .eyebrow, .card, [data-testid="next-step"], [data-testid="soft-area"], [data-testid="focus-line"]')]
    const boxes = nodes.map((el) => {
      const rect = el.getBoundingClientRect()
      return { el, text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 48), top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
    }).filter((box) => box.bottom - box.top > 2 && box.right - box.left > 2)
    const hits: string[] = []
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const crossing = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
        if (crossing) hits.push(`${a.text} ∩ ${b.text}`)
      }
    }
    return hits
  })
  expect(overlaps).toEqual([])
  const steps = page.getByTestId('next-step')
  const stepCount = await steps.count()
  for (let index = 0; index < stepCount; index += 1) {
    const display = await steps.nth(index).evaluate((el) => getComputedStyle(el).display)
    const decoration = await steps.nth(index).evaluate((el) => getComputedStyle(el).textDecorationLine)
    expect(display).toBe('flex')
    expect(decoration).not.toContain('underline')
  }
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
