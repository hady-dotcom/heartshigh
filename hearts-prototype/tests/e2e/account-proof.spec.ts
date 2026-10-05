import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import {
  BASE,
  SETTINGS,
  asUser,
  confirmFromInbox,
  findPortalId,
  joinLearner,
  mailLink,
  postAction,
  secretFromSetup,
  sessionUserId,
  signIn,
  totpNow,
  uniqueEmail,
  waitForMail,
} from './account-helpers'

const OUT = path.join(process.cwd(), 'proto-test/verify/accounts')

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true })
})

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

test('proof stills: reset, confirm mail, 2FA and suspend', async ({ page }) => {
  const email = uniqueEmail('proof-reset')
  const first = 'proof-first-1'
  const next = 'proof-next-99'
  await joinLearner(page, 'Proof Learner', email, first)
  await confirmFromInbox(page, email)
  await page.goto('/forgot')
  await page.getByTestId('forgot-email').fill(email)
  await page.getByTestId('forgot-submit').click()
  await expect(page.getByTestId('notice')).toBeVisible()
  await shot(page, '01-forgot-notice')
  const resetMail = await waitForMail(email, 'Reset your HEARTS password')
  writeFileSync(path.join(OUT, 'email-reset.html'), resetMail.html)
  await page.setContent(resetMail.html)
  await shot(page, '02-email-reset')
  const href = mailLink(resetMail, '/reset')
  await page.goto(href!)
  await shot(page, '03-reset-form')
  await page.getByTestId('reset-password').fill(next)
  await page.getByTestId('reset-submit').click()
  await expect(page.getByTestId('notice')).toContainText('password is updated')
  await shot(page, '04-reset-done')

  await page.setViewportSize({ width: 1440, height: 900 })
  const adminEmail = uniqueEmail('proof-admin')
  const master = await asUser('master@hearts.test', 'hearts-master')
  const portal = await findPortalId(master, 'east-london')
  const created = await master.post('/api/users', {
    data: {
      email: adminEmail,
      password: 'proof-admin-1',
      name: 'Proof Admin',
      role: 'portal-admin',
      tenants: [{ tenant: portal }],
      emailConfirmedAt: new Date().toISOString(),
      onboarded: true,
    },
  })
  expect(created.ok()).toBeTruthy()
  await signIn(page, adminEmail, 'proof-admin-1', `${BASE}/admin/settings`)
  await page.waitForURL(/\/admin\/settings/)
  await shot(page, '05-two-step-panel')
  await page.getByTestId('two-step-start').click()
  await expect(page.getByTestId('login-setup')).toBeVisible()
  await shot(page, '06-two-step-setup')
  const secret = secretFromSetup(await page.getByTestId('totp-secret').innerText())
  await page.getByTestId('totp-setup-code').fill(totpNow(secret))
  await page.getByTestId('totp-setup-submit').click()
  await expect(page.getByTestId('backup-codes')).toBeVisible()
  await shot(page, '07-two-step-backups')
  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/' } })
  await signIn(page, adminEmail, 'proof-admin-1', `${BASE}/admin`)
  await expect(page.getByTestId('login-code')).toBeVisible()
  await shot(page, '08-two-step-code')

  await page.setViewportSize({ width: 390, height: 844 })
  const learnerEmail = uniqueEmail('proof-pause')
  await joinLearner(page, 'Proof Pause', learnerEmail, 'proof-pause-1')
  await page.goto(`${BASE}/me`)
  const learnerId = await sessionUserId(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${BASE}/admin/teach`)
  await page.waitForURL(/\/admin\/teach/)
  await shot(page, '09-teach-before-pause')
  const paused = await postAction(await asUser('elm-admin@hearts.test', 'portal-admin'), {
    action: 'suspend-person',
    userId: String(learnerId),
    reason: 'Lost phone',
    next: `${BASE}/admin/teach`,
  })
  expect(paused.status()).toBeLessThan(400)
  await page.goto(`${BASE}/admin/teach`)
  await shot(page, '10-teach-after-pause')
  const mail = await waitForMail(learnerEmail, 'paused')
  writeFileSync(path.join(OUT, 'email-paused.html'), mail.html)
  await page.setContent(mail.html)
  await shot(page, '11-email-paused')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await page.getByTestId('login-email').fill(learnerEmail)
  await page.getByTestId('login-password').fill('proof-pause-1')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('error')).toContainText(/paused|masjid/)
  await shot(page, '12-paused-sign-in')
  await master.dispose()

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/settings')
  await page.waitForURL(/\/master\/settings/)
  await shot(page, '13-master-email-panel')
})
