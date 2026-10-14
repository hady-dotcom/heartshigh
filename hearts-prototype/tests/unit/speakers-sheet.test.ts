import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import { test } from 'node:test'
import { DRAFT_NOTE } from '../../src/lib/tiers'
import {
  SPEAKER_COLUMNS,
  buildWorkbook,
  emptyCatalogue,
  planCounts,
  planSheet,
  readWorkbook,
  rowsFromCatalogue,
  speakerSheetValues,
  type InputRow,
  type PointRow,
  type SheetCatalogue,
  type SheetOp,
  type SpeakerRow,
} from '../../src/lib/master-sheet'
import rows from '../../src/seed/speakers-data.json'

function cells(row: number, values: Record<string, string | number | null>): InputRow {
  const mapped: InputRow['cells'] = {}
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === '') continue
    mapped[key] = { text: String(value), raw: value }
  }
  return { row, cells: mapped }
}

function speakerRows(): SpeakerRow[] {
  return rows.map((row, index) => ({
    id: index + 1,
    name: row.name,
    honorific: row.honorific,
    displayName: row.displayName,
    slug: row.slug,
    aliases: row.aliases,
    bio: row.bio,
    photoUrl: row.photoUrl,
    links: row.links,
    sources: row.sources,
    status: row.status,
  }))
}

function lesson(id: number, speaker: string, youtubeId: string) {
  return {
    id, title: `Talk ${id}`, course: 1, unit: 1, order: id, speaker, speakerId: null as number | null, youtubeId,
    durationSeconds: 120, starterLane: '', transcript: '', transcriptNote: '', provider: 'youtube', vimeoId: '', mediaId: null, inScope: true,
  }
}

test('the seeded speakers round-trip through the Speakers tab', async () => {
  const speakers = speakerRows()
  assert.equal(speakers.length, 17)
  assert.equal(speakers.filter((speaker) => speaker.status === 'published').length, 8)
  assert.equal(speakers.filter((speaker) => speaker.status === 'draft').length, 9)
  const catalogue = emptyCatalogue({ speakers })
  const parsed = await readWorkbook(await buildWorkbook({ speakers: speakers.map((speaker) => speakerSheetValues(speaker)) }))
  const plan = planSheet(parsed, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.equal(plan.ops.filter((op) => op.op.startsWith('speaker')).length, 0)
  assert.equal(planCounts(plan).update, 0)
  assert.equal(planCounts(plan).create, 0)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await buildWorkbook({}) as never)
  assert.deepEqual((workbook.getWorksheet('Speakers')?.getRow(2).values as unknown[]).slice(1), [...SPEAKER_COLUMNS])
})

