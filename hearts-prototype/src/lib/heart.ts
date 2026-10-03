// Heart state and routing for the opening (build spec sections 2.6, 3 and 4).
// Pure functions shared by the browser, the server, the master simulator and the tests. No path aliases here.

export type ScaleKey = 'desire' | 'greed' | 'anger' | 'ego' | 'worry' | 'belonging' | 'gratitude' | 'faith' | 'compassion' | 'discipline'
export const SCALE_KEYS: ScaleKey[] = ['desire', 'greed', 'anger', 'ego', 'worry', 'belonging', 'gratitude', 'faith', 'compassion', 'discipline']

export type Nudge = { scale: ScaleKey; delta: -1 | 0 | 1 }
export type SceneOption = {
  key: string
  label: string
  replyPill?: string
  nudges: Nudge[]
  intentLane?: string
  spineFirst?: boolean
  crisis?: boolean
  sensitivity?: 'normal' | 'private'
}
export type SceneDef = {
  key: string
  order: number
  layout: 'grid4' | 'bubbles' | 'doorsCarousel'
  caption: string
  subline: string
  options: SceneOption[]
  adaptedFrom?: string
}
export type ScaleDef = { key: ScaleKey; firstOpenRead: boolean }
export type LaneDef = {
  key: string
  title: string
  scale: ScaleKey | null
  fit: 'natural' | 'workable' | 'weak'
  clauses: { clause: number; rank: number }[]
  excludeClauses: number[]
  optInOnly: boolean
  order: number
}

export type Tap = { scene: string; option: string | 'pass'; at: number }

export type HeartState = {
  v: 1
  scenesVersion: number
  portal: string
  s: Partial<Record<ScaleKey, number>>
  c: Partial<Record<ScaleKey, number>>
  taps: Tap[]
  intentLane?: string
  spineFirst?: boolean
  u: Record<string, number>
  served: string[]
  optInLanes: string[]
  spinePointer: number
  updatedAt: number
  /** Device time of the first open; the first-7-days exclusions count from here. */
  firstOpenAt?: number
  /** Lanes resting after 'Not for me', keyed to the time they come back. */
  cool?: Record<string, number>
  lastDecayAt?: number
  watched?: number
  /** Clips served today, for the fatigue term. A new day starts afresh. */
  recent?: { day: string; ids: string[] }
}

export const STORAGE_KEY = 'hearts.heart.v1'
export const PENDING_KEY = 'hearts.pending.v1'
export const TAP_STEP = 0.3
export const READ_GAIN = 0.35
export const CHECKIN_GAIN = 0.2

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const round = (value: number) => Math.round(value * 1e6) / 1e6

export function freshState(portal: string, scenesVersion: number, at = Date.now()): HeartState {
  return { v: 1, scenesVersion, portal, s: {}, c: {}, taps: [], u: {}, served: [], optInLanes: [], spinePointer: 0, updatedAt: at, firstOpenAt: at }
}

/** Applies one scale nudge. In the opening, scales with firstOpenRead = false are skipped (the desire guard). */
function nudge(state: HeartState, item: Nudge, scales: ScaleDef[], context: 'opening' | 'checkin') {
  const def = scales.find((scale) => scale.key === item.scale)
  if (context === 'opening' && def && def.firstOpenRead === false) return
  state.s[item.scale] = round(clamp((state.s[item.scale] || 0) + TAP_STEP * item.delta, -1, 1))
  state.c[item.scale] = round(Math.min(1, (state.c[item.scale] || 0) + (context === 'opening' ? READ_GAIN : CHECKIN_GAIN)))
}

/** Rebuilds the opening part of the state from the taps, so going back and choosing again replaces a tap cleanly. */
export function replayTaps(state: HeartState, scenes: SceneDef[], scales: ScaleDef[]): HeartState {
  const next: HeartState = { ...state, s: {}, c: {}, intentLane: undefined, spineFirst: undefined }
  for (const tap of state.taps) {
    if (tap.option === 'pass') continue
    const option = scenes.find((scene) => scene.key === tap.scene)?.options.find((row) => row.key === tap.option)
    if (!option || option.crisis) continue
    for (const item of option.nudges) nudge(next, item, scales, 'opening')
    if (option.intentLane) next.intentLane = option.intentLane
    if (option.spineFirst) next.spineFirst = true
  }
  return next
}

export type TapOutcome = { state: HeartState; crisis: boolean }

