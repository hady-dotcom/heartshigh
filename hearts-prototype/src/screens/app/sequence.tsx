import Link from 'next/link'
import { AppFrame, Flash, Hidden } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { PrefToggle } from '@/components/app/me-controls'
import { brandColours, lockMessage, sequenceProgress, SEQUENCE_COPY } from '@/lib/sequence'
import { watchedCount, withDemoQuery } from '@/lib/parenting-demo'
import { DemoFrameTools } from '@/components/demo/frame-tools'
import { sortParts } from '@/lib/part-order'
import { learnerLessonVisible } from '@/lib/publish-state'
import { portalName } from '@/server/learner'
import type { PortalDoc } from '@/server/context'
import type { Payload } from 'payload'
import { ref, rows, str, type Ctx, type Row } from '../common'

function comingFilm(lesson: Row) {
  return !str(lesson.vimeoId) && !str(lesson.youtubeId) && str(lesson.videoProvider) !== 'file'
}

function groupsOf(lessons: Row[], units: Map<number, string>) {
  const groups: { title: string; rows: { lesson: Row; index: number }[] }[] = []
  lessons.forEach((lesson, index) => {
    const title = units.get(ref(lesson.unit) || 0) || 'Films'
    const last = groups[groups.length - 1]
    if (!last || last.title !== title) groups.push({ title, rows: [] })
    groups[groups.length - 1].rows.push({ lesson, index })
  })
  return groups
}

async function filmsFor(payload: Payload, portalId: number) {
  const courses = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portalId } }, { hidden: { not_equals: true } }] }, { sort: 'createdAt', limit: 5 })
  const course = courses[0]
  if (!course) return { course: null as Row | null, lessons: [] as Row[], units: new Map<number, string>() }
  const [lessonRows, unitRows] = await Promise.all([
    rows(payload, 'lessons', { course: { equals: course.id } }, { sort: 'order' }),
    rows(payload, 'units', { course: { equals: course.id } }, { sort: 'order' }),
  ])
  const units = new Map(unitRows.map((unit) => [unit.id, str(unit.title)]))
  const lessons = sortParts(lessonRows, () => 0).filter((row) => learnerLessonVisible({
    publishState: str(row.publishState),
    transcriptNote: str(row.transcriptNote),
    tooShort: row.tooShort === true,
  }))
  return { course, lessons, units }
}

function Mark({ name, logo }: { name: string; logo: string }) {
  if (logo) return <img className="portal-logo" src={logo} alt="" data-testid="portal-logo" />
  return <span className="portal-mark" data-testid="portal-mark" aria-hidden>{name.slice(0, 1).toUpperCase()}</span>
}

