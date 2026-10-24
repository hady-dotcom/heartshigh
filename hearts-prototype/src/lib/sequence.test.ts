import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DOOR_COUNT } from './doors'
import { EXAMPLE_LINES, PARENTING_EXAMPLES } from './parenting-examples'
import { tooShortMessage } from './talk-length'
import {
  HEARTS_TEACHER_CAP,
  SEQUENCE_COPY,
  SEQUENCE_VIDEO_CAP,
  hasHeartsWord,
  hasIslamicWording,
  heartsDoorCodes,
  isSequencePortal,
  lockMessage,
  minTalkRefusal,
  minTalkSecondsOf,
  moveItem,
  parseVideoList,
  portalShape,
  portalUsesJibrilDoors,
  resumeChoice,
  sequenceBar,
  teacherCapOf,
  teacherCapRefusal,
} from './sequence'
import { buildExportFiles, readZipStore, zipStore } from './sequence-export'

const hearts = { shape: 'hearts' as const }
const sequence = { shape: 'sequence' as const }

test('hearts portals keep the teacher cap, the five minute rule and the twenty doors', () => {
  assert.equal(portalShape(null), 'hearts')
  assert.equal(portalShape({}), 'hearts')
  assert.equal(isSequencePortal(hearts), false)
  assert.equal(teacherCapOf(hearts), HEARTS_TEACHER_CAP)
  assert.equal(teacherCapOf(null), 19)
  assert.equal(minTalkSecondsOf(hearts), 300)
  assert.equal(minTalkSecondsOf({ shape: 'hearts', minTalkSeconds: null }), 300)
  assert.equal(portalUsesJibrilDoors(hearts), true)
  assert.equal(DOOR_COUNT, 20)
  const codes = heartsDoorCodes()
  assert.equal(codes.length, 20)
  assert.equal(codes[0], 'W1')
  assert.equal(codes[19], 'W20')
  assert.equal(teacherCapRefusal(19, 19), 'This portal already has 19 teachers. That is the limit.')
  assert.equal(teacherCapRefusal(18, 19), null)
  assert.equal(minTalkRefusal(64, 300), tooShortMessage(64))
})

test('a sequenced course has its own cap, minimum and no doors', () => {
  assert.equal(isSequencePortal(sequence), true)
  assert.equal(teacherCapOf(sequence), null)
  assert.equal(teacherCapOf({ shape: 'sequence', teacherCap: 4 }), 4)
  assert.equal(teacherCapOf({ shape: 'hearts', teacherCap: 0 }), 0)
  assert.equal(teacherCapRefusal(40, null), null)
  assert.equal(minTalkSecondsOf(sequence), 0)
  assert.equal(minTalkSecondsOf({ shape: 'sequence', minTalkSeconds: 300 }), 300)
  assert.equal(minTalkSecondsOf({ shape: 'hearts', minTalkSeconds: 0 }), 0)
  assert.equal(minTalkRefusal(90, 0), null)
  assert.equal(portalUsesJibrilDoors(sequence), false)
  assert.deepEqual(sequenceBar().map((item) => item.label), ['Home', 'Me'])
})

