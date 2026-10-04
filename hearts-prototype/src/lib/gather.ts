// Gather: taking a talk off the phone and into a room. Pure rules, no database.
// Hors d'oeuvres and appetisers still do not finish a course. Showing up to a matching
// activation task does.

import { capitalAfterColon } from './doors'

export type Audience = 'brothers' | 'sisters' | 'family' | 'youth' | 'all'
export type GatherKind = 'circle' | 'tea' | 'volunteer' | 'walk' | 'youth' | 'picnic'
export type RsvpChoice = 'going' | 'maybe' | 'cant'
export type RsvpStatus = RsvpChoice | 'waitlist'
export type PieceLevel = 'hors' | 'appetiser' | 'talk'

export const AUDIENCES: Audience[] = ['brothers', 'sisters', 'family', 'youth', 'all']
export const GATHER_KINDS: GatherKind[] = ['circle', 'tea', 'volunteer', 'walk', 'youth', 'picnic']
export const DEMO_PORTAL_SLUG = 'hearts-demo'

export const AUDIENCE_LABEL: Record<Audience, string> = {
  brothers: 'Brothers',
  sisters: 'Sisters',
  family: 'Families',
  youth: 'Youth',
  all: 'Everyone',
}

export const KIND_LABEL: Record<GatherKind, string> = {
  circle: 'Circle',
  tea: 'Tea and talk',
  volunteer: 'Volunteering',
  walk: 'Walk',
  youth: 'Youth night',
  picnic: 'Picnic',
}

export type RsvpRow = { id: string; status: RsvpStatus; at: number }

export type PlaceResult = {
  rows: RsvpRow[]
  status: RsvpStatus
  promotedId: string | null
}

/** A seat is taken only by "going". Maybe and can't leave the seat, and the head of the waitlist steps in. */
export function applyChoice(rows: RsvpRow[], id: string, choice: RsvpChoice, capacity: number, at: number): PlaceResult {
  const next = rows.map((row) => ({ ...row }))
  let mine = next.find((row) => row.id === id)
  if (!mine) {
    mine = { id, status: 'cant', at }
    next.push(mine)
  }
  const wasGoing = mine.status === 'going'
  if (choice === 'going') {
    const taken = next.filter((row) => row.status === 'going' && row.id !== id).length
    mine.status = capacity > 0 && taken >= capacity ? 'waitlist' : 'going'
  } else {
    mine.status = choice
  }
  let promotedId: string | null = null
  if (wasGoing && mine.status !== 'going') {
    const going = next.filter((row) => row.status === 'going').length
    const room = capacity <= 0 || going < capacity
    const head = next
      .filter((row) => row.status === 'waitlist')
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))[0]
    if (room && head) {
      head.status = 'going'
      promotedId = head.id
    }
  }
  return { rows: next, status: mine.status, promotedId }
}

export function goingCount(rows: { status: string }[]) {
  return rows.filter((row) => row.status === 'going').length
}

export function seatsLeft(capacity: number, going: number) {
  if (capacity <= 0) return null
  return Math.max(0, capacity - going)
}

/** First name, or a first name plus a last initial when two people share a first name. Never a full name. */
export function publicNames(fullNames: string[]): string[] {
  const firsts = fullNames.map((name) => firstName(name))
  const seen = new Map<string, number>()
  for (const name of firsts) seen.set(name, (seen.get(name) || 0) + 1)
  return fullNames.map((full) => {
    const first = firstName(full)
    if ((seen.get(first) || 0) < 2) return first
    const rest = full.trim().split(/\s+/).slice(1).join(' ')
    const initial = rest.replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase()
    return initial ? `${first} ${initial}.` : first
  })
}

export function firstName(full: string) {
  const part = full.trim().split(/\s+/).filter(Boolean)[0]
  return part || 'Guest'
}

export function bringToken(userId: number) {
  if (!Number.isInteger(userId) || userId <= 0) return ''
  return `b${userId.toString(36)}`
}

