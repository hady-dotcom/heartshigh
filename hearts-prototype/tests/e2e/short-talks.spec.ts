import { expect, test, type Page } from '@playwright/test'

const ANXIETY = 'A Cure for Anxiety'
const HIDDEN_NOTE = 'Hidden because every talk is under 5 minutes.'

async function signIn(page: Page, email: string, password: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('talks under five minutes stay hidden', () => {
  test.describe.configure({ mode: 'serial' })

  for (const width of [390, 1280]) {
    test(`library, review and the learner app at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
      await signIn(page, 'master@hearts.test', 'hearts-master', '/master/library')
      const filter = page.getByTestId('filter-too-short')
      await expect(filter).toBeVisible()
      const label = await filter.innerText()
      const count = Number(label.match(/Too short \((\d+)\)/)?.[1])
      expect(count).toBeGreaterThanOrEqual(9)

      await filter.click()
      await expect(page).toHaveURL(/show=too-short/)
      const anxiety = page.getByTestId('too-short-row').filter({ hasText: ANXIETY })
      await expect(anxiety).toContainText('1:04')
      await expect(anxiety).toContainText('Suleiman Hani')
      await expect(anxiety.getByTestId('course-hidden-note')).toContainText(HIDDEN_NOTE)

      await page.goto('/master/review')
      await expect(page.getByTestId('review-pool')).toHaveAttribute('data-show', 'all')
      await expect(page.getByTestId('review-card')).toHaveAttribute('data-short', 'no')
      await expect(page.getByTestId('review-card')).not.toContainText(ANXIETY)

      await page.getByTestId('filter-too-short').click()
      await expect(page.getByTestId('review-pool')).toHaveAttribute('data-show', 'too-short')
      await expect(page.getByTestId('review-card').first()).toHaveAttribute('data-short', 'yes')

      await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
      await expect(page.locator('body')).not.toContainText(ANXIETY)
      await expect(page.locator('body')).not.toContainText('How we sit')

      await page.goto('/p/east-london/feed')
      const feed = await page.content()
      expect(feed).not.toContain('FAxIZIqwfd8')
      expect(feed).not.toContain(ANXIETY)

      await page.goto('/p/east-london/lanes')
      await expect(page.locator('body')).not.toContainText('Patience And Complaining')

      await page.goto('/p/east-london/garden')
      await expect(page.locator('body')).not.toContainText(ANXIETY)
    })
  }
})
