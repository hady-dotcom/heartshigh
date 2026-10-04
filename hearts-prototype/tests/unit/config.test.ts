import assert from 'node:assert/strict'
import { test } from 'node:test'

test('Bug 20: e2e starts its own server with the test clock on, on a port `npm run go` does not use', async () => {
  delete process.env.HEARTS_E2E_REUSE
  delete process.env.CI
  const config = (await import('../../playwright.config')).default
  const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer
  assert.ok(server, 'a webServer is configured')
  assert.equal(server.reuseExistingServer, false, 'never reuses whatever is already listening')
  assert.equal(server.env?.HEARTS_TEST_CLOCK, '1')
  assert.doesNotMatch(String(config.use?.baseURL), /:3000\b/, 'the suite does not share :3000 with npm run go')
  assert.match(String(server.command), new RegExp(String(new URL(String(config.use?.baseURL)).port)))
})

test('Bug 9: the test clock is master-only and never on in a production build', async () => {
  const clock = await import('../../src/lib/clock')
  const saved = { clock: process.env.HEARTS_TEST_CLOCK, env: process.env.NODE_ENV }
  const env = process.env as Record<string, string | undefined>
  try {
    env.HEARTS_TEST_CLOCK = '1'
    env.NODE_ENV = 'production'
    assert.equal(clock.clockEnabled(), false)
    assert.throws(() => clock.setTestNow('2030-01-01T00:00:00Z'), /off/)
    env.NODE_ENV = 'development'
    assert.equal(clock.clockEnabled(), true)
    clock.setTestNow('2030-01-01T00:00:00Z')
    env.NODE_ENV = 'production'
    assert.ok(clock.now().getFullYear() < 2030, 'a production build ignores a clock left behind')
    env.NODE_ENV = 'development'
    clock.setTestNow(null)
  } finally {
    env.HEARTS_TEST_CLOCK = saved.clock
    env.NODE_ENV = saved.env
  }
})
