import Link from 'next/link'
import { cookies } from 'next/headers'
import { DoorChips } from '@/components/app/doors'
import { notFound, redirect } from 'next/navigation'
import { CoursePlayer, type PointView, type SwarmItem } from '@/components/app/course-player'
import { Avatar, FollowButton } from '@/components/app/feed'
import { AppFrame, Back, Flash, Hidden, TabBar } from '@/components/app/shell'
import { PlayIcon } from '@/components/icons'
import { clockEnabled, now } from '@/lib/clock'
import { doorLabel, groupByDoor, type Door } from '@/lib/doors'
import { lessonDoor, showCourseDoorHeading } from '@/lib/course-doors'
import { loadDoors } from '@/server/doors'
import { delayToMs, unlockState } from '@/lib/unlock'
import { visibleCourseIds } from '@/server/context'
import { sortParts } from '@/lib/part-order'
import { partTitle, tidyTalkTitle } from '@/lib/talk-title'
import { courseCards, portraitFor, posterFor, shownPoster, slugify, talkStill } from '@/server/learner'
import { speakerPage } from '@/server/speakers'
import { learnerClips, pointVisibleWhere } from '@/server/opening'
import { countsTowardProgress, pieceLevel } from '@/lib/progress'
import { appetiserStop } from '@/lib/tiers'
import { lineAt } from '@/lib/harvest'
import { answerCounts, courseProgress } from '@/lib/nesting'
import { type Ctx, type Row, clock, one, ref, rows, str, unreadCount } from '../common'
import { lastPartCopy, playerPartLabel, resolvePartIndex } from '@/lib/player-labels'
import { nextPartLabel } from '@/lib/study-plan'
import { talksLabel } from '@/lib/week'
import { masterFlags } from './journey'
import { companyGatherings, relatedCards, TalkGatherNotice } from '@/screens/app/gather'
import { listGatherings } from '@/server/gather'
import { mixSwarm } from '@/lib/circle'
import { circleForPoints, circleSettings } from '@/server/circle'
import { initialsOf } from '@/lib/swarm-sort'
import { featureOn } from '@/lib/features'
import { hiddenIds } from '@/server/safety'
import { ReportButton } from '@/components/app/report-sheet'

const START = ['orange', 'gold', 'teal']

/** The same next part for the player and the garden. */
function nextCoursePart(lessons: Row[], partIndex: number, hrefBase: string) {
  const pick = lessons[partIndex + 1]
  if (!pick) return null
  return { label: nextPartLabel(partIndex + 2), href: `${hrefBase}?part=${pick.id}` }
}

function partHeading(index: number, lesson: Row, courseTitle: string, total: number) {
  return playerPartLabel({ index, total, name: partTitle(lesson, courseTitle), courseTitle })
}

