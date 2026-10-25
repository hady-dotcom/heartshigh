import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { E2E_BASE } from '../env'

const PHONE = { width: 390, height: 844 }
const STAGE = { width: 1920, height: 1080 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

async function hideDevBadge(page: Page) {
  await page.addStyleTag({ content: 'nextjs-portal, [data-nextjs-toast], [data-next-badge-root] { display: none !important; }' }).catch(() => undefined)
}

async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await hideDevBadge(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${SHOTS}/${name}.png`, caret: 'initial' })
}

async function signIn(page: Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill('master@hearts.test')
  await page.getByTestId('login-password').fill('hearts-master')
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe.configure({ mode: 'serial' })

test('cast, four live screens, and a change that moves between them', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize(PHONE)
  await signIn(page, '/demo')
  await expect(page.getByTestId('parenting-demo-cast')).toBeVisible()
  await expect(page.getByTestId('demo-join-code')).toContainText('PARENT-DEMO')
  await expect(page.getByTestId('demo-cast-master')).toHaveValue('Leon')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(overflow).toBe(true)
  await shot(page, 'parenting-demo-cast-phone')

  await page.getByTestId('role-switch-learner').click()
  await page.waitForURL(/\/p\/parenting/)
  const learnerPage = page
  await expect(learnerPage.getByTestId('demo-hello')).toContainText('Abdallah')
  await expect(learnerPage.getByTestId('demo-note')).toBeVisible()
  await expect(learnerPage.locator('body')).not.toContainText(/payload|sandbox|iframe|endpoint|token/i)
  const phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  expect(phoneOverflow).toBe(true)
  await shot(page, 'parenting-demo-learner-phone')

  await page.getByTestId('role-switch-back').click()
  await page.waitForURL(/\/demo\?room=/)
  await page.setViewportSize(STAGE)
  await expect(page.getByTestId('parenting-demo')).toBeVisible()
  const learner = page.frameLocator('[data-testid="demo-learner-frame"]')
  const teacher = page.frameLocator('[data-testid="demo-teacher-frame"]')
  const portal = page.frameLocator('[data-testid="demo-portal-frame"]')
  const master = page.frameLocator('[data-testid="demo-master-frame"]')
  await expect(learner.getByTestId('demo-hello')).toContainText('Abdallah', { timeout: 60_000 })
  await expect(teacher.getByTestId('sequence-learners')).toBeVisible({ timeout: 60_000 })
  await expect(portal.getByTestId('sequence-overview')).toBeVisible({ timeout: 60_000 })
  await expect(master.getByTestId('demo-join-code').first()).toContainText('PARENT-DEMO', { timeout: 60_000 })
  await expect(portal.getByTestId('sequence-film-count')).not.toHaveText('0')
  await shot(page, 'parenting-demo-stage')

  const answer = `I will keep one quiet hour after school ${Date.now()}`
  await learner.getByTestId('sequence-continue').click()
  await expect(learner.getByTestId('sequence-course')).toBeVisible()
  await learner.getByTestId('demo-answer-text').fill(answer)
  await learner.getByTestId('demo-answer-send').click()
  await expect(learner.getByTestId('demo-saved-answer').filter({ hasText: answer })).toBeVisible()
  await expect(teacher.getByTestId('demo-answer').filter({ hasText: answer })).toBeVisible({ timeout: 20_000 })
  await expect(portal.getByTestId('demo-answer').filter({ hasText: answer })).toBeVisible({ timeout: 20_000 })

  const note = `Please watch the next film tonight ${Date.now()}`
  await teacher.getByTestId('demo-note-body').fill(note)
  await teacher.getByTestId('demo-note-send').click()
  await expect(learner.getByTestId('demo-note').filter({ hasText: note })).toBeVisible({ timeout: 20_000 })

  await portal.locator('a[href*="/admin/features"]').first().click()
  await expect(portal.getByTestId('sequence-features')).toBeVisible()
  await portal.getByTestId('feature-announcements').uncheck()
  await portal.getByTestId('feature-planner').check()
  await portal.getByTestId('sequence-save-features').click()
  await expect(portal.getByTestId('notice')).toContainText('Saved')
  await expect(learner.getByTestId('demo-plan')).toBeVisible({ timeout: 20_000 })
  await expect(learner.getByTestId('demo-note')).toHaveCount(0)

  await page.getByTestId('role-switch-learner').click()
  await expect(page.getByTestId('demo-panel-learner')).toBeVisible()
  await expect(page.getByTestId('demo-panel-master')).toBeHidden()
  await page.getByTestId('role-switch-all').click()
  await expect(page.getByTestId('demo-panel-teacher')).toBeVisible()

  await page.getByTestId('demo-reset').click()
  await expect(learner.getByTestId('demo-note')).toContainText('Start with the first film', { timeout: 20_000 })
  await expect(learner.getByTestId('demo-plan')).toHaveCount(0)
  await expect(teacher.getByText(answer)).toHaveCount(0)
  await shot(page, 'parenting-demo-stage-reset')
})

test('PARENT-DEMO joins through Hady Home into the first film', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const email = `abdallah.parent.${Date.now()}@example.com`
  await page.goto(`${E2E_BASE}/join?code=PARENT-DEMO`)
  await expect(page.getByTestId('join-code')).toHaveValue('PARENT-DEMO')
  await page.getByTestId('join-name').fill('Abdallah')
  await page.getByTestId('join-email').fill(email)
  await page.getByTestId('join-password').fill('demo-pass-1')
  await page.getByTestId('join-submit').click()
  await page.waitForURL(/\/p\/parenting\/welcome/)
  await expect(page.getByTestId('portal-brand')).toHaveText('Hady Home')
  await expect(page.locator('body')).not.toContainText(/\bHEARTS\b/)
  await shot(page, 'hady-welcome-phone')
  await page.getByTestId('welcome-begin').click()
  await expect(page.getByTestId('placing-question')).toHaveCount(4)
  const questions = page.getByTestId('placing-question')
  for (let index = 0; index < 4; index++) await questions.nth(index).locator('input').first().check()
  await page.getByTestId('placing-submit').click()
  await expect(page.getByTestId('start-first')).toBeVisible()
  await shot(page, 'hady-after-questions-phone')
  await page.getByTestId('start-first').click()
  await expect(page.getByTestId('sequence-course')).toBeVisible()
  await expect(page.getByTestId('sequence-question')).toBeVisible()
  await expect(page.getByTestId('parent-said').first()).toBeVisible()
  await shot(page, 'hady-film-phone')
})
