import assert from 'node:assert/strict'
import { test } from 'node:test'
import { doorByNumber, doorOfClause } from './doors'
import { areaOfDoor } from './garden-areas'
import { laneDoors, laneExcludedDoors } from './heart'
import { laneGardenCopy } from './lanes'
import { LANES } from './opening-data'

/**
 * The lanes used to name clauses 1–41. Each clause already sits on one door.
 * A lane keeps the best rank when several of its clauses share a door.
 */
const ORIGIN: Record<string, { clauses: [number, number][]; exclude: number[] }> = {
  trust: { clauses: [[27, 1], [22, 2], [15, 3]], exclude: [26, 31, 32, 33, 34, 35] },
  company: { clauses: [[2, 1], [4, 2], [8, 2], [37, 3], [9, 3]], exclude: [] },
  lightness: { clauses: [[16, 1], [35, 2], [27, 3]], exclude: [] },
  quiet: { clauses: [[31, 1], [33, 2], [39, 2], [35, 3]], exclude: [] },
  talking: { clauses: [[22, 1], [21, 2], [30, 2], [29, 3], [31, 3]], exclude: [] },
  habits: { clauses: [[15, 1], [17, 1], [1, 2], [10, 2], [36, 3]], exclude: [] },
  patience: { clauses: [[20, 1], [17, 1], [37, 2], [6, 3]], exclude: [] },
  gifts: { clauses: [[27, 1], [1, 2], [16, 3]], exclude: [] },
  mercy: { clauses: [[6, 1], [4, 2], [8, 2], [16, 3], [10, 3]], exclude: [] },
  'guarding-gaze': { clauses: [[31, 1], [29, 2], [17, 2]], exclude: [] },
}

function collapse(pairs: [number, number][]) {
  const best = new Map<number, number>()
  for (const [clause, rank] of pairs) {
    const door = doorOfClause(clause)!.number
    best.set(door, Math.min(best.get(door) ?? rank, rank))
  }
  return [...best.entries()].map(([door, rank]) => ({ door, rank })).sort((a, b) => a.rank - b.rank || a.door - b.door)
}

test('each lane’s doors are the doors of its old clauses, and routing reads those doors', () => {
  assert.equal(LANES.length, Object.keys(ORIGIN).length)
  for (const lane of LANES) {
    const origin = ORIGIN[lane.key]
    assert.ok(origin, lane.key)
    const doors = collapse(origin.clauses)
    assert.deepEqual(lane.doors, doors, lane.key)
    assert.deepEqual(laneDoors(lane), doors, lane.key)
    const excluded = [...new Set(origin.exclude.map((clause) => doorOfClause(clause)!.number))].sort((a, b) => a - b)
    assert.deepEqual([...(lane.excludeDoors || [])].sort((a, b) => a - b), excluded, lane.key)
    assert.deepEqual(laneExcludedDoors(lane), excluded, lane.key)
    for (const row of doors) {
      assert.ok(row.door >= 1 && row.door <= 20, `${lane.key} door ${row.door}`)
      const covered = new Set(doorByNumber(row.door)!.clauses)
      for (const clause of lane.clauses.filter((item) => item.rank === row.rank).map((item) => item.clause)) {
        if (covered.has(clause)) assert.equal(doorOfClause(clause)?.number, row.door)
      }
    }
    const grown = laneGardenCopy(lane)
    assert.equal(grown.tree, areaOfDoor(doors[0].door)?.title, lane.key)
    assert.equal(grown.doorNames.length, doors.length, lane.key)
    assert.match(`Grows your ${grown.tree} tree`, /^Grows your .+ tree$/)
  }
})
