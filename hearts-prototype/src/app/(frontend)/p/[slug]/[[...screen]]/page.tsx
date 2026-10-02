import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { AdminNav, Banner, LearnerNav, Logout, Phone, Principle } from '@/components/chrome'
import { CutCard } from '@/components/cuts'
import { FilmPlayer, PreviewClock, type PointView } from '@/components/player'
import { Qr } from '@/components/qr'
import { now } from '@/lib/clock'
import { idOf, portalIdOf } from '@/lib/ids'
import { delayToMs, unlockState } from '@/lib/unlock'
import { adoptedCourseIds, loadPortal, requirePortal, visibleCourseIds, type PortalDoc, type SessionUser } from '@/server/context'

type Query = { error?: string; notice?: string; step?: string }

function originOf(reqHeaders: Headers) {
  const host = reqHeaders.get('x-forwarded-host') || reqHeaders.get('host') || 'localhost:3000'
  const proto = reqHeaders.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

function canSeePoint(point: { audience?: string | null; author?: unknown; audienceUsers?: unknown[] }, userId: number) {
  const audience = point.audience || 'everyone'
  if (audience === 'everyone') return true
  if (idOf(point.author) === userId) return true
  if (audience === 'self') return false
  return (point.audienceUsers || []).some((item) => idOf(item) === userId)
}

export default async function PortalScreen({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; screen?: string[] }>
  searchParams: Promise<Query>
}) {
  const { slug, screen = [] } = await params
  const query = await searchParams
  const { payload, user, portal } = await requirePortal(slug)
  const [area, id, extra] = screen
  const base = `/p/${slug}`
  const origin = originOf(await headers())

  if (portal.closed && user.role === 'learner') {
    return (
      <Phone>
        <h1>{portal.organisationName || portal.name}</h1>
        <p data-testid="portal-closed">This portal is deactivated. The master desk can open it again.</p>
      </Phone>
    )
  }

  if (area === 'admin') {
    if (user.role === 'learner') redirect(`${base}/feed?error=That room is for the portal team.`)
    return (
      <Phone>
        <div className="topbar"><Link className="mark" href={base}><span className="hearts">♥</span> {portal.name}</Link><Logout /></div>
        <AdminNav slug={slug} />
        <Banner error={query.error} notice={query.notice} />
        {portal.closed ? <p className="error" data-testid="portal-closed">This portal is deactivated for learners.</p> : null}
        {id === 'courses' && extra ? await courseScreen(payload, user, portal, base, Number(extra)) : null}
        {id === 'courses' && !extra ? await coursesScreen(payload, portal, base) : null}
        {id === 'adopt' ? await adoptScreen(payload, portal, base) : null}
        {id === 'codes' ? await codesScreen(payload, portal, base, origin) : null}
        {id === 'teach' ? await teachScreen(payload, user, portal, base) : null}
        {id === 'settings' ? await settingsScreen(portal, base) : null}
        {id === 'wizard' ? await wizardScreen(portal, base, query.step) : null}
        {!id ? await overviewScreen(payload, user, portal, base, origin) : null}
      </Phone>
    )
  }

  return (
    <Phone>
      <div className="topbar"><Link className="mark" href={base}><span className="hearts">♥</span> {portal.name}</Link><Logout /></div>
      <LearnerNav slug={slug} />
      <Banner error={query.error} notice={query.notice} />
      {area === 'watch' && id ? await watchScreen(payload, user, portal, base, Number(id)) : null}
      {area === 'about' || (!area && !user.onboarded) ? await aboutScreen(payload, user, portal, base) : null}
      {area === 'feed' || (!area && user.onboarded) ? await feedScreen(payload, user, portal, base) : null}
      {area === 'path' ? await pathScreen(payload, user, portal, base) : null}
      {area === 'grow' ? await growScreen(payload, user, portal, base) : null}
      {area === 'chapter' ? await chapterScreen(payload, portal, base) : null}
      {area === 'night' ? await nightScreen(payload, user, portal, base) : null}
      {area === 'schedule' ? await scheduleScreen(payload, user, portal, base) : null}
      {area && !['watch', 'about', 'feed', 'path', 'grow', 'chapter', 'night', 'schedule', 'admin'].includes(area) ? notFound() : null}
    </Phone>
  )
}

async function overviewScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string, origin: string) {
  const address = `${origin}${base}`
  const localCourses = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] },
  })
  const courseIds = localCourses.docs.map((doc) => doc.id)
  const units = courseIds.length
    ? await payload.count({ collection: 'units', overrideAccess: true, where: { course: { in: courseIds } } })
    : { totalDocs: 0 }
  const lessons = courseIds.length
    ? await payload.count({ collection: 'lessons', overrideAccess: true, where: { course: { in: courseIds } } })
    : { totalDocs: 0 }
  const lessonDocs = courseIds.length
    ? await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 400, where: { course: { in: courseIds } } })
    : { docs: [] }
  const lessonIds = lessonDocs.docs.map((doc) => doc.id)
  const resources = lessonIds.length
    ? await payload.count({ collection: 'resources', overrideAccess: true, where: { lesson: { in: lessonIds } } })
    : { totalDocs: 0 }
  const codes = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 200, where: { portal: { equals: portal.id } } })
  const countRole = (role: string) => codes.docs.filter((doc) => (doc as { role?: string }).role === role).length
  const people = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 300 })
  const members = people.docs.filter((doc) => portalIdOf(doc as SessionUser) === portal.id)
  const since = new Date(Date.now() - 13 * 86_400_000)
  const activity = await payload.find({
    collection: 'completions',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    where: { portal: { equals: portal.id } },
  })
  const bars = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(since.getTime() + index * 86_400_000).toISOString().slice(0, 10)
    return activity.docs.filter((doc) => String((doc as { createdAt?: string }).createdAt || '').slice(0, 10) === day).length
  })
  const max = Math.max(1, ...bars)
  return (
    <div data-testid="admin-overview">
      <Principle label="Portal" text="A house with its own door, its own people, and its own courses." why="Imported films stay in the library. What you count here is what this house made." />
      {!portal.wizardDone ? <p><Link href={`${base}/admin/wizard`}>Finish the short setup</Link></p> : null}
      <section className="card">
        <div className="stat">
          <h1 data-testid="org-name">{portal.organisationName || portal.name}</h1>
          {user.role === 'master' ? (
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="deactivate" />
              <input type="hidden" name="portalSlug" value={portal.slug} />
              <input type="hidden" name="closed" value={portal.closed ? 'no' : 'yes'} />
              <input type="hidden" name="next" value={`${base}/admin`} />
              <button className="quiet" data-testid="deactivate" type="submit">{portal.closed ? 'Activate' : 'Deactivate'}</button>
            </form>
          ) : <span className="meta">{portal.closed ? 'Deactivated' : 'Active'}</span>}
        </div>
        <p className="meta">{portal.closed ? 'Deactivated' : 'Active'}</p>
      </section>
      <section className="card">
        <h2>Portal settings</h2>
        <p>You have a door, a mark, and a way to send people here.</p>
        <p>Portal address</p>
        <p data-testid="portal-address">{address}</p>
        <p><Link href={base}>Go</Link></p>
        {portal.logoUrl ? <img className="logo" alt="" src={portal.logoUrl} /> : <p className="meta">No logo yet.</p>}
        <Qr value={address} testId="portal-qr" />
        <p><a data-testid="share-email" href={`mailto:?subject=${encodeURIComponent(portal.name)}&body=${encodeURIComponent(address)}`}>E-mail to share</a></p>
        <p><Link href={`${base}/admin/settings`}>Portal settings</Link></p>
      </section>
      <section className="card">
        <div className="stat"><span>Active user accounts</span><b data-testid="active-users">{members.length}</b></div>
      </section>
      <section className="card" data-testid="own-content">
        <h2>Content</h2>
        <p className="meta">Counts leave out imported courses.</p>
        <p>Course <b data-testid="own-courses">{localCourses.totalDocs}</b></p>
        <p>Topic <b data-testid="own-topics">{units.totalDocs}</b></p>
        <p>Video <b data-testid="own-videos">{lessons.totalDocs}</b></p>
        <p>Resource <b data-testid="own-resources">{resources.totalDocs}</b></p>
        <p><Link href={`${base}/admin/courses`}>Content settings</Link></p>
      </section>
      <section className="card" data-testid="code-counts">
        <h2>Access</h2>
        <p>Admin code <b data-testid="count-admin">{countRole('admin')}</b></p>
        <p>Teacher code <b data-testid="count-teacher">{countRole('teacher')}</b></p>
        <p>Learner code <b data-testid="count-learner">{countRole('learner')}</b></p>
        <p>Parent code <b data-testid="count-parent">{countRole('parent')}</b></p>
        <p><Link href={`${base}/admin/codes`}>Access settings</Link></p>
      </section>
      <section className="card">
        <h2>Activity · 14 days</h2>
        <div className="bars14" data-testid="activity">{bars.map((value, index) => <span key={index} style={{ height: `${Math.max(8, (value / max) * 100)}%` }} title={`${value}`} />)}</div>
      </section>
    </div>
  )
}

