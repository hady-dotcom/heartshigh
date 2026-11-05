import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { talkSources } from '../../scripts/tier-report'
import { dualExtract } from '../../src/lib/extractor'
import { applySignal, freshState, SIGNAL_DELTA, type Signal } from '../../src/lib/heart'
import { answerCounts, completionVerdict, courseProgress, learnMore, levelOf, parentLevel } from '../../src/lib/nesting'
import { HORS_CAP, HORS_MAX, HORS_MIN, draftTiers, horsCapOf, horsNestingProblem, tierHorsWarning, tierProblem } from '../../src/lib/tiers'

// Leon's rule: the full talk holds the appetiser, the appetiser holds the hors d'oeuvre, and only full talks and
// course questions answered in a course count towards progress.

const drafts = talkSources().map((talk) => ({ talk, draft: draftTiers(talk.raw, talk.seconds) }))

test("Nesting: every starter talk's hors d'oeuvre sits inside its appetiser, and the appetiser inside the talk", () => {
  assert.equal(drafts.length, 31)
  for (const { talk, draft } of drafts) {
    assert.ok(draft, `${talk.id} has no draft`)
    const tier = { horsStart: draft.hors.start, horsEnd: draft.hors.end, appetiserStart: draft.appetiser.start, appetiserEnd: draft.appetiser.end }
    assert.equal(horsNestingProblem(tier), null, `${talk.id}: hors ${draft.hors.start}-${draft.hors.end}, appetiser ${draft.appetiser.start}-${draft.appetiser.end}`)
    assert.equal(tierProblem(tier), null, talk.id)
    if (talk.seconds) assert.ok(draft.appetiser.start >= 0 && draft.appetiser.end <= talk.seconds, `${talk.id} appetiser inside the talk`)
  }
})

test("Nesting: a hors d'oeuvre outside the appetiser, or across two of its cuts, is refused", () => {
  assert.match(tierProblem({ horsStart: 10, horsEnd: 30, appetiserStart: 40, appetiserEnd: 200 }) || '', /inside the appetiser/)
  assert.match(tierProblem({ horsStart: 190, horsEnd: 210, appetiserStart: 40, appetiserEnd: 200 }) || '', /inside the appetiser/)
  assert.equal(tierProblem({ horsStart: 40, horsEnd: 60, appetiserStart: 40, appetiserEnd: 200 }), null)
  const spans = [{ role: 'hook', start: 100, end: 130 }, { role: 'turn', start: 300, end: 340 }, { role: 'land', start: 500, end: 560 }]
  assert.equal(tierProblem({ horsStart: 305, horsEnd: 325, appetiserStart: 100, appetiserEnd: 560, appetiserSpans: spans }), null)
  assert.match(tierProblem({ horsStart: 120, horsEnd: 140, appetiserStart: 100, appetiserEnd: 560, appetiserSpans: spans }) || '', /within one of its cuts/)
})

test("Nesting: the extractor's short clip always plays inside its extended clip", () => {
  const raw = readFileSync(path.join(process.cwd(), 'content/transcripts/fahmy-session6.md'), 'utf8')
  const { cuts, ladder } = dualExtract(raw, [])
  assert.ok(cuts.length > 0)
  for (const cut of cuts) {
    const hors = ladder.find((item) => item.cutId === cut.id && item.kind === 'hors')!
    const appetiser = ladder.find((item) => item.cutId === cut.id && item.kind === 'appetiser')!
    assert.ok(hors.start >= appetiser.start && hors.end <= appetiser.end, `${cut.id}: hors ${hors.start}-${hors.end} in ${appetiser.start}-${appetiser.end}`)
    assert.ok(hors.end - hors.start >= HORS_MIN)
  }
})

test("Nesting: the hors d'oeuvre runs 15 to 30 seconds, the cap defaults to 45 and never drops below 30", () => {
  assert.equal(HORS_MIN, 15)
  assert.equal(HORS_MAX, 30)
  assert.equal(HORS_CAP, 45)
  assert.equal(horsCapOf(undefined), 45)
  assert.equal(horsCapOf(20), 30)
  assert.equal(tierHorsWarning({ horsStart: 0, horsEnd: 30 }), null)
  assert.match(tierHorsWarning({ horsStart: 0, horsEnd: 31 }) || '', /between 15 and 30/)
  assert.match(tierProblem({ horsStart: 0, horsEnd: 14, appetiserStart: 0, appetiserEnd: 100 }) || '', /at least 15/)
})

