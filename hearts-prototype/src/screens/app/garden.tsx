import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { Mascot } from '@/components/brand'
import { Flower, GardenTree } from '@/components/icons'
import { now } from '@/lib/clock'
import { type SessionUser, visibleCourseIds } from '@/server/context'
import { posterFor } from '@/server/learner'
import { type Ctx, type Row, clock, ref, rows, shortDate, str, unreadCount } from '../common'

const SECTIONS: { key: string; title: string; colour: string }[] = [
  { key: 'Sitting', title: 'The sitting', colour: '#e98fb0' },
  { key: 'Islam', title: 'Islam', colour: '#f0b44c' },
  { key: 'Iman', title: 'Iman', colour: '#7fc4a8' },
  { key: 'Ihsan', title: 'Ihsan', colour: '#a98bd6' },
  { key: 'Hour', title: 'The Hour', colour: '#ef8a5a' },
  { key: 'Trunk', title: 'He came to teach you your religion', colour: '#6fa8dc' },
]

type Growth = {
  clauses: Row[]
  seats: Row[]
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
}

async function growth(payload: Payload, user: SessionUser): Promise<Growth> {
  const mine = { user: { equals: user.id } }
  const [clauses, seats, completions, seatVisits, harvest, workbook, answers, rituals, visits, tags] = await Promise.all([
    rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }),
    rows(payload, 'seats', undefined, { sort: 'position', limit: 400 }),
    rows(payload, 'completions', mine),
    rows(payload, 'seat-visits', mine),
    rows(payload, 'harvest-entries', mine, { sort: '-createdAt' }),
    rows(payload, 'workbook-entries', mine, { sort: '-createdAt' }),
    rows(payload, 'answers', mine),
    rows(payload, 'rituals', mine, { sort: '-createdAt' }),
    rows(payload, 'lesson-visits', mine),
    rows(payload, 'tags', { state: { equals: 'confirmed' } }, { limit: 1000 }),
  ])
  const lessonIds = [...new Set([...completions, ...visits].map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await rows(payload, 'lessons', { id: { in: lessonIds } }) : []
  const done = new Set(completions.map((row) => ref(row.lesson)))
  const cutIds = tags.map((tag) => ref((tag.item as { value?: unknown } | undefined)?.value)).filter((id): id is number => Boolean(id))
  const cuts = cutIds.length ? await rows(payload, 'cuts', { id: { in: cutIds } }, { limit: 1000 }) : []
  const lit = new Set<number>()
  for (const tag of tags) {
    const cut = cuts.find((row) => row.id === ref((tag.item as { value?: unknown } | undefined)?.value))
    if (!cut || !done.has(ref(cut.lesson))) continue
    const clause = clauses.find((row) => row.id === ref(tag.clause))
    if (clause) lit.add(Number(clause.number))
  }
  const activeDays = new Set([...completions, ...answers, ...visits, ...rituals, ...seatVisits].map((row) => str(row.createdAt).slice(0, 10)).filter(Boolean))
  const secondsGiven = completions.reduce((sum, row) => {
    const lesson = lessons.find((item) => item.id === ref(row.lesson))
    return sum + (Number(lesson?.durationSeconds || 0) * Number(row.percent || 100)) / 100
  }, 0)
  return { clauses, seats, lit, completions, lessons, seatVisits, harvest, workbook, answers, rituals, activeDays, secondsGiven }
}

function sectionOf(clauses: Row[], key: string) {
  return clauses.filter((clause) => str(clause.core) === key)
}

function Rings({ g, base }: { g: Growth; base: string }) {
  const sections = SECTIONS.filter((section) => sectionOf(g.clauses, section.key).some((clause) => g.lit.has(Number(clause.number)))).length
  const items: [string, number, string, string][] = [
    ['Watched', g.completions.length, '#f0b44c', `${base}/garden/general`],
    ['Sections', sections, '#e98fb0', `${base}/garden/jibril`],
    ['Field', g.seatVisits.length, '#7fc4a8', `${base}/garden/ghunya`],
    ['Harvest', g.harvest.length, '#6fa8dc', `${base}/garden/harvest`],
    ['Workbook', g.workbook.length, '#a98bd6', `${base}/garden/workbook`],
  ]
  return (
    <div className="rings" data-testid="rings">
      {items.map(([label, value, colour, href]) => (
        <Link key={label} className="ring-stat" href={href} data-testid={`ring-${label.toLowerCase()}`}>
          <span className="r" style={{ borderColor: colour }}>{value}</span>
          {label}
        </Link>
      ))}
    </div>
  )
}

export async function GardenScreen({ payload, user, base, query }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const starting = user.startingClause ? g.clauses.find((clause) => Number(clause.number) === Number(user.startingClause)) : null
  const tiles: [string, string, string, string, string][] = [
    ['general', 'General', 'Time given, days you came and what you returned to', '#25214a', 'G'],
    ['jibril', 'Against Hadith Jibril', `${g.lit.size} of 41 clauses have a talk you finished`, '#8f2f2a', 'J'],
    ['ghunya', 'Against al-Ghuniyya', `${g.seatVisits.length} of ${g.seats.length} seats read`, '#1f8a78', 'G'],
    ['harvest', 'Harvest', `${g.harvest.length} verses and hadith gathered from your talks`, '#dca643', 'H'],
    ['workbook', 'Workbook', `${g.workbook.length} answers kept`, '#7a4fa8', 'W'],
  ]
  return (
    <AppFrame testId="garden">
      <div className="app-scroll">
        <div className="app-head"><h1>Garden</h1></div>
        <Flash error={query.error} notice={query.notice} />
        <section className="grow-banner" data-testid="grow-banner">
          <p className="eyebrow">Your growth</p>
          <h2 data-testid="days-count">{g.activeDays.size} day{g.activeDays.size === 1 ? '' : 's'} in the garden</h2>
          <span className="tree-art"><GardenTree done={Math.min(12, g.completions.length + g.answers.length)} total={12} width={120} /></span>
          <Rings g={g} base={base} />
          <Link className="pill gold block" href={`${base}/garden/general`} data-testid="see-sown">See what you&apos;ve sown</Link>
        </section>
        <p className="eyebrow">Look closer</p>
        {tiles.map(([key, title, sub, colour, letter]) => (
          <Link key={key} className="grow-tile" href={`${base}/garden/${key}`} data-testid={`tile-${key}`}>
            <span className="sw" style={{ background: colour }}>{letter}</span>
            <span><b>{title}</b><small>{sub}</small></span>
          </Link>
        ))}
        {starting ? (
          <>
            <p className="eyebrow">Where you began</p>
            <Link className="card" href={`${base}/garden/jibril/${starting.number}`} style={{ display: 'block', textDecoration: 'none' }} data-testid="starting-clause">
              <h3>Clause {str(starting.number)}: {str(starting.fragment)}</h3>
              <p>Your answers when you joined pointed here. Your first course was chosen from the talks that sit on this line.</p>
            </Link>
          </>
        ) : null}
        <p className="eyebrow">A small act</p>
        <section className="card">
          <p style={{ marginBottom: 10 }}>Something you did today because of what you heard. Only you see this.</p>
          <form className="form-stack" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'ritual', next: `${base}/garden` }} />
            <input className="field" data-testid="ritual-note" name="note" maxLength={280} placeholder="I held back a harsh word." />
            <button className="pill teal" type="submit" data-testid="ritual-submit">Keep this</button>
          </form>
          <p className="muted" style={{ fontSize: 13, marginTop: 10 }} data-testid="ritual-count">{g.rituals.length} small act{g.rituals.length === 1 ? '' : 's'} kept so far.</p>
        </section>
      </div>
      <TabBar base={base} active="garden" unread={unread} />
    </AppFrame>
  )
}

