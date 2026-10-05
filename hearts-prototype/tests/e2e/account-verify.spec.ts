import { expect, test } from '@playwright/test'
import { SETTINGS, confirmFromInbox, joinLearner, uniqueEmail } from './account-helpers'

test('A04: join sends a confirm email, the strip shows, then it goes after the link', async ({ page }) => {
  const email = uniqueEmail('a04-confirm')
  await joinLearner(page, 'Confirm Learner', email, 'confirm-me-1')
  await page.goto(SETTINGS)
  await expect(page.getByTestId('confirm-strip')).toBeVisible()
  await expect(page.getByTestId('confirm-strip')).toContainText('Check your inbox')

  await confirmFromInbox(page, email)
  await page.goto(SETTINGS)
  await expect(page.getByTestId('confirm-strip')).toHaveCount(0)

  await page.goto('/confirm?token=not-a-real-token')
  await expect(page.getByTestId('error')).toContainText('not valid any more')
})
