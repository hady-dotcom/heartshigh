import assert from 'node:assert/strict'
import { test } from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from '../../src/middleware'

function token(role: string) {
  const body = Buffer.from(JSON.stringify({ id: 1, role })).toString('base64url')
  return `e30.${body}.sig`
}

function open(path: string, role?: string) {
  const headers = new Headers()
  if (role) headers.set('cookie', `payload-token=${token(role)}`)
  return middleware(new NextRequest(`https://hearts.example${path}`, { headers }))
}

function pathOf(location: string | null) {
  if (!location) return ''
  return location.startsWith('/') ? location.split('?')[0] : new URL(location).pathname
}

test('a master leaves the raw dashboard for the custom CMS', () => {
  const dashboard = open('/admin', 'master')
  assert.equal(dashboard.status, 307)
  assert.equal(pathOf(dashboard.headers.get('location')), '/admin/cms')

  const cms = open('/admin/cms', 'master')
  const rewrite = cms.headers.get('x-middleware-rewrite') || ''
  assert.equal(cms.status, 200)
  assert.equal(new URL(rewrite).pathname, '/master')
})

test('the raw dashboard stays put for everyone else, and the learner sign-in is untouched', () => {
  assert.equal(open('/admin').status, 200)
  assert.equal(open('/admin').headers.get('location'), null)
  assert.equal(open('/admin', 'learner').status, 200)
  assert.equal(open('/admin', 'learner').headers.get('location'), null)
  assert.equal(open('/admin', 'portal-admin').headers.get('location'), null)

  const stranger = open('/admin/cms')
  assert.equal(stranger.status, 307)
  assert.equal(pathOf(stranger.headers.get('location')), '/admin')

  const login = middleware(new NextRequest('https://hearts.example/login'))
  assert.equal(login.status, 200)
  assert.equal(login.headers.get('location'), null)
})
