import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { hashToken, randomToken } from './account-crypto'
import { CONFIRM_MS, RESEND_PER_HOUR, tokenFresh } from './account-rules'

describe('email confirmation tokens', () => {
  it('hashes a token so the raw value is not stored', () => {
    const token = randomToken()
    const hashed = hashToken(token, 'test-secret-test-secret-test-secret')
    assert.notEqual(hashed, token)
    assert.equal(hashed, hashToken(token, 'test-secret-test-secret-test-secret'))
    assert.notEqual(hashed, hashToken('other', 'test-secret-test-secret-test-secret'))
  })

  it('expires after a week and limits resends', () => {
    const now = new Date('2026-10-04T12:00:00Z')
    const fresh = new Date(now.getTime() + CONFIRM_MS - 1000).toISOString()
    const stale = new Date(now.getTime() - 1000).toISOString()
    assert.equal(tokenFresh(fresh, now), true)
    assert.equal(tokenFresh(stale, now), false)
    assert.equal(RESEND_PER_HOUR, 3)
  })
})
