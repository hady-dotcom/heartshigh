import Link from 'next/link'
import { cookies } from 'next/headers'
import { DoorChips } from '@/components/app/doors'
import { notFound, redirect } from 'next/navigation'
import { CoursePlayer, type PointView, type SwarmItem } from '@/components/app/course-player'
import { Avatar, FollowButton } from '@/components/app/feed'
import { AppFrame, Back, Flash, Hidden } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { PlayIcon } from '@/components/icons'
import { clockEnabled, now } from '@/lib/clock'
import { doorLabel, type Door } from '@/lib/doors'
import { phaseLabel } from '@/lib/parent-feedback'
import { readSaidAnswers, saidForFilm } from '@/lib/said-answers'
import { learnerBrand } from '@/lib/learner-brand'
import { filmLabel, shownCalloutSecond } from '@/lib/portal-look'
import { earlierPlayableUnfinished, filmCanPlay, firstPlayableIndex } from '@/lib/film-availability'
import { isSequencePortal, kineticMomentsOn, lockMessage, resumeChoice, sectionAnchor, sectionGroups, sequenceProgress, SEQUENCE_COPY } from '@/lib/sequence'
import { reduceParentingDemo, watchedCount, withDemoQuery } from '@/lib/parenting-demo'
import { DemoFrameTools } from '@/components/demo/frame-tools'
import { kineticClipFor } from '@/server/sequence-desk'
import { lessonDoor } from '@/lib/course-doors'
import { loadDoors } from '@/server/doors'
import { delayToMs, unlockState } from '@/lib/unlock'
import { visibleCourseIds } from '@/server/context'
import { sortParts } from '@/lib/part-order'
import { learnerLessonVisible } from '@/lib/publish-state'
import { shownQuestionPrompt } from '@/lib/question-prompt'
import { partTitle, tidyTalkTitle } from '@/lib/talk-title'
import { courseCards, filmPoster, portraitFor, posterFor, shownPoster, slugify, talkStill } from '@/server/learner'
import { appleLookOnServer, artStyle } from '@/server/swatch'
import { coverColor, coverPath } from '@/lib/cover-art'
import { speakerPage } from '@/server/speakers'
import { learnerClips, pointVisibleWhere } from '@/server/opening'
import { countsTowardProgress, pieceLevel } from '@/lib/progress'
import { appetiserStop } from '@/lib/tiers'
import { lineAt } from '@/lib/harvest'
import { answerCounts, courseProgress } from '@/lib/nesting'
import { type Ctx, type Query, type Row, clock, one, ref, rows, str, unreadCount } from '../common'
import { lastPartCopy, playerPartLabel, resolvePartIndex } from '@/lib/player-labels'
import { nextPartLabel } from '@/lib/study-plan'
import { filmsLabel, talksLabel } from '@/lib/week'
import { FilmFallback } from '@/components/app/film-fallback'
import { CourseArtHero } from '@/components/app/course-art'
import { FilmChips } from './course-home'
import { masterFlags } from './journey'
import { companyGatherings, relatedCards, TalkGatherNotice } from '@/screens/app/gather'
import { listGatherings } from '@/server/gather'
import { emptySwarmFill, mixSwarm } from '@/lib/circle'
import { circleCoverage, circleForPoints, circleSettings } from '@/server/circle'
import { initialsOf } from '@/lib/swarm-sort'
import { featureOn } from '@/lib/features'
import { shellOf } from '@/lib/portal-look'
import { hiddenIds } from '@/server/safety'
import { ReportButton } from '@/components/app/report-sheet'
import { parseTrack } from '@/lib/framing/validate'
import { withCurrentQuery } from '@/lib/keep-query'

const START = ['orange', 'gold', 'teal']

function lessonCanPlay(lesson: Row) {
  return filmCanPlay({ vimeoId: str(lesson.vimeoId), youtubeId: str(lesson.youtubeId), videoProvider: str(lesson.videoProvider) })
}

function partHeading(index: number, lesson: Row, courseTitle: string, total: number) {
  return playerPartLabel({ index, total, name: partTitle(lesson, courseTitle), courseTitle })
}

