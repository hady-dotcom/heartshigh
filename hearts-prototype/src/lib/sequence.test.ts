import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { DOOR_COUNT } from './doors'
import { EXAMPLE_LINES, EXAMPLE_TRANSCRIPT, PARENTING_EXAMPLES } from './parenting-examples'
import { tooShortMessage } from './talk-length'
import {
  HEARTS_TEACHER_CAP,
  SEQUENCE_COPY,
  SEQUENCE_VIDEO_CAP,
  hasHeartsWord,
  hasIslamicWording,
  heartsDoorCodes,
  isCourseSheet,
  isSequencePortal,
  kineticMomentsOn,
  lockMessage,
  minTalkRefusal,
  minTalkSecondsOf,
  moveItem,
  parseCourseSheet,
  parseVideoList,
  plainVimeoId,
  portalShape,
  portalUsesJibrilDoors,
  resumeChoice,
  sequenceBar,
  teacherCapOf,
  teacherCapRefusal,
} from './sequence'
import { buildExportFiles, readZipStore, zipStore } from './sequence-export'
import { FEATURE_KEYS, featuresOf, featureOn } from './features'
import { KINETIC_COPY, PLAYBACK_COPY, SEQUENCE_FEATURE_COPY, sequenceFeatureDefaults } from './sequence-features'
import { saidInTalk, tierProblem } from './tiers'

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
  assert.deepEqual(sequenceBar().map((item) => item.label), ['Home', 'Garden', 'Me'])
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

