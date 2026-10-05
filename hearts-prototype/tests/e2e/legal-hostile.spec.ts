import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE, seedCode } from '../env'

test('L03 hostile: learner actions are refused until consent exists', async () => {
  const suffix = Date.now().toString().slice(-6)
  const email = `hostile-${suffix}@hearts.test`
  const password = 'hostile-pass-1'
  const anon = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const joined = await anon.post('/api/hearts', {
    form: {
      action: 'join',
      code: seedCode('elm-learner'),
      name: 'Hostile Learner',
      email,
      password,
    },
    maxRedirects: 0,
  })
  expect(joined.status()).toBe(303)

  const learner = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  expect((await learner.post('/api/users/login', { data: { email, password } })).ok()).toBeTruthy()
  const blocked = await learner.post('/api/hearts', {
    headers: { accept: 'application/json' },
    form: { action: 'profile', name: 'Nope', next: '/p/elm' },
    maxRedirects: 0,
  })
  expect(blocked.status()).toBe(403)
  const body = await blocked.json()
  expect(String(body.error || '')).toMatch(/agree/i)

  const allowed = await learner.post('/api/hearts', {
    headers: { accept: 'application/json' },
    form: { action: 'logout' },
    maxRedirects: 0,
  })
  expect([303, 200].includes(allowed.status())).toBeTruthy()
})

test('P11 hostile: a learner cannot write portal contacts', async () => {
  const learner = await playwrightRequest.newContext({ baseURL: E2E_BASE, extraHTTPHeaders: { accept: 'application/json' } })
  expect((await learner.post('/api/users/login', { data: { email: 'elm-learner@hearts.test', password: 'portal-learner' } })).ok()).toBeTruthy()
  const res = await learner.post('/api/hearts', {
    headers: { accept: 'application/json' },
    form: {
      action: 'save-portal-contacts',
      privacyName: 'Stolen',
      privacyEmail: 'x@y.z',
      safeguardingName: 'Stolen',
      safeguardingEmail: 'x@y.z',
      safeguardingPhone: '0',
      next: '/p/elm',
    },
    maxRedirects: 0,
  })
  expect(res.status()).toBe(403)
})
