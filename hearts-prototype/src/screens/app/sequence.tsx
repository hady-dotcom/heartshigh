import Link from 'next/link'
import { AppFrame, Flash, Hidden } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { PrefToggle } from '@/components/app/me-controls'
import { brandColours, lockMessage, sequenceProgress, SEQUENCE_COPY } from '@/lib/sequence'
import { sortParts } from '@/lib/part-order'
import { learnerLessonVisible } from '@/lib/publish-state'
import { portalName } from '@/server/learner'
import type { PortalDoc } from '@/server/context'
import type { Payload } from 'payload'
import { ref, rows, str, type Ctx, type Row } from '../common'

async function filmsFor(payload: Payload, portalId: number) {
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portalId } }, { hidden: { not_equals: true } }] }, { sort: 'createdAt', limit: 5 })
  const course = courses[0]
  if (!course) return { course: null as Row | null, lessons: [] as Row[] }
  const lessonRows = await rows(payload, 'lessons', { course: { equals: course.id } }, { sort: 'order' })
  const lessons = sortParts(lessonRows, () => 0).filter((row) => learnerLessonVisible({
    publishState: str(row.publishState),
    transcriptNote: str(row.transcriptNote),
    tooShort: row.tooShort === true,
  }))
  return { course, lessons }
}

function Mark({ name, logo }: { name: string; logo: string }) {
  if (logo) return <img className="portal-logo" src={logo} alt="" data-testid="portal-logo" />
  return <span className="portal-mark" data-testid="portal-mark" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
}

export async function SequenceGate({ payload, portal, base }: { payload: Payload; portal: PortalDoc; base: string }) {
  const { lessons } = await filmsFor(payload, portal.id)
  const name = portalName(portal)
  const brand = brandColours(portal)
  return (
    <AppFrame testId="sequence-gate" help="sequence-gate" brand={brand}>
      <div className="app-scroll">
        <header className="sequence-head">
          <Mark name={name} logo={str(portal.logoUrl)} />
          <div>
            <p className="eyebrow">{SEQUENCE_COPY.examples}</p>
            <h1 data-testid="sequence-name">{name}</h1>
          </div>
        </header>
        <p>{str(portal.welcome) || 'Watch the films in order.'}</p>
        <ol className="sequence-list" data-testid="sequence-list">
          {lessons.map((lesson, index) => (
            <li key={lesson.id} data-testid="sequence-film">
              <span className="sequence-num">{index + 1}</span>
              <span>{str(lesson.title)}</span>
            </li>
          ))}
        </ol>
        {!lessons.length ? <p>Films will show here once they are added.</p> : null}
        <div className="sequence-actions">
          <Link className="pill gold block" href={`/login?next=${encodeURIComponent(base)}`} data-testid="sequence-sign-in">{SEQUENCE_COPY.signIn}</Link>
          <Link className="pill outline block" href={`/join?next=${encodeURIComponent(base)}`} data-testid="sequence-join">{SEQUENCE_COPY.join}</Link>
        </div>
      </div>
    </AppFrame>
  )
}

export async function SequenceHome(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const { course, lessons } = await filmsFor(payload, portal.id)
  const name = portalName(portal)
  const brand = brandColours(portal)
  const lessonIds = lessons.map((row) => row.id)
  const completions = lessonIds.length
    ? await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] })
    : []
  const done = new Set(completions.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))
  const progress = sequenceProgress(done.size, lessons.length)
  const nextIndex = Math.max(0, lessons.findIndex((row) => !done.has(row.id)))
  const next = lessons[nextIndex] || lessons[0]
  return (
    <AppFrame testId="sequence-home" help="sequence-home" brand={brand}>
      <div className="app-scroll">
        <Flash error={query.error} notice={query.notice} />
        <header className="sequence-head">
          <Mark name={name} logo={str(portal.logoUrl)} />
          <div>
            <p className="eyebrow" data-testid="sequence-progress">{progress.eyebrow}</p>
            <h1 data-testid="sequence-name">{name}</h1>
            <p data-testid="sequence-count">{progress.line}</p>
          </div>
        </header>
        <p data-testid="sequence-note">{SEQUENCE_COPY.examples}</p>
        {next && course ? (
          <Link className="pill gold block" href={`${base}/course/${course.id}?part=${next.id}`} data-testid="sequence-continue">{SEQUENCE_COPY.continue}</Link>
        ) : null}
        <ol className="sequence-list" data-testid="sequence-list">
          {lessons.map((lesson, index) => {
            const locked = lockMessage(portal.lockOrder === true, index === 0 || done.has(lessons[index - 1].id), index)
            const href = course ? `${base}/course/${course.id}?part=${lesson.id}` : base
            return (
              <li key={lesson.id} data-testid="sequence-film">
                <Link href={href}>
                  <span className="sequence-num">{index + 1}</span>
                  <span>{str(lesson.title)}</span>
                  {done.has(lesson.id) ? <small>Watched</small> : null}
                </Link>
                {locked ? <p className="sequence-lock" data-testid="sequence-lock">{locked}</p> : null}
              </li>
            )
          })}
        </ol>
        {!lessons.length ? <p>Films will show here once they are added.</p> : null}
      </div>
      <LearnerTabBar base={base} active="home" portal={portal} />
    </AppFrame>
  )
}

export async function SequenceMe({ payload, user, portal, base, query }: Ctx) {
  const notes = (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 20 })).filter((note) => note.channel !== 'email-stub' && note.channel !== 'think')
  const name = portalName(portal)
  return (
    <AppFrame testId="sequence-me" help="sequence-me" brand={brandColours(portal)}>
      <div className="app-scroll">
        <Flash error={query.error} notice={query.notice} />
        <h1 data-testid="sequence-me-name">{user.name || name}</h1>
        <p>{SEQUENCE_COPY.saved}</p>
        <PrefToggle name="keepPlace" label={SEQUENCE_COPY.keep} hint="This browser can remember where you were." checked={user.keepPlace !== false} next={`${base}/me`} />
        {notes.length ? (
          <ul className="sequence-list" data-testid="sequence-notes">
            {notes.map((note) => <li key={note.id}>{str(note.title)} {str(note.body)}</li>)}
          </ul>
        ) : <p className="muted">No notes yet.</p>}
        <form action="/api/hearts" method="post">
          <Hidden fields={{ action: 'logout' }} />
          <button className="pill outline block" type="submit" data-testid="logout">{SEQUENCE_COPY.logout}</button>
        </form>
      </div>
      <LearnerTabBar base={base} active="me" portal={portal} />
    </AppFrame>
  )
}
