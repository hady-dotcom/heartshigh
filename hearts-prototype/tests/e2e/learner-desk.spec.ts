import { expect, request as playwrightRequest, test, type Page } from '@playwright/test'

const VIEWS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'phone', width: 390, height: 844 },
] as const

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

async function signOut(page: Page) {
  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/login' } })
  await page.goto('/login')
}

test.describe('learner, plan and diary desk actions', () => {
  test.describe.configure({ mode: 'serial' })

  for (const view of VIEWS) {
    test(`lists, search and open at ${view.width}x${view.height}`, async ({ page }) => {
      await page.setViewportSize({ width: view.width, height: view.height })
      await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
      await expect(page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' })).toBeVisible()
      await expect(page.getByTestId('learner-row').filter({ hasText: 'Yusuf Khan' })).toHaveCount(0)
      await expect(page.getByTestId('learner-portal').first()).toContainText('East London')
      await page.getByTestId('learner-search').fill('Maryam')
      await page.getByTestId('learner-filter-submit').click()
      await expect(page.getByTestId('learner-row')).toHaveCount(1)
      await expect(page.getByTestId('learner-bulk')).toBeVisible()
      await page.getByTestId('learner-row').getByTestId('learner-open').click()
      await expect(page.getByTestId('learner-detail')).toBeVisible()
      await expect(page.getByTestId('learner-facts').getByTestId('learner-portal')).toContainText('East London')
      await expect(page.getByTestId('learner-joined')).toBeVisible()
      await expect(page.getByTestId('learner-last-seen')).toBeVisible()
      await expect(page.getByTestId('learner-progress')).toBeVisible()
      await expect(page.getByTestId('learner-plans')).toBeVisible()
      await expect(page.getByTestId('learner-diaries')).toBeVisible()
      await expect(page.getByTestId('learner-facts')).toContainText('Journal entries')
      await expect(page.getByTestId('move-portal')).toHaveCount(0)
      await expect(page.getByTestId('reset-password')).toBeVisible()

      await page.goto('/p/east-london/admin/plans')
      await expect(page.getByTestId('plan-portal').or(page.getByTestId('plan-bulk'))).toBeVisible()
      await expect(page.getByTestId('plan-bulk')).toBeVisible()

      await page.goto('/p/east-london/admin/diaries')
      await expect(page.getByRole('heading', { level: 1, name: 'Journals' })).toBeVisible()
      await expect(page.getByTestId('side-nav').getByRole('link', { name: 'Journals', exact: true })).toBeVisible()
      await expect(page.getByTestId('journal-newest')).toHaveAttribute('aria-pressed', 'true')
      await expect(page.getByTestId('journal-oldest')).toBeVisible()
      await expect(page.getByTestId('journal-jump-top')).toBeVisible()
      await expect(page.getByTestId('journal-jump-bottom')).toBeVisible()
      await expect(page.getByTestId('journal-when').first()).toHaveText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), \d{1,2}:\d{2} (AM|PM)$/)
      await expect(page.getByTestId('journal-unanswered')).toBeVisible()
      const newest = await page.getByTestId('diary-open').allTextContents()
      expect(newest.length).toBeGreaterThan(1)
      await page.getByTestId('journal-oldest').click()
      await expect(page.getByTestId('journal-list')).toHaveAttribute('data-order', 'oldest')
      await expect(page.getByTestId('journal-oldest')).toHaveAttribute('aria-pressed', 'true')
      expect(await page.getByTestId('diary-open').allTextContents()).toEqual([...newest].reverse())
      await page.getByTestId('journal-jump-bottom').click()
      await page.getByTestId('journal-jump-top').click()
      await page.getByTestId('journal-newest').click()
      await expect(page.getByTestId('diary-open')).toHaveText(newest)
      await page.getByTestId('desk-help').getByRole('button', { name: 'What is this?' }).click()
      await expect(page.getByTestId('desk-help-pop')).toContainText('journal entry')
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('diary-row').filter({ hasText: 'Maryam' }).first()).toBeVisible()
      await expect(page.getByTestId('diary-portal').first()).toContainText('East London')
      await page.getByTestId('diary-row').filter({ hasText: 'Maryam' }).first().getByTestId('diary-open').click()
      await expect(page.getByTestId('diary-detail')).toBeVisible()
      await expect(page.getByTestId('diary-body')).toBeVisible()
      await expect(page.getByTestId('diary-delete')).toBeVisible()
    })
  }

  test('a portal admin cannot reset a learner in another portal', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/teach')
    const href = await page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' }).getByTestId('learner-open').getAttribute('href')
    const maryamId = Number(href?.split('/').pop())
    expect(maryamId).toBeGreaterThan(0)
    await page.goto(`/p/east-london/admin/teach?portal=99999`)
    await expect(page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' })).toBeVisible()
    await expect(page.getByTestId('learner-row').filter({ hasText: 'Yusuf Khan' })).toHaveCount(0)

    const leeds = await playwrightRequest.newContext()
    const signed = await leeds.post('/api/hearts', { form: { action: 'login', email: 'leeds-admin@hearts.test', password: 'portal-admin', next: '/p/leeds/admin/teach' } })
    expect(signed.ok()).toBeTruthy()
    const refused = await leeds.post('/api/hearts', {
      form: { action: 'learner-reset', learner: String(maryamId), next: '/p/leeds/admin/teach' },
      maxRedirects: 0,
    })
    expect(refused.status()).toBe(303)
    expect(decodeURIComponent(refused.headers().location || '').replace(/\+/g, ' ')).toMatch(/another portal/)
    await leeds.dispose()

    await signOut(page)
    await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
    await expect(page).not.toHaveURL(/login/)
  })

  test('pause, reset and a study plan can be undone', async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/learners?q=Aisha%20Patel')
    await page.getByTestId('learner-filter-submit').click()
    const aisha = page.getByTestId('learner-row').filter({ hasText: 'Aisha Patel' })
    await expect(aisha).toBeVisible()
    await aisha.getByTestId('learner-open').click()
    await page.getByTestId('pause-learner').click()
    await expect(page.getByTestId('notice')).toContainText('paused')
    await signOut(page)

    await page.goto('/login')
    await page.getByTestId('login-email').fill('activity-1@hearts.test')
    await page.getByTestId('login-password').fill('portal-learner')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('error')).toContainText('paused')

    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/learners?q=Aisha%20Patel')
    await page.getByTestId('learner-filter-submit').click()
    await page.getByTestId('learner-row').filter({ hasText: 'Aisha Patel' }).getByTestId('learner-open').click()
    await page.getByTestId('unpause-learner').click()
    await expect(page.getByTestId('notice')).toContainText('sign in')
    await page.getByTestId('reset-password').getByRole('button', { name: 'Make a new password' }).click()
    const notice = await page.getByTestId('notice').innerText()
    const password = notice.match(/New password for Aisha Patel: ([^.]+)/)?.[1]
    expect(password, notice).toBeTruthy()
    await signOut(page)

    await page.goto('/login')
    await page.getByTestId('login-email').fill('activity-1@hearts.test')
    await page.getByTestId('login-password').fill(password!)
    await page.getByTestId('login-submit').click()
    await page.waitForURL((url) => url.pathname.startsWith('/change-password'))
    await page.getByTestId('new-password').fill('portal-learner')
    await page.getByTestId('new-password-again').fill('portal-learner')
    await page.getByTestId('change-password-submit').click()
    await page.waitForURL((url) => !url.pathname.startsWith('/change-password') && !url.pathname.startsWith('/login'))

    await signOut(page).catch(() => undefined)
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', '/p/east-london/admin/plans')
    const course = page.getByTestId('schedule-course')
    const value = await course.locator('option', { hasNotText: 'East London circle notes' }).first().getAttribute('value')
    if (value) await course.selectOption(value)
    await page.locator('#new-plan input[name=name]').fill('Desk proof plan')
    await page.getByTestId('schedule-start').fill('2026-10-14')
    await page.getByTestId('schedule-end').fill('2026-10-21')
    await page.locator('label:has([data-testid=weekday-1])').click()
    await page.locator('label:has([data-testid=weekday-3])').click()
    await page.locator('#new-plan label', { hasText: 'Maryam Begum' }).locator('input').check()
    await page.getByTestId('schedule-submit').click()
    await expect(page.getByTestId('notice')).toBeVisible()
    await expect(page.getByTestId('error')).toHaveCount(0)
    const plan = page.getByTestId('schedule-plan').filter({ hasText: 'Desk proof plan' })
    await expect(plan.getByTestId('plan-portal')).toContainText('East London')
    await expect(plan.getByTestId('plan-for')).toContainText('Maryam')
    await plan.getByTestId('plan-open').click()
    await expect(page.getByTestId('plan-detail')).toBeVisible()
    await page.getByTestId('plan-name').fill('Desk proof plan edited')
    await page.getByTestId('plan-save').click()
    await expect(page.getByTestId('notice')).toBeVisible()
    await page.getByTestId('plan-delete-sure').check()
    await page.getByTestId('plan-delete').click()
    await expect(page.getByTestId('notice')).toContainText('deleted')
    await expect(page.getByTestId('schedule-plan').filter({ hasText: 'Desk proof plan' })).toHaveCount(0)
  })

  test('master and teacher desks say Journals', async ({ page }) => {
    await signIn(page, 'master@hearts.test', 'hearts-master', '/master/diaries')
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height })
      await page.goto('/master/diaries')
      await expect(page.getByRole('heading', { level: 1, name: 'Journals' })).toBeVisible()
      await expect(page.getByTestId('side-nav').getByRole('link', { name: 'Journals', exact: true })).toBeVisible()
      await expect(page.getByTestId('journal-when').first()).toBeVisible()
    }
    await signOut(page)
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/diaries')
    for (const view of VIEWS) {
      await page.setViewportSize({ width: view.width, height: view.height })
      await page.goto('/p/east-london/admin/diaries')
      await expect(page.getByRole('heading', { level: 1, name: 'Journals' })).toBeVisible()
      await expect(page.getByTestId('side-nav').getByRole('link', { name: 'Journals', exact: true })).toBeVisible()
      await expect(page.getByTestId('journal-unanswered')).toBeVisible()
    }
  })

  test('a teacher can look and can change a plan, and cannot reset an account', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'elm-teacher@hearts.test', 'portal-teacher', '/p/east-london/admin/teach')
    await expect(page.getByTestId('learner-bulk')).toHaveCount(0)
    await page.getByTestId('learner-row').filter({ hasText: 'Maryam Begum' }).getByTestId('learner-open').click()
    await expect(page.getByTestId('learner-detail')).toBeVisible()
    await expect(page.getByTestId('reset-password')).toHaveCount(0)
    await page.goto('/p/east-london/admin/plans')
    await expect(page.getByTestId('plan-bulk')).toBeVisible()
    await expect(page.getByTestId('learner-bulk')).toHaveCount(0)
  })
})
