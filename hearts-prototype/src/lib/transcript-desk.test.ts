import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTranscript } from './transcript'
import {
  coursesForFilm,
  cuesToTranscript,
  describeTalk,
  downloadVtt,
  filterTalks,
  pushVersion,
  redoVersion,
  replaceInLines,
  rewriteSpoken,
  transcriptSaveNotice,
  undoVersion,
  type TranscriptRow,
} from './transcript-desk'

const VTT = `WEBVTT

00:00:02.000 --> 00:00:06.000
The light of Rokua is something you can sit with.

00:00:08.000 --> 00:00:13.000
But the heart only settles when that light is received.
`

function row(partial: Partial<TranscriptRow> & Pick<TranscriptRow, 'id' | 'title'>): TranscriptRow {
  return {
    speaker: 'Amina',
    seconds: 600,
    lengthLabel: '10:00',
    youtubeId: 'abcdefghijk',
    initial: 'A',
    sourceLabel: 'YouTube captions',
    timingLabel: 'Has times',
    courses: ['Names'],
    status: 'Ready',
    hasTranscript: true,
    timed: true,
    tooShort: false,
    canFetch: false,
    ...partial,
  }
}

test('a talk row names the source, the times and a short film', () => {
  const timed = describeTalk({
    id: 1,
    title: 'Ar-Rabb',
    speaker: 'Mikaeel Smith',
    durationSeconds: 38 * 60,
    youtubeId: 'ECaTWkof57E',
    transcript: VTT,
    transcriptSource: 'youtube',
    transcriptNote: '',
    publishState: 'published',
    courses: ['The Names', 'East London'],
  })
  assert.equal(timed.sourceLabel, 'YouTube captions')
  assert.equal(timed.timingLabel, 'Has times')
  assert.equal(timed.status, 'Ready')
  assert.equal(timed.tooShort, false)
  assert.deepEqual(timed.courses, ['The Names', 'East London'])

  const bare = describeTalk({
    id: 2,
    title: 'How we sit',
    speaker: '',
    durationSeconds: 8,
    youtubeId: '',
    transcript: '',
    transcriptSource: 'none',
    transcriptNote: '',
    publishState: 'published',
    courses: [],
  })
  assert.equal(bare.status, 'No transcript')
  assert.equal(bare.sourceLabel, 'None yet')
  assert.equal(bare.speaker, 'Speaker not named')
  assert.equal(bare.tooShort, true)
  assert.equal(bare.canFetch, false)
  assert.equal(bare.lengthLabel, '0:08')

  const plain = describeTalk({
    id: 3,
    title: 'Notes',
    speaker: 'Amina',
    durationSeconds: 400,
    youtubeId: 'ccccccccccc',
    transcript: 'This is a paragraph of words from the talk without any times at all.',
    transcriptSource: 'upload',
    transcriptNote: '',
    publishState: 'draft',
    courses: ['Circle'],
  })
  assert.equal(plain.sourceLabel, 'Uploaded')
  assert.equal(plain.timed, false)
  assert.equal(plain.status, 'No timing')
  assert.equal(plain.canFetch, false)
})

test('the same film lists every course that uses it', () => {
  const rows = [
    { id: 1, youtubeId: 'abcdefghijk', course: 'Names' },
    { id: 2, youtubeId: 'abcdefghijk', course: 'East London' },
    { id: 3, youtubeId: 'abcdefghijk', course: 'Names' },
    { id: 4, youtubeId: '', course: 'Local' },
  ]
  assert.deepEqual(coursesForFilm('abcdefghijk', 1, rows), ['Names', 'East London'])
  assert.deepEqual(coursesForFilm('', 4, rows), ['Local'])
})