async function coursesScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], portal: PortalDoc, base: string) {
  const local = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 100,
    where: { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] },
  })
  const adoptedIds = await adoptedCourseIds(payload, portal.id)
  const adopted = adoptedIds.length
    ? await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 100, where: { id: { in: adoptedIds } } })
    : { docs: [] }
  const adoptions = await payload.find({ collection: 'adoptions', overrideAccess: true, depth: 0, limit: 100, where: { portal: { equals: portal.id } } })
  const packs = await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 50, where: { portal: { equals: portal.id } } })
  return (
    <div>
      <h1>Courses</h1>
      <Principle label="Yours and borrowed" text="What you made, you can change. What you linked, you can only view or let go." why="A library film stays intact for every house that linked it." />
      <h2>This portal</h2>
      <ul>
        {local.docs.map((course) => (
          <li key={course.id} data-testid="course-row" data-origin="local">
            <Link href={`${base}/admin/courses/${course.id}`}>{(course as { title?: string }).title}</Link>
            <span className="meta"> view, edit, delete</span>
          </li>
        ))}
      </ul>
      <h2>Linked from the library</h2>
      <ul>
        {adopted.docs.map((course) => {
          const link = adoptions.docs.find((doc) => idOf((doc as { course?: unknown }).course) === course.id || (doc as { kind?: string }).kind === 'pack')
          return (
            <li key={course.id} data-testid="course-row" data-origin="imported">
              <span className="readonly">Imported</span>{' '}
              <Link href={`${base}/admin/courses/${course.id}`}>{(course as { title?: string }).title}</Link>
              <span className="meta"> view or remove</span>
              {link && (link as { kind?: string }).kind === 'course' ? (
                <form action="/api/hearts" method="post">
                  <input type="hidden" name="action" value="remove-adoption" />
                  <input type="hidden" name="portalSlug" value={portal.slug} />
                  <input type="hidden" name="adoption" value={link.id} />
                  <input type="hidden" name="next" value={`${base}/admin/courses`} />
                  <button className="quiet" data-testid="remove-link" type="submit">Remove link</button>
                </form>
              ) : null}
            </li>
          )
        })}
      </ul>
      <h2>New course</h2>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-course" />
        <input type="hidden" name="origin" value="local" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/courses`} />
        <label>Title<input data-testid="local-course-title" name="title" /></label>
        <label>First lesson<input name="lesson" placeholder="Same as the course if you leave this" /></label>
        <label>Length in seconds<input data-testid="local-course-duration" name="duration" type="number" defaultValue={8} /></label>
        <label>Speaker<input name="speaker" /></label>
        <label>Add it to a pack
          <select data-testid="local-course-pack" name="pack">
            <option value="">Not yet</option>
            {packs.docs.map((pack) => <option key={pack.id} value={pack.id}>{(pack as { title?: string }).title}</option>)}
          </select>
        </label>
        <button data-testid="local-course-submit" type="submit">Save course</button>
      </form>
    </div>
  )
}

async function courseScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string, courseId: number) {
  const course = await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!course) notFound()
  const doc = course as { id: number; title?: string; origin?: string; portal?: unknown; speaker?: string; importable?: boolean }
  const adopted = await adoptedCourseIds(payload, portal.id)
  const localHere = doc.origin === 'local' && idOf(doc.portal) === portal.id
  const linked = doc.origin === 'master' && adopted.includes(doc.id)
  if (!localHere && !linked && user.role !== 'master') redirect(`${base}/admin/courses?error=That course is not in this portal.`)
  const locked = doc.origin === 'master' && user.role !== 'master'
  const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 100, where: { course: { equals: courseId } }, sort: 'order' })
  const lesson = lessons.docs[0] as { id: number; title?: string; transcript?: string; youtubeId?: string; transcriptNote?: string; durationSeconds?: number } | undefined
  const cuts = lesson
    ? await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 30, where: { lesson: { equals: lesson.id } } })
    : { docs: [] }
  const points = lesson
    ? await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 40, where: { lesson: { equals: lesson.id } }, sort: 'second' })
    : { docs: [] }
  const learners = (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 200 })).docs.filter((person) => portalIdOf(person as SessionUser) === portal.id && (person as { role?: string }).role === 'learner')
  return (
    <div data-testid="course-detail" data-locked={locked ? 'yes' : 'no'}>
      <p><Link href={`${base}/admin/courses`}>Courses</Link></p>
      <h1>{doc.title}</h1>
      {locked ? <p className="readonly" data-testid="readonly">Read only. View it, remove the link, or add a question on top. The original stays as it is.</p> : <p className="meta">Your course. You can edit the name, the film, and the questions.</p>}
      <p className="meta" data-testid="course-link">{addressLine(portal, base, doc.title)}</p>
      {!locked ? (
        <form className="stack" action="/api/hearts" method="post">
          <input type="hidden" name="action" value="rename-course" />
          <input type="hidden" name="course" value={doc.id} />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
          <label>Name<input name="title" defaultValue={doc.title || ''} /></label>
          <label><input type="checkbox" name="importable" defaultChecked={Boolean(doc.importable)} /> Importable, so another portal can link it later</label>
          <button type="submit">Save name</button>
        </form>
      ) : null}
      <h2>Film</h2>
      {lesson ? (
        <div data-testid="lesson-row">
          <p>{lesson.title}</p>
          {lesson.youtubeId ? <p className="meta">YouTube {lesson.youtubeId}</p> : null}
          {lesson.transcriptNote ? <p className="meta" data-testid="transcript-note">{lesson.transcriptNote}</p> : null}
          {lesson.transcript ? <p data-testid="has-transcript">Transcript is here.</p> : <p>No transcript yet.</p>}
          {!locked ? (
            <>
              <form className="stack" action="/api/hearts" method="post">
                <input type="hidden" name="action" value="ingest" />
                <input type="hidden" name="lesson" value={lesson.id} />
                <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
                <label>YouTube or share link<input data-testid="youtube-url" name="url" placeholder="https://www.youtube.com/watch?v=" /></label>
                <button data-testid="ingest-submit" type="submit">Fetch film</button>
              </form>
              <form className="stack" action="/api/hearts" method="post" encType="multipart/form-data">
                <input type="hidden" name="action" value="upload-transcript" />
                <input type="hidden" name="lesson" value={lesson.id} />
                <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
                <label>Transcript .vtt, .srt or .txt<input data-testid="transcript-file" type="file" name="file" accept=".vtt,.srt,.txt,.md,text/plain" /></label>
                <button data-testid="transcript-submit" type="submit">Upload transcript</button>
              </form>
              <form action="/api/hearts" method="post">
                <input type="hidden" name="action" value="extract" />
                <input type="hidden" name="lesson" value={lesson.id} />
                <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
                <button data-testid="extract-submit" type="submit">Run the extractor</button>
              </form>
              <form className="stack" action="/api/hearts" method="post">
                <input type="hidden" name="action" value="add-lesson" />
                <input type="hidden" name="course" value={doc.id} />
                <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
                <label>Another lesson<input name="title" /></label>
                <button type="submit">Add lesson</button>
              </form>
            </>
          ) : null}
          <h2>Cuts</h2>
          {cuts.docs.map((cut) => {
            const row = cut as { id: number; status?: string; hook?: string; turn?: string; land?: string; bestClause?: number }
            return (
              <article className="card" key={row.id} data-testid="cut-draft">
                <p className="meta">{row.status} · clause {row.bestClause || '—'}</p>
                <p>{row.land}</p>
                {!locked ? (
                  <form action="/api/hearts" method="post">
                    <input type="hidden" name="action" value="cut-status" />
                    <input type="hidden" name="cut" value={row.id} />
                    <input type="hidden" name="confirm" value="yes" />
                    <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
                    <input type="hidden" name="hook" value={row.hook || ''} />
                    <input type="hidden" name="turn" value={row.turn || ''} />
                    <input type="hidden" name="land" value={row.land || ''} />
                    <button name="status" value="approved" data-testid="approve-cut" type="submit">Approve</button>
                    <button className="quiet" name="status" value="rejected" type="submit">Reject</button>
                  </form>
                ) : null}
              </article>
            )
          })}
          <h2>Questions on this film</h2>
          <ul>{points.docs.map((point) => <li key={point.id} data-testid="point-row">{(point as { prompt?: string }).prompt} · {(point as { audience?: string }).audience || 'everyone'}</li>)}</ul>
          <form className="stack" action="/api/hearts" method="post">
            <input type="hidden" name="action" value="create-point" />
            <input type="hidden" name="lesson" value={lesson.id} />
            <input type="hidden" name="next" value={`${base}/admin/courses/${doc.id}`} />
            <PreviewClock />
            <label>Question<textarea data-testid="point-prompt" name="prompt" /></label>
            <label>Kind
              <select name="kind" defaultValue="reflection">
                <option value="reflection">Reflection</option>
                <option value="multiple_choice">Multiple choice</option>
                <option value="task">Task</option>
              </select>
            </label>
            <label>Choices, one per line<textarea name="options" placeholder="Only for multiple choice" /></label>
            {!locked ? (
              <>
                <label>When
                  <select data-testid="point-timing" name="timing" defaultValue="immediate">
                    <option value="immediate">Immediately</option>
                    <option value="future">Future</option>
                  </select>
                </label>
                <label>Delay amount<input data-testid="point-delay" name="delayAmount" type="number" defaultValue={2} /></label>
                <label>Delay unit
                  <select name="delayUnit" defaultValue="week">
                    <option value="second">Seconds</option>
                    <option value="minute">Minutes</option>
                    <option value="hour">Hours</option>
                    <option value="day">Days</option>
                    <option value="week">Weeks</option>
                  </select>
                </label>
                <label>Opens after this question is answered
                  <select data-testid="point-contingent" name="contingent">
                    <option value="">No contingent question</option>
                    {points.docs.map((point) => <option key={point.id} value={point.id}>{(point as { prompt?: string }).prompt}</option>)}
                  </select>
                </label>
              </>
            ) : <p className="meta">On a library film the question is immediate. It does not change the original.</p>}
            <label>Who sees it
              <select data-testid="point-audience" name="audience" defaultValue="everyone">
                <option value="everyone">Everyone on this video</option>
                <option value="self">Only me</option>
                <option value="selected">Selected learners</option>
              </select>
            </label>
            <div className="days">
              {learners.map((learner) => (
                <label key={learner.id}><input type="checkbox" name="learner" value={learner.id} /> {(learner as { name?: string }).name}</label>
              ))}
            </div>
            <button data-testid="point-submit" type="submit">Place question</button>
          </form>
        </div>
      ) : <p>No lesson yet.</p>}
    </div>
  )
}

function addressLine(portal: PortalDoc, base: string, title?: string) {
  const slug = (title || 'course').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${base}/${slug}`
}

