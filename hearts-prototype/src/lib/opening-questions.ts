// Plain sums for the opening-question check. No model and no paid call.
// A portal's own AI key is never read here.
import {
  READ_GAIN,
  TAP_STEP,
  applyTap,
  freshState,
  pickSignals,
  scoreLanes,
  type CutInfo,
  type HeartState,
  type LaneDef,
  type RouteContext,
  type ScaleDef,
  type ScaleKey,
  type SceneDef,
  type SceneOption,
} from './heart'

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

const round = (value: number) => Math.round(value * 1e6) / 1e6

export type FeelingName = { key: ScaleKey; name: string }

export type RouteSlice = {
  lanes: LaneDef[]
  cuts: CutInfo[]
  d0CutId: number | null
  allowSuggested?: boolean
  showUnchecked?: boolean
}

/** 1, 2, 3… in the order a newcomer meets them, even when two stored orders match. */
export function numberOpeningScenes<T extends { order: number }>(scenes: T[]): T[] {
  return scenes.map((scene, index) => (scene.order === index + 1 ? scene : { ...scene, order: index + 1 }))
}

/**
 * Puts the account question in front of the last starter scene, then the portal's own
 * questions, then numbers the list. Stored orders can collide (account and the last
 * scene were both 6); the served list must not.
 */
export function serveOpeningScenes<T extends { key: string; order: number }>(published: T[], account: T | null, extras: T[]): T[] {
  const scenes = [...published]
  if (account && !scenes.some((scene) => scene.key === account.key)) {
    scenes.splice(Math.max(0, scenes.length - 1), 0, account)
  }
  return numberOpeningScenes([...scenes, ...extras])
}

/** The first answer on each question, skipping the one that opens the help screen. */
export function newcomerPicks(scenes: SceneDef[]): Record<string, string> {
  const picks: Record<string, string> = {}
  for (const scene of scenes) {
    const option = scene.options.find((row) => !row.crisis)
    if (option) picks[scene.key] = option.key
  }
  return picks
}

function appliedMoves(option: SceneOption, scales: ScaleDef[]) {
  const amounts = new Map<ScaleKey, number>()
  if (option.crisis) return amounts
  for (const nudge of option.nudges) {
    const def = scales.find((scale) => scale.key === nudge.scale)
    if (def && def.firstOpenRead === false) continue
    amounts.set(nudge.scale, round((amounts.get(nudge.scale) || 0) + TAP_STEP * nudge.delta))
  }
  return amounts
}

function effectKey(option: SceneOption, scales: ScaleDef[]) {
  const moves = [...appliedMoves(option, scales).entries()]
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
  return JSON.stringify({ moves, lane: option.intentLane || '', spine: Boolean(option.spineFirst) })
}

function affectsLane(option: SceneOption, lane: LaneDef) {
  if (option.crisis) return false
  if (option.intentLane === lane.key) return true
  return Boolean(lane.scale && option.nudges.some((nudge) => nudge.scale === lane.scale))
}

function contextOf(route: RouteSlice, scales: ScaleDef[], now: number): RouteContext {
  return {
    lanes: route.lanes,
    scales,
    cuts: route.cuts,
    d0CutId: route.d0CutId,
    now,
    allowSuggested: route.allowSuggested,
    showUnchecked: route.showUnchecked,
  }
}

/** Highest score one lane can reach from these questions. Questions that never touch it are skipped. */
export function bestLaneScore(lane: LaneDef, scenes: SceneDef[], scales: ScaleDef[], route: RouteSlice, optInLanes: string[], now = Date.UTC(2026, 9, 1)) {
  const ctx = contextOf(route, scales, now)
  const relevant = scenes.filter((scene) => scene.options.some((option) => affectsLane(option, lane)))
  let best = 0
  const start: HeartState = { ...freshState('review', 1, now), optInLanes }
  const walk = (index: number, state: HeartState) => {
    if (index === relevant.length) {
      const row = scoreLanes(state, ctx).find((item) => item.lane === lane.key)
      if (row && row.score > best) best = row.score
      return
    }
    const scene = relevant[index]
    const choices = ['pass', ...scene.options.filter((option) => !option.crisis).map((option) => option.key)]
    for (const choice of choices) walk(index + 1, applyTap(state, scene.key, choice, scenes, scales, now).state)
  }
  walk(0, start)
  if (!relevant.length) {
    const row = scoreLanes(start, ctx).find((item) => item.lane === lane.key)
    best = row?.score || 0
  }
  return round(best)
}

export type AnswerHeat = {
  key: string
  label: string
  crisis: boolean
  amounts: Partial<Record<ScaleKey, number>>
  laneTitle: string
}

export type QuestionHeat = {
  key: string
  number: number
  caption: string
  barely: boolean
  rows: AnswerHeat[]
  duplicates: { labels: string[]; detail: string }[]
}