test('a course sheet keeps modules, public titles, missing films and timed questions', () => {
  assert.equal(plainVimeoId('4.96862893E8'), '496862893')
  assert.equal(plainVimeoId(''), '')
  const sample = [
    'order,module,title,public_title,vimeo_id,vimeo_link,final_video_drive,transcript,callouts',
    '1,Welcome,"1) Internal, name",Public one,496862893,https://vimeo.com/496862893,https://drive.google.com/file/d/abc,https://docs.google.com/document/d/abc,"[171 freetype] How would you describe it? || [90 choice] Which one fits? (One; Two; Three; correct: Two)"',
    '2,Later,40) INTRODUCTION,INTRODUCTION,,,,,"[end freetype] What element interests you?"',
  ].join('\n')
  assert.equal(isCourseSheet(sample), true)
  assert.equal(isCourseSheet('title,url\nHello,https://vimeo.com/123456789'), false)
  const parsed = parseCourseSheet(sample)
  assert.equal(parsed.error, undefined)
  assert.equal(parsed.films.length, 2)
  assert.equal(parsed.films[0].publicTitle, 'Public one')
  assert.equal(parsed.films[0].title, '1) Internal, name')
  assert.equal(parsed.films[0].module, 'Welcome')
  assert.equal(parsed.films[0].vimeoId, '496862893')
  assert.equal(parsed.films[0].callouts.length, 2)
  assert.equal(parsed.films[0].callouts[0].second, 171)
  assert.equal(parsed.films[0].callouts[0].kind, 'question')
  assert.equal(parsed.films[0].callouts[1].kind, 'multiple_choice')
  assert.deepEqual(parsed.films[0].callouts[1].options, ['One', 'Two', 'Three'])
  assert.equal(parsed.films[0].callouts[1].correct, 'Two')
  assert.equal(parsed.films[0].callouts[1].second, 90)
  assert.equal(parsed.films[1].vimeoId, '')
  assert.equal(parsed.films[1].publicTitle, 'INTRODUCTION')
  assert.equal(parsed.films[1].callouts[0].atEnd, true)
  assert.equal(parsed.films[1].callouts[0].second, 0)
  const again = parseCourseSheet(sample)
  assert.equal(again.films.length, 2)
  assert.equal(again.films[0].vimeoId, parsed.films[0].vimeoId)

  const csvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads/videos.csv')
  const course = parseCourseSheet(readFileSync(csvPath, 'utf8'))
  assert.equal(course.films.length, 110)
  assert.deepEqual([...new Set(course.films.map((film) => film.module))].length, 10)
  assert.equal(course.films.filter((film) => !film.vimeoId).length, 2)
  assert.equal(course.films[0].publicTitle, 'Home Learning Introduction 1: Why We Created This Course')
  assert.equal(course.films[0].title, '1) 1.1 Introduction - Why')
  assert.equal(course.films[0].vimeoId, '496862893')
  assert.equal(course.films[0].callouts[0].second, 171)
  assert.match(course.films[0].callouts[0].prompt, /home learning so far/)
  assert.equal(course.films[39].publicTitle, 'INTRODUCTION')
  assert.equal(course.films[39].vimeoId, '')
  assert.equal(course.films[39].callouts[0].atEnd, true)
  const shown = course.films.map((film) => `${film.module} ${film.publicTitle}`).join('\n')
  assert.equal(hasIslamicWording(shown), false)
  assert.equal(hasHeartsWord(shown), false)
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

test('a parenting export opens in Hady Home with the demo code and parent answers', () => {
  const files = buildExportFiles(
    {
      name: 'Guiding Home Learning',
      slug: 'parenting',
      colour: '#1f3a5f',
      accent: '#e07a5f',
      logoUrl: '',
      lockOrder: true,
      note: 'Watch the films in order.',
      joinCode: 'PARENT-DEMO',
      brandName: 'Hady Home',
      opening: [{ prompt: 'How old are your children?', options: ['Under 5', '5 to 7'] }],
      answers: [{ order: 1, phase: 'Phase 1', label: 'Real parent answer, Phase 1 (Jan 2021)', question: 'How would you describe your experience of home learning so far?', text: 'It is busy after school.' }],
    },
    [{ order: 1, title: 'Home Learning Introduction 1: Why We Created This Course', speaker: '', provider: 'vimeo', id: '496862893', hash: '', durationSeconds: 0, hook: '', turn: '', land: '', question: 'How would you describe your experience of home learning so far?', questions: [{ second: 171, prompt: 'How would you describe your experience of home learning so far?' }] }],
  )
  const opened = readZipStore(zipStore(files))
  const bundle = Object.values(opened).join('\n')
  assert.match(opened['README.md'], /Open index\.html/)
  assert.match(opened['README.md'], /PARENT-DEMO/)
  assert.match(opened['README.md'], /Hady Home/)
  assert.match(opened['index.html'], /You are in\. Join code/)
  assert.match(opened['index.html'], /"joinCode":"PARENT-DEMO"/)
  assert.match(opened['index.html'], /id="join-code">Join code PARENT-DEMO/)
  assert.match(opened['index.html'], /id="welcome"/)
  assert.match(opened['index.html'], /How old are your children\?/)
  assert.match(opened['index.html'], /Real parent answer, Phase 1 \(Jan 2021\)/)
  assert.doesNotMatch(opened['index.html'], /<main id="welcome" hidden/)
  assert.doesNotMatch(bundle, /drive\.google|docs\.google|password|api[_-]?key|@hearts\.test/i)
  assert.equal(hasHeartsWord(bundle), false)
  assert.equal(hasIslamicWording(bundle), false)
})

test('kinetic clips default on, and a sequenced course can switch every other part off', () => {
  assert.equal(kineticMomentsOn(null), true)
  assert.equal(kineticMomentsOn({ shape: 'hearts', kineticOn: false }), true)
  assert.equal(kineticMomentsOn(sequence), true)
  assert.equal(kineticMomentsOn({ shape: 'sequence', kineticOn: true }), true)
  assert.equal(kineticMomentsOn({ shape: 'sequence', kineticOn: false }), false)
  const plain = [...Object.values(SEQUENCE_FEATURE_COPY).flatMap((row) => [row.name, row.what]), KINETIC_COPY.name, KINETIC_COPY.what, PLAYBACK_COPY.name, PLAYBACK_COPY.what].join('\n')
  assert.equal(hasIslamicWording(plain), false)
  assert.equal(hasHeartsWord(plain), false)
  assert.doesNotMatch(plain, /appetis/i)
  assert.equal(FEATURE_KEYS.includes('garden'), true)
  assert.equal((FEATURE_KEYS as readonly string[]).includes('hors'), false)
  const fresh = sequenceFeatureDefaults()
  assert.equal(fresh.garden, false)
  assert.equal(featuresOf({ shape: 'sequence' }).garden, false)
  assert.equal(featureOn({ shape: 'sequence', features: { garden: false } }, 'garden'), false)
  assert.equal(featureOn({ shape: 'sequence', features: { garden: true } }, 'garden'), true)
  assert.equal(featureOn({ shape: 'hearts', features: { garden: false } }, 'garden'), true)
  assert.equal(saidInTalk(EXAMPLE_LINES.hook, EXAMPLE_TRANSCRIPT), true)
  assert.equal(saidInTalk(EXAMPLE_LINES.turn, EXAMPLE_TRANSCRIPT), true)
  assert.equal(saidInTalk(EXAMPLE_LINES.land, EXAMPLE_TRANSCRIPT), true)
  assert.equal(tierProblem({ horsStart: 1, horsEnd: 18, appetiserStart: 0, appetiserEnd: 20 }), null)
})
