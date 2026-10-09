/**
 * Thompson sampling on a Bernoulli primary metric, with a traffic floor so no
 * variant drops below 10% until the experiment is finished. Plain-English verdicts
 * never name a winner on a small sample.
 */

export type Arm = {
  key: string
  label?: string
  exposures: number
  conversions: number
}

export type BanditOptions = {
  /** Exposures each arm needs before weights may shift. */
  minTraffic?: number
  /** Lowest share any arm may hold while the experiment is running. */
  floor?: number
  /** Draws used to estimate P(best). */
  draws?: number
  rng?: () => number
}

export const BANDIT_MIN_TRAFFIC = 40
export const BANDIT_FLOOR = 0.1
export const BANDIT_CLAIM_CHANCE = 0.95
export const BANDIT_CLAIM_PER_ARM = 200

export function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let next = state
    next = Math.imul(next ^ (next >>> 15), next | 1)
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61)
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296
  }
}

/** Marsaglia and Tsang's gamma sampler, shape > 0, scale 1. */
export function gammaSample(shape: number, rng: () => number): number {
  if (!(shape > 0)) return 0
  if (shape < 1) {
    const boosted = gammaSample(shape + 1, rng)
    let u = rng()
    while (u <= 0) u = rng()
    return boosted * u ** (1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x = 0
    let v = 0
    do {
      x = gauss(rng)
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rng()
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

function gauss(rng: () => number) {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function betaSample(alpha: number, beta: number, rng: () => number): number {
  const a = Math.max(1e-6, alpha)
  const b = Math.max(1e-6, beta)
  const x = gammaSample(a, rng)
  const y = gammaSample(b, rng)
  const sum = x + y
  return sum > 0 ? x / sum : 0.5
}

function rate(arm: Arm) {
  if (arm.exposures <= 0) return 0
  return Math.min(1, Math.max(0, arm.conversions / arm.exposures))
}

export function chanceOfBeingBest(arms: Arm[], options: BanditOptions = {}): Record<string, number> {
  const draws = Math.max(200, options.draws || 4000)
  const rng = options.rng || Math.random
  const wins: Record<string, number> = Object.fromEntries(arms.map((arm) => [arm.key, 0]))
  if (!arms.length) return wins
  if (arms.length === 1) {
    wins[arms[0].key] = 1
    return wins
  }
  for (let draw = 0; draw < draws; draw++) {
    let bestKey = arms[0].key
    let best = -1
    for (const arm of arms) {
      const sample = betaSample(arm.conversions + 1, Math.max(0, arm.exposures - arm.conversions) + 1, rng)
      if (sample > best) {
        best = sample
        bestKey = arm.key
      }
    }
    wins[bestKey] += 1
  }
  for (const key of Object.keys(wins)) wins[key] = wins[key] / draws
  return wins
}

export function applyFloor(weights: Record<string, number>, keys: string[], floor = BANDIT_FLOOR): Record<string, number> {
  if (!keys.length) return {}
  const share = Math.min(Math.max(0, floor), 1 / keys.length)
  const raw = keys.map((key) => Math.max(0, Number(weights[key] || 0)))
  const rawTotal = raw.reduce((sum, value) => sum + value, 0)
  if (!(rawTotal > 0)) {
    const equal = 1 / keys.length
    return Object.fromEntries(keys.map((key) => [key, equal]))
  }
  const leftover = Math.max(0, 1 - share * keys.length)
  const next: Record<string, number> = {}
  for (let index = 0; index < keys.length; index++) {
    next[keys[index]] = share + leftover * (raw[index] / rawTotal)
  }
  return next
}

/**
 * Effective weights for the next learner. Equal (or the original split) until every
 * arm has `minTraffic` exposures, then P(best) with a 10% floor.
 */
export function autoWeights(arms: Arm[], original: Record<string, number>, options: BanditOptions = {}): Record<string, number> {
  const keys = arms.map((arm) => arm.key)
  const minTraffic = options.minTraffic ?? BANDIT_MIN_TRAFFIC
  const floor = options.floor ?? BANDIT_FLOOR
  const fallback = applyFloor(
    Object.fromEntries(keys.map((key) => [key, original[key] > 0 ? original[key] : 1])),
    keys,
    0,
  )
  if (!keys.length) return {}
  if (arms.some((arm) => arm.exposures < minTraffic)) return applyFloor(fallback, keys, 0)
  const chance = chanceOfBeingBest(arms, options)
  return applyFloor(chance, keys, floor)
}

export function remainingLearners(arms: Arm[], chance: Record<string, number>): number {
  const target = BANDIT_CLAIM_PER_ARM
  const short = arms.map((arm) => Math.max(0, target - arm.exposures))
  const leader = [...arms].sort((a, b) => (chance[b.key] || 0) - (chance[a.key] || 0))[0]
  const runner = [...arms].sort((a, b) => rate(b) - rate(a))[1]
  if (!leader) return target
  const gap = runner ? Math.abs(rate(leader) - rate(runner)) : 0
  // A thin gap needs more people; a wide one still waits on the per-arm floor.
  const gapNeed = gap >= 0.15 ? 0 : gap >= 0.08 ? 80 : 180
  return Math.max(0, Math.round(Math.max(...short, gapNeed)))
}

export type Verdict = {
  text: string
  leaderKey: string | null
  chance: number
  remaining: number
  claimed: boolean
  ready: boolean
}

export function verdictFor(arms: Arm[], options: BanditOptions = {}): Verdict {
  const usable = arms.filter((arm) => arm.key)
  if (usable.length < 2) {
    return { text: 'Add at least two versions before a comparison can be made.', leaderKey: null, chance: 0, remaining: 0, claimed: false, ready: false }
  }
  const chance = chanceOfBeingBest(usable, options)
  const ranked = [...usable].sort((a, b) => (chance[b.key] || 0) - (chance[a.key] || 0))
  const leader = ranked[0]
  const p = chance[leader.key] || 0
  const remaining = remainingLearners(usable, chance)
  const named = leader.label || versionLetter(usable, leader.key)
  const thin = usable.some((arm) => arm.exposures < 50) || usable.reduce((sum, arm) => sum + arm.exposures, 0) < 80
  if (thin) {
    const need = Math.max(remaining, 80)
    return {
      text: `Too soon to say. Each version needs a steadier group of learners first. About ${need} more ${need === 1 ? 'learner' : 'learners'} would help.`,
      leaderKey: leader.key,
      chance: p,
      remaining: need,
      claimed: false,
      ready: false,
    }
  }
  const claimed = p >= BANDIT_CLAIM_CHANCE && usable.every((arm) => arm.exposures >= BANDIT_CLAIM_PER_ARM)
  const pct = Math.round(p * 100)
  if (claimed) {
    return {
      text: `${named} is ahead (about ${pct}% likely better) and the sample is large enough to treat it as the winner.`,
      leaderKey: leader.key,
      chance: p,
      remaining: 0,
      claimed: true,
      ready: true,
    }
  }
  return {
    text: `${named} is ahead (about ${pct}% likely better). Needs about ${remaining} more ${remaining === 1 ? 'learner' : 'learners'} to be sure.`,
    leaderKey: leader.key,
    chance: p,
    remaining,
    claimed: false,
    ready: false,
  }
}

export function versionLetter(arms: { key: string }[], key: string) {
  const index = arms.findIndex((arm) => arm.key === key)
  if (index < 0) return 'This version'
  return `Version ${String.fromCharCode(65 + index)}`
}

export function conversionRate(exposures: number, conversions: number) {
  if (exposures <= 0) return 0
  return conversions / exposures
}
