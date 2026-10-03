import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { test } from 'node:test'
import { DRAFT_NOTE } from '../../src/lib/tiers'
import {
  QUESTION_COLUMNS,
  TALK_COLUMNS,
  buildWorkbook,
  emptyCatalogue,
  parseSheetTime,
  parseYoutubeId,
  planCounts,
  planSheet,
  readWorkbook,
  rowsFromCatalogue,
  templateWorkbook,
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
    courses: [
      { id: 1, title: 'The Names', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true },
      { id: 2, title: 'Elm local', origin: 'local', portal: 9, speaker: 'Bushra', inScope: false },
    ],
    units: [{ id: 1, course: 1, title: 'The sitting', order: 1 }],
    lessons: [{
      id: 10, title: 'Al-Nur', course: 1, unit: 1, order: 1, speaker: 'Mikaeel Smith', youtubeId: 'NIR88RRpat4',
      durationSeconds: 120, starterLane: 'trust', transcript: '', inScope: true,
    }],
    tiers: [{
      id: 3, lesson: 10, horsStart: 0, horsEnd: 16, appetiserStart: 0, appetiserEnd: 40,
      hook: 'The light enters the heart', turn: 'The light enters the heart', land: 'The light enters the heart',
      note: 'Checked against the captions.', status: 'draft',
    }],
    points: [
      { id: 7, lesson: 10, second: 22, kind: 'reflection', prompt: 'When did you last feel the quiet before suhoor?', options: [], correctOption: '', status: 'draft', draftNote: DRAFT_NOTE },
      { id: 8, lesson: 10, second: 40, kind: 'multiple_choice', prompt: 'What does the Shaykh say is the first sign that light is entering?', options: ['You start to incline towards the next life', 'You feel no more sadness'], correctOption: 'You start to incline towards the next life', status: 'published', draftNote: '' },
      { id: 9, lesson: 10, second: 80, kind: 'task', prompt: 'Call a parent this week and ask how they are.', options: [], correctOption: '', status: 'published', draftNote: '', dueDays: null, evidence: '', showImam: false, family: '' },
    ],
    resources: [{ id: 4, lesson: 10, name: 'Further reading', url: 'https://example.com/light', kind: 'link' }],
    cuts: [{ id: 2, lesson: 10, bestClause: 12, seatId: 5, seatClause: 12, seatPosition: 2, placeholder: true, status: 'suggested', start: 0, course: 1 }],
    seats: [{ id: 5, clause: 12, position: 2 }],
  })
}

test('times accept seconds, m:ss, h:mm:ss and an Excel time', () => {
  assert.deepEqual(parseSheetTime(90), { ok: true, seconds: 90 })
  assert.deepEqual(parseSheetTime('1:30'), { ok: true, seconds: 90 })
  assert.deepEqual(parseSheetTime('1:02:03'), { ok: true, seconds: 3723 })
  assert.deepEqual(parseSheetTime('00:01:30'), { ok: true, seconds: 90 })
  assert.deepEqual(parseSheetTime(90 / 86400, 'hh:mm:ss'), { ok: true, seconds: 90 })
  assert.equal(parseSheetTime('tomorrow').ok, false)
  assert.equal(parseSheetTime('1:61').ok, false)
  assert.equal(parseYoutubeId('NIR88RRpat4').ok, true)
  assert.equal(parseYoutubeId('https://www.youtube.com/watch?v=NIR88RRpat4').ok, true)
  assert.equal(parseYoutubeId('https://example.com/watch').ok, false)
})

