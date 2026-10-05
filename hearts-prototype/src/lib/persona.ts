// Persona bands for the master lens (spec 5.3). Pure, and never used to route a learner.
// A persona is not written onto a person, a heart state or a contribution. These functions only answer
// "which published bands contain this reading?" and "how many people, with no names attached?".

import { SCALE_KEYS, type ScaleKey } from './heart'

export type RangeRow = {
  scale: ScaleKey
  /** False when the source table has no row for this scale. It is not tested, and the band cannot be published. */
  present: boolean
  /** Inclusive bounds on Leon's −10..+10 rungs. Null while the row is still empty. */
  min: number | null
  max: number | null
}

export type PersonaSource = 'doc-a' | 'doc-b' | 'doc-c' | 'ux-draft' | 'unassigned' | 'balanced'

export type PersonaBand = {
  key: string
  title: string
  status: 'draft' | 'published'
  source: PersonaSource
  /** True while the numbers are a stand-in, not a figure copied from Leon. */
  placeholder: boolean
  identicalGroup: string
  note: string
  ranges: RangeRow[]
  /** 2 once the band is the balanced reading in PERSONA-BALANCING.md. */
  version?: number
  description?: string
  doors?: number[]
  talks?: string[]
}

/** A phone reading: the heart state's `s` values, each in −1..+1. Not rungs. */
export type Reading = Partial<Record<ScaleKey, number>>

export const RUNG_LO = -10
export const RUNG_HI = 10

/** Spec 5.3: a persona cell is shown only at this many people. Chapter trends stay at 10. */
export const PERSONA_MIN = 20

/** Maps a device reading onto a rung. 0.3 on the phone is 3 on the ladder. */
export function toRung(value: number) {
  if (!Number.isFinite(value)) return null
  const clamped = Math.min(1, Math.max(-1, value))
  return Math.round(clamped * 10)
}

/** The ranges that decide whether two bands say the same thing. Order does not matter. */
export function signature(band: PersonaBand) {
  return band.ranges
    .filter((row) => row.present)
    .map((row) => `${row.scale}:${row.min ?? ''}:${row.max ?? ''}`)
    .sort()
    .join('|')
}

export function hasBounds(band: PersonaBand) {
  return band.ranges.some((row) => row.present && row.min != null && row.max != null)
}

/** Another band whose present ranges are the same, or null. */
export function sameRangeAs(band: PersonaBand, others: PersonaBand[]) {
  if (!hasBounds(band)) return null
  const sig = signature(band)
  return others.find((other) => other.key !== band.key && signature(other) === sig) || null
}

/**
 * Why a band cannot be published. Drafts are allowed to be incomplete; this list is what the publish step refuses.
 * The step-2 rule asks for every included scale to have been read. See BALANCE_NOTES in persona-data.ts.
 */
export function publishProblems(band: PersonaBand, others: PersonaBand[]) {
  const problems: string[] = []
  if (band.placeholder) problems.push('Untick “Stand-in numbers” once the ranges are the real ones.')
  const seen = new Set(band.ranges.map((row) => row.scale))
  if (SCALE_KEYS.some((key) => !seen.has(key)) || seen.size !== SCALE_KEYS.length) problems.push('Every scale needs a row, including scales the source left out.')
  const missing = band.ranges.filter((row) => !row.present).map((row) => row.scale)
  if (missing.length) problems.push(`Still missing a source row: ${missing.join(', ')}.`)
  for (const row of band.ranges) {
    if (!row.present) continue
    if (row.min == null || row.max == null) problems.push(`${row.scale} has no range yet.`)
    else if (!Number.isInteger(row.min) || !Number.isInteger(row.max) || row.min < RUNG_LO || row.max > RUNG_HI || row.min > row.max) {
      problems.push(`${row.scale} needs a whole-number range from −10 to +10, low then high.`)
    }
  }
  const twin = sameRangeAs(band, others)
  if (twin) problems.push(`These ranges are the same as ${twin.title}.`)
  return problems
}

function inRange(reading: Reading, row: RangeRow) {
  if (!row.present || row.min == null || row.max == null) return false
  const raw = reading[row.scale]
  if (raw == null || !Number.isFinite(raw)) return false
  const rung = toRung(raw)
  return rung != null && rung >= row.min && rung <= row.max
}

/**
 * Published bands that contain the reading. A band matches only when every scale it includes was read and
 * falls inside the range. Drafts never match. Two published bands with the same ranges match nobody.
 * The reading object is not changed.
 */
export function matchPersonas(reading: Reading, bands: PersonaBand[]) {
  const published = bands.filter((band) => band.status === 'published')
  const hits: string[] = []
  for (const band of published) {
    if (publishProblems(band, published.filter((other) => other.key !== band.key)).length) continue
    if (band.ranges.every((row) => inRange(reading, row))) hits.push(band.key)
  }
  return hits
}