/** Section 3.1. A crisis option changes nothing and is not recorded; the caller opens the help screen. */
export function applyTap(state: HeartState, sceneKey: string, optionKey: string | 'pass', scenes: SceneDef[], scales: ScaleDef[], at = Date.now()): TapOutcome {
  const option = scenes.find((scene) => scene.key === sceneKey)?.options.find((row) => row.key === optionKey)
  if (option?.crisis) return { state, crisis: true }
  const taps = state.taps.filter((tap) => tap.scene !== sceneKey)
  const ordered = [...taps, { scene: sceneKey, option: optionKey, at }].sort(
    (a, b) => (scenes.find((scene) => scene.key === a.scene)?.order || 0) - (scenes.find((scene) => scene.key === b.scene)?.order || 0),
  )
  return { state: { ...replayTaps({ ...state, taps: ordered }, scenes, scales), updatedAt: at }, crisis: false }
}

/** Section 4: a check-in answer moves the heart state, with a smaller confidence gain than an opening tap. */
export function applyCheckin(state: HeartState, nudges: Nudge[], scales: ScaleDef[], at = Date.now()): HeartState {
  const next: HeartState = { ...state, s: { ...state.s }, c: { ...state.c }, updatedAt: at }
  for (const item of nudges) nudge(next, item, scales, 'checkin')
  return next
}

export type Signal = 'watched90' | 'replay' | 'fave' | 'watch-full' | 'start-course' | 'skip-under-3' | 'skip-3-10' | 'not-for-me'
export const SIGNAL_DELTA: Record<Signal, number> = {
  watched90: 0.15,
  replay: 0.25,
  fave: 0.25,
  'watch-full': 0.35,
  'start-course': 0.35,
  'skip-under-3': -0.2,
  'skip-3-10': -0.1,
  'not-for-me': -0.5,
}
export const COOLDOWN_MS = 72 * 3_600_000

/** Section 4: behaviour moves lane interest only, scaled by each lane tag's weight. */
export function applySignal(state: HeartState, lanes: { lane: string; weight: number }[], signal: Signal, at = Date.now()): HeartState {
  const u = { ...state.u }
  const cool = { ...(state.cool || {}) }
  for (const tag of lanes) {
    u[tag.lane] = round(clamp((u[tag.lane] || 0) + SIGNAL_DELTA[signal] * (tag.weight ?? 1), -1, 1))
    if (signal === 'not-for-me') cool[tag.lane] = at + COOLDOWN_MS
  }
  return { ...state, u, cool, updatedAt: at, watched: (state.watched || 0) + (signal === 'watched90' ? 1 : 0) }
}

/** Weekly decay: taps describe lately, so interest and confidence fade by 10% a week. */
export function decay(state: HeartState, at = Date.now()): HeartState {
  const since = state.lastDecayAt ?? state.firstOpenAt ?? at
  const weeks = Math.floor((at - since) / (7 * 86_400_000))
  if (weeks < 1) return state.lastDecayAt ? state : { ...state, lastDecayAt: since }
  const factor = 0.9 ** weeks
  const u = Object.fromEntries(Object.entries(state.u).map(([key, value]) => [key, round(value * factor)]))
  const c = Object.fromEntries(Object.entries(state.c).map(([key, value]) => [key, round((value || 0) * factor)])) as HeartState['c']
  return { ...state, u, c, lastDecayAt: since + weeks * 7 * 86_400_000 }
}

export type LaneScore = { lane: string; score: number; stateL: number; order: number }

export type CutInfo = {
  id: number
  clause: number | null
  lanes: { lane: string; weight: number; confirmed: boolean }[]
  approved: boolean
  /** Imported clips arrive as suggested placeholders. Usable only while show-unchecked is on. */
  placeholder?: boolean
  /** Safeguarding: a rejected clip never enters the feed. */
  withheld?: boolean
  hasHors: boolean
  portalOwn: boolean
  starter?: { lane: string; role: 'first' | 'next' | 'mains' }
}

export type RouteContext = {
  lanes: LaneDef[]
  scales: ScaleDef[]
  cuts: CutInfo[]
  d0CutId: number | null
  now?: number
  allowSuggested?: boolean
  /** Master flag: draft talks, and their placeholder clips, may be served. */
  showUnchecked?: boolean
}

/** An approved clip is usable. A placeholder on a visible talk is usable only while show-unchecked is on. Rejected clips stay out. */
export function clipUsable(cut: CutInfo, showUnchecked?: boolean) {
  if (cut.withheld) return false
  if (cut.approved) return true
  return Boolean(showUnchecked && cut.placeholder)
}

function laneTagged(cut: CutInfo, lane: string, allowSuggested?: boolean) {
  return cut.lanes.some((tag) => tag.lane === lane && (tag.confirmed || allowSuggested))
}

