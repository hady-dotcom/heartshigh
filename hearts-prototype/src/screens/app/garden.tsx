import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { EmptyState } from '@/components/app/empty'
import { GardenPath } from '@/components/app/garden-path'
import { Flower, LockIcon } from '@/components/icons'
import { now } from '@/lib/clock'
import { isNewMoment, readableHarvest } from '@/lib/harvest'
import { getSession, type SessionUser, visibleCourseIds } from '@/server/context'
import { workbookFor } from '@/server/workbook'
import { partTitle, tidyTalkTitle } from '@/lib/talk-title'
import { learnerWords } from '@/lib/tidy-caption'
import { countsTowardProgress, pieceLevel } from '@/lib/progress'
import { countedTalkCompletions, growthLessonIds, watchedLessonIds } from '@/lib/watch-growth'
import { isLongTalk, matchDoorTalk } from '@/lib/first-course'
import { FilePick } from '@/components/app/file-pick'
import { posterFor, shownPoster } from '@/server/learner'
import { loadDoors } from '@/server/doors'
import { capitalAfterColon, doorByNumber, doorCode, doorFromPath, doorNumberOfClause, doorOfClause, type Door } from '@/lib/doors'
import { areaGrowth, type AreaView } from '@/lib/garden-areas'
import type { GardenTheme } from '@/lib/garden-art'
import { GardenScene } from '@/components/app/garden-scene'
import { answerCounts } from '@/lib/nesting'
import { taskWantsCompany } from '@/lib/gather'
import { featureOn } from '@/lib/features'
import { listGatherings } from '@/server/gather'
import { type Ctx, type Row, clock, ref, rows, shortDate, str, unreadCount } from '../common'
import { ReportButton } from '@/components/app/report-sheet'
import { RitualForm } from '@/components/app/ritual-form'

const SECTIONS: { key: string; title: string; colour: string }[] = [
  { key: 'Sitting', title: 'The sitting', colour: '#e98fb0' },
  { key: 'Islam', title: 'Islam', colour: '#f0b44c' },
  { key: 'Iman', title: 'Iman', colour: '#7fc4a8' },
  { key: 'Ihsan', title: 'Ihsan', colour: '#a98bd6' },
  { key: 'Hour', title: 'The Hour', colour: '#ef8a5a' },
  { key: 'Trunk', title: 'He came to teach you your religion', colour: '#6fa8dc' },
]

export type Growth = {
  clauses: Row[]
  doors: Door[]
  seats: Row[]
  /** Doors that have flowered: a finished talk sits on one of their clauses. */
  lit: Set<number>
  completions: Row[]
  lessons: Row[]
  seatVisits: Row[]
  harvest: Row[]
  workbook: Row[]
  answers: Row[]
  rituals: Row[]
  activeDays: Set<string>
  secondsGiven: number
  watched: number
  activityLit: Set<number>
  harvestNew: number
  workbookShown: number
}

export async function growth(payload: Payload, user: SessionUser): Promise<Growth> {
  const mine = { user: { equals: user.id } }
  const [clauses, seats, completions, seatVisits, harvest, allWorkbook, allAnswers, rituals, visits, tags, doors, sessions] = await Promise.all([
    rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }),
    rows(payload, 'seats', undefined, { sort: 'position', limit: 400 }),
    rows(payload, 'completions', mine),
    rows(payload, 'seat-visits', mine),
    rows(payload, 'harvest-entries', mine, { sort: '-createdAt', limit: 1000 }).then(readableHarvest),
    rows(payload, 'workbook-entries', mine, { sort: '-createdAt' }),
    rows(payload, 'answers', mine),
    rows(payload, 'rituals', mine, { sort: '-createdAt' }),
    rows(payload, 'lesson-visits', mine),
    rows(payload, 'tags', { state: { equals: 'confirmed' } }, { limit: 1000 }),
    loadDoors(payload),
    rows(payload, 'watch-sessions', mine, { limit: 500 }),
  ])
  const answers = allAnswers.filter(answerCounts)
  const browsed = new Set(allAnswers.filter((row) => !answerCounts(row)).map((row) => row.id))
  const workbook = allWorkbook.filter((row) => !browsed.has(ref(row.answer) || 0))
  const lessonIds = growthLessonIds({ completions, visits, answers, sessions })
  const lessons = lessonIds.length ? await rows(payload, 'lessons', { id: { in: lessonIds } }, { limit: 800 }) : []
  const courseByLesson = new Map(lessons.map((row) => [row.id, ref(row.course)]))
  const inCourse = (lessonId: number | null) => Boolean(lessonId && courseByLesson.get(lessonId))
  const countedCompletions = countedTalkCompletions({ completions, courseByLesson })
  const countedAnswers = answers.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: inCourse(ref(row.lesson)), event: 'question', viaGathering: row.viaGathering === true }))
  const done = new Set(countedCompletions.map((row) => ref(row.lesson)))
  const watchedIds = new Set(
    countedCompletions
      .filter((row) => Number(row.percent ?? 100) >= 90)
      .map((row) => ref(row.lesson))
      .filter((id): id is number => Boolean(id)),
  )
  const cutIds = tags.map((tag) => ref((tag.item as { value?: unknown } | undefined)?.value)).filter((id): id is number => Boolean(id))
  const cuts = cutIds.length ? await rows(payload, 'cuts', { id: { in: cutIds } }, { limit: 1000 }) : []
  const lit = new Set<number>()
  const activityLit = new Set<number>()
  for (const tag of tags) {
    const cut = cuts.find((row) => row.id === ref((tag.item as { value?: unknown } | undefined)?.value))
    if (!cut) continue
    const clause = clauses.find((row) => row.id === ref(tag.clause))
    const door = clause ? doorOfClause(Number(clause.number), doors) : null
    if (!door) continue
    const lessonId = ref(cut.lesson)
    if (lessonId && done.has(lessonId)) lit.add(door.number)
    if (lessonId && watchedIds.has(lessonId)) activityLit.add(door.number)
  }
  const at = now()
  const harvestNew = harvest.filter((row) => isNewMoment(str(row.createdAt) || str(row.gatheredAt), str(row.seenAt) || null, at)).length
  const activeDays = new Set([...countedCompletions, ...countedAnswers, ...visits, ...rituals, ...seatVisits].map((row) => str(row.createdAt).slice(0, 10)).filter(Boolean))
  const secondsGiven = countedCompletions.reduce((sum, row) => {
    const lesson = lessons.find((item) => item.id === ref(row.lesson))
    return sum + (Number(lesson?.durationSeconds || 0) * Number(row.percent || 100)) / 100
  }, 0)
  const book = await workbookFor(payload, user, user)
  const workbookShown = book.answers.length
  return { clauses, doors, seats, lit, completions: countedCompletions, lessons, seatVisits, harvest, workbook, answers: countedAnswers, rituals, activeDays, secondsGiven, watched: watchedIds.size, activityLit, harvestNew, workbookShown }
}

