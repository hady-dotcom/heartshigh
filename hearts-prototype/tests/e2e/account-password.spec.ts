import { expect, test } from '@playwright/test'
import { SETTINGS, confirmFromInbox, joinLearner, signIn, uniqueEmail, waitForMail } from './account-helpers'

test('A05: Settings change password refuses a wrong current password, then emails the change', async ({ page }) => {
  const email = uniqueEmail('a05-password')
  const first = 'change-first-1'
  const next = 'change-next-99'
  await joinLearner(page, 'Password Learner', email, first)
  await confirmFromInbox(page, email)
  await page.goto(SETTINGS)

  await page.getByTestId('current-password').fill('wrong-password')
  await page.getByTestId('new-password').fill(next)
  await page.getByTestId('new-password-again').fill(next)
  await page.getByTestId('change-password-submit').click()
  await expect(page.getByTestId('error')).toContainText('current password did not match')

  await page.getByTestId('current-password').fill(first)
  await page.getByTestId('new-password').fill(next)
  await page.getByTestId('new-password-again').fill(next)
  await page.getByTestId('change-password-submit').click()
  await expect(page.getByTestId('notice')).toContainText('password is updated')
  await waitForMail(email, 'password was changed')

  await page.getByTestId('logout').click()
  await signIn(page, email, first, SETTINGS)
  await expect(page.getByTestId('error')).toContainText('did not match')
  await signIn(page, email, next, SETTINGS)
  await page.waitForURL((url) => url.pathname.includes('/me/settings'))
  await expect(page.getByTestId('change-password')).toBeVisible()
})