export type LaneFinding = { key: string; title: string; best: number }

export type OpeningReview = {
  questions: QuestionHeat[]
  flatLanes: LaneFinding[]
  shortLanes: LaneFinding[]
  blockedLanes: LaneFinding[]
  suggestions: string[]
}

const FLOOR = 0.051

/** Words for a feeling move. Near zero is barely anything; one full answer is a pull; more than that is strong. */
export function pullWords(amount: number, name?: string) {
  const size = Math.abs(amount)
  if (size < 0.08) return 'barely moves anything'
  const strength = size < 0.2 ? 'a small pull' : size < 0.45 ? 'a pull' : 'a strong pull'
  if (!name) return amount < 0 ? `${strength} away` : strength
  return amount < 0 ? `${strength} away from ${name}` : `${strength} to ${name}`
}

function effectDetail(option: SceneOption, scales: ScaleDef[], lanes: LaneDef[]) {
  const moves = [...appliedMoves(option, scales).entries()].filter(([, amount]) => amount !== 0)
  const bits = moves.map(([scale, amount]) => pullWords(amount, laneTitle(lanes, lanes.find((lane) => lane.scale === scale)?.key) || scale))
  if (option.intentLane) bits.push(`names ${laneTitle(lanes, option.intentLane)}`)
  if (option.spineFirst) bits.push('opens the main path first')
  if (!bits.length) return 'None of them moves a feeling.'
  return `They are ${bits.join(' and ')}.`
}

function laneTitle(lanes: LaneDef[], key?: string) {
  if (!key) return ''
  return lanes.find((lane) => lane.key === key)?.title || key
}

export function reviewOpeningQuestions(
  scenes: SceneDef[],
  scales: ScaleDef[],
  route: RouteSlice,
  optInLanes: string[] = [],
  now = Date.UTC(2026, 9, 1),
): OpeningReview {
  const questions: QuestionHeat[] = scenes.map((scene, index) => {
    const live = scene.options.filter((option) => !option.crisis)
    const groups = new Map<string, string[]>()
    for (const option of live) {
      const key = effectKey(option, scales)
      const labels = groups.get(key) || []
      labels.push(option.label)
      groups.set(key, labels)
    }
    const duplicates = [...groups.entries()]
      .filter(([, labels]) => labels.length > 1)
      .map(([key, labels]) => {
        const sample = live.find((option) => effectKey(option, scales) === key)!
        return { labels, detail: effectDetail(sample, scales, route.lanes) }
      })
    const barely = live.length > 0 && live.every((option) => effectKey(option, scales) === effectKey({ ...option, nudges: [], intentLane: undefined, spineFirst: false }, scales))
    return {
      key: scene.key,
      number: index + 1,
      caption: scene.caption.replace(/\*\*/g, ''),
      barely,
      duplicates,
      rows: scene.options.map((option) => ({
        key: option.key,
        label: option.label,
        crisis: Boolean(option.crisis),
        amounts: option.crisis ? {} : Object.fromEntries(appliedMoves(option, scales)),
        laneTitle: option.crisis ? 'Opens the help screen' : option.spineFirst ? 'Opens the main path first' : laneTitle(route.lanes, option.intentLane) || 'No lane',
      })),
    }
  })

  const probe = { ...freshState('review', 1, now), optInLanes: route.lanes.filter((lane) => lane.optInOnly).map((lane) => lane.key) }
  const routable = new Set(scoreLanes(probe, contextOf(route, scales, now)).map((row) => row.lane))
  const flatLanes: LaneFinding[] = []
  const shortLanes: LaneFinding[] = []
  const blockedLanes: LaneFinding[] = []
  const suggestions: string[] = []

  for (const lane of route.lanes) {
    const optedOut = lane.optInOnly && !optInLanes.includes(lane.key)
    if (optedOut || !routable.has(lane.key)) {
      blockedLanes.push({ key: lane.key, title: lane.title, best: 0 })
      continue
    }
    const best = bestLaneScore(lane, scenes, scales, route, optInLanes, now)
    const finding = { key: lane.key, title: lane.title, best }
    if (best <= FLOOR) {
      flatLanes.push(finding)
      const readable = !lane.scale || scales.find((scale) => scale.key === lane.scale)?.firstOpenRead !== false
      if (readable) suggestions.push(`Add an answer that leans to ${lane.title}.`)
      continue
    }
    if (best < 0.25) {
      shortLanes.push(finding)
      suggestions.push(`Add an answer that leans to ${lane.title}.`)
    }
  }

  return { questions, flatLanes, shortLanes, blockedLanes, suggestions }
}

export type PathWin = { lane: string | null; title: string; count: number; share: number }

export type PathReport = { paths: number; wins: PathWin[] }