async function adoptScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], portal: PortalDoc, base: string) {
  const packs = await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 50, where: { owner: { equals: 'master' } } })
  const courses = await payload.find({ collection: 'courses', overrideAccess: true, depth: 1, limit: 50, where: { origin: { equals: 'master' } } })
  return (
    <div>
      <h1>Link from the library</h1>
      <Principle label="A link, not a copy" text="When the library changes, this portal changes with it." why="People should not keep a stale copy of a living talk." />
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="import-token" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/adopt`} />
        <label>Import token<input data-testid="import-token" name="token" /></label>
        <button type="submit">Import subject</button>
      </form>
      <h2>Packs</h2>
      {packs.docs.map((pack) => (
        <form key={pack.id} action="/api/hearts" method="post">
          <input type="hidden" name="action" value="adopt" />
          <input type="hidden" name="kind" value="pack" />
          <input type="hidden" name="pack" value={pack.id} />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="next" value={`${base}/admin/adopt`} />
          <p>{(pack as { title?: string }).title}</p>
          <button data-testid="adopt-pack" type="submit">Link this pack</button>
        </form>
      ))}
      <h2>Courses</h2>
      {courses.docs.map((course) => (
        <form key={course.id} action="/api/hearts" method="post">
          <input type="hidden" name="action" value="adopt" />
          <input type="hidden" name="kind" value="course" />
          <input type="hidden" name="course" value={course.id} />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="next" value={`${base}/admin/courses`} />
          <p>{(course as { title?: string }).title}</p>
          <button data-testid="adopt-course" type="submit">Link this course</button>
        </form>
      ))}
      <h2>Split a pack</h2>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="split-pack" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/adopt`} />
        <label>New pack name<input name="title" /></label>
        {courses.docs.map((course) => (
          <label key={course.id}><input type="checkbox" name="course" value={course.id} /> {(course as { title?: string }).title}</label>
        ))}
        <button type="submit">Split</button>
      </form>
    </div>
  )
}