test('search and the three filters narrow the list', () => {
  const talks = [
    row({ id: 1, title: 'Ar-Rabb', speaker: 'Mikaeel', seconds: 2000, tooShort: false, hasTranscript: true, timed: true }),
    row({ id: 2, title: 'How we sit', speaker: 'Amina', seconds: 8, tooShort: true, hasTranscript: false, timed: false, status: 'No transcript', sourceLabel: 'None yet' }),
    row({ id: 3, title: 'Plain notes', speaker: 'Amina', seconds: 400, tooShort: false, hasTranscript: true, timed: false, status: 'No timing', sourceLabel: 'Uploaded' }),
    row({ id: 4, title: 'Short class', speaker: 'Hani', seconds: 90, tooShort: true, hasTranscript: true, timed: true, courses: ['Mercy'] }),
  ]
  assert.deepEqual(filterTalks(talks, { q: 'rabb' }).map((item) => item.id), [1])
  assert.deepEqual(filterTalks(talks, { q: 'mercy' }).map((item) => item.id), [4])
  assert.deepEqual(filterTalks(talks, { missing: true }).map((item) => item.id), [2])
  assert.deepEqual(filterTalks(talks, { untimed: true }).map((item) => item.id), [3])
  assert.deepEqual(filterTalks(talks, { short: true }).map((item) => item.id), [2, 4])
  assert.deepEqual(filterTalks(talks, { missing: true, short: true }).map((item) => item.id), [2, 4])
  assert.deepEqual(filterTalks(talks, { q: 'amina', short: true }).map((item) => item.id), [2])
})

test('find and replace fixes Rokua across the talk and writes a timed file', () => {
  const cues = parseTranscript(VTT).cues
  const replaced = replaceInLines(cues, 'Rokua', 'Ruku')
  assert.equal(replaced.count, 1)
  assert.match(replaced.lines[0].text, /Ruku/)
  assert.equal(replaced.lines[1].text, cues[1].text)
  const stored = cuesToTranscript(replaced.lines, true)
  assert.match(stored, /^WEBVTT/)
  assert.match(stored, /Ruku/)
  assert.doesNotMatch(stored, /Rokua/)
  const file = downloadVtt(stored, 'The Names Class')
  assert.match(file.file, /\.vtt$/)
  assert.match(file.body, /Ruku/)
})

test('a line edit flows into hook, turn and land, and an approved clip is called out', () => {
  const before = parseTranscript(VTT).cues
  const after = replaceInLines(before, 'Rokua', 'Ruku').lines
  const hook = rewriteSpoken(before, after, before[0].text)
  assert.equal(hook.changed, true)
  assert.match(hook.text, /Ruku/)
  const partial = rewriteSpoken(before, after, 'Rokua')
  assert.equal(partial.text, 'Ruku')
  const untouched = rewriteSpoken(before, after, 'A different sentence about the evening.')
  assert.equal(untouched.changed, false)
  const inside = rewriteSpoken(before, after, 'Rokuab')
  assert.equal(inside.changed, false)
  assert.match(
    transcriptSaveNotice({ changedLines: 1, flowed: 1, approved: 1, skipped: 0 }),
    /An approved clip changed/,
  )
  assert.match(transcriptSaveNotice({ changedLines: 2, flowed: 2, approved: 2, skipped: 0 }), /2 approved clips/)
})

test('saves are kept and undo restores the previous words', () => {
  const first = pushVersion(null, 'one', 'Uploaded file', '2026-10-14T00:00:00.000Z')
  const second = pushVersion(first, 'two', 'Saved', '2026-10-14T00:01:00.000Z')
  assert.equal(second.history.length, 2)
  assert.equal(second.redo.length, 0)
  const undone = undoVersion(second, 'three', '2026-10-14T00:02:00.000Z')
  assert.ok(undone)
  assert.equal(undone?.text, 'two')
  assert.equal(undone?.edits.history.length, 1)
  assert.equal(undone?.edits.redo[0].text, 'three')
  const redone = redoVersion(undone!.edits, undone!.text, '2026-10-14T00:03:00.000Z')
  assert.equal(redone?.text, 'three')
  assert.equal(undoVersion({ history: [], redo: [] }, 'three', '2026-10-14T00:04:00.000Z'), null)
})
