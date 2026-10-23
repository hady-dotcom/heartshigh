import { Fragment } from 'react'
import Link from 'next/link'
import { loadDoors } from '@/server/doors'
import { doorLabel, doorOfClause } from '@/lib/doors'
import { countLine } from '@/lib/curriculum-groups'
import { coursesOpenedByCode, type PackCourses } from '@/lib/code-courses'
import { withEveryDoor } from '@/lib/every-door'
import { groupThese, listDocs } from '@/server/curriculum'
import { loadLibraryPicker, openedByLines, primaryDoorCode } from '@/server/code-courses'
import { CourseTree } from '@/components/desk/course-tree'
import { CodeCourseEditor, LibraryCoursePicker } from '@/components/desk/library-picker'
import { notFound, redirect } from 'next/navigation'
import type { Payload } from 'payload'
import { ExampleInUse } from '@/components/app/care'
import { Hidden } from '@/components/app/shell'
import { CodeLimits, CodeStatus } from '@/components/desk/codes'
import { PointPicker } from '@/components/desk/tools'
import { Qr } from '@/components/qr'
import { ShareLinks } from '@/components/desk/share-links'
import { adoptedCourseIds, type PortalDoc, type SessionUser } from '@/server/context'
import { partTitle } from '@/lib/talk-title'
import { learnerEmbedSrc } from '@/lib/yt'
import { counted, editorLink, youtubeThumb, youtubeWatch, type CourseUse } from '@/lib/library-catalogue'
import { Pager } from '@/components/desk/pager'
import { courseFilms, whoUsesCourse } from '@/server/library-catalogue'
import { type Ctx, type Row, allDocs, clock, one, portalPeople, ref, rows, str } from '../common'
import { FramingPreview } from '@/components/desk/framing-preview'
import { trackForClip } from '@/lib/framing/store'
import { fallbackTrack } from '@/lib/framing/validate'
import { HelpTip } from '@/components/desk/help'
import { PortalAiChoice } from '@/components/desk/paid-ai'
import { publicAi } from '@/lib/portal-ai'
import { TOOL } from '@/lib/desk-help'
import { BusyForm } from '@/components/desk/busy-form'
import { listShortTalks } from '@/server/short-talks'
import { TooShortFilter, TooShortTable } from './short-talks'
import { bringInLang, bringInStatus, CAPTION_LANGUAGES } from '@/lib/youtube'
import { AdminFrame } from './overview'
import { CourseOnCodes } from './course-offer'
import { DeleteInline, DeleteMany, DeletePick } from '@/components/desk/delete-controls'
import { courseRemovedFromDesk } from '@/lib/desk-delete'
import { vimeoPlayerSrc } from '@/lib/vimeo'

export function guardAdmin(ctx: Ctx) {
  if (ctx.user.role === 'teacher') redirect(`${ctx.base}/admin?error=${encodeURIComponent('That page is for the portal admin. Ask them if you need something changed.')}`)
}

