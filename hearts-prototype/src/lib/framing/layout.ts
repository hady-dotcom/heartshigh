import type { CropBox, FocusPoint, FramingMode } from './types'

export type FramingLayout = {
  mode: FramingMode
  /** Scale and translate the 16:9 film inside a portrait stage. Applied to a wrapper, not the iframe. */
  scale: number
  tx: number
  ty: number
  film: { top: number; left: number; width: number; height: number }
  chromePad: number
  focusX: number
  focusY: number
  /** CSS object-position 0–1 that puts the source focus in the visible cover window. */
  objectX: number
  objectY: number
}

const CHROME = 64
/** Shared 16:9 rest height for B and F so the film does not jump on the switch. */
export const WIDE_FILM_Y = 0.36

function clamp(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value))
}

/** Visible letterbox: full stage width, 16:9, sitting on screen. */
export function letterbox(stageW: number, stageH: number, y = WIDE_FILM_Y) {
  const width = stageW
  const height = width * (9 / 16)
  const top = Math.max(0, Math.min(stageH - height, stageH * y - height / 2))
  return { scale: 1, tx: 0, ty: 0, film: { top, left: 0, width, height } }
}

/** F sits just under the top chips: full width, uncropped 16:9. */
export const F_FILM_TOP = 56
/** A portrait source may grow the F band up to this share of the viewport, still contained. */
export const PORTRAIT_BAND_MAX = 0.6

export function filmBandHeight(stageW: number, stageH: number, vertical = false) {
  const landscape = stageW * (9 / 16)
  if (!vertical) return landscape
  return Math.min(stageH * PORTRAIT_BAND_MAX, stageW * (16 / 9))
}

export function splitFilm(stageW: number, stageH: number, vertical = false) {
  const width = stageW
  const height = filmBandHeight(stageW, stageH, vertical)
  const top = Math.max(0, Math.min(stageH - height, F_FILM_TOP))
  return { scale: 1, tx: 0, ty: 0, film: { top, left: 0, width, height } }
}

export function stageFilm(stageW: number, stageH: number) {
  return { scale: 1, tx: 0, ty: 0, film: { top: 0, left: 0, width: stageW, height: stageH } }
}

/**
 * object-position (0–1) that places `focus` at the centre of a cover crop,
 * shifted if needed so `keep` stays fully inside the visible window.
 */
export function coverPosition(focus: FocusPoint, boxW: number, boxH: number, keep?: CropBox, sourceAspect = 16 / 9) {
  const boxAspect = boxW / boxH
  if (sourceAspect >= boxAspect) {
    const visibleW = boxAspect / sourceAspect
    let left = focus.x - visibleW / 2
    if (keep) {
      const pad = 0.015
      left = Math.min(left, keep.x - pad)
      left = Math.max(left, keep.x + keep.w + pad - visibleW)
    }
    left = clamp(left, 0, Math.max(0, 1 - visibleW))
    const x = visibleW >= 1 - 1e-6 ? 0.5 : left / (1 - visibleW)
    return { x, y: clamp(focus.y, 0, 1) }
  }
  const visibleH = sourceAspect / boxAspect
  let top = focus.y - visibleH / 2
  if (keep) {
    const pad = 0.015
    top = Math.min(top, keep.y - pad)
    top = Math.max(top, keep.y + keep.h + pad - visibleH)
  }
  top = clamp(top, 0, Math.max(0, 1 - visibleH))
  const y = visibleH >= 1 - 1e-6 ? 0.5 : top / (1 - visibleH)
  return { x: clamp(focus.x, 0, 1), y }
}

/** Map a normalised source rect through object-fit:cover onto the media box. */
export function coverSourceToBox(
  source: CropBox,
  boxW: number,
  boxH: number,
  pos: { x: number; y: number },
  sourceAspect = 16 / 9,
) {
  const boxAspect = boxW / boxH
  if (sourceAspect >= boxAspect) {
    const visibleW = boxAspect / sourceAspect
    const left = pos.x * (1 - visibleW)
    return {
      x: ((source.x - left) / visibleW) * boxW,
      y: source.y * boxH,
      w: (source.w / visibleW) * boxW,
      h: source.h * boxH,
    }
  }
  const visibleH = sourceAspect / boxAspect
  const top = pos.y * (1 - visibleH)
  return {
    x: source.x * boxW,
    y: ((source.y - top) / visibleH) * boxH,
    w: source.w * boxW,
    h: (source.h / visibleH) * boxH,
  }
}

function pin(focusX: number, focusY: number, film: { width: number; height: number }, crop?: CropBox) {
  const pos = coverPosition({ x: focusX, y: focusY }, film.width, film.height, crop)
  return { focusX, focusY, objectX: pos.x, objectY: pos.y }
}

export function layoutFor(mode: FramingMode, stageW: number, stageH: number, crop?: CropBox, focus?: FocusPoint): FramingLayout {
  const focusX = focus?.x ?? (mode === 'D' ? 0.28 : 0.5)
  const focusY = focus?.y ?? 0.42
  if (mode === 'F') {
    const film = splitFilm(stageW, stageH)
    return { mode, chromePad: 0, ...film, ...pin(0.5, 0.5, film.film) }
  }
  if (mode === 'B' || mode === 'C') {
    const film = letterbox(stageW, stageH, mode === 'C' ? 0.42 : WIDE_FILM_Y)
    return { mode, chromePad: CHROME, ...film, ...pin(0.5, 0.5, film.film) }
  }
  if (mode === 'E') {
    const cardH = Math.min(stageH * 0.58, stageW * (5 / 4))
    const cardW = cardH * (4 / 5)
    const left = (stageW - cardW) / 2
    const top = stageH * 0.16
    const film = { top, left, width: cardW, height: cardH }
    return { mode, chromePad: 0, scale: 1, tx: 0, ty: 0, film, ...pin(focusX, focusY, film, crop) }
  }
  const film = stageFilm(stageW, stageH)
  return { mode, chromePad: CHROME, ...film, ...pin(focusX, focusY, film.film, crop) }
}

export function cssVars(layout: FramingLayout) {
  return {
    '--fr-scale': String(layout.scale),
    '--fr-tx': '0px',
    '--fr-ty': '0px',
    '--fr-film-top': `${layout.film.top}px`,
    '--fr-film-left': `${layout.film.left}px`,
    '--fr-film-w': `${layout.film.width}px`,
    '--fr-film-h': `${layout.film.height}px`,
    '--fr-focus-x': `${Math.round(layout.objectX * 1000) / 10}%`,
    '--fr-focus-y': `${Math.round(layout.objectY * 1000) / 10}%`,
  } as Record<string, string>
}

/** The visible film window stays inside the stage — used by tests and the player. */
export function filmOnStage(layout: FramingLayout, stageW: number, stageH: number) {
  const { left, top, width, height } = layout.film
  return left >= -0.5 && top >= -0.5 && left + width <= stageW + 0.5 && top + height <= stageH + 0.5
}

export function boxOnStage(box: { x: number; y: number; w: number; h: number }, stageW: number, stageH: number, slop = 1) {
  return box.x >= -slop && box.y >= -slop && box.x + box.w <= stageW + slop && box.y + box.h <= stageH + slop
}