test('round-trip: export then import with no edits makes no changes', async () => {
  const catalogue = fixture()
  const rows = rowsFromCatalogue(catalogue)
  const parsed = await readWorkbook(await buildWorkbook(rows))
  const plan = planSheet(parsed, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.deepEqual(planCounts(plan), { create: 0, update: 0, delete: 0, unchanged: rows.talks.length + rows.questions.length + rows.resources.length, skipped: 0, errors: 0 })
  assert.equal(plan.ops.length, 0)
})

test('the blank template has three tabs, a note and the header row', async () => {
  const parsed = await readWorkbook(await templateWorkbook())
  assert.deepEqual(parsed.errors, [])
  assert.deepEqual(parsed.talks, [])
  assert.equal(TALK_COLUMNS.includes('talk_key'), true)
  assert.equal(QUESTION_COLUMNS.includes('question_id'), true)
})

test('dry-run counts creates, updates and skips', () => {
  const catalogue = fixture()
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', title: 'Al-Nur, the light' }),
      cells(4, { talk_key: 'new-talk', youtube_id: 'abcdefghijk', title: 'A fresh sitting', course: 'The Names', speaker: 'Mikaeel Smith', hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: 'A line from the speaker', turn_text: 'A line from the speaker', land_text: 'A line from the speaker' }),
    ],
    questions: [cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, text: 'When did you last feel the quiet before fajr?' })],
    resources: [],
    errors: [],
  }, catalogue)
  const counts = planCounts(plan)
  assert.equal(counts.update, 2)
  assert.equal(counts.create, 1)
  assert.equal(counts.errors, 0)
  assert.equal(plan.errors.length, 0)
})

test('every error type names the tab, row and column', () => {
  const catalogue = fixture()
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', youtube_id: 'https://vimeo.com/1' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', hook_text: 'Take the quiz on this line now' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', hook_text: 'A line <b>with markup</b> here' }),
      cells(6, { talk_key: 'yt-NIR88RRpat4', hors_out: 'tomorrow' }),
      cells(7, { talk_key: 'yt-NIR88RRpat4', hors_in: 0, hors_out: 10 }),
      cells(8, { talk_key: 'yt-NIR88RRpat4', app_out: 400 }),
      cells(9, { talk_key: 'bad key', title: 'Outside', course: 'Elm local' }),
      cells(10, { talk_key: 'dup', title: 'One' }),
      cells(11, { talk_key: 'dup', title: 'Two' }),
      cells(12, { talk_key: 'yt-NIR88RRpat4', status: 'live', hook_text: 'not the speaker at all' }),
    ],
    questions: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, text: 'Take the quiz with me now' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', question_id: 7, text: 'A second copy of the same id here' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', question_id: 99, text: 'No such question exists here' }),
      cells(6, { talk_key: 'yt-NIR88RRpat4', question_id: 8, time: 500 }),
      cells(7, { talk_key: 'missing-talk', text: 'Where does this question go then', time: 10, type: 'reflection' }),
      cells(8, { talk_key: 'yt-NIR88RRpat4', text: 'A brand new question for the main', time: 10, type: 'puzzle' }),
      cells(9, { talk_key: 'yt-NIR88RRpat4', text: '<img src=x> what stays', time: 10, type: 'reflection' }),
    ],
    resources: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', label: 'Notes', url: 'http://example.com/a', kind: 'link' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', label: 'Script', url: 'javascript:alert(1)', kind: 'link' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', label: 'Odd', url: 'https://example.com/a', kind: 'slide' }),
    ],
    errors: [],
  }, catalogue)
  const columns = new Set(plan.errors.map((issue) => `${issue.tab}:${issue.column}`))
  for (const expected of [
    'Talks:youtube_id', 'Talks:hook_text', 'Talks:hors_out', 'Talks:app_out', 'Talks:course', 'Talks:talk_key',
    'Questions:text', 'Questions:question_id', 'Questions:time', 'Questions:talk_key', 'Questions:type',
    'Resources:url', 'Resources:kind',
  ]) assert.ok(columns.has(expected), `missing ${expected} in ${[...columns].join(', ')}`)
  for (const issue of plan.errors) {
    assert.ok(issue.row > 0, issue.message)
    assert.ok(issue.message.length > 8, issue.message)
    assert.equal(issue.message.includes('undefined'), false)
  }
  assert.ok(plan.errors.some((issue) => issue.column === 'hook_text' && /quiz/.test(issue.message)))
  assert.ok(plan.errors.some((issue) => issue.column === 'text' && /quiz/.test(issue.message)))
  assert.ok(plan.errors.some((issue) => issue.column === 'time' && /after the end/.test(issue.message)))
})

test('a blank cell leaves the field alone and delete is explicit', () => {
  const catalogue = fixture()
  const blank = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', title: 'Al-Nur', speaker: '' })], questions: [], resources: [], errors: [] }, catalogue)
  assert.equal(planCounts(blank).update, 0)
  const removed = planSheet({ talks: [], questions: [cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, status: 'delete' })], resources: [cells(3, { talk_key: 'yt-NIR88RRpat4', label: 'Further reading', status: 'delete' })], errors: [] }, catalogue)
  assert.equal(planCounts(removed).delete, 2)
  assert.ok(removed.ops.some((op) => op.op === 'point.delete' && op.id === 7))
})

