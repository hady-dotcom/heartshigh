import { expect, test } from '@playwright/test'
import {
  BASE,
  SETTINGS,
  asUser,
  confirmFromInbox,
  findUserId,
  joinLearner,
  mailLink,
  postAction,
  signIn,
  uniqueEmail,
  waitForMail,
} from './account-helpers'

test.describe.configure({ mode: 'serial' })

test('A03: the master desk sends a real test email through the catcher', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'master@hearts.test', 'hearts-master', '/master/settings')
  await page.waitForURL(/\/master\/settings/)
  await expect(page.getByTestId('email-panel')).toBeVisible()
  await expect(page.getByTestId('email-transport')).toBeVisible()
  await page.getByTestId('send-test-email').click()
  await expect(page.getByTestId('notice')).toContainText('test email')
  const mail = await waitForMail('master@hearts.test', 'test email from HEARTS')
  expect(mail.html).toMatch(/#0E2A2B/)
  expect(mail.html).toMatch(/#D4A84B/)
})

test('A06: change email writes to both inboxes and switches only after confirm', async ({ page }) => {
  const email = uniqueEmail('a06-old')
  const next = uniqueEmail('a06-new')
  await joinLearner(page, 'Email Change', email, 'email-change-1')
  await confirmFromInbox(page, email)
  await page.goto(SETTINGS)
  await page.getByTestId('change-email-input').fill(next)
  await page.getByTestId('change-email-submit').click()
  await expect(page.getByTestId('notice')).toContainText('new inbox')
  await waitForMail(email, 'email is being changed')
  const fresh = await waitForMail(next, 'Confirm your new HEARTS email')
  const href = mailLink(fresh, '/confirm')
  expect(href).toBeTruthy()
  await page.goto(href!)
  await expect(page.getByTestId('notice')).toContainText('email is updated')
  await page.getByTestId('logout').click()
  await signIn(page, next, 'email-change-1', SETTINGS)
  await page.waitForURL((url) => url.pathname.includes('/me/settings'))
})

test('A22: a temporary password forces a change at the next sign-in', async ({ page }) => {
  const email = uniqueEmail('a22-temp')
  await joinLearner(page, 'Temp Learner', email, 'old-password-1')
  const admin = await asUser('elm-admin@hearts.test', 'portal-admin')
  const id = await findUserId(admin, email)
  const set = await postAction(admin, { action: 'set-temp-password', userId: String(id), password: 'temp-pass-99', next: `${BASE}/admin/teach` })
  expect(set.status()).toBeLessThan(400)
  await admin.dispose()

  await page.getByTestId('logout').click().catch(() => undefined)
  await signIn(page, email, 'temp-pass-99', SETTINGS)
  await expect(page.getByTestId('must-change-password')).toBeVisible()
  await page.getByTestId('current-password').fill('temp-pass-99')
  await page.getByTestId('new-password').fill('own-password-1')
  await page.getByTestId('new-password-again').fill('own-password-1')
  await page.getByTestId('change-password-submit').click()
  await expect(page.getByTestId('notice').or(page.getByTestId('settings'))).toBeVisible()
  await signIn(page, email, 'own-password-1', SETTINGS)
  await page.waitForURL((url) => url.pathname.includes('/me/settings'))
})

test('A15: a confirmed learner can be made a teacher; an unconfirmed one cannot', async ({ page }) => {
  const unconfirmed = uniqueEmail('a15-raw')
  await joinLearner(page, 'Role Raw', unconfirmed, 'role-raw-1')
  const admin = await asUser('elm-admin@hearts.test', 'portal-admin')
  const rawId = await findUserId(admin, unconfirmed)
  const refused = await postAction(admin, { action: 'change-role', userId: String(rawId), role: 'teacher', next: `${BASE}/admin/teach` })
  expect(refused.status()).toBe(403)

  const email = uniqueEmail('a15-ok')
  await joinLearner(page, 'Role Ok', email, 'role-ok-99')
  await confirmFromInbox(page, email)
  const id = await findUserId(admin, email)
  const ok = await postAction(admin, { action: 'change-role', userId: String(id), role: 'teacher', next: `${BASE}/admin/teach` })
  expect(ok.status()).toBeLessThan(400)
  await admin.dispose()
  const master = await asUser('master@hearts.test', 'hearts-master')
  const user = await (await master.get(`/api/users/${id}?depth=0`)).json()
  expect(user.role).toBe('teacher')
  await master.dispose()
})

test('A11: the access desk emails a join link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, 'elm-admin@hearts.test', 'portal-admin', `${BASE}/admin/access`)
  await page.waitForURL(/\/admin\/access/)
  const box = page.getByTestId('email-join').first()
  await box.locator('summary').click()
  const guest = uniqueEmail('a11-guest')
  await box.getByTestId('join-emails').fill(guest)
  await box.getByTestId('email-join-submit').click()
  await expect(page.getByTestId('notice')).toContainText('Sent')
  const mail = await waitForMail(guest, 'invited to HEARTS')
  expect(mailLink(mail, '/join')).toMatch(/code=/)
  expect(`${mail.text}\n${mail.html}`).toMatch(/unsubscribe|Stop these emails/i)
})
