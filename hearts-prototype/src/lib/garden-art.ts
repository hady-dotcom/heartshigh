import type { GardenAreaId, GrowthStage } from './garden-areas'

/**
 * Painted garden frames.
 *
 * Every tree file is a 512×640 canvas. The planter's bottom-centre anchor is
 * (256, 622), the same point in every stage, so one placement fits all five.
 * Plaques in the art are blank ribbons wrapped on the round pot. Names sit on the
 * front of the ribbon. The planter never moves.
 *
 * The canopy is a second layer on that same canvas: trunk, root flare and crown.
 * It rotates about the trunk centre on the soil line. The canopy has no pixels
 * at or below that line. Medallions are children of the canopy, so they sway with it.
 */

export const TREE_FRAME = { width: 512, height: 640, anchorX: 256, anchorY: 622 }

/**
 * Trunk centre on the soil line, canvas pixels, top-left origin, y down.
 * From trees/pivots.json. x is the trunk centre; y is the soil line.
 */
const TRUNK_PIVOTS: Record<GardenAreaId, Record<GrowthStage, readonly [number, number]>> = {
  quran: { 0: [265.5, 506], 1: [263, 506], 2: [267, 506], 3: [262.5, 506], 4: [262, 506] },
  hadith: { 0: [257, 505], 1: [257, 505], 2: [263.5, 506], 3: [267.5, 505], 4: [267.5, 506] },
  character: { 0: [257, 504], 1: [262, 506], 2: [265, 506], 3: [266.5, 506], 4: [266, 506] },
  society: { 0: [258, 506], 1: [251.5, 505], 2: [268.5, 506], 3: [268.5, 507], 4: [268.5, 507] },
  spirituality: { 0: [257.3, 506], 1: [261, 506], 2: [262.5, 506], 3: [264, 506], 4: [264, 506] },
}

/** Planter and canopy are separate files, so the crown can sway and the planter cannot. */
export const CANOPY_SPLIT = true

export function trunkPivot(id: GardenAreaId, stage: GrowthStage) {
  const [x, y] = TRUNK_PIVOTS[id][stage]
  return { x, y }
}

export type GardenTheme = 'evening' | 'dawn'

/** Smile of stone pads on a 390×844 scene. Each crown has its own angle, sine period and phase. */
export const TREE_PADS: Record<GardenAreaId, { x: string; y: string; z: number; sway: string; dur: string; delay: string }> = {
  quran: { x: '12.56%', y: '62.2%', z: 2, sway: '0.75deg', dur: '5.2s', delay: '-1.1s' },
  spirituality: { x: '88.21%', y: '62.2%', z: 2, sway: '0.9deg', dur: '5.7s', delay: '-3.4s' },
  hadith: { x: '30.77%', y: '67.3%', z: 3, sway: '1.1deg', dur: '4.3s', delay: '-2.2s' },
  society: { x: '70.26%', y: '67.3%', z: 3, sway: '1.2deg', dur: '4.8s', delay: '-0.6s' },
  character: { x: '52.31%', y: '74.41%', z: 5, sway: '0.6deg', dur: '6.4s', delay: '-4.1s' },
}

/** A sapling paints in front of a full tree, so a small one is not lost behind a big canopy. */
export function treeDepth(id: GardenAreaId, stage: GrowthStage) {
  const row = TREE_PADS[id].z
  return stage <= 1 ? row + 6 : row
}

export function sceneBackground(theme: GardenTheme) {
  return theme === 'dawn' ? '/garden/bg/garden-dawn.webp' : '/garden/bg/garden-evening.webp'
}

export function treeSources(id: GardenAreaId, stage: GrowthStage) {
  const base = `/garden/trees/${id}/stage-${stage}`
  if (CANOPY_SPLIT) {
    return { planter: `${base}-planter.webp`, canopy: `${base}-canopy.webp`, split: true as const }
  }
  return { planter: `${base}.webp`, canopy: null, split: false as const }
}

/** Where medallions sit in the foliage. Stage 0 is low; a full crown is high. */
export function medallionSpots(count: number, stage: GrowthStage) {
  const band = [62, 52, 42, 34, 28][stage]
  const spread = [18, 24, 30, 36, 40][stage]
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const arc = Math.sin(t * Math.PI)
    return {
      left: `${50 + (t - 0.5) * spread}%`,
      top: `${band - arc * 7}%`,
    }
  })
}
