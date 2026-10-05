import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

test('Me ends its option list with Log out on the existing session path', () => {
  const source = readFileSync(new URL('../../src/screens/app/me.tsx', import.meta.url), 'utf8')
  const me = source.slice(source.indexOf('export async function MeScreen'), source.indexOf('export async function PlanScreen'))
  const list = me.indexOf('links.map')
  const logout = me.indexOf('data-testid="logout"')
  const circle = me.indexOf('Circle and nights')
  assert.ok(list > 0 && list < logout && logout < circle, 'Log out follows the Me options')
  const form = me.slice(me.lastIndexOf('<form', logout), logout + 80)
  assert.match(form, /action="\/api\/hearts"/)
  assert.match(form, /action: 'logout'/)
  assert.match(form, />Log out</)
  assert.equal(me.includes('>Sign out<'), false)

  const handle = readFileSync(new URL('../../src/server/handle.ts', import.meta.url), 'utf8')
  const action = handle.slice(handle.indexOf("if (action === 'logout')"), handle.indexOf("if (action === 'join')"))
  assert.match(action, /redirectTo\(req, '\/'\)/)
  assert.match(action, /authCookie\([^)]*'', 0\)/)

  const gate = readFileSync(new URL('../../src/server/context.ts', import.meta.url), 'utf8')
  const requireUser = gate.slice(gate.indexOf('export async function requireUser'), gate.indexOf('export async function requireMaster'))
  assert.match(requireUser, /if \(!session\.user\) redirect\(`\/login/)
})
