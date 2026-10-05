import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { test } from 'node:test'
import { DRAFT_NOTE } from '../../src/lib/tiers'
import { CIRCLE_COLUMNS } from '../../src/lib/circle-sheet'
import {
  QUESTION_COLUMNS,
  TALK_COLUMNS,
  addNewCoursesToPack,
  buildWorkbook,
  emptyCatalogue,
  parseSheetTime,
  parseYoutubeId,
  planCounts,
  planSheet,
  readWorkbook,
  remapRefs,
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
      durationSeconds: 120, starterLane: 'trust', transcript: '', transcriptNote: '', provider: 'youtube', vimeoId: '', mediaId: null, inScope: true,
    }],
    tiers: [{
      id: 3, lesson: 10, horsStart: 0, horsEnd: 16, appetiserStart: 0, appetiserEnd: 40,
      hook: 'The light enters the heart', turn: 'The light enters the heart', land: 'The light enters the heart',
      note: 'Checked against the captions.', status: 'draft',
    }],
    points: [
      { id: 7, lesson: 10, second: 22, kind: 'reflection', prompt: 'When did you last feel the quiet before suhoor?', options: [], correctOption: '', status: 'draft', draftNote: DRAFT_NOTE, dueDays: null, evidence: '', showImam: false, family: '' },
      { id: 8, lesson: 10, second: 40, kind: 'multiple_choice', prompt: 'What does the Shaykh say is the first sign that light is entering?', options: ['You start to incline towards the next life', 'You feel no more sadness'], correctOption: 'You start to incline towards the next life', status: 'published', draftNote: '', dueDays: null, evidence: '', showImam: false, family: '' },
      { id: 9, lesson: 10, second: 80, kind: 'task', prompt: 'Call a parent this week and ask how they are.', options: [], correctOption: '', status: 'published', draftNote: '', dueDays: null, evidence: '', showImam: false, family: '' },
    ],
    resources: [{ id: 4, lesson: 10, name: 'Further reading', url: 'https://example.com/light', kind: 'link', body: '' }],
    cuts: [{ id: 2, lesson: 10, bestClause: 12, seatId: 5, seatClause: 12, seatPosition: 2, placeholder: true, status: 'suggested', start: 0, course: 1 }],
    seats: [{ id: 5, clause: 12, position: 2 }],
    circle: [
      { id: 21, point: 7, lesson: 10, portal: null, name: 'Amina', body: 'This landed gently for me.', tone: 'warm', length: 'short', origin: 'ai', enabled: true },
      { id: 22, point: 9, lesson: 10, portal: null, name: 'Yusuf', body: 'Did it straight after Maghrib so it would not slip.', tone: 'practical', length: 'short', origin: 'staff', enabled: false },
    ],
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
  assert.deepEqual(planCounts(plan), { create: 0, update: 0, delete: 0, unchanged: rows.talks.length + rows.questions.length + rows.resources.length + rows.circle.length, skipped: 0, errors: 0 })
  assert.equal(rows.circle.length, 2)
  assert.equal(plan.ops.length, 0)
})

test('a multiple-choice row with no question_id is matched before its choices are compared, so re-applying it changes nothing', () => {
  const row = {
    talk_key: 'yt-NIR88RRpat4', type: 'multiple choice', time: 40, status: 'approved',
    text: 'What does the Shaykh say is the first sign that light is entering?',
    choice_1: 'You start to incline towards the next life', choice_2: 'You feel no more sadness', correct_choice: 1,
  }
  const same = planSheet({ talks: [], questions: [cells(3, row)], resources: [], errors: [] }, fixture())
  assert.deepEqual(same.errors, [])
  assert.deepEqual(planCounts(same), { create: 0, update: 0, delete: 0, unchanged: 1, skipped: 0, errors: 0 })
  assert.equal(same.ops.length, 0)

  const edited = planSheet({ talks: [], questions: [cells(3, { ...row, choice_2: 'You feel no sadness at all' })], resources: [], errors: [] }, fixture())
  assert.deepEqual(edited.ops, [{ op: 'point.update', id: 8, patch: { options: ['You start to incline towards the next life', 'You feel no sadness at all'] } }])
})