async function codesScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], portal: PortalDoc, base: string, origin: string) {
  const codes = await payload.find({ collection: 'access-codes', overrideAccess: true, depth: 0, limit: 100, where: { portal: { equals: portal.id } } })
  const packs = await payload.find({ collection: 'packs', overrideAccess: true, depth: 0, limit: 100 })
  const usable = packs.docs.filter((pack) => {
    const row = pack as { owner?: string; portal?: unknown }
    return row.owner === 'master' || idOf(row.portal) === portal.id
  })
  const teachers = codes.docs.filter((code) => (code as { role?: string }).role === 'teacher')
  return (
    <div>
      <h1>Access codes</h1>
      <Principle label="A code is a role and a pack" text="Send the link. People should not have to type the code." why="A typed code is easy to miss. A link opens the right door." />
      <p className="meta">Give teacher codes the wide pack. Keep learner codes small. Add more for one person from Teach.</p>
      {codes.docs.map((code) => {
        const row = code as { id: number; code?: string; role?: string }
        const share = `${origin}/join?code=${encodeURIComponent(row.code || '')}`
        return (
          <section className="card" key={row.id} data-testid="code-card">
            <h3>{row.code}</h3>
            <p className="meta">{row.role}</p>
            <p data-testid="share-url">{share}</p>
            <Qr value={share} />
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="update-code" />
              <input type="hidden" name="portalSlug" value={portal.slug} />
              <input type="hidden" name="codeId" value={row.id} />
              <input type="hidden" name="next" value={`${base}/admin/codes`} />
              <label>Pack
                <select name="pack">{usable.map((pack) => <option key={pack.id} value={pack.id}>{(pack as { title?: string }).title}</option>)}</select>
              </label>
              <label>For people who already joined
                <select name="apply" defaultValue="leave">
                  <option value="leave">Leave them as they are</option>
                  <option value="add">Add the new courses</option>
                  <option value="remove">Remove these courses</option>
                  <option value="overwrite">Replace their list</option>
                </select>
              </label>
              <button type="submit">Update code</button>
            </form>
          </section>
        )
      })}
      <h2>New code</h2>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-code" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/codes`} />
        <label>Code<input data-testid="new-code" name="code" /></label>
        <label>Role
          <select data-testid="new-code-role" name="role" defaultValue="learner">
            <option value="learner">Learner</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
            <option value="parent">Parent — one course</option>
          </select>
        </label>
        <label>Course pack
          <select data-testid="new-code-pack" name="pack">{usable.map((pack) => <option key={pack.id} value={pack.id}>{(pack as { title?: string }).title}</option>)}</select>
        </label>
        <label>Teacher code
          <select data-testid="new-code-teacher" name="linkedTeacherCode">
            <option value="">None</option>
            {teachers.map((code) => <option key={code.id} value={code.id}>{(code as { code?: string }).code}</option>)}
          </select>
        </label>
        <button data-testid="new-code-submit" type="submit">Create access code</button>
      </form>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="create-pack" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/codes`} />
        <label>New course pack<input data-testid="portal-pack-title" name="title" /></label>
        <button data-testid="portal-pack-submit" type="submit">Save pack</button>
      </form>
    </div>
  )
}

async function teachScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const people = (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 300 })).docs.filter((doc) => portalIdOf(doc as SessionUser) === portal.id)
  const learners = people.filter((doc) => (doc as { role?: string }).role === 'learner')
  const entries = await payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 1, limit: 100, where: { portal: { equals: portal.id } } })
  const answers = await payload.find({ collection: 'answers', overrideAccess: true, depth: 1, limit: 100, where: { portal: { equals: portal.id } } })
  const notes = await payload.find({ collection: 'feedback-notes', overrideAccess: true, depth: 0, limit: 100, where: { portal: { equals: portal.id } } })
  const completions = await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 400, where: { portal: { equals: portal.id } } })
  const watches = await payload.find({ collection: 'watch-sessions', overrideAccess: true, depth: 0, limit: 100, where: { portal: { equals: portal.id } } })
  const courses = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 100, where: { or: [{ portal: { equals: portal.id } }, { origin: { equals: 'master' } }] } })
  return (
    <div>
      <h1>Teach</h1>
      <Principle label={portal.teacherLabel || 'Teacher'} text="See who sat, reply in the workbook, and hand one person the next course." why="A grant should show up straight away, without making them sign in again." />
      <h2>Learners</h2>
      {learners.map((learner) => {
        const done = completions.docs.filter((row) => idOf((row as { user?: unknown }).user) === learner.id).length
        const onTime = completions.docs.filter((row) => idOf((row as { user?: unknown }).user) === learner.id && (row as { onTime?: boolean }).onTime).length
        return (
          <article className="card" key={learner.id} data-testid="learner-row">
            <h3>{(learner as { name?: string }).name}</h3>
            <p className="meta" data-testid="learner-progress">{done} sittings · {onTime} on time · {(learner as { audience?: string }).audience || 'learner'}</p>
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="grant" />
              <input type="hidden" name="learner" value={learner.id} />
              <input type="hidden" name="next" value={`${base}/admin/teach`} />
              <label>Grant a course
                <select name="course">{courses.docs.map((course) => <option key={course.id} value={course.id}>{(course as { title?: string }).title}</option>)}</select>
              </label>
              <button data-testid="grant-course" type="submit">Grant now</button>
            </form>
          </article>
        )
      })}
      <h2>Workbook</h2>
      {entries.docs.map((entry) => {
        const row = entry as { id: number; body?: string; consent?: boolean; teacherReply?: string; user?: { name?: string } }
        if (!row.consent && user.role === 'teacher') return <p key={row.id} className="meta">A private note stayed with its writer.</p>
        return (
          <article className="card" key={row.id} data-testid="workbook-review">
            <p>{row.user?.name}: {row.body}</p>
            {row.teacherReply ? <p data-testid="teacher-reply">Reply: {row.teacherReply}</p> : null}
            <form action="/api/hearts" method="post">
              <input type="hidden" name="action" value="reply" />
              <input type="hidden" name="entry" value={row.id} />
              <input type="hidden" name="href" value={`${base}/grow`} />
              <input type="hidden" name="next" value={`${base}/admin/teach`} />
              <label>Reply<textarea data-testid="reply-text" name="reply" /></label>
              <button data-testid="reply-submit" type="submit">Send reply</button>
            </form>
          </article>
        )
      })}
      <h2>Evidence</h2>
      {answers.docs.filter((answer) => (answer as { video?: unknown }).video).map((answer) => {
        const row = answer as { id: number; body?: string; video?: { url?: string } }
        const marks = notes.docs.filter((note) => idOf((note as { answer?: unknown }).answer) === row.id)
        return (
          <article className="card" key={row.id} data-testid="evidence">
            <p>{row.body}</p>
            {row.video?.url ? <video src={row.video.url} controls /> : <p className="meta">Video answer saved.</p>}
            <ul>{marks.map((mark) => <li key={mark.id} data-testid="feedback-mark">{(mark as { second?: number }).second}s · {(mark as { body?: string }).body}</li>)}</ul>
            <form action="/api/hearts" method="post" encType="multipart/form-data">
              <input type="hidden" name="action" value="feedback" />
              <input type="hidden" name="answer" value={row.id} />
              <input type="hidden" name="href" value={`${base}/grow`} />
              <input type="hidden" name="next" value={`${base}/admin/teach`} />
              <label>Timestamp in seconds<input data-testid="feedback-second" name="second" type="number" defaultValue={10} /></label>
              <label>Feedback<textarea data-testid="feedback-body" name="body" /></label>
              <label>Voice note<input type="file" name="audio" accept="audio/*" /></label>
              <button data-testid="feedback-submit" type="submit">Leave feedback</button>
            </form>
          </article>
        )
      })}
      <h2>Watch history</h2>
      {watches.docs.length ? watches.docs.map((row) => <p key={row.id} data-testid="watch-session">{(row as { seconds?: number }).seconds}s</p>) : <p className="meta">Nothing here unless a learner opts in.</p>}
    </div>
  )
}

async function settingsScreen(portal: PortalDoc, base: string) {
  return (
    <div>
      <h1>Portal settings</h1>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="settings" />
        <input type="hidden" name="settingsForm" value="yes" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="next" value={`${base}/admin/settings`} />
        <label>Organisation name<input name="organisationName" defaultValue={portal.organisationName || portal.name} /></label>
        <label>Welcome line<textarea name="welcome" defaultValue={portal.welcome || ''} /></label>
        <label>Logo URL<input name="logoUrl" defaultValue={portal.logoUrl || ''} /></label>
        <label>Linked calendar<input name="calendarUrl" defaultValue={portal.calendarUrl || ''} /></label>
        <label>Notification emails<input name="notificationEmails" defaultValue={portal.notificationEmails || ''} /></label>
        <label>Colour<input name="colour" defaultValue={portal.colour || '#1f4d3a'} /></label>
        <label>Theme
          <select name="theme" defaultValue={portal.theme || 'light'}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label>Learner label<input name="learnerLabel" defaultValue={portal.learnerLabel || 'Learner'} /></label>
        <label>Teacher label<input name="teacherLabel" defaultValue={portal.teacherLabel || 'Teacher'} /></label>
        <label>Learner welcome video<input data-testid="learner-welcome" name="learnerWelcomeUrl" defaultValue={portal.learnerWelcomeUrl || ''} /></label>
        <label>Learner intro video<input data-testid="learner-intro" name="learnerIntroUrl" defaultValue={portal.learnerIntroUrl || ''} /></label>
        <label>Teacher welcome video<input data-testid="teacher-welcome" name="teacherWelcomeUrl" defaultValue={portal.teacherWelcomeUrl || ''} /></label>
        <label>Teacher intro video<input data-testid="teacher-intro" name="teacherIntroUrl" defaultValue={portal.teacherIntroUrl || ''} /></label>
        <label><input type="checkbox" name="showOthersAnswers" defaultChecked={portal.showOthersAnswers !== false} /> Learners may see answers others chose to share</label>
        <label><input type="checkbox" name="watchHistoryOptIn" defaultChecked={Boolean(portal.watchHistoryOptIn)} /> Portal may ask for detailed watch history</label>
        <button data-testid="save-settings" type="submit">Save settings</button>
      </form>
      <p className="meta">Embed</p>
      <pre data-testid="embed">{`<script src="${base}/join" data-target="${base}" data-colour="${portal.colour || '#1f4d3a'}"></script>`}</pre>
    </div>
  )
}

async function wizardScreen(portal: PortalDoc, base: string, step?: string) {
  const current = step || '1'
  return (
    <div data-testid="wizard">
      <h1>Set up {portal.name}</h1>
      <p className="meta">Step {current} of 3</p>
      {current === '1' ? (
        <form className="stack" action="/api/hearts" method="post">
          <input type="hidden" name="action" value="settings" />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="organisationName" value={portal.name} />
          <input type="hidden" name="next" value={`${base}/admin/wizard?step=2`} />
          <label>A line of welcome<textarea data-testid="wizard-welcome" name="welcome" defaultValue={portal.welcome || ''} /></label>
          <button type="submit">Next</button>
        </form>
      ) : null}
      {current === '2' ? (
        <form className="stack" action="/api/hearts" method="post">
          <input type="hidden" name="action" value="create-course" />
          <input type="hidden" name="origin" value="local" />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="duration" value="8" />
          <input type="hidden" name="next" value={`${base}/admin/wizard?step=3`} />
          <label>First course<input data-testid="wizard-course" name="title" /></label>
          <button type="submit">Next</button>
        </form>
      ) : null}
      {current === '3' ? (
        <form className="stack" action="/api/hearts" method="post">
          <input type="hidden" name="action" value="settings" />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="wizardDone" value="on" />
          <input type="hidden" name="next" value={`${base}/admin`} />
          <p>The door is open. Make an access code when you are ready.</p>
          <button data-testid="wizard-finish" type="submit">Finish</button>
        </form>
      ) : null}
    </div>
  )
}

async function aboutScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const staff = user.role === 'teacher' || user.role === 'portal-admin'
  const welcome = staff ? portal.teacherWelcomeUrl : portal.learnerWelcomeUrl
  const intro = staff ? portal.teacherIntroUrl : portal.learnerIntroUrl
  if (!user.seenWelcome && (welcome || intro)) {
    return (
      <div data-testid="welcome-film">
        <h1>Welcome</h1>
        <p>{portal.welcome}</p>
        {welcome ? <iframe className="film" title="Welcome" src={embedUrl(welcome)} /> : null}
        {intro ? <iframe className="film" title="Intro" src={embedUrl(intro)} /> : null}
        <form action="/api/hearts" method="post">
          <input type="hidden" name="action" value="seen-welcome" />
          <input type="hidden" name="next" value={user.onboarded ? `${base}/feed` : `${base}/about`} />
          <button data-testid="welcome-continue" type="submit">Continue</button>
        </form>
      </div>
    )
  }
  if (user.onboarded && user.role !== 'learner') redirect(`${base}/admin`)
  const questions = await payload.find({ collection: 'placing-questions', overrideAccess: true, depth: 0, limit: 20, sort: 'order' })
  return (
    <div>
      <h1>Where to begin</h1>
      <Principle label="Placing" text="A few questions, only so the path can start somewhere kind." why="Nobody should be dropped into the middle of a book they have not met." />
      <p className="welcome-hearts" aria-hidden>♥ ♥ ♥</p>
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="placing" />
        <input type="hidden" name="next" value={`${base}/feed`} />
        {questions.docs.map((question) => {
          const row = question as { id: number; prompt?: string; why?: string; options?: string[] }
          return (
            <fieldset key={row.id} data-testid="placing-question">
              <legend>{row.prompt}</legend>
              <p className="why">{row.why}</p>
              {(row.options || []).map((option) => (
                <label key={option}><input type="radio" name={`q-${row.id}`} value={option} /> {option}</label>
              ))}
            </fieldset>
          )
        })}
        <button data-testid="placing-submit" type="submit">This is a fine place to begin</button>
      </form>
    </div>
  )
}

function embedUrl(value: string) {
  const match = value.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/)
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : value
}

async function feedScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  if (!user.onboarded && user.role === 'learner') redirect(`${base}/about`)
  const courseIds = await visibleCourseIds(payload, user)
  const lessons = courseIds.length
    ? await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 200, where: { course: { in: courseIds } } })
    : { docs: [] }
  const lessonIds = lessons.docs.map((doc) => doc.id)
  const cuts = lessonIds.length
    ? await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 40, where: { and: [{ lesson: { in: lessonIds } }, { status: { equals: 'approved' } }] } })
    : { docs: [] }
  return (
    <div>
      <h1>Feed</h1>
      <Principle label="A bite, then the meal" text="A short cut from a real talk. The full sitting is one tap away." why="The heart leans in before it agrees to stay." />
      {cuts.docs.length ? cuts.docs.map((cut) => {
        const row = cut as { id: number; hook?: string; turn?: string; land?: string; theme?: string; lesson?: unknown }
        const lessonId = idOf(row.lesson)
        return <CutCard key={row.id} hook={row.hook || ''} turn={row.turn || ''} land={row.land || ''} theme={row.theme} href={lessonId ? `${base}/watch/${lessonId}` : `${base}/path`} />
      }) : <p data-testid="feed-empty">Nothing approved for you yet. The path still has the full sittings.</p>}
    </div>
  )
}

async function pathScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const courseIds = await visibleCourseIds(payload, user)
  const courses = courseIds.length
    ? await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 100, where: { id: { in: courseIds } } })
    : { docs: [] }
  const codeId = idOf(user.accessCode)
  const code = codeId ? await payload.findByID({ collection: 'access-codes', id: codeId, overrideAccess: true, depth: 0 }) : null
  const required = new Set(((code as { requiredCourses?: unknown[] } | null)?.requiredCourses || []).map((item) => idOf(item)).filter((item): item is number => Boolean(item)))
  const lessons = courseIds.length
    ? await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 300, where: { course: { in: courseIds } }, sort: 'order' })
    : { docs: [] }
  return (
    <div>
      <h1>Path</h1>
      <p className="meta" data-testid="visible-courses">{courses.docs.length} course{courses.docs.length === 1 ? '' : 's'} open to you</p>
      {courses.docs.map((course) => (
        <section key={course.id} data-testid="path-course">
          <h2>{(course as { title?: string }).title} {required.has(course.id) ? <span data-testid="required-course">asked of you</span> : null}</h2>
          <ul>
            {lessons.docs.filter((lesson) => idOf((lesson as { course?: unknown }).course) === course.id).map((lesson) => (
              <li key={lesson.id}><Link data-testid="lesson-link" href={`${base}/watch/${lesson.id}`}>{(lesson as { title?: string }).title}</Link></li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

async function watchScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string, lessonId: number) {
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }).catch(() => null)
  if (!lesson) notFound()
  const courseId = idOf((lesson as { course?: unknown }).course)
  const allowed = await visibleCourseIds(payload, user)
  if (user.role === 'learner' && courseId && !allowed.includes(courseId)) redirect(`${base}/path?error=That sitting is not in your pack.`)
  const existingVisit = await payload.find({
    collection: 'lesson-visits',
    overrideAccess: true,
    limit: 1,
    where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] },
  })
  if (!existingVisit.docs.length) {
    await payload.create({ collection: 'lesson-visits', overrideAccess: true, data: { user: user.id, lesson: lessonId, portal: portal.id } })
  }
  const visit = existingVisit.docs[0] as { createdAt?: string } | undefined
  const seenAt = visit?.createdAt ? new Date(visit.createdAt) : now()
  const points = await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 40, where: { lesson: { equals: lessonId } }, sort: 'second' })
  const visible = points.docs.filter((point) => user.role !== 'learner' || canSeePoint(point as { audience?: string; author?: unknown; audienceUsers?: unknown[] }, user.id))
  const answers = await payload.find({ collection: 'answers', overrideAccess: true, depth: 1, limit: 200, where: { lesson: { equals: lessonId } } })
  const mine = answers.docs.filter((answer) => idOf((answer as { user?: unknown }).user) === user.id)
  const at = now()
  const views: PointView[] = visible.map((point) => {
    const row = point as { id: number; second?: number; prompt?: string; kind?: string; options?: string[]; timing?: string; delayAmount?: number; delayUnit?: string; contingent?: unknown; link?: string }
    const contingentId = idOf(row.contingent)
    const contingentAnswer = contingentId ? mine.find((answer) => idOf((answer as { point?: unknown }).point) === contingentId) : null
    const state = unlockState({
      timing: row.timing === 'future' ? 'future' : 'immediate',
      delayMs: delayToMs(row.delayAmount || 0, row.delayUnit || 'week'),
      hasContingent: Boolean(contingentId),
      contingentAnsweredAt: contingentAnswer ? new Date(String((contingentAnswer as { createdAt?: string }).createdAt || at.toISOString())) : null,
      seenAt,
      at,
    })
    const contingent = contingentId ? points.docs.find((item) => item.id === contingentId) : null
    return {
      id: row.id,
      second: row.second || 0,
      prompt: row.prompt || '',
      kind: row.kind || 'reflection',
      options: Array.isArray(row.options) ? row.options : [],
      state: state.state,
      unlocksAt: state.unlocksAt ? state.unlocksAt.toISOString() : null,
      contingentPrompt: (contingent as { prompt?: string } | undefined)?.prompt,
      answered: mine.some((answer) => idOf((answer as { point?: unknown }).point) === row.id),
      link: row.link,
    }
  })
  const showSwarm = portal.showOthersAnswers !== false
  const swarm: Record<number, { body: string; name: string }[]> = {}
  if (showSwarm) {
    for (const answer of answers.docs as { point?: unknown; body?: string; choice?: string; keepPrivate?: boolean; user?: { name?: string } }[]) {
      if (answer.keepPrivate) continue
      const pointId = idOf(answer.point)
      if (!pointId) continue
      swarm[pointId] = swarm[pointId] || []
      swarm[pointId].push({ body: answer.body || answer.choice || '', name: answer.user?.name || 'Someone' })
    }
  }
  const feedback = await payload.find({ collection: 'feedback-notes', overrideAccess: true, depth: 0, limit: 50 })
  const myAnswerIds = new Set(mine.map((answer) => answer.id))
  const marks = feedback.docs.filter((note) => myAnswerIds.has(idOf((note as { answer?: unknown }).answer) || 0))
  return (
    <div data-testid="player">
      <h1>{(lesson as { title?: string }).title}</h1>
      <FilmPlayer
        youtubeId={(lesson as { youtubeId?: string }).youtubeId}
        points={views}
        serverNow={at.toISOString()}
        lessonId={lessonId}
        next={`${base}/watch/${lessonId}`}
        swarm={swarm}
        duration={(lesson as { durationSeconds?: number }).durationSeconds || 0}
      />
      <ul>
        {views.map((point) => (
          <li key={point.id} data-testid="point-state" data-state={point.state}>
            <p>{point.prompt}</p>
            {point.state === 'waiting' ? <p data-testid="countdown">This opens after you answer “{point.contingentPrompt || 'the earlier question'}”.</p> : null}
            {point.state === 'countdown' && point.unlocksAt ? <p data-testid="countdown">Time to unlock: {point.unlocksAt}</p> : null}
            {point.state === 'open' && !point.answered ? (
              <form action="/api/hearts" method="post">
                <input type="hidden" name="action" value="answer" />
                <input type="hidden" name="point" value={point.id} />
                <input type="hidden" name="next" value={`${base}/watch/${lessonId}`} />
                <textarea name="body" data-testid="answer-text" />
                <label><input data-testid="answer-private" type="checkbox" name="keepPrivate" /> Keep this private from the circle</label>
                <label><input data-testid="answer-share" type="checkbox" name="shareWithTeacher" /> Share this with my teacher</label>
                <button type="submit" data-testid="answer-submit">Save</button>
              </form>
            ) : null}
            <div className="swarm" data-testid="swarm">
              {(swarm[point.id] || []).map((item, index) => <p key={index} data-testid="swarm-item">{item.name}: {item.body}</p>)}
            </div>
          </li>
        ))}
      </ul>
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="complete" />
        <input type="hidden" name="lesson" value={lessonId} />
        <input type="hidden" name="seconds" value={(lesson as { durationSeconds?: number }).durationSeconds || 0} />
        <input type="hidden" name="next" value={`${base}/watch/${lessonId}`} />
        <button type="submit" data-testid="complete-full">Count the full sitting</button>
      </form>
      {marks.length ? (
        <section data-testid="in-video-feedback">
          <h2>In-video feedback</h2>
          <ul>{marks.map((mark) => <li key={mark.id} data-testid="feedback-mark">{(mark as { second?: number }).second}s · {(mark as { body?: string }).body}</li>)}</ul>
        </section>
      ) : null}
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="clock" />
        <input type="hidden" name="next" value={`${base}/watch/${lessonId}`} />
        <label>Test clock<input data-testid="clock-iso" name="iso" placeholder="2026-12-01T00:00:00.000Z" /></label>
        <button data-testid="clock-submit" type="submit">Move the clock</button>
      </form>
    </div>
  )
}

async function growScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const clauses = await payload.find({ collection: 'clauses', overrideAccess: true, depth: 0, limit: 50, sort: 'number' })
  const completions = await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 200, where: { user: { equals: user.id } } })
  const doneLessons = new Set(completions.docs.map((row) => idOf((row as { lesson?: unknown }).lesson)).filter((id): id is number => Boolean(id)))
  const tags = await payload.find({ collection: 'tags', overrideAccess: true, depth: 0, limit: 200, where: { state: { equals: 'confirmed' } } })
  const cuts = tags.docs.length
    ? await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: tags.docs.map((tag) => idOf((tag as { item?: { value?: unknown } }).item?.value)).filter((id): id is number => Boolean(id)) } } })
    : { docs: [] }
  const lit = new Set<number>()
  for (const tag of tags.docs as { clause?: unknown; item?: { value?: unknown } }[]) {
    const cut = cuts.docs.find((row) => row.id === idOf(tag.item?.value))
    const lessonId = idOf((cut as { lesson?: unknown } | undefined)?.lesson)
    if (lessonId && doneLessons.has(lessonId)) {
      const clause = await payload.findByID({ collection: 'clauses', id: idOf(tag.clause) || 0, overrideAccess: true, depth: 0 }).catch(() => null)
      if (clause) lit.add((clause as { number?: number }).number || 0)
    }
  }
  const seats = await payload.find({ collection: 'seats', overrideAccess: true, depth: 0, limit: 200, sort: 'order' })
  const harvest = await payload.find({ collection: 'harvest-entries', overrideAccess: true, depth: 0, limit: 50, where: { user: { equals: user.id } } })
  const workbook = await payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 0, limit: 50, where: { user: { equals: user.id } } })
  const notes = await payload.find({ collection: 'notifications', overrideAccess: true, depth: 0, limit: 20, where: { user: { equals: user.id } } })
  const rituals = await payload.find({ collection: 'rituals', overrideAccess: true, depth: 0, limit: 20, where: { user: { equals: user.id } } })
  return (
    <div>
      <h1>Grow</h1>
      <Principle label="A map, not a score" text="Clauses light when you have actually sat with a talk that belongs there." why="A streak would flatter the counter. The book does not need that." />
      {notes.docs.filter((note) => !(note as { read?: boolean }).read).map((note) => (
        <p key={note.id} data-testid="notification"><Link href={(note as { href?: string }).href || `${base}/grow`}>{(note as { title?: string }).title}</Link> {(note as { body?: string }).body}</p>
      ))}
      <div className="grid" data-testid="clause-map">
        {clauses.docs.map((clause) => {
          const row = clause as { id: number; number?: number; fragment?: string }
          const on = lit.has(row.number || 0) || user.startingClause === row.number
          return <Link key={row.id} className={on ? 'cell on' : 'cell'} data-testid="clause-cell" data-lit={on ? 'yes' : 'no'} href={`${base}/grow#clause-${row.number}`} title={row.fragment}>{row.number}</Link>
        })}
      </div>
      <h2>Ghunya seats</h2>
      <ul>{seats.docs.slice(0, 12).map((seat) => <li key={seat.id} data-testid="seat">{(seat as { text?: string }).text}</li>)}</ul>
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="seat" />
        <input type="hidden" name="seat" value={seats.docs[0]?.id || ''} />
        <input type="hidden" name="next" value={`${base}/grow`} />
        <button type="submit">I opened a seat</button>
      </form>
      <h2>Harvest</h2>
      <ul data-testid="harvest">{harvest.docs.map((hit) => <li key={hit.id}>{(hit as { text?: string; reference?: string }).text} {(hit as { reference?: string }).reference}</li>)}</ul>
      <h2>Workbook</h2>
      <ul data-testid="workbook">{workbook.docs.map((entry) => <li key={entry.id}>{(entry as { body?: string }).body} {(entry as { consent?: boolean }).consent ? '' : '(private)'} {(entry as { teacherReply?: string }).teacherReply ? `— ${(entry as { teacherReply?: string }).teacherReply}` : ''}</li>)}</ul>
      <h2>A small act</h2>
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="ritual" />
        <input type="hidden" name="next" value={`${base}/grow`} />
        <label>What you held<input data-testid="ritual-note" name="note" defaultValue="I held back a harsh word." /></label>
        <button type="submit">Bank it</button>
      </form>
      <p data-testid="ritual-count">{rituals.totalDocs} banked. Not a streak.</p>
      <form action="/api/hearts" method="post">
        <input type="hidden" name="action" value="watch-opt-in" />
        <input type="hidden" name="next" value={`${base}/grow`} />
        <label><input data-testid="share-watch" type="checkbox" name="shareWatch" defaultChecked={Boolean(user.shareWatch)} /> Share detailed watch history with my teachers</label>
        <button type="submit">Save</button>
      </form>
    </div>
  )
}

