import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CoursePlayer, type PointView, type SwarmItem } from '@/components/app/course-player'
import { Avatar, FollowButton } from '@/components/app/feed'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { PlayIcon } from '@/components/icons'
import { clockEnabled, now } from '@/lib/clock'
import { delayToMs, unlockState } from '@/lib/unlock'
import { visibleCourseIds } from '@/server/context'
import { courseCards, loadFeed, portraitFor, posterFor, slugify } from '@/server/learner'
import { type Ctx, clock, one, ref, rows, str, unreadCount } from '../common'
import { masterFlags } from './journey'

const START = ['orange', 'gold', 'teal']

export async function SpeakerScreen({ payload, user, base, query }: Ctx, speakerSlug: string) {
  const [courses, items, unread] = await Promise.all([courseCards(payload, user), loadFeed(payload, user), unreadCount(payload, user)])
  const theirs = courses.filter((course) => course.speakerSlug === speakerSlug)
  const clips = items.filter((item) => item.speakerSlug === speakerSlug)
  if (!theirs.length && !clips.length) notFound()
  const name = clips[0]?.speaker || theirs[0]?.speaker || speakerSlug
  const portrait = portraitFor(speakerSlug)
  const cover = theirs.find((course) => course.poster)?.poster || clips.find((clip) => clip.poster)?.poster || null
  const intro = clips[0]
  const lanes = [...new Set(clips.map((clip) => clip.laneLabel))]
  return (
    <AppFrame testId="speaker">
      <div className="app-scroll" style={{ paddingTop: 0 }}>
        <div className="bio-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>
          <span className="handle" />
          <Link href={base} className="back" style={{ position: 'absolute', left: 18, top: 'calc(10px + var(--safe-top))', zIndex: 2, color: '#fff' }} data-testid="back">‹ Back</Link>
        </div>
        <div className="bio-portrait">{portrait ? <img src={portrait} alt="" /> : <Avatar name={name} portrait={null} size={108} />}</div>
        <h1 className="bio-name" data-testid="speaker-name">{name}</h1>
        <p className="bio-role">{theirs.length} course{theirs.length === 1 ? '' : 's'} here{lanes.length ? ` · ${lanes.join(', ')}` : ''}</p>
        <Flash error={query.error} notice={query.notice} />
        <div className="bio-actions">
          <FollowButton slug={speakerSlug} className="follow teal" />
          <a className="ask" href="#ask" data-testid="ask-question">Ask a question</a>
        </div>
        {intro ? (
          <Link className="intro-card" href={`${base}/course/${intro.courseId}?part=${intro.lessonId}&t=${Math.floor(intro.appetiser.start)}`} data-testid="watch-intro">
            {intro.poster ? <span className="poster" style={{ backgroundImage: `url(${intro.poster})` }} /> : null}
            <span className="play-circle"><PlayIcon size={26} /></span>
            <span><b>Watch intro</b><small>{clock(intro.appetiser.end - intro.appetiser.start)} · from {intro.courseTitle}</small></span>
          </Link>
        ) : null}
        <p className="eyebrow">Courses</p>
        {theirs.map((course, index) => (
          <div className="course-row" key={course.id} data-testid="speaker-course">
            <span className="thumb" style={course.poster ? { backgroundImage: `url(${course.poster})` } : undefined} />
            <span className="t"><b>{course.title}</b><small>{course.parts} part{course.parts === 1 ? '' : 's'}{course.open ? '' : ` · opens on day ${course.opensOnDay}`}</small></span>
            <Link className={`start ${course.open ? START[index % START.length] : 'soft'}`} href={`${base}/course/${course.id}`}>{course.open ? 'Start' : 'Peek'}</Link>
          </div>
        ))}
        <section id="ask" className="card" style={{ marginTop: 18 }}>
          <h3>Ask {name.replace(/^(Shaykh|Sheikh)\s+/, '')} a question</h3>
          <p style={{ marginBottom: 10 }}>Your question goes on your circle board, where your teacher can pick it up.</p>
          <form className="form-stack" action="/api/hearts" method="post">
            <Hidden fields={{ action: 'board', next: `${base}/speaker/${speakerSlug}`, prefix: name }} />
            <textarea className="field" name="body" rows={3} required placeholder="What would you like to ask?" data-testid="ask-body" />
            <button className="pill teal block" type="submit" data-testid="ask-submit">Send my question</button>
          </form>
        </section>
      </div>
      <TabBar base={base} active="home" unread={unread} />
    </AppFrame>
  )
}

