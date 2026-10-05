import { expect, test } from '@playwright/test'
import { SETTINGS, asUser, joinLearner, postAction, signIn, uniqueEmail, waitForMail } from './account-helpers'

test('A19: delete request emails, signing in cancels, and the job runs after the clock is moved', async ({ page }) => {
  const email = uniqueEmail('a19-delete')
  const password = 'delete-me-14'
  await joinLearner(page, 'Delete Learner', email, password)
  await page.goto(`${SETTINGS}?account=delete`)
  await expect(page.getByTestId('delete-account')).toContainText('14 days')
  await page.getByTestId('delete-account-submit').click()
  await expect(page.getByTestId('notice')).toContainText('14 days')
  await waitForMail(email, 'started deleting')

  await page.getByTestId('logout').click()
  await signIn(page, email, password, SETTINGS)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await waitForMail(email, 'will stay')

  await page.goto(`${SETTINGS}?account=delete`)
  await page.getByTestId('delete-account-submit').click()
  await expect(page.getByTestId('notice')).toContainText('14 days')

  const master = await asUser('master@hearts.test', 'hearts-master')
  const clock = await postAction(master, { action: 'clock', iso: '2026-11-01T12:00:00.000Z', next: '/master' })
  expect(clock.status(), 'clock').toBeLessThan(400)
  const jobs = await master.post('/api/hearts/jobs')
  expect(jobs.ok()).toBeTruthy()
  const body = await jobs.json()
  expect(Array.isArray(body.deletions)).toBeTruthy()
  expect(body.deletions.some((row: { pending?: boolean; ok?: boolean }) => row.pending || row.ok)).toBeTruthy()
  await master.dispose()
})