async function chapterScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], portal: PortalDoc, base: string) {
  const messages = await payload.find({ collection: 'messages', overrideAccess: true, depth: 1, limit: 40, where: { portal: { equals: portal.id } }, sort: '-createdAt' })
  return (
    <div>
      <h1>Chapter</h1>
      <Principle label="The people in the room" text="A board for this portal only." why="A note from another house does not belong on this wall." />
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="board" />
        <input type="hidden" name="next" value={`${base}/chapter`} />
        <label>Note<textarea data-testid="board-body" name="body" /></label>
        <button data-testid="board-submit" type="submit">Post</button>
      </form>
      <ul>{messages.docs.map((message) => <li key={message.id} data-testid="board-note">{(message as { author?: { name?: string }; body?: string }).author?.name}: {(message as { body?: string }).body}</li>)}</ul>
    </div>
  )
}

async function nightScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const events = await payload.find({ collection: 'events', overrideAccess: true, depth: 0, limit: 20, where: { portal: { equals: portal.id } } })
  const rsvps = await payload.find({ collection: 'rsvps', overrideAccess: true, depth: 0, limit: 100, where: { portal: { equals: portal.id } } })
  return (
    <div>
      <h1>Night</h1>
      <Principle label="Off the screen" text="Come if you can. The soft check-in is a welcome, not a gate." why="A room that only exists online has not yet become a chapter." />
      {events.docs.map((event) => (
        <article className="card" key={event.id} data-testid="event">
          <h2>{(event as { title?: string }).title}</h2>
          <p>{(event as { place?: string }).place}</p>
          <form action="/api/hearts" method="post">
            <input type="hidden" name="action" value="rsvp" />
            <input type="hidden" name="event" value={event.id} />
            <input type="hidden" name="next" value={`${base}/night`} />
            <button data-testid="rsvp" type="submit">I&apos;ll come</button>
          </form>
          <form action="/api/hearts" method="post">
            <input type="hidden" name="action" value="checkin" />
            <input type="hidden" name="event" value={event.id} />
            <input type="hidden" name="next" value={`${base}/night`} />
            <button data-testid="checkin" type="submit">I&apos;m here</button>
          </form>
          <p className="meta">{rsvps.docs.filter((row) => idOf((row as { event?: unknown }).event) === event.id).length} coming</p>
        </article>
      ))}
      {user.role !== 'learner' ? (
        <form className="stack" action="/api/hearts" method="post">
          <input type="hidden" name="action" value="create-event" />
          <input type="hidden" name="portalSlug" value={portal.slug} />
          <input type="hidden" name="next" value={`${base}/night`} />
          <label>Night<input data-testid="event-title" name="title" /></label>
          <label>Place<input name="place" /></label>
          <button type="submit">Save night</button>
        </form>
      ) : null}
    </div>
  )
}

