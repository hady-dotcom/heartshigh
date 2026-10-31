import assert from 'node:assert/strict'
import test from 'node:test'
import { APPROVED_TEACHERS, matchApprovedTeacher, teacherChoices } from './approved-teachers'
import rows from '../seed/speakers-data.json'
import {
  emptyBinPlan,
  filterLibraryTalks,
  hjCode,
  hjLabel,
  moveTalkToBin,
  parseLibraryDoor,
  restoreBinnedTalk,
  sameJoinCodes,
  shownInLibrary,
  talkStatus,
  type JoinCode,
  type LibraryTalk,
} from './library-talks'

const NOW = new Date('2026-10-24T15:00:00.000Z')

function talk(patch: Partial<LibraryTalk> = {}): LibraryTalk {
  return {
    id: 1,
    title: 'The Names, class 20',
    teacher: 'Mikaeel Smith',
    series: 'The Names',
    unit: 'Class 20',
    tags: ['light'],
    also: '',
    door: 10,
    status: 'published',
    durationSeconds: 47 * 60,
    source: 'youtube',
    addedAt: '2026-10-20T12:00:00.000Z',
    binned: false,
    tooShort: false,
    courseId: 10,
    youtubeId: 'NIR88RRpat4',
    vimeoId: '',
    ...patch,
  }
}

const CODES: JoinCode[] = [{ id: 7, code: 'ELM-KEEP', courses: [10, 12] }]

test('the teacher filter is the approved catalogue and nothing outside it', () => {
  assert.equal(APPROVED_TEACHERS.length, rows.length)
  assert.equal(teacherChoices().length, rows.length)
  assert.equal(teacherChoices().some((teacher) => teacher.name === 'Amina Yusuf'), false)
  assert.equal(matchApprovedTeacher('Amina Yusuf'), null)
  assert.equal(matchApprovedTeacher('Sh. Mohammad Elshinawy')?.slug, 'mohammad-elshinawy')
  assert.equal(matchApprovedTeacher('Shaykh Mikaeel Smith')?.name, 'Mikaeel Smith')
  assert.equal(matchApprovedTeacher('Shaykha Muslema Purmul')?.slug, 'muslema-purmul')
  assert.equal(matchApprovedTeacher('Shaykha Sarah Ahmed')?.slug, 'sarah-ahmed')
  assert.equal(teacherChoices().some((teacher) => teacher.name === 'Muslema Purmul'), true)
  assert.equal(teacherChoices().some((teacher) => teacher.name === 'Sarah Ahmed'), true)
  const options = teacherChoices().map((teacher) => teacher.slug)
  const filtered = filterLibraryTalks(
    [talk(), talk({ id: 2, title: 'Circle notes', teacher: 'Amina Yusuf' })],
    { teacher: 'not-a-teacher' },
    NOW,
  )
  assert.deepEqual(filtered, [])
  assert.equal(options.includes('amina-yusuf'), false)
  const only = filterLibraryTalks(
    [talk(), talk({ id: 2, title: 'Circle notes', teacher: 'Amina Yusuf' })],
    { teacher: 'mikaeel-smith' },
    NOW,
  )
  assert.deepEqual(only.map((row) => row.id), [1])
})

test('search covers title, teacher, series, tag and HJ1 to HJ20 door labels', () => {
  const rowsIn = [
    talk(),
    talk({
      id: 2,
      title: 'A quiet khutbah',
      teacher: 'Sh. Mohammad Elshinawy',
      series: 'Manners of the Salaf',
      unit: 'Episode 2',
      tags: ['humility'],
      door: 3,
      source: 'vimeo',
      vimeoId: '76979871',
      youtubeId: '',
      addedAt: '2026-10-24T08:00:00.000Z',
    }),
  ]
  assert.equal(hjCode(1), 'HJ1')
  assert.equal(hjCode(20), 'HJ20')
  assert.match(hjLabel(10), /^HJ10 · /)
  assert.equal(parseLibraryDoor('HJ10'), 10)
  assert.equal(parseLibraryDoor('w3'), 3)
  assert.equal(parseLibraryDoor('Door 20'), 20)
  assert.equal(parseLibraryDoor('HJ21'), null)
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'class 20' }, NOW).map((row) => row.id), [1])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'elshinawy' }, NOW).map((row) => row.id), [2])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'manners of the salaf' }, NOW).map((row) => row.id), [2])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'humility' }, NOW).map((row) => row.id), [2])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'HJ10' }, NOW).map((row) => row.id), [1])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'believe in allah' }, NOW).map((row) => row.id), [1])
  assert.deepEqual(filterLibraryTalks(rowsIn, { q: 'W3' }, NOW).map((row) => row.id), [2])
})