function sectionOf(doors: Door[], key: string) {
  return doors.filter((door) => door.section === key)
}

function clausesOf(g: Growth, door: Door) {
  return door.clauses.map((number) => g.clauses.find((row) => Number(row.number) === number)).filter((row): row is Row => Boolean(row))
}

const SEATS_SHOWN = 6

function seatsOf(g: Growth, door: Door) {
  return clausesOf(g, door).flatMap((clause) => g.seats.filter((seat) => ref(seat.clause) === clause.id).sort((a, b) => Number(a.position) - Number(b.position)))
}

export function Rings({ g, base, portal }: { g: Growth; base: string; portal?: import('@/lib/features').FeatureSource }) {
  const sections = SECTIONS.filter((section) => sectionOf(g.doors, section.key).some((door) => (g.activityLit || g.lit).has(door.number))).length
  const items: [string, number, string, string, number?, string?][] = [
    ['Finished', g.watched, '#e2c27a', `${base}/garden/general`, undefined, 'ring-watched'],
    ['Sections', sections, '#f0e2c4', `${base}/garden/jibril`],
    ['Field', g.seatVisits.length, '#b7c7a4', `${base}/garden/ghunya`],
    ['Harvest', g.harvest.length, '#8fbfb4', `${base}/garden/harvest`, g.harvestNew || undefined],
    ...((!portal || featureOn(portal, 'workbook')) ? [['Workbook', g.workbookShown ?? g.workbook.length, '#e2b08a', `${base}/garden/workbook`] as [string, number, string, string]] : []),
  ]
  return (
    <div className="rings" data-testid="rings">
      {items.map(([label, value, colour, href, fresh, testId]) => (
        <Link key={label} className="ring-stat" href={href} data-testid={testId || `ring-${label.toLowerCase()}`}>
          <span className="r" style={{ borderColor: colour }}>{value}</span>
          {label}
          {fresh ? <em className="ring-new" data-testid={`ring-${label.toLowerCase()}-new`}>{fresh} new</em> : null}
        </Link>
      ))}
    </div>
  )
}

/** The lessons of the course the learner is in now, as one path with the active lesson marked. */
export async function coursePath(payload: Payload, user: SessionUser, base: string, g: Growth, courseId?: number | null) {
  let id = courseId || null
  if (!id) {
    const visits = await rows(payload, 'lesson-visits', { user: { equals: user.id } }, { sort: '-updatedAt', limit: 1 })
    const lesson = visits[0] ? g.lessons.find((row) => row.id === ref(visits[0].lesson)) : null
    id = lesson ? ref(lesson.course) : null
  }
  if (!id) id = (await visibleCourseIds(payload, user))[0] || null
  if (!id) return null
  const course = (await rows(payload, 'courses', { id: { equals: id } }))[0]
  const lessons = await rows(payload, 'lessons', { course: { equals: id } }, { sort: 'order', limit: 60 })
  if (!course || !lessons.length) return null
  const done = new Set(g.completions.filter((row) => Number(row.percent ?? 100) >= 90).map((row) => ref(row.lesson)))
  const active = lessons.find((lesson) => !done.has(lesson.id))
  return {
    title: str(course.title),
    nodes: lessons.map((lesson) => ({
      id: lesson.id,
      title: partTitle(lesson, str(course.title)),
      href: `${base}/course/${id}?part=${lesson.id}`,
      state: (done.has(lesson.id) ? 'done' : lesson.id === active?.id ? 'active' : 'next') as 'done' | 'active' | 'next',
    })),
  }
}

