import Link from 'next/link'
import { DoorChips } from '@/components/app/doors'
import { notFound, redirect } from 'next/navigation'
import { CoursePlayer, type PointView, type SwarmItem } from '@/components/app/course-player'
import { Avatar, FollowButton } from '@/components/app/feed'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { PlayIcon } from '@/components/icons'
import { clockEnabled, now } from '@/lib/clock'
import { doorLabel, doorOfClause, groupByDoor, type Door } from '@/lib/doors'
import { loadDoors } from '@/server/doors'
import { delayToMs, unlockState } from '@/lib/unlock'
import { visibleCourseIds } from '@/server/context'
import { courseCards, portraitFor, posterFor, slugify } from '@/server/learner'
import { speakerPage } from '@/server/speakers'
import { learnerClips } from '@/server/opening'
import { countsTowardProgress, pieceLevel } from '@/lib/progress'
import { appetiserStop } from '@/lib/tiers'
import { lineAt } from '@/lib/harvest'
import { answerCounts, courseProgress } from '@/lib/nesting'
import { type Ctx, type Row, clock, one, ref, rows, str, unreadCount } from '../common'
import { masterFlags } from './journey'
import { mixSwarm } from '@/lib/circle'
import { circleForPoints, circleSettings } from '@/server/circle'

const START = ['orange', 'gold', 'teal']