/**
 * Every combination of answers, including passing a question and leaving out the help-screen
 * answer. Reports how often each lane comes first. Same sums the phone uses.
 */
type Touch = { key: ScaleKey; amount: number; conf: number }
type Step = { touches: Touch[]; intent?: string; spine: boolean }

function stepFor(option: SceneOption | undefined, scales: ScaleDef[]): Step {
  if (!option || option.crisis) return { touches: [], spine: false }
  const touches: Touch[] = []
  for (const nudge of option.nudges) {
    const def = scales.find((scale) => scale.key === nudge.scale)
    if (def && def.firstOpenRead === false) continue
    touches.push({ key: nudge.scale, amount: TAP_STEP * nudge.delta, conf: READ_GAIN })
  }
  return { touches, intent: option.intentLane, spine: Boolean(option.spineFirst) }
}

export function countOpeningPaths(scenes: SceneDef[], scales: ScaleDef[], route: RouteSlice, optInLanes: string[] = [], now = Date.UTC(2026, 9, 1)): PathReport {
  const ctx = contextOf(route, scales, now)
  const probe = { ...freshState('review', 1, now), optInLanes: route.lanes.filter((lane) => lane.optInOnly).map((lane) => lane.key) }
  const routable = new Set(scoreLanes(probe, ctx).map((row) => row.lane))
  const active = route.lanes.filter((lane) => routable.has(lane.key))
  const choices = scenes.map((scene) => [undefined, ...scene.options.filter((option) => !option.crisis)].map((option) => stepFor(option, scales)))
  const wins = new Map<string | null, number>()
  let paths = 0
  const state = { ...freshState('review', 1, now), optInLanes }

  const scoreActive = () => {
    const rows = []
    for (const lane of active) {
      if (lane.optInOnly && !optInLanes.includes(lane.key)) continue
      const key = lane.scale
      const value = key ? state.s[key] || 0 : 0
      const confidence = key ? state.c[key] || 0 : 0
      const factor = key ? 0.5 + 0.5 * confidence : 0
      const stateL = Math.max(0, -value) * factor + 0.4 * Math.max(0, value) * factor
      const score = 0.05 + stateL + 0.3 * (state.intentLane === lane.key ? 1 : 0)
      rows.push({ lane: lane.key, score: round(score), stateL: round(stateL), order: lane.order })
    }
    rows.sort((a, b) => b.score - a.score || b.stateL - a.stateL || a.order - b.order)
    return rows
  }

  const walk = (index: number) => {
    if (index === scenes.length) {
      const lead = pickSignals(scoreActive()).L1?.lane ?? null
      wins.set(lead, (wins.get(lead) || 0) + 1)
      paths += 1
      return
    }
    for (const step of choices[index]) {
      const priorS: Partial<Record<ScaleKey, number>> = {}
      const priorC: Partial<Record<ScaleKey, number>> = {}
      for (const touch of step.touches) {
        if (!(touch.key in priorS)) {
          priorS[touch.key] = state.s[touch.key]
          priorC[touch.key] = state.c[touch.key]
        }
        state.s[touch.key] = round(clamp((state.s[touch.key] || 0) + touch.amount, -1, 1))
        state.c[touch.key] = round(Math.min(1, (state.c[touch.key] || 0) + touch.conf))
      }
      const priorIntent = state.intentLane
      const priorSpine = state.spineFirst
      if (step.intent) state.intentLane = step.intent
      if (step.spine) state.spineFirst = true
      walk(index + 1)
      for (const key of Object.keys(priorS) as ScaleKey[]) {
        state.s[key] = priorS[key]
        state.c[key] = priorC[key]
      }
      state.intentLane = priorIntent
      state.spineFirst = priorSpine
    }
  }
  walk(0)

  const titles = new Map(route.lanes.map((lane) => [lane.key, lane.title]))
  const list = [...wins.entries()]
    .map(([lane, count]) => ({
      lane,
      title: lane ? titles.get(lane) || lane : 'No lane is ready',
      count,
      share: paths ? count / paths : 0,
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title))
  return { paths, wins: list }
}

export function duplicateLine(labels: string[], detail: string) {
  if (labels.length < 2) return ''
  const shown = labels.map((label) => `“${label}”`)
  const head = shown.length === 2 ? `${shown[0]} and ${shown[1]}` : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
  return `${head} do the same thing. ${detail}`
}

export function flatLaneLine(lane: LaneFinding) {
  return `${lane.title} barely moves on every path. No question moves it.`
}

export function shortLaneLine(lane: LaneFinding) {
  return `${lane.title} never gets strong enough to come first.`
}

export function blockedLaneLine(lane: LaneFinding) {
  return `${lane.title} is off for a newcomer, so nobody reaches it from these questions.`
}

export function barelyLine(caption: string) {
  return `“${caption}” barely moves any feeling.`
}
