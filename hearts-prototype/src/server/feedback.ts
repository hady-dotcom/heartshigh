import type { Payload } from 'payload'
import {
  FAMILY_LABEL,
  asDraft,
  assessQuestion,
  buildFeedback,
  familyOfPoint,
  feedbackCsv,
  feedbackPdf,
  feedbackXlsx,
  themesFromAnswers,
  type BuiltFeedback,
  type DigestSummary,
  type Family,
  type FeedbackFilters,
  type RawFeedback,
} from '@/lib/feedback'
import { doorLabel, doorOfClause, type Door } from '@/lib/doors'
import { idOf } from '@/lib/ids'
import { schemaProblems, type TalkContext } from '@/lib/ai-steps'
import { ensureSteps, loadLiveStep, runPreparedStep } from './ai-desk'
import { loadDoors } from './doors'
import { audit } from './viewas'

type Doc = Record<string, unknown> & { id: number }
const col = (name: string) => name as 'users'

export type FeedbackActor = { id: number; role?: string | null; name?: string | null }

async function many(payload: Payload, collection: string, where?: Record<string, unknown>, limit = 2000) {
  const found = await payload.find({
    collection: col(collection),
    overrideAccess: true,
    depth: 0,
    limit,
    pagination: false,
    where: where as never,
  })
  return found.docs as unknown as Doc[]
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function dateOf(row: Doc) {
  return textOf(row.answeredAt) || textOf(row.createdAt) || new Date(0).toISOString()
}

export async function loadRawFeedback(payload: Payload, portalId: number): Promise<RawFeedback[]> {
  const [answers, messages, entries, doors, liveQuestions] = await Promise.all([
    many(payload, 'answers', { portal: { equals: portalId } }),
    many(payload, 'messages', { portal: { equals: portalId } }),
    many(payload, 'workbook-entries', { portal: { equals: portalId } }),
    loadDoors(payload),
    many(payload, 'live-questions', { and: [{ portal: { equals: portalId } }, { hidden: { not_equals: true } }] }),
  ])
  const pointIds = [...new Set(answers.map((row) => idOf(row.point)).filter((id): id is number => Boolean(id)))]
  const userIds = [...new Set([...answers.map((row) => idOf(row.user)), ...messages.map((row) => idOf(row.author))].filter((id): id is number => Boolean(id)))]
  const lessonIds = [...new Set(answers.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))]
  const [points, users, lessons, cuts] = await Promise.all([
    pointIds.length ? many(payload, 'engagement-points', { id: { in: pointIds } }) : Promise.resolve([]),
    userIds.length ? many(payload, 'users', { id: { in: userIds } }) : Promise.resolve([]),
    lessonIds.length ? many(payload, 'lessons', { id: { in: lessonIds } }) : Promise.resolve([]),
    lessonIds.length ? many(payload, 'cuts', { lesson: { in: lessonIds } }) : Promise.resolve([]),
  ])
  const courseIds = [...new Set(lessons.map((row) => idOf(row.course)).filter((id): id is number => Boolean(id)))]
  const seatIds = [...new Set(cuts.map((row) => idOf(row.seat)).filter((id): id is number => Boolean(id)))]
  const [courses, seats] = await Promise.all([
    courseIds.length ? many(payload, 'courses', { id: { in: courseIds } }) : Promise.resolve([]),
    seatIds.length ? many(payload, 'seats', { id: { in: seatIds } }) : Promise.resolve([]),
  ])
  const pointById = new Map(points.map((row) => [row.id, row]))
  const userById = new Map(users.map((row) => [row.id, row]))
  const lessonById = new Map(lessons.map((row) => [row.id, row]))
  const courseById = new Map(courses.map((row) => [row.id, row]))
  const seatById = new Map(seats.map((row) => [row.id, row]))
  const replyByAnswer = new Map<number, string>()
  for (const entry of entries) {
    const answerId = idOf(entry.answer)
    const reply = textOf(entry.teacherReply)
    if (answerId && reply) replyByAnswer.set(answerId, reply)
  }
  const cutByLesson = new Map<number, Doc>()
  for (const cut of cuts) {
    const lessonId = idOf(cut.lesson)
    if (!lessonId || !Number(cut.bestClause)) continue
    const current = cutByLesson.get(lessonId)
    if (!current || (cut.status === 'approved' && current.status !== 'approved')) cutByLesson.set(lessonId, cut)
  }

  const rows: RawFeedback[] = []
  for (const answer of answers) {
    const point = pointById.get(idOf(answer.point) || 0)
    const user = userById.get(idOf(answer.user) || 0)
    const lessonId = idOf(answer.lesson) || idOf(point?.lesson)
    const lesson = lessonId ? lessonById.get(lessonId) : undefined
    const course = lesson ? courseById.get(idOf(lesson.course) || 0) : undefined
    const cut = lessonId ? cutByLesson.get(lessonId) : undefined
    const seat = cut ? seatById.get(idOf(cut.seat) || 0) : undefined
    const door = placeDoor(Number(cut?.bestClause || 0), doors)
    const family = familyOfPoint({ kind: textOf(point?.kind), family: textOf(point?.family) })
    const body = textOf(answer.body) || textOf(answer.choice)
    rows.push({
      id: `answer-${answer.id}`,
      portalId,
      keepPrivate: answer.keepPrivate === true,
      shareWithTeacher: answer.shareWithTeacher === true,
      showImam: point?.showImam === true,
      text: body,
      date: dateOf(answer),
      learnerId: user?.id || 0,
      learnerName: textOf(user?.name) || 'Learner',
      learnerEmail: textOf(user?.email),
      accessCodeId: idOf(user?.accessCode),
      doorNumber: door?.number ?? null,
      door: door ? doorLabel(door) : '',
      seatId: seat?.id ?? null,
      seat: seat ? `(${seat.position}) ${textOf(seat.text)}` : textOf(cut?.seatHint),
      courseId: course?.id ?? null,
      course: textOf(course?.title),
      talkId: lesson?.id ?? null,
      talk: textOf(lesson?.title),
      questionId: point?.id ?? null,
      question: textOf(point?.prompt) || 'Question',
      family,
      reply: replyByAnswer.get(answer.id) || '',
    })
  }
  for (const message of messages) {
    const user = userById.get(idOf(message.author) || 0)
    rows.push({
      id: `circle-${message.id}`,
      portalId,
      keepPrivate: false,
      shareWithTeacher: true,
      showImam: false,
      text: textOf(message.body),
      date: dateOf(message),
      learnerId: user?.id || 0,
      learnerName: textOf(user?.name) || 'Someone in the circle',
      learnerEmail: textOf(user?.email),
      accessCodeId: idOf(user?.accessCode),
      doorNumber: null,
      door: 'Circle',
      seatId: null,
      seat: '',
      courseId: null,
      course: '',
      talkId: null,
      talk: 'Circle board',
      questionId: null,
      question: 'A note for the circle',
      family: 'circle',
      reply: '',
    })
  }
  if (liveQuestions.length) {
    const sessionIds = [...new Set(liveQuestions.map((row) => idOf(row.session)).filter((id): id is number => Boolean(id)))]
    const extraUserIds = [...new Set(liveQuestions.map((row) => idOf(row.author)).filter((id): id is number => Boolean(id)))]
    const [sessions, liveUsers] = await Promise.all([
      sessionIds.length ? many(payload, 'live-sessions', { id: { in: sessionIds } }) : Promise.resolve([]),
      extraUserIds.length ? many(payload, 'users', { id: { in: extraUserIds } }) : Promise.resolve([]),
    ])
    const sessionById = new Map(sessions.map((row) => [row.id, row]))
    const liveUserById = new Map(liveUsers.map((row) => [row.id, row]))
    for (const question of liveQuestions) {
      const session = sessionById.get(idOf(question.session) || 0)
      const user = liveUserById.get(idOf(question.author) || 0)
      const door = doors.find((item) => item.number === Number(session?.door || 0))
      rows.push({
        id: `live-${question.id}`,
        portalId,
        keepPrivate: false,
        shareWithTeacher: true,
        showImam: true,
        text: textOf(question.body),
        date: dateOf(question),
        learnerId: user?.id || 0,
        learnerName: textOf(user?.name) || textOf(question.authorName) || 'Learner',
        learnerEmail: textOf(user?.email),
        accessCodeId: idOf(user?.accessCode),
        doorNumber: door?.number ?? null,
        door: door ? doorLabel(door) : 'Live',
        seatId: null,
        seat: '',
        courseId: null,
        course: '',
        talkId: idOf(session?.replayLesson),
        talk: textOf(session?.title) || 'Live session',
        questionId: question.id,
        question: session ? `Asked live: ${textOf(session.title)}` : 'Asked live',
        family: 'live',
        reply: '',
      })
    }
  }
  return rows
}

