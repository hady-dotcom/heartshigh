import { expect, request as playwrightRequest, test } from '@playwright/test'
import { payloadCsrf, CSRF_E2E_IN_PRODUCTION } from '../../src/lib/env'
import { BASE, SETTINGS, signIn } from './account-helpers'
import { E2E_BASE } from '../env'

test('a cross-origin cookie POST to a state-changing route is refused while CSRF is on', async ({ page }) => {
  const origins = payloadCsrf(['https://hearts.example'], { NODE_ENV: 'production', HEARTS_E2E: '1' }, () => undefined)
  expect(origins, CSRF_E2E_IN_PRODUCTION).toEqual(['https://hearts.example'])

  await signIn(page, 'elm-learner@hearts.test', 'portal-learner', SETTINGS)
  await page.waitForURL((url) => url.pathname.startsWith(`${BASE}/me`))
  const state = await page.context().storageState()
  const before = await page.getByTestId('me-name').innerText()

  const evil = await playwrightRequest.newContext({
    baseURL: E2E_BASE,
    storageState: state,
    extraHTTPHeaders: { Origin: 'https://evil.example' },
  })
  const res = await evil.post('/api/hearts', {
    form: { action: 'profile', name: 'Hacked by CSRF', next: `${BASE}/me` },
    maxRedirects: 0,
  })
  expect(res.status(), await res.text()).toBe(403)
  await evil.dispose()

  await page.reload()
  await expect(page.getByTestId('me-name')).toHaveText(before)
  expect(before.toLowerCase()).not.toContain('hacked')
})