export async function SequenceGate({ payload, portal, base }: { payload: Payload; portal: PortalDoc; base: string }) {
  const { course, lessons, units } = await filmsFor(payload, portal.id)
  const name = portalName(portal)
  const brand = brandColours(portal)
  const groups = groupsOf(lessons, units)
  return (
    <AppFrame testId="sequence-gate" help="sequence-gate" brand={brand}>
      <div className="app-scroll">
        <header className="sequence-head">
          <Mark name={name} logo={str(portal.logoUrl)} />
          <div>
            {str(portal.brandName) ? <p className="brand-word" data-testid="portal-brand">{str(portal.brandName)}</p> : null}
            <p className="eyebrow">{str(course?.title) || 'Watch the films in order.'}</p>
            <h1 data-testid="sequence-name">{name}</h1>
          </div>
        </header>
        <p>{str(portal.welcome) || 'Watch the films in order.'}</p>
        <div data-testid="sequence-list">
          {groups.map((group) => (
            <section className="sequence-module" key={group.title} data-testid="sequence-module">
              <h2>{group.title}</h2>
              <ol className="sequence-list">
                {group.rows.map(({ lesson, index }) => (
                  <li key={lesson.id} data-testid="sequence-film" data-coming={comingFilm(lesson) ? 'yes' : 'no'}>
                    <span className="sequence-num">{index + 1}</span>
                    <span>{str(lesson.title)}</span>
                    {comingFilm(lesson) ? <small className="video-coming-label">Video coming</small> : null}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        {!lessons.length ? <p>Films will show here once they are added.</p> : null}
        <div className="sequence-actions">
          <Link className="pill outline block" href={`${base}/garden`} data-testid="gate-garden">Garden</Link>
          <Link className="pill gold block" href={`/login?next=${encodeURIComponent(base)}`} data-testid="sequence-sign-in">{SEQUENCE_COPY.signIn}</Link>
          <Link className="pill outline block" href={`/join?next=${encodeURIComponent(base)}`} data-testid="sequence-join">{SEQUENCE_COPY.join}</Link>
        </div>
      </div>
    </AppFrame>
  )
}

export async function SequenceHome(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const { course, lessons, units } = await filmsFor(payload, portal.id)
  const name = ctx.demo ? ctx.demo.cast.portalName : portalName(portal)
  const brand = brandColours(portal)
  const groups = groupsOf(lessons, units)
  const lessonIds = lessons.map((row) => row.id)
  const demoDone = new Set(
    ctx.demo
      ? lessons.filter((lesson) => ctx.demo!.state.watches.some((row) => row.learner === ctx.demo!.cast.learner && row.done && (row.lessonId === lesson.id || row.film === str(lesson.title)))).map((lesson) => lesson.id)
      : [],
  )
  const completions = !ctx.demo && lessonIds.length
    ? await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] })
    : []
  const done = ctx.demo ? demoDone : new Set(completions.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))
  const progress = sequenceProgress(ctx.demo ? watchedCount(ctx.demo.state, ctx.demo.cast.learner) : done.size, lessons.length)
  const nextIndex = Math.max(0, lessons.findIndex((row) => !done.has(row.id)))
  const next = lessons[nextIndex] || lessons[0]
  if (!ctx.demo && query.open === '1' && next && course) {
    const { redirect } = await import('next/navigation')
    redirect(`${base}/course/${course.id}?part=${next.id}`)
  }
  const link = (href: string) => (ctx.demo ? withDemoQuery(href, ctx.demo.token, ctx.demo.role) : href)
  return (
    <AppFrame testId="sequence-home" help="sequence-home" brand={brand}>
      <div className="app-scroll">
        {ctx.demo ? <DemoFrameTools token={ctx.demo.token} role={ctx.demo.role} cast={ctx.demo.cast} seq={ctx.demo.state.seq} /> : null}
        <Flash error={query.error} notice={query.notice} />
        <header className="sequence-head">
          <Mark name={name} logo={str(portal.logoUrl)} />
          <div>
            {str(portal.brandName) ? <p className="brand-word" data-testid="portal-brand">{str(portal.brandName)}</p> : null}
            <p className="eyebrow" data-testid="sequence-progress">{ctx.demo && !ctx.demo.state.features.progress ? 'Progress is off' : progress.eyebrow}</p>
            <h1 data-testid="sequence-name">{name}</h1>
            {ctx.demo ? <p data-testid="demo-hello">Hello {ctx.demo.cast.learner}</p> : null}
            <p data-testid="sequence-count">{ctx.demo && !ctx.demo.state.features.progress ? 'Progress is off' : progress.line}</p>
          </div>
        </header>
        <p data-testid="sequence-note">{str(course?.summary) || 'Watch the films in order.'}</p>
        {ctx.demo && ctx.demo.state.features.notes && ctx.demo.state.notes[0] ? <p className="card" data-testid="demo-note">{ctx.demo.state.notes[0].from}: {ctx.demo.state.notes[0].body}</p> : null}
        {ctx.demo && ctx.demo.state.features.plan ? <p className="card" data-testid="demo-plan">This week: watch one film.</p> : null}
        {next && course ? (
          <Link className="pill gold block" href={link(`${base}/course/${course.id}?part=${next.id}`)} data-testid="sequence-continue">{SEQUENCE_COPY.continue}</Link>
        ) : null}
        <div data-testid="sequence-list">
          {groups.map((group) => (
            <section className="sequence-module" key={group.title} data-testid="sequence-module">
              <h2>{group.title}</h2>
              <ol className="sequence-list">
                {group.rows.map(({ lesson, index }) => {
                  const locked = lockMessage(portal.lockOrder === true, index === 0 || done.has(lessons[index - 1].id), index)
                  const href = link(course ? `${base}/course/${course.id}?part=${lesson.id}` : base)
                  return (
                    <li key={lesson.id} data-testid="sequence-film" data-coming={comingFilm(lesson) ? 'yes' : 'no'}>
                      <Link href={href}>
                        <span className="sequence-num">{index + 1}</span>
                        <span>{str(lesson.title)}</span>
                        {comingFilm(lesson) ? <small className="video-coming-label">Video coming</small> : null}
                        {done.has(lesson.id) ? <small>Watched</small> : null}
                      </Link>
                      {locked ? <p className="sequence-lock" data-testid="sequence-lock">{locked}</p> : null}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
        </div>
        {!lessons.length ? <p>Films will show here once they are added.</p> : null}
      </div>
      <LearnerTabBar base={base} active="home" portal={portal} />
    </AppFrame>
  )
}

async function doneLessonIds(ctx: Ctx, lessons: Row[]) {
  if (ctx.demo) {
    return new Set(
      lessons
        .filter((lesson) => ctx.demo!.state.watches.some((row) => row.learner === ctx.demo!.cast.learner && row.done && (row.lessonId === lesson.id || row.film === str(lesson.title))))
        .map((lesson) => lesson.id),
    )
  }
  const lessonIds = lessons.map((row) => row.id)
  if (!ctx.user?.id || !lessonIds.length) return new Set<number>()
  const completions = await rows(ctx.payload, 'completions', { and: [{ user: { equals: ctx.user.id } }, { lesson: { in: lessonIds } }] })
  return new Set(completions.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))
}

export async function SequenceGarden(ctx: Ctx) {
  const { payload, portal, base, query } = ctx
  const { course, lessons, units } = await filmsFor(payload, portal.id)
  const groups = groupsOf(lessons, units)
  const done = await doneLessonIds(ctx, lessons)
  const link = (href: string) => (ctx.demo ? withDemoQuery(href, ctx.demo.token, ctx.demo.role) : href)
  const brand = str(portal.brandName) || 'Hady Home'
  const courseTitle = str(course?.title) || 'Guiding Home Learning'
  return (
    <AppFrame testId="sequence-garden" help="sequence-garden" brand={brandColours(portal)}>
      <div className="app-scroll">
        {ctx.demo ? <DemoFrameTools token={ctx.demo.token} role={ctx.demo.role} cast={ctx.demo.cast} seq={ctx.demo.state.seq} /> : null}
        <Flash error={query.error} notice={query.notice} />
        <p className="brand-word" data-testid="portal-brand">{brand}</p>
        <h1>Garden</h1>
        <p>The course and its parts. Open any part to start there.</p>
        <article className="garden-course" data-testid="garden-course">
          <h2>{courseTitle}</h2>
          <p>{done.size} of {lessons.length} films</p>
          {course ? <Link className="pill gold" href={link(base)}>Open the course</Link> : null}
        </article>
        <div data-testid="garden-areas">
          {groups.map((group) => {
            const watched = group.rows.filter(({ lesson }) => done.has(lesson.id)).length
            const first = group.rows[0]
            const href = first && course ? link(`${base}/course/${course.id}?part=${first.lesson.id}`) : link(base)
            return (
              <Link className="garden-area" href={href} key={group.title} data-testid="garden-area">
                <strong>{group.title}</strong>
                <small>{watched} of {group.rows.length} films</small>
              </Link>
            )
          })}
        </div>
      </div>
      <LearnerTabBar base={base} active="garden" portal={portal} />
    </AppFrame>
  )
}

export async function SequenceMe(ctx: Ctx) {
  const { payload, user, portal, base, query } = ctx
  const notes = ctx.demo ? [] : (await rows(payload, 'notifications', { user: { equals: user.id } }, { sort: '-createdAt', limit: 20 })).filter((note) => note.channel !== 'email-stub' && note.channel !== 'think')
  const name = ctx.demo ? ctx.demo.cast.portalName : portalName(portal)
  return (
    <AppFrame testId="sequence-me" help="sequence-me" brand={brandColours(portal)}>
      <div className="app-scroll">
        {ctx.demo ? <DemoFrameTools token={ctx.demo.token} role={ctx.demo.role} cast={ctx.demo.cast} seq={ctx.demo.state.seq} /> : null}
        <Flash error={query.error} notice={query.notice} />
        <h1 data-testid="sequence-me-name">{ctx.demo ? ctx.demo.cast.learner : user.name || name}</h1>
        <p>{SEQUENCE_COPY.saved}</p>
        <PrefToggle name="keepPlace" label={SEQUENCE_COPY.keep} hint="This browser can remember where you were." checked={user.keepPlace !== false} next={`${base}/me`} />
        {ctx.demo && ctx.demo.state.features.notes && ctx.demo.state.notes.length ? (
          <ul className="sequence-list" data-testid="sequence-notes">
            {ctx.demo.state.notes.map((note) => <li key={note.id} data-testid="demo-note">{note.from}: {note.body}</li>)}
          </ul>
        ) : notes.length ? (
          <ul className="sequence-list" data-testid="sequence-notes">
            {notes.map((note) => <li key={note.id}>{str(note.title)} {str(note.body)}</li>)}
          </ul>
        ) : <p className="muted">No notes yet.</p>}
        {ctx.demo && ctx.demo.state.features.plan ? <p data-testid="demo-plan">This week: watch one film.</p> : null}
        <form action={ctx.demo ? '/api/hearts/demo' : '/api/hearts'} method="post">
          <Hidden fields={{ action: 'logout', ...(ctx.demo ? { demo: ctx.demo.token, demoAs: ctx.demo.role, next: withDemoQuery(`${base}/me`, ctx.demo.token, ctx.demo.role) } : {}) }} />
          <button className="pill outline block" type="submit" data-testid="logout">{SEQUENCE_COPY.logout}</button>
        </form>
      </div>
      <LearnerTabBar base={base} active="me" portal={portal} />
    </AppFrame>
  )
}
