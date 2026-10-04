/**
 * Islamic calendar context for wording and talk order.
 * A sheikh's words, talk content, Qur'an and hadith are never changed here.
 */
import { clipStepUpLabel } from './feed-copy'
import { hijriMonthName, hijriOf, type HijriDate } from './hijri'
import { coordinatesForZone, sunsetHourInZone } from './sunset'
import { DEFAULT_TIME_ZONE, partsInZone } from './zone-time'

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
  /** Local hour 0–23. Defaults to the hour of `at` in `timeZone`. */
  hour?: number
  weekday?: number
  /** Local hour when Maghrib is taken to fall. After this, the Islamic day moves on. */
  sunsetHour?: number
  timeZone?: string
  latitude?: number
  longitude?: number
  /** Local hour when Jumu'ah is taken to begin. The Friday line ends here. Default 13. */
  jumuahHour?: number
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

function civilNoonUtc(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

function addCivilDays(year: number, month: number, day: number, days: number) {
  const next = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() }
}

function civilKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function latitudeForZone(zone?: string) {
  return coordinatesForZone(zone).latitude
}

export function longitudeForZone(zone?: string) {
  return coordinatesForZone(zone).longitude
}

/** NOAA sunset as a local wall-clock hour in the portal's zone. */
export function approximateSunsetHour(at: Date, latitude?: number, longitude?: number, timeZone = DEFAULT_TIME_ZONE) {
  const coords = coordinatesForZone(timeZone)
  return sunsetHourInZone(at, latitude ?? coords.latitude, longitude ?? coords.longitude, timeZone)
}

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

function isoDay(year: string, month: string, day: string) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!Number.isInteger(y) || m < 1 || m > 12 || d < 1 || d > 31) return ''
  const at = new Date(Date.UTC(y, m - 1, d))
  if (at.getUTCFullYear() !== y || at.getUTCMonth() !== m - 1 || at.getUTCDate() !== d) return ''
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/** Accepts 4 October 2026, 04/10/2026, or 2026-10-04. Always returns YYYY-MM-DD. */
export function parseUkDate(value: string | Date | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value || '').trim()
  if (!raw) return ''
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return isoDay(iso[1], iso[2], iso[3])
  const named = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/)
  if (named) {
    const month = MONTHS[named[2].toLowerCase()]
    return month ? isoDay(named[3], month, named[1]) : ''
  }
  const british = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (british) return isoDay(british[3], british[2], british[1])
  return ''
}

export function ukDate(value: string | Date) {
  const parsed = parseUkDate(value)
  const iso = parsed || (typeof value === 'string' && value.length > 10 ? value : '')
  const at = parsed ? new Date(`${parsed}T12:00:00.000Z`) : new Date(iso || value)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const CTA_VERBS = /^(watch|sit|open|read|give|see|try|join|start|learn|stay|come|listen|take)/i

/** CTA lines are actions with a verb. Raw {n} is never shown. */
export function actionCta(line: string, fallback = clipStepUpLabel()) {
  const cleaned = String(line || '')
    .replace(/\{n\}/gi, '')
    .replace(/\(\s*min\)/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+›$/, '')
    .trim()
  if (!cleaned) return fallback
  const withVerb = CTA_VERBS.test(cleaned) ? cleaned : `Watch ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`
  return withVerb.endsWith('›') ? withVerb : `${withVerb} ›`
}

function inRange(day: string, start: string, end: string) {
  return day >= start.slice(0, 10) && day <= end.slice(0, 10)
}

export function calendarContext(input: ContextInput): CalendarContext {
  const at = input.at
  const zone = input.timeZone || DEFAULT_TIME_ZONE
  const local = partsInZone(at, zone)
  const hour = input.hour ?? local.hour
  const weekday = input.weekday ?? local.weekday
  const civilNoon = civilNoonUtc(local.year, local.month, local.day)
  const coords = coordinatesForZone(zone)
  const sunsetHour = input.sunsetHour ?? sunsetHourInZone(
    civilNoon,
    input.latitude ?? coords.latitude,
    input.longitude ?? coords.longitude,
    zone,
  )
  const clock = hour + local.minute / 60
  const afterSunset = clock >= sunsetHour
  const islamicCivil = afterSunset
    ? addCivilDays(local.year, local.month, local.day, 1)
    : { year: local.year, month: local.month, day: local.day }
  const islamicAt = civilNoonUtc(islamicCivil.year, islamicCivil.month, islamicCivil.day)
  const islamicWeekday = afterSunset ? (weekday + 1) % 7 : weekday
  const hijri = hijriOf(islamicAt, input.offsetDays || 0)
  const thursdayEvening = weekday === 4 && afterSunset
  const jumuahHour = Number.isFinite(Number(input.jumuahHour)) ? Number(input.jumuahHour) : 13
  const friday = thursdayEvening || (weekday === 5 && !afterSunset && clock < jumuahHour)
  const ramadan = hijri.hm === 9
  const lastTenNights = ramadan && hijri.hd >= 21
  const dhulHijjah = hijri.hm === 12 && hijri.hd <= 10
  const eidFitr = hijri.hm === 10 && hijri.hd === 1
  const eidAdha = hijri.hm === 12 && hijri.hd === 10
  const muharram = hijri.hm === 1
  const ashura = muharram && hijri.hd === 10
  const day = civilKey(islamicCivil.year, islamicCivil.month, islamicCivil.day)
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
    weekday: islamicWeekday,
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
    friday: "Watch a Friday reminder before Jumu'ah ›",
    ramadan: 'Watch a short clip for a Ramadan evening ›',
    lastTenNights: 'Watch a few minutes in the last ten nights ›',
    dhulHijjah: 'Watch a few minutes in these ten days ›',
    eidFitr: 'Watch a short clip for Eid ›',
    eidAdha: 'Watch a short clip for Eid ›',
    ashura: 'Watch a short clip for Ashura ›',
    muharram: 'Watch a short clip to begin the year ›',
  },
  'full-talk-cta-label': {
    friday: 'Sit with the Friday talk ›',
    ramadan: 'Sit with this Ramadan talk ›',
    lastTenNights: 'Sit with this for the last ten nights ›',
  },
}

export function suggestedContextLine(slot: string, contextKey: string, current = '') {
  return DEFAULT_CONTEXT_LINES[slot]?.[contextKey] || current
}
