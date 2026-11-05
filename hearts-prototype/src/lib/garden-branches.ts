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
  /** Which edge of the label sits on the tip, so the word grows back onto the tree. */
  align: 'start' | 'center' | 'end'
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

/**
 * Where a label sits once its edge is pinned to the twig tip.
 * The back-right planter (Iman) is centred past the right of a phone, so its words
 * have to hang back into the part of the tree that is still on screen.
 */
export function branchLabelBounds(input: { padX: number; tipX: number; align: GardenBranch['align']; sceneWidth: number; labelWidth: number }) {
  const treeWidth = input.sceneWidth * 0.5
  const treeLeft = (input.padX / 100) * input.sceneWidth - treeWidth / 2
  const tip = treeLeft + treeWidth * (input.tipX / 100)
  const left = input.align === 'end' ? tip - input.labelWidth : input.align === 'start' ? tip : tip - input.labelWidth / 2
  return { left, right: left + input.labelWidth }
}

/** Twigs fan into the open side of the planter. Back-row trees stay higher so they clear the row in front. */
function slots(count: number, art: GardenArtId) {
  const align: GardenBranch['align'] = art === 'quran' || art === 'hadith' ? 'start' : art === 'character' ? 'center' : 'end'
  const back = art === 'spirituality' || art === 'quran'
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    // Iman reuses the back-right planter, whose right half is off a 360-wide phone.
    const tipX = align === 'center' ? 40 + t * 20 : align === 'end' ? (art === 'spirituality' ? 46 + t * 16 : 58 + t * 10) : 16 + t * 12
    const tipY = back ? 22 + t * 18 : 34 + t * 16
    const cX = (50 + tipX) / 2
    const cY = (74 + tipY) / 2 - 6
    return {
      d: `M 50 74 Q ${round(cX)} ${round(cY)} ${round(tipX)} ${round(tipY)}`,
      tipX: round(tipX),
      tipY: round(tipY),
      align,
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
        align: slot.align,
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
