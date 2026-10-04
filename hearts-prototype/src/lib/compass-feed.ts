// Deficit, strength and discovery. The mix is real: quotas use the largest-remainder method,
// and every picked talk carries a sentence a portal admin or an imam can read.

import type { LifeEvent } from './compass-bank'
import { doorByNumber } from './doors'
import type { ScaleKey } from './heart'

export type Mix = { deficit: number; strength: number; discovery: number }

export const DEFAULT_MIX: Mix = { deficit: 60, strength: 25, discovery: 15 }

/** The remedy door for a scale, from scales-to-jibril.md. Gratitude leans on qadr (W15), not fasting. */
export const SCALE_DOOR: Record<ScaleKey, number> = {
  desire: 16,
  greed: 6,
  anger: 7,
  ego: 16,
  worry: 15,
  belonging: 2,
  gratitude: 15,
  faith: 10,
  compassion: 6,
  discipline: 5,
}

export const SCALE_NAME: Record<ScaleKey, string> = {
  desire: 'Desire',
  greed: 'Greed',
  anger: 'Anger',
  ego: 'Ego',
  worry: 'Worry',
  belonging: 'Belonging',
  gratitude: 'Gratitude',
  faith: 'Faith',
  compassion: 'Compassion',
  discipline: 'Discipline',
}

export type FeedKind = 'hors' | 'appetiser' | 'course' | 'talk'

export type FeedCandidate = {
  id: string
  title: string
  href: string
  kind: FeedKind
  door: number | null
  scales: { scale: ScaleKey; weight: number }[]
}

export type RankedTalk = FeedCandidate & { bucket: 'deficit' | 'strength' | 'discovery'; why: string }

function clampShare(value: unknown, fallback: number) {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(100, Math.max(0, number))
}

/** Shares that sum to `total`, by the largest remainder. */
export function largestRemainder(weights: number[], total: number) {
  const sum = weights.reduce((acc, value) => acc + value, 0)
  if (total <= 0) return weights.map(() => 0)
  if (sum <= 0) return weights.map((_, index) => (index === 0 ? total : 0))
  const exact = weights.map((weight) => (total * weight) / sum)
  const floors = exact.map((value) => Math.floor(value))
  let left = total - floors.reduce((acc, value) => acc + value, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const row of order) {
    if (left <= 0) break
    floors[row.index] += 1
    left -= 1
  }
  return floors
}

export function normaliseMix(input?: Partial<Mix> | null): Mix {
  const raw = [clampShare(input?.deficit, DEFAULT_MIX.deficit), clampShare(input?.strength, DEFAULT_MIX.strength), clampShare(input?.discovery, DEFAULT_MIX.discovery)]
  const [deficit, strength, discovery] = largestRemainder(raw, 100)
  return { deficit, strength, discovery }
}

export function quotas(take: number, mix?: Partial<Mix> | null) {
  const normal = normaliseMix(mix)
  const [deficit, strength, discovery] = largestRemainder([normal.deficit, normal.strength, normal.discovery], Math.max(0, take))
  return { deficit, strength, discovery }
}

/** "Door 7, Fasting Ramadan". A missing door is left out, never "Door X". */
export function doorPhrase(number: number) {
  if (!Number.isInteger(number) || number < 1) return ''
  const door = doorByNumber(number)
  if (!door) return ''
  const title = door.title.split(':')[0].trim()
  return title ? `Door ${number}, ${title}` : ''
}

/** Jan … Sep. en-GB short months say "Sept", which clashes with May and Jun. */
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthShort(at: number | string) {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return MONTH_SHORT[date.getUTCMonth()]
}

