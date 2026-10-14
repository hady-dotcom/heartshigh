'use client'

import { useMemo, useState } from 'react'
import { Hidden } from '@/components/app/shell'
import { doorQuickPicks, type LibraryCoursePick } from '@/lib/code-courses'

type Props = {
  courses: LibraryCoursePick[]
  selected?: number[]
  name?: string
  testId?: string
}

/** Search the library, tick courses, or take a whole Jibril door when one is tagged. */
export function LibraryCoursePicker({ courses, selected = [], name = 'course', testId = 'library-picker' }: Props) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Set<number>>(() => new Set(selected))
  const doors = useMemo(() => doorQuickPicks(courses), [courses])
  const needle = query.trim().toLowerCase()
  const shown = courses.filter((course) => !needle || course.title.toLowerCase().includes(needle))
  const shownIds = new Set(shown.map((course) => course.id))
  const hiddenPicked = courses.filter((course) => picked.has(course.id) && !shownIds.has(course.id))
  const allOn = courses.length > 0 && courses.every((course) => picked.has(course.id))

  const setCourse = (id: number, on: boolean) => {
    setPicked((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleMany = (ids: number[]) => {
    setPicked((current) => {
      const next = new Set(current)
      const every = ids.length > 0 && ids.every((id) => next.has(id))
      if (every) for (const id of ids) next.delete(id)
      else for (const id of ids) next.add(id)
      return next
    })
  }

  return (
    <fieldset className="library-picker" data-testid={testId}>
      <legend>Library courses</legend>
      <p className="hint" id={`${testId}-help`}>Tick the courses to open. Search if the list is long.</p>
      <input type="hidden" name="coursesForm" value="yes" />
      <label className="stack">Search the library
        <input
          type="search"
          value={query}
          placeholder="Type a course name"
          aria-label="Search the library"
          data-testid="library-search"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
        />
      </label>
      <div className="quick-picks" role="group" aria-label="Quick picks">
        <button
          type="button"
          className={`btn small${allOn ? ' ink' : ' ghost'}`}
          data-testid="all-library-courses"
          aria-pressed={allOn}
          onClick={() => toggleMany(courses.map((course) => course.id))}
          disabled={!courses.length}
        >
          All library courses
        </button>
        {doors.map((door) => {
          const on = door.courseIds.every((id) => picked.has(id))
          return (
            <button
              key={door.code}
              type="button"
              className={`btn small${on ? ' ink' : ' ghost'}`}
              data-testid="door-quick"
              data-door={door.code}
              aria-pressed={on}
              aria-label={`Whole door ${door.code}, ${door.title}`}
              onClick={() => toggleMany(door.courseIds)}
            >
              Whole door {door.code}
            </button>
          )
        })}
      </div>
      <p className="hint" data-testid="library-selected" aria-live="polite">
        {picked.size} {picked.size === 1 ? 'course' : 'courses'} ticked
      </p>
      {hiddenPicked.map((course) => (
        <input key={course.id} type="hidden" name={name} value={course.id} />
      ))}
      <div className="check-list" role="group" aria-describedby={`${testId}-help`}>
        {shown.map((course) => (
          <label className="check" key={course.id} data-testid="library-course-check" data-course={course.id}>
            <input
              type="checkbox"
              name={name}
              value={course.id}
              checked={picked.has(course.id)}
              onChange={(event) => setCourse(course.id, event.target.checked)}
            />
            <span>
              {course.title}
              {course.doors.length ? <span className="hint"> Door {course.doors.map((door) => door.code).join(', ')}</span> : null}
            </span>
          </label>
        ))}
        {!courses.length ? <p className="hint">The library has no courses yet. You can still save, and add courses later.</p> : null}
        {courses.length && !shown.length ? <p className="hint">No courses match that search. Ticked courses stay ticked.</p> : null}
      </div>
    </fieldset>
  )
}

/** The course list stays closed until someone asks to change a code, so the codes page stays light. */
export function CodeCourseEditor({
  courses,
  selected,
  portalSlug,
  codeId,
  next,
}: {
  courses: LibraryCoursePick[]
  selected: number[]
  portalSlug: string
  codeId: number
  next: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <details
      onToggle={(event) => {
        setOpen(event.currentTarget.open)
      }}
    >
      <summary className="btn ghost small">Change courses</summary>
      {open ? (
        <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 280 }}>
          <Hidden fields={{ action: 'update-code', portalSlug, codeId, next }} />
          <LibraryCoursePicker courses={courses} selected={selected} testId={`code-courses-${codeId}`} />
          <label className="stack">People who already joined
            <select name="apply" defaultValue="leave">
              <option value="leave">Leave people who already joined as they are</option>
              <option value="add">Add the new courses for them</option>
              <option value="remove">Remove these courses from them</option>
              <option value="overwrite">Replace their list with these courses</option>
            </select>
          </label>
          <button className="btn ink small" type="submit">Update code</button>
        </form>
      ) : null}
    </details>
  )
}
