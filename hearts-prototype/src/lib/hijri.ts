/**
 * Umm al-Qura Hijri dates, via the hijri-converter library.
 * Astronomical moon-sighting can differ by a day; the admin offset covers that.
 */
import { toGregorian as libToGregorian, toHijri as libToHijri } from 'hijri-converter'

export type HijriDate = { hy: number; hm: number; hd: number }
export type GregorianDate = { gy: number; gm: number; gd: number }

export function toHijri(gy: number, gm: number, gd: number): HijriDate {
  return libToHijri(gy, gm, gd)
}

export function toGregorian(hy: number, hm: number, hd: number): GregorianDate {
  return libToGregorian(hy, hm, hd)
}

export const HIJRI_MONTHS = [
  '',
  'Muharram',
  'Safar',
  "Rabi' al-awwal",
  "Rabi' al-thani",
  'Jumada al-ula',
  'Jumada al-akhira',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhul Qa'dah",
  'Dhul Hijjah',
] as const

export function hijriMonthName(month: number) {
  return HIJRI_MONTHS[month] || `Month ${month}`
}

/** Shift a Gregorian date by a whole number of days (moon-sighting offset). */
export function shiftGregorian(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function hijriOf(date: Date, offsetDays = 0): HijriDate {
  const shifted = offsetDays ? shiftGregorian(date, offsetDays) : date
  return toHijri(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate())
}
