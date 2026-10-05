/**
 * The garden's five trees, and how a learner's real progress fills them.
 *
 * The curriculum's 20 working doors are the only growth areas the app has. They already sit in six
 * sections (the sitting, Islam, iman, ihsan, the Hour, the trunk). Five trees read more clearly on a
 * phone, so the doors are grouped as below. Every door belongs to exactly one tree.
 *
 * | Tree          | Doors        | What it holds                                      |
 * |---------------|--------------|----------------------------------------------------|
 * | Qur'an        | 12           | His Books                                          |
 * | Hadith        | 1, 2, 19, 20 | The sitting, and the close: it was Jibril         |
 * | Character     | 16           | Ihsan: worship as though you see Him               |
 * | Society       | 3–8          | Islam as it is lived with other people             |
 * | Spirituality  | 9–11, 13–15, 17, 18 | Iman, apart from His Books, and the Hour    |
 *
 * Only a full talk finished inside its course, and that course's questions answered there, fill a
 * tree. A hors d'oeuvre or an appetiser never does: those watches are not completions, and an answer
 * given while browsing a short clip is left out by the caller (see `answerCounts`).
 */

export type GardenAreaId = 'quran' | 'hadith' | 'character' | 'society' | 'spirituality'

export type GardenArea = {
  id: GardenAreaId
  title: string
  /** Painted on the blank plaque in the learner sans, with a real apostrophe in Qur’an. */
  plaque: string
  /** One line under the plaque. */
  note: string
  doors: number[]
  /** Foliage for the drawn placeholder, until a painted stage image is dropped in. */
  leaf: string
  blossom: string
}

export const GARDEN_AREAS: GardenArea[] = [
  { id: 'quran', title: "Qur'an", plaque: 'QUR’AN', note: 'His Books', doors: [12], leaf: '#1f6b45', blossom: '#f0d78c' },
  { id: 'hadith', title: 'Hadith', plaque: 'HADITH', note: 'How he came and taught', doors: [1, 2, 19, 20], leaf: '#3d6b3a', blossom: '#f2a3c0' },
  { id: 'character', title: 'Character', plaque: 'CHARACTER', note: 'Ihsan', doors: [16], leaf: '#2f6a32', blossom: '#f0a04a' },
  { id: 'society', title: 'Society', plaque: 'SOCIETY', note: 'Islam, lived together', doors: [3, 4, 5, 6, 7, 8], leaf: '#3a5c38', blossom: '#c9a6e8' },
  { id: 'spirituality', title: 'Spirituality', plaque: 'SPIRITUALITY', note: 'Iman and the Hour', doors: [9, 10, 11, 13, 14, 15, 17, 18], leaf: '#4a6230', blossom: '#d6e27a' },
]

export type GrowthStage = 0 | 1 | 2 | 3 | 4

/** 0 is a sapling. Any real progress leaves 0. A full area is 4. */
export function growthStage(done: number, total: number): GrowthStage {
  if (done <= 0) return 0
  if (total <= 0) return 1
  const share = done / total
  if (share >= 0.95) return 4
  if (share >= 0.6) return 3
  if (share >= 0.3) return 2
  return 1
}

export function areaOfDoor(door: number | null | undefined): GardenArea | null {
  if (!door) return null
  return GARDEN_AREAS.find((area) => area.doors.includes(door)) || null
}

export type AreaLesson = { id: number; courseId: number; title: string; door: number | null }
export type AreaFruit = {
  id: string
  kind: 'talk' | 'course'
  title: string
  href: string
  workbookHref: string
  /** Glow when the talk or course is finished. Empty when it is still to come. */
  earned: boolean
}

export type AreaView = {
  id: GardenAreaId
  title: string
  plaque: string
  note: string
  leaf: string
  blossom: string
  done: number
  total: number
  stage: GrowthStage
  /** Finished talks, and a course once every lesson of it in this tree is finished. */
  fruits: AreaFruit[]
  /** The same talks and courses, still to finish. */
  pending: AreaFruit[]
  workbookHref: string
}

/**
 * Fills each tree from completed full talks and answered course questions.
 * `answers` must already be the ones that count (given in the course, not on a short clip).
 * A lesson with no door is not sown in any tree.
 */
export function areaGrowth(input: {
  lessons: AreaLesson[]
  completions: { lessonId: number }[]
  points: { id: number; lessonId: number }[]
  answers: { pointId: number }[]
  courses: { id: number; title: string }[]
  hrefForLesson: (lessonId: number, courseId: number) => string
  hrefForCourse: (courseId: number) => string
  workbookHref: string
}): AreaView[] {
  const doneLessons = new Set(input.completions.map((row) => row.lessonId))
  const answered = new Set(input.answers.map((row) => row.pointId))
  return GARDEN_AREAS.map((area) => {
    const lessons = input.lessons.filter((lesson) => areaOfDoor(lesson.door)?.id === area.id)
    const lessonIds = new Set(lessons.map((lesson) => lesson.id))
    const points = input.points.filter((point) => lessonIds.has(point.lessonId))
    const talksDone = lessons.filter((lesson) => doneLessons.has(lesson.id))
    const pointsDone = points.filter((point) => answered.has(point.id))
    const done = talksDone.length + pointsDone.length
    const total = lessons.length + points.length
    const fruits: AreaFruit[] = talksDone.map((lesson) => ({
      id: `talk-${lesson.id}`,
      kind: 'talk',
      title: lesson.title,
      href: input.hrefForLesson(lesson.id, lesson.courseId),
      workbookHref: input.workbookHref,
      earned: true,
    }))
    const pending: AreaFruit[] = lessons
      .filter((lesson) => !doneLessons.has(lesson.id))
      .map((lesson) => ({
        id: `pending-talk-${lesson.id}`,
        kind: 'talk' as const,
        title: lesson.title,
        href: input.hrefForLesson(lesson.id, lesson.courseId),
        workbookHref: input.workbookHref,
        earned: false,
      }))
    const byCourse = new Map<number, AreaLesson[]>()
    for (const lesson of lessons) {
      const list = byCourse.get(lesson.courseId) || []
      list.push(lesson)
      byCourse.set(lesson.courseId, list)
    }
    for (const [courseId, own] of byCourse) {
      if (!own.length) continue
      const course = input.courses.find((row) => row.id === courseId)
      const item: AreaFruit = {
        id: `course-${courseId}`,
        kind: 'course',
        title: course?.title || 'This course',
        href: input.hrefForCourse(courseId),
        workbookHref: input.workbookHref,
        earned: own.every((lesson) => doneLessons.has(lesson.id)),
      }
      if (item.earned) fruits.push(item)
      else pending.push({ ...item, id: `pending-course-${courseId}` })
    }
    return {
      id: area.id,
      title: area.title,
      plaque: area.plaque,
      note: area.note,
      leaf: area.leaf,
      blossom: area.blossom,
      done,
      total,
      stage: growthStage(done, total),
      fruits,
      pending,
      workbookHref: input.workbookHref,
    }
  })
}
