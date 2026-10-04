import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import {
  applyCheckin,
  applySignal,
  applyTap,
  bestCut,
  buildFeed,
  clipUsable,
  freshState,
  markServed,
  pickSignals,
  routeFeed,
  scoreLanes,
  spine,
  spineStart,
  upgradeSpine,
  type CutInfo,
  type HeartState,
  type RouteContext,
  type SceneDef,
} from './heart'
import { LANES, SCALES, SCENES } from './opening-data'
import { STARTERS } from '../seed/starters-data'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 3, 9)

/** A portal like the seeded one: a placeholder hors cut for every starter, a spine of approved cuts, and a few lane-tagged ones. */
function context(extra: CutInfo[] = []): RouteContext {
  let id = 1000
  const cuts: CutInfo[] = []
  for (const row of STARTERS) {
    cuts.push({ id: id++, clause: null, lanes: row.lane === 'default' ? [] : [{ lane: row.lane, weight: 1, confirmed: true }], approved: false, hasHors: true, portalOwn: false, starter: { lane: row.lane, role: row.role } })
  }
  for (let clause = 1; clause <= 20; clause += 1) {
    cuts.push({ id: clause, clause, lanes: clause === 2 ? [{ lane: 'company', weight: 1, confirmed: true }] : [], approved: true, hasHors: true, portalOwn: false })
  }
  cuts.push({ id: 27, clause: 27, lanes: [{ lane: 'trust', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false })
  cuts.push({ id: 22, clause: 22, lanes: [{ lane: 'trust', weight: 0.6, confirmed: true }, { lane: 'talking', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false })
  cuts.push(...extra)
  const d0 = cuts.find((cut) => cut.starter?.lane === 'default' && cut.starter.role === 'first')!
  return { lanes: LANES, scales: SCALES, cuts, d0CutId: d0.id, now: NOW }
}

function play(taps: [string, string][], at = NOW) {
  let state = freshState('east-london', 1, at)
  for (const [scene, option] of taps) state = applyTap(state, scene, option, SCENES, SCALES, at).state
  return state
}

const near = (actual: number | undefined, expected: number) => assert.ok(Math.abs((actual ?? NaN) - expected) <= 0.001, `${actual} is not ${expected}`)
const scoreOf = (state: HeartState, ctx: RouteContext, lane: string) => scoreLanes(state, ctx).find((row) => row.lane === lane)?.score

const WORKED: [string, string][] = [['extra', 'tuck'], ['queue', 'replay'], ['thumb', 'one-more'], ['visitor', 'spin'], ['news', 'one'], ['doors', 'calmer']]

test('1. the worked example in 3.5 gives trust 0.86, the others 0.2525, and a feed of four trust clips then three from the spine', () => {
  const ctx = context()
  const state = play(WORKED)
  near(state.s.worry, -0.6)
  near(state.c.worry, 0.7)
  near(state.s.belonging, 0)
  near(scoreOf(state, ctx, 'trust'), 0.86)
  for (const lane of ['patience', 'habits', 'lightness']) near(scoreOf(state, ctx, lane), 0.2525)
  near(scoreOf(state, ctx, 'company'), 0.05)
  const route = routeFeed(state, ctx)
  assert.equal(route.L1, 'trust')
  assert.equal(route.L2, null)
  assert.deepEqual(route.items.map((item) => item.laneKey), ['trust', 'trust', 'trust', 'trust', null, null, null])
  assert.deepEqual(route.items.slice(4).map((item) => item.door), [1, 2, 3], 'the spine walks the doors, one talk per door')
  assert.deepEqual(route.items.slice(4).map((item) => item.clause), [1, 2, 13])
  assert.equal(route.spinePointer, 3)
})

test('2. the day-2 example in section 4 gives trust 0.92, company 0.545, and a refill that alternates them', () => {
  const ctx = context()
  let state = play(WORKED)
  const first = routeFeed(state, ctx)
  state = markServed(state, first.items, first.spinePointer, NOW)
  const trust = [{ lane: 'trust', weight: 1 }]
  const nextDay = NOW + DAY
  state = applySignal(state, trust, 'watched90', nextDay)
  state = applySignal(state, trust, 'watched90', nextDay)
  state = applySignal(state, trust, 'skip-under-3', nextDay)
  state = applySignal(state, [{ lane: 'company', weight: 1 }], 'watch-full', nextDay)
  state = applyCheckin(state, [{ scale: 'belonging', delta: -1 }], SCALES, nextDay)
  near(state.u.trust, 0.1)
  near(state.u.company, 0.35)
  near(state.s.belonging, -0.3)
  near(state.c.belonging, 0.9)
  const dayTwo = { ...ctx, now: nextDay }
  near(scoreOf(state, dayTwo, 'trust'), 0.92)
  near(scoreOf(state, dayTwo, 'company'), 0.545)
  const refill = routeFeed(state, dayTwo)
  assert.equal(refill.L2, 'company')
  assert.deepEqual(refill.items.slice(0, 4).map((item) => item.laneKey), ['trust', 'company', 'trust', 'company'])
  assert.ok(refill.items.slice(4).every((item) => item.laneKey === null && (item.door || 0) >= 4), 'the spine carries on from door 4')
})

test('3. the desire guard: an opening option that nudges desire changes nothing', () => {
  const scenes: SceneDef[] = [{ key: 'probe', order: 1, layout: 'grid4', caption: 'x', subline: 'y', options: [{ key: 'a', label: 'A', nudges: [{ scale: 'desire', delta: -1 }] }] }]
  const state = applyTap(freshState('p', 1), 'probe', 'a', scenes, SCALES).state
  assert.equal(state.s.desire, undefined)
  assert.equal(state.c.desire, undefined)
  const checkin = applyCheckin(freshState('p', 1), [{ scale: 'desire', delta: -1 }], SCALES)
  near(checkin.s.desire, -0.3)
})

test('4. guarding the gaze appears only when the learner has opted in and its scale has signal', () => {
  const ctx = context([{ id: 5000, clause: 31, lanes: [{ lane: 'guarding-gaze', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false }])
  const state = applyCheckin(play(WORKED), [{ scale: 'desire', delta: -1 }, { scale: 'desire', delta: -1 }], SCALES)
  assert.ok(!scoreLanes(state, ctx).some((row) => row.lane === 'guarding-gaze'))
  const opted = { ...state, optInLanes: ['guarding-gaze'] }
  const row = scoreLanes(opted, ctx).find((item) => item.lane === 'guarding-gaze')
  assert.ok(row && row.score > 0.25)
})

test('5. the second signal is dropped when it scores under half of the first', () => {
  assert.equal(pickSignals([{ lane: 'a', score: 0.86, stateL: 0, order: 1 }, { lane: 'b', score: 0.42, stateL: 0, order: 2 }]).L2, null)
  assert.equal(pickSignals([{ lane: 'a', score: 0.86, stateL: 0, order: 1 }, { lane: 'b', score: 0.44, stateL: 0, order: 2 }]).L2?.lane, 'b')
  assert.equal(pickSignals([{ lane: 'a', score: 0.24, stateL: 0, order: 1 }]).L1, null)
})

test('6. all passes give the default clip then six from the spine; starting from the beginning leads with the best lane clip or the default', () => {
  const ctx = context()
  const passes = play(SCENES.map((scene) => [scene.key, 'pass'] as [string, string]))
  const route = routeFeed(passes, ctx)
  assert.equal(route.items[0].cutId, ctx.d0CutId)
  assert.deepEqual(route.items.slice(1).map((item) => item.door), [1, 2, 3, 4, 5, 6])
  const beginning = routeFeed(play([['extra', 'treat'], ['queue', 'replay'], ['doors', 'beginning']]), ctx)
  assert.equal(beginning.items.length, 7)
  assert.ok(beginning.items.slice(1).every((item) => item.laneKey === null))
  const strong = routeFeed(play([['visitor', 'spin'], ['news', 'nobody'], ['thumb', 'lives'], ['doors', 'beginning']]), ctx)
  assert.equal(strong.items[0].laneKey, strong.L1)
  const fewTaps = routeFeed(play([['extra', 'treat']]), ctx, { justShow: true })
  assert.equal(fewTaps.items[0].cutId, ctx.d0CutId)
})

test('7. the trust lane leaves out the doors of clauses 26, 31 and 32 to 35 in the first seven days', () => {
  const extra = [26, 31, 33, 35].map((clause) => ({ id: 6000 + clause, clause, lanes: [{ lane: 'trust', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: true }))
  const ctx = context(extra)
  const taken = new Set(ctx.cuts.filter((cut) => cut.starter?.lane === 'trust' || cut.id === 27 || cut.id === 22).map((cut) => cut.id))
  assert.equal(bestCut('trust', ctx, taken, new Set(), true), null)
  assert.ok([26, 31, 33, 35].includes(bestCut('trust', ctx, taken, new Set(), false)!.clause!))
  const state = play(WORKED, NOW)
  const feed = routeFeed(state, { ...ctx, now: NOW + 2 * DAY })
  assert.ok(feed.items.every((item) => !(item.laneKey === 'trust' && [26, 31, 32, 33, 34, 35].includes(item.clause || 0))))
})

const FIXTURES: { name: string; taps: [string, string][]; L1: string | null; L2: string | null; scores: Record<string, number>; lanes: (string | null)[] }[] = [
  { name: 'New Muslim', taps: [['extra', 'pause'], ['queue', 'polite'], ['thumb', 'talk'], ['visitor', 'person'], ['news', 'nobody'], ['doors', 'beginning']], L1: null, L2: null, scores: { talking: 0.152 }, lanes: [null, null, null, null, null, null, null] },
  { name: 'Social Activist', taps: [['extra', 'pass-on'], ['queue', 'look'], ['thumb', 'off'], ['visitor', 'phone'], ['news', 'online'], ['doors', 'good']], L1: 'quiet', L2: 'mercy', scores: { quiet: 0.56, mercy: 0.554 }, lanes: ['mercy', 'quiet', 'mercy', 'quiet', null, null, null] },
  { name: 'Family-Centred', taps: [['extra', 'pause'], ['queue', 'polite'], ['thumb', 'one-more'], ['visitor', 'person'], ['news', 'family'], ['doors', 'close']], L1: 'talking', L2: null, scores: { talking: 0.5525, company: 0.254 }, lanes: ['talking', 'talking', 'talking', 'talking', null, null, null] },
  { name: 'Secular Muslim', taps: [['extra', 'treat'], ['queue', 'pass'], ['thumb', 'one-more'], ['visitor', 'spin'], ['news', 'nobody'], ['doors', 'calmer']], L1: 'trust', L2: 'company', scores: { trust: 0.86, company: 0.56 }, lanes: ['trust', 'company', 'trust', 'company', null, null, null] },
  { name: 'All pass', taps: SCENES.map((scene) => [scene.key, 'pass'] as [string, string]), L1: null, L2: null, scores: {}, lanes: [null, null, null, null, null, null, null] },
]

test('8. the simulator fixtures stay frozen', () => {
  const ctx = context()
  for (const fixture of FIXTURES) {
    const state = play(fixture.taps)
    const route = routeFeed(state, ctx)
    assert.equal(route.L1, fixture.L1, `${fixture.name} L1`)
    assert.equal(route.L2, fixture.L2, `${fixture.name} L2`)
    for (const [lane, score] of Object.entries(fixture.scores)) near(scoreOf(state, ctx, lane), score)
    assert.deepEqual(route.items.map((item) => item.laneKey), fixture.lanes, fixture.name)
    if (!fixture.L1) assert.equal(route.items[0].cutId, ctx.d0CutId, `${fixture.name} starts on the default clip`)
  }
})

test('9. the starter map holds together', () => {
  const ingest = JSON.parse(readFileSync(path.resolve(process.cwd(), 'content/starters-ingest.json'), 'utf8')) as { results: { youtubeId: string; oembedTitle: string | null }[] }
  const lanes = [...LANES.filter((lane) => !lane.optInOnly).map((lane) => lane.key), 'default']
  assert.equal(lanes.length, 10)
  for (const lane of lanes) {
    const rows = STARTERS.filter((row) => row.lane === lane)
    const roles = new Set(rows.map((row) => row.role))
    assert.ok(roles.size >= 2 && roles.size <= 3, `${lane} covers ${roles.size} roles`)
    assert.ok(rows.length <= roles.size + 1, `${lane} has ${rows.length} starters`)
    assert.equal(rows.filter((row) => row.role === 'first').length, 1, `${lane} has one first`)
    assert.ok(rows.filter((row) => row.role === 'mains').length <= 1, `${lane} has at most one mains`)
  }
  for (const row of STARTERS) {
    assert.ok(row.speaker.trim(), `${row.title} has a speaker`)
    assert.match(row.youtubeId, /^[A-Za-z0-9_-]{11}$/)
    const checked = ingest.results.find((item) => item.youtubeId === row.youtubeId)
    assert.equal(checked?.oembedTitle, row.title, `${row.youtubeId} title matches YouTube byte for byte`)
  }
  const perSpeaker = new Map<string, number>()
  const clipOf = (row: (typeof STARTERS)[number]) => STARTERS.some((other) => other !== row && other.note?.includes(`${row.youtubeId} is a 95-second clip of it`))
  for (const row of STARTERS) if (!clipOf(row)) perSpeaker.set(row.speaker, (perSpeaker.get(row.speaker) || 0) + 1)
  for (const [speaker, count] of perSpeaker) assert.ok(count <= 4, `${speaker} has ${count} talks`)
  for (const row of STARTERS.filter((item) => item.role === 'first' && item.lane !== 'default' && item.lengthSec != null)) {
    assert.ok(row.lengthSec! <= 600, `${row.title} is ${row.lengthSec}s`)
  }
  assert.equal(STARTERS.filter((row) => row.lane === 'guarding-gaze').length, 0)
  assert.equal(STARTERS.length, 31)
  assert.equal(perSpeaker.size, 13)
})

test("10. best(L) gives the lane's first starter on a fresh state, then other lane cuts once it has been served", () => {
  const ctx = context()
  for (const lane of LANES.filter((row) => !row.optInOnly)) {
    const first = ctx.cuts.find((cut) => cut.starter?.lane === lane.key && cut.starter.role === 'first')!
    assert.equal(bestCut(lane.key, ctx, new Set(), new Set(), true)?.id, first.id, lane.key)
    const fallback = bestCut(lane.key, ctx, new Set(), new Set([String(first.id)]), true)
    assert.ok(fallback && fallback.id !== first.id && fallback.lanes.some((tag) => tag.lane === lane.key), `${lane.key} falls back to another lane cut`)
  }
})

test('every complete tap path stays away from guarding the gaze, and going back replaces a tap', () => {
  const ctx = context([{ id: 5000, clause: 31, lanes: [{ lane: 'guarding-gaze', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false }])
  const choices = SCENES.map((scene) => scene.options.filter((option) => !option.crisis).map((option) => option.key))
  assert.equal(choices.reduce((total, list) => total * list.length, 1), 7680)
  let paths = 0
  const walk = (depth: number, taps: [string, string][]) => {
    if (depth === SCENES.length) {
      paths += 1
      const route = routeFeed(play(taps), ctx)
      assert.ok(route.items.every((item) => item.laneKey !== 'guarding-gaze'))
      return
    }
    for (const option of choices[depth]) walk(depth + 1, [...taps, [SCENES[depth].key, option]])
  }
  walk(0, [])
  assert.equal(paths, 7680)
  const changed = applyTap(play([['extra', 'treat'], ['queue', 'replay']]), 'extra', 'pause', SCENES, SCALES).state
  assert.equal(changed.taps.length, 2)
  assert.equal(changed.s.greed, undefined)
  near(changed.s.gratitude, 0.3)
  const crisis = applyTap(changed, 'visitor', 'heavy', SCENES, SCALES)
  assert.equal(crisis.crisis, true)
  assert.equal(crisis.state.taps.some((tap) => tap.option === 'heavy'), false)
})

test('a placeholder clip joins the spine only while unchecked talks are shown, and a withheld clip never does', () => {
  // The spine pointer is a door. Clauses 1 to 20 sit in doors up to 8; clause 21 is door 9, 22 door 10, 23 door 11.
  const placeholder: CutInfo = { id: 80, clause: 21, lanes: [{ lane: 'patience', weight: 1, confirmed: true }], approved: false, placeholder: true, hasHors: true, portalOwn: false }
  const withheld: CutInfo = { id: 81, clause: 23, lanes: [{ lane: 'patience', weight: 1, confirmed: true }], approved: false, placeholder: true, withheld: true, hasHors: true, portalOwn: false }
  const off = context([placeholder, withheld])
  assert.equal(clipUsable(placeholder, false), false)
  assert.equal(clipUsable(placeholder, true), true)
  assert.equal(clipUsable(withheld, true), false)
  assert.equal(spine(1, off, 8, new Set(), new Set())[0]?.clause, 22)
  const on = { ...off, showUnchecked: true }
  assert.deepEqual(spine(2, on, 8, new Set(), new Set()).map((cut) => cut.clause), [21, 22])
  assert.equal(spine(5, on, 8, new Set(), new Set()).some((cut) => cut.id === 81), false)
  const first = off.cuts.find((cut) => cut.starter?.lane === 'patience' && cut.starter.role === 'first')!
  const served = new Set([String(first.id)])
  assert.notEqual(bestCut('patience', off, new Set(), served, false)?.id, 80)
  assert.equal(bestCut('patience', on, new Set(), served, false)?.id, 80)
})

test('buildFeed takes lane scores alone, as the server does', () => {
  const ctx = context()
  const feed = buildFeed({ laneScores: { trust: 0.86, patience: 0.2525 }, served: [], spinePointer: 0 }, ctx)
  assert.deepEqual(feed.items.map((item) => item.laneKey), ['trust', 'trust', 'trust', 'trust', null, null, null])
})

test('a lane ranks every talk in a door by its best clause there, so a Sitting talk ranks with the clauses the lane names', () => {
  // The company lane names clauses 2, 4, 8 (rank 1 and 2) and 9, 37 (rank 3). Clause 5 is not named, but it sits in door 2.
  const ctx = context([
    { id: 7005, clause: 5, lanes: [{ lane: 'company', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
    { id: 7038, clause: 38, lanes: [{ lane: 'company', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: false },
  ])
  const taken = new Set(ctx.cuts.filter((cut) => cut.starter || cut.id === 2).map((cut) => cut.id))
  assert.equal(bestCut('company', ctx, taken, new Set(), false)?.id, 7005, 'door 2 (rank 1) comes before door 19 (rank 3)')
  taken.add(7005)
  assert.equal(bestCut('company', ctx, taken, new Set(), false)?.id, 7038)
})

test('first-week exclusions cover the whole door: clause 29 shares door 16 with excluded clause 31', () => {
  const ctx = context([{ id: 7029, clause: 29, lanes: [{ lane: 'trust', weight: 1, confirmed: true }], approved: true, hasHors: true, portalOwn: true }])
  const taken = new Set(ctx.cuts.filter((cut) => cut.starter?.lane === 'trust' || cut.id === 27 || cut.id === 22).map((cut) => cut.id))
  assert.equal(bestCut('trust', ctx, taken, new Set(), true), null)
  assert.equal(bestCut('trust', ctx, taken, new Set(), false)?.id, 7029)
})

test('explicit door fields from the server win over the built-in map', () => {
  const ctx = context()
  const custom = { ...ctx, cuts: ctx.cuts.map((cut) => (cut.id === 13 ? { ...cut, door: 1 } : cut)) }
  const feed = buildFeed({ laneScores: {}, served: [], spinePointer: 0 }, custom)
  assert.deepEqual(feed.items.slice(1, 3).map((item) => item.door), [1, 2])
})

test('the spine starts at the door before the starting door, and an older clause pointer moves to doors', () => {
  assert.equal(spineStart(null), 0)
  assert.equal(spineStart(10), 9)
  assert.equal(spineStart(25), 19)
  const fresh = freshState('p', 1, NOW)
  assert.equal(fresh.spineIn, 'door')
  assert.equal(upgradeSpine(fresh), fresh)
  const old = { ...fresh, spineIn: undefined }
  assert.equal(upgradeSpine({ ...old, spinePointer: 0 }).spinePointer, 0)
  assert.equal(upgradeSpine({ ...old, spinePointer: 1 }).spinePointer, 1, 'clause 1 closes door 1')
  assert.equal(upgradeSpine({ ...old, spinePointer: 5 }).spinePointer, 1, 'clause 5 is inside door 2, so door 2 is not yet done')
  assert.equal(upgradeSpine({ ...old, spinePointer: 12 }).spinePointer, 2)
  assert.equal(upgradeSpine({ ...old, spinePointer: 21 }).spinePointer, 8, 'clause 21 opens door 9')
  assert.equal(upgradeSpine({ ...old, spinePointer: 41 }).spinePointer, 20)
  assert.equal(upgradeSpine({ ...old, spinePointer: 41 }).spineIn, 'door')
})