function withPacks(scope: Partial<SheetCatalogue> = {}): SheetCatalogue {
  return {
    ...fixture(),
    packs: [
      { id: 1, title: 'Starter pack', owner: 'master', portal: null, courses: [1] },
      { id: 2, title: 'Elm pack', owner: 'portal', portal: 9, courses: [] },
      { id: 3, title: 'Leeds pack', owner: 'portal', portal: 4, courses: [] },
      { id: 4, title: 'Twin', owner: 'master', portal: null, courses: [] },
      { id: 5, title: 'Twin', owner: 'master', portal: null, courses: [] },
    ],
    ...scope,
  }
}
const newTalk = (row: number, extra: Record<string, string | number>) => cells(row, { talk_key: `t-${row}`, title: `A fresh sitting ${row}`, course: 'Imported course', speaker: 'Mikaeel Smith', ...extra })

test('pack column: a new course joins the named pack, by name or number, once however many rows name it', () => {
  const plan = planSheet({ talks: [newTalk(3, { pack: 'starter PACK' }), newTalk(4, { pack: 1 })], questions: [], resources: [], errors: [] }, withPacks())
  assert.deepEqual(plan.errors, [])
  const created = plan.ops.find((op) => op.op === 'course.create')!
  const links = plan.ops.filter((op) => op.op === 'pack.add')
  assert.deepEqual(links, [{ op: 'pack.add', pack: 1, course: { temp: created.op === 'course.create' ? created.temp : '' } }])
  assert.ok(plan.changes.some((change) => change.label === 'Starter pack' && /Imported course/.test(change.detail)))
})

test('pack column: an existing course already in the pack changes nothing; one not in it joins', () => {
  const inPack = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', pack: 'Starter pack' })], questions: [], resources: [], errors: [] }, withPacks())
  assert.deepEqual(planCounts(inPack), { create: 0, update: 0, delete: 0, unchanged: 1, skipped: 0, errors: 0 })
  const joins = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', pack: 4 })], questions: [], resources: [], errors: [] }, withPacks())
  assert.deepEqual(joins.ops, [{ op: 'pack.add', pack: 4, course: { id: 1 } }])
  assert.equal(planCounts(joins).update, 1)
  assert.equal(planCounts(joins).unchanged, 0)
})

test('pack column: an unknown pack, a pack name used twice, and another portal’s pack are refused on that cell', () => {
  const plan = planSheet({ talks: [newTalk(3, { pack: 'No such pack' }), newTalk(4, { pack: 'Twin' })], questions: [], resources: [], errors: [] }, withPacks())
  assert.deepEqual(plan.errors.map((issue) => [issue.tab, issue.row, issue.column]), [['Talks', 3, 'pack'], ['Talks', 4, 'pack']])
  assert.match(plan.errors[0].message, /No course pack is called/)
  assert.match(plan.errors[1].message, /More than one pack/)
  assert.equal(plan.ops.length, 0, 'a refused row saves nothing')

  const portal = withPacks({ scopeKind: 'portal', portalId: 9, packPortal: 9, courses: [{ id: 2, title: 'Elm local', origin: 'local', portal: 9, speaker: 'Bushra', inScope: true }] })
  const elm = planSheet({ talks: [cells(3, { talk_key: 'e-1', title: 'An Elm sitting', course: 'Elm local', pack: 'Elm pack' })], questions: [], resources: [], errors: [] }, portal)
  assert.deepEqual(elm.errors, [])
  assert.deepEqual(elm.ops.filter((op) => op.op === 'pack.add'), [{ op: 'pack.add', pack: 2, course: { id: 2 } }])
  for (const name of ['Starter pack', 'Leeds pack']) {
    const refused = planSheet({ talks: [cells(3, { talk_key: 'e-1', title: 'An Elm sitting', course: 'Elm local', pack: name })], questions: [], resources: [], errors: [] }, portal)
    assert.equal(refused.errors[0]?.column, 'pack', name)
    assert.match(refused.errors[0].message, /not one of this portal’s own packs/)
  }
})

