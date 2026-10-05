import { expect, test } from '@playwright/test'
import {
  BASE,
  asUser,
  findPortalId,
  postAction,
  secretFromSetup,
  signIn,
  totpNow,
  uniqueEmail,
} from './account-helpers'

test.describe.configure({ mode: 'serial' })

test('A09: two-step enrol, TOTP sign-in, backup codes once, password alone cannot pass', async ({ page, request }) => {
  const email = uniqueEmail('a09-admin')
  const password = 'two-step-99'
  const master = await asUser('master@hearts.test', 'hearts-master')
  const portal = await findPortalId(master, 'east-london')
  const created = await master.post('/api/users', {
    data: {
      email,
      password,
      name: 'Two Step Admin',
      role: 'portal-admin',
      tenants: [{ tenant: portal }],
      emailConfirmedAt: new Date().toISOString(),
      onboarded: true,
    },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  await master.dispose()

  await signIn(page, email, password, `${BASE}/admin/settings`)
  await page.waitForURL(/\/admin\/settings/)
  await page.getByTestId('two-step-start').click()
  await expect(page.getByTestId('login-setup')).toBeVisible()
  const secret = secretFromSetup(await page.getByTestId('totp-secret').innerText())
  await page.getByTestId('totp-setup-code').fill(totpNow(secret))
  await page.getByTestId('totp-setup-submit').click()
  await expect(page.getByTestId('backup-codes')).toBeVisible()
  const backups = await page.locator('[data-testid=backup-codes] code').allTextContents()
  expect(backups.length).toBe(10)

  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/' } })

  await signIn(page, email, password, `${BASE}/admin`)
  await expect(page.getByTestId('login-code')).toBeVisible()
  await expect(page).toHaveURL(/\/login\/code/)

  const blockedAdmin = await page.goto(`${BASE}/admin`)
  expect(page.url()).toMatch(/\/login/)
  const blockedMaster = await page.goto('/master')
  expect(page.url()).toMatch(/\/login/)
  const payloadAdmin = await page.goto('/admin')
  expect(page.url()).toMatch(/\/(login|admin)/)
  if (page.url().includes('/admin') && !page.url().includes('/login')) {
    await expect(page.locator('input[name=email], input[type=email], [name="email"]')).toBeVisible()
  }
  void blockedAdmin
  void blockedMaster
  void payloadAdmin

  const rest = await request.post('/api/users/login', { data: { email, password } })
  expect(rest.ok()).toBeFalsy()
  expect(rest.status()).toBe(403)

  await page.goto(`/login?next=${encodeURIComponent(`${BASE}/admin`)}`)
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('totp-code').fill(totpNow(secret))
  await page.getByTestId('totp-submit').click()
  await page.waitForURL((url) => url.pathname.startsWith(`${BASE}/admin`))

  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/' } })
  await signIn(page, email, password, `${BASE}/admin`)
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('totp-code').fill(backups[0])
  await page.getByTestId('totp-submit').click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login/code'))

  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/' } })
  await signIn(page, email, password, `${BASE}/admin`)
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.getByTestId('totp-code').fill(backups[0])
  await page.getByTestId('totp-submit').click()
  await expect(page.getByTestId('error')).toContainText('did not match')
})

test('A09: a password alone cannot reach /master after a master enrols', async ({ page }) => {
  const email = uniqueEmail('a09-master')
  const password = 'master-step-1'
  const master = await asUser('master@hearts.test', 'hearts-master')
  const created = await master.post('/api/users', {
    data: { email, password, name: 'Throwaway Master', role: 'master', emailConfirmedAt: new Date().toISOString() },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const id = (await created.json()).doc.id
  await master.dispose()

  await signIn(page, email, password, '/master/settings')
  await page.waitForURL(/\/master\/settings/)
  await page.getByTestId('two-step-start').click()
  await expect(page.getByTestId('login-setup')).toBeVisible()
  const secret = secretFromSetup(await page.getByTestId('totp-secret').innerText())
  await page.getByTestId('totp-setup-code').fill(totpNow(secret))
  await page.getByTestId('totp-setup-submit').click()
  await expect(page.getByTestId('backup-codes')).toBeVisible()

  await page.request.post('/api/hearts', { form: { action: 'logout', next: '/' } })
  await signIn(page, email, password, '/master')
  await expect(page.getByTestId('login-code')).toBeVisible()
  await page.goto('/master')
  expect(page.url()).toMatch(/\/login/)

  const rest = await page.request.post('/api/users/login', { data: { email, password } })
  expect(rest.status()).toBe(403)

  const seed = await asUser('master@hearts.test', 'hearts-master')
  await seed.delete(`/api/users/${id}`)
  await seed.dispose()
})
