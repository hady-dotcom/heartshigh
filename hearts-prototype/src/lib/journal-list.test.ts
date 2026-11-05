import assert from 'node:assert/strict'
import test from 'node:test'
import { JOURNAL_LABEL } from './journal-copy'
import { PAGE } from './desk-help'
import { deskLead } from './desk-lead'
import { COVERAGE, reduceDemo, seedDemo } from './demo-stage'
import { diaryDeleteRefusal } from './learner-desk'
import {
  journalAnswered,
  journalUnanswered,
  journalUnansweredLabel,
  journalWhen,
  sortJournalEntries,
} from './journal-list'

test('a journal time reads like Wed 14 Oct, 9:12 AM', () => {
  assert.equal(journalWhen('2026-10-14T08:12:00.000Z'), 'Wed 14 Oct, 9:12 AM')
  assert.equal(journalWhen('2026-10-11T09:00:00.000Z'), 'Sun 11 Oct, 10:00 AM')
  assert.equal(journalWhen(''), '')
  assert.equal(journalWhen('not-a-date'), '')
})

test('newest is the default order and oldest reverses it', () => {
  const rows = [
    { id: 'b', at: '2026-10-14T08:12:00.000Z' },
    { id: 'a', at: '2026-10-11T09:00:00.000Z' },
    { id: 'c', at: '2026-10-14T08:12:00.000Z' },
  ]
  assert.deepEqual(sortJournalEntries(rows).map((row) => row.id), ['c', 'b', 'a'])
  assert.deepEqual(sortJournalEntries(rows, 'oldest').map((row) => row.id), ['a', 'b', 'c'])
})

test('an unanswered count shows only when a reply state exists', () => {
  assert.equal(journalUnanswered([{}, {}]), null)
  assert.equal(journalUnanswered([]), null)
  assert.equal(journalUnanswered([{ answered: true }, { answered: false }, { answered: false }]), 2)
  assert.equal(journalUnanswered([{ answered: true }]), 0)
  assert.equal(journalUnansweredLabel(null), null)
  assert.equal(journalUnansweredLabel(0), 'All answered')
  assert.equal(journalUnansweredLabel(1), '1 not answered yet')
  assert.equal(journalUnansweredLabel(4), '4 not answered yet')
  assert.equal(journalAnswered({ teacherReply: '  Thursday?  ' }), true)
  assert.equal(journalAnswered({ repliedAt: '2026-10-14T08:12:00.000Z' }), true)
  assert.equal(journalAnswered({ doneAt: '2026-10-14T08:12:00.000Z' }), true)
  assert.equal(journalAnswered({ teacherReply: '   ' }), false)
})

test('desks, help and the demo read the journal name from one place', () => {
  assert.equal(JOURNAL_LABEL.one, 'Journal')
  assert.equal(JOURNAL_LABEL.many, 'Journals')
  assert.match(PAGE.diaries, new RegExp(JOURNAL_LABEL.one, 'i'))
  assert.doesNotMatch(PAGE.diaries, /diary/i)
  assert.match(deskLead('diaries', '/master')?.line || '', new RegExp(JOURNAL_LABEL.many))
  assert.doesNotMatch(deskLead('diaries', '/master')?.line || '', /diary/i)
  for (const role of ['master', 'portal', 'teacher'] as const) {
    const row = COVERAGE.find((item) => item.role === role && item.key === 'diaries')
    assert.equal(row?.nav, JOURNAL_LABEL.many)
    assert.doesNotMatch(`${row?.creates} ${row?.reason}`, /diary/i)
  }
  const next = reduceDemo(seedDemo(), { type: 'add-diary', text: 'A line' })
  assert.match(next.activity[0]?.text || '', new RegExp(JOURNAL_LABEL.one.toLowerCase()))
  assert.doesNotMatch(next.activity[0]?.text || '', /diary/i)
  assert.match(diaryDeleteRefusal({ role: 'teacher', portalId: 1 }, 1) || '', new RegExp(JOURNAL_LABEL.one.toLowerCase()))
  assert.doesNotMatch(diaryDeleteRefusal({ role: 'teacher', portalId: 1 }, 1) || '', /diary/i)
})
