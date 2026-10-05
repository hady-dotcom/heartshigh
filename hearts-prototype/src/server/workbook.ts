import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { idOf, portalIdOf } from '@/lib/ids'
import type { SessionUser } from './context'
import { recordOpeningAttempt } from './compass'
import { partTitle } from '@/lib/talk-title'
import { pointVisibleWhere, showUncheckedTalks } from './opening'

type Row = Record<string, unknown> & { id: number }

export type OpeningTap = { sceneKey: string; optionKey: string; answeredAt?: string | number }

/**
 * Writes the six opening rows once (spec 2.10). Labels and privacy come from the published scenes; the client
 * cannot set either. The crisis option never makes a row: that scene shows the later answer, or 'Not reached'.
 */
export async function writeOpening(payload: Payload, user: SessionUser, portalId: number, scenesVersion: number, taps: OpeningTap[]) {
  const live = await payload.find({ collection: 'opening-answers', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: user.id } }, { supersededAt: { exists: false } }] } })
  if (live.docs.length) return { written: 0, already: true }
  const scenes = ((await payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 20, sort: 'order', where: { status: { equals: 'published' } } })).docs as unknown as Row[])
  const config = (await payload.find({ collection: 'opening-configs', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } })).docs[0] as unknown as Row | undefined
  const hidden = new Set(((config?.hiddenScenes as unknown[]) || []).map((item) => idOf(item)))
  const wording = new Map(((config?.wording as { scene?: unknown; labels?: Record<string, string> }[]) || []).map((row) => [idOf(row.scene), row.labels || {}]))
  const mentors = await mentorsOf(payload, user, portalId)
  const recordedAt = now().toISOString()
  let written = 0
  for (const scene of scenes.filter((row) => !hidden.has(row.id))) {
    const tap = taps.find((row) => row.sceneKey === scene.key)
    const options = (scene.options as { key: string; label: string; crisis?: boolean; sensitivity?: string }[]) || []
    const option = tap && tap.optionKey !== 'pass' ? options.find((row) => row.key === tap.optionKey && !row.crisis) : undefined
    const optionKey = option ? option.key : tap?.optionKey === 'pass' ? 'pass' : 'not-reached'
    const isPrivate = option ? option.sensitivity === 'private' : false
    const label = option ? wording.get(scene.id)?.[option.key] || option.label : optionKey === 'pass' ? 'Passed' : 'Not reached'
    const answeredAt = tap?.answeredAt ? new Date(tap.answeredAt).toISOString() : undefined
    await payload.create({
      collection: 'opening-answers',
      overrideAccess: true,
      data: {
        user: user.id,
        portal: portalId,
        scene: scene.id,
        sceneKey: scene.key,
        optionKey,
        labelSnapshot: label,
        private: isPrivate,
        staffVisible: Boolean(user.shareOpening) && !isPrivate,
        mentors,
        scenesVersion,
        answeredAt,
        recordedAt,
      } as never,
    })
    written += 1
  }
  if (written) await recordOpeningAttempt(payload, user.id, portalId, taps)
  return { written, already: false }
}

/** Teachers linked to the learner's access code, or every teacher in the portal when there is no link. */
export async function mentorsOf(payload: Payload, learner: SessionUser, portalId: number) {
  const codeId = idOf(learner.accessCode)
  const code = codeId ? ((await payload.findByID({ collection: 'access-codes', id: codeId, overrideAccess: true, depth: 0 }).catch(() => null)) as Row | null) : null
  const teacherCode = code ? idOf(code.linkedTeacherCode) : null
  const where = teacherCode ? { accessCode: { equals: teacherCode } } : { and: [{ role: { equals: 'teacher' } }, { 'tenants.tenant': { equals: portalId } }] }
  const found = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 20, where: where as never })
  return found.docs.map((doc) => doc.id)
}

export async function startAgain(payload: Payload, userId: number) {
  const rows = await payload.find({ collection: 'opening-answers', overrideAccess: true, depth: 0, limit: 50, where: { and: [{ user: { equals: userId } }, { supersededAt: { exists: false } }] } })
  for (const row of rows.docs) await payload.update({ collection: 'opening-answers', id: row.id, overrideAccess: true, data: { supersededAt: now().toISOString(), staffVisible: false } as never })
  await payload.delete({ collection: 'heart-states', overrideAccess: true, where: { user: { equals: userId } } })
}