function canSeePoint(point: Record<string, unknown>, userId: number) {
  const audience = str(point.audience, 'everyone')
  if (audience === 'everyone') return true
  if (ref(point.author) === userId) return true
  if (audience === 'self') return false
  return ((point.audienceUsers as unknown[]) || []).some((item) => ref(item) === userId)
}

export async function CourseScreen({ payload, user, portal, base, query }: Ctx, courseId: number) {
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const visible = await visibleCourseIds(payload, user)
  if (!visible.includes(courseId)) redirect(`${base}/lanes?error=${encodeURIComponent('That course is not in your pack. Ask your teacher if you would like it.')}`)
  const lessons = await rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order' })
  if (!lessons.length) redirect(`${base}/lanes?error=${encodeURIComponent('That course has no parts yet.')}`)
  const partIndex = Math.max(0, lessons.findIndex((lesson) => lesson.id === Number(query.part)))
  const lesson = lessons[partIndex]
  const lessonId = lesson.id

  const visits = await rows(payload, 'lesson-visits', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, { limit: 1, sort: 'createdAt' })
  if (!visits.length) await payload.create({ collection: 'lesson-visits', overrideAccess: true, data: { user: user.id, lesson: lessonId, portal: portal.id } })
  const seenAt = visits[0]?.createdAt ? new Date(visits[0].createdAt) : now()

  const lessonIds = lessons.map((row) => row.id)
  const allPoints = (await rows(payload, 'engagement-points', { and: [{ lesson: { in: lessonIds } }, { or: [{ status: { not_equals: 'draft' } }, { status: { exists: false } }] }] }, { sort: 'second', depth: 1 }))
    .filter((point) => {
      const author = point.author as { id?: number; role?: string; tenants?: { tenant?: unknown }[] } | null
      if (!author || author.role === 'master') return true
      return (author.tenants || []).some((row) => ref(row.tenant) === portal.id)
    })
    .filter((point) => user.role !== 'learner' || canSeePoint(point, user.id))
  const points = allPoints.filter((point) => ref(point.lesson) === lessonId)
  const mine = await rows(payload, 'answers', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] })
  const at = now()
  const views: PointView[] = points.map((point, index) => {
    const contingentId = ref(point.contingent)
    const contingentAnswer = contingentId ? mine.find((answer) => ref(answer.point) === contingentId) : null
    const state = unlockState({
      timing: point.timing === 'future' ? 'future' : 'immediate',
      delayMs: delayToMs(Number(point.delayAmount || 0), str(point.delayUnit, 'week')),
      hasContingent: Boolean(contingentId),
      contingentAnsweredAt: contingentAnswer?.createdAt ? new Date(contingentAnswer.createdAt) : null,
      seenAt,
      at,
    })
    const answer = mine.find((row) => ref(row.point) === point.id)
    return {
      id: point.id,
      number: index + 1,
      second: Number(point.second || 0),
      prompt: str(point.prompt),
      kind: (['reflection', 'question', 'multiple_choice', 'task'].includes(str(point.kind)) ? point.kind : 'reflection') as PointView['kind'],
      options: Array.isArray(point.options) ? (point.options as unknown[]).map(String) : [],
      state: state.state,
      unlocksAt: state.unlocksAt ? state.unlocksAt.toISOString() : null,
      contingentPrompt: contingentId ? str(allPoints.find((row) => row.id === contingentId)?.prompt) : undefined,
      answered: Boolean(answer),
      myAnswer: answer ? str(answer.body) || str(answer.choice) : undefined,
      timeLimitSec: Number(point.timeLimitSec || 0) || null,
    }
  })

  const swarm: Record<number, SwarmItem[]> = {}
  // The swarm is opt-in: a learner sees other learners' answers only after choosing to share with learners
  // themselves, and only answers whose authors chose the same and ticked "Let other learners read it".
  const swarmOn = user.role === 'learner' && Boolean(user.shareWithLearners) && portal.showOthersAnswers !== false
  if (swarmOn && points.length) {
    const shared = await rows(
      payload,
      'answers',
      { and: [{ point: { in: points.map((point) => point.id) } }, { portal: { equals: portal.id } }, { shareWithLearners: { equals: true } }, { keepPrivate: { not_equals: true } }] },
      { depth: 1, sort: '-createdAt', limit: 200 },
    )
    for (const answer of shared) {
      if (answer.keepPrivate === true || answer.shareWithLearners !== true || ref(answer.user) === user.id) continue
      const pointId = ref(answer.point)
      if (!pointId) continue
      const author = answer.user as { name?: string; shareWithLearners?: boolean } | null
      if (!author?.shareWithLearners) continue
      const image = answer.image as { url?: string } | null
      ;(swarm[pointId] ||= []).push({ name: author?.name || 'Someone in your circle', body: str(answer.body) || str(answer.choice) || 'Shared a photo', image: image?.url || null })
    }
  }

  const completions = await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] })
  const doneLessons = new Set(completions.map((row) => ref(row.lesson)))
  const answeredPoints = new Set(mine.map((row) => ref(row.point)))
  const done = doneLessons.size + allPoints.filter((point) => answeredPoints.has(point.id)).length
  const total = lessons.length + allPoints.length

  const marks = mine.length
    ? await rows(payload, 'feedback-notes', { answer: { in: mine.map((row) => row.id) } }, { sort: 'second' })
    : []
  const youtubeId = str(lesson.youtubeId) || null
  const startAt = Math.max(0, Number(query.t || 0)) || 0
  const [unread, flags] = await Promise.all([unreadCount(payload, user), masterFlags(payload)])
  const here = `${base}/course/${courseId}?part=${lessonId}`

  return (
    <AppFrame testId="course">
      <div className="app-scroll">
        <Flash error={query.error} notice={query.notice} />
        <CoursePlayer
          courseTitle={str(course.title)}
          backHref={`${base}/lanes`}
          lessonId={lessonId}
          partLabel={`Part ${partIndex + 1} · ${str(lesson.title)}`}
          youtubeId={youtubeId}
          poster={posterFor(youtubeId) || portraitFor(slugify(str(lesson.speaker || course.speaker)))}
          duration={Number(lesson.durationSeconds || 0)}
          startAt={startAt}
          points={views}
          swarm={swarm}
          swarmOn={swarmOn}
          serverNow={at.toISOString()}
          next={here}
          overPlayer={flags.popupOverPlayer}
          garden={{ done, total, gardenHref: `${base}/garden`, links: [{ label: "See what you've sown", href: `${base}/garden/general` }, { label: 'Your workbook', href: `${base}/garden/workbook` }] }}
        />
        {marks.length ? (
          <section className="card" data-testid="in-video-feedback" style={{ marginTop: 14 }}>
            <h3>Feedback from your teacher</h3>
            {marks.map((mark) => (
              <p key={mark.id} data-testid="feedback-mark"><b style={{ color: 'var(--orange)' }}>{clock(Number(mark.second || 0))}</b> {str(mark.body)}</p>
            ))}
          </section>
        ) : null}
        <p className="eyebrow">Parts of this course</p>
        {lessons.map((row, index) => (
          <Link key={row.id} className="list-link" href={`${base}/course/${courseId}?part=${row.id}`} data-testid="part-link" aria-current={row.id === lessonId ? 'page' : undefined}>
            <span className="grow">Part {index + 1}. {str(row.title)}<small>{row.durationSeconds ? clock(Number(row.durationSeconds)) : 'Length not known yet'}{doneLessons.has(row.id) ? ' · watched' : ''}</small></span>
            {row.id === lessonId ? <span className="badge" style={{ color: 'var(--purple)', fontWeight: 700, fontSize: 13 }}>Playing</span> : '›'}
          </Link>
        ))}
        {clockEnabled() && user.role === 'master' ? (
          <details className="card" style={{ marginTop: 16 }}>
            <summary style={{ fontWeight: 700 }}>Test clock</summary>
            <form className="form-stack" action="/api/hearts" method="post" style={{ marginTop: 10 }}>
              <Hidden fields={{ action: 'clock', next: here }} />
              <input className="field" data-testid="clock-iso" name="iso" placeholder="2026-12-01T00:00:00.000Z" />
              <button className="pill ink small" data-testid="clock-submit" type="submit">Move the clock</button>
            </form>
          </details>
        ) : null}
      </div>
      <TabBar base={base} active="lanes" unread={unread} />
    </AppFrame>
  )
}
