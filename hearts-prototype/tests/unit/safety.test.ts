import assert from 'node:assert/strict'
import { test } from 'node:test'
import { killListHits, OPENER, SCENES } from '../../src/lib/opening-data'
import { hasMarkup, helpContactProblems, slugProblem, telHref } from '../../src/lib/text-safety'

test('Bug 10: kill-list catches plurals, -ing forms, spelt-out words and look-alike letters', () => {
  const cases: [string, string][] = [
    ['Take our quick **quizzes**', 'quiz'],
    ['Your **scores** are in', 'score'],
    ['A short **testing** moment', 'test'],
    ['Find your **persona**s', 'persona'],
    ['Find your personas', 'persona'],
    ['Our little qu\u0456z', 'quiz'],
    ['This is a q-u-i-z', 'quiz'],
    ['This is a q.u.i.z', 'quiz'],
    ['Your QUIZ awaits', 'quiz'],
    ['What were your results?', 'results'],
    ['Ｑｕｉｚ time', 'quiz'],
    ['A qu\u200biz', 'quiz'],
    ['Self control', 'self-control'],
    ['We\u2019ve analysed your taps', "we've analysed"],
  ]
  for (const [text, word] of cases) assert.ok(killListHits(text).includes(word), `${text} should hit ${word}, got ${killListHits(text).join(', ')}`)
})

test('Bug 10: the seeded scenes and opener stay clean after folding', () => {
  for (const scene of SCENES) {
    const words = [scene.caption, scene.subline, ...scene.options.flatMap((option) => [option.label, option.replyPill || ''])].join(' \n ')
    assert.deepEqual(killListHits(words), [], scene.key)
  }
  assert.deepEqual(killListHits(Object.values(OPENER).join(' ')), [])
})

test('Bug 10: markup in learner-facing words is refused', () => {
  assert.ok(hasMarkup('Our <script>alert(1)</script> caption'))
  assert.ok(hasMarkup('<img src=x onerror=alert(1)>'))
  assert.ok(hasMarkup('&lt;b&gt;'))
  assert.ok(!hasMarkup('A worry turns up at **2am**, uninvited.'))
  assert.ok(!hasMarkup('Tea & biscuits after Maghrib'))
  assert.ok(!hasMarkup('conf=high'))
  assert.ok(!hasMarkup('Notes for the desk: conf=high, source=captions'))
  assert.ok(hasMarkup('onclick=alert(1)'))
  assert.ok(hasMarkup('onerror=alert(1)'))
})

test('Bug 13: help contacts accept tel-safe numbers and https links only, with plain labels', () => {
  assert.deepEqual(helpContactProblems({ label: 'Samaritans', phone: '116 123', url: 'https://www.samaritans.org' }), [])
  assert.deepEqual(helpContactProblems({ label: 'Emergency', phone: '+44 (0)20 7946-0000' }), [])
  assert.ok(helpContactProblems({ label: 'Help', url: 'javascript:alert(document.cookie)' }).length)
  assert.ok(helpContactProblems({ label: 'Help', url: 'http://example.org' }).length)
  assert.ok(helpContactProblems({ label: 'Help', phone: '<b>999</b>' }).length)
  assert.ok(helpContactProblems({ label: '<img src=x onerror=alert(1)>Help', phone: '999' }).length)
  assert.ok(helpContactProblems({ label: 'Nothing to call' }).length)
  assert.equal(telHref('116 123'), 'tel:116123')
})

test('Bug 12: reserved and malformed portal addresses are refused with a clear message', () => {
  for (const slug of ['admin', 'api', 'www', 'master', 'login', 'join', 'p']) assert.match(slugProblem(slug) || '', /reserved|3 to 40/)
  assert.match(slugProblem('admin') || '', /reserved for the site itself/)
  assert.match(slugProblem('../etc') || '', /3 to 40/)
  assert.equal(slugProblem('east-london'), null)
})
