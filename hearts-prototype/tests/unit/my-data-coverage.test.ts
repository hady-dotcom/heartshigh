import assert from 'node:assert/strict'
import { test } from 'node:test'
import { missingPersonalCoverage } from '../../src/server/my-data'

test('A20: every collection with a user field is included or explicitly not personal', () => {
  assert.deepEqual(missingPersonalCoverage(), [])
})
