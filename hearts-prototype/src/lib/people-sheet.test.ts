import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePeopleCsv, peoplePreviewSummary, previewPeopleRows } from './people-sheet'
import { peopleCsv, peopleExportGuard } from './people-export'
import { bulkConfirmLine, bulkProblems, parseIdList } from './bulk-people'
import { planRetention, retentionTable } from './retention'
import { buildRestoreReport, countsMatch, lifecyclePrefix, shouldKeepBackup } from './backup'
import { emailTransportStatus, snapshotOk } from './ops-health'
import { classColour } from './class-palette'
import { DEFAULT_TIME_ZONE, staffWhen, ymdFromParts, zonedDayRange, zonedIso } from './zone-time'

describe('A12 people sheet', () => {
  it('previews rows and marks problems, then only the clean ones are ready', () => {
    const parsed = parsePeopleCsv(
      'name,email,role,code,class\nAmina,amina@masjid.test,learner,ELM-LEARN,Saturday Year 5\n,bad,teacher,NOPE,\nYusuf,yusuf@masjid.test,learner,ELM-LEARN,Saturday Year 5\n',
    )
    const preview = previewPeopleRows(parsed, { codes: ['ELM-LEARN'], classes: ['Saturday Year 5'] })
    const summary = peoplePreviewSummary(preview)
    assert.equal(summary.total, 3)
    assert.equal(summary.ready, 2)
    assert.equal(summary.blocked, 1)
    assert.ok(preview.blocked[0].problems.some((issue) => issue.column === 'name'))
    assert.ok(preview.blocked[0].problems.some((issue) => issue.column === 'email'))
    assert.ok(preview.blocked[0].problems.some((issue) => issue.column === 'code'))
  })
})

describe('A13 people export', () => {
  it('refuses an empty list and never includes answers', () => {
    assert.equal(peopleExportGuard([]), 'Nobody matches this list, so the download stays still.')
    const csv = peopleCsv([
      { name: 'Amina', email: 'amina@masjid.test', role: 'learner', code: 'ELM-LEARN', joined: '2026-01-01', lastSeen: '2026-02-01', courses: '2', progress: '4', consent: '—' },
    ])
    assert.match(csv, /^name,email,role,code/)
    assert.doesNotMatch(csv, /answer|reflection|password/i)
    assert.match(csv, /Amina/)
  })
})

describe('D05 bulk people', () => {
  it('asks for a confirmation that names the count', () => {
    assert.equal(bulkConfirmLine(23, 'pause'), 'This will pause 23 people.')
    assert.equal(bulkConfirmLine(1, 'give-course'), 'This will give a course to 1 person.')
    assert.deepEqual(parseIdList('1, 2, 2, x'), [1, 2])
    assert.ok(bulkProblems({ action: 'pause', ids: [1] }).some((line) => /reason/i.test(line)))
    assert.equal(bulkProblems({ action: 'give-course', ids: [1], courseId: 4 }).length, 0)
  })
})

describe('D04 retention', () => {
  it('plans every rule from the written table', () => {
    const table = retentionTable()
    assert.ok(table.some((row) => row.id === 'audit-log' && /2 years/.test(row.keep)))
    assert.ok(table.some((row) => row.id === 'watch-sessions' && /12 months/.test(row.keep)))
    const when = new Date('2026-10-04T12:00:00.000Z')
    const plan = planRetention(when)
    const audit = plan.find((row) => row.id === 'audit-log')
    assert.equal(audit?.mode, 'delete')
    assert.ok(audit && new Date(audit.before) < when)
    assert.equal(plan.find((row) => row.id === 'audit-ip')?.mode, 'clear-ip')
    assert.equal(plan.find((row) => row.id === 'closed-portals')?.mode, 'ask-master')
    assert.equal(plan.find((row) => row.id === 'recently-removed')?.mode, 'empty-trash')
  })
})

describe('D03 backup helpers', () => {
  it('compares row and file counts and keeps the lifecycle', () => {
    const before = { users: 4, answers: 10 }
    const after = { users: 4, answers: 10 }
    assert.equal(countsMatch(before, after), true)
    assert.equal(countsMatch(before, { users: 4, answers: 9 }), false)
    const report = buildRestoreReport({
      at: '2026-10-04T12:00:00.000Z',
      source: 'daily/2026-10-04',
      destination: 'scratch',
      before,
      after,
      filesBefore: 3,
      filesAfter: 3,
    })
    assert.equal(report.ok, true)
    assert.equal(lifecyclePrefix(new Date('2026-10-04T12:00:00Z'), 'daily'), 'daily/2026-10-04')
    assert.equal(shouldKeepBackup('daily', 14), true)
    assert.equal(shouldKeepBackup('daily', 15), false)
    assert.equal(shouldKeepBackup('weekly', 56), true)
    assert.equal(shouldKeepBackup('monthly', 400), false)
  })
})

describe('staff times', () => {
  it('writes a British date, 12-hour clock and ET for Toronto', () => {
    assert.equal(DEFAULT_TIME_ZONE, 'America/Toronto')
    assert.equal(staffWhen('2026-10-05T00:36:00.000Z', 'America/Toronto'), '4 October 2026, 8:36 PM ET')
    assert.match(zonedIso('2026-10-05T00:36:00.000Z', 'America/Toronto'), /2026-10-04T20:36:00-04:00/)
    assert.equal(ymdFromParts('2026', '10', '5'), '2026-10-05')
    const range = zonedDayRange('2026-10-04', 'America/Toronto')
    assert.ok(range)
    assert.equal(range.from, '2026-10-04T04:00:00.000Z')
    assert.equal(range.to, '2026-10-05T03:59:59.999Z')
  })
})

describe('D06 health and K03 colours', () => {
  it('does not pretend email went out when the transport is off', () => {
    const off = emailTransportStatus({})
    assert.equal(off.status, 'off')
    assert.match(off.detail, /transport off/)
    assert.equal(snapshotOk([off, { key: 'database', label: 'Database', status: 'ok', detail: 'ok' }]), true)
    assert.equal(snapshotOk([{ key: 'database', label: 'Database', status: 'down', detail: 'no' }]), false)
    assert.equal(classColour('#163633'), '#163633')
    assert.equal(classColour('#fff'), '#0E2A2B')
  })
})