export function compassDate(at: number | string) {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`
}

export function kindLabel(kind: string) {
  if (kind === 'hors') return 'Short clip'
  if (kind === 'appetiser') return '3-minute clip'
  return 'Full talk'
}

const DOOR_HELP: Record<ScaleKey, string> = {
  desire: 'the gaze',
  greed: 'what we keep and what we give',
  anger: 'patience',
  ego: 'letting the credit pass',
  worry: 'trust and qadr',
  belonging: 'sitting with people',
  gratitude: 'the gift of the day',
  faith: 'drawing close',
  compassion: 'a kind hand',
  discipline: 'the prayer',
}

function withDoor(name: string, scale: ScaleKey, stem: string) {
  const door = doorPhrase(SCALE_DOOR[scale])
  return door ? `${stem} ${door} talks ${name}.` : `${stem} talks for this area ${name}.`
}

export function whyDeficit(scale: ScaleKey) {
  return tidyDesk(withDoor('get a boost', scale, `Low on ${SCALE_NAME[scale]}, so`))
}

export function whyStrength(scale: ScaleKey) {
  return tidyDesk(withDoor('stay in the mix', scale, `Steady on ${SCALE_NAME[scale]}, so`))
}

export const WHY_DISCOVERY = 'Something from another part of the sitting, so the feed is not only the quieter scales.'

/** A second door when two quiet scales would otherwise name the same one. */
const ALT_DOOR: Record<ScaleKey, number> = {
  desire: 4,
  greed: 8,
  anger: 14,
  ego: 20,
  worry: 17,
  belonging: 19,
  gratitude: 1,
  faith: 12,
  compassion: 2,
  discipline: 7,
}

/** One door each, the remedy first, then the next unused door. */
export function teachDoors(scales: ScaleKey[]) {
  const used = new Set<number>()
  return scales.map((scale) => {
    const door = [SCALE_DOOR[scale], ALT_DOOR[scale]].find((number) => !used.has(number)) ?? SCALE_DOOR[scale]
    used.add(door)
    return door
  })
}

/** Three different sentences, so Teach next does not repeat one template. */
export function teachLine(scale: ScaleKey, index: number, door = SCALE_DOOR[scale]) {
  const name = SCALE_NAME[scale]
  const phrase = doorPhrase(door)
  const help = DOOR_HELP[scale]
  const where = phrase || 'A talk in this area'
  const lines = [
    `${name} is the circle's quietest area this month. ${where} talks on ${help} would help most.`,
    `${name} is where the circle is quiet. Open ${where}, and teach ${help}.`,
    `For ${name}, start with ${where}. A talk on ${help} gives people something to hold.`,
  ]
  return tidyDesk(lines[index % lines.length])
}