test('preview choice: every course the import creates joins the chosen pack, and only a pack this desk may use', () => {
  const catalogue = withPacks()
  const plan = planSheet({ talks: [newTalk(3, {}), cells(4, { talk_key: 't-4', title: 'Another', course: 'Second course' }), cells(5, { talk_key: 'yt-NIR88RRpat4', title: 'Al-Nur, renamed' })], questions: [], resources: [], errors: [] }, catalogue)
  assert.deepEqual(addNewCoursesToPack(plan, catalogue, 4), { added: 2 })
  assert.deepEqual(plan.ops.filter((op) => op.op === 'pack.add').map((op) => (op.op === 'pack.add' ? [op.pack, 'temp' in op.course] : [])), [[4, true], [4, true]])
  assert.deepEqual(addNewCoursesToPack(plan, catalogue, 4), { added: 0 }, 'a second pass adds nothing')

  const portal = withPacks({ scopeKind: 'portal', portalId: 9, packPortal: 9 })
  const local = planSheet({ talks: [cells(3, { talk_key: 'e-1', title: 'An Elm sitting', course: 'New Elm course' })], questions: [], resources: [], errors: [] }, portal)
  assert.match(String((addNewCoursesToPack(local, portal, 1) as { error?: string }).error), /not one of this portal’s own packs/)
  assert.deepEqual(addNewCoursesToPack(local, portal, 2), { added: 1 })
})

test('the pack column is optional, exported blank, and a blank cell leaves packs alone', async () => {
  assert.equal(TALK_COLUMNS[TALK_COLUMNS.length - 1], 'pack')
  const catalogue = withPacks()
  const rows = rowsFromCatalogue(catalogue)
  const plan = planSheet(await readWorkbook(await buildWorkbook(rows)), catalogue)
  assert.equal(plan.ops.length, 0)
})

test('the blank template has five tabs, a note and the header row', async () => {
  const buffer = await templateWorkbook()
  const parsed = await readWorkbook(buffer)
  assert.deepEqual(parsed.errors, [])
  assert.deepEqual(parsed.talks, [])
  assert.deepEqual(parsed.circle, [])
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0])
  assert.deepEqual(book.worksheets.map((sheet) => sheet.name), ['Talks', 'Questions', 'Resources', 'CircleAnswers', 'Speakers'])
  assert.match(String(book.getWorksheet('CircleAnswers')?.getRow(1).getCell(1).value), /never counted/)
  assert.deepEqual((book.getWorksheet('CircleAnswers')?.getRow(2).values as unknown[]).slice(1), [...CIRCLE_COLUMNS])
  assert.equal(TALK_COLUMNS.includes('talk_key'), true)
  assert.equal(QUESTION_COLUMNS.includes('question_id'), true)
})

