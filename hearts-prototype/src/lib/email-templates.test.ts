import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { contrastRatio } from './desk-tokens'
import { MAIL_CONTRAST, mailFrom, renderMail } from './email-templates'

describe('email templates', () => {
  it('uses a teal header and gold button with contrast of at least 4.5:1', () => {
    assert.ok(MAIL_CONTRAST.header >= 4.5, `header ${MAIL_CONTRAST.header}`)
    assert.ok(MAIL_CONTRAST.button >= 4.5, `button ${MAIL_CONTRAST.button}`)
    const mail = renderMail('reset', { name: 'Maryam', portalName: 'East London', buttonUrl: 'https://hearts.example/reset?token=abc' })
    assert.equal(mail.subject, 'Reset your HEARTS password')
    assert.match(mail.html, /#0E2A2B/)
    assert.match(mail.html, /#D4A84B/)
    assert.match(mail.html, /reset\?token=abc/)
    assert.match(mail.text, /Maryam/)
    assert.match(mail.text, /https:\/\/hearts.example\/reset\?token=abc/)
    assert.ok(contrastRatio('#F6EEDC', '#0E2A2B') >= 4.5)
  })

  it('reads MAIL_FROM as name and address', () => {
    assert.deepEqual(mailFrom({ MAIL_FROM: 'HEARTS <hello@masjid.org>' }), { name: 'HEARTS', address: 'hello@masjid.org' })
    assert.deepEqual(mailFrom({ MAIL_FROM: 'hello@masjid.org' }), { name: 'HEARTS', address: 'hello@masjid.org' })
  })
})
