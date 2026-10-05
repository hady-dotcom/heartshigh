/** NOAA-style solar sunset, in the portal's IANA zone (including summer time). */
import { DEFAULT_TIME_ZONE, partsInZone } from './zone-time'

export type Coordinates = { latitude: number; longitude: number }

/** Mosque-city coordinates for the zones we offer. Longitude is degrees east (NOAA). */
export function coordinatesForZone(zone?: string): Coordinates {
  const key = String(zone || DEFAULT_TIME_ZONE)
  if (key.startsWith('Asia/Riyadh') || key.startsWith('Asia/Qatar') || key.startsWith('Asia/Bahrain')) return { latitude: 24.7136, longitude: 46.6753 }
  if (key.startsWith('Asia/Dubai')) return { latitude: 25.2048, longitude: 55.2708 }
  if (key.startsWith('Africa/Cairo')) return { latitude: 30.0444, longitude: 31.2357 }
  if (key.startsWith('Asia/Karachi')) return { latitude: 24.8607, longitude: 67.0011 }
  if (key.startsWith('America/Toronto')) return { latitude: 43.6532, longitude: -79.3832 }
  if (key.startsWith('America/New_York')) return { latitude: 40.7128, longitude: -74.006 }
  if (key.startsWith('America/Chicago')) return { latitude: 41.8781, longitude: -87.6298 }
  if (key.startsWith('America/Los_Angeles')) return { latitude: 34.0522, longitude: -118.2437 }
  if (key.startsWith('Australia/Sydney')) return { latitude: -33.8688, longitude: 151.2093 }
  if (key.startsWith('Pacific/Auckland')) return { latitude: -36.8485, longitude: 174.7633 }
  return { latitude: 51.5074, longitude: -0.1278 }
}

function julianDay(year: number, month: number, day: number) {
  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const A = Math.floor(y / 100)
  const B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5
}

function julianCent(jd: number) {
  return (jd - 2451545) / 36525
}

function deg2rad(deg: number) {
  return (deg * Math.PI) / 180
}

function rad2deg(rad: number) {
  return (rad * 180) / Math.PI
}

function geomMeanLongSun(t: number) {
  let L = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  if (L < 0) L += 360
  return L
}

function geomMeanAnomalySun(t: number) {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t)
}

function eccentEarthOrbit(t: number) {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
}

function sunEqOfCenter(t: number) {
  const m = deg2rad(geomMeanAnomalySun(t))
  return Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * m) * (0.019993 - 0.000101 * t) + Math.sin(3 * m) * 0.000289
}

function sunAppLong(t: number) {
  const omega = deg2rad(125.04 - 1934.136 * t)
  return geomMeanLongSun(t) + sunEqOfCenter(t) - 0.00569 - 0.00478 * Math.sin(omega)
}

function meanObliquity(t: number) {
  return 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
}

function obliquityCorrection(t: number) {
  return meanObliquity(t) + 0.00256 * Math.cos(deg2rad(125.04 - 1934.136 * t))
}

function sunDeclination(t: number) {
  const e = deg2rad(obliquityCorrection(t))
  const lambda = deg2rad(sunAppLong(t))
  return rad2deg(Math.asin(Math.sin(e) * Math.sin(lambda)))
}

function equationOfTime(t: number) {
  const l0 = deg2rad(geomMeanLongSun(t))
  const e = eccentEarthOrbit(t)
  const m = deg2rad(geomMeanAnomalySun(t))
  const y = Math.tan(deg2rad(obliquityCorrection(t) / 2)) ** 2
  const eq = y * Math.sin(2 * l0) - 2 * e * Math.sin(m) + 4 * e * y * Math.sin(m) * Math.cos(2 * l0) - 0.5 * y * y * Math.sin(4 * l0) - 1.25 * e * e * Math.sin(2 * m)
  return 4 * rad2deg(eq)
}

function hourAngleSunset(lat: number, decl: number) {
  const latR = deg2rad(lat)
  const declR = deg2rad(decl)
  const zenith = deg2rad(90.833)
  const cosha = Math.cos(zenith) / (Math.cos(latR) * Math.cos(declR)) - Math.tan(latR) * Math.tan(declR)
  return rad2deg(Math.acos(Math.max(-1, Math.min(1, cosha))))
}

function sunsetUtcMinutes(jd: number, latitude: number, longitude: number) {
  const once = (t: number) => {
    const ha = hourAngleSunset(latitude, sunDeclination(t))
    return 720 - 4 * (longitude - ha) - equationOfTime(t)
  }
  const first = once(julianCent(jd))
  return once(julianCent(jd + first / 1440))
}

/** Local wall-clock hour of sunset (e.g. 21.35) in `timeZone`, including DST. */
export function sunsetHourInZone(at: Date, latitude: number, longitude: number, timeZone: string) {
  const local = partsInZone(at, timeZone)
  const minutesUtc = sunsetUtcMinutes(julianDay(local.year, local.month, local.day), latitude, longitude)
  const utc = Date.UTC(local.year, local.month - 1, local.day, 0, 0, 0) + minutesUtc * 60_000
  const wall = partsInZone(new Date(utc), timeZone)
  return wall.hour + wall.minute / 60
}