export async function ContentScreen(ctx: Ctx) {
  const teacher = ctx.user.role === 'teacher'
  const { payload, portal, base, query } = ctx
  const gone = (course: unknown) => courseRemovedFromDesk(course as { hidden?: boolean | null; hiddenNote?: unknown })
  const local = (await rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] }, { sort: 'title' })).filter((course) => !gone(course))
  const adoptedIds = await adoptedCourseIds(payload, portal.id)
  const linked = (adoptedIds.length ? await rows(payload, 'courses', { id: { in: adoptedIds } }, { sort: 'title' }) : []).filter((course) => !gone(course))
  const all = [...local, ...linked]
  const ids = all.map((course) => course.id)
  const [units, lessons, learnerCodes] = await Promise.all([
    ids.length ? rows(payload, 'units', { course: { in: ids } }) : Promise.resolve([]),
    ids.length ? rows(payload, 'lessons', { course: { in: ids } }) : Promise.resolve([]),
    rows(payload, 'access-codes', { and: [{ portal: { equals: portal.id } }, { role: { equals: 'learner' } }] }, { sort: 'code' }),
  ])
  const lessonIds = lessons.map((lesson) => lesson.id)
  const [points, cuts] = await Promise.all([
    lessonIds.length ? rows(payload, 'engagement-points', { lesson: { in: lessonIds } }, { limit: 2000 }) : Promise.resolve([]),
    lessonIds.length ? rows(payload, 'cuts', { lesson: { in: lessonIds } }, { limit: 2000 }) : Promise.resolve([]),
  ])
  const localIds = new Set(local.map((course) => course.id))
  const q = (query.q || '').trim().toLowerCase()
  const origin = query.origin === 'mine' || query.origin === 'library' ? query.origin : 'all'
  const filtered = all.filter((course) => {
    const isLocal = localIds.has(course.id)
    if (origin === 'mine' && !isLocal) return false
    if (origin === 'library' && isLocal) return false
    if (q && !`${str(course.title)} ${str(course.speaker)}`.toLowerCase().includes(q)) return false
    return true
  })
  const grouped = withEveryDoor(await groupThese(payload, filtered.map((course) => ({ id: course.id, title: str(course.title), summary: str(course.summary) }))))
  const filled = grouped.filter((group) => group.courses.length)
  const empty = grouped.filter((group) => !group.courses.length)
  const listedIds = new Set(filtered.map((course) => course.id))
  const listedLessons = lessons.filter((lesson) => listedIds.has(ref(lesson.course) || 0))
  const listedUnits = units.filter((unit) => listedIds.has(ref(unit.course) || 0))
  const listedPoints = points.filter((point) => listedLessons.some((lesson) => lesson.id === ref(point.lesson)))
  const byId = new Map(filtered.map((course) => [course.id, course]))
  const stat = (n: number, label: string) => <div className="stat-chip"><b>{n}</b><span>{label}</span></div>
  const here = `${base}/admin/content`
  const courseRow = (courseId: number) => {
    const course = byId.get(courseId)
    if (!course) return null
    const own = lessons.filter((lesson) => ref(lesson.course) === course.id && lesson.tooShort !== true)
    const ownIds = new Set(own.map((lesson) => lesson.id))
    const isLocal = localIds.has(course.id)
    return (
      <tr key={course.id} data-testid="course-row" data-origin={isLocal ? 'local' : 'imported'} data-hidden={course.hidden ? 'yes' : 'no'}>
        <td>
          <Link href={`${base}/admin/content/${course.id}`} style={{ fontWeight: 700 }}>{str(course.title)}</Link>
          {course.hidden && course.hiddenNote ? <div className="hint" data-testid="course-hidden-note">{str(course.hiddenNote)}</div> : null}
        </td>
        <td>{str(course.speaker) || <span className="hint">Not set</span>}</td>
        <td>{isLocal ? <span className="badge teal">Made here</span> : <span className="badge gold">Library, read only</span>}</td>
        <td className="num">{own.length}</td>
        <td className="num">{points.filter((point) => ownIds.has(ref(point.lesson) || 0)).length}</td>
        <td className="num">{cuts.filter((cut) => ownIds.has(ref(cut.lesson) || 0) && cut.status === 'approved').length}</td>
        <td>
          <Link className="btn ghost small" href={`${base}/admin/content/${course.id}`}>{teacher ? 'Add questions' : isLocal ? 'Edit' : 'View'}</Link>
          {isLocal && !teacher ? (
            <>
              <DeletePick formId="bulk-course" id={course.id} label={str(course.title)} />
              <DeleteInline kind="course" id={course.id} next={here} portalSlug={portal.slug} testId={`delete-course-${course.id}`} />
            </>
          ) : null}
        </td>
      </tr>
    )
  }
  return (
    <AdminFrame ctx={ctx} active="content" title={teacher ? 'Questions in talks' : 'Content'} intro={teacher ? 'Pick a talk, then place a question at the moment you want the film to pause.' : 'Build courses here: a subject, its topics, the films in each topic, and the questions that pause the film.'} testId="admin-content">
      {teacher ? null : <p data-testid="content-overview">Your courses: {local.length} · From the library: {linked.length} · Add your own → <Link className="btn ink small" href={`${base}/admin/bring-in`} data-testid="content-bring-in">Bring in</Link></p>}
      <div className="stats-strip">
        {stat(filtered.length, 'Subjects')}
        {stat(listedUnits.length, 'Topics')}
        {stat(listedLessons.length, 'Films')}
        {stat(listedPoints.length, 'Questions')}
      </div>
      <div className="grid" style={{ gridTemplateColumns: teacher ? 'minmax(0, 1fr)' : 'minmax(0, 1.7fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <header className="light"><h2>Courses in this portal <HelpTip topic="content-search">{TOOL.contentSearch}</HelpTip></h2>{teacher ? null : <Link className="btn ghost small" href={`${base}/admin/library`}>Add from the library</Link>}</header>
          {teacher ? null : <DeleteMany kind="course" next={here} portalSlug={portal.slug} formId="bulk-course" />}
          <form className="content-tools" action={here} method="get" data-testid="content-filter">
            <label className="stack">Search<input className="field" name="q" defaultValue={query.q || ''} placeholder="Subject or speaker" /></label>
            <label className="stack">Show
              <select name="origin" defaultValue={origin} data-testid="content-origin">
                <option value="all">Mine and library</option>
                <option value="mine">Mine</option>
                <option value="library">Library</option>
              </select>
            </label>
            <button className="btn ghost small" type="submit">Apply</button>
          </form>
          {grouped.length ? (
            <>
              {filled.map((group) => (
                <details key={group.key} className="content-group" open data-testid="content-door" data-door={group.key}>
                  <summary>{group.heading} · {countLine(group.talkCount, group.courses.length)}</summary>
                  <div className="table-wrap">
                    <table className="data">
                      <thead><tr><th>Subject</th><th>Speaker</th><th>From</th><th className="num">Films</th><th className="num">Questions</th><th className="num">Cuts live</th><th /></tr></thead>
                      <tbody>
                        {group.seats.map((seat) => (
                          <Fragment key={`seat-${seat.id}`}>
                            <tr><td colSpan={7} className="content-seat">{seat.label}</td></tr>
                            {seat.courses.map((course) => courseRow(course.id))}
                          </Fragment>
                        ))}
                        {group.unseated.map((course) => courseRow(course.id))}
                        {!group.seats.length && !group.unseated.length ? group.courses.map((course) => courseRow(course.id)) : null}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
              {empty.length ? (
                <details className="content-empty-doors" data-testid="content-empty-doors">
                  <summary>Doors with nothing yet ({empty.length})</summary>
                  {empty.map((group) => (
                    <p key={group.key} className="content-empty-door" data-testid="content-door" data-door={group.key}>
                      {group.heading} · {countLine(group.talkCount, group.courses.length)}
                    </p>
                  ))}
                </details>
              ) : null}
            </>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Subject</th><th>Speaker</th><th>From</th><th className="num">Films</th><th className="num">Questions</th><th className="num">Cuts live</th><th /></tr></thead>
                <tbody>
                  {filtered.map((course) => courseRow(course.id))}
                  {!filtered.length ? <tr><td colSpan={7}>{all.length ? <p className="empty">Nothing matches this search.</p> : <ExampleInUse desk title="East London circle notes" action={{ href: '#new-subject', label: 'Start a subject' }}><p>A local course · one film · questions added in the editor</p></ExampleInUse>}</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {teacher ? null : <section className="panel" id="new-course">
          <header><div><h2>New subject <HelpTip topic="local-course">{TOOL.localCourse}</HelpTip></h2><p>Subject, then topic, then film. Questions are added in the editor.</p></div></header>
          <form id="new-subject" className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-course', origin: 'local', portalSlug: portal.slug, next: `${base}/admin/content` }} />
            <label className="stack">Subject name<input type="text" data-testid="local-course-title" name="title" required /></label>
            <label className="stack">First topic<input type="text" name="unit" placeholder="Topic 1" /></label>
            <label className="stack">First film<input type="text" name="lesson" placeholder="Same as the subject if left empty" /></label>
            <div className="cols">
              <label className="stack">Length<input type="text" data-testid="local-course-duration" name="duration" inputMode="numeric" placeholder="minutes:seconds" /></label>
              <label className="stack">Speaker<input type="text" name="speaker" /></label>
            </div>
            <label className="stack">Put it on a learner code
              <select data-testid="local-course-code" name="onCode">
                <option value="">Not yet</option>
                {learnerCodes.map((code) => <option key={code.id} value={code.id}>{str(code.label) || str(code.code)}</option>)}
              </select>
            </label>
            <p className="hint">Leave this as Not yet and, after you save, you can put the course on a code. Learners cannot open it until it is on a code or given to them.</p>
            <div className="actions"><button className="btn ink" data-testid="local-course-submit" type="submit">Save subject</button></div>
          </form>
        </section>}
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

function UsedIn({ use }: { use: CourseUse }) {
  if (!use.codes.length && !use.packs.length && !use.portals.length) return null
  const block = (testId: string, heading: string, names: string[]) => names.length ? (
    <div data-testid={testId}>
      <h3>{heading}</h3>
      <ul>{names.map((name) => <li key={name}>{name}</li>)}</ul>
    </div>
  ) : null
  return (
    <section className="panel used-in" data-testid="used-in">
      <header><h2>Used in</h2></header>
      <div className="body">
        {block('used-codes', 'Join codes', use.codes)}
        {block('used-packs', 'Packs', use.packs)}
        {block('used-portals', 'Portals', use.portals)}
      </div>
    </section>
  )
}

export async function CourseEditorBody({ payload, user, portal, editorHref, courseId, part, filmsPage }: { payload: Payload; user: SessionUser; portal: PortalDoc | null; editorHref: string; courseId: number; part?: string; filmsPage?: string }) {
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const access = await canOpenCourse(payload, user, portal, course)
  if (!access.ok) return null
  const teacherOnly = user.role === 'teacher'
  const locked = access.locked || teacherOnly
  const [units, filmPage, clauses, seats, people, doors, usedIn] = await Promise.all([
    allDocs(payload, 'units', { course: { equals: courseId } }, { sort: 'order' }),
    courseFilms(payload, courseId, filmsPage),
    rows(payload, 'clauses', undefined, { sort: 'number', limit: 50 }),
    rows(payload, 'seats', undefined, { sort: 'position', limit: 400 }),
    portal ? portalPeople(payload, portal.id) : Promise.resolve([]),
    loadDoors(payload),
    !portal && user.role === 'master' ? whoUsesCourse(payload, courseId) : Promise.resolve(null),
  ])
  let lessons = filmPage.lessons
  let lesson = lessons.find((row) => row.id === Number(part)) || null
  if (part && (!lesson || lesson.id !== Number(part))) {
    const picked = await one(payload, 'lessons', Number(part))
    if (picked && ref(picked.course) === courseId) lesson = picked
  }
  if (!lesson) lesson = lessons[0]
  if (lesson && !lessons.some((row) => row.id === lesson!.id)) lessons = [...lessons, lesson]
  const here = editorLink(editorHref, { part: lesson?.id, films: filmPage.page })
  const [cuts, ladder, points] = await Promise.all([
    lesson ? allDocs(payload, 'cuts', { lesson: { equals: lesson.id } }, { sort: 'start' }) : Promise.resolve([]),
    lesson ? allDocs(payload, 'ladder-items', { lesson: { equals: lesson.id } }, { sort: 'start' }) : Promise.resolve([]),
    lesson ? allDocs(payload, 'engagement-points', { lesson: { equals: lesson.id } }, { sort: 'second', depth: 1 }) : Promise.resolve([]),
  ])
  const visiblePoints = points.filter((point) => {
    const author = point.author as { role?: string; tenants?: { tenant?: unknown }[] } | null
    if (user.role === 'master' || !author || author.role === 'master') return true
    return (author.tenants || []).some((row) => ref(row.tenant) === portal?.id)
  })
  const learners = people.filter((person) => person.role === 'learner')
  const youtubeId = lesson ? str(lesson.youtubeId) || null : null
  const length = Number(lesson?.durationSeconds || 0) || Math.max(60, ...visiblePoints.map((point) => Number(point.second) + 30))
  const lessonsByUnit = (units.length ? units : [{ id: 0, title: 'Topic 1' } as Row]).map((unit) => ({ unit, items: lessons.filter((row) => (units.length ? ref(row.unit) === unit.id : true)) })).filter((group) => group.items.length)
  const courseTitle = str(course.title)

  return (
    <div data-testid="course-detail" data-locked={locked ? 'yes' : 'no'}>
      {teacherOnly ? <div className="flash notice" data-testid="readonly">You can place questions on these films. The portal admin looks after the rest of the course.</div> : locked ? <div className="flash notice" data-testid="readonly">This course comes from the library, so it is read only here. You can add your own questions on top; the original stays as it is for every portal.</div> : null}
      {portal && !locked ? await CourseOnCodes({ payload, portalId: portal.id, portalSlug: portal.slug, courseId, courseTitle, next: editorHref, accessHref: `${editorHref.replace(/\/admin\/content.*/, '/admin/access')}` }) : null}
      {usedIn ? <UsedIn use={usedIn} /> : null}
      {filmPage.total ? (
        <section className="panel film-grid" data-testid="film-grid">
          <header><div><h2>Films</h2><p data-testid="film-total">{counted(filmPage.total, 'film', 'films')}</p></div></header>
          {!locked ? <DeleteMany kind="lesson" next={editorHref} portalSlug={portal?.slug} formId="bulk-lesson" /> : null}
          <div className="film-cards">
            {filmPage.lessons.map((row) => {
              const thumb = youtubeThumb(row.youtubeId)
              const watch = youtubeWatch(row.youtubeId)
              return (
                <article key={row.id} className="film-card" data-testid="film-card" data-youtube={youtubeThumb(row.youtubeId) ? str(row.youtubeId) : ''}>
                  {thumb && watch ? (
                    <a href={watch} target="_blank" rel="noopener noreferrer" data-testid="film-watch">
                      <img src={thumb} alt="" width={320} height={180} />
                      <span>Watch</span>
                    </a>
                  ) : null}
                  <Link href={editorLink(editorHref, { part: row.id, films: filmPage.page })}>{partTitle(row, courseTitle)}</Link>
                  {row.durationSeconds ? <small>{clock(Number(row.durationSeconds))}</small> : null}
                  {!locked ? (
                    <>
                      <DeletePick formId="bulk-lesson" id={row.id} label={partTitle(row, courseTitle)} />
                      <DeleteInline kind="lesson" id={row.id} next={here} portalSlug={portal?.slug} testId={`delete-lesson-${row.id}`} />
                    </>
                  ) : null}
                </article>
              )
            })}
          </div>
          <Pager page={filmPage.page} pages={filmPage.pages} hrefFor={(page) => editorLink(editorHref, { part: lesson?.id, films: page })} />
        </section>
      ) : null}
      <div className="builder">
        <div style={{ display: 'grid', gap: 18 }}>
          <section className="panel">
            <header><div><h2>{str(course.title)}</h2><p>{str(course.speaker) || 'No speaker set'}</p></div></header>
            <nav className="tree" aria-label="Topics and films">
              {lessonsByUnit.map(({ unit, items }) => (
                <div key={unit.id}>
                  <div className="unit">{str(unit.title)}</div>
                  {items.map((row) => (
                    <Link key={row.id} href={editorLink(editorHref, { part: row.id, films: filmPage.page })} className={row.id === lesson?.id ? 'on' : ''} data-testid="tree-lesson">
                      ▶ {partTitle(row, str(course.title))}<small>{row.publishState === 'draft' ? 'Draft' : ''}{row.durationSeconds ? ` ${clock(Number(row.durationSeconds))}` : ''}</small>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
            {!locked ? (
              <form id="add-film" className="body form" action="/api/hearts" method="post" style={{ borderTop: '1px solid var(--line)' }}>
                <Hidden fields={{ action: 'add-lesson', course: courseId, next: editorHref }} />
                <label className="stack">Add a film<input type="text" name="title" placeholder="Part 2" data-testid="add-film-title" /></label>
                <label className="stack">YouTube link<input type="text" name="youtube" placeholder="https://www.youtube.com/watch?v=…" data-testid="add-film-youtube" /></label>
                <p className="hint">Leave the title blank and the film takes its name from YouTube. You can still type a title.</p>
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
                <label className="check"><input type="checkbox" name="importable" defaultChecked={Boolean(course.importable)} /> Other portals may add this course</label>
                <div className="actions"><button className="btn ghost small" type="submit">Save</button></div>
              </form>
              <div className="body">
                <DeleteInline kind="course" id={courseId} next={editorHref.replace(/\/\d+$/, '')} portalSlug={portal?.slug} testId="delete-course" />
              </div>
            </section>
          ) : null}
        </div>
        <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
          {lesson ? (
            <section className="panel" data-testid="lesson-row">
              <header><div><h2>Film: {partTitle(lesson, str(course.title))}</h2><p data-testid="lesson-meta">{youtubeId ? `YouTube ${youtubeId}` : 'No film link yet'}{lesson.durationSeconds ? ` · ${clock(Number(lesson.durationSeconds))}` : ''}{str(lesson.speaker) ? ` · ${str(lesson.speaker)}` : ''}</p></div></header>
              <div className="body" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18 }}>
                <div>
                  {str(lesson.videoProvider) === 'vimeo' && str(lesson.vimeoId) ? <iframe className="film-preview" style={{ padding: 0 }} title={partTitle(lesson, str(course.title))} src={vimeoPlayerSrc(str(lesson.vimeoId), str(lesson.vimeoHash))} allow="fullscreen; picture-in-picture" /> : str(lesson.videoProvider) === 'file' ? <video className="film-preview" style={{ padding: 0 }} controls src={`/api/hearts/film/${lesson.id}`} /> : youtubeId ? <iframe className="film-preview" style={{ padding: 0 }} title={partTitle(lesson, str(course.title))} src={learnerEmbedSrc(youtubeId)} allow="encrypted-media" /> : <div className="film-preview">{locked ? 'This film has no YouTube link.' : 'Paste a YouTube link to attach the film.'}</div>}
                  <p className="hint" style={{ marginTop: 10 }}>
                    {(() => {
                      const status = bringInStatus(str(lesson.transcriptNote))
                      const label = status === 'processed' ? 'Processed' : status === 'failed' ? 'Failed' : status === 'waiting' ? 'Waiting for transcript' : status === 'processing' ? 'Processing' : status === 'queued' ? 'Queued' : ''
                      const tone = status === 'failed' ? 'rose' : status === 'processed' ? 'teal' : status === 'waiting' ? 'gold' : 'gold'
                      const published = lesson.publishState !== 'draft'
                      return (
                        <>
                          <span className={`badge ${published ? 'teal' : 'gold'}`} data-testid="publish-state" data-state={published ? 'published' : 'draft'}>{published ? 'Published' : 'Draft'}</span>
                          {' '}
                          {label ? <span className={`badge ${tone}`} data-testid="bring-in-status" data-status={status}>{label}</span> : null}
                        </>
                      )
                    })()}{' '}
                    {lesson.transcript ? <span data-testid="has-transcript">Transcript attached. </span> : <span>No transcript yet. </span>}
                    {lesson.transcriptNote ? <span data-testid="transcript-note">{str(lesson.transcriptNote)}</span> : null}
                  </p>
                </div>
                {!locked ? (
                  <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                    <BusyForm className="form" action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'ingest', lesson: lesson.id, next: here }} />
                      <label className="stack">YouTube links, one per line <HelpTip topic="ingest">{TOOL.ingest}</HelpTip><textarea data-testid="youtube-url" name="url" rows={4} placeholder={'https://www.youtube.com/watch?v=…\nhttps://youtu.be/… | Speaker name'} required defaultValue="" /></label>
                      <input type="hidden" name="fetchTranscript" value="no" />
                      <label className="check">
                        <input type="checkbox" name="fetchTranscript" value="yes" defaultChecked data-testid="fetch-transcript" /> Bring in the transcript
                      </label>
                      <HelpTip topic="fetch-transcript">{TOOL.fetchTranscript}</HelpTip>
                      <label className="stack">Caption language <HelpTip topic="caption-lang">{TOOL.captionLang}</HelpTip>
                        <select name="captionLang" defaultValue={bringInLang(str(lesson.transcriptNote))} data-testid="caption-lang">
                          {CAPTION_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      {youtubeId ? (
                        <label className="check">
                          <input type="checkbox" name="replaceFilm" value="yes" data-testid="replace-film" /> Replace this film
                          <HelpTip topic="replace-film">{TOOL.replaceFilm}</HelpTip>
                        </label>
                      ) : null}
                      <div className="actions"><button className="btn ink small" data-testid="ingest-submit" type="submit">Bring in</button></div>
                      <p className="hint">New films are drafts. Learners cannot see them until you publish. <Link href={editorHref.startsWith('/master') ? '/master/bring-in' : editorHref.replace(/\/admin\/content.*/, '/admin/bring-in')}>Playlists and channels are on Bring in.</Link></p>
                    </BusyForm>
                    <BusyForm action="/api/hearts" method="post" className="form">
                      <Hidden fields={{ action: 'publish-talks', lesson: lesson.id, next: here }} />
                      <label className="check">
                        <input type="checkbox" name="giveHolders" value="yes" data-testid="give-holders" /> Also give it to learners who already hold this pack
                        <HelpTip topic="give-holders">{TOOL.bringInGiveHolders}</HelpTip>
                      </label>
                      <div className="actions"><button className="btn ink small" type="submit" data-testid="publish-talk">Publish this talk</button></div>
                    </BusyForm>
                    {(bringInStatus(str(lesson.transcriptNote)) === 'failed' || bringInStatus(str(lesson.transcriptNote)) === 'waiting') && (youtubeId || str(lesson.sourceUrl)) ? (
                      <BusyForm action="/api/hearts" method="post" className="actions">
                        <Hidden fields={{ action: 'ingest', lesson: lesson.id, next: here, retry: 'yes', url: `${youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : str(lesson.sourceUrl)}${str(lesson.speaker) ? ` | ${str(lesson.speaker)}` : ''}`, fetchTranscript: 'yes', captionLang: bringInLang(str(lesson.transcriptNote)) }} />
                        <button className="btn ghost small" type="submit" data-testid="bring-in-retry">Try again</button>
                        <HelpTip topic="bring-in-retry">{TOOL.bringInRetry}</HelpTip>
                      </BusyForm>
                    ) : null}
                    <form id="transcript" className="form" action="/api/hearts" method="post" encType="multipart/form-data">
                      <Hidden fields={{ action: 'upload-transcript', lesson: lesson.id, next: here }} />
                      <label className="stack">Or upload a transcript (.vtt, .srt or .txt)<input data-testid="transcript-file" type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" required /></label>
                      <div className="actions"><button className="btn ghost small" data-testid="transcript-submit" type="submit">Upload transcript</button></div>
                    </form>
                    <form action="/api/hearts" method="post">
                      <Hidden fields={{ action: 'extract', lesson: lesson.id, next: here }} />
                      <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Pull the clips <HelpTip topic="extract">{TOOL.extract}</HelpTip></p>
                      <PortalAiChoice connected={publicAi(portal?.aiConnection).connected} master={user.role === 'master'} teacher={user.role === 'teacher'} calls={1} settingsHref={portal ? `/p/${portal.slug}/admin/settings` : undefined} />
                      <button className="btn block" style={{ width: '100%' }} data-testid="extract-submit" type="submit">Draft clips from the words</button>
                      <p className="hint" style={{ marginTop: 6 }}>Finds short moments with a hook, a turn and a landing line. Quotes are word for word and timings come from the transcript. Running it again keeps clips you have already approved and replaces the drafts.</p>
                    </form>
                  </div>
                ) : <p className="hint">The film, transcript and cuts are looked after by the master desk.</p>}
              </div>
            </section>
          ) : <section className="panel"><div className="body"><ExampleInUse desk title="Part 1" action={{ href: '#add-film', label: 'Add a film' }}><p>A talk in this subject, ready for questions.</p></ExampleInUse></div></section>}

          {lesson && youtubeId ? (() => {
            const clip = cuts[0]
            const windowStart = Number(clip?.start || 0)
            const windowEnd = Number(clip?.end || lesson.durationSeconds || windowStart + 25)
            const track = trackForClip(youtubeId, windowStart, windowEnd, clip?.framingTrack || lesson.framingTrack) || fallbackTrack(youtubeId, windowStart, windowEnd)
            return (
              <section className="panel" data-testid="framing-panel">
                <header className="light"><h2>Portrait framing</h2><span className="hint">Live crop on YouTube. No re-render.</span></header>
                <div className="body">
                  <FramingPreview track={track} youtubeId={youtubeId} speaker={str(lesson.speaker)} cutId={clip?.id} next={here} />
                </div>
              </section>
            )
          })() : null}

          {lesson ? (
            <section className="panel" data-testid="cuts-panel">
              <header className="light"><h2>Cuts for review ({cuts.length})</h2><span className="hint">{cuts.filter((cut) => cut.status === 'approved').length} approved</span></header>
              {!locked ? <DeleteMany kind="clip" next={here} portalSlug={portal?.slug} formId="bulk-clip" /> : null}
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
                          {door ? <>Door <strong data-testid="cut-door" style={{ color: 'var(--ink)' }}>{doorLabel(door)}</strong>{cut.clauseFragment || clauseDoc ? <span className="hint" data-testid="cut-door-clause"> {str(cut.clauseFragment) || str(clauseDoc?.fragment)}</span> : <span className="hint" data-testid="cut-door-clause" />}. </> : null}
                          {cut.whyHang ? <>{str(cut.whyHang)} </> : null}
                          Quote check: {str(cut.quoteConfidence, 'not checked')}. {cut.engine === 'llm' ? 'Drafted with this portal’s AI account.' : 'Drafted from the transcript.'}
                        </div>
                      </div>
                      {!locked ? (
                        <form action="/api/hearts" method="post">
                          <Hidden fields={{ action: 'cut-status', cut: cut.id, confirm: 'yes', next: here }} />
                          <label className="stack" style={{ fontSize: 12.5 }}>Which door
                            <select name="clause" defaultValue={clause || ''} data-testid="cut-clause">
                              <option value="">No door</option>
                              {doors.map((row) => (
                                <optgroup key={row.number} label={doorLabel(row)}>
                                  {row.clauses.map((number) => {
                                    const doc = clauses.find((item) => Number(item.number) === number)
                                    return <option key={number} value={number}>{doc ? str(doc.fragment) : row.title}</option>
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
                      ) : <div className="hint" data-testid="cut-door-readonly">{door ? <b>{doorLabel(door)}</b> : ''}</div>}
                      {!locked ? (
                        <>
                          <DeletePick formId="bulk-clip" id={cut.id} label={str(cut.hook) || 'clip'} />
                          <DeleteInline kind="clip" id={cut.id} next={here} portalSlug={portal?.slug} testId={`delete-clip-${cut.id}`} />
                        </>
                      ) : null}
                    </article>
                  )
                }) : <ExampleInUse desk title="A clip from the talk" action={{ href: '#transcript', label: 'Add the words' }}><p>0:12 to 0:28 · the line you want people to hear first.</p><p className="hint">Add the timed words, then pull the clips.</p></ExampleInUse>}
              </div>
            </section>
          ) : null}

          {lesson && ladder.length ? (
            <section className="panel" data-testid="ladder-panel">
              <header className="light"><h2>Short clips for the feed ({ladder.length})</h2><span className="hint">Short opening clips of 15 to 20 seconds, each inside its longer extended clip</span></header>
              {!locked ? <DeleteMany kind="ladder" next={here} portalSlug={portal?.slug} formId="bulk-ladder" /> : null}
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
                            <DeletePick formId="bulk-ladder" id={item.id} label={str(item.quote) || 'draft clip'} />
                            <DeleteInline kind="ladder" id={item.id} next={here} portalSlug={portal?.slug} testId={`delete-ladder-${item.id}`} />
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
                {!locked ? <DeleteMany kind="point" next={here} portalSlug={portal?.slug} formId="bulk-point" /> : null}
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
                            <td>
                              {point.audience === 'self' ? 'Only its author' : point.audience === 'selected' ? 'Chosen learners' : 'Everyone on this film'}
                              {!locked ? (
                                <>
                                  <DeletePick formId="bulk-point" id={point.id} label={str(point.prompt)} />
                                  <DeleteInline kind="point" id={point.id} next={here} portalSlug={portal?.slug} testId={`delete-point-${point.id}`} />
                                </>
                              ) : null}
                            </td>
                          </tr>
                        )
                      })}
                      {!visiblePoints.length ? <tr><td colSpan={5}><ExampleInUse desk title="At 12:30" action={{ href: '#place-question', label: 'Place a question' }}><p>What will you keep from this? · everyone on this film</p></ExampleInUse></td></tr> : null}
                    </tbody>
                  </table>
                </div>
                <form id="place-question" className="form" action="/api/hearts" method="post" data-testid="point-form">
                  <Hidden fields={{ action: 'create-point', lesson: lesson.id, next: here }} />
                  <h3 style={{ margin: 0, fontSize: 15 }}>Place a question</h3>
                  <PointPicker youtubeId={youtubeId} />
                  <label className="stack">Question<textarea data-testid="point-prompt" name="prompt" required placeholder="What will you keep from this?" /></label>
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
                  ) : <p className="hint">{teacherOnly ? "Your question opens straight away when the learner reaches that moment." : "On a library film your question opens straight away and does not change the original."}</p>}
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
  const { payload, user, portal, base, query } = ctx
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const body = await CourseEditorBody({ payload, user, portal, editorHref: `${base}/admin/content/${courseId}`, courseId, part: query.part, filmsPage: query.films })
  if (!body) redirect(`${base}/admin/content?error=${encodeURIComponent('That course is not in this portal.')}`)
  return (
    <AdminFrame ctx={ctx} active="content" title={str(course.title)} intro={<Link href={`${base}/admin/content`}>{ctx.user.role === 'teacher' ? '‹ All talks' : '‹ All courses'}</Link>} testId="admin-course">
      {body}
    </AdminFrame>
  )
}

export async function LibraryScreen(ctx: Ctx) {
  guardAdmin(ctx)
  const { payload, portal, base } = ctx
  const showingShort = ctx.query.show === 'too-short'
  const [courseDocs, adoptions, adoptedIds, openers, shortTalks] = await Promise.all([
    listDocs(payload, 'courses', { origin: { equals: 'master' } }),
    rows(payload, 'adoptions', { portal: { equals: portal.id } }),
    adoptedCourseIds(payload, portal.id),
    openedByLines(payload),
    listShortTalks(payload),
  ])
  const courses = [...courseDocs].sort((a, b) => str(a.title).localeCompare(str(b.title)))
  const catalogue = courses.map((course) => ({ id: course.id, title: str(course.title), summary: str(course.summary) }))
  const grouped = await groupThese(payload, catalogue)
  const linkedCourse = (id: number) => adoptions.find((row) => row.kind === 'course' && ref(row.course) === id)
  const here = `${base}/admin/library`
  return (
    <AdminFrame ctx={ctx} active="library" title="Library" intro="Courses from the main HEARTS library. Each course says which codes and portals can open it." testId="admin-library">
      <TooShortFilter base={here} count={shortTalks.length} active={showingShort} />
      {showingShort ? <TooShortTable talks={shortTalks} next={`${here}?show=too-short`} canRestore={false} /> : null}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 1fr)', alignItems: 'start' }}>
        <section className="panel">
          <header><h2>Library courses</h2></header>
          <DeleteMany kind="adoption" next={here} portalSlug={portal.slug} formId="bulk-adoption" />
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Course</th><th>Who can open it</th><th>Speaker</th><th>In this portal</th><th /></tr></thead>
              <tbody>
                {courses.map((course) => {
                  const direct = linkedCourse(course.id)
                  const linked = adoptedIds.includes(course.id)
                  return (
                    <tr key={course.id} data-testid="library-course" data-door={primaryDoorCode(grouped, course.id)}>
                      <td>
                        <b>{str(course.title)}</b>
                        {course.summary ? <div className="hint">{str(course.summary).slice(0, 140)}</div> : null}
                        {course.hidden && course.hiddenNote ? <div className="hint" data-testid="course-hidden-note">{str(course.hiddenNote)}</div> : null}
                        {direct ? <DeletePick formId="bulk-adoption" id={direct.id} label={str(course.title)} /> : null}
                      </td>
                      <td><span className="opened-by" data-testid="opened-by">{openers.get(course.id) || 'No code or portal opens this yet.'}</span></td>
                      <td>{str(course.speaker)}</td>
                      <td>{direct || linked ? <span className="badge teal">In this portal</span> : <span className="badge grey">Not added yet</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {direct ? (
                          <DeleteInline kind="adoption" id={direct.id} next={here} portalSlug={portal.slug} testId="remove-link" label="Remove from this portal" />
                        ) : !linked && course.importable !== false ? (
                          <form action="/api/hearts" method="post">
                            <Hidden fields={{ action: 'adopt', kind: 'course', course: course.id, portalSlug: portal.slug, next: here }} />
                            <button className="btn small" data-testid="adopt-course" type="submit">Add this course (stays in sync)</button>
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
        <section className="panel">
          <header><div><h2>Add a shared course</h2><p>For a course someone has sent you a code for</p></div></header>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'import-token', portalSlug: portal.slug, next: here }} />
            <label className="stack">Share code<input type="text" data-testid="import-token" name="token" required /></label>
            <div className="actions"><button className="btn ink small" type="submit">Add it here</button></div>
          </form>
        </section>
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

function idsOf(value: unknown) {
  return ((value as unknown[]) || []).map((item) => ref(item)).filter((id): id is number => Boolean(id))
}

function courseLine(titles: string[]) {
  if (!titles.length) return 'No courses yet'
  const shown = titles.slice(0, 3)
  const more = titles.length - shown.length
  return more > 0 ? `${shown.join(', ')}, and ${more} more` : shown.join(', ')
}

export async function AccessScreen(ctx: Ctx) {
  guardAdmin(ctx)
  const { payload, portal, base, origin } = ctx
  const [codes, packs, people, library, localCourses] = await Promise.all([
    rows(payload, 'access-codes', { portal: { equals: portal.id } }, { sort: 'code' }),
    rows(payload, 'packs', undefined, { sort: 'title', limit: 200 }),
    portalPeople(payload, portal.id),
    loadLibraryPicker(payload),
    rows(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] }, { sort: 'title' }),
  ])
  const packList: PackCourses[] = packs.map((pack) => ({ id: pack.id, title: str(pack.title), courses: idsOf(pack.courses) }))
  const openedFor = (code: Row) => coursesOpenedByCode({ courses: idsOf(code.courses), packs: idsOf(code.packs) }, packList)
  const titleById = new Map<number, string>([...library.map((course) => [course.id, course.title] as const), ...localCourses.map((course) => [course.id, str(course.title)] as const)])
  const missing = [...new Set(codes.flatMap((code) => openedFor(code)))].filter((id) => !titleById.has(id))
  if (missing.length) {
    const named = await rows(payload, 'courses', { id: { in: missing } }, { limit: missing.length })
    for (const course of named) titleById.set(course.id, str(course.title))
  }
  const teachers = codes.filter((code) => code.role === 'teacher')
  const here = `${base}/admin/access`
  const usable = packs.filter((pack) => pack.owner === 'master' || ref(pack.portal) === portal.id)
  const packCount = (pack: Row) => ((pack.courses as unknown[]) || []).length
  const everything = [...usable].sort((a, b) => packCount(b) - packCount(a) || str(a.title).localeCompare(str(b.title)))[0]
  const teacherOptions = teachers.map((code) => {
    const person = people.find((row) => row.role === 'teacher' && ref(row.accessCode) === code.id)
    return { id: code.id, name: str(person?.name) || str(code.label) || str(code.code) }
  })
  const freshCode = codes.find((code) => str(code.code) === String(ctx.query.fresh || ''))
  const freshShare = freshCode ? `${origin}/join?code=${encodeURIComponent(str(freshCode.code))}` : ''
  const roleBadge: Record<string, string> = { admin: 'ink', teacher: 'purple', learner: 'teal', parent: 'gold' }
  const libraryIds = new Set(library.map((course) => course.id))
  const requiredGroups = await groupThese(payload, [...library.map((course) => ({ id: course.id, title: course.title, summary: '' })), ...localCourses.map((course) => ({ id: course.id, title: str(course.title), summary: str(course.summary) }))])
  return (
    <AdminFrame ctx={ctx} active="access" title="Access codes" intro="A code says who someone is in the portal and which library courses they can open. Send the link rather than the code, so nobody has to type it." testId="admin-access" showOnPhone>
      <section className="panel" style={{ marginBottom: 18 }} data-testid="quick-links">
        <header><div><h2>A link for someone new</h2><p>One tap makes a join link. The full address, Copy, WhatsApp and the QR appear on the row.</p></div></header>
        <div className="body actions" style={{ justifyContent: 'flex-start' }}>
          {(['teacher', 'learner', 'admin'] as const).map((role) => (
            <form key={role} action="/api/hearts" method="post">
              <Hidden fields={{ action: 'quick-join-link', portalSlug: portal.slug, role, next: here }} />
              <button className="btn ink" type="submit" data-testid={`quick-link-${role}`}>New {role} link</button>
            </form>
          ))}
        </div>
      </section>
      <section className="panel" style={{ marginBottom: 18 }}>
        <DeleteMany kind="code" next={here} portalSlug={portal.slug} formId="bulk-code" />
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>For</th><th>Courses</th><th>Teacher code</th><th className="num">Joined</th><th>Works</th><th>Link to send</th><th>QR</th><th>Change</th></tr></thead>
            <tbody>
              {codes.map((code) => {
                const share = `${origin}/join?code=${encodeURIComponent(str(code.code))}`
                const opened = openedFor(code)
                const titles = opened.map((id) => titleById.get(id) || 'A course')
                const selected = opened.filter((id) => libraryIds.has(id))
                return (
                  <tr key={code.id} data-testid="code-card">
                    <td><div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }} data-testid="code-value-cell">{str(code.code)}</div>{str(code.label) ? <div className="hint">{str(code.label)}</div> : null}</td>
                    <td><span className={`badge ${roleBadge[str(code.role)] || 'grey'}`}>{str(code.role)[0]?.toUpperCase() + str(code.role).slice(1)}</span></td>
                    <td>{courseLine(titles)}</td>
                    <td>{str(teachers.find((row) => row.id === ref(code.linkedTeacherCode))?.code) || <span className="hint">None</span>}</td>
                    <td className="num"><CodeJoins people={people.filter((person) => ref(person.accessCode) === code.id)} /></td>
                    <td><CodeStatus code={code} next={here} portalSlug={portal.slug} /></td>
                    <td>
                      <div className="address" style={{ fontSize: 12 }} data-testid="share-url">{share}</div>
                      <ShareLinks value={share} testId="code-copy" />
                    </td>
                    <td><div style={{ width: 84 }} className="qr-small"><Qr value={share} testId="code-qr" /></div></td>
                    <td>
                      <CodeCourseEditor courses={library} selected={selected} portalSlug={portal.slug} codeId={code.id} next={here} />
                      <DeletePick formId="bulk-code" id={code.id} label={str(code.code)} />
                      <DeleteInline kind="code" id={code.id} next={here} portalSlug={portal.slug} testId={`delete-code-${code.id}`} />
                    </td>
                  </tr>
                )
              })}
              {!codes.length ? <tr><td colSpan={9} className="empty">No codes yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      {freshShare ? (
        <section className="panel" data-testid="fresh-code" style={{ marginBottom: 18 }}>
          <header><div><h2>Your new link</h2><p>Send this. Nobody has to type the code.</p></div></header>
          <div className="body" style={{ display: 'grid', gap: 12 }}>
            <div className="address" data-testid="fresh-url" style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset' }}>{freshShare}</div>
            <ShareLinks value={freshShare} testId="fresh-copy" />
            <Qr value={freshShare} testId="fresh-qr" />
          </div>
        </section>
      ) : null}
      <div className="actions" style={{ marginBottom: 18 }}>
        {everything ? (
          <>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-code', quick: 'yes', role: 'teacher', pack: everything.id, portalSlug: portal.slug, next: here }} />
              <button className="btn teal" type="submit" data-testid="quick-teacher">New teacher link</button>
            </form>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-code', quick: 'yes', role: 'learner', pack: everything.id, linkedTeacherCode: teacherOptions[0]?.id || '', portalSlug: portal.slug, next: here }} />
              <button className="btn teal" type="submit" data-testid="quick-learner">New learner link</button>
            </form>
            <form action="/api/hearts" method="post">
              <Hidden fields={{ action: 'create-code', quick: 'yes', role: 'admin', pack: everything.id, portalSlug: portal.slug, next: here }} />
              <button className="btn teal" type="submit" data-testid="quick-admin">New admin link</button>
            </form>
          </>
        ) : null}
      </div>
      <div className="grid two" style={{ alignItems: 'start' }}>
        <details className="panel" id="new-code" open data-testid="custom-code">
          <summary><h2 style={{ display: 'inline' }}>Custom code…</h2></summary>
          <p className="hint" style={{ margin: '12px 16px 0' }}>Learner and parent codes need a teacher code, so someone sees their progress</p>
          <form className="body form" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'create-code', portalSlug: portal.slug, next: here }} />
            <div className="cols">
              <label className="stack">Code<input type="text" data-testid="new-code" name="code" placeholder="Leave empty for a random code" /></label>
              <label className="stack">Label<input type="text" data-testid="new-code-label" name="label" placeholder="A name you will recognise" /></label>
            </div>
            <div className="cols">
              <label className="stack">For
                <select data-testid="new-code-role" name="role" defaultValue="learner">
                  <option value="learner">Learner</option><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="parent">Parent (one course)</option>
                </select>
              </label>
              <label className="stack">Teacher code
                <select data-testid="new-code-teacher" name="linkedTeacherCode">
                  <option value="">None</option>
                  {teachers.map((code) => <option key={code.id} value={code.id}>{str(code.label) || str(code.code)}</option>)}
                </select>
              </label>
            </div>
            <LibraryCoursePicker courses={library} testId="new-code-courses" />
            <CodeLimits />
            {requiredGroups.length ? (
              <div data-testid="required-courses">
                <div className="hint" style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>Courses everyone on this code is asked to finish (optional) <HelpTip topic="required">{TOOL.requiredCourses}</HelpTip></div>
                <CourseTree groups={requiredGroups} name="requiredCourse" testId="required-tree" courseTestId="required-course" />
              </div>
            ) : null}
            <p className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Limits and a teacher code <HelpTip topic="code-limits">{TOOL.codeLimits}</HelpTip><HelpTip topic="teacher-code">{TOOL.teacherCode}</HelpTip></p>
            <div className="actions"><button className="btn ink" data-testid="new-code-submit" type="submit">Create access code</button></div>
          </form>
        </details>
      </div>
    </AdminFrame>
  )
}
