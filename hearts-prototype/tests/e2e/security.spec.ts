import { expect, request as playwrightRequest, test } from '@playwright/test'
import { E2E_BASE } from '../env'

// The first account comes only from `npm run bootstrap`. Payload's own first-user screen and endpoint stay closed,
// and no request from outside the server can make an account with any admin access.

const sfx = Date.now().toString().slice(-6)

test('the create-first-user screen and first-register are closed, and nobody outside can make an admin', async () => {
  const anon = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  const page = await anon.get('/admin/create-first-user', { maxRedirects: 0 })
  expect(page.status()).toBe(307)
  expect(new URL(page.headers()['location'], E2E_BASE).pathname).toBe('/login')

  const register = await anon.post('/api/users/first-register', { data: { email: `first-${sfx}@example.com`, password: 'a-long-password-here', name: 'First', role: 'master' } })
  expect(register.status()).toBe(403)
  expect(await register.text()).toContain('npm run bootstrap')

  const master = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await master.post('/api/users/login', { data: { email: 'master@hearts.test', password: 'hearts-master' } })).ok()).toBeTruthy()
  const portal = (await (await master.get('/api/portals?where[slug][equals]=east-london&depth=0')).json()).docs[0].id
  const admin = await playwrightRequest.newContext({ baseURL: E2E_BASE })
  expect((await admin.post('/api/users/login', { data: { email: 'elm-admin@hearts.test', password: 'portal-admin' } })).ok()).toBeTruthy()

  for (const [who, ctx] of [['nobody', anon], ['a portal admin', admin]] as const) {
    for (const role of ['master', 'portal-admin', 'teacher', 'learner']) {
      const email = `made-${role}-${who.replace(/\W/g, '')}-${sfx}@example.com`
      const made = await ctx.post('/api/users', { data: { email, password: 'a-long-password-here', name: 'Made', role, tenants: [{ tenant: portal }] } })
      expect(made.ok(), `${who} creating a ${role}`).toBeFalsy()
      const found = await (await master.get(`/api/users?where[email][equals]=${encodeURIComponent(email)}&depth=0`)).json()
      expect(found.docs, `${who} creating a ${role}`).toHaveLength(0)
    }
  }

  const email = `by-master-${sfx}@example.com`
  const byMaster = await master.post('/api/users', { data: { email, password: 'a-long-password-here', name: 'By Master', role: 'teacher', tenants: [{ tenant: portal }] } })
  expect(byMaster.ok(), 'the master desk can still add people').toBeTruthy()
  await master.delete(`/api/users/${(await byMaster.json()).doc.id}`)
  await Promise.all([anon.dispose(), admin.dispose(), master.dispose()])
})