export async function SpeakerScreen({ payload, user, portal, base, query }: Ctx, speakerSlug: string) {
  const [courses, { items }, unread, speaker] = await Promise.all([courseCards(payload, user, portal.id), learnerClips(payload, portal, user), unreadCount(payload, user), speakerPage(payload, speakerSlug)])
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
    <AppFrame testId="speaker" brand={learnerBrand(portal)}>
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
            <span className="t"><b>{tidyTalkTitle(course.title)}</b><small>{course.parts} {shellOf(portal) === 'modern' ? (course.parts === 1 ? 'film' : 'films') : (course.parts === 1 ? 'part' : 'parts')}{course.open ? '' : ` · opens on day ${course.opensOnDay}`}</small><DoorChips doors={course.doors} max={1} /></span>
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
      <LearnerTabBar base={base} active="home" portal={portal} unread={unread} />
    </AppFrame>
  )
}

/** Week or topic for a part card — never used to sort or group the list. */
function partWeek(lesson: Row, cuts: Row[], doors: Door[], courseTitle: string) {
  const own = cuts.filter((cut) => ref(cut.lesson) === lesson.id && Number(cut.bestClause))
  return lessonDoor({ lessonTitle: str(lesson.title), courseTitle, cuts: own, doors })
}

async function CourseOverview({ payload, user, portal, base, query }: Ctx, course: Row, lessons: Row[]) {
  const lessonIds = lessons.map((row) => row.id)
  const sequence = isSequencePortal(portal)
  const [completions, unread, partCuts, doors, unitRows] = await Promise.all([
    rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] }),
    unreadCount(payload, user),
    lessonIds.length ? rows(payload, 'cuts', { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'rejected' } }] }, { limit: 300 }) : Promise.resolve([] as Row[]),
    sequence ? Promise.resolve([] as Door[]) : loadDoors(payload),
    sequence ? rows(payload, 'units', { course: { equals: course.id } }, { sort: 'order' }) : Promise.resolve([] as Row[]),
  ])
  const done = new Set(completions.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: true, event: 'watch' })).map((row) => ref(row.lesson)))
  const continueIndex = sequence
    ? firstPlayableIndex(lessons, lessonCanPlay, (lesson) => done.has(lesson.id))
    : Math.max(0, lessons.findIndex((lesson) => !done.has(lesson.id)))
  const continueLesson = lessons[continueIndex] || lessons[0]
  const started = sequence
    ? lessons.some((lesson) => lessonCanPlay(lesson) && done.has(lesson.id))
    : done.size > 0
  const seconds = lessons.reduce((sum, lesson) => sum + Number(lesson.durationSeconds || 0), 0)
  const title = tidyTalkTitle(str(course.title))
  const tint = await appleLookOnServer()
  return (
    <AppFrame testId="course-overview" brand={learnerBrand(portal)} art={tint ? coverColor(course.id) : null}>
      <div className="app-scroll">
        {sequence ? null : <Back href={`${base}/lanes`} label="Lanes" />}
        <Flash error={query.error} notice={query.notice} />
        <div className="course-top">
          <CourseArtHero src={tint ? coverPath('course', course.id) : shownPoster(filmPoster(continueLesson))} />
          {sequence ? (
            <div className="app-head course-head">
              <Back href={`${base}/courses`} label="Courses" />
              <h1 data-testid="course-title">{title}</h1>
            </div>
          ) : (
            <div className="app-head"><h1 data-testid="course-title">{title}</h1></div>
          )}
        </div>
        <p className="lead" data-testid="course-count">{sequence ? filmsLabel(lessons.length, seconds) : talksLabel(lessons.length, seconds)}</p>
        {sequence ? (
          <div data-testid="play-next">
            <p className="eyebrow">Play next</p>
            <Link className="pill gold block" href={withCurrentQuery(`${base}/course/${course.id}?part=${continueLesson.id}`, query)} data-testid="start-part">
              {lessons.filter(lessonCanPlay).every((lesson) => done.has(lesson.id))
                ? `Watch from film ${continueIndex + 1}`
                : started ? `Continue film ${continueIndex + 1}` : `Start film ${continueIndex + 1}`}
            </Link>
          </div>
        ) : (
          <Link className="pill gold block" href={withCurrentQuery(`${base}/course/${course.id}?part=${continueLesson.id}`, query)} data-testid="start-part">
            {done.size >= lessons.length && lessons.length
              ? lessons.length === 1 ? 'Watch again' : 'Watch from part 1'
              : started ? `Continue part ${continueIndex + 1}` : `Start part ${continueIndex + 1}`}
          </Link>
        )}
        <Link className="pill outline block" href={withCurrentQuery(`${base}/week?course=${course.id}&view=new&from=course`, query)} data-testid="schedule-all" style={{ marginTop: 10 }}>
          {lessons.length === 1 ? (sequence ? 'Schedule this film' : 'Schedule this talk') : 'Schedule all of these'}
        </Link>
        {sequence && shellOf(portal) === 'modern' ? (
          <a className="list-link" href={withCurrentQuery(`${base}/workbook`, query)} data-testid="open-workbook">
            <span className="grow">Workbook<small>The first ten films, your answer, and a few from other parents</small></span>
            <span aria-hidden>›</span>
          </a>
        ) : null}
        <p className="muted" data-testid="buffet-note" style={{ margin: '10px 2px 0' }}>
          {sequence ? 'Questions appear inside each film, once you open it.' : 'Questions appear inside each talk, once you open it.'}
        </p>
        {sequence ? <p data-testid="sequence-progress">{sequenceProgress(done.size, lessons.length).line}</p> : <p className="eyebrow">Talks in this course</p>}
        <div data-testid={sequence ? 'sequence-list' : undefined}>
        {(sequence
          ? sectionGroups(lessons, (lesson) => str(unitRows.find((unit) => unit.id === ref(lesson.unit))?.title) || 'Films')
          : [{ title: '', rows: lessons.map((item, index) => ({ item, index })) }]
        ).map((group) => (
          <section className={sequence ? 'sequence-module' : undefined} id={sequence ? sectionAnchor(group.title) : undefined} key={group.title || 'films'} data-testid={sequence ? 'sequence-module' : undefined}>
            {sequence ? <h2>{group.title}</h2> : null}
            <div className={tint ? 'film-shelf' : undefined}>
            {group.rows.map(({ item: lesson, index }) => {
          const secondsHere = Number(lesson.durationSeconds || 0)
          const youtubeId = str(lesson.youtubeId) || null
          const name = partTitle(lesson, title)
          const stored = filmPoster(lesson)
          const still = tint
            ? { src: coverPath('film', lesson.id), fallback: false as const }
            : stored ? { src: stored, fallback: false as const } : sequence ? { src: '', fallback: true as const } : talkStill(youtubeId, str(lesson.speaker || course.speaker))
          const week = partWeek(lesson, partCuts, doors, str(course.title))
          return (
            <Link key={lesson.id} className="buffet-row" href={withCurrentQuery(`${base}/course/${course.id}?part=${lesson.id}`, query)} data-testid="buffet-talk" data-coming={sequence && !lessonCanPlay(lesson) ? 'yes' : 'no'} style={tint ? artStyle(coverColor(course.id, lesson.id)) : undefined}>
              <span className={`thumb${still.fallback ? ' is-fallback' : ''}`} data-testid="talk-thumb">
                {still.src ? <img src={still.src} alt="" /> : null}
                {still.fallback ? <FilmFallback place={index + 1} title={name} /> : null}
              </span>
              <span className="t">
                <small>{sequence ? `Film ${index + 1}` : `Part ${index + 1}`}</small>
                <b className="talk-name">{name}</b>
                {week ? <small className="part-week" data-testid="part-week">{doorLabel(week)}</small> : null}
                {sequence ? <FilmChips seconds={secondsHere} done={done.has(lesson.id)} coming={!lessonCanPlay(lesson)} /> : <small>{secondsHere ? clock(secondsHere) : 'Length not known yet'}{done.has(lesson.id) ? ' · watched' : ''}</small>}
              </span>
              ›
            </Link>
          )
            })}
            </div>
          </section>
        ))}
        </div>
      </div>
      <LearnerTabBar base={base} active={sequence ? 'garden' : 'lanes'} portal={portal} unread={unread} />
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
  const sequence = isSequencePortal(portal)
  const showKinetic = kineticMomentsOn(portal) && (!ctx.demo || ctx.demo.state.features.kinetic)
  const course = await one(payload, 'courses', courseId)
  if (!course) notFound()
  if (!ctx.demo) {
    const visible = await visibleCourseIds(payload, user, portal.id)
    if (!visible.includes(courseId)) redirect(`${base}${sequence ? '' : '/lanes'}?error=${encodeURIComponent(sequence ? 'That film is not in this course.' : 'That course is not on your code. Ask your teacher if you would like it.')}`)
  }
  const [lessonRows, units, flags] = await Promise.all([
    rows(payload, 'lessons', { course: { equals: courseId } }, { sort: 'order' }),
    rows(payload, 'units', { course: { equals: courseId } }, { sort: 'order' }),
    masterFlags(payload),
  ])
  const unitRank = new Map(units.map((unit, index) => [unit.id, index]))
  const lessons = sortParts(lessonRows, (row) => unitRank.get(ref(row.unit) || 0) ?? 99).filter((row) => learnerLessonVisible({
    publishState: str(row.publishState),
    transcriptNote: str(row.transcriptNote),
    tooShort: row.tooShort === true,
    binned: row.binned === true,
  }))
  if (!lessons.length) redirect(`${base}${sequence ? '' : '/lanes'}?error=${encodeURIComponent(sequence ? 'No films yet.' : 'That course has no parts yet.')}`)
  if (!query.part) return CourseOverview(ctx, course, lessons)
  const partIndex = resolvePartIndex(lessons, query.part)
  const lesson = lessons[partIndex]
  const lessonId = lesson.id
  const demoDoneLesson = (row: Row) => Boolean(ctx.demo && ctx.demo.state.watches.some((watch) => watch.learner === ctx.demo!.cast.learner && watch.done && (watch.lessonId === row.id || watch.film === str(row.title))))
  if (sequence && portal.lockOrder === true && lessonCanPlay(lesson)) {
    const finishedIds = new Set<number>()
    if (!ctx.demo && partIndex > 0) {
      const earlierIds = lessons.slice(0, partIndex).filter(lessonCanPlay).map((row) => row.id)
      if (earlierIds.length) {
        const finished = await rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: earlierIds } }] }, { limit: earlierIds.length })
        for (const row of finished) {
          const id = ref(row.lesson)
          if (id) finishedIds.add(id)
        }
      }
    }
    const blocked = earlierPlayableUnfinished(lessons, partIndex, lessonCanPlay, (row) => ctx.demo ? demoDoneLesson(row) : finishedIds.has(row.id))
    if (blocked) {
      const locked = lockMessage(true, false, partIndex)
      if (ctx.demo) {
        const back = withDemoQuery(base, ctx.demo.token, ctx.demo.role)
        redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(locked || 'Watch the previous one first.')}`)
      }
      redirect(`${base}?error=${encodeURIComponent(locked || 'Watch the previous one first.')}`)
    }
  }

  const visits = ctx.demo ? [] : await rows(payload, 'lesson-visits', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, { limit: 1, sort: 'createdAt' })
  if (!ctx.demo && !visits.length) await payload.create({ collection: 'lesson-visits', overrideAccess: true, data: { user: user.id, lesson: lessonId, portal: portal.id } })
  if (ctx.demo && sequence) {
    const watched = reduceParentingDemo(ctx.demo.state, { type: 'watch', film: str(lesson.title), lessonId }, ctx.demo.cast)
    if (watched !== ctx.demo.state) {
      const { saveDemoRoom } = await import('@/server/parenting-demo')
      await saveDemoRoom(payload, { token: ctx.demo.token, cast: ctx.demo.cast, state: watched })
      ctx.demo.state = watched
    }
  }
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
  const mine = ctx.demo ? [] : await rows(payload, 'answers', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] })
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
      second: shownCalloutSecond(Number(point.second || 0), Number(lesson.durationSeconds || 0), sequence),
      prompt: shownQuestionPrompt(str(point.prompt), { sheet: sequence, index }),
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
  }).filter((view) => !sequence || view.prompt)

  const swarm: Record<number, SwarmItem[]> = {}
  let circleLabel = ''
  // Swarm answers are always on (Leon, 2026-10-04): initials, read-only, screened. Sharing your own answer stays a choice.
  // A sequenced course shows real shared answers and skips the HEARTS sample lines.
  const swarmOn = true
  const shareChoice = sequence || Boolean(user.shareWithLearners)
  if (points.length) {
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
      if (!sequence && !author?.shareWithLearners) continue
      const image = answer.image as { url?: string; id?: number } | null
      const imageSrc = image?.id ? `/api/hearts/file/${image.id}` : image?.url || null
      const name = author?.name || 'Someone in your circle'
      ;(swarm[pointId] ||= []).push({ name, body: str(answer.body) || str(answer.choice) || 'Shared a photo', image: imageSrc, initials: initialsOf(name), id: answer.id, kind: 'answer' })
    }
    if (!sequence) {
    const settings = await circleSettings(payload)
    circleLabel = settings.label
    const pointIds = points.map((point) => point.id)
    if (featureOn(portal, 'circle')) {
      // HEARTS circle answers fill the swarm while it is quiet and step back as real shared answers arrive.
      const circle = await circleForPoints(payload, pointIds, portal.id)
      for (const point of points) {
        if (str(point.family) === 'workbook') continue
        const extra = (circle.get(point.id) || []).map((row): SwarmItem => ({ name: row.name, body: row.body, circle: true, id: row.id, kind: 'circle-answer', initials: initialsOf(row.name) }))
        const hiddenCircle = await hiddenIds(payload, 'circle-answer', extra.map((row) => row.id!).filter(Boolean))
        const visibleExtra = extra.filter((row) => !row.id || !hiddenCircle.has(row.id))
        const mixed = mixSwarm(swarm[point.id] || [], visibleExtra, `${user.id}:${point.id}`, settings.threshold)
        if (mixed.length) swarm[point.id] = mixed
      }
    }
    const covered = await circleCoverage(payload, pointIds)
    for (const point of points) {
      if (str(point.family) === 'workbook') continue
      if (swarm[point.id]?.length || covered.has(point.id)) continue
      const options = Array.isArray(point.options) ? (point.options as unknown[]).map(String) : []
      swarm[point.id] = emptySwarmFill({ prompt: str(point.prompt), kind: str(point.kind) || 'reflection', options }, point.id).map((row) => ({
        name: row.name,
        body: row.body,
        circle: true,
        initials: initialsOf(row.name),
        kind: 'circle-answer' as const,
      }))
    }
    }
  }

  const [completions, partCuts, doors] = await Promise.all([
    ctx.demo
      ? Promise.resolve(lessons.filter((row) => demoDoneLesson(row)).map((row) => ({ lesson: row.id, sourceLevel: 'talk' })))
      : rows(payload, 'completions', { and: [{ user: { equals: user.id } }, { lesson: { in: lessonIds } }] }),
    lessonIds.length ? rows(payload, 'cuts', { and: [{ lesson: { in: lessonIds } }, { status: { not_equals: 'rejected' } }] }, { limit: 300 }) : Promise.resolve([] as Row[]),
    sequence ? Promise.resolve([] as Door[]) : loadDoors(payload),
  ])
  const { doneLessons, done, total } = courseProgress({ lessonIds, completions: completions.filter((row) => countsTowardProgress({ level: pieceLevel(row.sourceLevel), inCourse: true, event: 'watch' })), pointIds: allPoints.map((point) => point.id), answers: mine })

  const marks = mine.length
    ? await rows(payload, 'feedback-notes', { answer: { in: mine.map((row) => row.id) } }, { sort: 'second' })
    : []
  const coming = sequence && !lessonCanPlay(lesson)
  const provider = str(lesson.videoProvider)
  const vimeoId = coming ? null : str(lesson.vimeoId) || null
  const youtubeId = coming || provider === 'vimeo' || provider === 'file' ? null : str(lesson.youtubeId) || null
  const film = coming ? null : provider === 'vimeo' && vimeoId ? { provider: 'vimeo' as const, vimeoId, vimeoHash: str(lesson.vimeoHash) || null } : provider === 'file' ? { provider: 'file' as const, src: `/api/hearts/film/${lessonId}` } : null
  let startAt = Math.max(0, Number(query.t || 0)) || 0
  let showResume = false
  if (sequence && (query.t == null || query.t === '')) {
    const sessions = await rows(payload, 'watch-sessions', { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, { sort: '-createdAt', limit: 1 })
    const resumed = resumeChoice(Number(sessions[0]?.position || 0), Number(lesson.durationSeconds || 0))
    startAt = resumed || 0
    showResume = resumed != null
  }
  const contextOn = query.context === '1'
  const spoken = contextOn ? lineAt(str(lesson.transcript), startAt) : null
  const unread = await unreadCount(payload, user)
  const here = withCurrentQuery(`${base}/course/${courseId}?part=${lessonId}`, query)
  const courseHref = withCurrentQuery(`${base}/course/${courseId}`, query)
  const nextAt = sequence ? lessons.findIndex((row, index) => index > partIndex && lessonCanPlay(row)) : (partIndex + 1 < lessons.length ? partIndex + 1 : -1)
  const nextLesson = nextAt >= 0 ? lessons[nextAt] : null
  const prevAt = sequence
    ? (() => { for (let index = partIndex - 1; index >= 0; index -= 1) if (lessonCanPlay(lessons[index])) return index; return -1 })()
    : (partIndex > 0 ? partIndex - 1 : -1)
  const prevLesson = prevAt >= 0 ? lessons[prevAt] : null
  const following = nextLesson ? { label: sequence ? `Film ${nextAt + 1} · Next` : nextPartLabel(nextAt + 1), href: withCurrentQuery(`${base}/course/${courseId}?part=${nextLesson.id}`, query) } : null
  const sequenceLabel = (index: number, row: Row) => filmLabel(index, str(row.title))
  const upNext = nextLesson && following
    ? { href: following.href, label: sequence ? sequenceLabel(nextAt, nextLesson) : following.label, minutes: Math.max(1, Math.round(Number(nextLesson.durationSeconds || 0) / 60)), last: false }
    : { href: courseHref, label: sequence ? SEQUENCE_COPY.back : lastPartCopy(lessons.length), minutes: 0, last: true }
  const progress = sequenceProgress(doneLessons.size, lessons.length)
  const callout = sequence ? partCuts.find((row) => ref(row.lesson) === lessonId) : null
  const kineticTier = sequence && showKinetic ? await kineticClipFor(payload, lessonId) : null
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

  const playerLook = await appleLookOnServer()
  const playerArt = playerLook ? coverColor(courseId, lesson.id) : ''
  return (
    <AppFrame testId="course" evening help={sequence ? 'sequence-course' : undefined} brand={learnerBrand(portal)} art={playerArt || null}>
      <div className="app-scroll">
        {ctx.demo ? <DemoFrameTools token={ctx.demo.token} role={ctx.demo.role} cast={ctx.demo.cast} seq={ctx.demo.state.seq} /> : null}
        <Flash error={query.error} notice={query.notice} />
        {ctx.demo && ctx.demo.state.features.notes && ctx.demo.state.notes[0] ? <p className="card" data-testid="demo-note">{ctx.demo.state.notes[0].from}: {ctx.demo.state.notes[0].body}</p> : null}
        {ctx.demo && ctx.demo.state.features.plan ? <p className="card" data-testid="demo-plan">This week: watch one film.</p> : null}
        {contextOn && !sequence ? (
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
          courseTitle={sequence ? str(course.title) : tidyTalkTitle(str(course.title))}
          backHref={sequence ? `${base}/course/${courseId}` : withCurrentQuery(`${base}/lanes`, query)}
          lessonId={lessonId}
          partLabel={sequence ? sequenceLabel(partIndex, lesson) : partHeading(partIndex + 1, lesson, tidyTalkTitle(str(course.title)), lessons.length)}
          youtubeId={youtubeId}
          film={film}
          poster={playerLook ? coverPath('film', lesson.id) : (shownPoster(filmPoster(lesson)) || (sequence ? null : portraitFor(slugify(str(lesson.speaker || course.speaker)))))}
          films={sequence}
          duration={Number(lesson.durationSeconds || 0)}
          startAt={startAt}
          points={withGather}
          swarm={swarm}
          swarmOn={swarmOn}
          shareChoice={shareChoice}
          circleLabel={circleLabel}
          serverNow={at.toISOString()}
          next={here}
          overPlayer={flags.popupOverPlayer}
          upNext={upNext}
          courseHref={courseHref}
          deferred={deferred}
          initialOpenId={Number(query.answer) || deferred[0]?.pointId || null}
          sentences={showKinetic ? parseTrack(lesson.framingTrack)?.sentences || [] : []}
          progressCard={sequence && (!ctx.demo || ctx.demo.state.features.progress) ? { eyebrow: progress.eyebrow, line: ctx.demo ? `${watchedCount(ctx.demo.state, ctx.demo.cast.learner)} of ${lessons.length} films` : progress.line, backLabel: progress.back, backHref: ctx.demo ? withDemoQuery(`${base}/course/${courseId}`, ctx.demo.token, ctx.demo.role) : `${base}/course/${courseId}` } : null}
          saveOnEnd={sequence}
          showResume={showResume}
          clipEnd={sequence && showKinetic && query.clip === '1' && kineticTier ? kineticTier.end : null}
          videoComing={coming}
          shareUrl={sequence ? `${ctx.origin}${base}/course/${courseId}?part=${lessonId}` : null}
          guest={false}
          garden={{ done: sequence ? doneLessons.size : done, total: sequence ? lessons.length : total, gardenHref: withCurrentQuery(featureOn(portal, 'garden') && shellOf(portal) === 'hearts' ? `${base}/garden` : `${base}/courses`, query), nextPart: following, prevPart: sequence && prevLesson ? { label: `Film ${prevAt + 1} · Previous`, href: withCurrentQuery(`${base}/course/${courseId}?part=${prevLesson.id}`, query) } : null, links: [
            ...(featureOn(portal, 'garden') && shellOf(portal) === 'hearts' ? [{ label: "See what you've sown", href: withCurrentQuery(`${base}/garden/general`, query) }] : []),
            ...(featureOn(portal, 'workbook') ? [{ label: sequence ? 'Workbook' : 'Your workbook', href: sequence && shellOf(portal) === 'modern' ? `${base}/workbook` : withCurrentQuery(`${base}/garden/workbook`, query) }] : []),
          ] }}
        />
        {sequence && showKinetic && kineticTier ? (
          <section className="card" data-testid="kinetic-clip" data-start={kineticTier.start} data-end={kineticTier.end}>
            <p><b>Kinetic text.</b> {kineticTier.quote}</p>
            <Link href={`${base}/course/${courseId}?part=${lessonId}&t=${kineticTier.start}&clip=1`} data-testid="kinetic-play">{SEQUENCE_COPY.playClip}</Link>
          </section>
        ) : null}
        {sequence && callout ? (
          <section className="card" data-testid="sequence-callouts">
            <p data-testid="callout-hook"><b>{SEQUENCE_COPY.opening}.</b> {str(callout.hook)}</p>
            <p data-testid="callout-turn"><b>{SEQUENCE_COPY.turn}.</b> {str(callout.turn)}</p>
            <p data-testid="callout-land"><b>{SEQUENCE_COPY.landing}.</b> {str(callout.land)}</p>
            <Link href={`${base}/course/${courseId}?part=${lessonId}&t=${Number(callout.start || 0)}`} data-testid="play-clip">{SEQUENCE_COPY.playClip}</Link>
          </section>
        ) : null}
        {sequence && views[0] ? <p data-testid="sequence-question"><b>{SEQUENCE_COPY.question}.</b> {views[0].prompt}</p> : null}
        <ParentSaidLine rows={readSaidAnswers((course as { sampleAnswers?: unknown }).sampleAnswers)} order={Number(lesson.order || partIndex + 1)} prompt={views[0]?.prompt || ''} />
        {sequence && ctx.demo ? (
          <form className="form-stack card" action="/api/hearts/demo" method="post" data-testid="demo-answer-form">
            <Hidden fields={{
              action: 'answer',
              demo: ctx.demo.token,
              demoAs: 'learner',
              film: str(lesson.title),
              lessonId,
              prompt: views[0]?.prompt || 'What will you try from this film?',
              next: withDemoQuery(`${base}/course/${courseId}?part=${lessonId}`, ctx.demo.token, ctx.demo.role),
            }} />
            {ctx.demo.state.answers.filter((row) => row.learner === ctx.demo!.cast.learner && (row.lessonId === lessonId || row.film === str(lesson.title))).map((row) => (
              <p key={row.id} data-testid="demo-saved-answer"><b>Your answer.</b> {row.body}{row.reply ? ` Reply: ${row.reply}` : ''}</p>
            ))}
            <label className="row top"><span>Your answer</span><textarea name="body" required rows={3} data-testid="demo-answer-text" placeholder="Write what you will try" /></label>
            <button className="pill ink" type="submit" data-testid="demo-answer-send">Send answer</button>
          </form>
        ) : null}
        {!sequence && related[0] ? <TalkGatherNotice startsAt={related[0].startsAt} href={`${base}/gather/${related[0].id}`} title={related[0].title} /> : null}
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
        {featureOn(portal, 'planner') ? <p style={{ margin: '16px 0 0' }}><Link className="pill outline" href={withCurrentQuery(`${base}/week?course=${courseId}&view=new&from=course`, query)} data-testid={lessons.length >= 2 ? 'plan-rest' : 'schedule-this'}>{lessons.length >= 2 ? 'Plan the rest of this course' : sequence ? 'Schedule this film' : 'Schedule this talk'}</Link></p> : null}
        <p className="eyebrow">{sequence ? 'Films' : 'Parts of this course'}</p>
        {lessons.map((row, index) => {
          const week = partWeek(row, partCuts, doors, str(course.title))
          const poster = sequence ? shownPoster(filmPoster(row)) : null
          return (
            <Link key={row.id} className={`part-row${sequence ? ' film-row' : ''}`} href={withCurrentQuery(`${base}/course/${courseId}?part=${row.id}`, query)} data-testid="part-link" aria-current={row.id === lessonId ? 'page' : undefined}>
              {sequence ? (
                <span className={`thumb${poster ? '' : ' is-fallback'}`} data-testid="talk-thumb">
                  {poster ? <img src={poster} alt="" /> : <FilmFallback place={index + 1} title={partTitle(row, str(course.title))} />}
                </span>
              ) : null}
              <span className="grow">
                {sequence ? sequenceLabel(index, row) : partHeading(index + 1, row, tidyTalkTitle(str(course.title)), lessons.length)}
                {week ? <small className="part-week" data-testid="part-week">{doorLabel(week)}</small> : null}
                {sequence ? <FilmChips seconds={Number(row.durationSeconds || 0)} done={doneLessons.has(row.id)} /> : <small>{row.durationSeconds ? clock(Number(row.durationSeconds)) : 'Length not known yet'}{doneLessons.has(row.id) ? ' · watched' : ''}</small>}
              </span>
              {row.id === lessonId ? <span className="part-status" data-testid="part-playing">Playing</span> : <span className="part-chevron" aria-hidden="true">›</span>}
            </Link>
          )
        })}
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
      <LearnerTabBar base={base} active={sequence ? 'home' : 'lanes'} portal={portal} unread={unread} />
    </AppFrame>
  )
}

function ParentSaidLine({ rows, order, prompt }: { rows: ReturnType<typeof readSaidAnswers>; order: number; prompt: string }) {
  const shown = saidForFilm(rows, order, prompt)
  const phases = [...new Set(shown.map((row) => row.phase))]
  if (!phases.length) return null
  return (
    <>
      {phases.slice(0, 2).map((phase) => {
        const line = shown.find((row) => row.phase === phase)
        if (!line) return null
        const text = line.text.length > 140 ? `${line.text.slice(0, 137)}...` : line.text
        return <p key={phase} data-testid="parent-said"><b>{line.label || phaseLabel(phase)}.</b> {text}</p>
      })}
    </>
  )
}
