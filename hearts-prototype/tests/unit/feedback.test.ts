import assert from 'node:assert/strict'
import { test } from 'node:test'
import ExcelJS from 'exceljs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pdfText } from '../pdf-text'
import {
  asDraft,
  assessQuestion,
  assignPseudonyms,
  buildFeedback,
  canNameExport,
  countPhrase,
  feedbackCsv,
  feedbackDemoSeedAllowed,
  feedbackPdf,
  feedbackXlsx,
  formatBritishDay,
  learnerPseudonym,
  parseDay,
  sharingDecision,
  type RawFeedback,
} from '../../src/lib/feedback'

function row(partial: Partial<RawFeedback> & Pick<RawFeedback, 'id' | 'learnerId' | 'text'>): RawFeedback {
  return {
    portalId: 1,
    keepPrivate: false,
    shareWithTeacher: true,
    showImam: false,
    date: '2026-09-02T10:00:00.000Z',
    learnerName: 'Maryam Begum',
    learnerEmail: 'maryam@hearts.test',
    accessCodeId: 7,
    doorNumber: 3,
    door: 'W3 · About Islam',
    seatId: 4,
    seat: '(1) The word is a claim',
    courseId: 2,
    course: 'The sitting',
    talkId: 9,
    talk: 'Tell me about Islam',
    questionId: 11,
    question: 'Where did you meet that line this week?',
    family: 'reflection',
    reply: '',
    ...partial,
  }
}

const shared = row({ id: 'a1', learnerId: 20, text: 'I sat with my uncle after isha.', reply: 'Thank you for writing this down.' })
const later = row({ id: 'a2', learnerId: 5, text: 'I greeted the person on the bus.', date: '2026-09-04T10:00:00.000Z', learnerName: 'Hamza Ali', learnerEmail: 'hamza@hearts.test' })
const kept = row({ id: 'a3', learnerId: 20, text: 'Kept this for my own workbook and nobody else.', keepPrivate: true, shareWithTeacher: false })
const withheld = row({ id: 'a4', learnerId: 8, text: 'I did not offer this to my teacher.', shareWithTeacher: false, keepPrivate: false })
const otherPortal = row({ id: 'a5', portalId: 2, learnerId: 30, text: 'In Leeds I walked to fajr with my brother.', learnerName: 'Yusuf Khan', learnerEmail: 'yusuf@hearts.test' })

