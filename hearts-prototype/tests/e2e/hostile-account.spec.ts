import { expect, test } from '@playwright/test'
import { E2E_BASE } from '../env'
import {
  BASE,
  asUser,
  findPortalId,
  findUserId,
  joinLearner,
  postAction,
  sessionUserId,
  uniqueEmail,
  waitForMail,
} from './account-helpers'

test.describe.configure({ mode: 'serial' })

test('A17: a portal admin cannot pause someone in another portal, and a paused session dies', async ({ page }) => {
  const email = uniqueEmail('a17-pause')
  const password = 'pause-me-now'
  await joinLearner(page, 'Pause Learner', email, password)
  await page.goto(`${BASE}/me`)
  await expect(page.getByTestId('me-name').or(page.getByTestId('settings'))).toBeVisible()

  const master = await asUser('master@hearts.test', 'hearts-master')
  const learnerId = await sessionUserId(page)
  const leeds = await findPortalId(master, 'leeds')
  const otherEmail = uniqueEmail('a17-leeds-admin')
  const other = await master.post('/api/users', {
    data: {
      email: otherEmail,
      password: 'leeds-admin-1',
      name: 'Leeds Admin',
      role: 'portal-admin',
      tenants: [{ tenant: leeds }],
      emailConfirmedAt: new Date().toISOString(),
    },
  })
  expect(other.ok(), await other.text()).toBeTruthy()

  const teacher = await asUser('elm-teacher@hearts.test', 'portal-teacher')
  const teacherTry = await postAction(teacher, { action: 'suspend-person', userId: String(learnerId), reason: 'a short reason', next: `${BASE}/admin/teach` })
  expect(teacherTry.status()).toBe(403)
  await teacher.dispose()

  const stranger = await asUser(otherEmail, 'leeds-admin-1')
  const cross = await postAction(stranger, { action: 'suspend-person', userId: String(learnerId), reason: 'a short reason', next: '/p/leeds/admin/teach' })
  expect(cross.status()).toBe(403)
  await stranger.dispose()

  const admin = await asUser('elm-admin@hearts.test', 'portal-admin')
  const paused = await postAction(admin, { action: 'suspend-person', userId: String(learnerId), reason: 'Lost phone', next: `${BASE}/admin/teach` })
  expect(paused.status()).toBeLessThan(400)
  await waitForMail(email, 'paused')
  await admin.dispose()

  await page.goto(`${BASE}/me`)
  await expect(page).toHaveURL(/\/login/)

  const cookieJar = await page.context().cookies()
  const still = await page.request.get(`${E2E_BASE}${BASE}/me/settings`, { maxRedirects: 0 })
  expect([302, 303, 307, 308].includes(still.status()) || still.url().includes('/login') || still.url().includes('session-end')).toBeTruthy()
  void cookieJar

  const login = await page.request.post('/api/users/login', { data: { email, password } })
  expect(login.ok()).toBeFalsy()

  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('error')).toHaveText(/This account is paused since .+ at \d{2}:\d{2}\. Please speak to your masjid or school\./)
  await expect(page.locator('.door-card').getByText(/This account is paused/)).toHaveCount(1)

  const restore = await postAction(master, { action: 'restore-person', userId: String(learnerId), next: '/master/learners' })
  expect(restore.status()).toBeLessThan(400)
  await master.delete(`/api/users/${(await other.json()).doc.id}`)
  await master.dispose()
})

test('A15 hostile: a portal admin cannot promote to portal admin or touch another portal', async () => {
  const master = await asUser('master@hearts.test', 'hearts-master')
  const email = uniqueEmail('a15-hostile')
  const elm = await findPortalId(master, 'east-london')
  const created = await master.post('/api/users', {
    data: { email, password: 'hostile-role-1', name: 'Hostile Role', role: 'learner', tenants: [{ tenant: elm }], emailConfirmedAt: new Date().toISOString() },
  })
  expect(created.ok()).toBeTruthy()
  const id = (await created.json()).doc.id
  const admin = await asUser('elm-admin@hearts.test', 'portal-admin')
  const promote = await postAction(admin, { action: 'change-role', userId: String(id), role: 'portal-admin', next: `${BASE}/admin/teach` })
  expect(promote.status()).toBe(403)
  const leedsLearner = await findUserId(master, 'leeds-learner@hearts.test')
  const cross = await postAction(admin, { action: 'change-role', userId: String(leedsLearner), role: 'teacher', next: `${BASE}/admin/teach` })
  expect(cross.status()).toBe(403)
  await admin.dispose()
  await master.delete(`/api/users/${id}`)
  await master.dispose()
})