/** Trees for the garden screen. Lessons are placed by a cut's best clause, then by a confirmed tag. */
async function areaViews(payload: Payload, user: SessionUser, base: string, g: Growth): Promise<AreaView[]> {
  const courseIds = await visibleCourseIds(payload, user)
  const empty = areaGrowth({
    lessons: [],
    completions: [],
    points: [],
    answers: [],
    courses: [],
    hrefForLesson: () => base,
    hrefForCourse: () => base,
    workbookHref: `${base}/garden/workbook`,
  })
  if (!courseIds.length) return empty
  const [lessons, courses] = await Promise.all([
    rows(payload, 'lessons', { course: { in: courseIds } }, { limit: 500 }),
    rows(payload, 'courses', { id: { in: courseIds } }, { limit: 80 }),
  ])
  const lessonIds = lessons.map((lesson) => lesson.id)
  const cuts = lessonIds.length ? await rows(payload, 'cuts', { lesson: { in: lessonIds } }, { limit: 2000 }) : []
  const tags = await rows(payload, 'tags', { state: { equals: 'confirmed' } }, { limit: 2000 })
  const doorFor = (lessonId: number) => {
    const own = cuts.filter((cut) => ref(cut.lesson) === lessonId)
    for (const cut of own) {
      const door = doorNumberOfClause(Number(cut.bestClause || 0), g.doors)
      if (door) return door
    }
    for (const cut of own) {
      const tag = tags.find((row) => ref((row.item as { value?: unknown } | undefined)?.value) === cut.id && ref(row.clause))
      const clause = tag ? g.clauses.find((row) => row.id === ref(tag.clause)) : null
      const door = doorNumberOfClause(Number(clause?.number || 0), g.doors)
      if (door) return door
    }
    return null
  }
  const points = lessonIds.length
    ? await rows(payload, 'engagement-points', { and: [{ lesson: { in: lessonIds } }, { or: [{ status: { not_equals: 'draft' } }, { status: { exists: false } }] }] }, { limit: 2000 })
    : []
  return areaGrowth({
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      courseId: ref(lesson.course) || 0,
      title: learnerWords(partTitle(lesson)),
      door: doorFor(lesson.id),
    })),
    completions: g.completions.map((row) => ({ lessonId: ref(row.lesson) || 0 })).filter((row) => row.lessonId),
    points: points.map((point) => ({ id: point.id, lessonId: ref(point.lesson) || 0 })),
    answers: g.answers.map((row) => ({ pointId: ref(row.point) || 0 })).filter((row) => row.pointId),
    courses: courses.map((course) => ({ id: course.id, title: str(course.title) })),
    hrefForLesson: (lessonId, courseId) => `${base}/course/${courseId}?part=${lessonId}`,
    hrefForCourse: (courseId) => `${base}/course/${courseId}`,
    workbookHref: `${base}/garden/workbook`,
  })
}

export async function GardenScreen({ payload, user, portal, base, query }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const [areas, path] = await Promise.all([areaViews(payload, user, base, g), coursePath(payload, user, base, g)])
  const starting = doorOfClause(Number(user.startingClause || 0), g.doors)
  return (
    <AppFrame testId="garden">
      <div className="app-scroll garden-home">
        <GardenScene areas={areas} theme={query.theme === 'dawn' || query.theme === 'evening' ? (query.theme satisfies GardenTheme) : undefined} />
        <div className="garden-rest">
        <Flash error={query.error} notice={query.notice} />
        <section className="garden-rings card" data-testid="garden-rings">
          <p className="eyebrow" style={{ margin: '0 0 8px' }}>Five ways to see it</p>
          <Rings g={g} base={base} portal={portal} />
          <p className="muted" style={{ fontSize: 13, margin: '10px 0 0' }} data-testid="watched-rule">Finished counts every full talk you have sat with. Your path below is this course only.</p>
        </section>
        {path ? <GardenPath title={path.title} nodes={path.nodes} /> : (
          <EmptyState testId="garden-empty" action={{ href: `${base}/lanes`, label: 'Browse courses' }}>
            Start a course from Lanes and its path will grow here, one lesson at a time.
          </EmptyState>
        )}
        {starting ? (
          <>
            <p className="eyebrow">Where you began</p>
            <Link className="card" href={`${base}/garden/jibril/${starting.number}`} style={{ display: 'block', textDecoration: 'none' }} data-testid="starting-door" data-door={starting.number}>
              <h3>Door {starting.number}: {capitalAfterColon(starting.title)}</h3>
              <p>Your answers when you joined pointed here. Your first course was chosen from the talks that sit in this door.</p>
            </Link>
          </>
        ) : null}
        <p className="eyebrow">A small act</p>
        <section className="card">
          <p style={{ marginBottom: 10 }}>Something you did today because of what you heard. Only you see this.</p>
          <RitualForm next={`${base}/garden`} />
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }} data-testid="ritual-count">{g.rituals.length} small act{g.rituals.length === 1 ? '' : 's'} kept so far.</p>
        </section>
        </div>
      </div>
      <TabBar base={base} active="garden" portal={portal} unread={unread} />
    </AppFrame>
  )
}