export async function SpeakerScreen({ payload, user, portal, base, query }: Ctx, speakerSlug: string) {
  const [courses, { items }, unread, speaker] = await Promise.all([courseCards(payload, user), learnerClips(payload, portal, user), unreadCount(payload, user), speakerPage(payload, speakerSlug)])
  const drawn = await rows(payload, 'drawn-to', { and: [{ user: { equals: user.id } }, { speakerSlug: { in: [speakerSlug, speaker?.slug, ...(speaker?.aliasSlugs || [])].filter(Boolean) } }] }, { limit: 5 })
  const addresses = new Set([speakerSlug, speaker?.slug, ...(speaker?.aliasSlugs || [])].filter((value): value is string => Boolean(value)))
  const theirs = courses.filter((course) => addresses.has(course.speakerSlug))
  const clips = items.filter((item) => addresses.has(item.speakerSlug))
  if (!speaker && !theirs.length && !clips.length) notFound()
  const name = speaker?.displayName || clips[0]?.speaker || theirs[0]?.speaker || speakerSlug
  const portrait = speaker?.portrait || portraitFor(speaker?.slug || speakerSlug)
  const cover = shownPoster(theirs.find((course) => course.poster)?.poster) || shownPoster(clips.find((clip) => clip.poster)?.poster) || null
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
            {shownPoster(intro.poster) ? <span className="poster" style={{ backgroundImage: `url(${shownPoster(intro.poster)})` }} /> : null}
            <span className="play-circle"><PlayIcon size={26} /></span>
            <span><b>Watch intro</b><small>{clock(appetiserStop(intro.appetiser) - intro.appetiser.start)} · from {tidyTalkTitle(intro.courseTitle)}</small></span>
          </Link>
        ) : null}
        <p className="eyebrow">Courses</p>
        {theirs.map((course, index) => (
          <div className="course-row" key={course.id} data-testid="speaker-course">
            <span className="thumb" style={shownPoster(course.poster) ? { backgroundImage: `url(${shownPoster(course.poster)})` } : undefined} />
            <span className="t"><b>{tidyTalkTitle(course.title)}</b><small>{course.parts} part{course.parts === 1 ? '' : 's'}{course.open ? '' : ` · opens on day ${course.opensOnDay}`}</small><DoorChips doors={course.doors} max={1} /></span>
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
      <TabBar base={base} active="home" portal={portal} unread={unread} />
    </AppFrame>
  )
}

/** A part sits under the door of its title, or of the cut that actually carries the talk. */
function courseDoors(lessons: Row[], cuts: Row[], doors: Door[], courseTitle: string) {
  return groupByDoor(lessons, (lesson) => {
    const own = cuts.filter((cut) => ref(cut.lesson) === lesson.id && Number(cut.bestClause))
    return lessonDoor({ lessonTitle: str(lesson.title), courseTitle, cuts: own, doors })
  })
}

async function CourseOverview({ payload, user, portal, base, query }: Ctx, course: Row, lessons: Row[]) {
  const lessonIds = lessons.map((row) => row.id)
  const [completions, unread] = await Promise.all([
    rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] }),
    unreadCount(payload, user),
  ])
  const done = new Set(completions.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: true, event: 'watch' })).map((row) => ref(row.lesson)))
  const continueId = lessons.find((lesson) => !done.has(lesson.id))?.id || lessons[0].id
  const continueIndex = lessons.findIndex((lesson) => lesson.id === continueId)
  const started = done.size > 0 || continueIndex > 0
  const seconds = lessons.reduce((sum, lesson) => sum + Number(lesson.durationSeconds || 0), 0)
  const title = tidyTalkTitle(str(course.title))
  return (
    <AppFrame testId="course-overview">
      <div className="app-scroll">
        <Back href={`${base}/lanes`} label="Lanes" />
        <Flash error={query.error} notice={query.notice} />
        <div className="app-head"><h1 data-testid="course-title">{title}</h1></div>
        <p className="lead" data-testid="course-count">{talksLabel(lessons.length, seconds)}</p>
        <Link className="pill gold block" href={`${base}/course/${course.id}?part=${continueId}`} data-testid="start-part">
          {done.size >= lessons.length && lessons.length
            ? lessons.length === 1 ? 'Watch again' : 'Watch from part 1'
            : started ? `Continue part ${continueIndex + 1}` : 'Start part 1'}
        </Link>
        <Link className="pill outline block" href={`${base}/week?course=${course.id}&view=new&from=course`} data-testid="schedule-all" style={{ marginTop: 10 }}>
          {lessons.length === 1 ? 'Schedule this talk' : 'Schedule all of these'}
        </Link>
        <p className="eyebrow">Talks in this course</p>
        {lessons.map((lesson, index) => {
          const secondsHere = Number(lesson.durationSeconds || 0)
          const youtubeId = str(lesson.youtubeId) || null
          const name = partTitle(lesson, title)
          const still = talkStill(youtubeId, str(lesson.speaker || course.speaker))
          return (
            <Link key={lesson.id} className="buffet-row" href={`${base}/course/${course.id}?part=${lesson.id}`} data-testid="buffet-talk">
              <span className={`thumb${still.fallback ? ' is-fallback' : ''}`} data-testid="talk-thumb">
                <img src={still.src} alt="" />
                {still.fallback ? <span className="thumb-title">{name}</span> : null}
              </span>
              <span className="t">
                <small>Part {index + 1}</small>
                <b className="talk-name">{name}</b>
                <small>{secondsHere ? clock(secondsHere) : 'Length not known yet'}{done.has(lesson.id) ? ' · watched' : ''}</small>
              </span>
              ›
            </Link>
          )
        })}
      </div>
      <TabBar base={base} active="lanes" unread={unread} />
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

export async function CourseScreen(ctx: Ctx, courseId: number) {
  const { payload, user, portal, base, query } = ctx
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  const visible = await visibleCourseIds(payload, user)
  if (!visible.includes(courseId)) redirect(`${base}/lanes?error=${encodeURIComponent('That course is not in your pack. Ask your teacher if you would like it.')}`)
  const [lessonRows, units, flags] = await Promise.all([
    rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order' }),
    rows(payload, 'units', { course: { equals: courseId } }, { sort: 'order' }),
    masterFlags(payload),
  ])
  const unitRank = new Map(units.map((unit, index) => [unit.id, index]))
  const lessons = sortParts(lessonRows, (row) => unitRank.get(ref(row.unit) || 0) ?? 99)
  if (!lessons.length) redirect(`${base}/lanes?error=${encodeURIComponent('That course has no parts yet.')}`)
  if (!query.part) {
    return CourseOverview(ctx, course, lessons)
  }
  const partIndex = resolvePartIndex(lessons, query.part)
  const lesson = lessons[partIndex]
  const lessonId = lesson.id

  const visits = await rows(payload, 'lesson-visits', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, { limit: 1, sort: 'createdAt' })
  if (!visits.length) await payload.create({ collection: 'lesson-visits', overrideAccess: true, data: { user: user.id, lesson: lessonId, portal: portal.id } })
  if (query.from === 'lanes') {
    const deviceId = (await cookies()).get('hearts_device')?.value
    void import('@/server/experiments').then(({ recordLearnerEvent }) =>
      recordLearnerEvent(payload, { user, deviceId, event: 'lanes_course_start', props: { course: courseId, from: 'lanes' }, portalId: portal.id }),
    )
  }
  const seenAt = visits[0]?.createdAt ? new Date(visits[0].createdAt) : now()

  const lessonIds = lessons.map((row) => row.id)
  const allPoints = (await rows(payload, 'engagement-points', { and: [{ lesson: { in: lessonIds } }, pointVisibleWhere(flags.showUnchecked)] }, { sort: 'second', depth: 1 }))
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
  // The swarm is opt-in (#32): a learner sees other learners' answers only after choosing to share,
  // and only answers whose authors chose the same. A private or hidden row never appears.
  const swarmOn = user.role === 'learner' && Boolean(user.shareWithLearners) && portal.showOthersAnswers !== false
  if (swarmOn && points.length) {
    const shared = await rows(
      payload,
      'answers',
      { and: [{ point: { in: points.map((point) => point.id) } }, { portal: { equals: portal.id } }, { shareWithLearners: { equals: true } }, { keepPrivate: { not_equals: true } }] },
      { depth: 1, sort: '-createdAt', limit: 200 },
    )
    const hiddenAnswers = await hiddenIds(payload, 'answer', shared.map((row) => row.id))
    for (const answer of shared) {
      if (hiddenAnswers.has(answer.id)) continue
      if (answer.keepPrivate === true || answer.shareWithLearners !== true || answer.swarmHidden === true || ref(answer.user) === user.id) continue
      const pointId = ref(answer.point)
      if (!pointId) continue
      const author = answer.user as { name?: string; shareWithLearners?: boolean } | null
      if (!author?.shareWithLearners) continue
      const image = answer.image as { url?: string; id?: number } | null
      const imageSrc = image?.id ? `/api/hearts/file/${image.id}` : image?.url || null
      const name = author?.name || 'Someone in your circle'
      ;(swarm[pointId] ||= []).push({ name, body: str(answer.body) || str(answer.choice) || 'Shared a photo', image: imageSrc, initials: initialsOf(name), id: answer.id, kind: 'answer' })
    }
    if (featureOn(portal, 'circle')) {
      // HEARTS circle answers fill the swarm while it is quiet and step back as real shared answers arrive.
      const [circle, settings] = await Promise.all([circleForPoints(payload, points.map((point) => point.id), portal.id), circleSettings(payload)])
      circleLabel = settings.label
      for (const point of points) {
        const extra = (circle.get(point.id) || []).map((row): SwarmItem => ({ name: row.name, body: row.body, circle: true, id: row.id, kind: 'circle-answer', initials: initialsOf(row.name) }))
        const hiddenCircle = await hiddenIds(payload, 'circle-answer', extra.map((row) => row.id!).filter(Boolean))
        const visibleExtra = extra.filter((row) => !row.id || !hiddenCircle.has(row.id))
        const mixed = mixSwarm(swarm[point.id] || [], visibleExtra, `${user.id}:${point.id}`, settings.threshold)
        if (mixed.length) swarm[point.id] = mixed
      }
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
  const unread = await unreadCount(payload, user)
  const here = `${base}/course/${courseId}?part=${lessonId}`
  const courseHref = `${base}/course/${courseId}`
  const nextLesson = lessons[partIndex + 1] || null
  const following = nextCoursePart(lessons, partIndex, `${base}/course/${courseId}`)
  const upNext = nextLesson && following
    ? { href: following.href, label: following.label, minutes: Math.max(1, Math.round(Number(nextLesson.durationSeconds || 0) / 60)), last: false }
    : { href: courseHref, label: lastPartCopy(lessons.length), minutes: 0, last: true }
  const thinks = (await rows(payload, 'notifications', { and: [{ user: { equals: user.id } }, { channel: { equals: 'think' } }, { read: { not_equals: true } }] }, { limit: 50 }))
    .map((row) => {
      try {
        return JSON.parse(str(row.body)) as { kind?: string; pointId?: number; lessonId?: number; prompt?: string }
      } catch {
        return null
      }
    })
    .filter((row): row is { kind?: string; pointId: number; lessonId: number; prompt: string } => Boolean(row && row.pointId && row.lessonId === lessonId))
  const rewrites = thinks.length || points.length
    ? await rows(payload, 'question-rewrites', { point: { in: [...new Set([...thinks.map((row) => row.pointId), ...points.map((point) => point.id)])] } }, { limit: 50 })
    : []
  const deferred = thinks.map((row) => {
    const rewrite = rewrites.find((item) => ref(item.point) === row.pointId)
    return { pointId: row.pointId, prompt: str(rewrite?.rewrite) || row.prompt || str(points.find((point) => point.id === row.pointId)?.prompt) }
  })
  const gatherOn = featureOn(portal, 'gather')
  const { cards: gatherCards } = gatherOn ? await listGatherings(payload, portal.id, user.id) : { cards: [] as Awaited<ReturnType<typeof listGatherings>>['cards'] }
  const related = gatherOn ? relatedCards(gatherCards, { lessonId, courseId }) : []
  const withGather = views.map((view) => ({
    ...view,
    gatherings: gatherOn && view.kind === 'task'
      ? companyGatherings(gatherCards, { id: view.id, lessonId, courseId, door: related[0]?.door || null, prompt: view.prompt }).map((card) => ({ href: `${base}/gather/${card.id}`, title: card.title, when: card.when }))
      : undefined,
  }))

  return (
    <AppFrame testId="course" evening>
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
          courseTitle={tidyTalkTitle(str(course.title))}
          backHref={`${base}/lanes`}
          lessonId={lessonId}
          partLabel={partHeading(partIndex + 1, lesson, tidyTalkTitle(str(course.title)), lessons.length)}
          youtubeId={youtubeId}
          film={film}
          poster={shownPoster(posterFor(youtubeId)) || portraitFor(slugify(str(lesson.speaker || course.speaker)))}
          duration={Number(lesson.durationSeconds || 0)}
          startAt={startAt}
          points={withGather}
          swarm={swarm}
          swarmOn={swarmOn}
          circleLabel={circleLabel}
          serverNow={at.toISOString()}
          next={here}
          overPlayer={flags.popupOverPlayer}
          upNext={upNext}
          courseHref={courseHref}
          deferred={deferred}
          initialOpenId={Number(query.answer) || deferred[0]?.pointId || null}
          garden={{ done, total, gardenHref: featureOn(portal, 'garden') ? `${base}/garden` : base, nextPart: following, links: [
            ...(featureOn(portal, 'garden') ? [{ label: "See what you've sown", href: `${base}/garden/general` }] : []),
            ...(featureOn(portal, 'workbook') ? [{ label: 'Your workbook', href: `${base}/garden/workbook` }] : []),
          ] }}
        />
        {related[0] ? <TalkGatherNotice startsAt={related[0].startsAt} href={`${base}/gather/${related[0].id}`} title={related[0].title} /> : null}
        {marks.length && featureOn(portal, 'feedback') ? (
          <section className="card" data-testid="in-video-feedback" style={{ marginTop: 14 }}>
            <h3>Feedback from your teacher</h3>
            {marks.map((mark) => (
              <p key={mark.id} data-testid="feedback-mark">
                <b style={{ color: 'var(--orange)' }}>{clock(Number(mark.second || 0))}</b> {str(mark.body)}
                <ReportButton targetType="teacher-reply" targetId={mark.id} next={here} />
              </p>
            ))}
          </section>
        ) : null}
        {featureOn(portal, 'planner') ? <p style={{ margin: '16px 0 0' }}><Link className="pill outline" href={`${base}/week?course=${courseId}&view=new&from=course`} data-testid={lessons.length >= 2 ? 'plan-rest' : 'schedule-this'}>{lessons.length >= 2 ? 'Plan the rest of this course' : 'Schedule this talk'}</Link></p> : null}
        <p className="eyebrow">Parts of this course</p>
        {(() => {
          const groups = courseDoors(lessons, partCuts, doors, str(course.title))
          const heading = showCourseDoorHeading(lessons.length, groups.length)
          return groups.map((group) => (
          <section key={group.door?.number || 'open'} className="door-course" data-testid="course-door" data-door={group.door?.number || ''}>
            {heading && group.door ? <h2>{doorLabel(group.door)}</h2> : null}
            {heading && group.door?.teaching ? <p>{group.door.teaching}</p> : null}
            {group.items.map((row) => {
              const index = lessons.findIndex((lesson) => lesson.id === row.id)
              const tier = partTiers.find((item) => ref(item.lesson) === row.id && Number(item.appetiserEnd) > Number(item.appetiserStart))
              return (
                <div key={row.id}>
                  <Link className="list-link" href={`${base}/course/${courseId}?part=${row.id}`} data-testid="part-link" aria-current={row.id === lessonId ? 'page' : undefined}>
                    <span className="grow">{partHeading(index + 1, row, tidyTalkTitle(str(course.title)), lessons.length)}<small>{row.durationSeconds ? clock(Number(row.durationSeconds)) : 'Length not known yet'}{doneLessons.has(row.id) ? ' · watched' : ''}</small></span>
                    {row.id === lessonId ? <span className="badge" style={{ color: 'var(--purple)', fontWeight: 700, fontSize: 13 }}>Playing</span> : '›'}
                  </Link>
                  {tier ? (
                    <Link className="list-link sub" href={`${base}/course/${courseId}?part=${row.id}&t=${Math.floor(Number(tier.appetiserStart || 0))}`} data-testid="course-appetiser">
                      <span className="grow">Ready for more?<small>From {clock(Number(tier.appetiserStart || 0))}</small></span>›
                    </Link>
                  ) : null}
                </div>
              )
            })}
          </section>
        ))
        })()}
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
      <TabBar base={base} active="lanes" portal={portal} unread={unread} />
    </AppFrame>
  )
}
