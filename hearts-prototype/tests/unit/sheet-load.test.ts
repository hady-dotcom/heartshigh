import assert from 'node:assert/strict'
import { test } from 'node:test'
import { draftMultipleChoice } from '../../src/lib/sheet-draft'
import { mulberry32, seedFrom, shuffleChoices } from '../../src/lib/choices'
import { appetiserJoin, spanProblem, tierHorsWarning, tierProblem } from '../../src/lib/tiers'
import { transcriptFromFile } from '../../src/lib/transcript-file'
import {
  RESOURCE_COLUMNS,
  TALK_COLUMNS,
  buildWorkbook,
  emptyCatalogue,
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

function catalogue(): SheetCatalogue {
  return emptyCatalogue({
    courses: [{ id: 1, title: 'The Names', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true }],
    lessons: [{
      id: 10, title: 'Al-Nur', course: 1, unit: null, order: 1, speaker: 'Mikaeel Smith', youtubeId: 'NIR88RRpat4',
      durationSeconds: 500, starterLane: '', transcript: '', transcriptNote: '', provider: '', vimeoId: '', mediaId: null, inScope: true,
    }],
    tiers: [{
      id: 3, lesson: 10, horsStart: 0, horsEnd: 16, appetiserStart: 0, appetiserEnd: 40,
      hook: 'The light enters the heart', turn: 'The light enters the heart', land: 'The light enters the heart', note: '', status: 'draft',
    }],
    points: [{
      id: 7, lesson: 10, second: 22, kind: 'reflection', prompt: 'When did you last feel the quiet before suhoor?',
      options: [], correctOption: '', status: 'draft', draftNote: '', dueDays: null, evidence: '', showImam: false, family: 'popup',
    }],
    resources: [{ id: 4, lesson: 10, name: 'Further reading', url: 'https://example.com/light', kind: 'link', body: '' }],
  })
}

const quote = 'Take the quiz on this line now, the speaker said it plainly.'

test('the kill list does not cut speaker quotes, hook text or transcripts', () => {
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', hook_text: quote, turn_text: quote, land_text: quote, transcript: `${quote} And then the room was quiet.` }),
    ],
    questions: [cells(3, { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 30, text: 'Take the quiz with me on this line', source: 'human', status: 'draft' })],
    resources: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', label: 'A quote', kind: 'quote', body: 'You should sit with what the speaker said.' }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', label: 'Summary', kind: 'summary', body: 'Learners should sit with this talk.' }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', label: 'Guide', kind: 'guide', body: 'Ask what stayed, and what you might tell a friend.' }),
    ],
    errors: [],
  }, catalogue())
  assert.equal(plan.errors.some((issue) => issue.column === 'hook_text' && /never see/.test(issue.message)), false)
  assert.equal(plan.errors.some((issue) => issue.column === 'transcript'), false)
  assert.equal(plan.errors.some((issue) => issue.tab === 'Resources' && issue.row === 3), false)
  assert.ok(plan.errors.some((issue) => issue.column === 'text' && /quiz/.test(issue.message)))
  assert.ok(plan.errors.some((issue) => issue.tab === 'Resources' && issue.row === 4 && /should/.test(issue.message)))
  assert.equal(plan.errors.some((issue) => issue.tab === 'Resources' && issue.row === 5), false)
  const tier = plan.ops.find((op) => op.op === 'tier.update')
  assert.equal(tier && tier.op === 'tier.update' ? tier.patch.hook : '', quote)
})

test('a question without an id is matched, and the same file does not add it twice', () => {
  const row = { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 22, text: 'When did you last feel the quiet before suhoor?', source: 'ai', status: 'draft' }
  const again = planSheet({ talks: [], questions: [cells(3, row)], resources: [], errors: [] }, catalogue())
  assert.equal(planCounts(again).create, 0)
  assert.equal(planCounts(again).update, 0)
  assert.equal(again.errors.length, 0)

  const fresh = { talk_key: 'yt-NIR88RRpat4', type: 'reflection', time: 30, text: 'What line would you carry into the week ahead?', source: 'ai', status: 'draft' }
  const doubled = planSheet({ talks: [], questions: [cells(3, fresh), cells(4, fresh)], resources: [], errors: [] }, catalogue())
  assert.equal(planCounts(doubled).create, 1)
  assert.equal(planCounts(doubled).unchanged, 1)
  assert.equal(doubled.errors.length, 0)

  const clash = planSheet({
    talks: [],
    questions: [cells(3, fresh), cells(4, { ...fresh, status: 'approved' })],
    resources: [],
    errors: [],
  }, catalogue())
  assert.ok(clash.errors.some((issue) => /already adds this question/.test(issue.message)))
  assert.equal(clash.ops.filter((op) => op.op === 'point.create').length, 1)

  const byId = planSheet({ talks: [], questions: [cells(3, { ...row, question_id: 7, text: 'When did you last feel the quiet before fajr?' })], resources: [], errors: [] }, catalogue())
  const update = byId.ops.find((op) => op.op === 'point.update')
  assert.equal(update && update.op === 'point.update' ? update.id : 0, 7)
  assert.equal(planCounts(byId).create, 0)
})

