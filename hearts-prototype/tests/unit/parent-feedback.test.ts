import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  loadParentFeedback,
  loadRealAnswers,
  mergeCalloutQuestions,
  phaseLabel,
  questionsPerFilm,
  sameQuestion,
} from '../../src/lib/parent-feedback'
import { parseCourseSheet } from '../../src/lib/sequence'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

test('every sheet question is a film callout, and the 133 master callouts stay', () => {
  const parsed = parseCourseSheet(readFileSync(path.join(root, 'uploads/videos.csv'), 'utf8'))
  assert.equal(parsed.films.length, 110)
  const before = parsed.films.reduce((sum, film) => sum + film.callouts.length, 0)
  assert.equal(before, 133)
  const real = loadRealAnswers()
  assert.ok(real.length >= 600)
  const merged = mergeCalloutQuestions(
    parsed.films.map((film) => ({ order: film.order, callouts: film.callouts.map((callout) => ({ second: callout.second, prompt: callout.prompt })) })),
    real.map((row) => ({ videoOrder: row.videoOrder, calloutSecond: row.calloutSecond, question: row.question })),
  )
  assert.equal(merged.added, 0)
  const counts = questionsPerFilm(merged.films)
  let total = 0
  for (let order = 1; order <= 110; order++) {
    const count = counts.get(order) || 0
    assert.ok(count >= 1, `film ${order} has a question`)
    total += count
  }
  assert.equal(total, 133)
  for (const row of real) {
    const film = merged.films.find((item) => item.order === row.videoOrder)
    assert.ok(film?.callouts.some((callout) => sameQuestion(callout.prompt, row.question) && callout.second === row.calloutSecond))
  }
  assert.equal(phaseLabel('Phase 1'), 'Real parent answer, Phase 1 (Jan 2021)')
  assert.equal(phaseLabel('Phase 2'), 'Real parent answer, Phase 2 (Mar 2021)')
  const feedback = loadParentFeedback()
  assert.equal(feedback.length, real.length)
  assert.ok(feedback.some((row) => row.phase === 'Phase 1'))
  assert.ok(feedback.some((row) => row.phase === 'Phase 2'))
})
