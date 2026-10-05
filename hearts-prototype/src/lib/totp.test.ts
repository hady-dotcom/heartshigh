import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { makeBackupCodes, takeBackupCode, totpNow, totpOk, totpUri, newTotpSecret } from './totp'

describe('totp', () => {
  it('accepts the current code and refuses a wrong one', () => {
    const secret = newTotpSecret()
    const code = totpNow(secret)
    assert.equal(totpOk(code, secret), true)
    assert.equal(totpOk('000000', secret), false)
    assert.match(totpUri('imam@masjid.org', secret), /otpauth:\/\/totp/)
  })

  it('lets a backup code work once', () => {
    const { plain, hashed } = makeBackupCodes()
    assert.equal(plain.length, 10)
    const left = takeBackupCode(hashed, plain[0])
    assert.ok(left)
    assert.equal(left!.length, 9)
    assert.equal(takeBackupCode(left!, plain[0]), null)
  })
})
