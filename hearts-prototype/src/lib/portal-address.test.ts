import assert from 'node:assert/strict'
import { test } from 'node:test'
import { displayPortalAddress } from './portal-address'

test('the portal address keeps the host and shortens the path in the middle', () => {
  assert.equal(displayPortalAddress('https://127.0.0.1:3100/p/east-london'), '127.0.0.1:3100/p/east-london')
  assert.match(displayPortalAddress('https://127.0.0.1:3100/p/east-london/admin/teach', 22), /^127\.0\.0\.1:3100/)
  assert.match(displayPortalAddress('https://127.0.0.1:3100/p/east-london/admin/teach', 22), /…/)
  assert.doesNotMatch(displayPortalAddress('https://127.0.0.1:3100/p/east-london', 10), /^127\.\…$/)
})
