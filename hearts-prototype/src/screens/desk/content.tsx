import Link from 'next/link'
import { loadDoors } from '@/server/doors'
import { doorCode, doorLabel, doorOfClause } from '@/lib/doors'
import { notFound, redirect } from 'next/navigation'
import type { Payload } from 'payload'
import { Hidden } from '@/components/app/shell'
import { CodeLimits, CodeStatus } from '@/components/desk/codes'
import { PointPicker } from '@/components/desk/tools'
import { Qr } from '@/components/qr'
import { adoptedCourseIds, type PortalDoc, type SessionUser } from '@/server/context'
import { type Ctx, type Row, clock, one, portalPeople, ref, rows, str } from '../common'
import { AdminFrame } from './overview'

export function guardAdmin(ctx: Ctx) {
  if (ctx.user.role === 'teacher') redirect(`${ctx.base}/admin?error=${encodeURIComponent('That page is for the portal admin. Ask them if you need something changed.')}`)
}

export async function ContentScreen(ctx: Ctx) {
  guardAdmin(ctx)
  const { payload, portal, base } = ctx
  const local = await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] }, { sort: 'title' })
  const adoptedIds = await adoptedCourseIds(payload, portal.id)
  const linked = adoptedIds.length ? await rows(payload, 'courses', { id: { in: adoptedIds } }, { sort: 'title' }) : []
  const all = [...local, ...linked]
  const ids = all.map((course) => course.id)
  const [units, lessons, packs] = await Promise.all([
    ids.length ? rows(payload, 'units', { course: { in: ids } }) : Promise.resolve([]),
    ids.length ? rows(payload, 'lessons', { course: { in: ids } }) : Promise.resolve([]),
    rows(payload, 'packs', { portal: { equals: portal.id } }),
  ])
  const lessonIds = lessons.map((lesson) => lesson.id)
  const [points, cuts] = await Promise.all([
    lessonIds.length ? rows(payload, 'engagement-points', { lesson: { in: lessonIds } }, { limit: 2000 }) : Promise.resolve([]),
    lessonIds.length ? rows(payload, 'cuts', { lesson: { in: lessonIds } }, { limit: 2000 }) : Promise.resolve([]),
  ])
  const localIds = new Set(local.map((course) => course.id))
  const localLessons = lessons.filter((lesson) => localIds.has(ref(lesson.course) || 0))
  const stat = (n: number, label: string) => <div className="stat-chip"><b>{n}</b><span>{label}</span></div>
  return (
    <AdminFrame ctx={ctx} active="content" title="Content" intro="Build courses here: a subject, its topics, the films in each topic, and the questions that pause the film." testId="admin-content">
      <div className="stats-strip">
        {stat(local.length, 'Subjects made here')}
        {stat(units.filter((unit) => localIds.has(ref(unit.course) || 0)).length, 'Topics')}
        {stat(localLessons.length, 'Films')}
        {stat(points.filter((point) => localLessons.some((lesson) => lesson.id === ref(point.lesson))).length, 'Questions')}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <header className="light"><h2>Courses in this portal</h2><Link className="btn ghost small" href={`${base}/admin/library`}>Link from the library</Link></header>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Subject</th><th>Speaker</th><th>From</th><th className="num">Films</th><th className="num">Questions</th><th className="num">Cuts live</th><th /></tr></thead>
              <tbody>
                {all.map((course) => {
                  const own = lessons.filter((lesson) => ref(lesson.course) === course.id)
                  const ownIds = new Set(own.map((lesson) => lesson.id))
                  const isLocal = localIds.has(course.id)
                  return (
                    <tr key={course.id} data-testid="course-row" data-origin={isLocal ? 'local' : 'imported'}>
                      <td><Link href={`${base}/admin/content/${course.id}`} style={{ fontWeight: 700 }}>{str(course.title)}</Link></td>
                      <td>{str(course.speaker) || <span className="hint">Not set</span>}</td>
                      <td>{isLocal ? <span className="badge teal">Made here</span> : <span className="badge gold">Library, read only</span>}</td>
                      <td className="num">{own.length}</td>
                      <td className="num">{points.filter((point) => ownIds.has(ref(point.lesson) || 0)).length}</td>
                      <td className="num">{cuts.filter((cut) => ownIds.has(ref(cut.lesson) || 0) && cut.status === 'approved').length}</td>
                      <td><Link className="btn ghost small" href={`${base}/admin/content/${course.id}`}>{isLocal ? 'Edit' : 'View'}</Link></td>
                    </tr>
                  )
                })}
                {!all.length ? <tr><td colSpan={7} className="empty">No courses yet. Start one on the right, or link one from the library.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <header><div><h2>New subject</h2><p>Subject, then topic, then film. Questions are added in the editor.</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-course', origin: 'local', portalSlug: portal.slug, next: `${base}/admin/content` }} />
            <label className="stack">Subject name<input type="text" data-testid="local-course-title" name="title" required /></label>
            <label className="stack">First topic<input type="text" name="unit" placeholder="Topic 1" /></label>
            <label className="stack">First film<input type="text" name="lesson" placeholder="Same as the subject if left empty" /></label>
            <div className="cols">
              <label className="stack">Length in seconds<input type="number" data-testid="local-course-duration" name="duration" defaultValue={8} min={0} /></label>
              <label className="stack">Speaker<input type="text" name="speaker" /></label>
            </div>
            <label className="stack">Add it to a course pack
              <select data-testid="local-course-pack" name="pack">
                <option value="">Not yet</option>
                {packs.map((pack) => <option key={pack.id} value={pack.id}>{str(pack.title)}</option>)}
              </select>
            </label>
            <div className="actions"><button className="btn ink" data-testid="local-course-submit" type="submit">Save subject</button></div>
          </form>
        </section>
      </div>
    </AdminFrame>
  )
}

