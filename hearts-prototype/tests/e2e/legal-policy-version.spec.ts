import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'
import { completeConsent, joinWithConsent } from './legal-helpers'

test('L03 a new published version asks the learner to agree again', async ({ page }) => {
  const suffix = Date.now().toString().slice(-6)
  const email = `reaccept-${suffix}@hearts.test`
  await joinWithConsent(page, seedCode('elm-learner'), 'Reaccept Learner', email, 'reaccept-pass-1')

  const ctx = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await ctx.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const users = await (await ctx.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0`)).json()
  const userId = (users.docs as { id: number }[])[0]?.id
  expect(userId).toBeTruthy()
  const consents = await (await ctx.get(`/api/consents?where[user][equals]=${userId}&limit=20&depth=0`)).json()
  const privacy = (consents.docs as { id: number; kind?: string }[]).find((row) => row.kind === 'privacy')
  expect(privacy?.id).toBeTruthy()
  const bumped = await ctx.patch(`/api/consents/${privacy!.id}`, { data: { version: `old-${suffix}` } })
  expect(bumped.ok()).toBeTruthy()

  await page.goto('/p/east-london')
  await expect(page.getByTestId('consent')).toBeVisible()
  await expect(page.getByTestId('consent-summaries')).toBeVisible()
  await completeConsent(page, '18+')
  await expect(page.getByTestId('consent')).toHaveCount(0)
})