function placeDoor(clause: number, doors: Door[]) {
  return doorOfClause(clause, doors)
}

export async function feedbackFor(payload: Payload, portalId: number, filters: FeedbackFilters, anonymised: boolean) {
  const raw = await loadRawFeedback(payload, portalId)
  return buildFeedback(raw, portalId, filters, anonymised)
}

export async function includedSummaries(payload: Payload, portalId: number, built: BuiltFeedback): Promise<DigestSummary[]> {
  const rows = await many(payload, 'feedback-summaries', { and: [{ portal: { equals: portalId } }, { status: { equals: 'included' } }] })
  const wanted = new Set(built.doors.flatMap((door) => door.talks.flatMap((talk) => talk.questions.map((question) => question.key))))
  return rows
    .map((row) => ({
      questionKey: textOf(row.questionKey),
      themes: stringList(row.themes),
      quotes: stringList(row.quotes),
    }))
    .filter((row) => row.questionKey && wanted.has(row.questionKey) && row.themes.length)
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => textOf(item)).filter(Boolean) : []
}

export async function recordExport(payload: Payload, actor: FeedbackActor, portalId: number, format: string, filters: FeedbackFilters, built: BuiltFeedback) {
  await audit(payload, 'feedback.export', {
    actor: actor.id,
    actorRole: actor.role,
    portal: portalId,
    reason: built.anonymised ? 'Anonymised export' : 'Named export',
    detail: { format, filters, named: !built.anonymised, rows: built.sharedCount, privateCount: built.privateCount },
  })
}

