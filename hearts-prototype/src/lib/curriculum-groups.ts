// Groups library courses along the Hadith Jibril spine: a course sits in the door most of its talks
// belong to, with any other doors as tags, and under a Ghunya seat when the talks carry one.
// Pure, so the desk and the tests share one rule.

import { doorByNumber, doorCode, doorNumberOfClause, type Door, DOORS } from './doors'
import { clipWords, endsDangling } from './sentences'

export type CutPlacement = {
  lessonId: number
  clause: number | null
  seatId: number | null
}

export type SeatInfo = {
  id: number
  clause: number
  position: number
  text: string
}

export type CourseInput = {
  id: number
  title: string
  summary?: string
}

export type LessonInput = {
  id: number
  courseId: number
}

export type DoorTag = {
  number: number
  code: string
  title: string
  talks: number
}

export type PlacedCourse = {
  id: number
  title: string
  summary: string
  talkCount: number
  door: number | null
  otherDoors: DoorTag[]
  seatId: number | null
}

export type SeatGroup = {
  id: number
  label: string
  /** The volume's contents line, shown muted under the label. */
  subject?: string
  /** The sheet notes behind this seat, for the label's tooltip. */
  note?: string
  courses: PlacedCourse[]
  talkCount: number
}

export type DoorGroup = {
  key: string
  number: number | null
  code: string
  title: string
  heading: string
  courses: PlacedCourse[]
  seats: SeatGroup[]
  unseated: PlacedCourse[]
  talkCount: number
}

/** "138 talks · 75 courses". */
export function countLine(talks: number, courses: number) {
  const word = (count: number, one: string) => `${count} ${count === 1 ? one : `${one}s`}`
  return `${word(talks, 'talk')} · ${word(courses, 'course')}`
}

const SMALL_WORDS = new Set('a an and as at but by for from in into of on or the to with nor'.split(' '))
const ARTICLE = /^(al|an|ar|as|at|ad|az|ash|ath|adh)-/i

