'use client'

import { useState } from 'react'
import type { DoorGroup, PlacedCourse } from '@/lib/curriculum-groups'
import { countLine } from '@/lib/curriculum-groups'

function CourseRow({
  course,
  name,
  hint,
  testId,
  checked,
  onChange,
}: {
  course: PlacedCourse
  name: string
  hint?: string
  testId?: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  return (
    <label className="check tree-course" data-testid={testId} data-course={course.id}>
      <input type="checkbox" name={name} value={course.id} checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {course.title}
        {hint ? <span className="hint"> {hint}</span> : null}
        {course.otherDoors.length ? (
          <span className="door-tags">
            {course.otherDoors.map((door) => (
              <span key={door.number} className="door-tag" data-testid="other-door" title={`${door.title} · ${door.talks} ${door.talks === 1 ? 'talk' : 'talks'}`}>{door.code}</span>
            ))}
          </span>
        ) : null}
      </span>
    </label>
  )
}

/** Search, a door heading with select-all, and the courses under it. */
export function CourseTree({
  groups,
  name,
  hints,
  testId,
  courseTestId,
}: {
  groups: DoorGroup[]
  name: string
  hints?: Record<number, string>
  testId: string
  courseTestId?: string
}) {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<Record<string, boolean>>({})
  const [picked, setPicked] = useState<Record<number, boolean>>({})
  const needle = query.trim().toLowerCase()
  const matches = (course: PlacedCourse) => !needle || course.title.toLowerCase().includes(needle)
  const selected = Object.values(picked).filter(Boolean).length

  const setCourse = (id: number, on: boolean) => setPicked((prev) => ({ ...prev, [id]: on }))
  const setMany = (courses: PlacedCourse[], on: boolean) => setPicked((prev) => {
    const next = { ...prev }
    for (const course of courses) next[course.id] = on
    return next
  })

  return (
    <div className="course-picker" data-testid={testId}>
      <input
        className="tree-search"
        type="search"
        value={query}
        placeholder="Search courses"
        aria-label="Search courses"
        data-testid="course-tree-search"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') event.preventDefault() }}
      />
      <p className="hint tree-selected" data-testid="selected-count">{selected} {selected === 1 ? 'course' : 'courses'} selected</p>
      {groups.map((group) => {
        const shown = group.courses.filter(matches)
        if (!shown.length) {
          return group.courses.filter((course) => picked[course.id]).map((course) => (
            <input key={course.id} type="hidden" name={name} value={course.id} />
          ))
        }
        const ids = shown.map((course) => course.id)
        const chosen = ids.filter((id) => picked[id]).length
        const all = chosen === ids.length
        const some = chosen > 0 && !all
        const isOpen = Boolean(needle) || Boolean(opened[group.key])
        const unseated = group.unseated.filter(matches)
        const seats = group.seats.map((seat) => ({ ...seat, courses: seat.courses.filter(matches) })).filter((seat) => seat.courses.length)
        return (
          <details
            key={group.key}
            className="tree-door"
            data-testid="tree-door"
            data-door={group.code}
            open={isOpen}
            onToggle={(event) => {
              const open = event.currentTarget.open
              if (needle) {
                if (!open) event.currentTarget.open = true
                return
              }
              setOpened((prev) => (prev[group.key] === open ? prev : { ...prev, [group.key]: open }))
            }}
          >
            <summary>
              <label className="check" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  data-testid="door-select-all"
                  data-door={group.code}
                  checked={all}
                  ref={(node) => { if (node) node.indeterminate = some }}
                  onChange={(event) => setMany(shown, event.target.checked)}
                  aria-label={`Select all in ${group.heading}`}
                />
              </label>
              <span className="tree-door-name">{group.heading}</span>
              <span className="hint">{countLine(shown.reduce((sum, course) => sum + course.talkCount, 0), shown.length)}</span>
            </summary>
            {group.courses.filter((course) => picked[course.id] && !matches(course)).map((course) => (
              <input key={course.id} type="hidden" name={name} value={course.id} />
            ))}
            <div className="tree-door-body">
              {unseated.map((course) => (
                <CourseRow key={course.id} course={course} name={name} hint={hints?.[course.id]} testId={courseTestId} checked={Boolean(picked[course.id])} onChange={(on) => setCourse(course.id, on)} />
              ))}
              {seats.map((seat) => (
                <div key={seat.id} className="tree-seat" data-testid="tree-seat">
                  <div className="tree-seat-name">{seat.label}</div>
                  {seat.courses.map((course) => (
                    <CourseRow key={course.id} course={course} name={name} hint={hints?.[course.id]} testId={courseTestId} checked={Boolean(picked[course.id])} onChange={(on) => setCourse(course.id, on)} />
                  ))}
                </div>
              ))}
            </div>
          </details>
        )
      })}
      {needle && groups.every((group) => !group.courses.some(matches)) ? <p className="hint">No courses match.</p> : null}
    </div>
  )
}
