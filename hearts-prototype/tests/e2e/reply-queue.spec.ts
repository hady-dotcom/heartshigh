import { expect, test, type Page } from '@playwright/test'

const LAPTOP = { width: 1280, height: 800 }
const PHONE = { width: 390, height: 844 }
const REPLY = 'Keep that quiet minute. It counts.'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function filtersReady(page: Page) {
  await expect(page.getByTestId('reply-filters')).toHaveAttribute('data-ready', 'yes')
}

async function fits(page: Page, testId: string, width: number) {
  const box = await page.getByTestId(testId).boundingBox()
  expect(box, testId).toBeTruthy()
  expect(box!.x).toBeGreaterThanOrEqual(-1)
  expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
}

test.describe.configure({ mode: 'serial' })

test('a master can filter the reply queue by portal and by learner', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await signIn(page, 'master@hearts.test', 'hearts-master', '/p/east-london/admin/teach')
  await expect(page.getByTestId('reply-queue')).toBeVisible()
  await expect(page.getByTestId('queue-left')).toContainText('left')
  await expect(page.getByTestId('queue-portal')).toBeVisible()
  await expect(page.getByTestId('queue-learner')).toBeVisible()
  await filtersReady(page)
  await page.getByTestId('queue-portal').selectOption({ label: 'Leeds Chapter' })
  await expect(page.getByTestId('shared-answers')).toContainText('Walked to fajr')
  await expect(page.getByTestId('shared-answers')).not.toContainText('On the bus home')
  await page.getByTestId('queue-filter-all').click()
  await expect(page.getByTestId('queue-filter-all')).toHaveAttribute('aria-pressed', 'true')
  await filtersReady(page)
  await page.getByTestId('queue-portal').selectOption({ label: 'East London Mosque' })
  await expect(page.getByTestId('shared-answers')).toContainText('On the bus home')
  const learner = page.getByTestId('queue-learner')
  await filtersReady(page)
  await learner.selectOption({ label: 'Hamza Ali' })
  await expect(page.getByTestId('shared-answer').first()).toContainText('Hamza Ali')
  await expect(page.getByTestId('shared-answer').filter({ hasText: 'Maryam Begum' })).toHaveCount(0)
})

test('the teacher reply queue works on a laptop', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  const queue = page.getByTestId('reply-queue')
  await expect(queue).toBeVisible()
  await expect(page.getByTestId('queue-filter-unanswered')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('queue-portal')).toContainText('East London')
  await expect(page.getByTestId('shared-answer').first()).toBeVisible()
  const card = page.getByTestId('shared-answer').filter({ hasText: /suhoor|Akhira/ }).first()
  await expect(card).toBeVisible()
  await expect(card.getByTestId('shared-answer-place')).toContainText('at ')
  await expect(card.getByTestId('shared-answer-question')).toBeVisible()
  await expect(card.getByTestId('shared-answer-text')).not.toHaveText('')
  await card.click()
  const focus = page.getByTestId('reply-focus')
  await expect(focus).toBeVisible()
  await expect(focus.getByTestId('reply-learner')).toContainText('Maryam')
  const mine = (await focus.getByTestId('reply-full-answer').innerText()).slice(0, 24)
  await expect(focus.getByTestId('play-from-minute')).toHaveAttribute('href', /course\/\d+\?part=\d+&t=\d+/)
  await expect(focus.getByTestId('play-from-minute')).toHaveText('Play from this minute')
  await expect(focus.getByTestId('reply-question')).toBeVisible()
  await expect(focus.getByTestId('reply-full-answer')).toBeVisible()
  const earlier = focus.getByTestId('earlier-answers')
  if (await earlier.count()) {
    await expect(earlier.locator('[data-testid="earlier-answer"]').first()).toBeHidden()
    await earlier.locator('summary').click()
    await expect(earlier.locator('[data-testid="earlier-answer"]').first()).toBeVisible()
  }
  const before = page.url()
  await page.getByTestId('queue-skip').click()
  await expect(page).not.toHaveURL(before)
  await page.getByTestId('queue-previous').click()
  await expect(focus).toBeVisible()
  await filtersReady(page)
  await focus.getByTestId('reply-learner').click()
  await page.keyboard.press('j')
  await expect(page).not.toHaveURL(before)
  await filtersReady(page)
  await page.keyboard.press('k')
  await expect(page.getByTestId('reply-focus')).toBeVisible()
  await page.getByTestId('shared-answer').filter({ hasText: mine }).first().click()
  await filtersReady(page)
  await page.getByTestId('queue-reply').fill(REPLY)
  await page.keyboard.press('Control+Enter')
  await expect(page.getByTestId('notice')).toContainText('Reply saved')
  await page.getByTestId('queue-filter-answered').click()
  await page.getByTestId('shared-answer').filter({ hasText: mine }).first().click()
  await expect(page.getByTestId('queue-saved-reply')).toContainText(REPLY)
})

test('mark done leaves the card out of the unanswered queue', async ({ page }) => {
  await page.setViewportSize(LAPTOP)
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  const card = page.getByTestId('shared-answer').filter({ hasText: 'On the bus home' })
  await expect(card).toBeVisible()
  await card.click()
  await page.getByTestId('queue-done').click()
  await expect(page.getByTestId('notice')).toContainText('Marked done')
  await page.goto('/p/east-london/admin/teach')
  await expect(page.getByTestId('shared-answers')).not.toContainText('On the bus home')
  await page.getByTestId('queue-filter-answered').click()
  await expect(page.getByTestId('shared-answers')).toContainText('On the bus home')
})

test('the reply queue fits a phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
  await expect(page.getByTestId('desk-narrow')).toBeHidden()
  await expect(page.getByTestId('reply-queue')).toBeVisible()
  await fits(page, 'reply-queue', PHONE.width)
  await page.getByTestId('shared-answer').first().click()
  await expect(page.getByTestId('reply-focus')).toBeVisible()
  await fits(page, 'reply-focus', PHONE.width)
  for (const id of ['queue-send', 'queue-skip', 'queue-done', 'queue-filter-all']) {
    const box = await page.getByTestId(id).boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }
})

test('a workbook entry opens, and a new reply reads as now', async ({ page }) => {
  for (const viewport of [LAPTOP, PHONE]) {
    await page.setViewportSize(viewport)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london/garden/workbook')
    const entry = page.getByTestId('workbook-entry').filter({ hasText: REPLY }).first()
    await expect(entry).toBeVisible()
    await expect(entry.getByTestId('teacher-reply')).toContainText('now')
    await entry.getByTestId('workbook-open').click()
    await expect(page.getByTestId('workbook-detail')).toBeVisible()
    await expect(page.getByTestId('detail-question')).not.toHaveText('')
    await expect(page.getByTestId('teacher-reply')).toContainText(REPLY)
    await expect(page.getByTestId('reply-when')).toHaveText('now')
    const edited = 'I stayed with that quiet minute a little longer.'
    await page.getByTestId('my-answer').fill(edited)
    await page.getByTestId('save-answer').click()
    await expect(page.getByTestId('my-answer')).toHaveValue(edited)
    const watch = page.getByTestId('watch-moment')
    await expect(watch).toHaveText('Watch this moment')
    await expect(watch).toHaveAttribute('href', /\/course\/\d+\?part=\d+&t=\d+/)
    await fits(page, 'workbook-detail', viewport.width)
    await watch.click()
    await expect(page).toHaveURL(/\/course\/\d+\?.*part=\d+/)
    await expect(page).toHaveURL(/[?&]t=\d+/)
  }
})
