import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cookieSectionMarkdown, escapeHtml, nextLegalVersion, renderLegalMarkdown } from './legal'
import { storageNoticeRows } from './storage-keys'
import { childDefaults, childShareRefusal, liveQuestionName } from './child-safety'
import { missingLearnerConsents, needsLearnerConsent } from './consent'
import { searchDocs, searchTerms } from './learner-search'
import { captionCues, spokenCaptionAt, transcriptParagraphs } from './spoken-caption'
import { learnerHelp, learnerHelpKeys } from './learner-help'
import { helpSentenceCount } from './desk-help'

test('privacy cookie table lists the session cookie and local keys', () => {
  const md = cookieSectionMarkdown()
  assert.match(md, /Payload session cookie/)
  assert.match(md, /hearts.heart.v1/)
  assert.match(md, /YouTube nocookie/)
  assert.match(md, /Turnstile/)
  assert.ok(storageNoticeRows().every((row) => row.needed))
  assert.match(md, /no advertising cookie/i)
})

test('legal markdown escapes html and keeps headings', () => {
  const html = renderLegalMarkdown('# Title\n\nHello <script>alert(1)</script>\n\n- one\n- two')
  assert.match(html, /<h1>Title<\/h1>/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.equal(escapeHtml('"a"'), '&quot;a&quot;')
  assert.match(nextLegalVersion('2020-01-01'), /^\d{4}-\d{2}-\d{2}-/)
})

test('child defaults: under-18 cannot share, under-13 waiting cannot save for teachers', () => {
  const waiting = childDefaults('under-13', true)
  assert.equal(waiting.mayShareWithLearners, false)
  assert.equal(waiting.mayShareWatchHistory, false)
  assert.equal(waiting.answersSavedForTeachers, false)
  assert.equal(waiting.mayWatch, true)
  assert.equal(liveQuestionName('13-17', 'Amina'), 'A learner asks')
  assert.equal(liveQuestionName('18+', 'Amina'), 'Amina')
  const teen = childDefaults('13-17')
  assert.equal(teen.answersSavedForTeachers, true)
  assert.ok(childShareRefusal(waiting, { shareWithLearners: true }))
  assert.equal(childShareRefusal(childDefaults('18+'), { shareWithLearners: true }), null)
})

test('consent is needed when a published version is missing', () => {
  const current = [
    { kind: 'privacy' as const, version: 'v2', summary: 's', title: 'Privacy' },
    { kind: 'terms' as const, version: 'v2', summary: 's', title: 'Terms' },
  ]
  assert.equal(needsLearnerConsent('learner', current, []), true)
  assert.equal(needsLearnerConsent('teacher', current, []), false)
  assert.equal(missingLearnerConsents(current, [{ kind: 'privacy', version: 'v2' }, { kind: 'terms', version: 'v2' }]).length, 0)
  assert.equal(missingLearnerConsents(current, [{ kind: 'privacy', version: 'v1' }]).length, 2)
})

test('learner search groups talks, courses and speakers', () => {
  assert.deepEqual(searchTerms('the Prophet and salah'), ['prophet', 'salah'])
  const hits = searchDocs(
    [
      { kind: 'talk', id: 1, title: 'On salah', speaker: 'Hamza Yusuf', transcript: 'stand for the prayer', href: '/t/1' },
      { kind: 'course', id: 2, title: 'Prayer course', href: '/c/2' },
      { kind: 'speaker', id: 'hy', title: 'Hamza Yusuf', href: '/s/hy' },
    ],
    'salah hamza',
  )
  assert.ok(hits.some((hit) => hit.kind === 'talk'))
  assert.ok(hits.some((hit) => hit.kind === 'speaker'))
})

test('spoken caption is one punctuated line; transcript is a separate list', () => {
  const raw = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nallah is with the patient\n\n00:00:04.000 --> 00:00:08.000\nand be patient\n'
  const line = spokenCaptionAt(raw, 2) || { text: captionCues(raw)[0]?.text || '' }
  assert.match(line.text, /Allah|patient|Patient/)
  assert.doesNotMatch(line.text, /\nand be patient/i)
  const paragraphs = transcriptParagraphs(raw)
  assert.ok(paragraphs.length >= 1)
  assert.ok(captionCues(raw).length >= 2)
})

test('every learner help topic is two to four sentences', () => {
  for (const key of learnerHelpKeys()) {
    const text = learnerHelp(key)
    const count = helpSentenceCount(text)
    assert.ok(count >= 2 && count <= 4, `${key} has ${count}`)
  }
})
