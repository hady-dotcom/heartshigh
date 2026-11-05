/** Course cards on My week. Progress is films finished over films in the course. */

export type WeekFilm = {
  id: number
  title: string
  place: number
  href: string
  done: boolean
}

export type WeekCourse = {
  id: number
  title: string
  sheetTitle: string
  sheetOrder: number
  count: number
  lengthLabel: string
  href: string
  poster: string | null
  filmTitle: string
  place: number
  films: WeekFilm[]
  /** Completions already stored for a signed-in parent. Guests start at zero and fill this on the phone. */
  finished: number
}

export type WeekSection = {
  title: string
  courses: WeekCourse[]
}

export function progressPercent(done: number, total: number) {
  if (!total) return 0
  const safe = Math.max(0, Math.min(done, total))
  return Math.round((safe / total) * 100)
}

export function withPhoneProgress(course: WeekCourse, doneIds: Set<number>): WeekCourse {
  const films = course.films.map((film) => ({ ...film, done: doneIds.has(film.id) }))
  return { ...course, films, finished: films.filter((film) => film.done).length }
}

/** The next film that is not finished, walking the library in section order. */
export function carryFilm(sections: WeekSection[]) {
  for (const section of sections) {
    for (const course of section.courses) {
      const next = course.films.find((film) => !film.done)
      if (!next) continue
      return { course, film: next, finished: course.films.filter((film) => film.done).length }
    }
  }
  const course = sections[0]?.courses[0]
  const film = course?.films[0]
  if (!course || !film) return null
  return { course, film, finished: course.films.filter((item) => item.done).length }
}
