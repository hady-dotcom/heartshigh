'use client'

import { useEffect, useState } from 'react'
import { FilmFallback } from '@/components/app/film-fallback'
import { coverPath } from '@/lib/cover-art'
import { readGuestDevice } from '@/lib/guest-device'
import { carryFilm, progressPercent, withPhoneProgress, type WeekCourse, type WeekSection } from '@/lib/week-library'

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

function filmLine(course: WeekCourse, finished: number) {
  const pct = progressPercent(finished, course.count)
  return `${finished} of ${course.count} film${course.count === 1 ? '' : 's'}${course.lengthLabel} · ${pct}%`
}

/** Course cards and a carry-on film. A signed-out parent’s ticks are read on this phone. */
export function WeekLibrary({ sections, guest, photos = false }: { sections: WeekSection[]; guest: boolean; photos?: boolean }) {
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
  if (photos) {
    return (
      <div data-testid="week-courses">
        {carry ? (
          <a className="tv-watch" href={carry.film.href} data-testid="carry-on">
            <img src={coverPath('course', carry.course.id, 'wide')} alt="" />
            <span className="tv-watch-bar" data-testid="carry-bar"><i style={{ width: `${progressPercent(carry.finished, carry.course.count)}%` }} /></span>
            <span className="tv-watch-meta">
              <small>Carry on</small>
              <b>{carry.film.place}. {carry.film.title}</b>
              <small>{carry.course.title} · {filmLine(carry.course, carry.finished)}</small>
            </span>
          </a>
        ) : null}
        {shown.map((section) => (
          <section className="tv-shelf" key={section.title} data-testid="library-collection">
            <h2>{section.title}</h2>
            <div className="tv-row">
              {section.courses.map((course) => (
                <a key={course.id} className="tv-poster" href={course.href} data-testid="course-card">
                  <img src={coverPath('course', course.id, 'tall')} alt="" />
                  <span className="tv-poster-copy">
                    <b>{course.title}</b>
                    <small data-testid="week-progress">{filmLine(course, course.finished)}</small>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    )
  }
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
