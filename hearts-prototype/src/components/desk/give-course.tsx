'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'

export function GiveCourse({
  learnerId,
  learnerName,
  courses,
  next,
}: {
  learnerId: number
  learnerName: string
  courses: { id: number; title: string }[]
  next: string
}) {
  const [course, setCourse] = useState('')
  return (
    <form
      className="give-course"
      action="/api/hearts"
      method="post"
      data-testid="give-course"
      onSubmit={(event) => {
        if (!course) {
          event.preventDefault()
          return
        }
        if (!window.confirm(`Give this course to ${learnerName}?`)) event.preventDefault()
      }}
    >
      <Hidden fields={{ action: 'grant', learner: learnerId, next }} />
      <select
        name="course"
        required
        value={course}
        onChange={(event) => setCourse(event.target.value)}
        data-testid="grant-course-select"
        aria-label="Give a course"
      >
        <option value="">Choose a course…</option>
        {courses.map((row) => (
          <option key={row.id} value={row.id}>{row.title}</option>
        ))}
      </select>
      <button className="btn small" data-testid="grant-course" type="submit" disabled={!course}>Give</button>
    </form>
  )
}
