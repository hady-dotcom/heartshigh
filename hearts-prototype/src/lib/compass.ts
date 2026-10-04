// The private compass: soft words for the learner, signed rungs for staff, and steering toward
// the scales that sit below the middle. Pure. No learner string in here carries a number.

import { SCALE_KEYS, type ScaleKey } from './heart'
import { toRung } from './persona'
import type { CompassCopy, Frame, PlaceCopy } from './compass-data'
import { DEFAULT_COPY } from './compass-data'

export type AreaReading = { scale: ScaleKey; focus: string; rung: number }

export type LearnerCompass = {
  kind: 'path'
  focusLine: string | null
  areas: { area: string; place: string | null; forward: string }[]
  steps: { title: string; detail: string }[]
  talks: { title: string; href: string }[]
  movement: string[]
}

export type SteerTag = { scale: ScaleKey; weight: number }
export type AttemptPoint = { at: number; scales: Partial<Record<ScaleKey, number>> }
export type WatchedItem = { at: number; title: string; scales: ScaleKey[] }

export type Attribution = {
  scale: ScaleKey
  from: number
  to: number
  delta: number
  talks: string[]
}

export type PortalScale = {
  scale: ScaleKey
  learners: number
  meanThen: number | null
  meanNow: number | null
  helpedBy: { title: string; lifts: number }[]
}

const SCORE_KEY = /^(score|scores|deficit|rung|rank|persona|personakey|scales|delta|from|to|meanthen|meannow)$/i
const NEGATIVE = /-\d/
const DUST = /\b(anger|greed|ego|desire|resentment|deficit|persona|score|rank)\b/i

/** A month, counted as thirty days. */
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000

export function recalibrationDue(latestAt: number | null, nowMs: number) {
  if (latestAt == null) return false
  return nowMs - latestAt >= MONTH_MS
}

export function placeFor(rung: number, places: PlaceCopy[]) {
  const ordered = [...places].sort((a, b) => a.low - b.low)
  return ordered.find((place) => rung >= place.low && rung <= place.high) || ordered[0]
}

export function focusLine(lead: string, names: string[]) {
  const clean = names.map((name) => name.trim()).filter(Boolean)
  if (!clean.length) return null
  return `${lead.replace(/[:\s]+$/, '')}: ${clean.join(', ')}`
}

/** Pulls a life-event scale toward the area to grow, for steering only. The stored reading is left alone. */
export function withLife<T extends Partial<Record<ScaleKey, number>>>(reading: T, boost: ScaleKey | null): T {
  if (!boost) return reading
  const current = reading[boost]
  const pulled = current == null ? -0.4 : Math.min(current, -0.4)
  return { ...reading, [boost]: pulled }
}

/** Pulls every life-event scale, without changing the stored reading. */
export function withLives<T extends Partial<Record<ScaleKey, number>>>(reading: T, boosts: ScaleKey[]): T {
  return boosts.reduce((current, scale) => withLife(current, scale), reading)
}

export function summarise(input: {
  copy?: CompassCopy
  now: AreaReading[]
  before?: AreaReading[] | null
  talks: { title: string; href: string; scales: SteerTag[] }[]
  frame?: Frame
}): LearnerCompass {
  const copy = input.copy || DEFAULT_COPY
  const frame = input.frame || copy.frame
  const places = copy.places.length ? copy.places : DEFAULT_COPY.places
  const ranked = [...input.now].sort((a, b) => a.rung - b.rung || a.focus.localeCompare(b.focus))
  const growing = ranked.filter((row) => placeFor(row.rung, places)?.key === 'growing')
  const focusNames = (growing.length ? growing : ranked.slice(0, 2)).slice(0, 3).map((row) => row.focus)
  const showPlaces = frame !== 'focusing'
  const showFocus = frame !== 'places'
  const areas = ranked.map((row) => {
    const place = placeFor(row.rung, places)
    return {
      area: row.focus,
      place: showPlaces && place ? place.label : null,
      forward: (place?.forward || '').replaceAll('{area}', row.focus),
    }
  })
  const stepRows = (growing.length ? growing : ranked).slice(0, 3)
  const steps = stepRows.map((row) => {
    const place = placeFor(row.rung, places)
    return { title: row.focus, detail: (place?.forward || '').replaceAll('{area}', row.focus) }
  })
  const fillers = [
    { title: 'One short clip', detail: 'Watch one short clip and notice what stays with you.' },
    { title: 'A second sitting', detail: 'Come back to one more clip when you have a quiet moment.' },
  ]
  for (const filler of fillers) {
    if (steps.length >= 2) break
    steps.push(filler)
  }
  const reading = Object.fromEntries(input.now.map((row) => [row.scale, row.rung / 10])) as Partial<Record<ScaleKey, number>>
  const talks = steer(input.talks, reading, 3).map((talk) => ({ title: talk.title, href: talk.href }))
  return {
    kind: 'path',
    focusLine: showFocus ? focusLine(copy.focusLead, focusNames) : null,
    areas,
    steps: steps.slice(0, 3),
    talks,
    movement: movementLines(copy, input.now, input.before || null, places),
  }
}