test('private answers are counted and never exported, and another portal stays out', () => {
  const built = buildFeedback([shared, later, kept, withheld, otherPortal], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  assert.equal(built.privateCount, 2)
  assert.equal(built.sharedCount, 2)
  const csv = feedbackCsv(built)
  assert.equal(csv.includes('Kept this for my own workbook'), false)
  assert.equal(csv.includes('I did not offer this'), false)
  assert.equal(csv.includes('In Leeds I walked'), false)
  assert.equal(csv.includes('maryam@hearts.test'), false)
  assert.equal(csv.includes('hamza@hearts.test'), false)
  assert.equal(csv.includes('Maryam Begum'), false)
  assert.equal(csv.includes('Hamza Ali'), false)
  assert.match(csv, /I sat with my uncle after isha/)
  assert.match(csv, /Thank you for writing this down/)
})

test('pseudonyms are stable for the same people, whatever the row order', () => {
  const first = buildFeedback([later, shared], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  const second = buildFeedback([shared, later], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  const label = (built: ReturnType<typeof buildFeedback>, id: number) => built.rows.find((item) => item.learnerId === id)?.learner
  assert.equal(label(first, 5), label(second, 5))
  assert.equal(label(first, 20), label(second, 20))
  assert.equal(label(first, 5), 'Learner A')
  assert.equal(label(first, 20), 'Learner B')
  assert.equal(learnerPseudonym(25), 'Learner Z')
  assert.equal(learnerPseudonym(26), 'Learner AA')
  const map = assignPseudonyms([20, 5, 20])
  assert.equal(map.get(5), 'Learner A')
  assert.equal(map.get(20), 'Learner B')
})

test('a named export keeps the name, still drops the email, and a learner cannot ask for names', () => {
  const named = buildFeedback([shared], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, false)
  assert.equal(named.rows[0].learner, 'Maryam Begum')
  assert.equal(feedbackCsv(named).includes('maryam@hearts.test'), false)
  assert.equal(canNameExport('teacher'), true)
  assert.equal(canNameExport('portal-admin'), true)
  assert.equal(canNameExport('master'), true)
  assert.equal(canNameExport('learner'), false)
  assert.equal(canNameExport(null), false)
})

test('portal scoping drops every row that is not this portal, including a shared one', () => {
  const built = buildFeedback([shared, otherPortal], 2, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, false)
  assert.equal(built.sharedCount, 1)
  assert.equal(built.rows[0].text, 'In Leeds I walked to fajr with my brother.')
  assert.equal(feedbackCsv(built).includes('uncle'), false)
})

test('sharing follows the learner’s choice, including an imam task they did not mark private', () => {
  assert.equal(sharingDecision(kept), 'private')
  assert.equal(sharingDecision(withheld), 'private')
  assert.equal(sharingDecision(shared), 'share')
  assert.equal(sharingDecision({ ...shared, shareWithTeacher: false, showImam: true, keepPrivate: false }), 'share')
  assert.equal(sharingDecision({ ...shared, shareWithTeacher: true, showImam: true, keepPrivate: true }), 'private')
})

test('answers group under door, then talk, then question, and a cohort filter holds', () => {
  const otherQuestion = row({ id: 'b1', learnerId: 5, questionId: 12, question: 'Name one ordinary moment.', doorNumber: 5, door: 'W5 · Prayer', talkId: 3, talk: 'Prayer', courseId: 2, course: 'The sitting', text: 'I prayed on time once.', accessCodeId: 8 })
  const built = buildFeedback([shared, later, otherQuestion, kept], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  assert.deepEqual(built.doors.map((door) => door.door), ['W3 · About Islam', 'W5 · Prayer'])
  assert.equal(built.doors[0].talks[0].questions.length, 1)
  assert.equal(built.doors[0].talks[0].questions[0].privateCount, 1)
  assert.equal(built.doors[0].talks[0].questions[0].answers.length, 2)
  const cohort = buildFeedback([shared, otherQuestion], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: 7 }, true)
  assert.equal(cohort.sharedCount, 1)
  assert.equal(cohort.rows[0].text, shared.text)
  const circle = row({ id: 'c1', learnerId: 5, family: 'circle', doorNumber: null, door: '', talkId: null, talk: '', courseId: null, course: '', questionId: null, question: 'A note for the circle', text: 'Tea on Thursday.' })
  const undoor = row({ id: 'n1', learnerId: 20, doorNumber: null, door: '', text: 'No door on this one yet.' })
  const mixed = buildFeedback([circle, undoor], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  const keys = mixed.doorCounts.map((door) => door.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(keys.includes('circle'), true)
  assert.equal(keys.includes('none'), true)
})

test('a yes or no question is weak, and a personal one is left alone', () => {
  const weak = assessQuestion({ prompt: 'Did you like the talk?', talk: 'Tell me about Islam' })
  assert.equal(weak.weak, true)
  assert.match(weak.reasons.join(' '), /yes or no/)
  assert.match(weak.rewrite, /Tell me about Islam/)
  assert.match(weak.rewrite, /way home/)
  assert.match(weak.rewrite, /at work/)
  const scale = assessQuestion({ prompt: 'Pick one', talk: 'Prayer', options: ['Yes', 'No'] })
  assert.equal(scale.weak, true)
  const sound = assessQuestion({ prompt: 'Where did you meet that line this week, in one ordinary moment you can name?', talk: 'Prayer' })
  assert.equal(sound.weak, false)
  const reflective = assessQuestion({ prompt: "What is one thing you have that you could see as Allah's rather than yours?", talk: 'Ar-Rabb' })
  assert.equal(reflective.weak, false)
  const recall = assessQuestion({ prompt: 'What does the Shaykh say is the first sign that light is entering the heart?', talk: 'Al-Nur' })
  assert.equal(recall.weak, true)
  assert.equal(sound.rewrite, '')
  assert.equal(asDraft({ status: 'published', rewrite: sound.rewrite }).status, 'draft')
  assert.equal(countPhrase(2, 6), '2 shared, 6 kept private')
  assert.equal(parseDay('03/10/2026'), '2026-10-03')
  assert.equal(parseDay('3/10/2026'), '2026-10-03')
  assert.equal(parseDay('2026-10-03'), '2026-10-03')
  assert.equal(parseDay('31/02/2026'), null)
  assert.equal(formatBritishDay('2026-10-03'), '03/10/2026')
})

test('the demo seed stays off in production and on a starters load', () => {
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'production' }, false), false)
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'development' }, true), false)
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'development', HEARTS_DEMO: '0' }, false), false)
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'development' }, false), true)
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'development', SERVER_URL: 'https://hearts-demo.example' }, false), true)
  assert.equal(feedbackDemoSeedAllowed({ NODE_ENV: 'development', SERVER_URL: 'https://hearts.example' }, false), false)
})