function capital(word: string) {
  return word.replace(/^([“"‘'(]?)(\p{Ll})/u, (_, open: string, letter: string) => `${open}${letter.toUpperCase()}`)
}

function titleCase(text: string) {
  return text
    .split(' ')
    .map((word, index, all) => {
      if (index > 0 && !/:$/.test(all[index - 1]) && SMALL_WORDS.has(word.toLowerCase())) return word
      if (ARTICLE.test(word)) {
        const [prefix, ...rest] = word.split('-')
        return [index === 0 ? capital(prefix) : prefix.toLowerCase(), ...rest.map(capital)].join('-')
      }
      return word.split('-').map((part, at) => (at === 0 || part.length > 3 ? capital(part) : part)).join('-')
    })
    .join(' ')
}

/**
 * The seat's name from its Ghunya note: the volume, chapter and page references, any aside in brackets, and the
 * gloss after it ("…, a circle already in ordinary days") are left out, and the rest is title-cased.
 * "Vol. 3 Friday 295–325, a known hour in a known week" is "Friday".
 */
export function seatName(text: string) {
  let name = text.replace(/\s+/g, ' ').trim()
  name = name.replace(/\([^)]*\)/g, ' ')
  name = name.split(/\.\s+(?=[A-Z])/)[0]
  name = name.replace(/\bVols\.\s*(\d+)\s*[–-]\s*(\d+)/g, 'Vols§$1§$2')
  name = name.split(/\s\d+\s*[–-]\s*\d*\s*,/)[0]
  name = name.replace(/\s(?:in|of)\s+Vol\.?\s*\d+\b/gi, ' ')
  name = name.replace(/\bVol\.?\s*\d+[a-z]?(?:’s|'s)?\b[:.]?/gi, ' ').replace(/\bCh(?:apter|\.)?\s*\d+(?:\s*[–-]\s*\d+)?\b[:.]?/gi, ' ')
  name = name.split(/;|,\s+(?=(?:a|an|the|its|his|her|their|which|where|when|how|later)\b)/i)[0]
  name = name.replace(/\b(?:pp?\.\s*)?\d+\s*[–-]\s*\d*(?=\s|$|[,:;.])|\b\d+(?:\+\d+)+\b/g, ' ')
  name = name.replace(/Vols§(\d+)§(\d+)/g, 'Vols. $1–$2')
  name = name.replace(/\s+([,:;.])/g, '$1').replace(/\s+/g, ' ').replace(/^[\s,:;.–—+-]+|[\s,:;.–—+-]+$/g, '').trim()
  while (endsDangling(name) && name.includes(' ')) name = name.replace(/\s*\S+$/, '').replace(/[\s,:;–—-]+$/, '')
  if (/^(?:vols?|ch|pp?|unit)\.?$/i.test(name)) return ''
  return name ? titleCase(name) : ''
}

/** "Seat 2 · Days of the Week and White Days": the clean name, cut on a word boundary so a card stays a heading. */
export function seatLabel(seat: Pick<SeatInfo, 'position' | 'text'>) {
  const name = clipWords(seatName(seat.text), 56)
  return name ? `Seat ${seat.position} · ${name}` : `Seat ${seat.position}`
}

/** The five English volumes of the Ghunya by their printed contents, as the curriculum map lists them. */
export const GHUNYA_VOLUMES: Record<number, string> = {
  1: 'Door, adab, marriage, hisba, creed, sects',
  2: 'Four Qur’an discourses',
  3: 'Sacred months, days, ikhlas',
  4: 'Year-fast, five prayers, nawafil, dua',
  5: 'Seekers, shaykh, fellowship, Path',
}

export type GhunyaPlace = { key: string; title: string; subject: string }

/**
 * Where in the book a seat sits, from the volume (and chapter) its note opens with: "Vol. 1 Ch. 4 miracles…" is
 * Volume 1, Chapter 4. Seats that point at the same place are one seat on the desk. A note that opens with no
 * volume keeps its own clean name.
 */
export function ghunyaPlace(text: string): GhunyaPlace {
  const opening = text.replace(/\s+/g, ' ').trim().match(/^Vol\.?\s*([1-5])\b\.?(?:\s*Ch\.?\s*(\d+))?/i)
  if (opening) {
    const volume = Number(opening[1])
    const chapter = opening[2] ? Number(opening[2]) : null
    return { key: chapter ? `v${volume}c${chapter}` : `v${volume}`, title: chapter ? `Volume ${volume}, Chapter ${chapter}` : `Volume ${volume}`, subject: GHUNYA_VOLUMES[volume] || '' }
  }
  const name = clipWords(seatName(text), 56)
  return { key: `n:${name.toLowerCase()}`, title: name, subject: '' }
}

/** "Seat 3", "Seats 1 and 3", "Seats 1, 2 and 3". */
function seatWord(positions: number[]) {
  const list = [...new Set(positions)].sort((a, b) => a - b)
  if (list.length === 1) return `Seat ${list[0]}`
  return `Seats ${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

/** "Door 2 · The sitting", with the rest of a long title ("How he came and sat with the Messenger") as its line below. */
export function doorName(door: Pick<Door, 'number' | 'title'>) {
  const [name, ...rest] = door.title.split(/:\s+/)
  const more = rest.join(': ').trim()
  return { heading: `Door ${door.number} · ${name.trim()}`, more: more ? more.charAt(0).toUpperCase() + more.slice(1) : '' }
}

function majority<T>(votes: T[], rank: (value: T) => number): T | null {
  if (!votes.length) return null
  const counts = new Map<T, number>()
  for (const vote of votes) counts.set(vote, (counts.get(vote) || 0) + 1)
  let best: T | null = null
  let bestCount = -1
  let bestRank = Infinity
  for (const [value, count] of counts) {
    const order = rank(value)
    if (count > bestCount || (count === bestCount && order < bestRank)) {
      best = value
      bestCount = count
      bestRank = order
    }
  }
  return best
}

function byTitle(a: { title: string }, b: { title: string }) {
  return a.title.localeCompare(b.title, 'en')
}

function talkCount(courses: PlacedCourse[]) {
  return courses.reduce((sum, course) => sum + course.talkCount, 0)
}

/**
 * Place each course on the door most of its talks sit in. Talks with no clause do not vote.
 * A tie goes to the earlier door. Other doors the talks also sit in are kept as tags.
 * The seat is the Ghunya seat most of the talks on that door carry, when any do.
 */
export function groupCourses(
  courses: CourseInput[],
  lessons: LessonInput[],
  cuts: CutPlacement[],
  seats: SeatInfo[],
  doors: Door[] = DOORS,
): DoorGroup[] {
  const seatsById = new Map(seats.map((seat) => [seat.id, seat]))
  const cutsByLesson = new Map<number, CutPlacement[]>()
  for (const cut of cuts) {
    const list = cutsByLesson.get(cut.lessonId) || []
    list.push(cut)
    cutsByLesson.set(cut.lessonId, list)
  }
  const lessonsByCourse = new Map<number, LessonInput[]>()
  for (const lesson of lessons) {
    const list = lessonsByCourse.get(lesson.courseId) || []
    list.push(lesson)
    lessonsByCourse.set(lesson.courseId, list)
  }

  const seatRank = (id: number) => {
    const seat = seatsById.get(id)
    return seat ? seat.clause * 100 + seat.position : id
  }
  const talkSeat = (lessonId: number, door: number) => {
    const onDoor = (cutsByLesson.get(lessonId) || []).filter((cut) => doorNumberOfClause(cut.clause, doors) === door && cut.seatId && seatsById.has(cut.seatId))
    return majority(onDoor.map((cut) => cut.seatId as number), seatRank)
  }

  const placed: PlacedCourse[] = courses.map((course) => {
    const own = lessonsByCourse.get(course.id) || []
    const talks: { door: number; seatId: number | null }[] = []
    for (const lesson of own) {
      const votes = (cutsByLesson.get(lesson.id) || [])
        .map((cut) => doorNumberOfClause(cut.clause, doors))
        .filter((door): door is number => Boolean(door))
      const door = majority(votes, (number) => number)
      if (!door) continue
      talks.push({ door, seatId: talkSeat(lesson.id, door) })
    }
    const door = majority(talks.map((talk) => talk.door), (number) => number)
    const seatId = door ? majority(talks.filter((talk) => talk.door === door && talk.seatId).map((talk) => talk.seatId as number), seatRank) : null
    const doorCounts = new Map<number, number>()
    for (const talk of talks) doorCounts.set(talk.door, (doorCounts.get(talk.door) || 0) + 1)
    const otherDoors = [...doorCounts.entries()]
      .filter(([number]) => number !== door)
      .map(([number, talks]) => {
        const found = doorByNumber(number, doors)
        return { number, code: doorCode(number), title: found?.title || doorCode(number), talks }
      })
      .sort((a, b) => b.talks - a.talks || a.number - b.number)
    return {
      id: course.id,
      title: course.title,
      summary: course.summary || '',
      talkCount: own.length,
      door,
      otherDoors,
      seatId,
    }
  })

  const byDoor = new Map<number | null, PlacedCourse[]>()
  for (const course of placed) {
    const key = course.door
    const list = byDoor.get(key) || []
    list.push(course)
    byDoor.set(key, list)
  }

  const numbers = doors.map((door) => door.number).filter((number) => byDoor.has(number))
  const groups: DoorGroup[] = numbers.map((number) => buildGroup(doorByNumber(number, doors), byDoor.get(number) || [], seatsById))
  if (byDoor.has(null)) groups.push(buildGroup(null, byDoor.get(null) || [], seatsById))
  return groups
}

function buildGroup(door: Door | null, courses: PlacedCourse[], seatsById: Map<number, SeatInfo>): DoorGroup {
  const sorted = [...courses].sort(byTitle)
  const seated = new Map<number, PlacedCourse[]>()
  const unseated: PlacedCourse[] = []
  for (const course of sorted) {
    if (course.seatId && seatsById.has(course.seatId)) {
      const list = seated.get(course.seatId) || []
      list.push(course)
      seated.set(course.seatId, list)
    } else unseated.push(course)
  }
  const merged = new Map<string, { place: GhunyaPlace; ids: number[]; positions: number[]; notes: string[]; courses: PlacedCourse[]; rank: number }>()
  for (const [id, list] of seated) {
    const seat = seatsById.get(id)!
    const place = ghunyaPlace(seat.text)
    const entry = merged.get(place.key) || { place, ids: [], positions: [], notes: [], courses: [], rank: Infinity }
    entry.ids.push(id)
    entry.positions.push(seat.position)
    const note = seat.text.replace(/\s+/g, ' ').trim()
    if (!entry.notes.includes(note)) entry.notes.push(note)
    entry.courses.push(...list)
    entry.rank = Math.min(entry.rank, seat.clause * 100 + seat.position)
    merged.set(place.key, entry)
  }
  const seats: SeatGroup[] = [...merged.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => {
      const courses = [...entry.courses].sort(byTitle)
      const word = seatWord(entry.positions)
      return {
        id: Math.min(...entry.ids),
        label: entry.place.title ? `${word} · ${entry.place.title}` : word,
        subject: entry.place.subject || undefined,
        note: entry.notes.join(' / '),
        courses,
        talkCount: talkCount(courses),
      }
    })
  return {
    key: door ? doorCode(door.number) : 'other',
    number: door?.number ?? null,
    code: door ? doorCode(door.number) : 'Other',
    title: door?.title || 'Other',
    heading: door ? doorName(door).heading : 'Other',
    courses: sorted,
    seats,
    unseated,
    talkCount: talkCount(sorted),
  }
}

/** Keep the same headings, with only the courses whose ids are in the set. Empty headings drop out. */
export function subsetGroups(groups: DoorGroup[], ids: Set<number>): DoorGroup[] {
  return groups.flatMap((group) => {
    const courses = group.courses.filter((course) => ids.has(course.id))
    if (!courses.length) return []
    const unseated = group.unseated.filter((course) => ids.has(course.id))
    const seats = group.seats
      .map((seat) => {
        const kept = seat.courses.filter((course) => ids.has(course.id))
        return { ...seat, courses: kept, talkCount: talkCount(kept) }
      })
      .filter((seat) => seat.courses.length)
    return [{ ...group, courses, unseated, seats, talkCount: talkCount(courses) }]
  })
}

/** The line under a pack name: the pack's own summary, or a sentence from the fullest doors. */
export function describeGroups(groups: DoorGroup[], summary?: string) {
  const written = (summary || '').replace(/\s+/g, ' ').trim()
  if (written) return written.length > 180 ? `${written.slice(0, 177).trim()}…` : written
  const doors = groups.filter((group) => group.number != null).sort((a, b) => b.courses.length - a.courses.length || (a.number || 0) - (b.number || 0))
  if (!doors.length) return groups.length ? 'Courses that are not on a door yet.' : 'Nothing in this pack yet.'
  const names = doors.slice(0, 2).map((group) => group.title)
  const rest = doors.length - names.length
  const list = names.join(' and ')
  return rest > 0 ? `Across ${list} and ${rest} other ${rest === 1 ? 'door' : 'doors'}.` : `Across ${list}.`
}
