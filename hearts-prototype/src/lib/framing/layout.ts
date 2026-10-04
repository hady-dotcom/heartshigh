import type { CropBox, FocusPoint, FramingMode } from './types'

export type FramingLayout = {
  mode: FramingMode
  /** Scale and translate the 16:9 film inside a portrait stage. Applied to a wrapper, not the iframe. */
  scale: number
  tx: number
  ty: number
  film: { top: number; left: number; width: number; height: number }
  chromePad: number
}

const CHROME = 64

/** Cover-fit a 16:9 film into a portrait box, then shift so `focus` sits near centre. */
export function coverFocus(stageW: number, stageH: number, focus?: FocusPoint): { scale: number; tx: number; ty: number; film: FramingLayout['film'] } {
  const filmH = stageH + CHROME * 2
  const filmW = filmH * (16 / 9)
  const width = Math.max(stageW, filmW)
  const height = width * (9 / 16)
  const extraX = width - stageW
  const x = focus ? Math.min(Math.max(focus.x * width - stageW / 2, 0), Math.max(0, extraX)) : extraX / 2
  return {
    scale: 1,
    tx: -x,
    ty: -CHROME,
    film: { top: -CHROME, left: -x, width, height: height + CHROME * 2 },
  }
}

export function letterbox(stageW: number, stageH: number, y = 0.34) {
  const width = stageW
  const height = width * (9 / 16)
  const top = Math.max(0, Math.min(stageH - height, stageH * y - height / 2))
  return { scale: 1, tx: 0, ty: 0, film: { top, left: 0, width, height } }
}

export function cropFill(stageW: number, stageH: number, crop?: CropBox, focus?: FocusPoint): FramingLayout['film'] & { scale: number; tx: number; ty: number } {
  const box = crop || { x: (focus?.x ?? 0.5) - 0.16, y: 0, w: 9 / 16 / (16 / 9), h: 1 }
  const w = Math.min(Math.max(box.w, 0.12), 1)
  const h = Math.min(Math.max(box.h, 0.12), 1)
  const x = Math.min(Math.max(box.x, 0), 1 - w)
  const y = Math.min(Math.max(box.y, 0), 1 - h)
  const width = stageW / w
  const height = width * (9 / 16)
  return {
    scale: 1,
    tx: -x * width,
    ty: -y * height,
    film: { top: -y * height, left: -x * width, width, height },
  }
}

export function splitFilm(stageW: number) {
  const width = stageW
  const height = Math.max(220, width * (9 / 16))
  return { scale: 1, tx: 0, ty: 0, film: { top: 0, left: 0, width, height } }
}

export function layoutFor(mode: FramingMode, stageW: number, stageH: number, crop?: CropBox, focus?: FocusPoint): FramingLayout {
  if (mode === 'F') return { mode, chromePad: 0, ...splitFilm(stageW) }
  if (mode === 'B' || mode === 'C') return { mode, chromePad: CHROME, ...letterbox(stageW, stageH, mode === 'C' ? 0.42 : 0.36) }
  if (mode === 'E') {
    const cardH = Math.min(stageH * 0.58, stageW * (5 / 4))
    const cardW = cardH * (4 / 5)
    const left = (stageW - cardW) / 2
    const top = stageH * 0.16
    const inner = cropFill(cardW, cardH, crop, focus)
    return {
      mode,
      chromePad: 0,
      scale: 1,
      tx: left + inner.tx,
      ty: top + inner.ty,
      film: { top: top + inner.film.top, left: left + inner.film.left, width: inner.film.width, height: inner.film.height },
    }
  }
  if (mode === 'D') return { mode, chromePad: CHROME, ...cropFill(stageW, stageH, crop, focus) }
  return { mode, chromePad: CHROME, ...coverFocus(stageW, stageH, mode === 'A' ? { x: 0.5, y: focus?.y ?? 0.45 } : focus) }
}

export function cssVars(layout: FramingLayout) {
  return {
    '--fr-scale': String(layout.scale),
    '--fr-tx': `${layout.tx}px`,
    '--fr-ty': `${layout.ty}px`,
    '--fr-film-top': `${layout.film.top}px`,
    '--fr-film-left': `${layout.film.left}px`,
    '--fr-film-w': `${layout.film.width}px`,
    '--fr-film-h': `${layout.film.height}px`,
  } as Record<string, string>
}