test('Nesting: slides, typography films and cards are hors level, and each level links up to its own parent', () => {
  for (const kind of ['hors', 'slide', 'film', 'card', 'kinetic', 'cinema', null]) assert.equal(levelOf(kind), 'hors', String(kind))
  assert.equal(levelOf('appetiser'), 'appetiser')
  assert.equal(levelOf('main'), 'full')
  assert.equal(parentLevel('hors'), 'appetiser')
  assert.equal(parentLevel('appetiser'), 'full')
  assert.equal(parentLevel('full'), null)
  const item = { cutId: 7, courseId: 3, lessonId: 41 }
  assert.deepEqual(learnMore(item, 'hors', '/p/x'), { level: 'appetiser', cutId: 7, href: null })
  assert.deepEqual(learnMore(item, 'appetiser', '/p/x'), { level: 'full', cutId: 7, href: '/p/x/course/3?part=41&t=0' })
  assert.equal(learnMore(item, 'full', '/p/x'), null)
})

test('Progress: watching an appetiser or a hors d\'oeuvre of an hour talk never completes it; most of the talk played does', () => {
  const hour = 3600
  assert.equal(completionVerdict({ duration: hour, watched: 20, ended: false }).counts, false)
  assert.equal(completionVerdict({ duration: hour, watched: 180, ended: false }).counts, false)
  // Opening where the appetiser ended and letting it run out is not watching the talk.
  assert.equal(completionVerdict({ duration: hour, watched: 600, ended: true }).counts, false)
  assert.deepEqual(completionVerdict({ duration: hour, watched: 0.8 * hour, ended: false }), { counts: true, percent: 80 })
  assert.deepEqual(completionVerdict({ duration: hour, watched: hour * 2, ended: true }), { counts: true, percent: 100 })
  assert.equal(completionVerdict({ duration: 0, watched: 30, ended: false }).counts, false)
  assert.deepEqual(completionVerdict({ duration: 0, watched: 30, ended: true }), { counts: true, percent: 100 })
  // A finished sitting still counts when the lesson row is longer than the film that actually played.
  assert.deepEqual(completionVerdict({ duration: hour, watched: 0.8 * 1800, ended: true, media: 1800 }), { counts: true, percent: 80 })
  assert.equal(completionVerdict({ duration: hour, watched: 600, ended: true, media: 1800 }).counts, false)
})

test('Progress: answers given while browsing a clip are kept but never count towards a course', () => {
  assert.equal(answerCounts({ cut: 12 }), false)
  assert.equal(answerCounts({ cut: { id: 12 } }), false)
  assert.equal(answerCounts({ cut: null }), true)
  assert.equal(answerCounts({}), true)
  const progress = courseProgress({
    lessonIds: [1, 2],
    completions: [{ lesson: 1 }, { lesson: 99 }],
    pointIds: [10, 11, 12],
    answers: [{ point: 10, cut: null }, { point: 11, cut: 5 }, { point: 50, cut: null }],
  })
  assert.deepEqual([...progress.doneLessons], [1])
  assert.deepEqual([...progress.answeredPoints], [10])
  assert.equal(progress.done, 2)
  assert.equal(progress.total, 5)
})

test('Progress: browsing signals only move the soft "drawn to" lane interest, nothing that counts', () => {
  const start = freshState('east-london', 1, 1000)
  for (const signal of Object.keys(SIGNAL_DELTA) as Signal[]) {
    const after = applySignal(start, [{ lane: 'trust', weight: 1 }], signal, 2000)
    const changed = Object.keys(after).filter((key) => JSON.stringify((after as Record<string, unknown>)[key]) !== JSON.stringify((start as Record<string, unknown>)[key]))
    assert.ok(changed.every((key) => ['u', 'cool', 'updatedAt'].includes(key)), `${signal} changed ${changed.join(', ')}`)
    assert.equal(after.spinePointer, start.spinePointer)
    assert.deepEqual(after.served, start.served)
  }
})