export function Frame({ base, title, testId, children, unread, dark, evening, portal }: { base: string; title: string; testId: string; children: React.ReactNode; unread: number; dark?: boolean; evening?: boolean; portal?: import('@/lib/features').FeatureSource }) {
  return (
    <AppFrame testId={testId} dark={dark} evening={evening}>
      <div className="app-scroll">
        {dark ? children : (
          <>
            <Back href={`${base}/garden`} label="Garden" />
            <div className="app-head"><h1>{title}</h1></div>
            {children}
          </>
        )}
      </div>
      <TabBar base={base} active="garden" portal={portal} unread={unread} dark={dark} evening={evening} />
    </AppFrame>
  )
}

export async function GardenGeneral({ payload, user, portal, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const hours = Math.floor(g.secondsGiven / 3600)
  const minutes = Math.round((g.secondsGiven % 3600) / 60)
  const today = now()
  const fortnight = Array.from({ length: 14 }, (_, index) => new Date(today.getTime() - (13 - index) * 86_400_000).toISOString().slice(0, 10))
  const courseIds = [...new Set(g.lessons.map((lesson) => ref(lesson.course)).filter((id): id is number => Boolean(id)))]
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  const returns = courses
    .map((course) => {
      const lessonIds = g.lessons.filter((lesson) => ref(lesson.course) === course.id).map((lesson) => lesson.id)
      const count = [...g.completions, ...g.answers].filter((row) => lessonIds.includes(ref(row.lesson) || 0)).length
      return { title: tidyTalkTitle(str(course.title)), count }
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  const top = Math.max(1, ...returns.map((row) => row.count))
  return (
    <Frame base={base} title="General" testId="garden-general" unread={unread} portal={portal}>
      <section className="time-card">
        <p className="eyebrow">Time given</p>
        <div className="big" data-testid="time-given">{hours ? `${hours}h ` : ''}{minutes}m</div>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Counted from talks you finished or marked as watched. Clips do not count.</p>
      </section>
      <div className="stat-grid">
        <div className="stat-box"><b data-testid="stat-sittings">{g.completions.length}</b><small>Parts watched</small></div>
        <div className="stat-box"><b data-testid="stat-answers">{g.answers.length}</b><small>Questions answered</small></div>
        <div className="stat-box"><b>{g.seatVisits.length}</b><small>Seats read</small></div>
        <div className="stat-box"><b data-testid="stat-harvest">{g.harvest.length}</b><small>Verses, hadith and lines</small></div>
      </div>
      <section className="days-card" data-testid="days-card">
        <h3>Days you came</h3>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>The last two weeks. Each flower is a day you spent time here.</p>
        <div className="flowers">
          {fortnight.map((day) => (g.activeDays.has(day) ? <Flower key={day} /> : <span key={day} className="empty-dot" title={day} />))}
        </div>
      </section>
      <p className="eyebrow">Most returned to</p>
      {returns.length ? returns.map((row) => (
        <div className="ret-row" key={row.title} data-testid="returned">
          <span>{row.title.length > 14 ? `${row.title.slice(0, 13)}…` : row.title}</span>
          <span className="track"><i style={{ width: `${(row.count / top) * 100}%` }} /></span>
          <small>{row.count} time{row.count === 1 ? '' : 's'}</small>
        </div>
      )) : <p className="muted">Once you watch a part or answer a question, the talks you come back to will show here.</p>}
    </Frame>
  )
}

export async function GardenJibril({ payload, user, portal, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const startDoor = doorOfClause(Number(user.startingClause || 0), g.doors)?.number
  return (
    <Frame base={base} title="The hadith of Jibril" testId="garden-jibril" unread={unread} portal={portal}>
      <section className="summary-card gold">
        <h2 data-testid="lit-count">{g.lit.size} of {g.doors.length} doors</h2>
        <p>A door flowers when you finish a talk that a teacher has placed in it. Tap any door to read it.</p>
      </section>
      <div data-testid="door-map">
        {SECTIONS.map((section) => {
          const doors = sectionOf(g.doors, section.key)
          if (!doors.length) return null
          const litHere = doors.filter((door) => g.lit.has(door.number)).length
          return (
            <div className="section-row" key={section.key} data-testid="section-row">
              <header><span>{section.title}</span><small>{litHere} of {doors.length}</small></header>
              <div className="door-grid">
                {doors.map((door) => {
                  const on = g.lit.has(door.number)
                  const start = startDoor === door.number
                  return (
                    <Link key={door.number} className={`door-cell${start ? ' start' : ''}`} href={`${base}/garden/jibril/${door.number}`} data-testid="door-cell" data-door={door.number} data-lit={on ? 'yes' : 'no'} data-start={start ? 'yes' : 'no'}>
                      <span className="mark">{on ? <Flower colour={section.colour} /> : <span className="empty-dot" />}</span>
                      <span className="n">{door.number}</span>
                      <span className="t">{capitalAfterColon(door.title)}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>A gold ring marks the door your answers pointed to when you joined.</p>
    </Frame>
  )
}

export async function GardenDoor({ payload, user, portal, base, query }: Ctx, token: string) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const door = doorFromPath(token, g.doors)
  if (!door) notFound()
  const clauses = clausesOf(g, door)
  const seats = seatsOf(g, door)
  const read = new Set(g.seatVisits.map((visit) => ref(visit.seat)))
  const cuts = await rows(payload, 'cuts', { and: [{ bestClause: { in: door.clauses } }, { status: { equals: 'approved' } }] }, { limit: 40 })
  const visible = new Set(await visibleCourseIds(payload, user))
  const lessonIds = [...new Set(cuts.map((cut) => ref(cut.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? (await rows(payload, 'lessons', { id: { in: lessonIds } })).filter((lesson) => visible.has(ref(lesson.course) || 0)) : []
  const shownIds = lessons.map((lesson) => lesson.id)
  const [points, tiers] = await Promise.all([
    shownIds.length ? rows(payload, 'engagement-points', { and: [{ lesson: { in: shownIds } }, { status: { not_equals: 'draft' } }, { audience: { equals: 'everyone' } }] }, { sort: 'second', limit: 80 }) : Promise.resolve([] as Row[]),
    shownIds.length ? rows(payload, 'talk-tiers', { and: [{ lesson: { in: shownIds } }, { status: { not_equals: 'rejected' } }] }) : Promise.resolve([] as Row[]),
  ])
  const courseIds = [...new Set(lessons.map((lesson) => ref(lesson.course)).filter((id): id is number => Boolean(id)))]
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  const talkName = (lesson: Row) => partTitle(lesson, str(courses.find((course) => course.id === ref(lesson.course))?.title))
  const lessonOf = (id: number | null) => lessons.find((lesson) => lesson.id === id)
  const courseTitleOf = (lesson: Row) => str(courses.find((course) => course.id === ref(lesson.course))?.title)
  const quotesOf = (lesson: Row) => cuts.filter((cut) => ref(cut.lesson) === lesson.id).flatMap((cut) => [str(cut.hook), str(cut.turn), str(cut.land)].filter(Boolean))
  const longs = lessons.filter((lesson) => isLongTalk({ title: str(lesson.title), durationSeconds: Number(lesson.durationSeconds || 0) }, courseTitleOf(lesson)) && matchDoorTalk(door.number, { title: talkName(lesson), courseTitle: courseTitleOf(lesson), quotes: quotesOf(lesson) }))
  const clips = lessons.filter((lesson) => !longs.some((row) => row.id === lesson.id))
  const here = `${base}/garden/jibril/${door.number}`
  const teachings = clauses.map((clause) => str(clause.teaching)).filter(Boolean)
  const series = [...new Set(clauses.map((clause) => str(clause.series)).filter(Boolean))]
  const section = SECTIONS.find((row) => row.key === door.section)
  const prev = doorByNumber(door.number - 1, g.doors)
  const next = doorByNumber(door.number + 1, g.doors)
  const seatLine = (seat: Row, index: number) => (
    <div className="seat-line" key={seat.id} data-testid="seat">
      <p style={{ margin: 0 }}>({index + 1}) {str(seat.text)}</p>
      {read.has(seat.id) ? (
        <span className="seat-done" data-testid="seat-done">Read</span>
      ) : (
        <form action="/api/hearts" method="post">
          <Hidden fields={{ action: 'seat', seat: seat.id, next: here }} />
          <button className="mini-btn" type="submit" data-testid="seat-read">I&apos;ve read this</button>
        </form>
      )}
    </div>
  )
  return (
    <Frame base={base} title={`Door ${door.number}`} testId="garden-door" unread={unread} portal={portal}>
      <Flash error={query.error} notice={query.notice} />
      <article className="clause-card" data-testid="door-card" data-door={door.number}>
        <div className="clause-num">{door.number}</div>
        <p className="lbl" style={{ margin: '0 0 4px' }}>{section?.title || door.section}</p>
        <h3 data-testid="door-title">{capitalAfterColon(door.title)}</h3>
        {door.teaching ? <p data-testid="door-teaching">{door.teaching}</p> : null}
        {clauses.length ? <p className="door-words" data-testid="door-words">{clauses.map((clause) => str(clause.fragment)).join(' … ')}</p> : null}
        {teachings.length ? (
          <>
            <p className="lbl" style={{ margin: '14px 0 4px' }}>Teaching.</p>
            {teachings.map((line, index) => <p key={index}>{line}</p>)}
          </>
        ) : null}
        {seats.length ? <p className="lbl" style={{ margin: '14px 0 4px' }}>Seats from al-Ghuniyya.</p> : null}
        {seats.slice(0, SEATS_SHOWN).map(seatLine)}
        {seats.length > SEATS_SHOWN ? (
          <details data-testid="seat-more">
            <summary className="hint" style={{ cursor: 'pointer', margin: '8px 0' }}>Show all {seats.length} seats</summary>
            {seats.slice(SEATS_SHOWN).map((seat, index) => seatLine(seat, index + SEATS_SHOWN))}
          </details>
        ) : null}
        {series.length ? <p style={{ marginTop: 14 }}><span className="lbl">From the series.</span> {series.join(' ')}</p> : null}
      </article>
      <p className="eyebrow">Talks in this door</p>
      {!longs.length ? <p className="muted" data-testid="door-waiting">A longer talk for this door is on its way</p> : null}
      {longs.length ? longs.map((lesson) => {
        const cut = cuts.find((row) => ref(row.lesson) === lesson.id)
        return (
          <Link key={lesson.id} className="course-row" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.floor(Number(cut?.start || 0))}`} data-testid="door-talk">
            <span className="thumb" style={shownPoster(posterFor(str(lesson.youtubeId) || null)) ? { backgroundImage: `url(${shownPoster(posterFor(str(lesson.youtubeId)))})` } : undefined} />
            <span className="t"><b>{talkName(lesson)}</b><small>From {clock(Number(cut?.start || 0))} · {str(lesson.speaker)}</small></span>
            <span className="start teal">Watch</span>
          </Link>
        )
      }) : null}
      {clips.length ? <p className="eyebrow">Clips in this door</p> : null}
      {clips.map((lesson) => {
        const cut = cuts.find((row) => ref(row.lesson) === lesson.id)
        return (
          <Link key={lesson.id} className="course-row" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.floor(Number(cut?.start || 0))}`} data-testid="door-clip">
            <span className="thumb" style={shownPoster(posterFor(str(lesson.youtubeId) || null)) ? { backgroundImage: `url(${shownPoster(posterFor(str(lesson.youtubeId)))})` } : undefined} />
            <span className="t"><b>{talkName(lesson)}</b><small>From {clock(Number(cut?.start || 0))} · {str(lesson.speaker)}</small></span>
            <span className="start teal">Watch</span>
          </Link>
        )
      })}
      {!lessons.length ? <p className="muted">No talk in your courses has been placed in this door yet.</p> : null}
      {tiers.length ? <p className="eyebrow">Ready for more?</p> : null}
      {tiers.map((tier) => {
        const lesson = lessonOf(ref(tier.lesson))
        if (!lesson) return null
        const start = Number(tier.appetiserStart || 0)
        return (
          <Link key={tier.id} className="course-row" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.floor(start)}`} data-testid="door-appetiser">
            <span className="t"><b>Ready for more?</b><small>{talkName(lesson)} · from {clock(start)}</small></span>
            <span className="start teal">Watch</span>
          </Link>
        )
      })}
      {points.length ? <p className="eyebrow">Questions</p> : null}
      {points.map((point) => {
        const lesson = lessonOf(ref(point.lesson))
        if (!lesson) return null
        return (
          <Link key={point.id} className="course-row" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.floor(Number(point.second || 0))}`} data-testid="door-question">
            <span className="t"><b>{str(point.prompt)}</b><small>{talkName(lesson)}</small></span>
            <span className="start teal">Open</span>
          </Link>
        )
      })}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
        {prev ? <Link className="pill outline small" href={`${base}/garden/jibril/${prev.number}`} data-testid="prev-door">‹ Door {prev.number}</Link> : <span />}
        {next ? <Link className="pill outline small" href={`${base}/garden/jibril/${next.number}`} data-testid="next-door">Door {next.number} ›</Link> : null}
      </div>
    </Frame>
  )
}

export async function GardenGhunya({ payload, user, portal, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const read = new Set(g.seatVisits.map((visit) => ref(visit.seat)))
  const recent = g.seatVisits
    .slice()
    .sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)))
    .slice(0, 4)
    .map((visit) => g.seats.find((seat) => seat.id === ref(visit.seat)))
    .filter((seat): seat is Row => Boolean(seat))
  return (
    <Frame base={base} title="Seats from al-Ghuniyya" testId="garden-ghunya" unread={unread} dark portal={portal}>
      <div className="forest">
        <Back href={`${base}/garden`} label="Garden" />
        <p className="eyebrow" style={{ color: 'var(--gold)', marginTop: 10 }}>Seats from al-Ghuniyya</p>
        <h1 style={{ margin: 0, fontSize: 26 }}>The seats you have read</h1>
        <p className="big" data-testid="seat-count">{read.size} <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>of {g.seats.length}</span></p>
        <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, margin: '6px 0 0', fontSize: 14 }}>Each door of the hadith opens onto seats from al-Ghuniyya. One group of dots per door.</p>
        <div className="seat-groups" data-testid="seat-grid">
          {g.doors.map((door) => (
            <Link key={door.number} className="sg" href={`${base}/garden/jibril/${door.number}`} title={`Door ${door.number}: ${capitalAfterColon(door.title)}`} data-testid="seat-group" data-door={door.number}>
              <span className="dots">{seatsOf(g, door).map((seat) => <i key={seat.id} className={read.has(seat.id) ? 'lit' : ''} data-testid="seat-dot" />)}</span>
              <small>{doorCode(door.number)} · {capitalAfterColon(door.title)}</small>
            </Link>
          ))}
        </div>
        <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Read most recently</p>
        {recent.length ? recent.map((seat) => (
          <div className="card" key={seat.id}><p>{str(seat.text)}</p></div>
        )) : <div className="card"><p>Open any door and mark a seat once you have read it. It will light up here.</p></div>}
      </div>
    </Frame>
  )
}

export async function GardenWorkbook({ payload, user, portal, base, query }: Ctx) {
  const session = await getSession()
  const reader = session.actor || user
  const [book, unread, listed] = await Promise.all([workbookFor(payload, user, reader), unreadCount(payload, user), listGatherings(payload, portal.id, user.id)])
  const owner = reader.id === user.id
  const filter = query.filter || 'all'
  const answers = book.answers.filter((row) => (filter === 'shared' ? row.shared : filter === 'private' ? !row.shared : filter === 'replied' ? Boolean(row.reply) : true))
  const here = `${base}/garden/workbook${filter !== 'all' ? `?filter=${filter}` : ''}`
  const talkTitles = new Set(book.answers.map((row) => row.video?.title).filter(Boolean))
  const groups = new Map<string, { course: string; topics: Map<string, Map<string, typeof answers>> }>()
  for (const row of answers) {
    const courseKey = learnerWords(tidyTalkTitle(row.course?.title || '')) || 'Other talks'
    if (!groups.has(courseKey)) groups.set(courseKey, { course: courseKey, topics: new Map() })
    const topics = groups.get(courseKey)!.topics
    const topic = learnerWords(tidyTalkTitle(row.topic || '')) || 'The talk'
    if (!topics.has(topic)) topics.set(topic, new Map())
    const videos = topics.get(topic)!
    const video = learnerWords(tidyTalkTitle(row.video?.title || '')) || 'The talk'
    if (!videos.has(video)) videos.set(video, [])
    videos.get(video)!.push(row)
  }
  return (
    <Frame base={base} title="Workbook" testId="garden-workbook" unread={unread} evening portal={portal}>
      <div className="workbook-page">
      <Flash error={query.error} notice={query.notice} />
      <p className="lead" data-testid="workbook-summary">
        {book.answers.length
          ? `You've answered ${book.answers.length} question${book.answers.length === 1 ? '' : 's'} from ${talkTitles.size || 1} talk${talkTitles.size === 1 ? '' : 's'}.`
          : 'Your answers will appear here, shared or private. Answer a question in any talk to start.'}
      </p>
      <Link className="pill outline small" href={`${base}/garden/harvest`} data-testid="workbook-harvest">Your harvest ›</Link>
      {book.opening.length ? (
        <section className="wb-start" data-testid="where-you-started">
          <p className="eyebrow">Where you started</p>
          {book.opening.map((row) => (
            <div className="wb-start-row" key={row.sceneKey} data-testid="opening-row" data-scene={row.sceneKey} data-state={row.state} data-private={row.private ? 'yes' : 'no'}>
              <span className="q">{row.caption}</span>
              <b>{row.label}</b>
              {row.private ? <small className="lock" data-testid="private-lock"><LockIcon size={14} /> Only you can see this</small> : null}
            </div>
          ))}
        </section>
      ) : null}
      <div className="chip-row">
        {['all', 'shared', 'private', 'replied'].map((key) => (
          <Link key={key} className={filter === key ? 'on' : ''} href={`${base}/garden/workbook${key === 'all' ? '' : `?filter=${key}`}`}>{key[0].toUpperCase() + key.slice(1)}</Link>
        ))}
      </div>
      <div data-testid="workbook">
        {[...groups.values()].map((group) => (
          <section className="wb-course" key={group.course} data-testid="workbook-course">
            <h2>{tidyTalkTitle(group.course)}</h2>
            {[...group.topics.entries()].map(([topic, videos]) => (
              <div className="wb-topic" key={topic} data-testid="workbook-topic">
                <h3>{topic}</h3>
                {[...videos.entries()].map(([video, rowsHere]) => (
                  <div className="wb-video" key={video} data-testid="workbook-video">
                    <p className="wb-video-title">{tidyTalkTitle(video)}</p>
                    {rowsHere.map((row) => (
                      <article className="wb-entry" key={row.id} data-testid="workbook-entry" data-consent={row.shared ? 'yes' : 'no'} data-point={row.pointId} data-kind={row.kind || 'question'}>
                        <div className="when">{shortDate(row.answeredAt)}</div>
                        <p className="asked">Video question was:</p>
                        <p className="q">{row.question}</p>
                        <blockquote data-testid="workbook-answer">{row.answer}</blockquote>
                        {row.imageId ? <img data-testid="workbook-media" src={`/api/hearts/file/${row.imageId}`} alt="" style={{ maxWidth: '100%', borderRadius: 8, marginTop: 8 }} /> : null}
                        {row.audioId ? <audio data-testid="workbook-media" controls src={`/api/hearts/file/${row.audioId}`} style={{ width: '100%', marginTop: 8 }} /> : null}
                        {row.videoId ? <video data-testid="workbook-media" controls src={`/api/hearts/file/${row.videoId}`} style={{ width: '100%', marginTop: 8, borderRadius: 8 }} /> : null}
                        {row.video && row.course ? (
                          <Link className="from-lesson" href={`${base}/course/${row.course.id}?part=${row.video.id}&t=${Math.max(0, Number(row.atSecond || 0) - 5)}`}>
                            <span>Back to the moment</span>
                          </Link>
                        ) : null}
                        {owner && row.entryId ? (
                          <form action="/api/hearts" method="post" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <Hidden fields={{ action: 'workbook-consent', entry: row.entryId, consent: row.shared ? 'no' : 'yes', next: here }} />
                            <span className={row.shared ? 'consent-chip' : 'consent-chip quiet'} data-testid="consent-state">{row.shared ? 'Shared with your teacher' : 'Kept private'}</span>
                            <button className="mini-btn" type="submit" data-testid="consent-toggle">{row.shared ? 'Make private' : 'Share with my teacher'}</button>
                          </form>
                        ) : null}
                        {row.reply && featureOn(portal, 'feedback') ? (
                          <div className="reply" data-testid="teacher-reply">
                            <b>Your teacher replied</b>{row.reply}
                            {row.entryId ? <ReportButton targetType="teacher-reply" targetId={row.entryId} next={here} /> : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </section>
        ))}
        {!answers.length ? (
          <EmptyState
            testId="workbook-empty"
            action={filter === 'all' ? { href: `${base}/lanes`, label: 'Open a course' } : { href: `${base}/garden/workbook`, label: 'Show every answer' }}
          >
            {filter === 'all' ? 'Your answers will appear here, shared or private. Answer a question in any talk to start.' : 'Nothing here with this filter.'}
          </EmptyState>
        ) : null}
      </div>
      {book.open.length ? (
        <section data-testid="open-questions">
          <p className="eyebrow">Still open</p>
          {book.open.map((row) => (
            <div className="wb-open" key={row.pointId} data-testid="open-question" data-point={row.pointId} data-kind={row.kind || 'question'}>
              <span>{row.question}</span>
              <small>{row.video}</small>
              {row.courseId && row.lessonId ? (
                <Link className="from-lesson" href={`${base}/course/${row.courseId}?part=${row.lessonId}&t=${Math.max(0, row.second)}`} data-testid="answer-in-talk">
                  Answer in the talk ›
                </Link>
              ) : null}
              {row.kind === 'task' || row.family === 'workbook' ? (
                <form action="/api/answers" method="post" encType="multipart/form-data" data-testid="workbook-task" style={{ marginTop: 8 }}>
                  <input type="hidden" name="pointId" value={row.pointId} />
                  <input type="hidden" name="next" value={here} />
                  {row.kind === 'task' && row.dueDays ? <p data-testid="task-due">Due within {row.dueDays} days of opening this talk.</p> : null}
                  {row.evidence === 'photo' ? null : <textarea name="body" rows={2} required={row.evidence === 'note' || row.family === 'workbook'} placeholder={row.kind === 'task' ? 'What did you do?' : 'Your reflection'} data-testid="workbook-task-note" />}
                  {row.kind === 'task' ? <FilePick name="image" accept="image/*" required={row.evidence === 'photo'} testId="workbook-task-file" /> : null}
                  {row.kind === 'task' && featureOn(portal, 'gather') && taskWantsCompany(row.question) ? listed.cards.filter((card) => !card.past && card.lessonId === row.lessonId).map((card) => (
                    <p key={card.id} data-testid="workbook-gather"><a href={`${base}/gather/${card.id}`}>{card.title}</a> · {card.when}</p>
                  )) : null}
                  {row.showImam || row.kind === 'task' ? <input type="hidden" name="shareWithTeacher" value="on" /> : null}
                  <button className="mini-btn" type="submit" data-testid="workbook-task-done">{row.kind === 'task' ? 'I have done this' : 'Save in my workbook'}</button>
                </form>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      </div>
    </Frame>
  )
}
