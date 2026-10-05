import { mkdirSync } from 'node:fs'
import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from '@playwright/test'
import { E2E_BASE } from '../env'

const PROOF = 'artifacts/talk-extracts'

const PORTAL = '/p/east-london'
const PHONE = { width: 390, height: 844 }

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function json(api: APIRequestContext, path: string) {
  return (await (await api.get(path)).json().catch(() => ({}))) as { docs?: Record<string, unknown>[] }
}

test('admin timeline nests hors under their appetiser, and Learn more opens that parent first', async ({ page }) => {
  test.setTimeout(120_000)
  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()

  const lessons = ((await json(master, '/api/lessons?limit=80&depth=0&sort=id')).docs || []) as { id: number; course: number; durationSeconds?: number; title?: string }[]
  const extracts = ((await json(master, '/api/talk-extracts?limit=500&depth=0')).docs || []) as { id: number; lesson: number; kind: string; start: number; end: number }[]
  const withPair = lessons.find((lesson) => {
    const own = extracts.filter((row) => Number(row.lesson) === Number(lesson.id))
    const appetisers = own.filter((row) => row.kind === 'appetiser')
    const appetiser = appetisers[0]
    return Boolean(
      appetiser &&
      appetisers.length === 1 &&
      own.some((row) => row.kind === 'hors') &&
      Number(lesson.durationSeconds || 0) >= 180 &&
      appetiser.end + 90 < Number(lesson.durationSeconds),
    )
  })
  expect(withPair, 'a seeded talk with a copied hors and appetiser').toBeTruthy()
  const lesson = withPair!
  const courseId = lesson.course
  const existing = extracts.filter((row) => row.lesson === lesson.id)
  const appetiser = existing.find((row) => row.kind === 'appetiser')!
  const extra: number[] = []

  const make = async (data: Record<string, unknown>) => {
    const response = await master.post('/api/talk-extracts', { data: { lesson: lesson.id, status: 'approved', order: 2, ...data } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const doc = (await response.json()) as { id: number }
    extra.push(doc.id)
    return doc
  }

  try {
    await make({ kind: 'hors', start: Math.max(appetiser.start + 2, appetiser.end - 25), end: appetiser.end - 2, quote: '' })
    await make({ kind: 'hors', start: appetiser.start + 8, end: Math.min(appetiser.start + 22, appetiser.end - 1), quote: '', status: 'suggested' })
    await make({ kind: 'appetiser', start: Math.min(Number(lesson.durationSeconds) - 40, appetiser.end + 20), end: Math.min(Number(lesson.durationSeconds) - 5, appetiser.end + 50), quote: '' })
    const orphanStart = Math.min(Number(lesson.durationSeconds) - 20, appetiser.end + 80)
    await make({ kind: 'hors', start: orphanStart, end: orphanStart + 12, quote: '' })

    await page.setViewportSize({ width: 1440, height: 900 })
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/library/${courseId}?part=${lesson.id}`)
    await expect(page.getByTestId('extract-timeline')).toBeVisible()
    await expect(page.getByTestId('extract-density')).toBeVisible()
    await expect(page.getByTestId('extract-group').first()).toBeVisible()
    await expect(page.getByTestId('extract-group').first().getByTestId('extract-hors')).toHaveCount(3)
    const emptyRow = page.locator('[data-testid="extract-appetiser"][data-empty="yes"]').first()
    await expect(emptyRow).toBeVisible()
    await expect(emptyRow).not.toHaveClass(/flagged/)
    await expect(page.getByTestId('extract-empty').first()).toBeVisible()
    await expect(page.getByTestId('extract-empty').first()).toHaveClass(/extract-empty-note/)
    await expect(page.getByTestId('extract-orphan').first()).toBeVisible()
    await expect(page.getByTestId('extract-review')).toBeVisible()
    await expect(page.getByTestId('review-shortcuts')).toContainText('P play')
    await expect(page.getByTestId('extract-review-approve')).toBeVisible()
    await expect(page.getByTestId('extract-review-reject')).toBeVisible()
    await expect(page.getByTestId('review-play-p')).toBeVisible()
    await page.getByTestId('extract-help').locator('summary').click()
    await expect(page.getByTestId('extract-help')).toContainText('hook, a turn and a land')
    await expect(page.getByTestId('extract-help')).toContainText('none or one')
    await expect(page.getByTestId('extract-help')).toContainText('suggested')
    await expect(page.getByTestId('extract-help')).toContainText('6 minutes')
    mkdirSync(PROOF, { recursive: true })
    await page.screenshot({ path: `${PROOF}/admin-timeline.png`, fullPage: true })

    const cut = ((await json(master, `/api/cuts?where[lesson][equals]=${lesson.id}&limit=10&depth=0`)).docs || [])[0] as { id: number } | undefined
    await page.setViewportSize(PHONE)
    await page.route(/youtube|ytimg|googlevideo/, (route) => route.abort())
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', cut ? `${PORTAL}/feed?clip=${cut.id}` : `${PORTAL}/feed`)
    const feed = page.getByTestId('journey')
    await expect(feed).toHaveAttribute('data-phase', 'feed', { timeout: 20_000 })
    await expect(feed).toHaveAttribute('data-mode', 'hors')
    if (cut) await expect(feed).toHaveAttribute('data-cut', String(cut.id))
    const extractId = await feed.getAttribute('data-extract')
    expect(extractId).toBeTruthy()
    const learn = page.getByTestId('learn-more').first()
    await expect(learn).toHaveAttribute('data-parent-level', 'appetiser')
    await expect(learn).toHaveAttribute('data-parent', /appetiser:/)
    await learn.click()
    await expect(feed).toHaveAttribute('data-mode', 'appetiser')
    await expect(page.getByTestId('learn-more').first()).toHaveAttribute('data-parent-level', 'talk')
    await expect(page.getByTestId('learn-more').first()).toHaveAttribute('data-parent', /talk:/)
    mkdirSync(PROOF, { recursive: true })
    await page.screenshot({ path: `${PROOF}/learner-feed.png`, fullPage: true })
  } finally {
    for (const id of extra) await master.delete(`/api/talk-extracts/${id}`).catch(() => undefined)
    await master.dispose()
  }
})
