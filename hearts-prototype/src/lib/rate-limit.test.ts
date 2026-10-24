import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  authKeys,
  hitAnswer,
  hitAuth,
  limitsRelaxed,
  platformClientIpHeader,
  resetLimits,
} from './rate-limit'

describe('auth and answer limits', () => {
  it('is relaxed for the e2e and test-clock servers', () => {
    assert.equal(limitsRelaxed({ HEARTS_E2E: '1' }), true)
    assert.equal(limitsRelaxed({ HEARTS_TEST_CLOCK: '1' }), true)
    assert.equal(limitsRelaxed({}), false)
  })

  it('counts login tries per address and email, then refuses', () => {
    resetLimits()
    const env = {}
    for (let index = 0; index < 10; index += 1) {
      assert.equal(hitAuth('login', '10.0.0.8', 'a@b.test', env).allowed, true)
    }
    assert.equal(hitAuth('login', '10.0.0.8', 'a@b.test', env).allowed, false)
    assert.equal(hitAuth('login', '10.0.0.9', 'c@b.test', env).allowed, true)
  })

  it('counts answers per learner', () => {
    resetLimits()
    for (let index = 0; index < 40; index += 1) {
      assert.equal(hitAnswer(7, '10.0.0.8', {}).allowed, true)
    }
    assert.equal(hitAnswer(7, '10.0.0.8', {}).allowed, false)
    assert.equal(hitAnswer(8, '10.0.0.8', {}).allowed, true)
  })

  it('uses Cloudflare’s address header when Turnstile or CF_CONNECTING_IP is set', () => {
    assert.equal(platformClientIpHeader({ CF_CONNECTING_IP: '1' }), 'cf-connecting-ip')
    assert.equal(platformClientIpHeader({ TURNSTILE_SECRET_KEY: 'secret' }), 'cf-connecting-ip')
    assert.equal(platformClientIpHeader({ FLY_APP_NAME: 'hearts', TURNSTILE_SECRET_KEY: 'secret' }), 'fly-client-ip')
    assert.deepEqual(authKeys('login', '1.1.1.1', '  A@B.TEST '), { address: 'login:1.1.1.1', person: 'login-email:a@b.test' })
  })
})
