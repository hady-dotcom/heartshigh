import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { forcedPasswordDestination } from './password-gate'

test('a signed-in user with a forced password change lands on the change page', () => {
  const signedIn = { mustChangePassword: true }
  assert.equal(forcedPasswordDestination(signedIn, '/master/learners'), '/change-password')
  assert.equal(forcedPasswordDestination(signedIn, '/p/east-london'), '/change-password')
  assert.equal(forcedPasswordDestination(signedIn, '/'), '/change-password')
  assert.equal(forcedPasswordDestination(signedIn, '/change-password'), null)
  assert.equal(forcedPasswordDestination({ mustChangePassword: false }, '/master'), null)
  assert.equal(forcedPasswordDestination(null, '/master'), null)

  const gate = readFileSync(new URL('../server/context.ts', import.meta.url), 'utf8')
  const requireUser = gate.slice(gate.indexOf('export async function requireUser'), gate.indexOf('export async function requireMaster'))
  const signedOut = requireUser.indexOf('if (!session.user) redirect(`/login')
  const change = requireUser.indexOf('forcedPasswordDestination(session.actor, path)')
  assert.ok(signedOut > 0 && change > signedOut, 'the change page comes after the signed-in check')
  assert.match(requireUser, /if \(change\) redirect\(change\)/)
})
