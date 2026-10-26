import type { Payload } from 'payload'
import { AppFrame } from '@/components/app/shell'
import { LearnerTabBar } from '@/components/app/learner-bar'
import { ParentWorkbookBoard, type WorkbookCard } from '@/components/app/parent-workbook'
import { learnerBrand } from '@/lib/learner-brand'
import { WORKBOOK_FILMS } from '@/lib/demo-workbook'
import { questionsMatch } from '@/lib/swarm-plan'
import { shownQuestionPrompt } from '@/lib/question-prompt'
import type { PortalDoc } from '@/server/context'
import { ref, rows, str } from '../common'

async function workbookCards(payload: Payload, portalId: number, userId: number | null, base: string): Promise<WorkbookCard[]> {
  const courses = await rows(payload, 'courses', {
    and: [
      { portal: { equals: portalId } },
      { sheetTitle: { equals: 'Guiding Home Learning' } },
      { hidden: { not_equals: true } },
    ],
  }, { limit: 20 })
  const courseIds = courses.map((course) => course.id)
  const wanted = WORKBOOK_FILMS.map((film) => film.vimeoId)
  const lessons = courseIds.length
    ? await rows(payload, 'lessons', {
      and: [
        { course: { in: courseIds } },
        { vimeoId: { in: wanted } },
        { binned: { not_equals: true } },
      ],
    }, { limit: 20 })
    : []
  const lessonIds = lessons.map((lesson) => lesson.id)
  const points = lessonIds.length
    ? await rows(payload, 'engagement-points', { lesson: { in: lessonIds } }, { sort: 'second', limit: 40 })
    : []
  const mineRows = userId && points.length
    ? await rows(payload, 'answers', {
      and: [{ user: { equals: userId } }, { point: { in: points.map((point) => point.id) } }],
    }, { limit: 40 })
    : []
  return WORKBOOK_FILMS.map((film, index) => {
    const lesson = lessons.find((row) => str(row.vimeoId) === film.vimeoId)
    const lessonPoints = lesson ? points.filter((point) => ref(point.lesson) === lesson.id) : []
    const point = lessonPoints.find((row) => questionsMatch(shownQuestionPrompt(str(row.prompt), { sheet: true }), film.prompt)) || lessonPoints[0]
    const mine = point ? mineRows.find((row) => ref(row.point) === point.id) : null
    const courseId = lesson ? ref(lesson.course) : null
    return {
      vimeoId: film.vimeoId,
      title: film.title,
      prompt: point ? shownQuestionPrompt(str(point.prompt), { sheet: true }) : film.prompt,
      place: index + 1,
      lessonId: lesson?.id ?? null,
      courseId,
      pointId: point?.id ?? null,
      href: lesson && courseId ? `${base}/course/${courseId}?part=${lesson.id}` : null,
      mine: str(mine?.body || mine?.choice),
      others: film.others,
    }
  })
}

export async function ParentWorkbookScreen({ payload, portal, base, userId }: { payload: Payload; portal: PortalDoc; base: string; userId: number | null }) {
  const films = await workbookCards(payload, portal.id, userId, base)
  return (
    <AppFrame testId="parent-workbook" brand={learnerBrand(portal)}>
      <div className="app-scroll parent-workbook">
        <a className="back" href={`${base}/courses`} data-testid="back">‹ Courses</a>
        <div className="app-head"><h1>Workbook</h1></div>
        <p className="lead">The first ten films in Guiding Home Learning. Your answer stays on this phone until you have an account.</p>
        <ParentWorkbookBoard films={films} signedIn={userId != null} next={`${base}/workbook`} />
      </div>
      <LearnerTabBar base={base} active="me" portal={portal} />
    </AppFrame>
  )
}