test('a clause number on a sheet resolves to the working door', () => {
  const created = planSheet({
    talks: [cells(3, { talk_key: 'zakat-talk', title: 'On zakat', course: 'The Names', speaker: 'Mikaeel Smith', jibril_clause: 16 })],
    questions: [],
    resources: [],
    errors: [],
  }, emptyCatalogue({ courses: [{ id: 1, title: 'The Names', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true }] }))
  assert.equal(created.errors.length, 0)
  const cut = created.ops.find((op) => op.op === 'cut.create')
  assert.ok(cut && cut.op === 'cut.create')
  assert.equal(cut.data.bestClause, 16)
  assert.equal(cut.data.clauseFragment, 'W6 · Zakat')
  const moved = planSheet({
    talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', jibril_clause: 22 })],
    questions: [],
    resources: [],
    errors: [],
  }, fixture())
  const update = moved.ops.find((op) => op.op === 'cut.update')
  assert.ok(update && update.op === 'cut.update')
  assert.equal(update.patch.bestClause, 22)
  assert.equal(update.patch.clauseFragment, 'W10 · Believe in Allah')
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
  assert.equal(plan.errors.some((issue) => issue.column === 'hook_text' && /quiz/.test(issue.message)), false)
  assert.ok(plan.errors.some((issue) => issue.column === 'hook_text' && /plain text|markup/i.test(issue.message)))
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

test('course parts take the order they first appear, and a failed row does not keep a number', () => {
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'p1', youtube_id: 'AAAAAAAAAAA', title: 'First sitting', course: 'Fresh', part: 'Opening', order: 1 }),
      cells(4, { talk_key: 'p2', youtube_id: 'BBBBBBBBBBB', title: 'Second sitting', course: 'Fresh', part: 'Middle', order: 1 }),
      cells(5, { talk_key: 'p3', youtube_id: 'CCCCCCCCCCC', title: 'Third sitting', course: 'Fresh', part: 'Opening', order: 2 }),
    ],
    questions: [], resources: [], errors: [],
  }, emptyCatalogue())
  assert.deepEqual(plan.errors, [])
  const units = plan.ops.filter((op) => op.op === 'unit.create')
  assert.deepEqual(units.map((op) => (op.op === 'unit.create' ? [op.title, op.order] : [])), [['Opening', 1], ['Middle', 2]])

  const failed = planSheet({
    talks: [
      cells(3, { talk_key: 'bad', youtube_id: 'EEEEEEEEEEE', title: 'Broken', course: 'Fresh', part: 'Opening', status: 'checked' }),
      cells(4, { talk_key: 'ok', youtube_id: 'DDDDDDDDDDD', title: 'Kept', course: 'Fresh', part: 'Middle' }),
    ],
    questions: [], resources: [], errors: [],
  }, emptyCatalogue())
  const kept = failed.ops.filter((op) => op.op === 'unit.create')
  assert.equal(kept.length, 1)
  assert.equal(kept[0] && kept[0].op === 'unit.create' ? kept[0].title : '', 'Middle')
  assert.equal(kept[0] && kept[0].op === 'unit.create' ? kept[0].order : 0, 1)
})

test('a reimport writes the real part order when every part was stored as 1', () => {
  const catalogue = fixture()
  catalogue.units = [
    { id: 1, course: 1, title: 'Opening', order: 1 },
    { id: 2, course: 1, title: 'Middle', order: 1 },
  ]
  catalogue.lessons = [
    { ...catalogue.lessons[0], unit: 1 },
    { ...catalogue.lessons[0], id: 11, title: 'Second', youtubeId: 'BBBBBBBBBBB', unit: 2, order: 1 },
  ]
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', part: 'Opening' }),
      cells(4, { talk_key: 'yt-BBBBBBBBBBB', part: 'Middle' }),
    ],
    questions: [], resources: [], errors: [],
  }, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.deepEqual(plan.ops.filter((op) => op.op === 'unit.update'), [{ op: 'unit.update', id: 2, patch: { order: 2 } }])
})

test('the sheet status wins, and approving new questions publishes only a blank status', () => {
  const catalogue = fixture()
  const plan = planSheet({
    talks: [],
    questions: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 30, text: 'What line would you carry into the week?', source: 'human' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 50, text: 'What would you leave as a draft on purpose?', source: 'human', status: 'draft' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 70, text: 'What stays hidden from learners here?', source: 'human', status: 'rejected' }),
      cells(6, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 90, text: 'What does published mean on this sheet?', source: 'human', status: 'published' }),
      cells(7, { talk_key: 'yt-NIR88RRpat4', question_id: 7 }),
    ],
    resources: [],
    errors: [],
  }, catalogue, { approveQuestions: true })
  assert.deepEqual(plan.errors, [])
  const created = plan.ops.filter((op) => op.op === 'point.create')
  assert.deepEqual(created.map((op) => (op.op === 'point.create' ? op.data.status : '')), ['published', 'draft', 'rejected', 'published'])
  assert.equal(plan.ops.some((op) => op.op === 'point.update'), false)
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