test('variant speaker names on a talk map to one speaker and a second import is unchanged', () => {
  const speakers = speakerRows().filter((speaker) => ['mohammad-elshinawy', 'tesneem-alkiek', 'umar-faruq-abd-allah', 'naeem-baig', 'alauddin-elbakri', 'mikaeel-smith'].includes(speaker.slug))
  const catalogue = emptyCatalogue({
    speakers,
    courses: [{ id: 1, title: 'The sitting', origin: 'master', portal: null, speaker: 'Shaykh Mikaeel Smith', speakerId: speakers.find((speaker) => speaker.slug === 'mikaeel-smith')!.id, inScope: true }],
    units: [{ id: 1, course: 1, title: 'Talks', order: 1 }],
    lessons: [
      lesson(1, 'Sh. Mohammad Elshinawy', 'aaaaaaaaaaa'),
      lesson(2, 'Dr. Tesneem Alkiek', 'bbbbbbbbbbb'),
      lesson(3, 'Dr. Umar Faruq Abd-Allah', 'ccccccccccc'),
      lesson(4, 'Ustadh Naeem Baig (Hāfidh)', 'ddddddddddd'),
      lesson(5, 'Alaeddin Albakri', 'eeeeeeeeeee'),
      lesson(6, 'Shaykh Mikaeel Smith', 'fffffffffff'),
    ],
  })
  catalogue.lessons.find((row) => row.id === 6)!.speakerId = speakers.find((speaker) => speaker.slug === 'mikaeel-smith')!.id
  const parsed = {
    talks: catalogue.lessons.map((row, index) => cells(index + 3, { talk_key: `yt-${row.youtubeId}`, speaker: row.speaker })),
    questions: [],
    resources: [],
    errors: [] as [],
  }
  const plan = planSheet(parsed, catalogue)
  assert.deepEqual(plan.errors.map((issue) => issue.message), [])
  const updates = plan.ops.filter((op) => op.op === 'lesson.update')
  assert.equal(updates.length, 5)
  const names = Object.fromEntries(updates.map((op) => [op.id, String(op.patch.speaker)]))
  assert.deepEqual(names, {
    1: 'Mohammad Elshinawy',
    2: 'Tesneem Alkiek',
    3: 'Umar Faruq Abd-Allah',
    4: 'Naeem Baig',
    5: 'Alauddin Elbakri',
  })
  assert.ok(updates.every((op) => typeof op.patch.speakerProfile === 'object' && op.patch.speakerProfile && 'id' in op.patch.speakerProfile))
  assert.equal(plan.ops.some((op) => op.op === 'lesson.update' && op.id === 6), false)
  for (const op of updates) {
    const row = catalogue.lessons.find((lesson) => lesson.id === op.id)!
    row.speaker = String(op.patch.speaker)
    row.speakerId = (op.patch.speakerProfile as { id: number }).id
  }
  const again = planSheet(parsed, catalogue)
  assert.equal(again.ops.filter((op) => op.op === 'lesson.update' || op.op === 'speaker.update').length, 0)
  assert.equal(planCounts(again).update, 0)
})

test('an unknown speaker is left as written, and a known alias is rewritten with no record yet', () => {
  const catalogue = emptyCatalogue({
    courses: [{ id: 1, title: 'The sitting', origin: 'master', portal: null, speaker: '', inScope: true }],
    lessons: [lesson(1, 'Sh. Mohammad Elshinawy', 'aaaaaaaaaaa'), lesson(2, 'Mikaeel Smith', 'bbbbbbbbbbb')],
  })
  const plan = planSheet({
    talks: [
      cells(3, { talk_key: 'yt-aaaaaaaaaaa', speaker: 'Sh. Mohammad Elshinawy' }),
      cells(4, { talk_key: 'yt-bbbbbbbbbbb', speaker: 'Mikaeel Smith' }),
    ],
    questions: [], resources: [], errors: [],
  }, catalogue)
  const first = plan.ops.find((op): op is Extract<SheetOp, { op: 'lesson.update' }> => op.op === 'lesson.update' && op.id === 1)
  assert.equal(first && first.patch.speaker, 'Mohammad Elshinawy')
  assert.equal(first && 'speakerProfile' in first.patch, false)
  assert.equal(plan.ops.some((op) => op.op === 'lesson.update' && op.id === 2), false)
})

function point(partial: Partial<PointRow> & Pick<PointRow, 'id' | 'prompt' | 'kind' | 'status'>): PointRow {
  return { lesson: 1, second: 20, options: [], correctOption: '', draftNote: '', dueDays: null, evidence: '', showImam: false, family: '', ...partial }
}

function questionCatalogue(points: PointRow[]): SheetCatalogue {
  return emptyCatalogue({
    courses: [{ id: 1, title: 'The sitting', origin: 'master', portal: null, speaker: 'Mikaeel Smith', inScope: true }],
    lessons: [lesson(1, 'Mikaeel Smith', 'aaaaaaaaaaa')],
    points,
  })
}