/** Drops a placeholder door. A real door title is kept. */
export function tidyDesk(why: string) {
  return why
    .replace(/\bDoor X\b,?\s*/gi, '')
    .replace(/\b(undefined|null|NaN)\b/g, '')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Turns a stored working code into the door a person can teach. */
export function plainWhy(why: string) {
  const named = why.replace(/\bW(\d{1,2})\b/g, (_, number: string) => doorPhrase(Number(number)))
  return tidyDesk(named)
}

/** One row per talk. Clip kinds sit together instead of repeating the title. */
export function combineServes<T extends { title: string; kind: string; engaged?: boolean }>(rows: T[]) {
  const grouped = new Map<string, T & { kinds: string[] }>()
  for (const row of rows) {
    const key = row.title.trim().toLowerCase()
    const found = grouped.get(key)
    if (!found) {
      grouped.set(key, { ...row, kinds: [row.kind] })
      continue
    }
    if (!found.kinds.includes(row.kind)) found.kinds.push(row.kind)
    if (row.engaged) found.engaged = true
  }
  return [...grouped.values()]
}

function strongestWeight(item: FeedCandidate) {
  return item.scales.reduce((max, tag) => Math.max(max, tag.weight || 0), 0)
}

function mainScale(item: FeedCandidate) {
  const main = strongestWeight(item)
  return item.scales.find((tag) => (tag.weight || 0) === main)?.scale || null
}

/**
 * The scale a sentence may name. A lighter side tag must not speak for the talk:
 * Names Class is about faith even when a worry tag is also on it.
 */
function scaleWeCanName(item: FeedCandidate, scoreOf: (scale: ScaleKey) => number) {
  const main = strongestWeight(item)
  if (main <= 0) return null
  const named = item.scales
    .filter((tag) => scoreOf(tag.scale) > 0 && (tag.weight || 0) >= main)
    .sort((a, b) => scoreOf(b.scale) * (b.weight || 0) - scoreOf(a.scale) * (a.weight || 0))
  return named[0]?.scale || null
}

function itemScore(item: FeedCandidate, scoreOf: (scale: ScaleKey) => number) {
  return item.scales.reduce((sum, tag) => sum + scoreOf(tag.scale) * (tag.weight || 0), 0)
}

/**
 * Orders a shelf. Life events take the first deficit seat when a talk sits on their door.
 * The stored reading is not changed.
 */
export function rankFeed<T extends FeedCandidate>(
  items: T[],
  reading: Partial<Record<ScaleKey, number>>,
  options?: { take?: number; mix?: Partial<Mix> | null; life?: LifeEvent[]; recentDoors?: number[] },
): (T & { bucket: RankedTalk['bucket']; why: string })[] {
  const take = options?.take ?? 4
  const share = quotas(take, options?.mix)
  const deficitOf = (scale: ScaleKey) => Math.max(0, -(reading[scale] ?? 0))
  const strengthOf = (scale: ScaleKey) => Math.max(0, reading[scale] ?? 0)
  const life = options?.life || []
  const recent = new Set(options?.recentDoors || [])
  const used = new Set<T>()
  const picked: (T & { bucket: RankedTalk['bucket']; why: string })[] = []

  const byDeficit = items
    .map((item, index) => ({ item, index, score: itemScore(item, deficitOf), scale: scaleWeCanName(item, deficitOf) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)

  let deficitLeft = share.deficit
  if (life.length && deficitLeft > 0) {
    const lifeScales = new Set(life.flatMap((event) => event.scales))
    const row = items
      .map((item, index) => ({ item, index, scale: mainScale(item) }))
      .filter((entry) => entry.scale && lifeScales.has(entry.scale))
      .sort((a, b) => deficitOf(b.scale as ScaleKey) - deficitOf(a.scale as ScaleKey) || a.index - b.index)[0]
    if (row?.scale) {
      const event = life.find((entry) => entry.scales.includes(row.scale as ScaleKey)) || life[0]
      picked.push({ ...row.item, bucket: 'deficit', why: event.why })
      used.add(row.item)
      deficitLeft -= 1
    }
  }

  const usedScales = new Set<ScaleKey>()
  for (const row of byDeficit) {
    if (deficitLeft <= 0) break
    if (used.has(row.item) || !row.scale || deficitOf(row.scale) <= 0 || usedScales.has(row.scale)) continue
    picked.push({ ...row.item, bucket: 'deficit', why: whyDeficit(row.scale) })
    used.add(row.item)
    usedScales.add(row.scale)
    deficitLeft -= 1
  }
  for (const row of byDeficit) {
    if (deficitLeft <= 0) break
    if (used.has(row.item) || row.score <= 0 || !row.scale) continue
    picked.push({ ...row.item, bucket: 'deficit', why: whyDeficit(row.scale) })
    used.add(row.item)
    deficitLeft -= 1
  }

  const byStrength = items
    .map((item, index) => ({ item, index, score: itemScore(item, strengthOf), scale: scaleWeCanName(item, strengthOf) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
  let strengthLeft = share.strength
  for (const row of byStrength) {
    if (strengthLeft <= 0) break
    if (used.has(row.item) || row.score <= 0 || !row.scale) continue
    picked.push({ ...row.item, bucket: 'strength', why: whyStrength(row.scale) })
    used.add(row.item)
    strengthLeft -= 1
  }

  const pickedDoors = new Set(picked.map((item) => item.door).filter((door): door is number => door != null))
  const fresh = items.filter((item) => !used.has(item) && item.door != null && !recent.has(item.door) && !pickedDoors.has(item.door))
  const rest = items.filter((item) => !used.has(item) && !fresh.includes(item))
  let discoveryLeft = share.discovery
  for (const item of [...fresh, ...rest]) {
    if (discoveryLeft <= 0) break
    if (used.has(item)) continue
    picked.push({ ...item, bucket: 'discovery', why: WHY_DISCOVERY })
    used.add(item)
    discoveryLeft -= 1
  }

  return picked.slice(0, take)
}