const noRows = { talks: [], questions: [], resources: [], errors: [] }

test('CircleAnswers: name and length keep their own meaning on that tab', async () => {
  const parsed = await readWorkbook(await buildWorkbook({ circle: [{ talk_key: 'yt-NIR88RRpat4', question_id: 7, name: 'Hana', body: 'Sitting with it.', length: 'short', tone: 'quiet' }] }))
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.circle.length, 1)
  assert.deepEqual(Object.keys(parsed.circle[0].cells).sort(), ['body', 'length', 'name', 'question_id', 'talk_key', 'tone'])
})

test('CircleAnswers: adds, updates, switches off and removes, and only ever touches circle answers', () => {
  const catalogue = fixture()
  const plan = planSheet({
    ...noRows,
    circle: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 9, name: 'Bilal', body: 'Missed the first day, managed the second.', tone: 'honest', length: 'short', origin: 'ai' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', question_id: 7, circle_id: 21, name: 'Amina', body: 'This landed gently for me.', enabled: 'no' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', question_id: 9, circle_id: 22, status: 'delete' }),
      cells(6, { talk_key: 'yt-NIR88RRpat4', question_id: 7, name: 'Amina', body: 'This  landed gently for me.' }),
      cells(7, { youtube_id: 'NIR88RRpat4', question_id: 8, body: 'I went with the first one. It just fitted.' }),
    ],
  }, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.deepEqual(planCounts(plan), { create: 2, update: 1, delete: 1, unchanged: 1, skipped: 0, errors: 0 })
  assert.deepEqual(new Set(plan.ops.map((op) => op.op)), new Set(['circle.create', 'circle.update', 'circle.delete']))
  const task = plan.ops.find((op) => op.op === 'circle.create' && op.point === 9)
  assert.ok(task && task.op === 'circle.create')
  assert.deepEqual(task.data, { name: 'Bilal', body: 'Missed the first day, managed the second.', tone: 'honest', length: 'short', origin: 'ai', enabled: true, portal: undefined })
  assert.equal(task.lesson, 10)
  const anonymous = plan.ops.find((op) => op.op === 'circle.create' && op.point === 8)
  assert.ok(anonymous && anonymous.op === 'circle.create' && anonymous.data.name === 'Someone in the circle')
  const update = plan.ops.find((op) => op.op === 'circle.update')
  assert.ok(update && update.op === 'circle.update')
  assert.deepEqual(update.patch, { enabled: false })
  assert.ok(plan.changes.every((change) => change.tab !== 'CircleAnswers' || change.action !== 'create' || /never counted/.test(change.detail)))
})

