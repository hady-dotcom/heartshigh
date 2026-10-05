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
    assert.match(mail.text, /because someone asked to reset/)
    assert.doesNotMatch(mail.text, /because Someone/)
    assert.match(mail.text, /If this wasn't you, you can ignore this email\. Your password stays the same\./)
    assert.match(mail.text, /East London on HEARTS/)
    assert.doesNotMatch(mail.text, /—/)
    assert.doesNotMatch(mail.text, /HEARTS on HEARTS/)
    const confirm = renderMail('confirm', { portalName: 'East London circle' })
    assert.match(confirm.text, /East London circle on HEARTS/)
    assert.match(confirm.text, /If this wasn't you, you can ignore this email\./)
    assert.doesNotMatch(confirm.text, /—/)
    const paused = renderMail('suspended', { portalName: 'East London circle', since: '5 October 2026 at 00:16' })
    assert.match(paused.text, /East London circle on HEARTS/)
    assert.match(paused.text, /This account is paused since 5 October 2026 at 00:16\. Please speak to your masjid or school\./)
    assert.match(paused.text, /Your learning is kept/)
    assert.doesNotMatch(paused.text, /This was at/)
    assert.match(paused.text, /because a teacher or admin paused/)
    assert.doesNotMatch(paused.text, /because A /)
    assert.doesNotMatch(paused.text, /—/)
    assert.ok(contrastRatio('#F6EEDC', '#0E2A2B') >= 4.5)
  })

  it('reads MAIL_FROM as name and address', () => {
    assert.deepEqual(mailFrom({ MAIL_FROM: 'HEARTS <hello@masjid.org>' }), { name: 'HEARTS', address: 'hello@masjid.org' })
    assert.deepEqual(mailFrom({ MAIL_FROM: 'hello@masjid.org' }), { name: 'HEARTS', address: 'hello@masjid.org' })
  })
})
