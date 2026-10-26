'use client'

import { useEffect, useState } from 'react'
import { FilmFallback } from '@/components/app/film-fallback'
import { readGuestDevice } from '@/lib/guest-device'
import { carryFilm, progressPercent, withPhoneProgress, type WeekSection } from '@/lib/week-library'

function Thumb({ src, place, title }: { src: string | null; place: number; title: string }) {
  if (!src) {
    return (
      <span className="thumb is-fallback" data-testid="film-thumb">
        <FilmFallback place={place} title={title} />
      </span>
    )
  }
  return (
    <span className="thumb" data-testid="film-thumb">
      <img src={src} alt="" />
    </span>
  )
}

/** Course cards and a carry-on film. A signed-out parent’s ticks are read on this phone. */
export function WeekLibrary({ sections, guest }: { sections: WeekSection[]; guest: boolean }) {
  const [doneIds, setDoneIds] = useState<number[]>([])
  useEffect(() => {
    if (!guest) return
    setDoneIds(readGuestDevice().progress.filter((row) => row.done).map((row) => row.lessonId))
  }, [guest])
  const done = new Set(doneIds)
  const shown = guest
    ? sections.map((section) => ({ ...section, courses: section.courses.map((course) => withPhoneProgress(course, done)) }))
    : sections
  const carry = carryFilm(shown)
  if (!sections.length) return <p className="card">Films will show here once a course is added.</p>
  return (
    <div data-testid="week-courses">
      {carry ? (
        <a className="course-card" href={carry.film.href} data-testid="carry-on">
          <Thumb src={carry.course.poster} place={carry.film.place} title={carry.film.title} />
          <span className="t">
            <small className="eyebrow">Carry on</small>
            <b>{carry.film.place}. {carry.film.title}</b>
            <small>{carry.course.title} · {carry.finished} of {carry.course.count} films · {progressPercent(carry.finished, carry.course.count)}%</small>
            <span className="bar" data-testid="carry-bar"><i style={{ width: `${progressPercent(carry.finished, carry.course.count)}%` }} /></span>
          </span>
        </a>
      ) : null}
      {shown.map((section) => (
        <section className="library-section" key={section.title} data-testid="library-collection">
          <h2>{section.title}</h2>
          <div className="course-cards">
            {section.courses.map((course) => {
              const finished = course.finished
              const pct = progressPercent(finished, course.count)
              return (
                <a key={course.id} className="course-card" href={course.href} data-testid="course-card">
                  <Thumb src={course.poster} place={course.place} title={course.filmTitle} />
                  <span className="t">
                    <b>{course.title}</b>
                    <small data-testid="week-progress">{finished} of {course.count} film{course.count === 1 ? '' : 's'}{course.lengthLabel} · {pct}%</small>
                    <span className="bar"><i style={{ width: `${pct}%` }} /></span>
                  </span>
                </a>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
