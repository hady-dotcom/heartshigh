import type { Payload } from 'payload'
import { AppFrame } from '@/components/app/shell'
import { FilmFallback } from '@/components/app/film-fallback'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { GuestFilmView } from '@/components/journey/guest-film'
import { learnerBrand } from '@/lib/learner-brand'
import type { PortalDoc } from '@/server/context'
import { guestCourseFilm, guestLibrary } from '@/server/guest-films'

/** Courses for a signed-out visitor. No account, and no dark empty feed. */
export async function GuestCoursesScreen({ payload, portal, base }: { payload: Payload; portal: PortalDoc; base: string }) {
  const library = await guestLibrary(payload, portal.id, base)
  return (
    <AppFrame testId="garden" brand={learnerBrand(portal)}>
      <div className="app-scroll" data-testid="course-home">
        <div className="app-head"><h1>Courses</h1></div>
        {library.courses.length ? (
          <div className="course-cards">
            {library.courses.map((course) => (
              <a key={course.id} className="course-card" href={course.href} data-testid="course-card">
                {course.poster ? <span className="thumb"><img src={course.poster} alt="" /></span> : (
                  <span className="thumb is-fallback" data-testid="film-thumb"><FilmFallback place={course.place} title={course.filmTitle} /></span>
                )}
                <span className="t">
                  <b>{course.title}</b>
                  <small>{course.count} film{course.count === 1 ? '' : 's'}</small>
                </span>
              </a>
            ))}
          </div>
        ) : <p className="card">Films will show here once a course is added.</p>}
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}

export async function GuestCourseScreen({ payload, portal, base, courseId, part }: { payload: Payload; portal: PortalDoc; base: string; courseId: number; part?: string }) {
  const found = await guestCourseFilm(payload, portal.id, base, courseId, Number(part) || undefined)
  if (!found) return null
  return (
    <AppFrame testId="course" brand={learnerBrand(portal)}>
      <div className="app-scroll">
        <GuestFilmView film={found.film} heading={found.card.title} />
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}
