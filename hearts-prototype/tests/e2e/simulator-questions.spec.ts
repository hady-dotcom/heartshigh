import { expect, test, type Page } from '@playwright/test'

const PORTAL = 'east-london'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

async function assertQuestions(page: Page) {
  await expect(page.getByTestId('simulator')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Questions', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Feelings after these answers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Make your questions better' })).toBeVisible()
  await expect(page.getByTestId('sim-newcomer')).toHaveText('Try it as a newcomer')
  await expect(page.getByTestId('lane-key')).toContainText('comes first')
  await expect(page.getByTestId('lane-key')).not.toContainText('0.25')
  await expect(page.getByTestId('lane-techies')).not.toHaveAttribute('open')
  await page.getByTestId('lane-techies').locator('summary').click()
  await expect(page.getByTestId('lane-techies')).toContainText('score of at least 0.25')
  await expect(page.getByTestId('lane-techies').locator('th', { hasText: 'Score' })).toBeVisible()
  const text = await page.getByTestId('master-simulator').innerText()
  expect(text).not.toMatch(/\b[Tt]aps\b/)
  expect(text).not.toMatch(/Pick the taps/i)
  expect(text).not.toMatch(/Scales after/i)

  const numbers = await page.getByTestId('sim-question').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-number')))
  expect(numbers.length).toBeGreaterThan(5)
  expect(new Set(numbers).size).toBe(numbers.length)
  expect(numbers).toEqual(numbers.map((_, index) => String(index + 1)))

  await expect(page.getByTestId('question-heat').first()).toBeVisible()
  await expect(page.getByTestId('edit-question').first()).toHaveAttribute('href', /\/master\/opening#scene-/)
  await expect(page.getByTestId('review-flag').first()).toBeVisible()

  const right = await page.getByTestId('simulator').evaluate((node) => node.getBoundingClientRect().right)
  const width = page.viewportSize()!.width
  expect(right).toBeLessThanOrEqual(width + 1)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('opening questions simulator', () => {
  test('desk width explains lanes, numbers questions once, and counts every path', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
    await page.getByTestId('portal-own-caption').fill('A quiet afternoon turns up.')
    await page.getByTestId('portal-own-opt1').fill('Sit with it')
    await page.getByTestId('portal-own-opt2').fill('Tell a friend')
    await page.getByTestId('portal-own-save').click()
    await expect(page.getByTestId('notice')).toContainText('Question added for this portal.')
    try {
      await signIn(page, 'master@hearts.test', 'hearts-master', `/master/simulator?portal=${PORTAL}`)
      await assertQuestions(page)
      const own = page.getByTestId('question-heat').filter({ hasText: 'A quiet afternoon turns up.' })
      await expect(own.getByTestId('edit-question')).toHaveAttribute('href', new RegExp(`/p/${PORTAL}/admin/opening#own-`))
      await expect(page.getByTestId('review-flag').filter({ hasText: 'barely moves any feeling' })).toContainText('A quiet afternoon turns up.')
      await page.locator('[data-testid="desk-help"][data-help="master-simulator"] button').click()
      const help = page.locator('[data-testid="desk-help-pop"][data-help="master-simulator"]')
      await expect(help).toBeVisible()
      const helpText = await help.innerText()
      expect(helpText).not.toMatch(/\btaps?\b/i)
      expect(helpText).toContain('new person')
      await page.keyboard.press('Escape')
      await expect(help).toBeHidden()

      await page.getByTestId('sim-newcomer').click()
      await expect(page.getByTestId('sim-extra')).not.toHaveValue('')
      await expect(page.locator('[data-testid="sim-scale"][data-scale="greed"]')).not.toHaveAttribute('data-value', '0.00')

      await page.getByTestId('try-every-path').click()
      await expect(page.getByTestId('path-win').first()).toBeVisible({ timeout: 20_000 })
      const report = await page.getByTestId('path-report').innerText()
      expect(report).toMatch(/\d/)
      expect(report).toContain('%')
    } finally {
      await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `/p/${PORTAL}/admin/opening`)
      const row = page.getByTestId('portal-own-scene').filter({ hasText: 'A quiet afternoon turns up.' })
      if (await row.count()) await row.getByTestId('portal-own-remove').click()
    }
  })

  test('phone width keeps the question check on the screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, 'master@hearts.test', 'hearts-master', `/master/simulator?portal=${PORTAL}`)
    await assertQuestions(page)
    await page.getByTestId('sim-newcomer').click()
    await expect(page.getByTestId('sim-feed-item').first()).toBeVisible()
    await page.getByTestId('try-every-path').click()
    await expect(page.getByTestId('path-win').first()).toBeVisible({ timeout: 20_000 })
    const heat = page.getByTestId('question-heat').first()
    await heat.scrollIntoViewIfNeeded()
    await expect(heat.getByTestId('heat-row').first()).toBeVisible()
  })
})
