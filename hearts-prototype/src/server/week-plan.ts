import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { minutesLabel, talksLabel, weekStrip, zoneOrToronto, dateKeyInZone, type WeekDay } from '@/lib/week'
import { spreadNote, studyDates } from '@/lib/schedule'
import { isTimeZone, portalTimeZone } from '@/lib/zone-time'
import { partTitle } from '@/lib/talk-title'
import { visibleCourseIds, type PortalDoc, type SessionUser } from './context'
import { type Row, ref, rows, str } from '@/screens/common'

export type WeekSlot = {
  date: string
  title: string
  lessonId: number | null
  courseId: number | null
  href: string | null
  minutes: number
  today: boolean
}

export type WeekPlanCard = {
  id: number
  name: string
  courseId: number | null
  slots: WeekSlot[]
  start: string
  end: string
  weekdays: number[]
  locked: boolean
  note: string | null
}

export type WeekCourse = { id: number; title: string; talks: number; seconds: number; label: string }

export type WeekView = {
  days: WeekDay[]
  today: WeekSlot | null
  plans: WeekPlanCard[]
  courses: WeekCourse[]
  zone: string
  todayKey: string
}

function learnerZone(portal: PortalDoc) {
  const zone = portalTimeZone(portal)
  return isTimeZone(portal.timeZone) ? zone : zoneOrToronto(null)
}

export async function weekView(payload: Payload, user: SessionUser, portal: PortalDoc, base: string): Promise<WeekView> {
  const zone = learnerZone(portal)
  const at = now()
  const todayKey = dateKeyInZone(at, zone)
  const days = weekStrip(at, zone)
  const ids = await visibleCourseIds(payload, user)
  const [courseRows, lessonRows, plans] = await Promise.all([
    ids.length ? rows(payload, 'courses', { id: { in: ids } }) : Promise.resolve([] as Row[]),
    ids.length ? rows(payload, 'lessons', { course: { in: ids } }, { limit: 800, sort: 'order' }) : Promise.resolve([] as Row[]),
    rows(payload, 'schedules', { portal: { equals: portal.id } }, { sort: '-createdAt', limit: 50 }),
  ])
  const covered = plans.filter((plan) => ref(plan.owner) === user.id || ((plan.learners as unknown[]) || []).some((item) => ref(item) === user.id))
  const ownerIds = [...new Set(covered.map((plan) => ref(plan.owner)).filter((id): id is number => Boolean(id)))]
  const owners = ownerIds.length ? await rows(payload, 'users', { id: { in: ownerIds } }) : []
  const staff = (id: number | null) => {
    const role = str(owners.find((person) => person.id === id)?.role)
    return role === 'teacher' || role === 'portal-admin' || role === 'master'
  }
  const preferred = new Map<string, Row>()
  for (const plan of covered) {
    const key = `${ref(plan.course) || 'pack'}:${ref(plan.pack) || 0}`
    const current = preferred.get(key)
    if (!current) {
      preferred.set(key, plan)
      continue
    }
    const nextStaff = staff(ref(plan.owner))
    const currentStaff = staff(ref(current.owner))
    if (nextStaff && !currentStaff) preferred.set(key, plan)
  }
  const mine = [...preferred.values()]
  const lessonsById = new Map(lessonRows.map((lesson) => [lesson.id, lesson]))
  const courses: WeekCourse[] = courseRows.map((course) => {
    const own = lessonRows.filter((lesson) => ref(lesson.course) === course.id)
    const seconds = own.reduce((sum, lesson) => sum + Number(lesson.durationSeconds || 0), 0)
    return { id: course.id, title: str(course.title), talks: own.length, seconds, label: talksLabel(own.length, seconds) }
  })
  const cards: WeekPlanCard[] = mine.map((plan) => {
    const courseId = ref(plan.course)
    const slots = ((plan.slots as { date?: string; title?: string; lessonId?: number }[]) || []).map((slot) => {
      const lesson = slot.lessonId ? lessonsById.get(slot.lessonId) : null
      const minutes = lesson ? Math.max(0, Math.round(Number(lesson.durationSeconds || 0) / 60)) : 0
      const href = slot.lessonId && (courseId || ref(lesson?.course)) ? `${base}/course/${courseId || ref(lesson?.course)}?part=${slot.lessonId}` : null
      return {
        date: String(slot.date || ''),
        title: slot.title || (lesson ? partTitle(lesson, courseRows.find((course) => course.id === ref(lesson.course))?.title) : 'Sitting'),
        lessonId: slot.lessonId || null,
        courseId: courseId || ref(lesson?.course) || null,
        href,
        minutes,
        today: slot.date === todayKey,
      }
    })
    const weekdays = Array.isArray(plan.weekdays) ? (plan.weekdays as number[]) : []
    let studyDays = new Set(slots.map((slot) => slot.date)).size
    try {
      if (plan.startDate && plan.endDate && weekdays.length) studyDays = studyDates(str(plan.startDate), str(plan.endDate), weekdays).length
    } catch {
      // Keep the count from the slots we already have.
    }
    return {
      id: plan.id,
      name: str(plan.name),
      courseId: courseId || null,
      slots,
      start: str(plan.startDate),
      end: str(plan.endDate),
      weekdays,
      locked: staff(ref(plan.owner)) && ref(plan.owner) !== user.id,
      note: spreadNote(slots.length, studyDays),
    }
  })
  const today = cards.flatMap((plan) => plan.slots).find((slot) => slot.today) || null
  return { days, today, plans: cards, courses, zone, todayKey }
}

export function todayLine(slot: WeekSlot | null) {
  if (!slot) return null
  const mins = slot.minutes ? ` (${minutesLabel(slot.minutes * 60)})` : ''
  return `Today: ${slot.title}${mins}`
}