test('a pasted list, a csv and a reorder keep the film order', () => {
  const lines = Array.from({ length: 120 }, (_, index) => `https://www.youtube.com/watch?v=vid${String(index).padStart(8, '0')}`)
  const parsed = parseVideoList(lines.join('\n'))
  assert.equal(parsed.videos.length, 120)
  assert.equal(parsed.videos[0].id, 'vid00000000')
  assert.equal(parsed.videos[119].provider, 'youtube')
  const csv = `"Talk, with a comma","https://www.youtube.com/watch?v=CyElHdaqkjo","A speaker"\nA second film,https://vimeo.com/123456789/abcdef,Someone`
  const sheet = parseVideoList(`title,url,speaker\n${csv}`)
  assert.equal(sheet.videos.length, 2)
  assert.equal(sheet.videos[0].title, 'Talk, with a comma')
  assert.equal(sheet.videos[0].id, 'CyElHdaqkjo')
  assert.equal(sheet.videos[1].provider, 'vimeo')
  assert.equal(sheet.videos[1].id, '123456789')
  assert.equal(sheet.videos[1].hash, 'abcdef')
  const piped = parseVideoList('How to listen | https://youtu.be/SFnMTHhKdkw')
  assert.equal(piped.videos[0].title, 'How to listen')
  const again = parseVideoList('https://youtu.be/SFnMTHhKdkw\nhttps://www.youtube.com/watch?v=SFnMTHhKdkw')
  assert.equal(again.videos.length, 1)
  assert.equal(again.skipped.length, 1)
  const tooMany = parseVideoList(Array.from({ length: SEQUENCE_VIDEO_CAP + 1 }, (_, index) => `https://youtu.be/vid${String(index).padStart(8, '0')}`).join('\n'))
  assert.equal(tooMany.videos.length, 0)
  assert.match(tooMany.error || '', /200/)
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b'])
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c'])
})

test('lock and resume follow the saved place', () => {
  assert.equal(lockMessage(true, false, 0), null)
  assert.equal(lockMessage(false, false, 2), null)
  assert.equal(lockMessage(true, true, 2), null)
  assert.equal(lockMessage(true, false, 2), 'Watch the previous one first.')
  assert.equal(resumeChoice(3, 100), null)
  assert.equal(resumeChoice(42, 100), 42)
  assert.equal(resumeChoice(99, 100), null)
})

test('sequence words stay plain', () => {
  const copy = Object.values(SEQUENCE_COPY).join('\n')
  assert.equal(hasIslamicWording(copy), false)
  assert.equal(hasHeartsWord(copy), false)
  assert.equal(hasIslamicWording('a kindergarten class'), false)
  assert.equal(PARENTING_EXAMPLES.length, 10)
  for (const film of PARENTING_EXAMPLES) {
    assert.match(film.title, /^Example \d+ · /)
    assert.match(film.youtubeId, /^[\w-]{11}$/)
    assert.equal(hasIslamicWording(`${film.title} ${film.speaker}`), false)
    assert.equal(/\b(?:part|episode|session|class|day)\s*\d+\b/i.test(film.title), false)
    assert.ok(film.durationSeconds >= 300)
  }
  assert.equal(hasIslamicWording(Object.values(EXAMPLE_LINES).join(' ')), false)
})

test('the export zip is a standalone copy with a readme', () => {
  const files = buildExportFiles(
    { name: 'Parenting', slug: 'parenting', colour: '#1f3a5f', accent: '#e07a5f', logoUrl: '', lockOrder: true, note: SEQUENCE_COPY.examples },
    PARENTING_EXAMPLES.map((film, index) => ({
      order: index + 1,
      title: film.title,
      speaker: film.speaker,
      provider: 'youtube' as const,
      id: film.youtubeId,
      hash: '',
      durationSeconds: film.durationSeconds,
      hook: index === 0 ? EXAMPLE_LINES.hook : '',
      turn: index === 0 ? EXAMPLE_LINES.turn : '',
      land: index === 0 ? EXAMPLE_LINES.land : '',
      question: index === 0 ? EXAMPLE_LINES.question : '',
    })),
  )
  const zip = zipStore(files)
  assert.equal(zip.readUInt32LE(0), 0x04034b50)
  const opened = readZipStore(zip)
  assert.match(opened['README.md'], /Open index\.html/)
  assert.match(opened['index.html'], /Listen first\./)
  assert.match(opened['videos.json'], /CyElHdaqkjo/)
  const bundle = Object.values(opened).join('\n')
  assert.equal(hasIslamicWording(bundle), false)
  assert.equal(hasHeartsWord(bundle), false)
  assert.doesNotMatch(bundle, /password|api[_-]?key|@hearts\.test/i)
})