export async function renderExport(built: BuiltFeedback, format: string, summaries: DigestSummary[], digest: { portal: string; from?: string | null; to?: string | null } = { portal: 'This portal' }) {
  if (format === 'csv') return { body: feedbackCsv(built), type: 'text/csv; charset=utf-8', ext: 'csv' }
  if (format === 'xlsx') return { body: await feedbackXlsx(built), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' }
  if (format === 'pdf') return { body: feedbackPdf(built, summaries, digest), type: 'application/pdf', ext: 'pdf' }
  return null
}

const EMPTY_TALK: TalkContext = {
  title: '',
  speaker: '',
  duration: 0,
  transcript: '',
  hook: '',
  turn: '',
  land: '',
  landAt: 0,
  clauseCards: '',
  rubric: '',
  clip: '',
}

export async function draftQuestionSummary(payload: Payload, actor: FeedbackActor, portalId: number, built: BuiltFeedback, questionKey: string) {
  const question = built.doors.flatMap((door) => door.talks.flatMap((talk) => talk.questions)).find((item) => item.key === questionKey)
  if (!question) return { error: 'That question is not in this view.' }
  if (!question.answers.length) return { error: 'There are no shared answers to summarise.' }
  const talkTitle = built.doors.flatMap((door) => door.talks).find((talk) => talk.questions.some((item) => item.key === questionKey))
  const answers = question.answers.map((answer) => answer.text).join('\n')
  const talk: TalkContext = {
    ...EMPTY_TALK,
    title: talkTitle?.talk || 'A talk',
    transcript: answers,
    question: question.question,
    answers,
    family: question.familyLabel,
  }
  await ensureSteps(payload)
  const ran = await runPreparedStep(payload, 'feedback-summary', talk)
  let themes = stringList((ran.output as { themes?: unknown })?.themes)
  let quotes = stringList((ran.output as { quotes?: unknown })?.quotes)
  if (ran.problems.length || !themes.length) {
    const fallback = themesFromAnswers(answers)
    themes = fallback.themes
    quotes = fallback.quotes
  }
  themes = themes.slice(0, 5)
  quotes = quotes.slice(0, 3)
  const created = (await payload.create({
    collection: col('feedback-summaries'),
    overrideAccess: true,
    data: asDraft({
      point: question.questionId || undefined,
      questionKey,
      themes,
      quotes,
      status: 'draft',
      stepSlug: 'feedback-summary',
      versionNumber: ran.versionNumber,
      author: actor.id,
      portal: portalId,
    }) as never,
  })) as unknown as Doc
  return { id: created.id, themes, quotes }
}

export async function includeSummary(payload: Payload, portalId: number, id: number) {
  const row = (await payload.findByID({ collection: col('feedback-summaries'), id, depth: 0, overrideAccess: true }).catch(() => null)) as Doc | null
  if (!row || idOf(row.portal) !== portalId) return { error: 'That summary is not in this portal.' }
  await payload.update({ collection: col('feedback-summaries'), id, overrideAccess: true, data: { status: 'included' } as never })
  return { ok: true }
}

export async function summariesFor(payload: Payload, portalId: number) {
  return many(payload, 'feedback-summaries', { portal: { equals: portalId } }, 200)
}

export type WeakQuestion = {
  id: number
  pointId: number
  prompt: string
  talk: string
  family: string
  reasons: string[]
  rewrite: string
  status: 'draft'
}

export async function weakQuestions(payload: Payload): Promise<WeakQuestion[]> {
  const rows = await many(payload, 'question-rewrites', undefined, 500)
  return rows
    .map((row) =>
      asDraft({
        id: row.id,
        pointId: idOf(row.point) || 0,
        prompt: textOf(row.prompt),
        talk: textOf(row.talk),
        family: textOf(row.family),
        reasons: stringList(row.reasons),
        rewrite: textOf(row.rewrite),
        status: 'draft' as const,
      }),
    )
    .sort((a, b) => a.talk.localeCompare(b.talk) || a.prompt.localeCompare(b.prompt))
}

/** Runs the question-value step over imported questions and stores suggested rewrites as drafts only. */
export async function checkQuestions(payload: Payload, actor: FeedbackActor) {
  await ensureSteps(payload)
  const live = await loadLiveStep(payload, 'question-value')
  const points = await many(payload, 'engagement-points', { status: { not_equals: 'rejected' } }, 800)
  const lessonIds = [...new Set(points.map((point) => idOf(point.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? await many(payload, 'lessons', { id: { in: lessonIds } }) : []
  const lessonTitle = new Map(lessons.map((lesson) => [lesson.id, textOf(lesson.title) || 'A talk']))
  const existing = await many(payload, 'question-rewrites', undefined, 800)
  const already = new Set(existing.map((row) => `${idOf(row.point)}|${textOf(row.prompt)}`))
  let flagged = 0
  for (const point of points) {
    const prompt = textOf(point.prompt)
    if (!prompt) continue
    const family = familyOfPoint({ kind: textOf(point.kind), family: textOf(point.family) })
    const talkTitle = lessonTitle.get(idOf(point.lesson) || 0) || 'A talk'
    if (already.has(`${point.id}|${prompt}`)) continue
    const talk: TalkContext = { ...EMPTY_TALK, title: talkTitle, transcript: prompt, question: prompt, family: FAMILY_LABEL[family] }
    const ran = await live.run(talk)
    const output = ran.output as { weak?: unknown; reasons?: unknown; rewrite?: unknown }
    const problems = schemaProblems({ type: 'object', properties: { weak: { type: 'boolean' }, reasons: { type: 'array', items: { type: 'string' } }, rewrite: { type: 'string' } }, required: ['weak', 'reasons', 'rewrite'] }, output)
    const fallback = assessQuestion({ prompt, talk: talkTitle, options: Array.isArray(point.options) ? point.options.map(String) : [] })
    const weak = problems.length ? fallback.weak : Boolean(output.weak)
    if (!weak) continue
    const reasons = problems.length ? fallback.reasons : stringList(output.reasons)
    const rewrite = problems.length ? fallback.rewrite : textOf(output.rewrite) || fallback.rewrite
    await payload.create({
      collection: col('question-rewrites'),
      overrideAccess: true,
      data: asDraft({
        point: point.id,
        prompt,
        talk: talkTitle,
        family: FAMILY_LABEL[family as Family],
        reasons: reasons.length ? reasons : fallback.reasons,
        rewrite: rewrite || fallback.rewrite,
        status: 'draft',
        author: actor.id,
      }) as never,
    })
    flagged += 1
  }
  return { checked: points.length, flagged }
}

export async function exportAudit(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'audit-log',
    overrideAccess: true,
    depth: 1,
    limit: 30,
    sort: '-createdAt',
    where: { and: [{ event: { equals: 'feedback.export' } }, { portal: { equals: portalId } }] },
  })
  return found.docs as unknown as Doc[]
}

export function exportFilename(anonymised: boolean, ext: string) {
  return `feedback-${anonymised ? 'anonymised' : 'named'}.${ext}`
}
