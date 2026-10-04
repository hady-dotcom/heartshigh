import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { assignByHash, subjectKey } from '../../src/lib/experiment-assign'
import { E2E_BASE } from '../env'

const DESK = { width: 1440, height: 900 }
const PHONE = { width: 390, height: 844 }
const SHOTS = '/opt/cursor/artifacts/screenshots'

let master: APIRequestContext

async function as(email?: string, password?: string) {
  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  if (email) expect((await ctx.post('/api/users/login', { data: { email, password } })).ok(), `login ${email}`).toBeTruthy()
  return ctx
}

const json = async (response: { json: () => Promise<unknown> }) => (await response.json().catch(() => ({}))) as Record<string, any>

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

function keyThatSplits(idA: number, idB: number) {
  const rows = [{ key: 'alpha', weight: 1 }, { key: 'beta', weight: 1 }]
  for (let index = 0; index < 8000; index++) {
    const key = `cta-split-${index}`
    const a = assignByHash(key, subjectKey('learner', idA), rows)
    const b = assignByHash(key, subjectKey('learner', idB), rows)
    if (a && b && a !== b) return { key, a, b }
  }
  throw new Error('Could not find a key that splits the two learners.')
}

test.beforeAll(async () => {
  master = await as('master@hearts.test', 'hearts-master')
})

test.afterAll(async () => {
  await master?.dispose()
})