test('CircleAnswers: every bad row names the column, and nothing is saved from it', () => {
  const catalogue = fixture()
  catalogue.points.push({ id: 11, lesson: 10, second: 90, kind: 'reflection', prompt: 'Write one line for your workbook.', options: [], correctOption: '', status: 'published', draftNote: '', dueDays: null, evidence: '', showImam: false, family: 'workbook' })
  const plan = planSheet({
    ...noRows,
    questions: [cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 8, status: 'delete' })],
    circle: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, body: 'Take the quiz with me on this one' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', question_id: 4040, body: 'A gentle line about the light.' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', question_id: 11, body: 'A gentle line about the light.' }),
      cells(6, { talk_key: 'yt-NIR88RRpat4', question_id: 8, body: 'A gentle line about the light.' }),
      cells(7, { talk_key: 'someone-else', question_id: 7, body: 'A gentle line about the light.' }),
      cells(8, { talk_key: 'yt-NIR88RRpat4', question_id: 9, circle_id: 21, body: 'A gentle line about the light.' }),
      cells(9, { talk_key: 'yt-NIR88RRpat4', question_id: 7, circle_id: 999, body: 'A gentle line about the light.' }),
      cells(10, { talk_key: 'yt-NIR88RRpat4', question_id: 7, body: 'A gentle line about the light.', tone: 'angry', length: 'huge', enabled: 'maybe' }),
      cells(11, { talk_key: 'yt-NIR88RRpat4', question_id: 7, body: 'A <b>bold</b> line about the light.' }),
    ],
  }, catalogue)
  const circleErrors = plan.errors.filter((issue) => issue.tab === 'CircleAnswers')
  const at = (row: number) => circleErrors.filter((issue) => issue.row === row).map((issue) => issue.column)
  assert.deepEqual(at(3), ['body'])
  assert.match(circleErrors.find((issue) => issue.row === 3)!.message, /quiz/i)
  assert.deepEqual(at(4), ['question_id'])
  assert.deepEqual(at(5), ['question_id'])
  assert.match(circleErrors.find((issue) => issue.row === 5)!.message, /workbook/)
  assert.deepEqual(at(6), ['question_id'])
  assert.match(circleErrors.find((issue) => issue.row === 6)!.message, /deletes that question/)
  assert.deepEqual(at(7), ['talk_key'])
  assert.deepEqual(at(8), ['question_id'])
  assert.deepEqual(at(9), ['circle_id'])
  assert.deepEqual(at(10).sort(), ['enabled', 'length', 'tone'])
  assert.deepEqual(at(11), ['body'])
  assert.equal(plan.ops.filter((op) => op.op.startsWith('circle.')).length, 0)
})

test('CircleAnswers: a portal import adds its own answers on its own courses only', () => {
  const catalogue = fixture()
  catalogue.scopeKind = 'portal'
  catalogue.portalId = 9
  catalogue.circlePortal = 9
  catalogue.courses = catalogue.courses.map((course) => ({ ...course, inScope: course.id === 2 }))
  catalogue.lessons = [
    ...catalogue.lessons.map((lesson) => ({ ...lesson, inScope: false })),
    { ...catalogue.lessons[0], id: 30, course: 2, unit: null, youtubeId: 'ElmLocal001', inScope: true },
  ]
  catalogue.points.push({ ...catalogue.points[0], id: 31, lesson: 30 })
  const plan = planSheet({
    ...noRows,
    circle: [
      cells(3, { question_id: 31, body: 'A small yes from me.' }),
      cells(4, { question_id: 7, body: 'A small yes from me.' }),
    ],
  }, catalogue)
  assert.deepEqual(plan.errors.map((issue) => `${issue.row}:${issue.column}`), ['4:question_id'])
  const created = plan.ops.find((op) => op.op === 'circle.create')
  assert.ok(created && created.op === 'circle.create' && created.data.portal === 9 && created.point === 31)
  assert.equal(rowsFromCatalogue(catalogue).circle.length, 0)
})

test('undo points restored rows at the new ids Postgres gives their parents', () => {
  const moved = new Map([['engagement-points', new Map([[7, 70]])], ['lessons', new Map([[10, 100]])]])
  assert.deepEqual(remapRefs({ point: 7, lesson: 10, portal: 7, name: 'Amina' }, moved), { point: 70, lesson: 100, portal: 7, name: 'Amina' })
  assert.deepEqual(remapRefs({ point: 8, lesson: 11 }, moved), { point: 8, lesson: 11 })
})

test('the example workbook in content/ reads cleanly, circle answers included', async () => {
  const { readFileSync } = await import('node:fs')
  const { readCircleRow } = await import('../../src/lib/circle-sheet')
  for (const name of ['hearts-master-sheet-example.xlsx', 'hearts-master-sheet-template.xlsx']) {
    const parsed = await readWorkbook(readFileSync(new URL(`../../content/${name}`, import.meta.url)))
    assert.deepEqual(parsed.errors, [], name)
    if (name.includes('example')) {
      assert.ok(parsed.talks.length > 5 && parsed.circle.length > 5, name)
      for (const row of parsed.circle) {
        const values = Object.fromEntries(Object.entries(row.cells).map(([key, cell]) => [key, cell.text]))
        assert.ok(readCircleRow(values).ok, JSON.stringify(values))
      }
    } else assert.equal(parsed.circle.length, 0)
  }
})