test('hook, turn and land can be three spans whose lengths add up to at most 195 seconds', () => {
  const plan = planSheet({
    talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', hook_in: 0, hook_out: 20, turn_in: 100, turn_out: 140, land_in: 400, land_out: 455 })],
    questions: [], resources: [], errors: [],
  }, catalogue())
  assert.deepEqual(plan.errors, [])
  const tier = plan.ops.find((op) => op.op === 'tier.update')
  assert.ok(tier && tier.op === 'tier.update')
  if (!tier || tier.op !== 'tier.update') return
  assert.deepEqual(tier.patch.appetiserSpans, [
    { role: 'hook', start: 0, end: 20 },
    { role: 'turn', start: 100, end: 140 },
    { role: 'land', start: 400, end: 455 },
  ])
  assert.equal(tier.patch.appetiserEnd, 455)
  const tooLong = planSheet({
    talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', hook_in: 0, hook_out: 100, turn_in: 100, turn_out: 200, land_in: 200, land_out: 296 })],
    questions: [], resources: [], errors: [],
  }, catalogue())
  assert.ok(tooLong.errors.some((issue) => /3 minutes/.test(issue.message)))
  assert.match(spanProblem([{ role: 'hook', start: 10, end: 5 }]) || '', /end after it starts/)

  const spans = [{ start: 10, end: 20 }, { start: 40, end: 50 }]
  assert.deepEqual(appetiserJoin(spans, 5), { action: 'seek', at: 10 })
  assert.deepEqual(appetiserJoin(spans, 15), { action: 'play' })
  assert.deepEqual(appetiserJoin(spans, 20), { action: 'seek', at: 40 })
  assert.deepEqual(appetiserJoin(spans, 30), { action: 'seek', at: 40 })
  assert.deepEqual(appetiserJoin(spans, 45), { action: 'play' })
  assert.deepEqual(appetiserJoin(spans, 50), { action: 'stop' })
})

test("a hors d'oeuvre of 15 to 20 seconds is the usual length, and up to the desk cap is a warning", () => {
  const warned = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', hors_in: 0, hors_out: 30 })], questions: [], resources: [], errors: [] }, catalogue())
  assert.equal(warned.errors.length, 0)
  assert.equal(warned.warnings.length, 1)
  assert.match(warned.warnings[0].message, /between 15 and 20/)
  assert.equal(planCounts(warned).update, 1)

  const refused = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', hors_in: 0, hors_out: 60 })], questions: [], resources: [], errors: [] }, catalogue())
  assert.ok(refused.errors.some((issue) => /45/.test(issue.message)))
  assert.equal(tierProblem({ horsStart: 0, horsEnd: 30, appetiserStart: 0, appetiserEnd: 40 }), null)
  assert.ok(tierHorsWarning({ horsStart: 0, horsEnd: 30 }))

  const tight = catalogue()
  tight.horsMaxSeconds = 25
  const capped = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', hors_in: 0, hors_out: 30 })], questions: [], resources: [], errors: [] }, tight)
  assert.ok(capped.errors.some((issue) => /25/.test(issue.message)))
})

test('notes may contain an equals sign', () => {
  const plan = planSheet({
    talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', notes: 'conf=high' })],
    questions: [cells(3, { talk_key: 'yt-NIR88RRpat4', question_id: 7, notes: 'conf=high' })],
    resources: [],
    errors: [],
  }, catalogue())
  assert.equal(plan.errors.length, 0)
  assert.ok(plan.ops.some((op) => op.op === 'tier.update' && op.patch.note === 'conf=high'))
  const code = planSheet({ talks: [cells(3, { talk_key: 'yt-NIR88RRpat4', notes: 'onclick=alert(1)' })], questions: [], resources: [], errors: [] }, catalogue())
  assert.ok(code.errors.some((issue) => issue.column === 'notes'))
})