test.describe('Experiments', () => {
  test('desk, two learners see different versions, conversions reach the results page', async ({ browser }) => {
    const desk = await browser.newPage()
    await desk.setViewportSize(DESK)
    await signIn(desk, 'master@hearts.test', 'hearts-master', '/master/experiments')
    await expect(desk.getByTestId('experiments-desk')).toBeVisible()
    await expect(desk.getByTestId('experiment-rule')).toContainText('never change a sheikh')
    await desk.getByTestId('desk-help').click()
    await expect(desk.getByTestId('desk-help-dialog')).toBeVisible()
    await expect(desk.getByTestId('desk-help-dialog')).toContainText('A sheikh')
    await expect(desk.getByTestId('desk-help-dialog')).toContainText('Kill switch')
    await desk.getByTestId('desk-help-close').click()
    await expect(desk.getByTestId('count-draft')).toHaveText(/[1-9]/)
    await expect(desk.getByTestId('slot-registry')).toContainText('feed-cta-label')
    await expect(desk.getByTestId('slot-registry')).toContainText('wide-video-framing')
    await expect(desk.getByTestId('slot-registry')).toContainText('lanes-tab-label')
    await expect(desk.locator('[data-testid=experiment-card][data-key=lanes-tab-label]')).toBeVisible()
    await expect(desk.locator('[data-testid=experiment-card][data-key=lanes-tab-label]')).toHaveAttribute('data-status', 'draft')
    await desk.screenshot({ path: `${SHOTS}/experiments-list.png`, fullPage: true })

    const people = await json(await master.get('/api/users?limit=20&depth=0'))
    const maryam = (people.docs as { id: number; email: string }[]).find((row) => row.email === 'elm-learner@hearts.test')
    const hamza = (people.docs as { id: number; email: string }[]).find((row) => row.email === 'elm-learner2@hearts.test')
    expect(maryam && hamza, 'seeded learners').toBeTruthy()
    const split = keyThatSplits(maryam!.id, hamza!.id)

    await desk.getByTestId('experiment-new').click()
    await expect(desk.getByTestId('experiment-form')).toBeVisible()
    await desk.getByTestId('experiment-key').fill(split.key)
    await desk.getByTestId('experiment-name').fill('Feed CTA split for two learners')
    await desk.getByTestId('experiment-slot-field').selectOption('feed-cta-label')
    await desk.getByTestId('experiment-variants').fill('alpha | Alpha line\nbeta | Beta line')
    await desk.getByTestId('experiment-save').click()
    await expect(desk.getByTestId('experiment-detail')).toBeVisible()
    await desk.getByTestId('experiment-start').click()
    await expect(desk.getByTestId('experiment-status')).toHaveText('Running')

    const labels: Record<string, string> = { alpha: 'Alpha line', beta: 'Beta line' }
    const seen: string[] = []
    for (const person of [
      { email: 'elm-learner@hearts.test', password: 'portal-learner', variant: split.a! },
      { email: 'elm-learner2@hearts.test', password: 'portal-learner', variant: split.b! },
    ]) {
      const page = await browser.newPage()
      await page.setViewportSize(PHONE)
      await signIn(page, person.email, person.password, '/p/east-london/feed')
      const feed = page.getByTestId('feed-screen')
      await expect(feed).toBeVisible({ timeout: 20_000 })
      for (let tries = 0; tries < 12 && !(await page.getByTestId('learn-more').first().isVisible().catch(() => false)); tries++) {
        await page.keyboard.press('ArrowDown')
        await page.waitForTimeout(200)
      }
      const button = page.getByTestId('learn-more').first()
      await expect(button).toBeVisible({ timeout: 20_000 })
      await expect(button).toHaveText(labels[person.variant])
      seen.push(await button.innerText())
      const tracked = page.waitForResponse((response) => {
        const url = response.url()
        return response.request().method() === 'POST' && (url.includes('/api/experiments') || url.includes('/api/hearts'))
      }, { timeout: 15_000 })
      await button.click()
      await tracked
      await page.close()
    }
    expect(new Set(seen).size).toBe(2)

    await desk.goto(`/master/experiments`)
    await desk.getByTestId('experiment-card').filter({ hasText: 'Feed CTA split for two learners' }).click()
    await expect(desk.getByTestId('experiment-detail')).toBeVisible()
    await expect(desk.getByTestId('stat-exposures')).not.toHaveText('0')
    await expect(desk.getByTestId('variant-table')).toBeVisible()
    await expect(desk.getByTestId('variant-copy').first()).toHaveText(/Alpha line|Beta line/)
    await expect(desk.getByTestId('variant-table')).not.toContainText('"label"')
    await expect(desk.getByTestId('variant-table')).not.toContainText('{')
    const conversions = desk.getByTestId('variant-conversions')
    await expect(conversions.first()).toBeVisible()
    const total = (await conversions.allTextContents()).map((value) => Number(value)).reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThan(0)
    await expect(desk.getByTestId('experiment-verdict')).toContainText(/Too soon|ahead|learners/)
    await desk.screenshot({ path: `${SHOTS}/experiments-results.png`, fullPage: true })

    await desk.getByTestId('experiment-suggest').click()
    await expect(desk.getByTestId('ai-suggest-done')).toBeVisible()
    await expect(desk.getByTestId('ai-suggest-panel')).toContainText('Approve')
    await desk.screenshot({ path: `${SHOTS}/experiments-ai-suggest.png`, fullPage: true })
    await desk.getByTestId('experiment-pause').click()
    await expect(desk.getByTestId('experiment-status')).toHaveText('Paused')
    await desk.close()
  })

  test('a slot that targets talk content is refused', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/experiments/new')
    await expect(page.getByTestId('experiment-form')).toBeVisible()
    await page.getByTestId('experiment-key').fill('talk-words-blocked')
    await page.getByTestId('experiment-name').fill('Rewrite the talk')
    await page.getByTestId('experiment-slot-key').fill('talk-transcript')
    await page.getByTestId('experiment-variants').fill('a | Changed talk\nb | Other talk')
    await page.getByTestId('experiment-save').click()
    await expect(page.getByTestId('error')).toBeVisible()
    await expect(page.getByTestId('error')).toContainText(/testable list|never change|sheikh/i)
  })

  test('a portal admin can read results and cannot create', async ({ page }) => {
    await page.setViewportSize(DESK)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/experiments')
    await expect(page.getByTestId('experiments-desk')).toBeVisible()
    await expect(page.getByTestId('experiment-new')).toHaveCount(0)
    await page.goto('/p/east-london/admin/experiments/new')
    await expect(page.getByTestId('experiment-edit-denied')).toBeVisible()
  })
})
