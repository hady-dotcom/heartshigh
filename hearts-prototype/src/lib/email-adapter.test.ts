import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mailTransportMode, mailTransportOn } from './email-adapter'

describe('email transport', () => {
  it('is off when neither SMTP nor Resend is set', () => {
    assert.equal(mailTransportMode({}), 'off')
    assert.equal(mailTransportOn({}), false)
  })

  it('prefers SMTP, then Resend, then the test catcher', () => {
    assert.equal(mailTransportMode({ SMTP_URL: 'smtp://localhost:1025' }), 'smtp')
    assert.equal(mailTransportMode({ RESEND_API_KEY: 're_test' }), 'resend')
    assert.equal(mailTransportMode({ HEARTS_MAIL_CATCHER: '1' }), 'catcher')
    assert.equal(mailTransportMode({ HEARTS_E2E: '1' }), 'catcher')
  })

  it('never claims a transport is on just because a from address exists', () => {
    assert.equal(mailTransportOn({ MAIL_FROM: 'HEARTS <a@b.c>' }), false)
  })
})
