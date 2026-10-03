// Network and chapter trends from opted-in contributions (spec 5.4). No path aliases: the unit tests run this directly.
import { idOf } from './ids'

/** Contributions are shown only where at least this many people took part. */
export const TRENDS_MIN = 10

export type Contribution = { portal?: unknown; isoWeek?: string; doorKey?: string; scenePasses?: string[] | null; laneTop2?: string[] | null }

/** Counts per week and portal, with every group under TRENDS_MIN held back. */
export function trendsFrom(rowsIn: Contribution[], portalId?: number) {
  const groups = new Map<string, Contribution[]>()
  for (const row of rowsIn) {
    if (portalId && idOf(row.portal) !== portalId) continue
    const key = row.isoWeek || 'unknown'
    groups.set(key, [...(groups.get(key) || []), row])
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([week, items]) => {
      if (items.length < TRENDS_MIN) return { week, people: items.length, shown: false as const }
      const count = (values: string[]) => Object.entries(values.reduce<Record<string, number>>((sum, value) => ({ ...sum, [value]: (sum[value] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])
      const doors = count(items.map((row) => row.doorKey || 'none'))
      const lanes = count(items.flatMap((row) => row.laneTop2 || []))
      const passes = count(items.flatMap((row) => row.scenePasses || []))
      return { week, people: items.length, shown: true as const, doors, lanes, passes }
    })
}

