import { LANES } from './opening-data'

/**
 * How far one learner has walked a lane.
 *
 * This is a stub. The lane page owns the real count and replaces this function.
 * The name and the three fields stay, so the garden can fill a branch either way.
 * `done` and `total` are units. `minutes` is time watched.
 */
export type LaneProgress = {
  done: number
  total: number
  minutes: number
}

export function getLaneProgress(laneId: string): LaneProgress {
  const lane = LANES.find((row) => row.key === laneId)
  const total = Math.max(1, lane?.doors?.length || 0)
  return { done: 0, total, minutes: 0 }
}
