import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EXTRACT_TAB,
  emptyCatalogue,
  planSheet,
  type InputRow,
  type SheetCatalogue,
} from '../../src/lib/master-sheet'

function cells(row: number, values: Record<string, string | number | null>): InputRow {
  const mapped: InputRow['cells'] = {}
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === '') continue
    mapped[key] = { text: String(value), raw: value }
  }
  return { row, cells: mapped }
}

function fixture(): SheetCatalogue {
  return emptyCatalogue({
    courses: [{ id: 1, title: 'The Names', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true }],
    units: [{ id: 1, course: 1, title: 'The sitting', order: 1 }],
    lessons: [{
      id: 10, title: 'Al-Nur', course: 1, unit: 1, order: 1, speaker: 'Mikaeel Smith', youtubeId: 'NIR88RRpat4',
      durationSeconds: 120, starterLane: 'trust', transcript: '', transcriptNote: '', provider: 'youtube', vimeoId: '', mediaId: null, inScope: true,
    }],
    tiers: [{
      id: 3, lesson: 10, horsStart: 0, horsEnd: 16, appetiserStart: 0, appetiserEnd: 40,
      hook: 'The light enters the heart', turn: 'The light enters the heart', land: 'The light enters the heart',
      note: '', status: 'draft',
    }],
    points: [],
    resources: [],
    cuts: [],
    seats: [],
  })
}

test('the Extracts tab adds one hors or appetiser per row, and a pass arrives as suggested', () => {
  const catalogue = fixture()
  const created = planSheet({
    talks: [],
    questions: [],
    resources: [],
    extracts: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', extract_type: 'appetiser', start: 70, end: 118, text: '', status: 'approved', hook_text: 'The light enters the heart', land_text: 'The light enters the heart' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', extract_type: 'hors', start: 90, end: 108, text: '', status: 'approved', arc: 'hook' }),
    ],
    errors: [],
  }, catalogue)
  assert.deepEqual(created.errors, [])
  assert.equal(created.ops.filter((op) => op.op === 'extract.create').length, 2)
  const suggested = planSheet({
    talks: [],
    questions: [],
    resources: [],
    extracts: [cells(3, { talk_key: 'yt-NIR88RRpat4', extract_type: 'hors', start: 90, end: 108, text: '', status: 'pass' })],
    errors: [],
  }, catalogue)
  assert.deepEqual(suggested.errors, [])
  const made = suggested.ops.find((op) => op.op === 'extract.create') as { data?: { status?: string } } | undefined
  assert.equal(made?.data?.status, 'suggested')
})

test('the Extracts tab refuses overlap or a time past the talk', () => {
  const catalogue = fixture()
  const overlap = planSheet({
    talks: [],
    questions: [],
    resources: [],
    extracts: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', extract_type: 'hors', start: 50, end: 70, text: '' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', extract_type: 'hors', start: 60, end: 80, text: '' }),
    ],
    errors: [],
  }, catalogue)
  assert.ok(overlap.errors.some((issue) => issue.tab === EXTRACT_TAB && /hors/.test(issue.message)))
  const late = planSheet({
    talks: [],
    questions: [],
    resources: [],
    extracts: [cells(3, { talk_key: 'yt-NIR88RRpat4', extract_type: 'hors', start: 100, end: 140, text: '' })],
    errors: [],
  }, catalogue)
  assert.ok(late.errors.some((issue) => issue.tab === EXTRACT_TAB && /after the talk/.test(issue.message)))
})
