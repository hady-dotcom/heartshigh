import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  announceProblems,
  canSeeAlertContent,
  reportNoteProblems,
  safeguardingFromReport,
  shouldAutoHide,
  tealMailHtml,
} from './safety'
import { parseNotificationEmails } from './portal-contacts'
import { hitShared, ANSWER_PER_HOUR, REPORT_PER_DAY, DAY_MS, HOUR_MS } from './rate-store'
import { resetLimits } from './rate-limit'

describe('N09 report rules', () => {
  it('hides after three reports or one at-risk report', () => {
    assert.equal(shouldAutoHide(['unkind', 'spam']), false)
    assert.equal(shouldAutoHide(['unkind', 'spam', 'other']), true)
    assert.equal(shouldAutoHide(['at-risk']), true)
    assert.equal(safeguardingFromReport('at-risk'), true)
    assert.equal(safeguardingFromReport('spam'), false)
  })

  it('keeps the note plain and short', () => {
    assert.deepEqual(reportNoteProblems('<script>x</script>'), ['The note is plain text: no HTML or code.'])
    assert.equal(reportNoteProblems('a'.repeat(501))[0], 'Keep the note under 500 characters.')
  })
})

describe('N10 safeguarding visibility', () => {
  it('only the lead and the master see alert content', () => {
    assert.equal(canSeeAlertContent({ id: 8, role: 'teacher' }, 9), false)
    assert.equal(canSeeAlertContent({ id: 9, role: 'portal-admin' }, 9), true)
    assert.equal(canSeeAlertContent({ id: 1, role: 'master' }, 9), true)
  })

  it('the mail names no extra personal data', () => {
    const html = tealMailHtml('A learner may need support', '<p>A learner may need support. Please look today.</p>')
    assert.match(html, /#0E2A2B/)
    assert.match(html, /#D4A84B/)
    assert.doesNotMatch(html, /[A-Z0-9._%+-]+@[A-Z0-9.-]+/i)
    assert.doesNotMatch(html, /answer body|voice note/i)
  })

  it('reads emails from the P11 fallback list', () => {
    const rows = parseNotificationEmails('Imam <imam@masjid.test>, office@masjid.test')
    assert.equal(rows[0].email, 'imam@masjid.test')
    assert.equal(rows[1].email, 'office@masjid.test')
  })
})

describe('N01 announcements', () => {
  it('refuses markup, marks language and a long message', () => {
    assert.ok(announceProblems('').length)
    assert.ok(announceProblems('<b>Eid</b>').length)
    assert.ok(announceProblems('Please sit the quiz tonight').length)
    assert.equal(announceProblems('Eid prayer is at 8:30. Bring a mat if you can.').length, 0)
  })
})

describe('S01 shared rate store', () => {
  it('falls back to memory when Payload is off, and respects the new caps', async () => {
    resetLimits()
    const env = { HEARTS_E2E: '', HEARTS_TEST_CLOCK: '' }
    for (let i = 0; i < ANSWER_PER_HOUR; i++) {
      const result = await hitShared(null, 'answer-hour:9', ANSWER_PER_HOUR, HOUR_MS, 1_000 + i, env)
      assert.equal(result.allowed, true)
    }
    const blocked = await hitShared(null, 'answer-hour:9', ANSWER_PER_HOUR, HOUR_MS, 2_000, env)
    assert.equal(blocked.allowed, false)
    resetLimits()
    const report = await hitShared(null, 'report-user:9', REPORT_PER_DAY, DAY_MS, 1_000, env)
    assert.equal(report.allowed, true)
  })
})