export function routableLanes(ctx: RouteContext) {
  return new Set(ctx.lanes.filter((lane) => ctx.cuts.some((cut) => laneTagged(cut, lane.key, ctx.allowSuggested) || cut.starter?.lane === lane.key)).map((lane) => lane.key))
}

/** Section 3.2. */
export function scoreLanes(state: HeartState, ctx: RouteContext): LaneScore[] {
  const routable = routableLanes(ctx)
  const at = ctx.now ?? Date.now()
  const today = new Date(at).toISOString().slice(0, 10)
  const recent = state.recent && state.recent.day === today ? state.recent.ids.slice(-5) : []
  const result: LaneScore[] = []
  for (const lane of ctx.lanes) {
    if (lane.optInOnly && !state.optInLanes.includes(lane.key)) continue
    if (!routable.has(lane.key)) continue
    if (state.cool?.[lane.key] && state.cool[lane.key] > at) continue
    const k = lane.scale
    const s = k ? state.s[k] || 0 : 0
    const f = k ? 0.5 + 0.5 * (state.c[k] || 0) : 0
    const stateL = Math.max(0, -s) * f + 0.4 * Math.max(0, s) * f
    const servedHere = recent.filter((id) => ctx.cuts.find((cut) => String(cut.id) === id && laneTagged(cut, lane.key, ctx.allowSuggested))).length
    const score = 0.05 + stateL + 0.3 * (state.intentLane === lane.key ? 1 : 0) + 0.6 * (state.u[lane.key] || 0) - 0.1 * servedHere
    result.push({ lane: lane.key, score: round(score), stateL: round(stateL), order: lane.order })
  }
  return result.sort((a, b) => b.score - a.score || b.stateL - a.stateL || a.order - b.order)
}

/** Section 3.3: at most two signals. */
export function pickSignals(ranked: LaneScore[]) {
  const L1 = ranked[0] && ranked[0].score >= 0.25 ? ranked[0] : null
  const second = ranked[1]
  const L2 = L1 && second && second.score >= 0.25 && second.score >= 0.5 * L1.score ? second : null
  return { L1, L2 }
}

export type FeedSlot = { cutId: number; laneKey: string | null; clause: number | null; kind: 'hors' }

export type FeedPlan = {
  /** Lane scores as the device worked them out (P2: the only personal thing a feed request carries). */
  laneScores: Record<string, number>
  lead?: string
  spineFirst?: boolean
  served: string[]
  spinePointer: number
  firstOpenAt?: number
}

function clauseRank(lane: LaneDef, clause: number | null) {
  const hit = clause == null ? null : lane.clauses.find((row) => row.clause === clause)
  return hit ? hit.rank : 99
}

/** best(L) from section 3.4. */
export function bestCut(laneKey: string, ctx: RouteContext, taken: Set<number>, served: Set<string>, firstWeek: boolean): CutInfo | null {
  const lane = ctx.lanes.find((row) => row.key === laneKey)
  if (!lane) return null
  const starter = ctx.cuts.find((cut) => cut.starter?.lane === laneKey && cut.starter.role === 'first')
  if (starter && !taken.has(starter.id) && !served.has(String(starter.id))) return starter
  const pool = ctx.cuts.filter((cut) => {
    if (taken.has(cut.id)) return false
    if (!laneTagged(cut, laneKey, ctx.allowSuggested)) return false
    if (!cut.starter && !clipUsable(cut, ctx.showUnchecked)) return false
    if (!cut.hasHors && !cut.starter) return false
    if (firstWeek && cut.clause != null && lane.excludeClauses.includes(cut.clause)) return false
    return true
  })
  pool.sort(
    (a, b) =>
      Number(b.portalOwn) - Number(a.portalOwn) ||
      clauseRank(lane, a.clause) - clauseRank(lane, b.clause) ||
      (a.clause ?? 99) - (b.clause ?? 99) ||
      Number(served.has(String(a.id))) - Number(served.has(String(b.id))) ||
      a.id - b.id,
  )
  return pool[0] || null
}

/** spine(n) from section 3.4: usable hors cuts in clause order after the pointer. */
export function spine(n: number, ctx: RouteContext, pointer: number, taken: Set<number>, served: Set<string>) {
  const pool = ctx.cuts
    .filter((cut) => clipUsable(cut, ctx.showUnchecked) && cut.hasHors && cut.clause != null && cut.clause > pointer && !taken.has(cut.id))
    .sort((a, b) => (a.clause! - b.clause!) || Number(served.has(String(a.id))) - Number(served.has(String(b.id))) || a.id - b.id)
  const picked: CutInfo[] = []
  const usedClauses = new Set<number>()
  for (const cut of pool) {
    if (picked.length >= n) break
    if (usedClauses.has(cut.clause!)) continue
    usedClauses.add(cut.clause!)
    picked.push(cut)
  }
  // Fewer distinct clauses than slots: fill with the remaining cuts in the same order.
  for (const cut of pool) {
    if (picked.length >= n) break
    if (!picked.includes(cut)) picked.push(cut)
  }
  return picked
}

