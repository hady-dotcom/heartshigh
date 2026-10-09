'use client'

import { useEffect, useMemo, useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { MINUTES_A_DAY } from '@/lib/study-plan'
import { formatLearnerDate, planKeepPath } from '@/lib/week'
import type { WeekCourse } from '@/server/week-plan'

const DAYS: { label: string; value: number }[] = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
]

export function PlanForm({
  courses,
  selected,
  start,
  end,
  weekdays = [],
  minutes = 20,
  next,
  portalSlug,
  open,
}: {
  courses: WeekCourse[]
  selected?: number | null
  start: string
  end: string
  weekdays?: number[]
  minutes?: number
  next: string
  portalSlug: string
  open: boolean
}) {
  const initial = selected || courses[0]?.id || 0
  const [courseId, setCourseId] = useState(initial)
  useEffect(() => {
    if (selected) setCourseId(selected)
  }, [selected])
  const [from, setFrom] = useState(start)
  const [until, setUntil] = useState(end)
  const [daysOn, setDaysOn] = useState<number[]>(weekdays)
  const [perDay, setPerDay] = useState(minutes)
  const chosen = useMemo(() => courses.find((course) => course.id === Number(courseId)) || courses[0], [courses, courseId])
  const name = chosen?.title || ''
  const keepNext = planKeepPath(next, { course: courseId, start: from, end: until, weekdays: daysOn, minutes: perDay })

  return (
    <details className="card" data-testid="new-plan" open={open}>
      <summary data-testid="make-new-plan">Make a new plan</summary>
      <form className="form-stack plan-form" action="/api/hearts" method="post" style={{ marginTop: 12 }}>
        <Hidden fields={{ action: 'schedule', portalSlug, targetType: 'course', next: keepNext }} />
        <label>
          Name
          <input className="field" name="name" defaultValue={name} key={name} />
        </label>
        <label>
          Course
          <select className="field" data-testid="schedule-course" name="course" value={courseId || ''} onChange={(event) => setCourseId(Number(event.target.value))}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title} · {course.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input className="field date-field" data-testid="schedule-start" type="date" name="start" value={from} onChange={(event) => setFrom(event.target.value)} />
          <small className="date-read" data-testid="schedule-start-read">{formatLearnerDate(from, 'week')}</small>
        </label>
        <label>
          Until
          <input className="field date-field" data-testid="schedule-end" type="date" name="end" value={until} onChange={(event) => setUntil(event.target.value)} />
          <small className="date-read" data-testid="schedule-end-read">{formatLearnerDate(until, 'week')}</small>
        </label>
        <fieldset className="minutes-day" data-testid="minutes-a-day">
          <legend>Minutes a day</legend>
          <div className="weekdays">
            {MINUTES_A_DAY.map((value) => (
              <label key={value}>
                <input data-testid={`minutes-${value}`} type="radio" name="minutes" value={value} checked={perDay === value} onChange={() => setPerDay(value)} />
                <span>{value}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-2)' }}>Days of the week</span>
          <div className="weekdays" style={{ marginTop: 8 }}>
            {DAYS.map((day) => (
              <label key={day.value}>
                <input
                  data-testid={`weekday-${day.value}`}
                  type="checkbox"
                  name="weekday"
                  value={day.value}
                  checked={daysOn.includes(day.value)}
                  onChange={() => setDaysOn((current) => (current.includes(day.value) ? current.filter((item) => item !== day.value) : [...current, day.value]))}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button className="pill purple block" data-testid="schedule-submit" type="submit">
          Share out the parts
        </button>
      </form>
    </details>
  )
}
