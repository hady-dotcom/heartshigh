import { expect, test } from '@playwright/test'
import {
  BASE,
  CALM_FORGOT,
  RESET_STALE,
  asUser,
  caughtMail,
  confirmFromInbox,
  findUserId,
  joinLearner,
  mailLink,
  signIn,
  uniqueEmail,
  waitForMail,
} from './account-helpers'

test.describe.configure({ mode: 'serial' })

test('A02: a confirmed learner resets from the emailed link, then the token expires', async ({ page }) => {
  const email = uniqueEmail('a02-reset')
  const first = 'reset-first-1'
  const next = 'reset-next-99'
  await joinLearner(page, 'Reset Learner', email, first)
  await confirmFromInbox(page, email)

  await page.goto('/forgot')
  await page.getByTestId('forgot-email').fill(email)
  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('notice')).toHaveText(CALM_FORGOT)

  const mail = await waitForMail(email, 'Reset your HEARTS password')
  expect(mail.html).toMatch(/#0E2A2B/)
  expect(mail.html).toMatch(/#D4A84B/)
  const href = mailLink(mail, '/reset')
  expect(href, 'reset link').toMatch(/\/reset\?token=/)

  await page.goto(href!)
  await page.getByTestId('reset-password').fill(next)
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('notice')).toContainText('password is updated')

  await signIn(page, email, next, `${BASE}/me`)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByTestId('me-name').or(page.getByTestId('settings'))).toBeVisible()

  const changed = await waitForMail(email, 'password was changed')
  expect(changed.text).toMatch(/password was changed/i)

  await page.goto(href!)
  await page.getByTestId('reset-password').fill('reset-stale-1')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('error')).toContainText(RESET_STALE)
})

test('A02: a wrong token and an unconfirmed inbox keep the same calm notice', async ({ page }) => {
  await page.goto('/reset?token=not-a-real-token')
  await page.getByTestId('reset-password').fill('anything1')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('error')).toContainText(RESET_STALE)

  const email = uniqueEmail('a02-unconfirmed')
  await joinLearner(page, 'Unconfirmed Reset', email, 'unconfirmed-1')
  const before = await waitForMail(email, 'Confirm your email')

  await page.goto('/forgot')
  await page.getByTestId('forgot-email').fill(email)
  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('notice')).toHaveText(CALM_FORGOT)

  await page.goto('/forgot')
  await page.getByTestId('forgot-email').fill('nobody-here@hearts.test')
  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('notice')).toHaveText(CALM_FORGOT)

  const emails = await caughtMail()
  expect(emails.filter((row) => row.to.toLowerCase().includes(email) && /reset your hearts password/i.test(row.subject) && row.id > before.id)).toHaveLength(0)

  const master = await asUser('master@hearts.test', 'hearts-master')
  const id = await findUserId(master, email)
  const reset = await master.post('/api/users/forgot-password', { data: { email } })
  expect(reset.ok()).toBeTruthy()
  const mailed = await waitForMail(email, 'Reset your HEARTS password')
  const href = mailLink(mailed, '/reset')
  await master.patch(`/api/users/${id}`, { data: { resetPasswordExpiration: '2020-01-01T00:00:00.000Z' } })
  await page.goto(href!)
  await page.getByTestId('reset-password').fill('too-late-99')
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('error')).toContainText(RESET_STALE)
  await master.dispose()
})
