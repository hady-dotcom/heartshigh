/**
 * The garden's five trees, and how a learner's real progress fills them.
 *
 * The trees are the hadith of Jibril's own sections. His Books (door 12) sits inside Iman.
 * The Hour is its own tree. The Sitting holds how Jibril came, and the close. Every door
 * belongs to exactly one tree.
 *
 * | Tree         | Doors              | Note                                      |
 * |--------------|--------------------|-------------------------------------------|
 * | Islam        | 3–8                | what you do                               |
 * | Iman         | 9–15, including 12 | what you believe                          |
 * | Ihsan        | 16                 | worship as though you see Him             |
 * | The Hour     | 17, 18             | what's coming                             |
 * | The Sitting  | 1, 2, 19, 20       | how Jibril came to teach                  |
 *
 * The painted planters stay where they are. Islam reuses the society planter, Iman the
 * spirituality planter, Ihsan the character planter, The Hour the old Qur'an planter
 * (that tree folded into Iman), and The Sitting the hadith planter.
 *
 * Only a full talk finished inside its course, and that course's questions answered there, fill a
 * tree. A hors d'oeuvre or an appetiser never does: those watches are not completions, and an answer
 * given while browsing a short clip is left out by the caller (see `answerCounts`).
 */

export type GardenAreaId = 'islam' | 'iman' | 'ihsan' | 'hour' | 'sitting'

/** Folder names of the five painted planters. The pictures are not renamed. */
export type GardenArtId = 'quran' | 'hadith' | 'character' | 'society' | 'spirituality'

export type GardenArea = {
  id: GardenAreaId
  title: string
  /** Painted on the blank plaque in the learner sans, in capitals. */
  plaque: string
  /** One plain line under the plaque. */
  note: string
  doors: number[]
  /** Which painted planter and stone pad this tree reuses. */
  art: GardenArtId
  /** Foliage for the drawn placeholder, until a painted stage image is dropped in. */
  leaf: string
  blossom: string
}

export const GARDEN_AREAS: GardenArea[] = [
  { id: 'islam', title: 'Islam', plaque: 'ISLAM', note: 'Islam: what you do', doors: [3, 4, 5, 6, 7, 8], art: 'society', leaf: '#3a5c38', blossom: '#c9a6e8' },
  { id: 'iman', title: 'Iman', plaque: 'IMAN', note: 'Iman: what you believe', doors: [9, 10, 11, 12, 13, 14, 15], art: 'spirituality', leaf: '#4a6230', blossom: '#d6e27a' },
  { id: 'ihsan', title: 'Ihsan', plaque: 'IHSAN', note: 'Ihsan: worship as though you see Him', doors: [16], art: 'character', leaf: '#2f6a32', blossom: '#f0a04a' },
  { id: 'hour', title: 'The Hour', plaque: 'THE HOUR', note: "The Hour: what's coming", doors: [17, 18], art: 'quran', leaf: '#1f6b45', blossom: '#f0d78c' },
  { id: 'sitting', title: 'The Sitting', plaque: 'THE SITTING', note: 'The Sitting: how Jibril came to teach', doors: [1, 2, 19, 20], art: 'hadith', leaf: '#3d6b3a', blossom: '#f2a3c0' },
]

/**
 * Doors each old tree name held, before the plaques took the hadith's own words.
 * His Books (door 12) was its own tree. The Hour shared a tree with iman.
 */
const LEGACY_AREA_DOORS: Record<string, number[]> = {
  quran: [12],
  hadith: [1, 2, 19, 20],
  character: [16],
  society: [3, 4, 5, 6, 7, 8],
  spirituality: [9, 10, 11, 13, 14, 15, 17, 18],
}

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
  art: GardenArtId
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
      art: area.art,
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

export type StoredGardenArea = {
  id: string
  done?: number
  doors?: number[]
}

export type MigratedGardenArea = { id: GardenAreaId; done: number; doors: number[] }

/** Share a saved count across trees by how many of its doors each tree now holds. The shares add back up. */
function splitCount(total: number, weights: number[]) {
  const sum = weights.reduce((count, weight) => count + weight, 0)
  if (!sum || total <= 0) return weights.map(() => 0)
  const raw = weights.map((weight) => (total * weight) / sum)
  const floors = raw.map((value) => Math.floor(value))
  let left = total - floors.reduce((count, value) => count + value, 0)
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index)
  for (const row of order) {
    if (left <= 0) break
    floors[row.index] += 1
    left -= 1
  }
  return floors
}

function doorsOfStored(row: StoredGardenArea) {
  const listed = [...new Set((row.doors || []).filter((door) => Number.isInteger(door) && door >= 1 && door <= 20))]
  if (listed.length) return listed
  if (LEGACY_AREA_DOORS[row.id]) return [...LEGACY_AREA_DOORS[row.id]]
  const current = GARDEN_AREAS.find((area) => area.id === row.id)
  return current ? [...current.doors] : []
}

/**
 * Old saved tree ids become the hadith sections those doors belong to now.
 * Door 12 (the old Qur'an tree) joins Iman. Doors 17 and 18 leave the old iman-and-Hour
 * tree for The Hour. A door is kept once, and a saved count is shared so none of it is dropped.
 */
export function migrateGardenProgress(stored: StoredGardenArea[]): MigratedGardenArea[] {
  const buckets = new Map<GardenAreaId, { done: number; doors: number[] }>(GARDEN_AREAS.map((area) => [area.id, { done: 0, doors: [] }]))
  const seen = new Set<number>()
  for (const row of stored) {
    const doors = doorsOfStored(row).filter((door) => areaOfDoor(door) && !seen.has(door))
    if (!doors.length) continue
    const groups = new Map<GardenAreaId, number[]>()
    for (const door of doors) {
      const area = areaOfDoor(door)!
      const list = groups.get(area.id) || []
      list.push(door)
      groups.set(area.id, list)
      seen.add(door)
    }
    const ids = [...groups.keys()]
    const shares = splitCount(Math.max(0, Math.round(Number(row.done) || 0)), ids.map((id) => groups.get(id)!.length))
    ids.forEach((id, index) => {
      const bucket = buckets.get(id)!
      bucket.doors.push(...groups.get(id)!)
      bucket.done += shares[index] || 0
    })
  }
  return GARDEN_AREAS.map((area) => {
    const bucket = buckets.get(area.id)!
    return { id: area.id, done: bucket.done, doors: [...bucket.doors].sort((a, b) => a - b) }
  })
}

/** Read a device's saved garden trees. Old ids are rewritten onto the hadith sections. Rubbish is ignored. */
export function readStoredGarden(raw: string | null): MigratedGardenArea[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    const rows: StoredGardenArea[] = []
    for (const item of parsed) {
      if (typeof item === 'string') rows.push({ id: item, done: 0 })
      else if (item && typeof item === 'object') {
        const row = item as { id?: unknown; done?: unknown; doors?: unknown }
        rows.push({
          id: String(row.id || ''),
          done: Number(row.done || 0),
          doors: Array.isArray(row.doors) ? row.doors.map(Number).filter((door) => Number.isInteger(door)) : [],
        })
      }
    }
    return migrateGardenProgress(rows)
  } catch {
    return null
  }
}