/** Section 3.4, from lane scores. The server runs this; the device runs it through routeFeed. */
export function buildFeed(plan: FeedPlan, ctx: RouteContext): { items: FeedSlot[]; spinePointer: number; L1: string | null; L2: string | null } {
  const lanesByKey = new Map(ctx.lanes.map((lane) => [lane.key, lane]))
  const ranked: LaneScore[] = Object.entries(plan.laneScores)
    .filter(([key]) => lanesByKey.has(key))
    .map(([lane, score]) => ({ lane, score, stateL: 0, order: lanesByKey.get(lane)!.order }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
  const { L1, L2 } = pickSignals(ranked)
  const at = ctx.now ?? Date.now()
  const firstWeek = plan.firstOpenAt == null || at - plan.firstOpenAt < 7 * 86_400_000
  const taken = new Set<number>()
  const served = new Set(plan.served)
  const items: FeedSlot[] = []
  let pointer = plan.spinePointer
  const push = (cut: CutInfo | null, laneKey: string | null) => {
    if (!cut) return false
    taken.add(cut.id)
    items.push({ cutId: cut.id, laneKey, clause: cut.clause, kind: 'hors' })
    return true
  }
  const d0 = ctx.cuts.find((cut) => cut.id === ctx.d0CutId) || null
  const pushD0 = () => push(d0 && !taken.has(d0.id) ? d0 : null, null)
  const addSpine = (count: number) => {
    for (const cut of spine(count, ctx, pointer, taken, served)) {
      push(cut, null)
      pointer = Math.max(pointer, cut.clause || pointer)
    }
  }
  const lane = (key: string) => {
    const cut = bestCut(key, ctx, taken, served, firstWeek)
    return push(cut, key)
  }

  if (!L1) {
    pushD0()
    addSpine(6)
  } else if (plan.spineFirst) {
    if (!lane(L1.lane)) pushD0()
    addSpine(6)
  } else if (L2) {
    const A = plan.lead === L1.lane || plan.lead === L2.lane ? plan.lead : L1.lane
    const B = A === L1.lane ? L2.lane : L1.lane
    let missing = 0
    for (const key of [A, B, A, B]) if (!lane(key)) missing += 1
    addSpine(3 + missing)
  } else {
    let missing = 0
    for (let i = 0; i < 4; i += 1) if (!lane(L1.lane)) missing += 1
    addSpine(3 + missing)
  }
  return { items, spinePointer: pointer, L1: L1?.lane || null, L2: L2?.lane || null }
}

/** What the device sends in a feed request: lane scores, the lead lane and the spine-first choice. No taps, no scales. */
export function planFrom(state: HeartState, ctx: RouteContext, options: { justShow?: boolean } = {}): FeedPlan {
  const answered = state.taps.filter((tap) => tap.option !== 'pass').length
  const useDefault = answered === 0 || (options.justShow && answered < 2)
  const scores = useDefault ? [] : scoreLanes(state, ctx)
  return {
    laneScores: Object.fromEntries(scores.map((row) => [row.lane, row.score])),
    lead: state.intentLane,
    spineFirst: useDefault ? false : Boolean(state.spineFirst),
    served: state.served.slice(-50),
    spinePointer: state.spinePointer,
    firstOpenAt: state.firstOpenAt,
  }
}

/** The whole route on one device: score, pick, build. */
export function routeFeed(state: HeartState, ctx: RouteContext, options: { justShow?: boolean } = {}) {
  const plan = planFrom(state, ctx, options)
  return { plan, ...buildFeed(plan, ctx), scores: scoreLanes(state, ctx) }
}

/** Marks cuts as served and moves the spine pointer once a feed is handed over. */
export function markServed(state: HeartState, items: FeedSlot[], spinePointer: number, at = Date.now()): HeartState {
  const ids = items.map((item) => String(item.cutId))
  const day = new Date(at).toISOString().slice(0, 10)
  const before = state.recent && state.recent.day === day ? state.recent.ids : []
  return { ...state, served: [...state.served, ...ids].slice(-50), recent: { day, ids: [...before, ...ids].slice(-20) }, spinePointer, updatedAt: at }
}

/** Starting clause from portal placing (section 3.6): the hand-off begins at that clause. */
export function spineStart(startingClause: number | null | undefined) {
  return startingClause ? Math.max(0, startingClause - 1) : 0
}
