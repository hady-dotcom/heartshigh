import { capitalAfterColon, doorByNumber } from './doors'
import { GARDEN_AREAS, areaOfDoor, type GardenAreaId, type GardenArtId } from './garden-areas'
import { laneDoors } from './heart'
import { getLaneProgress, type LaneProgress } from './lane-progress'
import { laneGardenCopy } from './lanes'
import { LANE_BLURBS, LANES } from './opening-data'

export type GardenBranch = {
  id: string
  title: string
  /** Short name painted on the twig. The sheet uses the full title. */
  label: string
  areaId: GardenAreaId
  href: string
  done: number
  total: number
  minutes: number
  /** 0 to 1. A bare twig is 0. A full branch is 1. */
  fill: number
  example: string
  /** Tip of the twig, percent of the tree canvas. */
  tipX: number
  tipY: number
  d: string
}

/** Share of the branch that has grown. */
export function branchFill(progress: Pick<LaneProgress, 'done' | 'total'>) {
  const done = Number(progress.done) || 0
  const total = Number(progress.total) || 0
  if (total <= 0 || done <= 0) return 0
  return Math.min(1, done / total)
}

function round(n: number) {
  return Math.round(n * 10) / 10
}

/** One word on the twig. The plaque sheet keeps the full lane name. */
function branchLabel(title: string) {
  if (title === 'Good company') return 'Company'
  if (title === 'Lightness and giving') return 'Giving'
  if (title === 'Quiet heart') return 'Quiet'
  if (title === 'Talking to Allah') return 'Talking'
  if (title === 'Small steady habits') return 'Habits'
  if (title === 'Noticing gifts') return 'Gifts'
  return title.split(' ')[0]
}

/** Twigs fan into the open side of the planter. Back-row trees stay higher so they clear the row in front. */
function slots(count: number, art: GardenArtId) {
  const side: -1 | 0 | 1 = art === 'quran' || art === 'hadith' ? -1 : art === 'character' ? 0 : 1
  const back = art === 'spirituality' || art === 'quran'
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const tipX = side === 0 ? 38 + t * 24 : 50 + side * (16 + t * 10)
    const tipY = back ? 18 + t * 16 : 36 + t * 16
    const cX = (50 + tipX) / 2
    const cY = (74 + tipY) / 2 - 6
    return {
      d: `M 50 74 Q ${round(cX)} ${round(cY)} ${round(tipX)} ${round(tipY)}`,
      tipX: round(tipX),
      tipY: round(tipY),
    }
  })
}

function readProgress(value: { done?: number; total?: number; minutes?: number; minutesWatched?: number }) {
  const minutesWatched = 'minutesWatched' in value ? value.minutesWatched : undefined
  return {
    done: Number(value.done) || 0,
    total: Number(value.total) || 0,
    minutes: Number(value.minutes ?? minutesWatched) || 0,
  }
}

/**
 * One branch per lane, on the tree of its best-ranked door.
 * Opt-in lanes stay off the garden. The link is the lane page, /lanes/[id].
 * Progress comes from getLaneProgress. A missing or empty count leaves a bare twig.
 */
export async function gardenBranches(base: string): Promise<GardenBranch[]> {
  const chosen = LANES.filter((lane) => !lane.optInOnly)
  const placed = chosen.flatMap((lane) => {
    const ranked = laneDoors(lane)
    const area = ranked.length ? areaOfDoor(ranked[0].door) : null
    if (!area) return []
    return [{ lane, areaId: area.id }]
  })
  const byArea = new Map<GardenAreaId, typeof placed>()
  for (const row of placed) {
    const list = byArea.get(row.areaId) || []
    list.push(row)
    byArea.set(row.areaId, list)
  }
  const branches: GardenBranch[] = []
  for (const area of GARDEN_AREAS) {
    const rows = byArea.get(area.id) || []
    const geometry = slots(rows.length, area.art)
    for (const [index, row] of rows.entries()) {
      const progress = readProgress(await Promise.resolve(getLaneProgress(row.lane.key)))
      const grown = laneGardenCopy(row.lane)
      const slot = geometry[index]
      branches.push({
        id: row.lane.key,
        title: row.lane.title,
        label: branchLabel(row.lane.title),
        areaId: area.id,
        href: `${base}/lanes/${row.lane.key}`,
        done: progress.done,
        total: progress.total,
        minutes: progress.minutes,
        fill: branchFill(progress),
        example: LANE_BLURBS[row.lane.key] || grown.doorNames[0] || row.lane.title,
        tipX: slot.tipX,
        tipY: slot.tipY,
        d: slot.d,
      })
    }
  }
  return branches
}

export function doorNamesForArea(areaId: GardenAreaId) {
  const area = GARDEN_AREAS.find((row) => row.id === areaId)
  if (!area) return []
  return area.doors.flatMap((number) => {
    const door = doorByNumber(number)
    return door ? [{ number, title: capitalAfterColon(door.title) }] : []
  })
}
