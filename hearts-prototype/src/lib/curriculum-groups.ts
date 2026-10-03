// Groups library courses along the Hadith Jibril spine: a course sits in the door most of its talks
// belong to, with any other doors as tags, and under a Ghunya seat when the talks carry one.
// Pure, so the desk and the tests share one rule.

import { doorByNumber, doorCode, doorLabel, doorNumberOfClause, type Door, DOORS } from './doors'

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

/** The Ghunya line under a door, trimmed so a card stays a heading. */
export function seatLabel(seat: Pick<SeatInfo, 'position' | 'text'>) {
  const text = seat.text.replace(/\s+/g, ' ').trim()
  const short = text.length > 72 ? `${text.slice(0, 69).trim()}…` : text
  return short ? `Seat ${seat.position} · ${short}` : `Seat ${seat.position}`
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
  const seats = [...seated.entries()]
    .map(([id, list]) => {
      const seat = seatsById.get(id)!
      return { id, label: seatLabel(seat), courses: list, talkCount: talkCount(list), clause: seat.clause, position: seat.position }
    })
    .sort((a, b) => a.clause - b.clause || a.position - b.position)
    .map(({ clause: _clause, position: _position, ...seat }) => seat)
  return {
    key: door ? doorCode(door.number) : 'other',
    number: door?.number ?? null,
    code: door ? doorCode(door.number) : 'Other',
    title: door?.title || 'Other',
    heading: door ? doorLabel(door) : 'Other',
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
