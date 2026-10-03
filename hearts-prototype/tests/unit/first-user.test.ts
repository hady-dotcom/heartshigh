import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { refuseOutsideAccountCreation } from '../../src/collections'
import { config, middleware } from '../../src/middleware'

test('Security: only the server itself or a signed-in master can create an account', () => {
  for (const payloadAPI of ['REST', 'GraphQL', undefined]) {
    for (const user of [null, { role: 'learner' }, { role: 'portal-admin' }, { role: 'teacher' }]) {
      assert.throws(() => refuseOutsideAccountCreation({ operation: 'create', req: { payloadAPI, user } }), /bootstrap/, `${payloadAPI} as ${user?.role ?? 'nobody'}`)
    }
  }
  assert.doesNotThrow(() => refuseOutsideAccountCreation({ operation: 'create', req: { payloadAPI: 'local', user: null } }), 'join, seed and bootstrap use the local API')
  assert.doesNotThrow(() => refuseOutsideAccountCreation({ operation: 'create', req: { payloadAPI: 'REST', user: { role: 'master' } } }))
  assert.doesNotThrow(() => refuseOutsideAccountCreation({ operation: 'update', req: { payloadAPI: 'REST', user: null } }), 'other operations keep their own access rules')
})

test('Security: the create-first-user screen and the first-register endpoint are closed', async () => {
  const page = middleware(new NextRequest('https://hearts.example/admin/create-first-user'))
  assert.equal(page.status, 307)
  assert.equal(new URL(page.headers.get('location')!).pathname, '/login')
  for (const path of ['/api/users/first-register', '/api/users/first-register/']) {
    const api = middleware(new NextRequest(`https://hearts.example${path}`, { method: 'POST', body: '{}' }))
    assert.equal(api.status, 403, path)
  }
  for (const path of ['/admin/create-first-user', '/api/users/first-register']) assert.ok(config.matcher.includes(path), `${path} reaches the middleware`)
  assert.equal(middleware(new NextRequest('https://hearts.example/p/east-london')).status, 200)
})