export type WorkbookOpeningRow = { sceneKey: string; caption: string; label: string; state: 'answered' | 'passed' | 'not-reached'; private: boolean }
export type WorkbookAnswer = {
  id: number
  entryId: number | null
  atSecond: number | null
  course: { id: number; title: string } | null
  topic: string
  video: { id: number; title: string } | null
  pointId: number
  question: string
  answer: string
  answeredAt: string | null
  correct: boolean | null
  shared: boolean
  reply: string | null
  kind: string
  imageId: number | null
  audioId: number | null
  videoId: number | null
}
export type WorkbookOpen = { pointId: number; question: string; video: string; lessonId: number; courseId: number; second: number; kind: string; family: string; evidence: string; dueDays: number | null; showImam: boolean }
export type Workbook = { learner: { id: number; name: string }; opening: WorkbookOpeningRow[]; answers: WorkbookAnswer[]; open: WorkbookOpen[] }

const plainCaption = (text: string) => text.replace(/\*\*/g, '')

/**
 * The workbook as a view (spec 2.10). Opening rows and answers are read through the collections' own access
 * rules as `reader`, so private opening rows only ever reach their owner, including during view-as.
 */
export async function workbookFor(payload: Payload, learner: SessionUser, reader: SessionUser): Promise<Workbook> {
  const asReader = { overrideAccess: false, user: reader as never }
  const scenes = ((await payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 20, sort: 'order' })).docs as unknown as Row[])
  const rows = (await payload.find({ collection: 'opening-answers', ...asReader, depth: 0, limit: 50, where: { and: [{ user: { equals: learner.id } }, { supersededAt: { exists: false } }] } })).docs as unknown as Row[]
  const opening = rows
    .map((row) => {
      const scene = scenes.find((item) => item.key === row.sceneKey)
      const state: WorkbookOpeningRow['state'] = row.optionKey === 'pass' ? 'passed' : row.optionKey === 'not-reached' ? 'not-reached' : 'answered'
      return { order: Number(scene?.order || 9), sceneKey: String(row.sceneKey), caption: plainCaption(String(scene?.caption || row.sceneKey)), label: state === 'answered' ? String(row.labelSnapshot) : state === 'passed' ? 'Passed' : 'Not reached', state, private: Boolean(row.private) }
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...row }) => row)

  const answers = (await payload.find({ collection: 'answers', ...asReader, depth: 0, limit: 500, sort: '-createdAt', where: { user: { equals: learner.id } } })).docs as unknown as Row[]
  const pointIds = [...new Set(answers.map((row) => idOf(row.point)).filter((id): id is number => Boolean(id)))]
  const [visits, sessions, completions] = await Promise.all([
    payload.find({ collection: 'lesson-visits', overrideAccess: true, depth: 0, limit: 200, where: { user: { equals: learner.id } } }),
    payload.find({ collection: 'watch-sessions', overrideAccess: true, depth: 0, limit: 200, where: { user: { equals: learner.id } } }),
    payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 200, where: { user: { equals: learner.id } } }),
  ])
  const visitRows = visits.docs as unknown as Row[]
  const sessionRows = sessions.docs as unknown as Row[]
  const doneRows = completions.docs as unknown as Row[]
  const played = new Set(sessionRows.filter((row) => Number(row.seconds || 0) > 0).map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))
  const opened = new Set(visitRows.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))
  const finished = new Set(doneRows.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))
  const seen = new Set([...played, ...opened, ...finished])
  const allowedTalks = seen
  const lessonIds = [...new Set([...answers.map((row) => idOf(row.lesson)), ...allowedTalks]).values()].filter((id): id is number => Boolean(id))
  const showUnchecked = await showUncheckedTalks(payload)
  const [points, lessons, entries] = await Promise.all([
    lessonIds.length ? payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 500, where: { or: [{ id: { in: pointIds.length ? pointIds : [0] } }, { and: [{ lesson: { in: lessonIds } }, pointVisibleWhere(showUnchecked)] }] } }) : Promise.resolve({ docs: [] }),
    lessonIds.length ? payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: lessonIds } } }) : Promise.resolve({ docs: [] }),
    payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 0, limit: 500, where: { user: { equals: learner.id } } }),
  ])
  const lessonRows = lessons.docs as unknown as Row[]
  const courseIds = [...new Set(lessonRows.map((row) => idOf(row.course)).filter((id): id is number => Boolean(id)))]
  const unitIds = [...new Set(lessonRows.map((row) => idOf(row.unit)).filter((id): id is number => Boolean(id)))]
  const [courses, units] = await Promise.all([
    courseIds.length ? payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: courseIds } } }) : Promise.resolve({ docs: [] }),
    unitIds.length ? payload.find({ collection: 'units', overrideAccess: true, depth: 0, limit: 200, where: { id: { in: unitIds } } }) : Promise.resolve({ docs: [] }),
  ])
  const pointRows = points.docs as unknown as Row[]
  const owner = reader.id === learner.id
  const list: WorkbookAnswer[] = answers.filter((row) => seen.has(idOf(row.lesson) || 0)).map((row) => {
    const point = pointRows.find((item) => item.id === idOf(row.point))
    const lesson = lessonRows.find((item) => item.id === idOf(row.lesson))
    const course = (courses.docs as unknown as Row[]).find((item) => item.id === idOf(lesson?.course))
    const unit = (units.docs as unknown as Row[]).find((item) => item.id === idOf(lesson?.unit))
    const entry = (entries.docs as unknown as Row[]).find((item) => idOf(item.answer) === row.id)
    return {
      id: row.id,
      entryId: entry ? entry.id : null,
      atSecond: typeof row.atSecond === 'number' ? (row.atSecond as number) : point ? Number(point.second || 0) : null,
      course: course ? { id: course.id, title: String(course.title) } : null,
      topic: String(unit?.title || 'The talk'),
      video: lesson ? { id: lesson.id, title: partTitle(lesson, course ? String(course.title) : '') } : null,
      pointId: idOf(row.point) || 0,
      question: String(point?.prompt || ''),
      answer: String(row.body || row.choice || (row.image ? 'A photo' : row.audio ? 'A voice note' : '')),
      answeredAt: (row.answeredAt as string) || (row.createdAt as string) || null,
      correct: typeof row.correct === 'boolean' ? (row.correct as boolean) : null,
      shared: Boolean(row.shareWithTeacher),
      reply: owner || row.shareWithTeacher ? ((entry?.teacherReply as string) || null) : null,
      kind: String(point?.kind || ''),
      imageId: idOf(row.image),
      audioId: idOf(row.audio),
      videoId: idOf(row.video),
    }
  })
  const answered = new Set(list.map((row) => row.pointId))
  const answeredTalks = new Set(list.map((row) => row.video?.id).filter((id): id is number => Boolean(id)))
  const open = owner
    ? pointRows
        .filter((point) => !answered.has(point.id) && point.status !== 'rejected' && (showUnchecked || point.status !== 'draft') && answeredTalks.has(idOf(point.lesson) || 0))
        .map((point) => ({
          pointId: point.id,
          question: String(point.prompt),
          lessonId: idOf(point.lesson) || 0,
          courseId: (() => {
            const lesson = lessonRows.find((item) => item.id === idOf(point.lesson))
            return idOf(lesson?.course) || 0
          })(),
          second: Number(point.second || 0),
          video: (() => {
            const lesson = lessonRows.find((item) => item.id === idOf(point.lesson))
            const course = (courses.docs as unknown as Row[]).find((item) => item.id === idOf(lesson?.course))
            return lesson ? partTitle(lesson, course ? String(course.title) : '') : ''
          })(),
          kind: String(point.kind || ''),
          family: String(point.family || ''),
          evidence: String(point.evidence || 'none'),
          dueDays: point.dueDays == null || point.dueDays === '' ? null : Number(point.dueDays),
          showImam: Boolean(point.showImam),
        }))
    : []
  return { learner: { id: learner.id, name: learner.name || 'Learner' }, opening, answers: list, open }
}

/** Who may read a learner's workbook: their mentor, an admin of their portal, or the master. */
export async function mayReadWorkbook(payload: Payload, reader: SessionUser, learner: SessionUser) {
  if (reader.id === learner.id) return true
  if (reader.role === 'master') return true
  const portal = portalIdOf(learner)
  if (!portal || portalIdOf(reader) !== portal) return false
  if (reader.role === 'portal-admin') return true
  if (reader.role === 'teacher') return (await mentorsOf(payload, learner, portal)).includes(reader.id)
  return false
}

export function workbookCsv(book: Workbook) {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const lines = [['section', 'course', 'topic', 'video', 'question', 'answer', 'answered at'].map(cell).join(',')]
  for (const row of book.opening) lines.push(['Where you started', '', '', '', row.caption, row.label, ''].map(cell).join(','))
  for (const row of book.answers) lines.push(['Questions', row.course?.title, row.topic, row.video?.title, row.question, row.answer, row.answeredAt].map(cell).join(','))
  return lines.join('\n')
}
