/**
 * Islamic calendar context for wording and talk order.
 * A sheikh's words, talk content, Qur'an and hadith are never changed here.
 */
import { hijriMonthName, hijriOf, type HijriDate } from './hijri'

export const CONTEXT_KEYS = [
  'lastTenNights',
  'ramadan',
  'eidFitr',
  'eidAdha',
  'ashura',
  'dhulHijjah',
  'muharram',
  'friday',
  'thursdayEvening',
] as const

export type BuiltInContext = (typeof CONTEXT_KEYS)[number]

export type AdminSeason = {
  key: string
  name: string
  theme?: string | null
  start: string
  end: string
}

export type CalendarContext = {
  at: string
  weekday: number
  hour: number
  hijri: HijriDate
  hijriLabel: string
  friday: boolean
  thursdayEvening: boolean
  ramadan: boolean
  lastTenNights: boolean
  dhulHijjah: boolean
  eidFitr: boolean
  eidAdha: boolean
  muharram: boolean
  ashura: boolean
  seasons: AdminSeason[]
  /** Highest-priority keys first, including admin seasons. */
  active: string[]
  greeting: string
}

export type ContextInput = {
  at: Date
  offsetDays?: number
  seasons?: AdminSeason[]
  /** Local hour 0–23. Defaults to the UTC hour of `at`. */
  hour?: number
  weekday?: number
}

const NAMES: Record<string, string> = {
  lastTenNights: 'the last ten nights',
  ramadan: 'Ramadan',
  eidFitr: 'Eid al-Fitr',
  eidAdha: 'Eid al-Adha',
  ashura: 'Ashura',
  dhulHijjah: 'the first ten days of Dhul Hijjah',
  muharram: 'Muharram',
  friday: 'Friday',
  thursdayEvening: 'Thursday evening',
}