test('the spreadsheet and the PDF carry the shared answer and leave the private one out', async () => {
  const built = buildFeedback([shared, kept], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, true)
  const book = new ExcelJS.Workbook()
  await book.xlsx.load((await feedbackXlsx(built)) as unknown as ExcelJS.Buffer)
  const sheet = book.getWorksheet('Feedback')
  const text = sheet!.getSheetValues().flat().join(' ')
  assert.match(text, /I sat with my uncle/)
  assert.equal(text.includes('Kept this'), false)
  assert.equal(text.includes('maryam@'), false)
  const pdf = feedbackPdf(built, [], { portal: 'East London', from: '2026-09-01', to: '2026-09-30' }).toString('latin1')
  assert.match(pdf, /^%PDF-1\.4/)
  const shown = pdfText(Buffer.from(pdf, 'latin1'))
  assert.match(shown, /I sat with my uncle/)
  assert.equal(shown.includes('Kept this'), false)
  assert.match(shown, /1 shared, 1 kept private/)
  assert.match(shown, /Anonymised/)
  assert.match(shown, /East London/)
  assert.match(shown, /Teacher reply/)
  assert.match(pdf, /0\.059 0\.231 0\.227/)
  assert.match(pdf, /0\.878 0\.667 0\.271/)
})

test('the PDF embeds Noto Sans, so transliterated Arabic keeps its marks: ū ā ī ḥ ʿ ʾ', () => {
  const marked = row({
    id: 'n1', learnerId: 21, text: 'In Sūrat an-Nūr, al-Raḥmān is named; ʿilm and Qurʾān, and the ḥadīth of Abū Hurayra.',
    talk: 'An-Nūr: the Light', course: 'The Names', learnerName: 'ʿĀʾisha Raḥīm', reply: 'Jazāk Allāhu khayran, ʿĀʾisha.',
  })
  const built = buildFeedback([marked], 1, { door: null, seatId: null, courseId: null, talkId: null, questionId: null, family: '', learnerId: null, from: null, to: null, accessCodeId: null }, false)
  const pdf = feedbackPdf(built, [{ questionKey: built.doors[0].talks[0].questions[0].key, themes: ['Al-Raḥīm and ʿafw came up twice.'], quotes: [] }], { portal: 'Masjid an-Nūr', from: '2026-09-01', to: '2026-09-30' })
  const raw = pdf.toString('latin1')
  assert.match(raw, /\/Subtype \/Type0 \/BaseFont \/HRTSAA\+NotoSans-Regular \/Encoding \/Identity-H/)
  assert.match(raw, /\/FontFile2 \d+ 0 R/)
  assert.equal(/\/BaseFont \/Helvetica/.test(raw), false)
  assert.ok(pdf.length < 250_000, `the subset keeps the file small (${pdf.length} bytes)`)
  const shown = pdfText(pdf).normalize('NFC')
  for (const expected of ['An-Nūr: the Light', 'Masjid an-Nūr', 'Sūrat an-Nūr', 'al-Raḥmān', 'ʿilm', 'Qurʾān', 'ḥadīth', 'Abū', 'ʿĀʾisha', 'Jazāk Allāhu', 'Al-Raḥīm and ʿafw']) {
    assert.ok(shown.includes(expected), `the PDF shows "${expected}"`)
  }
  assert.equal(shown.includes('\uFFFD'), false, 'every glyph maps back to its text')
  let poppler = ''
  try {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'hearts-pdf-')), 'feedback.pdf')
    writeFileSync(file, pdf)
    poppler = execFileSync('pdftotext', ['-enc', 'UTF-8', file, '-'], { encoding: 'utf8' }).normalize('NFC')
  } catch {
    // poppler-utils is not installed here; the ToUnicode read above stands.
  }
  if (poppler) for (const expected of ['An-Nūr', 'al-Raḥmān', 'ʿilm', 'Qurʾān', 'ḥadīth', 'ʿĀʾisha']) assert.ok(poppler.includes(expected), `pdftotext reads "${expected}"`)
})
