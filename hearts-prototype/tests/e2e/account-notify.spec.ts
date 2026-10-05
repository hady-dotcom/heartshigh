import { expect, test } from '@playwright/test'
import { SETTINGS, joinLearner, uniqueEmail } from './account-helpers'

test('N05: notification preferences save, including quiet night and email consent', async ({ page }) => {
  const email = uniqueEmail('n05-prefs')
  await joinLearner(page, 'Prefs Learner', email, 'prefs-save-1')
  await page.goto(SETTINGS)
  await page.getByTestId('pref-teacher-reply').selectOption('email')
  await page.getByTestId('pref-weekly').selectOption('off')
  await page.getByTestId('quiet-night').check()
  await page.getByTestId('email-news').check()
  await page.getByTestId('notify-prefs-save').click()
  await expect(page.getByTestId('notice')).toContainText('Notification choices saved')
  await expect(page.getByTestId('pref-teacher-reply')).toHaveValue('email')
  await expect(page.getByTestId('pref-weekly')).toHaveValue('off')
  await expect(page.getByTestId('quiet-night')).toBeChecked()
  await expect(page.getByTestId('email-news')).toBeChecked()
})