test('a transcript can be an uploaded file instead of a cell', () => {
  const plan = planSheet({
    talks: [],
    questions: [],
    resources: [
      cells(3, { talk_key: 'yt-NIR88RRpat4', label: 'Full transcript', kind: 'transcript', media_id: 12 }),
      cells(4, { talk_key: 'yt-NIR88RRpat4', label: 'Handout', kind: 'file', media_id: 9 }),
      cells(5, { talk_key: 'yt-NIR88RRpat4', label: 'Missing file', kind: 'transcript' }),
    ],
    errors: [],
  }, catalogue())
  const created = plan.ops.filter((op) => op.op === 'resource.create')
  assert.equal(created.length, 2)
  assert.equal(created[0].op === 'resource.create' ? created[0].data.kind : '', 'transcript')
  assert.equal(created[0].op === 'resource.create' ? created[0].data.file : 0, 12)
  assert.equal(created[1].op === 'resource.create' ? created[1].data.file : 0, 9)
  assert.ok(plan.errors.some((issue) => issue.column === 'media_id'))
  const parsed = transcriptFromFile(Buffer.from('conf=high\nThe speaker said you should sit.'))
  assert.equal(parsed.ok && parsed.text.includes('conf=high'), true)
  assert.equal(transcriptFromFile(Buffer.from([0x00, 0x01])).ok, false)
})

test('the template note and columns come from the current sheet', async () => {
  const parsed = await readWorkbook(await templateWorkbook())
  assert.equal(parsed.errors.length, 0)
  const book = await templateWorkbook()
  const again = await readWorkbook(book)
  assert.equal(again.talks.length, 0)
  assert.ok(TALK_COLUMNS.includes('hook_in'))
  assert.ok(TALK_COLUMNS.includes('land_out'))
  assert.ok(RESOURCE_COLUMNS.includes('media_id'))
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(book as unknown as ExcelJS.Buffer)
  const note = String(workbook.getWorksheet('Talks')?.getRow(1).getCell(1).value || '')
  const questionNote = String(workbook.getWorksheet('Questions')?.getRow(1).getCell(1).value || '')
  const resourceNote = String(workbook.getWorksheet('Resources')?.getRow(1).getCell(1).value || '')
  assert.match(note, /hook_in/)
  assert.match(note, /kill list is not applied/)
  assert.match(questionNote, /same time and the same text/)
  assert.match(resourceNote, /kind transcript/)
  const headers = workbook.getWorksheet('Talks')?.getRow(2).values
  assert.ok(Array.isArray(headers) && headers.includes('hook_in') && headers.includes('land_out'))
  const example = await buildWorkbook(rowsFromCatalogue(catalogue()))
  const round = planSheet(await readWorkbook(example), catalogue())
  assert.equal(round.errors.length, 0)
  assert.equal(planCounts(round).create, 0)
  assert.equal(planCounts(round).update, 0)
})

test('AI multiple choice does not leave the right answer in slot 2', () => {
  const batch = Array.from({ length: 127 }, (_, index) => shuffleChoices(['Leave it', 'The line I want to hear again', 'Another sitting', 'I did not catch it'], 1, mulberry32(seedFrom(`draft-${index}`))))
  const stuck = batch.filter((item) => item.correctIndex === 1).length
  assert.ok(stuck < 60, `${stuck} of 127 stayed at choice 2`)
  assert.equal(batch[3].choices[batch[3].correctIndex], 'The line I want to hear again')
  const again = shuffleChoices(['Leave it', 'The line I want to hear again', 'Another sitting', 'I did not catch it'], 1, mulberry32(seedFrom('draft-3')))
  assert.deepEqual(again, batch[3])
  const positions = new Set(Array.from({ length: 127 }, (_, index) => draftMultipleChoice(`yt-${index}`).correct))
  assert.ok(positions.size > 1)
  const one = draftMultipleChoice('yt-NIR88RRpat4')
  assert.equal(one.choices[Number(one.correct) - 1], 'The line I want to hear again')
})