async function scheduleScreen(payload: Awaited<ReturnType<typeof requirePortal>>['payload'], user: SessionUser, portal: PortalDoc, base: string) {
  const courseIds = await visibleCourseIds(payload, user)
  const courses = courseIds.length
    ? await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 50, where: { id: { in: courseIds } } })
    : { docs: [] }
  const plans = await payload.find({ collection: 'schedules', overrideAccess: true, depth: 0, limit: 20, where: { portal: { equals: portal.id } } })
  const mine = plans.docs.filter((plan) => {
    const learners = ((plan as { learners?: unknown[] }).learners || []).map((item) => idOf(item))
    return idOf((plan as { owner?: unknown }).owner) === user.id || learners.includes(user.id) || user.role !== 'learner'
  })
  const learners = user.role === 'learner'
    ? []
    : (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 200 })).docs.filter((doc) => portalIdOf(doc as SessionUser) === portal.id && (doc as { role?: string }).role === 'learner')
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return (
    <div>
      <h1>Plan</h1>
      <Principle label="A guide, not a lock" text="Lessons are spread evenly across the days you chose, in the order of the course." why="An empty day at the end helps nobody, and a missed day should not shut the door." />
      <form className="stack" action="/api/hearts" method="post">
        <input type="hidden" name="action" value="schedule" />
        <input type="hidden" name="portalSlug" value={portal.slug} />
        <input type="hidden" name="targetType" value="course" />
        <input type="hidden" name="next" value={`${base}/schedule`} />
        <label>Name<input name="name" defaultValue="Study days" /></label>
        <label>Course
          <select data-testid="schedule-course" name="course">{courses.docs.map((course) => <option key={course.id} value={course.id}>{(course as { title?: string }).title}</option>)}</select>
        </label>
        <label>From<input data-testid="schedule-start" type="date" name="start" /></label>
        <label>Until<input data-testid="schedule-end" type="date" name="end" /></label>
        <div className="days">
          {days.map((label, index) => (
            <label key={label}><input data-testid={`weekday-${index}`} type="checkbox" name="weekday" value={index} /> {label}</label>
          ))}
        </div>
        {learners.map((learner) => (
          <label key={learner.id}><input type="checkbox" name="learner" value={learner.id} /> {(learner as { name?: string }).name}</label>
        ))}
        <button data-testid="schedule-submit" type="submit">Spread the sittings</button>
      </form>
      {mine.map((plan) => (
        <section key={plan.id} data-testid="schedule-plan">
          <h2>{(plan as { name?: string }).name}</h2>
          <ul>
            {((plan as { slots?: { date?: string; title?: string }[] }).slots || []).map((slot, index) => (
              <li key={index} data-testid="schedule-slot">{slot.date} · {slot.title}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

void loadPortal
