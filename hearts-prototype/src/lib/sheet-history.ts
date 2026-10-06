/**
 * The guest sign-up sheet and the browser history. Opening adds one entry at the exact current
 * URL (path, query and hash), so the address never changes while the sheet is up. Closing steps
 * back over that entry. The pop that step causes is ours and is consumed, so it can never close a
 * sheet opened in the meantime. A close that belongs to an older sheet (its exit animation was
 * still running when a new one opened) does nothing.
 */
export type SheetHistory = { gen: number; open: boolean; ownBacks: number }

export const freshSheetHistory = (): SheetHistory => ({ gen: 0, open: false, ownBacks: 0 })

export function sheetUrl(location: { pathname: string; search: string; hash: string }) {
  return `${location.pathname}${location.search}${location.hash}`
}

export function sheetOpened(state: SheetHistory, onSheetEntry: boolean): { next: SheetHistory; history: 'push' | 'replace' } {
  return { next: { ...state, gen: state.gen + 1, open: true }, history: onSheetEntry ? 'replace' : 'push' }
}

export function sheetClosed(state: SheetHistory, gen: number | null, onSheetEntry: boolean): { next: SheetHistory; applies: boolean; back: boolean } {
  if (gen != null && gen !== state.gen) return { next: state, applies: false, back: false }
  if (!state.open) return { next: state, applies: false, back: false }
  return { next: { ...state, open: false, ownBacks: state.ownBacks + (onSheetEntry ? 1 : 0) }, applies: true, back: onSheetEntry }
}

export function sheetPopped(state: SheetHistory): { next: SheetHistory; consumed: boolean; closeSheet: boolean } {
  if (state.ownBacks > 0) return { next: { ...state, ownBacks: state.ownBacks - 1 }, consumed: true, closeSheet: false }
  if (state.open) return { next: { ...state, open: false }, consumed: true, closeSheet: true }
  return { next: state, consumed: false, closeSheet: false }
}