export async function canOpenCourse(payload: Payload, user: SessionUser, portal: PortalDoc | null, course: Row) {
  if (user.role === 'master') return { ok: true, locked: false }
  if (!portal) return { ok: false, locked: true }
  const localHere = course.origin === 'local' && ref(course.portal) === portal.id
  const linked = course.origin === 'master' && (await adoptedCourseIds(payload, portal.id)).includes(course.id)
  return { ok: localHere || linked, locked: !localHere }
}

export async function CourseEditorBody({ payload, user, portal, editorHref, courseId, part }: { payload: Payload; user: SessionUser; portal: PortalDoc | null; editorHref: string; courseId: number; part?: string }) {
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const access = await canOpenCourse(payload, user, portal, course)
  if (!access.ok) return null
  const locked = access.locked
  const [units, lessons] = await Promise.all([
    rows(payload, 'units', { course: { equals: courseId } }, { sort: 'order' }),
    rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order' }),
  ])
  const lesson = lessons.find((row) => row.id === Number(part)) || lessons[0]
  const here = `${editorHref}${lesson ? `?part=${lesson.id}` : ''}`
  const [cuts, ladder, points, clauses, seats, people, doors] = await Promise.all([
    lesson ? rows(payload, 'cuts', { lesson: { equals: lesson.id } }, { sort: 'start' }) : Promise.resolve([]),
    lesson ? rows(payload, 'ladder-items', { lesson: { equals: lesson.id } }, { sort: 'start' }) : Promise.resolve([]),
    lesson ? rows(payload, 'engagement-points', { lesson: { equals: lesson.id } }, { sort: 'second', depth: 1 }) : Promise.resolve([]),
    rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }),
    rows(payload, 'seats', undefined, { sort: 'position', limit: 400 }),
    portal ? portalPeople(payload, portal.id) : Promise.resolve([]),
    loadDoors(payload),
  ])
  const visiblePoints = points.filter((point) => {
    const author = point.author as { role?: string; tenants?: { tenant?: unknown }[] } | null
    if (user.role === 'master' || !author || author.role === 'master') return true
    return (author.tenants || []).some((row) => ref(row.tenant) === portal?.id)
  })
  const learners = people.filter((person) => person.role === 'learner')
  const youtubeId = lesson ? str(lesson.youtubeId) || null : null
  const length = Number(lesson?.durationSeconds || 0) || Math.max(60, ...visiblePoints.map((point) => Number(point.second) + 30))
  const lessonsByUnit = (units.length ? units : [{ id: 0, title: 'Topic 1' } as Row]).map((unit) => ({ unit, items: lessons.filter((row) => (units.length ? ref(row.unit) === unit.id : true)) }))

  return (
    <div data-testid="course-detail" data-locked={locked ? 'yes' : 'no'}>
      {locked ? <div className="flash notice" data-testid="readonly">This course comes from the library, so it is read only here. You can add your own questions on top; the original stays as it is for every portal.</div> : null}
      <div className="builder">
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel">
            <header><div><h2>{str(course.title)}</h2><p>{str(course.speaker) || 'No speaker set'}</p></div></header>
            <nav className="tree" aria-label="Topics and films">
              {lessonsByUnit.map(({ unit, items }) => (
                <div key={unit.id}>
                  <div className="unit">{str(unit.title)}</div>
                  {items.map((row) => (
                    <Link key={row.id} href={`${editorHref}?part=${row.id}`} className={row.id === lesson?.id ? 'on' : ''} data-testid="tree-lesson">
                      ▶ {str(row.title)}<small>{row.durationSeconds ? clock(Number(row.durationSeconds)) : ''}</small>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            {!locked ? (
              <form className="body form" action="/api/hearts" method="post" style={{ borderTop: '1px solid var(--line)' }}>
                <Hidden fields={{ action: 'add-lesson', course: courseId, next: editorHref }} />
                <label className="stack">Add a film<input type="text" name="title" placeholder="Part 2" required /></label>
                <div className="actions"><button className="btn ghost small" type="submit">Add film</button></div>
              </form>
            ) : null}
          </section>
          {!locked ? (
            <section className="panel">
              <header className="light"><h2>Subject details</h2></header>
              <form className="body form" action="/api/hearts" method="post">
                <Hidden fields={{ action: 'rename-course', course: courseId, portalSlug: portal?.slug, next: here }} />
                <label className="stack">Name<input type="text" name="title" defaultValue={str(course.title)} /></label>
                <label className="check"><input type="checkbox" name="importable" defaultChecked={Boolean(course.importable)} /> Other portals may link this course</label>
                <div className="actions"><button className="btn ghost small" type="submit">Save</button></div>
              </form>
            </section>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {lesson ? (
            <section className="panel" data-testid="lesson-row">
              <header><div><h2>Film: {str(lesson.title)}</h2><p>{youtubeId ? `YouTube ${youtubeId}` : 'No film link yet'}{lesson.durationSeconds ? ` · ${clock(Number(lesson.durationSeconds))}` : ''}</p></div></header>
              <div className="body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18 }}>
                <div>
                  {str(lesson.videoProvider) === 'vimeo' && str(lesson.vimeoId) ? <iframe className="film-preview" style={{ padding: 0 }} title={str(lesson.title)} src={`https://player.vimeo.com/video/${str(lesson.vimeoId)}`} allow="fullscreen; picture-in-picture" /> : str(lesson.videoProvider) === 'file' ? <video className="film-preview" style={{ padding: 0 }} controls src={`/api/hearts/film/${lesson.id}`} /> : youtubeId ? <iframe className="film-preview" style={{ padding: 0 }} title={str(lesson.title)} src={`https://www.youtube-nocookie.com/embed/${youtubeId}`} allow="encrypted-media" /> : <div className="film-preview">{locked ? 'This film has no YouTube link.' : 'Paste a YouTube link to attach the film.'}</div>}
                  <p className="hint" style={{ marginTop: 10 }}>
                    {lesson.transcript ? <span data-testid="has-transcript">Transcript attached. </span> : <span>No transcript yet. </span>}
                    {lesson.transcriptNote ? <span data-testid="transcript-note">{str(lesson.transcriptNote)}</span> : null}
                  </p>
                </div>
                {!locked ? (
                  <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                    <form className="form" action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'ingest', lesson: lesson.id, next: here }} />
                      <label className="stack">YouTube or share link<input type="url" data-testid="youtube-url" name="url" placeholder="https://www.youtube.com/watch?v=" required /></label>
                      <div className="actions"><button className="btn ink small" data-testid="ingest-submit" type="submit">Fetch film and transcript</button></div>
                    </form>
                    <form className="form" action="/api/hearts" method="post" encType="multipart/form-data">
                      <Hidden fields={{ action: 'upload-transcript', lesson: lesson.id, next: here }} />
                      <label className="stack">Or upload a transcript (.vtt, .srt or .txt)<input data-testid="transcript-file" type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" required /></label>
                      <div className="actions"><button className="btn ghost small" data-testid="transcript-submit" type="submit">Upload transcript</button></div>
                    </form>
                    <form action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'extract', lesson: lesson.id, next: here }} />
                      <button className="btn block" style={{ width: '100%' }} data-testid="extract-submit" type="submit">Run the extractor</button>
                      <p className="hint" style={{ marginTop: 6 }}>Finds short moments with a hook, a turn and a landing line. Quotes are word for word and timings come from the transcript. Running it again replaces the drafts.</p>
                    </form>
                  </div>
                ) : <p className="hint">The film, transcript and cuts are looked after by the master desk.</p>}
              </div>
            </section>
          ) : <section className="panel"><div className="body empty">This subject has no films yet.</div></section>}

          {lesson ? (
            <section className="panel" data-testid="cuts-panel">
              <header className="light"><h2>Cuts for review ({cuts.length})</h2><span className="hint">{cuts.filter((cut) => cut.status === 'approved').length} approved</span></header>
              <div className="body">
                {cuts.length ? cuts.map((cut) => {
                  const clause = Number(cut.bestClause || 0)
                  const clauseDoc = clauses.find((row) => Number(row.number) === clause)
                  const clauseSeats = clauseDoc ? seats.filter((seat) => ref(seat.clause) === clauseDoc.id) : []
                  const door = doorOfClause(clause, doors)
                  return (
                    <article key={cut.id} className={`cut-row ${str(cut.status)}`} data-testid="cut-draft" data-status={str(cut.status)} data-cut={cut.id}>
                      <div className="time">{clock(Number(cut.start))}<small>{Math.round(Number(cut.end) - Number(cut.start))} s long</small><small><span className={`badge ${cut.status === 'approved' ? 'teal' : cut.status === 'rejected' ? 'grey' : 'gold'}`}>{cut.status === 'approved' ? 'Approved' : cut.status === 'rejected' ? 'Set aside' : 'Draft'}</span></small></div>
                      <div className="htl">
                        <p><b>Hook</b>{str(cut.hook)}</p>
                        <p><b>Turn</b>{str(cut.turn)}</p>
                        <p className="land"><b>Land</b>{str(cut.land)}</p>
                        <div className="meta">
                          {cut.theme ? <>Theme: {str(cut.theme)}. </> : null}
                          {door ? <>Door <b data-testid="cut-door" style={{ display: 'inline', textTransform: 'none', letterSpacing: 0 }}>{doorLabel(door)}</b> <span className="hint" data-testid="cut-door-clause">(clause {clause}{cut.clauseFragment ? `: ${str(cut.clauseFragment)}` : ''})</span>. </> : null}
                          {cut.whyHang ? <>{str(cut.whyHang)} </> : null}
                          Quote check: {str(cut.quoteConfidence, 'not run')}. Made by {cut.engine === 'llm' ? 'the language model' : 'the built-in extractor'}.
                        </div>
                      </div>
                      {!locked ? (
                        <form action="/api/hearts" method="post">
                          <Hidden fields={{ action: 'cut-status', cut: cut.id, confirm: 'yes', next: here }} />
                          <label className="stack" style={{ fontSize: 12.5 }}>Door, then clause
                            <select name="clause" defaultValue={clause || ''} data-testid="cut-clause">
                              <option value="">No door</option>
                              {doors.map((row) => (
                                <optgroup key={row.number} label={doorLabel(row)}>
                                  {row.clauses.map((number) => {
                                    const doc = clauses.find((item) => Number(item.number) === number)
                                    return <option key={number} value={number}>{doorCode(row.number)} · clause {number}{doc ? `: ${str(doc.fragment)}` : ''}</option>
                                  })}
                                </optgroup>
                              ))}
                            </select>
                          </label>
                          <label className="stack" style={{ fontSize: 12.5 }}>Seat
                            <select name="seat" defaultValue={ref(cut.seat) || ''} data-testid="cut-seat">
                              <option value="">{clauseSeats.length ? 'No seat yet' : 'Choose a door first'}</option>
                              {clauseSeats.map((seat) => <option key={seat.id} value={seat.id}>({str(seat.position)}) {str(seat.text).slice(0, 70)}</option>)}
                            </select>
                          </label>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn teal small" name="status" value="approved" data-testid="approve-cut" type="submit">Approve</button>
                            <button className="btn ghost small" name="status" value="rejected" data-testid="reject-cut" type="submit">Set aside</button>
                          </div>
                        </form>
                      ) : <div className="hint" data-testid="cut-door-readonly">{door ? <><b>{doorLabel(door)}</b><br />clause {clause}</> : ''}</div>}
                    </article>
                  )
                }) : <p className="empty">No cuts yet. Attach a transcript, then run the extractor.</p>}
              </div>
            </section>
          ) : null}

          {lesson && ladder.length ? (
            <section className="panel" data-testid="ladder-panel">
              <header className="light"><h2>Short clips for the feed ({ladder.length})</h2><span className="hint">Short opening clips of 15 to 20 seconds, and longer extended clips</span></header>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Kind</th><th>Time</th><th>Caption</th><th>Status</th>{!locked ? <th /> : null}</tr></thead>
                  <tbody>
                    {ladder.map((item) => (
                      <tr key={item.id} data-testid="ladder-row">
                        <td>{item.kind === 'hors' ? 'Opening clip' : 'Extended clip'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{clock(Number(item.start))} to {clock(Number(item.end))}</td>
                        <td>{str(item.quote)}</td>
                        <td><span className={`badge ${item.status === 'approved' ? 'teal' : item.status === 'rejected' ? 'grey' : 'gold'}`}>{item.status === 'approved' ? 'Approved' : item.status === 'rejected' ? 'Set aside' : 'Draft'}</span></td>
                        {!locked ? (
                          <td>
                            <form action="/api/hearts" method="post" style={{ display: 'flex', gap: 6 }}>
                              <Hidden fields={{ action: 'ladder-status', item: item.id, next: here }} />
                              <button className="btn teal small" name="status" value="approved" type="submit">Approve</button>
                              <button className="btn ghost small" name="status" value="rejected" type="submit">Set aside</button>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {lesson ? (
            <section className="panel" data-testid="points-panel">
              <header className="light"><h2>Questions on this film ({visiblePoints.length})</h2><span className="hint">The film pauses at each one</span></header>
              <div className="body">
                <div className="point-line" aria-hidden>
                  {visiblePoints.map((point) => <span key={point.id} className={point.timing === 'future' ? 'future' : ''} style={{ left: `${Math.min(98, Math.max(2, (Number(point.second) / length) * 100))}%` }} title={str(point.prompt)} />)}
                </div>
                <div className="table-wrap" style={{ marginBottom: 18 }}>
                  <table className="data">
                    <thead><tr><th>At</th><th>Kind</th><th>Question</th><th>Opens</th><th>Who sees it</th></tr></thead>
                    <tbody>
                      {visiblePoints.map((point) => {
                        const contingent = visiblePoints.find((row) => row.id === ref(point.contingent))
                        return (
                          <tr key={point.id} data-testid="point-row">
                            <td style={{ fontFamily: 'ui-monospace, monospace' }}>{clock(Number(point.second))}</td>
                            <td>{({ reflection: 'Reflection', question: 'Question', multiple_choice: 'Multiple choice', task: 'Task' } as Record<string, string>)[str(point.kind)] || 'Reflection'}</td>
                            <td>{str(point.prompt)}</td>
                            <td>{point.timing === 'future' ? `${str(point.delayAmount)} ${str(point.delayUnit)}${Number(point.delayAmount) === 1 ? '' : 's'} after ${contingent ? `answering "${str(contingent.prompt).slice(0, 40)}"` : 'first watching'}` : 'Straight away'}</td>
                            <td>{point.audience === 'self' ? 'Only its author' : point.audience === 'selected' ? 'Chosen learners' : 'Everyone on this film'}</td>
                          </tr>
                        )
                      })}
                      {!visiblePoints.length ? <tr><td colSpan={5} className="empty">No questions yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <form className="form" action="/api/hearts" method="post" data-testid="point-form">
                  <Hidden fields={{ action: 'create-point', lesson: lesson.id, next: here }} />
                  <h3 style={{ margin: 0, fontSize: 15 }}>Place a question</h3>
                  <PointPicker youtubeId={youtubeId} />
                  <label className="stack">Question<textarea data-testid="point-prompt" name="prompt" required /></label>
                  <div className="cols">
                    <label className="stack">Kind
                      <select name="kind" defaultValue="reflection" data-testid="point-kind">
                        <option value="reflection">Reflection</option>
                        <option value="question">Question</option>
                        <option value="multiple_choice">Multiple choice</option>
                        <option value="task">Task</option>
                      </select>
                    </label>
                    <label className="stack">Who sees it
                      <select data-testid="point-audience" name="audience" defaultValue="everyone">
                        <option value="everyone">Everyone on this film</option>
                        <option value="self">Only me</option>
                        <option value="selected">Chosen learners</option>
                      </select>
                    </label>
                  </div>
                  <label className="stack">Choices, one on each line (multiple choice only)<textarea name="options" data-testid="point-options" /></label>
                  {!locked ? (
                    <div className="cols">
                      <label className="stack">When it opens
                        <select data-testid="point-timing" name="timing" defaultValue="immediate">
                          <option value="immediate">Straight away</option>
                          <option value="future">After a wait</option>
                        </select>
                      </label>
                      <div className="cols">
                        <label className="stack">Wait<input type="number" min={0} data-testid="point-delay" name="delayAmount" defaultValue={2} /></label>
                        <label className="stack">Unit
                          <select name="delayUnit" defaultValue="week" data-testid="point-delay-unit">
                            <option value="second">Seconds</option><option value="minute">Minutes</option><option value="hour">Hours</option><option value="day">Days</option><option value="week">Weeks</option>
                          </select>
                        </label>
                      </div>
                      <label className="stack" style={{ gridColumn: '1 / -1' }}>Only after this question is answered
                        <select data-testid="point-contingent" name="contingent">
                          <option value="">Counted from when they first watch</option>
                          {visiblePoints.map((point) => <option key={point.id} value={point.id}>{str(point.prompt).slice(0, 80)}</option>)}
                        </select>
                      </label>
                    </div>
                  ) : <p className="hint">On a library film your question opens straight away and does not change the original.</p>}
                  {learners.length ? (
                    <div className="checks" aria-label="Chosen learners">
                      {learners.map((learner) => <label className="check" key={learner.id}><input type="checkbox" name="learner" value={learner.id} /> {str(learner.name)}</label>)}
                    </div>
                  ) : null}
                  <div className="actions"><button className="btn ink" data-testid="point-submit" type="submit">Place question</button></div>
                </form>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export async function CourseEditorScreen(ctx: Ctx, courseId: number) {
  guardAdmin(ctx)
  const { payload, user, portal, base, query } = ctx
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const body = await CourseEditorBody({ payload, user, portal, editorHref: `${base}/admin/content/${courseId}`, courseId, part: query.part })
  if (!body) redirect(`${base}/admin/content?error=${encodeURIComponent('That course is not in this portal.')}`)
  return (
    <AdminFrame ctx={ctx} active="content" title={str(course.title)} intro={<Link href={`${base}/admin/content`}>‹ All courses</Link>} testId="admin-course">
      {body}
    </AdminFrame>
  )
}

export async function LibraryScreen(ctx: Ctx) {
  guardAdmin(ctx)
  const { payload, portal, base } = ctx
  const [packs, courses, adoptions, adoptedIds] = await Promise.all([
    rows(payload, 'packs', { owner: { equals: 'master' } }, { sort: 'title' }),
    rows(payload, 'courses', { origin: { equals: 'master' } }, { sort: 'title' }),
    rows(payload, 'adoptions', { portal: { equals: portal.id } }),
    adoptedCourseIds(payload, portal.id),
  ])
  const linkedPack = (id: number) => adoptions.find((row) => row.kind === 'pack' && ref(row.pack) === id)
  const linkedCourse = (id: number) => adoptions.find((row) => row.kind === 'course' && ref(row.course) === id)
  const here = `${base}/admin/library`
  return (
    <AdminFrame ctx={ctx} active="library" title="Library" intro="Courses from the master library. Linking keeps one living copy: when the library updates, your portal sees it too. Nobody here sees a linked course until an access code or a personal grant includes it." testId="admin-library">
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 1fr)', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel">
            <header className="light"><h2>Library packs</h2></header>
            <div className="body grid two">
              {packs.map((pack) => {
                const inside = courses.filter((course) => ((pack.courses as unknown[]) || []).some((item) => ref(item) === course.id))
                const linked = linkedPack(pack.id)
                return (
                  <div className="lib-card" key={pack.id} data-testid="library-pack">
                    <h3>{str(pack.title)}</h3>
                    <p>{inside.map((course) => str(course.title)).join(', ') || 'Empty for now'}</p>
                    {linked ? <span className="badge teal">Linked</span> : (
                      <form action="/api/hearts" method="post">
                        <Hidden fields={{ action: 'adopt', kind: 'pack', pack: pack.id, portalSlug: portal.slug, next: here }} />
                        <button className="btn small" data-testid="adopt-pack" type="submit">Link this pack</button>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
          <section className="panel">
            <header className="light"><h2>Library courses</h2></header>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Course</th><th>Speaker</th><th>Here</th><th /></tr></thead>
                <tbody>
                  {courses.map((course) => {
                    const direct = linkedCourse(course.id)
                    const viaPack = !direct && adoptedIds.includes(course.id)
                    return (
                      <tr key={course.id} data-testid="library-course">
                        <td><b>{str(course.title)}</b>{course.summary ? <div className="hint">{str(course.summary).slice(0, 140)}</div> : null}</td>
                        <td>{str(course.speaker)}</td>
                        <td>{direct ? <span className="badge teal">Linked</span> : viaPack ? <span className="badge purple">In a linked pack</span> : <span className="badge grey">Not linked</span>}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {direct ? (
                            <form action="/api/hearts" method="post">
                              <Hidden fields={{ action: 'remove-adoption', adoption: direct.id, portalSlug: portal.slug, next: here }} />
                              <button className="btn danger small" data-testid="remove-link" type="submit">Remove link</button>
                            </form>
                          ) : !viaPack && course.importable !== false ? (
                            <form action="/api/hearts" method="post">
                              <Hidden fields={{ action: 'adopt', kind: 'course', course: course.id, portalSlug: portal.slug, next: here }} />
                              <button className="btn small" data-testid="adopt-course" type="submit">Link this course</button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel">
            <header><div><h2>Import with a token</h2><p>For a course someone has shared with you</p></div></header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'import-token', portalSlug: portal.slug, next: here }} />
              <label className="stack">Import token<input type="text" data-testid="import-token" name="token" required /></label>
              <div className="actions"><button className="btn ink small" type="submit">Import</button></div>
            </form>
          </section>
          <section className="panel">
            <header><div><h2>Make a smaller pack</h2><p>Take only some courses from the library into a pack of your own</p></div></header>
            <form className="body form" action="/api/hearts" method="post">
              <Hidden fields={{ action: 'split-pack', portalSlug: portal.slug, next: here }} />
              <label className="stack">New pack name<input type="text" name="title" required /></label>
              <div className="checks" style={{ flexDirection: 'column' }}>
                {courses.filter((course) => adoptedIds.includes(course.id) || course.importable !== false).map((course) => <label className="check" key={course.id} data-testid="split-course"><input type="checkbox" name="course" value={course.id} /> {str(course.title)}{adoptedIds.includes(course.id) ? '' : <span className="hint"> (from the library)</span>}</label>)}
                {!courses.length ? <p className="hint">The library has no courses yet.</p> : null}
              </div>
              <div className="actions"><button className="btn ghost small" type="submit">Make pack</button></div>
            </form>
          </section>
        </div>
      </div>
    </AdminFrame>
  )
}

function CodeJoins({ people }: { people: Row[] }) {
  if (!people.length) return <>0</>
  const joined = [...people].sort((a, b) => str(a.createdAt).localeCompare(str(b.createdAt)))
  return (
    <details data-testid="code-joins">
      <summary>{joined.length}</summary>
      <ol className="code-joins">
        {joined.map((person) => (
          <li key={str(person.id)} data-testid="code-join">
            {str(person.name) || str(person.email)}
            <span className="hint"> {new Date(str(person.createdAt)).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}</span>
          </li>
        ))}
      </ol>
    </details>
  )
}

export async function AccessScreen(ctx: Ctx) {
  guardAdmin(ctx)
  const { payload, portal, base, origin } = ctx
  const [codes, packs, people] = await Promise.all([
    rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'code' }),
    rows(payload, 'packs', undefined, { sort: 'title' }),
    portalPeople(payload, portal.id),
  ])
  const usable = packs.filter((pack) => pack.owner === 'master' || ref(pack.portal) === portal.id)
  const teachers = codes.filter((code) => code.role === 'teacher')
  const here = `${base}/admin/access`
  const roleBadge: Record<string, string> = { admin: 'ink', teacher: 'purple', learner: 'teal', parent: 'gold' }
  const courseIds = [...new Set(usable.flatMap((pack) => ((pack.courses as unknown[]) || []).map((item) => ref(item)).filter((id): id is number => Boolean(id))))]
  const courses = courseIds.length ? await rows(payload, 'courses', { id: { in: courseIds } }) : []
  return (
    <AdminFrame ctx={ctx} active="access" title="Access codes" intro="A code says who someone is in the portal and which course pack they see. Send the link rather than the code, so nobody has to type it." testId="admin-access">
      <section className="panel" style={{ marginBottom: 18 }}>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>For</th><th>Course pack</th><th>Teacher code</th><th className="num">Joined</th><th>Works</th><th>Link to send</th><th>QR</th><th>Change</th></tr></thead>
            <tbody>
              {codes.map((code) => {
                const share = `${origin}/join?code=${encodeURIComponent(str(code.code))}`
                const packIds = ((code.packs as unknown[]) || []).map((item) => ref(item))
                return (
                  <tr key={code.id} data-testid="code-card">
                    <td><div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }} data-testid="code-value-cell">{str(code.code)}</div>{str(code.label) ? <div className="hint">{str(code.label)}</div> : null}</td>
                    <td><span className={`badge ${roleBadge[str(code.role)] || 'grey'}`}>{str(code.role)[0]?.toUpperCase() + str(code.role).slice(1)}</span></td>
                    <td>{usable.filter((pack) => packIds.includes(pack.id)).map((pack) => str(pack.title)).join(', ') || <span className="hint">None</span>}</td>
                    <td>{str(teachers.find((row) => row.id === ref(code.linkedTeacherCode))?.code) || <span className="hint">None</span>}</td>
                    <td className="num"><CodeJoins people={people.filter((person) => ref(person.accessCode) === code.id)} /></td>
                    <td><CodeStatus code={code} next={here} portalSlug={portal.slug} /></td>
                    <td><div className="address" style={{ fontSize: 12 }} data-testid="share-url">{share}</div></td>
                    <td><div style={{ width: 84 }} className="qr-small"><Qr value={share} testId="code-qr" /></div></td>
                    <td>
                      <details>
                        <summary className="btn ghost small">Change</summary>
                        <form className="form" action="/api/hearts" method="post" style={{ marginTop: 8, minWidth: 240 }}>
                          <Hidden fields={{ action: 'update-code', portalSlug: portal.slug, codeId: code.id, next: here }} />
                          <select name="pack" defaultValue={packIds[0] || ''}>{usable.map((pack) => <option key={pack.id} value={pack.id}>{str(pack.title)}</option>)}</select>
                          <select name="apply" defaultValue="leave">
                            <option value="leave">Leave people who already joined as they are</option>
                            <option value="add">Add the new courses for them</option>
                            <option value="remove">Remove these courses from them</option>
                            <option value="overwrite">Replace their list with this pack</option>
                          </select>
                          <button className="btn ink small" type="submit">Update code</button>
                        </form>
                      </details>
                    </td>
                  </tr>
                )
              })}
              {!codes.length ? <tr><td colSpan={9} className="empty">No codes yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <div className="grid two" style={{ alignItems: 'start' }}>
        <section className="panel">
          <header><div><h2>New access code</h2><p>Learner and parent codes need a teacher code, so someone sees their progress</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-code', portalSlug: portal.slug, next: here }} />
            <div className="cols">
              <label className="stack">Code<input type="text" data-testid="new-code" name="code" placeholder="Leave empty for a random code" /></label>
              <label className="stack">For
                <select data-testid="new-code-role" name="role" defaultValue="learner">
                  <option value="learner">Learner</option><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="parent">Parent (one course)</option>
                </select>
              </label>
            </div>
            <div className="cols">
              <label className="stack">Course pack
                <select data-testid="new-code-pack" name="pack">{usable.map((pack) => <option key={pack.id} value={pack.id}>{str(pack.title)}</option>)}</select>
              </label>
              <label className="stack">Teacher code
                <select data-testid="new-code-teacher" name="linkedTeacherCode">
                  <option value="">None</option>
                  {teachers.map((code) => <option key={code.id} value={code.id}>{str(code.code)}</option>)}
                </select>
              </label>
            </div>
            <CodeLimits />
            {courses.length ? (
              <div>
                <div className="hint" style={{ marginBottom: 6 }}>Courses everyone on this code is asked to finish (optional)</div>
                <div className="checks">{courses.map((course) => <label className="check" key={course.id}><input type="checkbox" name="requiredCourse" value={course.id} /> {str(course.title)}</label>)}</div>
              </div>
            ) : null}
            <div className="actions"><button className="btn ink" data-testid="new-code-submit" type="submit">Create access code</button></div>
          </form>
        </section>
        <section className="panel">
          <header><div><h2>New course pack</h2><p>A pack is a set of courses a code can open</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-pack', portalSlug: portal.slug, next: here }} />
            <label className="stack">Pack name<input type="text" data-testid="portal-pack-title" name="title" required /></label>
            <div className="actions"><button className="btn ghost" data-testid="portal-pack-submit" type="submit">Save pack</button></div>
          </form>
        </section>
      </div>
    </AdminFrame>
  )
}
