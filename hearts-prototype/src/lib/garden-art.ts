import type { GardenAreaId, GrowthStage } from './garden-areas'

/**
 * Painted garden frames.
 *
 * Every tree file is a 512×640 canvas. The planter's bottom-centre anchor is
 * (256, 622), the same point in every stage, so one placement fits all five.
 * Plaques in the art are blank. Names are drawn on top.
 *
 * Split layers (stage-n-planter and stage-n-canopy) are not in yet. Until they
 * are, each tree shows the combined file and does not sway. The canopy element
 * is still there, with its origin on the trunk base, so medallions already hang
 * on the layer that will move.
 */

export const TREE_FRAME = { width: 512, height: 640, anchorX: 256, anchorY: 622 }

/**
 * Trunk base, where the trunk meets the soil, in the same canvas.
 * Replace this when the split-layer manifest gives the measured pivot.
 * 600 sits just above the planter anchor, on the soil line.
 */
export const TRUNK_PIVOT = { x: 256, y: 600 }

/** Flip this on once `stage-<n>-planter` and `stage-<n>-canopy` files are served. */
export const CANOPY_SPLIT = false

export type GardenTheme = 'evening' | 'dawn'

/** Smile of stone pads, as percentages of a 390×844 scene. Front tree is lowest. */
export const TREE_PADS: Record<GardenAreaId, { x: string; y: string; z: number; sway: string; dur: string; delay: string }> = {
  quran: { x: '12.56%', y: '62.2%', z: 2, sway: '0.7deg', dur: '5.6s', delay: '-1.1s' },
  spirituality: { x: '88.21%', y: '62.2%', z: 2, sway: '0.85deg', dur: '5.8s', delay: '-1.6s' },
  hadith: { x: '30.77%', y: '67.3%', z: 3, sway: '1deg', dur: '4.8s', delay: '-2.2s' },
  society: { x: '70.26%', y: '67.3%', z: 3, sway: '1.2deg', dur: '5.1s', delay: '-3s' },
  character: { x: '52.31%', y: '74.41%', z: 5, sway: '0.6deg', dur: '6.2s', delay: '-0.4s' },
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
