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
}

const CHROME = 64

/** Visible letterbox: full stage width, 16:9, sitting on screen. */
export function letterbox(stageW: number, stageH: number, y = 0.34) {
  const width = stageW
  const height = width * (9 / 16)
  const top = Math.max(0, Math.min(stageH - height, stageH * y - height / 2))
  return { scale: 1, tx: 0, ty: 0, film: { top, left: 0, width, height } }
}

export function splitFilm(stageW: number) {
  const width = stageW
  const height = width * (9 / 16)
  return { scale: 1, tx: 0, ty: 0, film: { top: 72, left: 0, width, height } }
}

export function stageFilm(stageW: number, stageH: number) {
  return { scale: 1, tx: 0, ty: 0, film: { top: 0, left: 0, width: stageW, height: stageH } }
}

export function layoutFor(mode: FramingMode, stageW: number, stageH: number, crop?: CropBox, focus?: FocusPoint): FramingLayout {
  const focusX = focus?.x ?? (mode === 'A' ? 0.5 : 0.5)
  const focusY = focus?.y ?? 0.42
  if (mode === 'F') return { mode, chromePad: 0, focusX: 0.5, focusY: 0.5, ...splitFilm(stageW) }
  if (mode === 'B' || mode === 'C') return { mode, chromePad: CHROME, focusX: 0.5, focusY: 0.5, ...letterbox(stageW, stageH, mode === 'C' ? 0.42 : 0.36) }
  if (mode === 'E') {
    const cardH = Math.min(stageH * 0.58, stageW * (5 / 4))
    const cardW = cardH * (4 / 5)
    const left = (stageW - cardW) / 2
    const top = stageH * 0.16
    return { mode, chromePad: 0, scale: 1, tx: 0, ty: 0, film: { top, left, width: cardW, height: cardH }, focusX, focusY }
  }
  if (mode === 'D') return { mode, chromePad: CHROME, focusX: focus?.x ?? 0.28, focusY, ...stageFilm(stageW, stageH) }
  return { mode, chromePad: CHROME, focusX: mode === 'A' ? 0.5 : focusX, focusY, ...stageFilm(stageW, stageH) }
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
    '--fr-focus-x': `${Math.round(layout.focusX * 1000) / 10}%`,
    '--fr-focus-y': `${Math.round(layout.focusY * 1000) / 10}%`,
  } as Record<string, string>
}

/** The visible film window stays inside the stage — used by tests and the player. */
export function filmOnStage(layout: FramingLayout, stageW: number, stageH: number) {
  const { left, top, width, height } = layout.film
  return left >= -0.5 && top >= -0.5 && left + width <= stageW + 0.5 && top + height <= stageH + 0.5
}