test('the export writes the door beside the clause, and a door alone or a door in the clause column places the talk', async () => {
  const catalogue = fixture()
  const rows = rowsFromCatalogue(catalogue)
  assert.equal(rows.talks[0].jibril_door, 'W2')
  assert.equal(rows.talks[0].jibril_clause, 12)
  assert.ok(TALK_COLUMNS.indexOf('jibril_door') === TALK_COLUMNS.indexOf('jibril_clause') - 1)

  const plan = (values: Record<string, string | number | null>) => planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', ...values })], questions: [], resources: [], errors: [] }, fixture())

  const sameDoor = plan({ jibril_door: 'W2' })
  assert.deepEqual(sameDoor.errors, [])
  assert.equal(sameDoor.ops.length, 0, 'clause 12 already sits in door 2, so nothing changes')

  for (const door of ['W3', '3', 'w3']) {
    const moved = plan({ jibril_door: door })
    assert.deepEqual(moved.errors, [], door)
    assert.deepEqual(moved.ops, [{ op: 'cut.update', id: 2, patch: { bestClause: 13, clauseFragment: 'W3 · About Islam' } }], `${door} takes door 3's first clause`)
    assert.match(moved.changes[0].detail, /door and clause/)
  }

  const inClauseColumn = plan({ jibril_clause: 'W10' })
  assert.deepEqual(inClauseColumn.errors, [])
  assert.deepEqual(inClauseColumn.ops, [{ op: 'cut.update', id: 2, patch: { bestClause: 22, clauseFragment: 'W10 · Believe in Allah' } }])

  const legacy = plan({ jibril_clause: 19 })
  assert.deepEqual(legacy.ops, [{ op: 'cut.update', id: 2, patch: { bestClause: 19, clauseFragment: 'W3 · About Islam' } }], 'a plain clause still imports as before')

  const both = plan({ jibril_door: 'W3', jibril_clause: 19 })
  assert.deepEqual(both.errors, [])
  assert.deepEqual(both.ops, [{ op: 'cut.update', id: 2, patch: { bestClause: 19, clauseFragment: 'W3 · About Islam' } }])

  const clash = plan({ jibril_door: 'W4', jibril_clause: 19 })
  assert.equal(clash.errors[0]?.column, 'jibril_door')
  assert.match(clash.errors[0].message, /Clause 19 is in door W3, not W4/)
  assert.equal(clash.ops.length, 0)

  for (const bad of ['W21', '0', 'Islam']) {
    const refused = plan({ jibril_door: bad })
    assert.equal(refused.errors[0]?.column, 'jibril_door', bad)
  }
  assert.equal(plan({ jibril_clause: 'W99' }).errors[0]?.column, 'jibril_clause')
})

test('a door alone keeps the clause a seat names inside that door', () => {
  const catalogue = { ...fixture(), seats: [{ id: 5, clause: 12, position: 2 }, { id: 6, clause: 9, position: 1 }] }
  const plan = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', jibril_door: 'W2', ghunya_seat: '9.1' })], questions: [], resources: [], errors: [] }, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.deepEqual(plan.ops, [{ op: 'cut.update', id: 2, patch: { bestClause: 9, clauseFragment: 'W2 · The sitting: How he came and sat with the Messenger', seat: 6 } }])
})

test('a sheet with no door column imports exactly as before', async () => {
  const catalogue = fixture()
  const rows = rowsFromCatalogue(catalogue)
  const talks = rows.talks.map(({ jibril_door: _door, ...rest }) => rest)
  const parsed = await readWorkbook(await buildWorkbook({ ...rows, talks }))
  const plan = planSheet(parsed, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.equal(plan.ops.length, 0)
})