function movementLines(copy: CompassCopy, now: AreaReading[], before: AreaReading[] | null, places: PlaceCopy[]) {
  if (!before?.length) return []
  const order = ['growing', 'steady', 'flourishing']
  const prev = new Map(before.map((row) => [row.scale, row]))
  const lines: string[] = []
  for (const row of now) {
    const old = prev.get(row.scale)
    if (!old) continue
    const then = placeFor(old.rung, places)?.key
    const current = placeFor(row.rung, places)?.key
    if (!then || !current) continue
    const delta = order.indexOf(current) - order.indexOf(then)
    const template = delta > 0 ? copy.movementUp : delta < 0 ? copy.movementOnward : copy.movementSame
    lines.push(template.replaceAll('{area}', row.focus))
  }
  return lines.slice(0, 4)
}

/**
 * Orders talks toward the scales below the middle. A second deficit scale is kept in the set
 * so the path is not three talks on the single weakest scale.
 */
export function steer<T extends { scales: SteerTag[] }>(items: T[], reading: Partial<Record<ScaleKey, number>>, take = 3): T[] {
  const deficit = (scale: ScaleKey) => Math.max(0, -(reading[scale] ?? 0))
  const scoreOf = (item: T) => item.scales.reduce((sum, tag) => sum + deficit(tag.scale) * (tag.weight || 0), 0)
  const primaryOf = (item: T) =>
    item.scales.slice().sort((a, b) => deficit(b.scale) * b.weight - deficit(a.scale) * a.weight)[0]?.scale
  const ranked = items.map((item, index) => ({ item, index, score: scoreOf(item) })).sort((a, b) => b.score - a.score || a.index - b.index)
  const picked: T[] = []
  const used = new Set<ScaleKey>()
  for (const row of ranked) {
    if (picked.length >= take) break
    const primary = primaryOf(row.item)
    if (!primary || deficit(primary) <= 0 || used.has(primary)) continue
    picked.push(row.item)
    used.add(primary)
  }
  for (const row of ranked) {
    if (picked.length >= take) break
    if (!picked.includes(row.item) && row.score > 0) picked.push(row.item)
  }
  for (const row of ranked) {
    if (picked.length >= take) break
    if (!picked.includes(row.item)) picked.push(row.item)
  }
  return picked.slice(0, take)
}

/** Walks a learner payload. A number, a negative position, or a score-shaped key is a leak. */
export function rawScoreLeak(value: unknown): string | null {
  const walk = (node: unknown): string | null => {
    if (typeof node === 'number') return 'number'
    if (typeof node === 'string') {
      if (NEGATIVE.test(node)) return 'negative'
      if (DUST.test(node)) return 'label'
      return null
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = walk(item)
        if (hit) return hit
      }
      return null
    }
    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
        if (SCORE_KEY.test(key)) return key
        const hit = walk(child)
        if (hit) return hit
      }
    }
    return null
  }
  return walk(value)
}

/**
 * Simple attribution. For each pair of attempts, a scale that sat below zero is paired with
 * talks watched in between that carry that scale. The change is the next rung minus this one.
 */
export function attribute(attempts: AttemptPoint[], watched: WatchedItem[]): Attribution[] {
  const ordered = [...attempts].sort((a, b) => a.at - b.at)
  const rows: Attribution[] = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const prev = ordered[index]
    const next = ordered[index + 1]
    const between = watched.filter((item) => item.at >= prev.at && item.at < next.at)
    for (const scale of SCALE_KEYS) {
      const before = prev.scales[scale]
      const after = next.scales[scale]
      if (before == null || after == null || before >= 0) continue
      const from = toRung(before)
      const to = toRung(after)
      if (from == null || to == null) continue
      const talks = [...new Set(between.filter((item) => item.scales.includes(scale)).map((item) => item.title))]
      rows.push({ scale, from, to, delta: to - from, talks })
    }
  }
  return rows
}

function mean(values: number[]) {
  if (!values.length) return null
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export function portalSummary(people: { attempts: AttemptPoint[]; watched: WatchedItem[] }[]): PortalScale[] {
  return SCALE_KEYS.map((scale) => {
    const latest: number[] = []
    const earlier: number[] = []
    const lifts = new Map<string, number>()
    for (const person of people) {
      const ordered = [...person.attempts].filter((row) => row.scales[scale] != null).sort((a, b) => a.at - b.at)
      if (!ordered.length) continue
      const last = toRung(ordered[ordered.length - 1].scales[scale]!)
      if (last == null) continue
      latest.push(last)
      if (ordered.length > 1) {
        const first = toRung(ordered[0].scales[scale]!)
        if (first != null) earlier.push(first)
      }
      for (const row of attribute(person.attempts, person.watched)) {
        if (row.scale !== scale || row.delta <= 0) continue
        for (const title of row.talks) lifts.set(title, (lifts.get(title) || 0) + 1)
      }
    }
    return {
      scale,
      learners: latest.length,
      meanThen: mean(earlier),
      meanNow: mean(latest),
      helpedBy: [...lifts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([title, lifts]) => ({ title, lifts })),
    }
  })
}