test('a re-import of unchanged questions writes nothing, including equivalent place, evidence and show_imam', () => {
  const quiet = point({ id: 7, prompt: 'How would you rate yourself after this talk?', kind: 'reflection', status: 'published' })
  const catalogue = questionCatalogue([quiet])
  const parsed = {
    talks: [],
    questions: [cells(3, { talk_key: 'yt-aaaaaaaaaaa', question_id: 7, text: quiet.prompt, place: 'popup', evidence: 'none', show_imam: 'no', status: 'approved', source: 'human' })],
    resources: [],
    errors: [] as [],
  }
  const plan = planSheet(parsed, catalogue)
  assert.deepEqual(plan.errors, [])
  assert.equal(plan.ops.filter((op) => op.op.startsWith('point')).length, 0)
  assert.equal(planCounts(plan).unchanged, 1)
})

test('a prompt-only edit patches the prompt and leaves the choices', () => {
  const choice = point({
    id: 8, kind: 'multiple_choice', status: 'published', prompt: 'What does the Shaykh say is the first sign that light is entering?',
    options: ['You start to incline towards the next life', 'You feel no more sadness'], correctOption: 'You start to incline towards the next life',
  })
  const catalogue = questionCatalogue([choice])
  const next = 'What does the Shaykh say is the first sign that light is entering now?'
  const parsed = { talks: [], questions: [cells(3, { talk_key: 'yt-aaaaaaaaaaa', question_id: 8, text: next })], resources: [], errors: [] as [] }
  const plan = planSheet(parsed, catalogue)
  const update = plan.ops.find((op) => op.op === 'point.update')
  assert.ok(update)
  assert.deepEqual(update.patch, { prompt: next })
  choice.prompt = next
  const again = planSheet(parsed, catalogue)
  assert.equal(again.ops.length, 0)
})

test('changing source from ai to human replaces a marker note and a second plan is clean', () => {
  const draft = point({ id: 9, prompt: 'When did you last feel the quiet before suhoor?', kind: 'reflection', status: 'draft', draftNote: DRAFT_NOTE })
  const catalogue = questionCatalogue([draft])
  const parsed = {
    talks: [],
    questions: [cells(3, { talk_key: 'yt-aaaaaaaaaaa', question_id: 9, source: 'human', notes: DRAFT_NOTE, text: draft.prompt })],
    resources: [],
    errors: [] as [],
  }
  const plan = planSheet(parsed, catalogue)
  const update = plan.ops.find((op) => op.op === 'point.update')
  assert.ok(update)
  assert.equal(update.patch.draftNote, 'Written by a person on the master sheet.')
  assert.equal('prompt' in update.patch, false)
  draft.draftNote = String(update.patch.draftNote)
  const again = planSheet(parsed, catalogue)
  assert.equal(again.ops.length, 0)
})

test('a custom note is kept when the source cell still says human', () => {
  const custom = 'Keep the line about the light, it is the one to check.'
  const catalogue = questionCatalogue([point({ id: 10, prompt: 'When did you last feel the quiet before suhoor?', kind: 'reflection', status: 'draft', draftNote: custom })])
  const plan = planSheet({
    talks: [],
    questions: [cells(3, { talk_key: 'yt-aaaaaaaaaaa', question_id: 10, source: 'human', notes: custom })],
    resources: [],
    errors: [],
  }, catalogue)
  assert.equal(plan.ops.length, 0)
})

test('export then import of talks, questions and speakers still makes no changes', async () => {
  const catalogue = emptyCatalogue({
    speakers: speakerRows().slice(0, 1),
    courses: [{ id: 1, title: 'The sitting', origin: 'master', portal: null, speaker: 'Mikaeel Smith', speakerId: null, inScope: true }],
    lessons: [lesson(1, 'Mikaeel Smith', 'aaaaaaaaaaa')],
    points: [point({ id: 7, prompt: 'When did you last feel the quiet before suhoor?', kind: 'reflection', status: 'published' })],
    packs: [{ id: 3, title: 'Jibril sittings', owner: 'master', portal: null, courses: [1] }],
  })
  const exported = rowsFromCatalogue(catalogue)
  const plan = planSheet(await readWorkbook(await buildWorkbook(exported)), catalogue)
  assert.deepEqual(plan.errors, [])
  assert.equal(plan.ops.length, 0)
})