test('filters keep teacher, door, status, length, source and date added', () => {
  const rowsIn = [
    talk(),
    talk({
      id: 2,
      title: 'A quiet khutbah',
      teacher: 'Mohammad Elshinawy',
      series: 'Manners',
      door: 3,
      status: 'draft',
      durationSeconds: 20 * 60,
      source: 'vimeo',
      vimeoId: '76979871',
      youtubeId: '',
      addedAt: '2026-10-24T08:00:00.000Z',
    }),
    talk({
      id: 3,
      title: 'Waiting on words',
      status: 'needs-captions',
      durationSeconds: 90 * 60,
      addedAt: '2025-01-02T00:00:00.000Z',
    }),
  ]
  assert.deepEqual(filterLibraryTalks(rowsIn, { door: 'HJ3', status: 'draft', length: '15-30', source: 'vimeo', added: 'today' }, NOW).map((row) => row.id), [2])
  assert.deepEqual(filterLibraryTalks(rowsIn, { length: '60+' }, NOW).map((row) => row.id), [3])
  assert.deepEqual(filterLibraryTalks(rowsIn, { status: 'needs-captions' }, NOW).map((row) => row.id), [3])
  assert.deepEqual(filterLibraryTalks(rowsIn, { added: 'year' }, NOW).map((row) => row.id), [2, 1])
  assert.equal(talkStatus({ publishState: 'published', transcript: '', transcriptSource: 'none' }), 'needs-captions')
  assert.equal(talkStatus({ publishState: 'draft', transcript: 'The words.', transcriptSource: 'youtube' }), 'draft')
  assert.equal(talkStatus({ publishState: 'published', transcript: 'The words.', transcriptSource: 'upload' }), 'published')
})

test('talks under five minutes, files, and the bin stay out of the library list', () => {
  const hidden = [
    talk({ id: 2, durationSeconds: 64, tooShort: true, title: 'Too short' }),
    talk({ id: 3, source: 'file', youtubeId: '', title: 'A file' }),
    talk({ id: 4, binned: true, title: 'In the bin' }),
    talk({ id: 5, teacher: 'Some channel', title: 'Not approved' }),
  ]
  assert.equal(shownInLibrary(hidden[0]), false)
  assert.equal(shownInLibrary(hidden[1]), false)
  assert.equal(shownInLibrary(hidden[2]), false)
  assert.equal(shownInLibrary(hidden[3]), false)
  assert.deepEqual(filterLibraryTalks([talk(), ...hidden], {}, NOW).map((row) => row.id), [1])
})

test('the bin keeps the same talk, course and join code, and empty bin asks first', () => {
  const moved = moveTalkToBin(talk(), CODES)
  assert.equal(moved.talk.id, 1)
  assert.equal(moved.talk.courseId, 10)
  assert.equal(moved.talk.binned, true)
  assert.equal(sameJoinCodes(CODES, moved.codes), true)
  assert.equal(filterLibraryTalks([moved.talk], {}, NOW).length, 0)
  const back = restoreBinnedTalk(moved.talk, moved.codes)
  assert.equal(back.talk.binned, false)
  assert.equal(back.talk.id, 1)
  assert.equal(sameJoinCodes(CODES, back.codes), true)
  assert.deepEqual(filterLibraryTalks([back.talk], {}, NOW).map((row) => row.id), [1])
  const refused = emptyBinPlan({ ids: [1], codes: CODES, sure: false })
  assert.match(refused.error || '', /Tick Yes/)
  assert.deepEqual(refused.removeIds, [])
  assert.equal(sameJoinCodes(CODES, refused.codes), true)
  const emptied = emptyBinPlan({ ids: [1], codes: CODES, sure: true })
  assert.equal(emptied.error, null)
  assert.deepEqual(emptied.removeIds, [1])
  assert.equal(sameJoinCodes(CODES, emptied.codes), true)
  assert.equal(CODES[0].courses.includes(10), true)
  assert.equal(CODES[0].code, 'ELM-KEEP')
})