function Frame({ base, title, testId, children, unread, dark }: { base: string; title: string; testId: string; children: React.ReactNode; unread: number; dark?: boolean }) {
  return (
    <AppFrame testId={testId} dark={dark}>
      <div className="app-scroll">
        {dark ? children : (
          <>
            <Back href={`${base}/garden`} label="Garden" />
            <div className="app-head"><h1>{title}</h1></div>
            {children}
          </>
        )}
      </div>
      <TabBar base={base} active="garden" unread={unread} dark={dark} />
    </AppFrame>
  )
}

export async function GardenGeneral({ payload, user, base }: Ctx) {
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
      return { title: str(course.title), count }
    })
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
  const top = Math.max(1, ...returns.map((row) => row.count))
  return (
    <Frame base={base} title="General" testId="garden-general" unread={unread}>
      <section className="time-card">
        <p className="eyebrow">Time given</p>
        <div className="big" data-testid="time-given">{hours ? `${hours}h ` : ''}{minutes}m</div>
        <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>Counted from the parts you marked as watched.</p>
      </section>
      <div className="stat-grid">
        <div className="stat-box"><b data-testid="stat-sittings">{g.completions.length}</b><small>parts watched</small></div>
        <div className="stat-box"><b>{g.answers.length}</b><small>questions answered</small></div>
        <div className="stat-box"><b>{g.seatVisits.length}</b><small>seats read</small></div>
        <div className="stat-box"><b>{g.harvest.length}</b><small>verses and hadith</small></div>
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

export async function GardenJibril({ payload, user, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  return (
    <Frame base={base} title="Against Hadith Jibril" testId="garden-jibril" unread={unread}>
      <section className="summary-card gold">
        <h2 data-testid="lit-count">{g.lit.size} of 41 clauses</h2>
        <p>A clause flowers when you finish a talk that a teacher has placed on it. Tap any clause to read it.</p>
      </section>
      <div data-testid="clause-map">
        {SECTIONS.map((section) => {
          const clauses = sectionOf(g.clauses, section.key)
          const litHere = clauses.filter((clause) => g.lit.has(Number(clause.number))).length
          return (
            <div className="section-row" key={section.key} data-testid="section-row">
              <header><span>{section.title}</span><small>{litHere} of {clauses.length}</small></header>
              <div className="flowers">
                {clauses.map((clause) => {
                  const n = Number(clause.number)
                  const on = g.lit.has(n)
                  const start = Number(user.startingClause) === n
                  return (
                    <Link key={clause.id} href={`${base}/garden/jibril/${n}`} title={`${n}. ${str(clause.fragment)}`} data-testid="clause-cell" data-lit={on ? 'yes' : 'no'} data-start={start ? 'yes' : 'no'}>
                      {on ? <Flower colour={section.colour} /> : <span className="empty-dot" style={start ? { borderColor: 'var(--gold)', borderWidth: 3 } : undefined} />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>A gold ring marks the clause your answers pointed to when you joined.</p>
    </Frame>
  )
}

export async function GardenClause({ payload, user, base, query }: Ctx, number: number) {
  if (!Number.isInteger(number) || number < 1 || number > 41) notFound()
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const clause = g.clauses.find((row) => Number(row.number) === number)
  if (!clause) notFound()
  const seats = g.seats.filter((seat) => ref(seat.clause) === clause.id).sort((a, b) => Number(a.position) - Number(b.position))
  const read = new Set(g.seatVisits.map((visit) => ref(visit.seat)))
  const cuts = await rows(payload, 'cuts', { and: [{ bestClause: { equals: number } }, { status: { equals: 'approved' } }] }, { limit: 20 })
  const visible = new Set(await visibleCourseIds(payload, user))
  const lessonIds = [...new Set(cuts.map((cut) => ref(cut.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? (await rows(payload, 'lessons', { id: { in: lessonIds } })).filter((lesson) => visible.has(ref(lesson.course) || 0)) : []
  const here = `${base}/garden/jibril/${number}`
  return (
    <Frame base={base} title={`Clause ${number}`} testId="garden-clause" unread={unread}>
      <Flash error={query.error} notice={query.notice} />
      <article className="clause-card" data-testid="clause-card">
        <div className="clause-num">{number}</div>
        <h3 data-testid="clause-fragment">{str(clause.fragment)}</h3>
        {clause.teaching ? <p><span className="lbl">Teaching.</span> {str(clause.teaching)}</p> : null}
        <p className="lbl" style={{ margin: '14px 0 4px' }}>Three seats.</p>
        {seats.map((seat, index) => (
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
        ))}
        {clause.series ? <p style={{ marginTop: 14 }}><span className="lbl">From the series.</span> {str(clause.series)}</p> : null}
      </article>
      <p className="eyebrow">Talks on this clause</p>
      {lessons.length ? lessons.map((lesson) => {
        const cut = cuts.find((row) => ref(row.lesson) === lesson.id)
        return (
          <Link key={lesson.id} className="course-row" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.floor(Number(cut?.start || 0))}`} data-testid="clause-talk">
            <span className="thumb" style={posterFor(str(lesson.youtubeId) || null) ? { backgroundImage: `url(${posterFor(str(lesson.youtubeId))})` } : undefined} />
            <span className="t"><b>{str(lesson.title)}</b><small>From {clock(Number(cut?.start || 0))} · {str(lesson.speaker)}</small></span>
            <span className="start teal">Watch</span>
          </Link>
        )
      }) : <p className="muted">No talk in your courses has been placed on this clause yet.</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        {number > 1 ? <Link className="pill outline small" href={`${base}/garden/jibril/${number - 1}`}>‹ Clause {number - 1}</Link> : <span />}
        {number < 41 ? <Link className="pill outline small" href={`${base}/garden/jibril/${number + 1}`} data-testid="next-clause">Clause {number + 1} ›</Link> : null}
      </div>
    </Frame>
  )
}

export async function GardenGhunya({ payload, user, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const read = new Set(g.seatVisits.map((visit) => ref(visit.seat)))
  const recent = g.seatVisits
    .slice()
    .sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)))
    .slice(0, 4)
    .map((visit) => g.seats.find((seat) => seat.id === ref(visit.seat)))
    .filter((seat): seat is Row => Boolean(seat))
  return (
    <Frame base={base} title="Against al-Ghuniyya" testId="garden-ghunya" unread={unread} dark>
      <div className="forest">
        <Back href={`${base}/garden`} label="Garden" />
        <p className="eyebrow" style={{ color: 'var(--gold)', marginTop: 10 }}>Against al-Ghuniyya</p>
        <h1 style={{ margin: 0, fontSize: 26 }}>The seats you have read</h1>
        <p className="big" data-testid="seat-count">{read.size} <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>of {g.seats.length}</span></p>
        <p style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, margin: '6px 0 0', fontSize: 14 }}>Each clause of the hadith opens onto three seats from al-Ghuniyya. One group of dots per clause.</p>
        <div className="seat-groups" data-testid="seat-grid">
          {g.clauses.map((clause) => {
            const seats = g.seats.filter((seat) => ref(seat.clause) === clause.id).sort((a, b) => Number(a.position) - Number(b.position))
            return (
              <Link key={clause.id} className="sg" href={`${base}/garden/jibril/${clause.number}`} title={`${clause.number}. ${str(clause.fragment)}`} data-testid="seat-group">
                <span className="dots">{seats.map((seat) => <i key={seat.id} className={read.has(seat.id) ? 'lit' : ''} data-testid="seat-dot" />)}</span>
                <small>{str(clause.number)}</small>
              </Link>
            )
          })}
        </div>
        <p className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>Read most recently</p>
        {recent.length ? recent.map((seat) => (
          <div className="card" key={seat.id}><p>{str(seat.text)}</p></div>
        )) : <div className="card"><p>Open any clause and mark a seat once you have read it. It will light up here.</p></div>}
      </div>
    </Frame>
  )
}

export async function GardenHarvest({ payload, user, base }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const lessonIds = [...new Set(g.harvest.map((row) => ref(row.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await rows(payload, 'lessons', { id: { in: lessonIds } }) : []
  return (
    <Frame base={base} title="Harvest" testId="garden-harvest" unread={unread}>
      <p className="lead">Verses and hadith quoted in the talks you finished, gathered for you.</p>
      <div data-testid="harvest">
        {g.harvest.length ? g.harvest.map((hit) => {
          const lesson = lessons.find((row) => row.id === ref(hit.lesson))
          const quran = str(hit.kind) === 'quran'
          return (
            <article className="harvest-card" key={hit.id} data-testid="harvest-item">
              <header><span className={`tag ${quran ? 'quran' : 'hadith'}`}>{quran ? "Qur'an" : 'Hadith'}</span><small>{str(hit.reference)}</small></header>
              <blockquote>{str(hit.text)}</blockquote>
              <small>{lesson ? `${str(lesson.title)}${hit.timestamp ? ` · at ${str(hit.timestamp)}` : ''}` : str(hit.timestamp)}</small>
            </article>
          )
        }) : (
          <div className="empty-state" data-testid="harvest-empty">
            <Mascot width={110} />
            <p>Nothing gathered yet. When you finish a talk, the verses and hadith it quotes are collected here.</p>
          </div>
        )}
      </div>
    </Frame>
  )
}

export async function GardenWorkbook({ payload, user, base, query }: Ctx) {
  const [g, unread] = await Promise.all([growth(payload, user), unreadCount(payload, user)])
  const filter = query.filter || 'all'
  const entries = g.workbook.filter((entry) => (filter === 'shared' ? entry.consent : filter === 'private' ? !entry.consent : filter === 'replied' ? Boolean(entry.teacherReply) : true))
  const answerIds = entries.map((entry) => ref(entry.answer)).filter((id): id is number => Boolean(id))
  const answers = answerIds.length ? await rows(payload, 'answers', { id: { in: answerIds } }, { depth: 1 }) : []
  const lessonIds = [...new Set(entries.map((entry) => ref(entry.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await rows(payload, 'lessons', { id: { in: lessonIds } }) : []
  const here = `${base}/garden/workbook${filter !== 'all' ? `?filter=${filter}` : ''}`
  return (
    <Frame base={base} title="Workbook" testId="garden-workbook" unread={unread}>
      <Flash error={query.error} notice={query.notice} />
      <div className="chip-row">
        {['all', 'shared', 'private', 'replied'].map((key) => (
          <Link key={key} className={filter === key ? 'on' : ''} href={`${base}/garden/workbook${key === 'all' ? '' : `?filter=${key}`}`}>{key[0].toUpperCase() + key.slice(1)}</Link>
        ))}
      </div>
      <div data-testid="workbook">
        {entries.length ? entries.map((entry) => {
          const answer = answers.find((row) => row.id === ref(entry.answer))
          const point = answer?.point as { prompt?: string; second?: number } | undefined
          const lesson = lessons.find((row) => row.id === ref(entry.lesson))
          return (
            <article className="wb-entry" key={entry.id} data-testid="workbook-entry" data-consent={entry.consent ? 'yes' : 'no'}>
              <div className="when">{shortDate(entry.createdAt)}</div>
              {point?.prompt ? <><p className="asked">Video question was:</p><p className="q">{point.prompt}</p></> : null}
              <blockquote>{str(entry.body) || 'A photo or voice note'}</blockquote>
              {lesson ? (
                <Link className="from-lesson" href={`${base}/course/${ref(lesson.course)}?part=${lesson.id}&t=${Math.max(0, Number(point?.second || 0) - 5)}`}>
                  <span className="thumb" style={posterFor(str(lesson.youtubeId) || null) ? { backgroundImage: `url(${posterFor(str(lesson.youtubeId))})` } : undefined} />
                  <span>{str(lesson.title)}<small>Back to the moment</small></span>
                </Link>
              ) : null}
              <form action="/api/hearts" method="post" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Hidden fields={{ action: 'workbook-consent', entry: entry.id, consent: entry.consent ? 'no' : 'yes', next: here }} />
                <span className="consent-chip" style={entry.consent ? undefined : { background: '#efebe3', color: 'var(--ink-2)' }} data-testid="consent-state">{entry.consent ? 'Shared with your teacher' : 'Kept private'}</span>
                <button className="mini-btn" type="submit" data-testid="consent-toggle">{entry.consent ? 'Make private' : 'Share with my teacher'}</button>
              </form>
              {entry.teacherReply ? <div className="reply" data-testid="teacher-reply"><b>Your teacher replied</b>{str(entry.teacherReply)}</div> : null}
            </article>
          )
        }) : (
          <div className="empty-state" data-testid="workbook-empty">
            <Mascot width={110} />
            <p>{filter === 'all' ? 'Your answers to the questions in each film are kept here, whether you share them or not.' : 'Nothing here with this filter.'}</p>
          </div>
        )}
      </div>
    </Frame>
  )
}