/** True when some scale's ranges cannot both contain the same rung. */
export function rangesDisjoint(a: PersonaBand, b: PersonaBand) {
  return a.ranges.some((row) => {
    const other = b.ranges.find((item) => item.scale === row.scale)
    if (!row.present || !other?.present || row.min == null || row.max == null || other.min == null || other.max == null) return false
    return row.max < other.min || other.max < row.min
  })
}

/**
 * The published band that contains the reading, or the nearest one when the reading sits outside every box.
 * Used on the desk charts. Never shown to the learner.
 */
export function nearestPersona(reading: Reading, bands: PersonaBand[]) {
  const hits = matchPersonas(reading, bands)
  if (hits[0]) return hits[0]
  const published = bands.filter((band) => band.status === 'published' && publishProblems(band, bands.filter((other) => other.key !== band.key)).length === 0)
  let best: { key: string; dist: number } | null = null
  for (const band of published) {
    let dist = 0
    let seen = 0
    for (const row of band.ranges) {
      if (!row.present || row.min == null || row.max == null) continue
      const raw = reading[row.scale]
      if (raw == null || !Number.isFinite(raw)) {
        dist += 20
        continue
      }
      const rung = toRung(raw)
      if (rung == null) continue
      seen += 1
      if (rung < row.min) dist += row.min - rung
      else if (rung > row.max) dist += rung - row.max
    }
    if (!seen) continue
    if (!best || dist < best.dist) best = { key: band.key, dist }
  }
  return best?.key || null
}

export type PersonaCell = { group: string; persona: string; count: number; people: number; shown: boolean; share: number | null }

/** Counts per persona per group. Cells under PERSONA_MIN are marked hidden; the count stays for the desk to withhold. */
export function tallyPersonas(rows: { group: string; reading: Reading }[], bands: PersonaBand[]): PersonaCell[] {
  const people = new Map<string, number>()
  const counts = new Map<string, number>()
  for (const row of rows) {
    people.set(row.group, (people.get(row.group) || 0) + 1)
    for (const key of matchPersonas(row.reading, bands)) {
      const cell = `${row.group}\u0000${key}`
      counts.set(cell, (counts.get(cell) || 0) + 1)
    }
  }
  const cells: PersonaCell[] = []
  for (const [cell, count] of counts) {
    const [group, persona] = cell.split('\u0000')
    const total = people.get(group) || 0
    const shown = count >= PERSONA_MIN
    cells.push({ group, persona, count, people: total, shown, share: shown && total ? Math.round((count / total) * 20) * 5 : null })
  }
  return cells.sort((a, b) => a.group.localeCompare(b.group) || b.count - a.count || a.persona.localeCompare(b.persona))
}

const SOURCES: PersonaSource[] = ['doc-a', 'doc-b', 'doc-c', 'ux-draft', 'unassigned', 'balanced']

/** A stored row, from the CMS or the seed, turned into the shape the functions use. Missing scales are filled in as absent. */
export function bandFromRow(row: {
  key?: string | null
  title?: string | null
  status?: string | null
  source?: string | null
  placeholder?: boolean | null
  identicalGroup?: string | null
  note?: string | null
  ranges?: { scale?: string | null; present?: boolean | null; min?: number | null; max?: number | null }[] | null
  version?: number | null
  description?: string | null
  doors?: number[] | null
  talks?: string[] | null
}): PersonaBand {
  const byScale = new Map((row.ranges || []).map((item) => [item.scale, item]))
  const doors = (row.doors || []).map((door) => Number(door)).filter((door) => Number.isInteger(door))
  const talks = (row.talks || []).map((talk) => String(talk)).filter(Boolean)
  return {
    key: row.key || '',
    title: row.title || '',
    status: row.status === 'published' ? 'published' : 'draft',
    source: SOURCES.includes(row.source as PersonaSource) ? (row.source as PersonaSource) : 'unassigned',
    placeholder: row.placeholder !== false,
    identicalGroup: row.identicalGroup || '',
    note: row.note || '',
    version: typeof row.version === 'number' ? row.version : undefined,
    description: row.description || row.note || '',
    doors,
    talks,
    ranges: SCALE_KEYS.map((scale) => {
      const found = byScale.get(scale)
      return {
        scale,
        present: Boolean(found?.present),
        min: typeof found?.min === 'number' && Number.isFinite(found.min) ? found.min : null,
        max: typeof found?.max === 'number' && Number.isFinite(found.max) ? found.max : null,
      }
    }),
  }
}