test('approving an ai draft publishes it, and a new ai draft stays a draft', () => {
  const catalogue = fixture()
  const plan = planSheet({
    talks: [],
    questions: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, source: 'ai', status: 'approved' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 30, text: 'What line would you carry into the week?', source: 'ai', status: 'draft' }),
    ],
    resources: [],
    errors: [],
  }, catalogue)
  const update = plan.ops.find((op) => op.op === 'point.update')
  const created = plan.ops.find((op) => op.op === 'point.create')
  assert.equal(update && update.op === 'point.update' ? update.patch.status : '', 'published')
  assert.equal(created && created.op === 'point.create' ? created.data.status : '', 'draft')
  assert.match(String(created && created.op === 'point.create' ? created.data.draftNote : ''), /machine|Draft/)
})

test('portal scope refuses another portal and the master library', () => {
  const catalogue = fixture()
  catalogue.scopeKind = 'portal'
  catalogue.portalId = 9
  catalogue.courses[0].inScope = false
  catalogue.courses[1].inScope = true
  catalogue.lessons[0].inScope = false
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', title: 'Stolen' }),
      cells(4, { talk_key: 'elm-1', youtube_id: 'ZZZZZZZZZZZ', title: 'Our own sitting', course: 'The Names' }),
      cells(5, { talk_key: 'elm-2', youtube_id: 'YYYYYYYYYYY', title: 'A local sitting', course: 'Elm local', hors_in: 0, hors_out: 18, app_in: 0, app_out: 50, hook_text: 'A local line for this portal', turn_text: 'A local line for this portal', land_text: 'A local line for this portal' }),
    ],
    questions: [], resources: [], errors: [],
  }, catalogue)
  assert.ok(plan.errors.some((issue) => issue.row === 3 && /outside/i.test(issue.message)))
  assert.ok(plan.errors.some((issue) => issue.row === 4 && /master library/i.test(issue.message)))
  assert.equal(plan.changes.filter((change) => change.action === 'create').length, 1)
})

test('a Google Sheets export with a note row and a time serial still reads', async () => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Questions')
  sheet.addRow(['HEARTS pop-up questions. question_id stays blank for a new one.'])
  sheet.mergeCells(1, 1, 1, QUESTION_COLUMNS.length)
  sheet.addRow([...QUESTION_COLUMNS])
  const row = sheet.addRow(['yt-NIR88RRpat4', 'NIR88RRpat4', null, 'reflection', 30 / 86400, 'What would you carry from this sitting?', null, null, null, null, null, null, null, 'human', 'draft', null])
  row.getCell(5).numFmt = 'hh:mm:ss'
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  const parsed = await readWorkbook(buffer)
  assert.equal(parsed.questions.length, 1)
  assert.equal(parsed.questions[0].row, 3)
  const plan = planSheet({ ...parsed, talks: [], resources: [] }, fixture())
  const created = plan.ops.find((op) => op.op === 'point.create')
  assert.equal(created && created.op === 'point.create' ? created.data.second : null, 30)
  assert.equal(plan.errors.length, 0)
})

test('500 rows are planned quickly', async () => {
  const talks = Array.from({ length: 500 }, (_, index) => ({
    talk_key: `bulk-${index}`, youtube_id: `b${index.toString(36).padStart(10, '0')}`.slice(0, 11), title: `Talk ${index}`, course: 'Bulk',
    hors_in: 0, hors_out: 16, app_in: 0, app_out: 40, hook_text: `Line ${index} from the speaker`, turn_text: `Line ${index} from the speaker`, land_text: `Line ${index} from the speaker`, status: 'draft',
  }))
  const started = Date.now()
  const buffer = await buildWorkbook({ talks })
  const parsed = await readWorkbook(buffer)
  const plan = planSheet(parsed, emptyCatalogue())
  const elapsed = Date.now() - started
  assert.equal(parsed.talks.length, 500)
  assert.equal(planCounts(plan).create, 500)
  assert.ok(elapsed < 5000, `500 rows took ${elapsed}ms`)
})
