import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { partListProblems, placeQuestionTimes, placedQuestionProblems, rawQuestionProblems, workbookCardHref } from '../../src/lib/content-sanity'

const FIFTEEN_MIN = 14 * 60 + 59

test('questions past 80% of the film no longer share one second', () => {
  const rows = [
    { id: 2, second: 12 * 60 + 30, prompt: 'What will you leave unsaid?' },
    { id: 3, second: 14 * 60, prompt: 'Who could you ask for help?' },
    { id: 4, second: 14 * 60 + 40, prompt: 'What is one small change this week?' },
  ]
  const raw = rawQuestionProblems(rows, FIFTEEN_MIN)
  assert.equal(raw.some((line) => /share/.test(line)), false)
  const placed = placeQuestionTimes(rows, FIFTEEN_MIN, { pullLate: true })
  assert.equal(placed.length, 3)
  const times = placed.map((row) => row.second)
  assert.equal(new Set(times).size, 3)
  for (const second of times) {
    assert.ok(second >= 0 && second < FIFTEEN_MIN, String(second))
  }
  assert.deepEqual(placedQuestionProblems(rows, FIFTEEN_MIN, { pullLate: true }), [])
  assert.notEqual(times[1], times[2])
  assert.ok(times.every((second) => second <= Math.floor(FIFTEEN_MIN * 0.8)))
})

test('one late question is still brought to 80% of the film', () => {
  const placed = placeQuestionTimes([{ id: 1, second: 227, prompt: 'What stayed with you?' }], 230, { pullLate: true })
  assert.equal(placed[0].second, Math.floor(230 * 0.8))
})

test('a question stored dozens of times is shown once', () => {
  const prompt = 'What is one thing you noticed?'
  const rows = Array.from({ length: 43 }, (_, index) => ({ id: index + 1, second: 11 * 60 + 59, prompt }))
  const raw = rawQuestionProblems(rows, FIFTEEN_MIN)
  assert.ok(raw.some((line) => line.includes('43 times')))
  const placed = placeQuestionTimes(rows, FIFTEEN_MIN, { pullLate: true })
  assert.equal(placed.length, 1)
  assert.equal(placed[0].id, 1)
  assert.deepEqual(placedQuestionProblems(rows, FIFTEEN_MIN), [])
})

test('an early question stays put while later ones step apart', () => {
  const rows = [
    { id: 1, second: 90, prompt: 'First' },
    { id: 2, second: 800, prompt: 'Second' },
    { id: 3, second: 860, prompt: 'Third' },
  ]
  const placed = placeQuestionTimes(rows, FIFTEEN_MIN, { pullLate: true })
  assert.equal(placed[0].second, 90)
  assert.ok(placed[1].second > 90)
  assert.ok(placed[2].second > placed[1].second)
  assert.ok(placed[2].second < FIFTEEN_MIN)
})

test('a sheet film keeps a time that is inside the film', () => {
  const placed = placeQuestionTimes(
    [{ id: 1, second: 800, prompt: 'Still in the film?' }],
    FIFTEEN_MIN,
    { pullLate: false },
  )
  assert.equal(placed[0].second, 800)
})

test('part titles and numbers are checked as a list', () => {
  assert.deepEqual(partListProblems([
    { title: 'Opening', order: 1 },
    { title: 'The middle', order: 2 },
  ]), [])
  const problems = partListProblems([
    { title: 'Opening', order: 1 },
    { title: 'Opening', order: 4 },
    { title: '1234567', order: 3 },
  ])
  assert.ok(problems.some((line) => /used for part/.test(line)))
  assert.ok(problems.some((line) => /file name|stored as number/.test(line)))
})

test('the workbook card href is the portal workbook', () => {
  assert.equal(workbookCardHref('/p/parenting'), '/p/parenting/workbook')
  assert.equal(workbookCardHref('/p/parenting/'), '/p/parenting/workbook')
})

test('learner pages do not fade their text in from invisible', () => {
  const css = readFileSync(new URL('../../src/app/(frontend)/shell-modern.css', import.meta.url), 'utf8')
  const frames = css.match(/@keyframes hh-page-in \{[^}]+\}/)
  assert.ok(frames)
  assert.doesNotMatch(frames[0], /opacity/)
  assert.match(css, /\.route-fade \{[^}]*opacity:\s*1/)
})

test('a signed-in parent is not told they still need an account', () => {
  const workbook = readFileSync(new URL('../../src/screens/app/parent-workbook.tsx', import.meta.url), 'utf8')
  const help = readFileSync(new URL('../../src/lib/page-help.ts', import.meta.url), 'utf8')
  const welcome = readFileSync(new URL('../../src/screens/app/welcome.tsx', import.meta.url), 'utf8')
  const announce = readFileSync(new URL('../../src/components/app/announce-card.tsx', import.meta.url), 'utf8')
  const look = readFileSync(new URL('../../src/app/(frontend)/apple-look.css', import.meta.url), 'utf8')
  assert.match(workbook, /userId \? 'The first ten films/)
  assert.match(workbook, /Your answers stay with your account/)
  const board = readFileSync(new URL('../../src/components/app/parent-workbook.tsx', import.meta.url), 'utf8')
  assert.match(board, /own && !film\.pointId \? <p className="workbook-own"/)
  assert.doesNotMatch(help, /until you have an account/)
  assert.match(welcome, /\{brand \? null : <p className="muted"/)
  assert.doesNotMatch(announce, /#E8F0EE/)
  assert.match(announce, /color: 'var\(--hh-ink\)'/)
  assert.match(look, /height: min\(52dvh, calc\(100dvh - 380px\)\)/)
})
