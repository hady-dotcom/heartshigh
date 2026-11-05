import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { NO_EXTRACT, NO_EXTRACT_LABEL, NO_TALK, NO_TALK_LABEL, hasFullTalk, hasLongerExtract, levelSwitchPlan, type LevelItem } from '../../src/lib/level-choice'

const clip = (cutId: number, horsEnd: number, appetiserEnd: number, extra: Partial<LevelItem> = {}): LevelItem => ({
  cutId,
  lessonId: 5,
  courseId: 2,
  youtubeId: 'abc',
  hors: { start: 10, end: horsEnd },
  appetiser: { start: 10, end: appetiserEnd },
  ...extra,
})

test('a longer appetiser is an extract, and the same window is not', () => {
  assert.equal(hasLongerExtract(clip(14, 28, 180)), true)
  assert.equal(hasLongerExtract(clip(126, 28, 28)), false)
  assert.equal(hasLongerExtract(clip(126, 28, 29)), false)
  assert.equal(hasLongerExtract(clip(126, 28, 30)), true)
  assert.equal(hasFullTalk(clip(14, 28, 180)), true)
  assert.equal(hasFullTalk(clip(126, 28, 180, { courseId: 0 })), false)
  assert.equal(hasFullTalk(clip(126, 28, 180, { lessonId: 0 })), false)
})

test('scenic lines are an extract when the clip has no film', () => {
  const scenic = clip(3, 20, 20, { youtubeId: null, scenic: { hook: 'One', turn: 'Two', land: '' } })
  assert.equal(hasLongerExtract(scenic), true)
  assert.equal(hasLongerExtract(clip(3, 20, 20, { youtubeId: null, scenic: { hook: 'Only', turn: '', land: '' } })), false)
})

test('the level tap follows the clip on screen, not the playlist index left behind', () => {
  const first = clip(14, 28, 180)
  const showing = clip(126, 40, 40, { lessonId: 9, courseId: 0 })
  const extract = levelSwitchPlan({ shown: showing, indexed: first, intent: 'appetiser', mode: 'hors' })
  assert.deepEqual(extract, { kind: 'say', message: NO_EXTRACT })
  const talk = levelSwitchPlan({ shown: showing, indexed: first, intent: 'talk', mode: 'hors' })
  assert.deepEqual(talk, { kind: 'say', message: NO_TALK })
  const longer = levelSwitchPlan({
    shown: clip(126, 40, 160, { lessonId: 9, courseId: 4 }),
    indexed: first,
    intent: 'appetiser',
    mode: 'hors',
  })
  assert.deepEqual(longer, { kind: 'switch', level: 'appetiser', cutId: 126, lessonId: 9 })
  const full = levelSwitchPlan({
    shown: clip(126, 40, 160, { lessonId: 9, courseId: 4 }),
    indexed: first,
    intent: 'talk',
    mode: 'hors',
  })
  assert.deepEqual(full, { kind: 'talk', cutId: 126, lessonId: 9 })
})

test('a second tap on the level already showing stays, and a missing clip says so', () => {
  const row = clip(14, 28, 180)
  assert.deepEqual(levelSwitchPlan({ shown: row, indexed: row, intent: 'appetiser', mode: 'appetiser' }), { kind: 'stay' })
  assert.deepEqual(levelSwitchPlan({ shown: row, indexed: row, intent: 'hors', mode: 'hors' }), { kind: 'stay' })
  assert.deepEqual(levelSwitchPlan({ shown: row, indexed: row, intent: 'hors', mode: 'appetiser' }), { kind: 'switch', level: 'hors', cutId: 14, lessonId: 5 })
  assert.equal(levelSwitchPlan({ shown: undefined, indexed: undefined, intent: 'appetiser', mode: 'hors' }).kind, 'say')
})

test('the level controls run from a click as well as a pointerup, and name a missing level', () => {
  const source = readFileSync(new URL('../../src/components/journey/journey.tsx', import.meta.url), 'utf8')
  const footAt = source.indexOf('data-testid="level-steps"')
  const foot = source.slice(footAt, footAt + 1800)
  assert.match(foot, /data-testid="level-minutes"[\s\S]*onPointerUp=\{\(event\) => boardAction\(event, \(\) => requestExtract\(\)\)\}/)
  assert.match(foot, /data-testid="level-minutes"[\s\S]*onClick=\{\(event\) => boardAction\(event, \(\) => requestExtract\(\)\)\}/)
  assert.match(foot, /data-testid="level-lecture"[\s\S]*onPointerUp=\{\(event\) => boardAction\(event, \(\) => requestTalk\(\)\)\}/)
  assert.match(foot, /data-testid="level-lecture"[\s\S]*onClick=\{\(event\) => boardAction\(event, \(\) => requestTalk\(\)\)\}/)
  assert.match(foot, /NO_EXTRACT_LABEL/)
  assert.match(foot, /NO_TALK_LABEL/)
  assert.equal(NO_EXTRACT_LABEL, 'No extract')
  assert.equal(NO_TALK_LABEL, 'No full talk')
})