export function userIdFromBringToken(token: string): number | null {
  if (!/^b[0-9a-z]+$/.test(token)) return null
  const id = Number.parseInt(token.slice(1), 36)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const COMPANY = /\b(with others|together|each other|one another|circle|masjid|mosque|group|walk|sisters|brothers|family|families|volunteer|food bank|picnic|football|tea)\b/i

/** An activation task that asks the learner to do the thing with people, not only alone. */
export function taskWantsCompany(prompt: string) {
  return COMPANY.test(prompt)
}

export type TaskRef = { id: number; lessonId: number | null; courseId: number | null; door: number | null; prompt: string }
export type GatherRef = { id: number; lessonId: number | null; courseId: number | null; door: number | null; taskId: number | null; startsAt: string }

export function gatheringMatchesTask(gathering: GatherRef, task: TaskRef) {
  if (gathering.taskId && gathering.taskId === task.id) return true
  if (!taskWantsCompany(task.prompt)) return false
  if (gathering.lessonId && task.lessonId && gathering.lessonId === task.lessonId) return true
  if (gathering.courseId && task.courseId && gathering.courseId === task.courseId) return true
  if (gathering.door && task.door && gathering.door === task.door) return true
  return false
}

/** After a talk: gatherings at your masjid that are about this lesson, course or door. */
export function relatedGatherings<T extends GatherRef>(gatherings: T[], ref: { lessonId?: number | null; courseId?: number | null; door?: number | null }, now: number) {
  return gatherings
    .filter((row) => new Date(row.startsAt).getTime() >= now)
    .filter((row) => (ref.lessonId && row.lessonId === ref.lessonId) || (ref.courseId && row.courseId === ref.courseId) || (ref.door && row.door === ref.door))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function matchingGatherings<T extends GatherRef>(gatherings: T[], task: TaskRef, now: number) {
  return gatherings
    .filter((row) => new Date(row.startsAt).getTime() >= now && gatheringMatchesTask(row, task))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}

export function afterTalkLine(startsAt: string, zone = 'Europe/London') {
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: zone }).format(new Date(startsAt))
  return `People from your masjid are meeting to talk about this on ${day}.`
}

/**
 * Showing up completes a matching activation task.
 * A hors d'oeuvre or appetiser still does not finish a course by being watched.
 * The task completed by being there does count, even when the question sits on a short clip.
 */
export function attendanceCompletesTask(input: { checkedIn: boolean; matches: boolean; alreadyAnswered: boolean }) {
  return input.checkedIn && input.matches && !input.alreadyAnswered
}

export function gatheringCountsTowardCourse(input: { completedByGathering: boolean; inCourse: boolean; level: PieceLevel }) {
  if (!input.completedByGathering || !input.inCourse) return false
  return true
}

export function countsWithGathering(input: { level: PieceLevel; inCourse: boolean; event: 'watch' | 'question'; viaGathering?: boolean }) {
  if (!input.inCourse) return false
  if (input.viaGathering && input.event === 'question') return true
  if (input.level !== 'talk') return false
  return input.event === 'watch' || input.event === 'question'
}

export type BalancePerson = { id: string; newcomer: boolean; band: string }

export type Circle = { name: string; memberIds: string[] }

/** Small circles of about four to six. Newcomers sit with regulars. Bands are spread. No scores come back. */
export function balanceGroups(people: BalancePerson[], target = 5): Circle[] {
  const unique = [...new Map(people.map((person) => [person.id, person])).values()]
  if (!unique.length) return []
  if (unique.length <= 6) return [{ name: 'Circle 1', memberIds: spread(unique).map((person) => person.id) }]
  const count = Math.max(2, Math.round(unique.length / Math.min(6, Math.max(4, target))))
  const groups: BalancePerson[][] = Array.from({ length: count }, () => [])
  const regulars = spread(unique.filter((person) => !person.newcomer))
  const newcomers = spread(unique.filter((person) => person.newcomer))
  regulars.forEach((person, index) => groups[index % count].push(person))
  for (const person of newcomers) {
    const quiet = [...groups].sort((a, b) => newcomersIn(a) - newcomersIn(b) || a.length - b.length)[0]
    quiet.push(person)
  }
  return groups.filter((group) => group.length).map((group, index) => ({ name: `Circle ${index + 1}`, memberIds: group.map((person) => person.id) }))
}

function newcomersIn(group: BalancePerson[]) {
  return group.filter((person) => person.newcomer).length
}

