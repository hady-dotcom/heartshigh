'use client'

import { useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { CourseTree } from '@/components/desk/course-tree'
import type { DoorGroup, PlacedCourse } from '@/lib/curriculum-groups'
import type { GiveCourseRow } from '@/lib/give-course'

function asTree(courses: GiveCourseRow[]): DoorGroup[] {
  const byDoor = new Map<string, GiveCourseRow[]>()
  for (const course of courses) {
    const door = course.door || 'Not placed yet'
    const list = byDoor.get(door) || []
    list.push(course)
    byDoor.set(door, list)
  }
  return [...byDoor.entries()].map(([door, rows]) => {
    const placed: PlacedCourse[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: '',
      talkCount: 0,
      door: null,
      otherDoors: [],
      seatId: null,
    }))
    return {
      key: door,
      number: null,
      code: door,
      title: door,
      heading: door,
      courses: placed,
      seats: [],
      unseated: placed,
      talkCount: 0,
    }
  })
}

function GiveSeveral({
  learners,
  courses,
  next,
}: {
  learners: { id: number; name: string }[]
  courses: GiveCourseRow[]
  next: string
}) {
  return (
    <form
      className="give-course"
      action="/api/hearts"
      method="post"
      data-testid="give-course"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget)
        const courseId = String(data.get('course') || '')
        const picked = data.getAll('learner').map(String)
        if (!courseId || !picked.length) {
          event.preventDefault()
          return
        }
        const names = learners.filter((learner) => picked.includes(String(learner.id))).map((learner) => learner.name)
        if (!window.confirm(`Give this course to ${names.join(', ')}?`)) event.preventDefault()
      }}
    >
      <Hidden fields={{ action: 'grant-many', next }} />
      <CourseTree groups={asTree(courses)} name="course" testId="give-course-tree" courseTestId="give-course-option" mode="one" />
      <div className="give-learners" data-testid="give-learners">
        {learners.map((learner) => (
          <label className="check" key={learner.id}><input type="checkbox" name="learner" value={learner.id} data-testid="give-learner" /> {learner.name}</label>
        ))}
      </div>
      <button className="btn" data-testid="grant-course" type="submit">Give to several learners</button>
    </form>
  )
}

/** One learner, from their row. The panel above gives the same course to several people. */
function GiveOne({
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
      data-testid="give-one-course"
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
      <button className="btn small" data-testid="grant-learner" type="submit" disabled={!course}>Give</button>
    </form>
  )
}

export function GiveCourse(
  props:
    | { learners: { id: number; name: string }[]; courses: GiveCourseRow[]; next: string; learnerId?: undefined }
    | { learnerId: number; learnerName: string; courses: { id: number; title: string }[]; next: string; learners?: undefined },
) {
  if (props.learnerId != null) {
    return <GiveOne learnerId={props.learnerId} learnerName={props.learnerName} courses={props.courses} next={props.next} />
  }
  return <GiveSeveral learners={props.learners} courses={props.courses} next={props.next} />
}
