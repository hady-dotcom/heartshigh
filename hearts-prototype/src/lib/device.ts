// Everything the opening keeps on the device. While viewing as someone, every key moves into its own
// namespace (hearts.viewas.<sessionId>.*) so the viewer's own state is never read or changed (spec 6A).
import { PENDING_KEY, STORAGE_KEY, type HeartState } from './heart'

declare global {
  interface Window {
    __HEARTS_VIEWAS?: string
    __HEARTS_VIEWAS_WIPED?: boolean
  }
}

export function viewAsId() {
  return typeof window === 'undefined' ? '' : window.__HEARTS_VIEWAS || ''
}

export function deviceKey(key: string) {
  const id = viewAsId()
  return id ? key.replace(/^hearts\./, `hearts.viewas.${id}.`) : key
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(deviceKey(key))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  // The page keeps running until the exit navigation lands; nothing may refill a wiped view.
  if (viewAsId() && window.__HEARTS_VIEWAS_WIPED) return
  try {
    if (value == null) window.localStorage.removeItem(deviceKey(key))
    else window.localStorage.setItem(deviceKey(key), JSON.stringify(value))
  } catch {
    // Private browsing or a full disk: the opening still works for this visit.
  }
}

export const readHeart = () => read<HeartState>(STORAGE_KEY)
export const writeHeart = (state: HeartState | null) => write(STORAGE_KEY, state)

export type PendingAnswer = { pointId: number; lessonId: number; cutId?: number | null; body?: string; choice?: string; answeredAt: string; atSecond: number; viewingId: string }
export const readPending = () => read<PendingAnswer[]>(PENDING_KEY) || []
export const writePending = (rows: PendingAnswer[]) => write(PENDING_KEY, rows.length ? rows : null)

export type SessionFlags = { sheetCount: number; firstEnded?: boolean; unmuted?: boolean; seenCuts?: number[]; seenCards?: string[] }
export function sessionFlags(): SessionFlags {
  try {
    return JSON.parse(window.sessionStorage.getItem(deviceKey('hearts.session.v1')) || '{"sheetCount":0}')
  } catch {
    return { sheetCount: 0 }
  }
}
export function setSessionFlags(flags: SessionFlags) {
  if (viewAsId() && window.__HEARTS_VIEWAS_WIPED) return
  try {
    window.sessionStorage.setItem(deviceKey('hearts.session.v1'), JSON.stringify(flags))
  } catch {
    // ignore
  }
}

export type FeedPlace = { cutId: number; mode: 'hors' | 'appetiser'; card?: string | null }
const PLACE_KEY = 'hearts.feed-place.v1'
const COACH_KEY = 'hearts.feed-coach.v1'

export const readFeedPlace = () => read<FeedPlace>(PLACE_KEY)
export const writeFeedPlace = (place: FeedPlace | null) => write(PLACE_KEY, place)
export const readCoachDismissed = () => Boolean(read<boolean>(COACH_KEY))
export const writeCoachDismissed = () => write(COACH_KEY, true)

export function sessionSeenCuts() {
  return sessionFlags().seenCuts || []
}

export function sessionSeenCards() {
  const flags = sessionFlags()
  if (flags.seenCards?.length) return flags.seenCards
  return (flags.seenCuts || []).map((id) => `${id}:talk`)
}

export function rememberSeenCut(cutId: number) {
  const flags = sessionFlags()
  const seen = flags.seenCuts || []
  if (seen.includes(cutId)) return seen
  const next = [...seen, cutId]
  setSessionFlags({ ...flags, seenCuts: next })
  return next
}

export function rememberSeenCard(cutId: number, card?: string | null, level: 'hors' | 'appetiser' = 'hors') {
  const key = `${cutId}:${card || 'talk'}:${level}`
  const flags = sessionFlags()
  const cards = flags.seenCards || sessionSeenCards()
  const nextCards = cards.includes(key) ? cards : [...cards, key]
  const cuts = flags.seenCuts || []
  const nextCuts = !card || card === 'talk' ? (cuts.includes(cutId) ? cuts : [...cuts, cutId]) : cuts
  setSessionFlags({ ...flags, seenCards: nextCards, seenCuts: nextCuts })
  return { cards: nextCards, cuts: nextCuts }
}

export const readPref = (name: string, fallback: boolean) => {
  const value = read<boolean>(`hearts.pref.${name}`)
  return value == null ? fallback : value
}
export const writePref = (name: string, value: boolean) => write(`hearts.pref.${name}`, value)

/** Removes every view-as key (or one session's), on exit, on timeout and when a stale namespace is found. */
export function wipeViewAs(sessionId?: string) {
  if (viewAsId()) window.__HEARTS_VIEWAS_WIPED = true
  try {
    for (const store of [window.localStorage, window.sessionStorage]) {
      const doomed: string[] = []
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index) || ''
        if (key === 'hearts.viewas.active' || (sessionId ? key.startsWith(`hearts.viewas.${sessionId}.`) : key.startsWith('hearts.viewas.'))) doomed.push(key)
      }
      doomed.forEach((key) => store.removeItem(key))
    }
  } catch {
    // ignore
  }
}

export function haptic(pattern: number | number[]) {
  if (!readPref('haptics', true)) return
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern)
}