/** Round-robin by band so one band does not clump, without ever exposing the band. */
function spread(people: BalancePerson[]) {
  const buckets = new Map<string, BalancePerson[]>()
  for (const person of people) {
    const list = buckets.get(person.band) || []
    list.push(person)
    buckets.set(person.band, list)
  }
  const lanes = [...buckets.values()]
  const out: BalancePerson[] = []
  let added = true
  while (added) {
    added = false
    for (const lane of lanes) {
      const next = lane.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}

/** A coarse band for mixing. The label is internal. It is not a score and it is not shown. */
export function bandFromScales(scales: Record<string, number> | null | undefined) {
  if (!scales) return 'open'
  let best = ''
  let mag = 0
  for (const [key, value] of Object.entries(scales)) {
    const number = Number(value)
    if (!Number.isFinite(number)) continue
    if (Math.abs(number) > mag) {
      mag = Math.abs(number)
      best = number >= 0 ? key : `low-${key}`
    }
  }
  return best || 'open'
}

export function discussionPrompts(questions: { prompt: string; kind?: string }[], limit = 4) {
  const rows = questions.filter((row) => row.prompt.trim() && row.kind !== 'multiple_choice')
  const tasks = rows.filter((row) => row.kind === 'task' || row.kind === 'reflection' || row.kind === 'question')
  const pool = tasks.length ? tasks : rows
  return pool.slice(0, limit).map((row) => row.prompt.trim())
}

export function suggestedAudience(kind: string, title: string): Audience {
  const text = `${kind} ${title}`.toLowerCase()
  if (/\bsisters?\b/.test(text)) return 'sisters'
  if (/\bbrothers?\b/.test(text)) return 'brothers'
  if (/\byouth\b/.test(text) || kind === 'youth') return 'youth'
  if (/\bfamil/.test(text) || kind === 'picnic') return 'family'
  return 'all'
}

function londonFromParts(date: string, time: string) {
  const asUtc = new Date(`${date}T${time}:00Z`)
  if (Number.isNaN(asUtc.getTime())) return ''
  const adjusted = new Date(asUtc.getTime() - londonOffsetMinutes(asUtc) * 60_000)
  return new Date(asUtc.getTime() - londonOffsetMinutes(adjusted) * 60_000).toISOString()
}

/** Wall-clock time as London. Accepts a datetime-local value, or UK dd/mm/yyyy with 24-hour time. */
export function londonIso(local: string) {
  const trimmed = local.trim()
  const uk = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2}))?$/)
  if (uk) {
    const day = uk[1].padStart(2, '0')
    const month = uk[2].padStart(2, '0')
    const hour = (uk[4] || '00').padStart(2, '0')
    const minute = uk[5] || '00'
    return londonFromParts(`${uk[3]}-${month}-${day}`, `${hour}:${minute}`)
  }
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (!iso) return ''
  return londonFromParts(iso[1], iso[2])
}

function londonOffsetMinutes(instant: Date) {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'shortOffset', hour: '2-digit' })
    .formatToParts(instant)
    .find((part) => part.type === 'timeZoneName')?.value || 'GMT'
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3] || 0))
}

export function whenLabel(iso: string, zone = 'Europe/London') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: zone,
  }).format(date)
}

export function isSameDay(iso: string, now: Date, zone = 'Europe/London') {
  const fmt = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone })
  return fmt.format(new Date(iso)) === fmt.format(now)
}

function icsStamp(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function icsText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function toIcs(input: { uid: string; title: string; startsAt: string; endsAt?: string | null; place?: string; description?: string; url?: string }) {
  const start = new Date(input.startsAt)
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HEARTS//Gather//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${icsText(input.uid)}`,
    `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(start.toISOString())}`,
    `DTEND:${icsStamp(end.toISOString())}`,
    `SUMMARY:${icsText(input.title)}`,
    input.place ? `LOCATION:${icsText(input.place)}` : '',
    input.description ? `DESCRIPTION:${icsText(input.description)}` : '',
    input.url ? `URL:${icsText(input.url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return `${lines.join('\r\n')}\r\n`
}

export function googleCalendarUrl(input: { title: string; startsAt: string; endsAt?: string | null; place?: string; description?: string }) {
  const start = new Date(input.startsAt)
  const end = input.endsAt ? new Date(input.endsAt) : new Date(start.getTime() + 2 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${icsStamp(start.toISOString())}/${icsStamp(end.toISOString())}`,
    details: input.description || '',
    location: input.place || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function localHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host.endsWith('.localhost')
}

/** A link people can be shown. Localhost and 127.0.0.1 never go into a message. */
export function publicShareUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (localHost(parsed.hostname)) return ''
    return url
  } catch {
    return ''
  }
}

