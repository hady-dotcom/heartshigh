import assert from 'node:assert/strict'
import { test } from 'node:test'
import { firstNameOf, inviteLine } from './invite'

test('the join line names the person when there is one, else the portal', () => {
  assert.equal(inviteLine('East London Mosque', 'Aisha Patel'), 'Aisha from East London Mosque invited you')
  assert.equal(inviteLine('East London Mosque', 'Aisha'), 'Aisha from East London Mosque invited you')
  assert.equal(inviteLine('East London Mosque'), 'East London Mosque invited you')
  assert.equal(inviteLine('East London Mosque', '  '), 'East London Mosque invited you')
  assert.equal(firstNameOf('Idris Rahman'), 'Idris')
})
