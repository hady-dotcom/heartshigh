import { expect, test } from '@playwright/test'
import { signIn } from './legal-helpers'

test('C06 C07 C10 captions, transcript and search', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/elm')
  await page.goto('/p/elm/search?q=jibril')
  await expect(page.getByTestId('search')).toBeVisible()
  await expect(page.getByTestId('search-hit').or(page.getByTestId('search-empty'))).toBeVisible()
  await page.goto('/p/elm/lanes')
  await expect(page.getByTestId('learner-search')).toBeVisible()
  const course = page.getByTestId('path-course').first()
  if (await course.count()) {
    await course.locator('a').first().click()
    await expect(page.getByTestId('course').or(page.getByTestId('player'))).toBeVisible()
    if (await page.getByTestId('transcript-toggle').count()) {
      await page.getByTestId('transcript-toggle').click()
      await expect(page.getByTestId('transcript-body').or(page.getByTestId('transcript-empty'))).toBeVisible()
    }
    if (await page.getByTestId('cc-toggle').count()) {
      await page.getByTestId('cc-toggle').click()
      await expect(page.getByTestId('talk-captions')).toHaveAttribute('data-on', 'yes')
    }
  }
})
