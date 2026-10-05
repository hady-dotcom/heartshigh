import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { linkFromMail, type CaughtMail } from './mail-catcher'

describe('mail catcher links', () => {
  it('reads absolute and relative reset links', () => {
    const abs: CaughtMail = {
      id: '1',
      at: '2026-10-04',
      to: 'a@b.c',
      subject: 'Reset',
      text: 'Open https://hearts.example/reset?token=abc',
      html: '',
    }
    assert.equal(linkFromMail(abs, '/reset'), 'https://hearts.example/reset?token=abc')
    const rel: CaughtMail = { ...abs, text: '', html: '<a href="/reset?token=xyz">Reset</a>' }
    assert.equal(linkFromMail(rel, '/reset'), '/reset?token=xyz')
  })
})
