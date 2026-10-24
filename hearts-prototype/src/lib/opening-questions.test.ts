import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { applyTap, freshState, pickSignals, scoreLanes, type LaneDef, type SceneDef } from './heart'
import { PAGE } from './desk-help'
import { LANES, SCALES, SCENES } from './opening-data'
import {
  barelyLine,
  countOpeningPaths,
  duplicateLine,
  flatLaneLine,
  newcomerPicks,
  pullWords,
  reviewOpeningQuestions,
  serveOpeningScenes,
  type RouteSlice,
} from './opening-questions'

const NOW = Date.UTC(2026, 9, 1)

function routed(lanes: LaneDef[]): RouteSlice {
  return {
    lanes,
    d0CutId: 1,
    cuts: lanes.map((lane, index) => ({
      id: index + 1,
      clause: 1,
      lanes: [{ lane: lane.key, weight: 1, confirmed: true }],
      approved: true,
      hasHors: true,
      portalOwn: false,
      starter: { lane: lane.key, role: 'first' as const },
    })),
  }
}

test('two questions stored as 6 become 6 and 7 once the account question is inserted', () => {
  const published = [
    { key: 'extra', order: 1 },
    { key: 'queue', order: 2 },
    { key: 'thumb', order: 3 },
    { key: 'visitor', order: 4 },
    { key: 'news', order: 5 },
    { key: 'doors', order: 6 },
  ]
  const served = serveOpeningScenes(published, { key: 'account', order: 6 }, [{ key: 'portal-q', order: 101 }])
  assert.deepEqual(
    served.map((scene) => scene.key),
    ['extra', 'queue', 'thumb', 'visitor', 'news', 'account', 'doors', 'portal-q'],
  )
  assert.deepEqual(
    served.map((scene) => scene.order),
    [1, 2, 3, 4, 5, 6, 7, 8],
  )
  assert.equal(new Set(served.map((scene) => scene.order)).size, served.length)
})

test('answers that move the same feelings are named, and an empty question barely moves', () => {
  const route = routed(LANES)
  const own: SceneDef = {
    key: 'mine',
    order: 8,
    layout: 'grid4',
    caption: 'A quiet afternoon turns up.',
    subline: '',
    options: [
      { key: 'sit', label: 'Sit with it', nudges: [] },
      { key: 'tell', label: 'Tell a friend', nudges: [] },
    ],
  }
  const review = reviewOpeningQuestions([...SCENES, own], SCALES, route)
  const extra = review.questions.find((question) => question.key === 'extra')
  assert.ok(extra)
  const pair = extra.duplicates.find((group) => group.labels.some((label) => label.startsWith('Treat myself')))
  assert.ok(pair)
  assert.match(duplicateLine(pair.labels, pair.detail), /do the same thing/)
  assert.match(pair.detail, /Lightness and giving/)
  const quiet = review.questions.find((question) => question.key === 'mine')
  assert.equal(quiet?.barely, true)
  assert.match(barelyLine(quiet!.caption), /barely moves any feeling/)
  assert.equal(review.blockedLanes.some((lane) => lane.key === 'guarding-gaze'), true)
})

test('a bank with no patience answer asks for one, in plain words', () => {
  const scenes: SceneDef[] = [
    {
      key: 'only',
      order: 1,
      layout: 'grid4',
      caption: 'A quiet hour.',
      subline: '',
      options: [
        { key: 'sit', label: 'Sit', nudges: [{ scale: 'worry', delta: -1 }] },
        { key: 'walk', label: 'Walk', nudges: [{ scale: 'worry', delta: 1 }] },
      ],
    },
  ]
  const lanes = LANES.filter((lane) => lane.key === 'patience' || lane.key === 'trust')
  const review = reviewOpeningQuestions(scenes, SCALES, routed(lanes))
  assert.equal(review.suggestions.includes('Add an answer that leans to Patience.'), true)
  assert.equal(review.flatLanes.some((lane) => lane.title === 'Patience'), true)
  assert.match(flatLaneLine(review.flatLanes.find((lane) => lane.title === 'Patience')!), /barely moves/)
  assert.doesNotMatch(flatLaneLine(review.flatLanes.find((lane) => lane.title === 'Patience')!), /\d\.\d/)
  assert.equal(review.suggestions.includes('Add an answer that leans to Trust.'), false)
})

test('trying every answer path matches the phone, and the shares add up', () => {
  const scenes = SCENES.filter((scene) => scene.key === 'extra' || scene.key === 'queue')
  const route = routed(LANES)
  const ctx = { ...route, scales: SCALES, now: NOW }
  const fast = countOpeningPaths(scenes, SCALES, route, [], NOW)
  const choices = scenes.map((scene) => ['pass', ...scene.options.filter((option) => !option.crisis).map((option) => option.key)])
  const slow = new Map<string | null, number>()
  const walk = (index: number, state: ReturnType<typeof freshState>) => {
    if (index === scenes.length) {
      const lead = pickSignals(scoreLanes(state, ctx)).L1?.lane ?? null
      slow.set(lead, (slow.get(lead) || 0) + 1)
      return
    }
    for (const choice of choices[index]) walk(index + 1, applyTap(state, scenes[index].key, choice, scenes, SCALES, NOW).state)
  }
  walk(0, freshState('review', 1, NOW))
  assert.equal(fast.paths, choices.reduce((product, row) => product * row.length, 1))
  assert.equal(fast.wins.reduce((sum, row) => sum + row.count, 0), fast.paths)
  const share = fast.wins.reduce((sum, row) => sum + row.share, 0)
  assert.ok(Math.abs(share - 1) < 0.001)
  for (const [lane, count] of slow) {
    assert.equal(fast.wins.find((row) => row.lane === lane)?.count, count, String(lane))
  }
})

test('the full opening is counted without calling a model', () => {
  const started = Date.now()
  const report = countOpeningPaths(SCENES, SCALES, routed(LANES), [], NOW)
  assert.equal(report.paths, 131_250)
  assert.ok(Date.now() - started < 8000, `counting took ${Date.now() - started}ms`)
  assert.equal(report.wins.reduce((sum, row) => sum + row.count, 0), report.paths)
  const source = readFileSync(new URL('./opening-questions.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /openai|chat\/completions|portal-ai|anthropic/i)
})

test('a newcomer pick skips the help-screen answer', () => {
  const picks = newcomerPicks(SCENES)
  assert.equal(picks.visitor, 'phone')
  assert.notEqual(picks.visitor, 'heavy')
  assert.equal(Object.keys(picks).length, SCENES.length)
})

test('a feeling move is said in words, and the raw size stays out of that sentence', () => {
  assert.equal(pullWords(0, 'Trust'), 'barely moves anything')
  assert.equal(pullWords(0.05, 'Trust'), 'barely moves anything')
  assert.equal(pullWords(0.3, 'Trust'), 'a pull to Trust')
  assert.equal(pullWords(-0.3, 'Lightness and giving'), 'a pull away from Lightness and giving')
  assert.equal(pullWords(0.6, 'Trust'), 'a strong pull to Trust')
  assert.doesNotMatch(pullWords(-0.3, 'Trust'), /\d/)
})

test('the simulator help is short and does not say tap', () => {
  assert.doesNotMatch(PAGE.simulator, /\btaps?\b/i)
  assert.match(PAGE.simulator, /new person/)
  assert.match(PAGE.simulator, /feelings/)
})