export async function SpeakerScreen({ payload, user, portal, base, query }: Ctx, speakerSlug: string) {
  const [courses, { items }, unread, speaker] = await Promise.all([courseCards(payload, user), learnerClips(payload, portal, user), unreadCount(payload, user), speakerPage(payload, speakerSlug)])
  const drawn = await rows(payload, 'drawn-to', { and: [{ user: { equals: user.id } }, { speakerSlug: { in: [speakerSlug, speaker?.slug, ...(speaker?.aliasSlugs || [])].filter(Boolean) } }] }, { limit: 5 })
  const addresses = new Set([speakerSlug, speaker?.slug, ...(speaker?.aliasSlugs || [])].filter((value): value is string => Boolean(value)))
  const theirs = courses.filter((course) => addresses.has(course.speakerSlug))
  const clips = items.filter((item) => addresses.has(item.speakerSlug))
  if (!speaker && !theirs.length && !clips.length) notFound()
  const name = speaker?.displayName || clips[0]?.speaker || theirs[0]?.speaker || speakerSlug
  const portrait = speaker?.portrait || portraitFor(speaker?.slug || speakerSlug)
  const cover = theirs.find((course) => course.poster)?.poster || clips.find((clip) => clip.poster)?.poster || null
  const intro = clips.find((clip) => clip.youtubeId && !clip.style) || clips[0]
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
        <p className="bio-role">{speaker?.honorific && !name.startsWith(speaker.honorific) ? `${speaker.honorific} · ` : ''}{theirs.length} course{theirs.length === 1 ? '' : 's'} here{lanes.length ? ` · ${lanes.join(', ')}` : ''}</p>
        {speaker?.bio ? <p className="bio-copy" data-testid="speaker-bio">{speaker.bio}</p> : null}
        {speaker?.links.length ? (
          <div className="bio-links" data-testid="speaker-links">
            {speaker.links.map((link) => <a key={link.url} href={link.url}>{link.label}</a>)}
          </div>
        ) : null}
        {speaker?.sources ? <pre className="bio-sources" data-testid="speaker-sources">{speaker.sources}</pre> : null}
        {drawn.some((row) => (Number(row.linger) || 0) + (Number(row.learnMore) || 0) > 0) ? <p data-testid="drawn-to">You&apos;re drawn to {name}.</p> : null}
        <Flash error={query.error} notice={query.notice} />
        <div className="bio-actions">
          <FollowButton slug={speaker?.slug || speakerSlug} className="follow teal" />
          <a className="ask" href="#ask" data-testid="ask-question">Ask a question</a>
        </div>
        {intro ? (
          <Link className="intro-card" href={`${base}/feed?clip=${intro.cutId}&play=appetiser`} data-testid="watch-intro" data-start={intro.appetiser.start} data-stop={appetiserStop(intro.appetiser)}>
            {intro.poster ? <span className="poster" style={{ backgroundImage: `url(${intro.poster})` }} /> : null}
            <span className="play-circle"><PlayIcon size={26} /></span>
            <span><b>Watch intro</b><small>{clock(appetiserStop(intro.appetiser) - intro.appetiser.start)} · from {intro.courseTitle}</small></span>
          </Link>
        ) : null}
        <p className="eyebrow">Courses</p>
        {theirs.map((course, index) => (
          <div className="course-row" key={course.id} data-testid="speaker-course">
            <span className="thumb" style={course.poster ? { backgroundImage: `url(${course.poster})` } : undefined} />
            <span className="t"><b>{course.title}</b><small>{course.parts} part{course.parts === 1 ? '' : 's'}{course.open ? '' : ` · opens on day ${course.opensOnDay}`}</small><DoorChips doors={course.doors} max={1} /></span>
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

/** A part sits under the door of its first approved cut (or its first cut when none is approved yet). */
function courseDoors(lessons: Row[], cuts: Row[], doors: Door[]) {
  return groupByDoor(lessons, (lesson) => {
    const own = cuts.filter((cut) => ref(cut.lesson) === lesson.id && Number(cut.bestClause))
    const approved = own.filter((cut) => cut.status === 'approved')
    const pool = (approved.length ? approved : own).slice().sort((a, b) => Number(a.start) - Number(b.start))
    return doorOfClause(Number(pool[0]?.bestClause || 0), doors)
  })
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
  const views: PointView[] = points.filter((point) => str(point.family) !== 'workbook').map((point, index) => {
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
    const answer = mine.find((row) => ref(row.point) === point.id && answerCounts(row))
    return {
      id: point.id,
      number: index + 1,
      second: Number(point.second || 0),
      prompt: str(point.prompt),
      kind: (['reflection', 'question', 'multiple_choice', 'task'].includes(str(point.kind)) ? point.kind : 'reflection') as PointView['kind'],
      options: Array.isArray(point.options) ? (point.options as unknown[]).map(String) : [],
      dueDays: point.dueDays == null || point.dueDays === '' ? null : Number(point.dueDays),
      evidence: (['none', 'note', 'photo'].includes(str(point.evidence)) ? str(point.evidence) : null) as PointView['evidence'],
      showImam: Boolean(point.showImam),
      family: str(point.family) || null,
      state: state.state,
      unlocksAt: state.unlocksAt ? state.unlocksAt.toISOString() : null,
      contingentPrompt: contingentId ? str(allPoints.find((row) => row.id === contingentId)?.prompt) : undefined,
      answered: Boolean(answer),
      myAnswer: answer ? str(answer.body) || str(answer.choice) : undefined,
      timeLimitSec: Number(point.timeLimitSec || 0) || null,
    }
  })

  const swarm: Record<number, SwarmItem[]> = {}
  let circleLabel = ''
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
    // HEARTS circle answers fill the swarm while it is quiet and step back as real shared answers arrive.
    const [circle, settings] = await Promise.all([circleForPoints(payload, points.map((point) => point.id), portal.id), circleSettings(payload)])
    circleLabel = settings.label
    for (const point of points) {
      const extra = (circle.get(point.id) || []).map((row): SwarmItem => ({ name: row.name, body: row.body, circle: true }))
      const mixed = mixSwarm(swarm[point.id] || [], extra, `${user.id}:${point.id}`, settings.threshold)
      if (mixed.length) swarm[point.id] = mixed
    }
  }

  const [completions, partCuts, partTiers, doors] = await Promise.all([
    rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] }),
    lessonIds.length ? rows(payload, 'cuts', { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'rejected' } }] }, { limit: 300 }) : Promise.resolve([] as Row[]),
    lessonIds.length ? rows(payload, 'talk-tiers', { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'rejected' } }] }) : Promise.resolve([] as Row[]),
    loadDoors(payload),
  ])
  const { doneLessons, done, total } = courseProgress({ lessonIds, completions: completions.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: true, event: 'watch' })), pointIds: allPoints.map((point) => point.id), answers: mine })

  const marks = mine.length
    ? await rows(payload, 'feedback-notes', { answer: { in: mine.map((row) => row.id) } }, { sort: 'second' })
    : []
  const provider = str(lesson.videoProvider)
  const vimeoId = str(lesson.vimeoId) || null
  const youtubeId = provider === 'vimeo' || provider === 'file' ? null : str(lesson.youtubeId) || null
  const film = provider === 'vimeo' && vimeoId ? { provider: 'vimeo' as const, vimeoId } : provider === 'file' ? { provider: 'file' as const, src: `/api/hearts/film/${lessonId}` } : null
  const startAt = Math.max(0, Number(query.t || 0)) || 0
  const contextOn = query.context === '1'
  const spoken = contextOn ? lineAt(str(lesson.transcript), startAt) : null
  const [unread, flags] = await Promise.all([unreadCount(payload, user), masterFlags(payload)])
  const here = `${base}/course/${courseId}?part=${lessonId}`

  return (
    <AppFrame testId="course">
      <div className="app-scroll">
        <Flash error={query.error} notice={query.notice} />
        {contextOn ? (
          <section className="context-block" data-testid="context-transcript">
            <p className="eyebrow">Around this moment</p>
            {spoken ? (
              <>
                {spoken.before.map((row) => <p className="context-side" key={`b-${row.seconds}`}>{row.timestamp} {row.text}</p>)}
                <blockquote data-testid="context-line">{spoken.timestamp} {spoken.text}</blockquote>
                {spoken.after.map((row) => <p className="context-side" key={`a-${row.seconds}`}>{row.timestamp} {row.text}</p>)}
              </>
            ) : <p data-testid="context-missing">This talk has no transcript at that moment.</p>}
            <Link className="pill outline small" href={`${base}/garden/harvest`}>Back to harvest</Link>
          </section>
        ) : null}
        <CoursePlayer
          courseTitle={str(course.title)}
          backHref={`${base}/lanes`}
          lessonId={lessonId}
          partLabel={`Part ${partIndex + 1} · ${str(lesson.title)}`}
          youtubeId={youtubeId}
          film={film}
          poster={posterFor(youtubeId) || portraitFor(slugify(str(lesson.speaker || course.speaker)))}
          duration={Number(lesson.durationSeconds || 0)}
          startAt={startAt}
          points={views}
          swarm={swarm}
          swarmOn={swarmOn}
          circleLabel={circleLabel}
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
        {courseDoors(lessons, partCuts, doors).map((group) => (
          <section key={group.door?.number || 'open'} className="door-course" data-testid="course-door" data-door={group.door?.number || ''}>
            {group.door ? <h2>{doorLabel(group.door)}</h2> : null}
            {group.door?.teaching ? <p>{group.door.teaching}</p> : null}
            {group.items.map((row) => {
              const index = lessons.findIndex((lesson) => lesson.id === row.id)
              const tier = partTiers.find((item) => ref(item.lesson) === row.id && Number(item.appetiserEnd) > Number(item.appetiserStart))
              const questions = allPoints.filter((point) => ref(point.lesson) === row.id)
              return (
                <div key={row.id}>
                  <Link className="list-link" href={`${base}/course/${courseId}?part=${row.id}`} data-testid="part-link" aria-current={row.id === lessonId ? 'page' : undefined}>
                    <span className="grow">Part {index + 1}. {str(row.title)}<small>{row.durationSeconds ? clock(Number(row.durationSeconds)) : 'Length not known yet'}{doneLessons.has(row.id) ? ' · watched' : ''}</small></span>
                    {row.id === lessonId ? <span className="badge" style={{ color: 'var(--purple)', fontWeight: 700, fontSize: 13 }}>Playing</span> : '›'}
                  </Link>
                  {tier ? (
                    <Link className="list-link sub" href={`${base}/course/${courseId}?part=${row.id}&t=${Math.floor(Number(tier.appetiserStart || 0))}`} data-testid="course-appetiser">
                      <span className="grow">Appetiser<small>From {clock(Number(tier.appetiserStart || 0))}</small></span>›
                    </Link>
                  ) : null}
                  {questions.map((point) => (
                    <Link key={point.id} className="list-link sub" href={`${base}/course/${courseId}?part=${row.id}&t=${Math.floor(Number(point.second || 0))}`} data-testid="course-question">
                      <span className="grow">{str(point.prompt)}<small>Question</small></span>›
                    </Link>
                  ))}
                </div>
              )
            })}
          </section>
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