export function contextName(key: string) {
  return NAMES[key] || key.replace(/[-_]+/g, ' ')
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function inRange(day: string, start: string, end: string) {
  return day >= start.slice(0, 10) && day <= end.slice(0, 10)
}

export function calendarContext(input: ContextInput): CalendarContext {
  const at = input.at
  const hijri = hijriOf(at, input.offsetDays || 0)
  const weekday = input.weekday ?? at.getUTCDay()
  const hour = input.hour ?? at.getUTCHours()
  const thursdayEvening = weekday === 4 && hour >= 18
  const friday = weekday === 5 || thursdayEvening
  const ramadan = hijri.hm === 9
  const lastTenNights = ramadan && hijri.hd >= 21
  const dhulHijjah = hijri.hm === 12 && hijri.hd <= 10
  const eidFitr = hijri.hm === 10 && hijri.hd === 1
  const eidAdha = hijri.hm === 12 && hijri.hd === 10
  const muharram = hijri.hm === 1
  const ashura = muharram && hijri.hd === 10
  const day = dateKey(at)
  const seasons = (input.seasons || []).filter((season) => inRange(day, season.start, season.end))
  const flags: Record<BuiltInContext, boolean> = {
    lastTenNights,
    ramadan,
    eidFitr,
    eidAdha,
    ashura,
    dhulHijjah,
    muharram,
    friday,
    thursdayEvening,
  }
  const active = [
    ...CONTEXT_KEYS.filter((key) => flags[key]),
    ...seasons.map((season) => season.key),
  ]
  const greeting = greetingFor(flags, seasons)
  return {
    at: at.toISOString(),
    weekday,
    hour,
    hijri,
    hijriLabel: `${hijri.hd} ${hijriMonthName(hijri.hm)} ${hijri.hy}`,
    friday,
    thursdayEvening,
    ramadan,
    lastTenNights,
    dhulHijjah,
    eidFitr,
    eidAdha,
    muharram,
    ashura,
    seasons,
    active,
    greeting,
  }
}

function greetingFor(flags: Record<BuiltInContext, boolean>, seasons: AdminSeason[]) {
  if (flags.lastTenNights) return 'The last ten nights'
  if (flags.ramadan) return 'Ramadan mubarak'
  if (flags.eidFitr || flags.eidAdha) return 'Eid mubarak'
  if (flags.ashura) return 'A day to remember'
  if (flags.dhulHijjah) return 'The first ten days'
  if (flags.muharram) return 'A new Hijri year'
  if (flags.friday) return 'A Friday reminder'
  if (seasons[0]) return seasons[0].name
  return ''
}

/**
 * Pick a context-specific line from a payload. Extra keys such as `friday`
 * or `ramadan` are optional. The default `label` is the fallback.
 */
export function contextLabel(payload: Record<string, unknown> | null | undefined, context: CalendarContext, fallback = ''): string {
  if (!payload || typeof payload !== 'object') return fallback
  for (const key of context.active) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  if (typeof payload.label === 'string' && payload.label.trim()) return payload.label.trim()
  return fallback
}

export type CopyRow = { slot: string; context: string; label: string; approved?: boolean }

/** Approved seasonal wording for a slot, highest-priority context first. */
export function approvedCopy(rows: CopyRow[], slot: string, context: CalendarContext): string | null {
  const wanted = new Set(context.active)
  const matches = rows.filter((row) => row.slot === slot && row.approved !== false && wanted.has(row.context) && row.label.trim())
  for (const key of context.active) {
    const hit = matches.find((row) => row.context === key)
    if (hit) return hit.label.trim()
  }
  return null
}

const THEME_WORDS: Record<string, string[]> = {
  friday: ['friday', 'jumu', 'khutbah', 'reminder'],
  ramadan: ['ramadan', 'fast', 'quran', 'qur’an', 'mercy', 'taraweeh', 'iftar'],
  lastTenNights: ['qadr', 'laylat', 'last ten', 'odd night'],
  dhulHijjah: ['hajj', 'arafah', 'sacrifice', 'udhiyah', 'dhul'],
  eidFitr: ['eid'],
  eidAdha: ['eid', 'adha', 'sacrifice'],
  muharram: ['muharram', 'new year'],
  ashura: ['ashura', 'karbala', 'husayn'],
}

export function themeWordsFor(context: CalendarContext): string[] {
  const words = new Set<string>()
  for (const key of context.active) {
    for (const word of THEME_WORDS[key] || []) words.add(word)
    const season = context.seasons.find((row) => row.key === key)
    if (season?.theme) {
      for (const part of season.theme.toLowerCase().split(/[^a-z’']+/)) {
        if (part.length > 2) words.add(part)
      }
    }
  }
  return [...words]
}

export function talkThemeScore(title: string, context: CalendarContext) {
  const hay = title.toLowerCase()
  let score = 0
  for (const word of themeWordsFor(context)) {
    if (hay.includes(word)) score += 2
  }
  return score
}

export function nudgeTalks<T extends { id?: number; title?: string }>(
  talks: T[],
  context: CalendarContext,
  popularIds: Iterable<number> = [],
  usePopular = false,
): T[] {
  const popular = new Set([...popularIds])
  return [...talks]
    .map((talk, index) => ({
      talk,
      index,
      score: talkThemeScore(String(talk.title || ''), context) + (usePopular && talk.id && popular.has(talk.id) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.talk)
}

export const DEFAULT_CONTEXT_LINES: Record<string, Record<string, string>> = {
  'feed-cta-label': {
    friday: "A Friday reminder before Jumu'ah",
    ramadan: 'A short clip for a Ramadan evening',
    lastTenNights: 'A few minutes in the last ten nights',
    dhulHijjah: 'A few minutes in these ten days',
    eidFitr: 'A short clip for Eid',
    eidAdha: 'A short clip for Eid',
    ashura: 'A short clip for Ashura',
    muharram: 'A short clip to begin the year',
  },
  'full-talk-cta-label': {
    friday: 'Sit with the Friday talk ({n} min)',
    ramadan: 'Sit with this Ramadan talk ({n} min)',
    lastTenNights: 'Sit with this for the last ten nights ({n} min)',
  },
}

export function suggestedContextLine(slot: string, contextKey: string, current = '') {
  return DEFAULT_CONTEXT_LINES[slot]?.[contextKey] || current
}