export function whatsAppHref(url: string, title: string, when: string) {
  const shareUrl = publicShareUrl(url)
  const text = [title, when, shareUrl].filter(Boolean).join('\n')
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

export function crossPost(input: { title: string; when: string; place: string; mapUrl?: string; audience: string; bring?: string; host?: string; note?: string; url?: string; linkLabel?: string }) {
  const lines = [
    input.title,
    input.linkLabel ? capitalAfterColon(input.linkLabel) : '',
    '',
    input.when,
    input.place,
    '',
    `Who it is for: ${input.audience}`,
    input.host ? `Host: ${input.host}` : '',
    input.bring ? `What to bring: ${input.bring}` : '',
    input.note || '',
    '',
    'Come if you can. The link on its own is enough to say you are coming.',
  ]
  return lines.filter((line, index, all) => line !== '' || (all[index - 1] !== '' && line === '')).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function reflectionSentence(raw: string): string | null {
  let text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return null
  text = text.replace(/\s+([.!?])/g, '$1')
  if (!/[.!?]$/.test(text)) text += '.'
  text = text.charAt(0).toUpperCase() + text.slice(1)
  if (text.split(/\s+/).length < 4) return null
  return text
}

export function newcomerFollowUp(count: number) {
  if (count <= 0) return null
  if (count === 1) return '1 newcomer came for the first time. Send them a welcome.'
  return `${count} newcomers came for the first time. Send them a welcome.`
}

export function groupByDoor<T extends { doorLabel: string; doorHeading?: string; past: boolean; startsAt: string }>(rows: T[]) {
  const pack = (items: T[]) => {
    const doors = new Map<string, T[]>()
    for (const item of items) {
      const key = item.doorHeading || item.doorLabel || 'Open'
      doors.set(key, [...(doors.get(key) || []), item])
    }
    return [...doors.entries()].map(([door, list]) => ({ door, items: list }))
  }
  const upcoming = pack(rows.filter((row) => !row.past).sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
  const past = pack(rows.filter((row) => row.past).sort((a, b) => b.startsAt.localeCompare(a.startsAt)))
  return { upcoming, past }
}

/** "Thu 17 Sep", so two Thursdays on the chart are not both labelled "Thu". */
export function chartLabel(iso: string, zone = 'Europe/London') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: zone }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || ''
  const month = part('month').slice(0, 3)
  return [part('weekday'), part('day'), month].filter(Boolean).join(' ')
}

/** "Door 16 · Ihsan". Learners see the door number and the short name, not the W-code. */
export function doorLearnerHeading(number: number, title: string) {
  const short = capitalAfterColon(title).split(':')[0]?.trim() || capitalAfterColon(title)
  return `Door ${number} · ${short}`
}

/** "On: Worship as though you see Him" when the door title has a clause after the colon. */
export function doorOnLine(title: string) {
  const titled = capitalAfterColon(title)
  const index = titled.indexOf(':')
  if (index < 0) return ''
  const rest = titled.slice(index + 1).trim()
  return rest ? `On: ${rest}` : ''
}

export type AttendancePoint = { label: string; going: number; checkedIn: number; newcomers: number; regulars: number }

export function attendanceSeries(points: AttendancePoint[]) {
  return points.map((point) => ({ ...point }))
}

/** The demo script may only write the hearts-demo portal. */
export function demoPortalGuard(slug: string | null | undefined) {
  if (slug !== DEMO_PORTAL_SLUG) return `Refusing to seed Gather. This script only touches ${DEMO_PORTAL_SLUG}.`
  return null
}

const ENTRY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Four characters someone can read off a poster. No 0, O, 1 or I. */
export function makeEntryCode(bytes: ArrayLike<number> = crypto.getRandomValues(new Uint8Array(4))) {
  let out = ''
  for (let i = 0; i < 4; i++) out += ENTRY_ALPHABET[Number(bytes[i] || 0) % ENTRY_ALPHABET.length]
  return out
}

export function normaliseEntryCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
}

export function linkLabel(input: { doorCode?: string | null; doorTitle?: string | null; courseTitle?: string | null; lessonTitle?: string | null }) {
  const on = input.doorTitle ? doorOnLine(input.doorTitle) : ''
  const after = input.lessonTitle || input.courseTitle || ''
  if (on && after) return `${on}, after ${after}`
  if (on) return on
  if (after) return `After ${after}`
  return ''
}
