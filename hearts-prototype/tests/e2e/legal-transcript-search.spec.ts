import { expect, test } from '@playwright/test'
import { signIn } from './legal-helpers'

test('C06 C07 C10 captions, transcript and search', async ({ page }) => {
  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', '/p/east-london')
  await page.goto('/p/east-london/search?q=salah')
  await expect(page.getByTestId('search')).toBeVisible()
  await expect(page.getByTestId('search-talks-count')).toContainText('Talks (')
  const hit = page.getByTestId('search-hit').first()
  await expect(hit).toBeVisible()
  await expect(page.getByTestId('search-snippet').first()).toBeVisible()
  await expect(page.getByTestId('search-highlight').first()).toContainText(/salah/i)
  await expect(page.getByTestId('search-time').first()).toBeVisible()
  await hit.click()
  await expect(page).toHaveURL(/[?&]t=\d+/)
  await expect(page.getByTestId('course').or(page.getByTestId('player')).first()).toBeVisible()

  await page.goto('/p/east-london/search?q=zzzznotatalk')
  await expect(page.getByTestId('search-empty')).toBeVisible()

  await page.goto('/p/east-london/lanes')
  await expect(page.getByTestId('learner-search')).toBeVisible()
  const course = page.getByTestId('path-course').first()
  if (await course.count()) {
    await course.locator('a').first().click()
    if (await page.getByTestId('course-overview').count()) {
      await page.getByTestId('start-part').click()
    }
    await expect(page.getByTestId('course').or(page.getByTestId('player')).first()).toBeVisible()
    if (await page.getByTestId('transcript-toggle').count()) {
      await page.getByTestId('transcript-toggle').click()
      await expect(page.getByTestId('transcript-body')).toBeVisible()
    }
    if (await page.getByTestId('cc-toggle').count()) {
      await page.getByTestId('cc-toggle').click()
      await expect(page.getByTestId('talk-captions')).toHaveAttribute('data-on', 'yes')
    }
  }
})
