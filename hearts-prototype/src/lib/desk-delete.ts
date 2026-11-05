import { nameMatches } from '@/lib/learner-desk'

/** Written on a course when the desk deletes it. The row stays, so join codes do not lose their target. */
export const DELETED_COURSE_NOTE = 'Deleted from the desk.'

export const BULK_DELETE_LIMIT = 25

export type DeleteKind =
  | 'course'
  | 'lesson'
  | 'pack'
  | 'code'
  | 'portal'
  | 'announcement'
  | 'night'
  | 'season'
  | 'calendar-line'
  | 'gathering'
  | 'live'
  | 'mission'
  | 'scene'
  | 'lane'
  | 'placing'
  | 'point'
  | 'experiment'
  | 'clip'
  | 'ladder'
  | 'sheet'
  | 'adoption'

export type DeleteActor = { role: string; portalId: number | null }

export type DeleteTarget = {
  portalId: number | null
  /** `master` means a library original. A portal admin may remove the link, not the original. */
  origin?: string | null
}

export type KindSpec = {
  kind: DeleteKind
  confirm: string
  /** Type the name. Used for a portal. */
  strong: boolean
  /** Hide the row and keep it, or remove the row and keep a copy in the bin. */
  mode: 'hide' | 'gone'
  undo: boolean
  bulk: boolean
  /** Only the master desk. */
  masterOnly: boolean
  /** A teacher may delete this in their own portal. */
  teacher: boolean
}

export const KINDS: Record<DeleteKind, KindSpec> = {
  course: { kind: 'course', confirm: 'Delete this course? Learners will no longer see it.', strong: false, mode: 'hide', undo: true, bulk: true, masterOnly: false, teacher: false },
  lesson: { kind: 'lesson', confirm: 'Move this talk to the bin? Learners and courses will not show it. Join codes still open the same course.', strong: false, mode: 'hide', undo: true, bulk: true, masterOnly: false, teacher: false },
  pack: { kind: 'pack', confirm: 'Delete this pack? Access codes stay. They will no longer open these courses.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  code: { kind: 'code', confirm: 'Delete this access code? People who already joined keep their account. New joins will not work.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  portal: { kind: 'portal', confirm: 'Delete this portal? Learners will not be able to sign in.', strong: true, mode: 'hide', undo: true, bulk: false, masterOnly: true, teacher: false },
  announcement: { kind: 'announcement', confirm: 'Delete this announcement? People will no longer see it on Home.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: true },
  night: { kind: 'night', confirm: 'Delete this night? People will no longer see it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  season: { kind: 'season', confirm: 'Delete this season? The calendar will no longer use it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: true, teacher: false },
  'calendar-line': { kind: 'calendar-line', confirm: 'Delete this seasonal line? It will no longer be offered.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: true, teacher: false },
  gathering: { kind: 'gathering', confirm: 'Delete this gathering? People will no longer see it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: true },
  live: { kind: 'live', confirm: 'Delete this live session? Questions and reminders go with it. A replay already saved in Content stays.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: true },
  mission: { kind: 'mission', confirm: 'Delete this mission? Learners will no longer see it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: true, teacher: false },
  scene: { kind: 'scene', confirm: 'Delete this scene? Newcomers will no longer see it.', strong: false, mode: 'hide', undo: true, bulk: false, masterOnly: true, teacher: false },
  lane: { kind: 'lane', confirm: 'Delete this lane? Clips will no longer be offered in it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: true, teacher: false },
  placing: { kind: 'placing', confirm: 'Delete this joining question? New people will no longer be asked it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  point: { kind: 'point', confirm: 'Delete this question? The film will no longer pause here.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  experiment: { kind: 'experiment', confirm: 'Delete this experiment? Learners will no longer be in it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  clip: { kind: 'clip', confirm: 'Delete this clip? Learners will no longer see it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  ladder: { kind: 'ladder', confirm: 'Delete this draft clip? Learners will no longer see it.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
  sheet: { kind: 'sheet', confirm: 'Delete this sheet import? Courses already saved stay.', strong: false, mode: 'gone', undo: false, bulk: false, masterOnly: false, teacher: false },
  adoption: { kind: 'adoption', confirm: 'Remove this course from your portal? Join codes stay as they are.', strong: false, mode: 'gone', undo: true, bulk: true, masterOnly: false, teacher: false },
}

const KIND_LIST = Object.keys(KINDS) as DeleteKind[]

export function isDeleteKind(value: string): value is DeleteKind {
  return KIND_LIST.includes(value as DeleteKind)
}

export function roleMayDelete(role: string, kind: DeleteKind) {
  const spec = KINDS[kind]
  if (role === 'master') return true
  if (spec.masterOnly) return false
  if (role === 'portal-admin') return true
  if (role === 'teacher') return spec.teacher
  return false
}

/**
 * Portal admins delete only in their own portal.
 * A library original stays. The portal can drop the link instead.
 * Returns a sentence when refused, or null when allowed.
 */
export function deleteRefusal(actor: DeleteActor, kind: DeleteKind, item: DeleteTarget): string | null {
  const spec = KINDS[kind]
  if (!roleMayDelete(actor.role, kind)) {
    if (spec.masterOnly || actor.role === 'teacher') {
      return actor.role === 'teacher' && !spec.masterOnly
        ? 'Only a portal admin can delete that.'
        : 'Only the master desk can delete that.'
    }
    return 'Only the desk can delete that.'
  }
  if (actor.role === 'master') return null
  if ((kind === 'course' || kind === 'lesson' || kind === 'point' || kind === 'clip' || kind === 'ladder') && item.origin === 'master') {
    return 'This course is linked from the library. You can remove the link. You cannot delete the original.'
  }
  if (kind === 'pack' && item.origin === 'master') return 'Only the master desk can delete a library pack.'
  if ((kind === 'placing' || kind === 'experiment' || kind === 'sheet') && item.portalId == null) {
    return 'Only the master desk can delete that.'
  }
  if (item.portalId == null || item.portalId !== actor.portalId) return 'That is in another portal.'
  return null
}

export function confirmRefusal(kind: DeleteKind, input: { sure: boolean; typed: string; title: string }): string | null {
  const spec = KINDS[kind]
  if (spec.strong) {
    if (!nameMatches(input.typed, input.title)) return `Type ${input.title} to delete this portal. Nothing was deleted.`
    return null
  }
  if (!input.sure) return kind === 'lesson' ? 'Tick Yes, move it to the bin. Nothing was moved.' : 'Tick Yes, delete it. Nothing was deleted.'
  return null
}

export function bulkCountRefusal(count: number) {
  if (count < 1) return 'Tick at least one.'
  if (count > BULK_DELETE_LIMIT) return `Tick up to ${BULK_DELETE_LIMIT} at a time.`
  return null
}

export function undoSentence(kind: DeleteKind) {
  if (kind === 'lesson') return 'You can put it back from the bin.'
  return KINDS[kind].undo ? 'You can undo this from the bin.' : "This can't be undone."
}

export function courseRemovedFromDesk(course: { hidden?: boolean | null; hiddenNote?: unknown }) {
  return course.hidden === true && String(course.hiddenNote || '') === DELETED_COURSE_NOTE
}

export type CodeRow = { id: number; code: string; packs: number[]; requiredCourses: number[] }
export type PackRow = { id: number; courses: number[] }

/**
 * Take a course off packs and off the optional required list.
 * Every access code stays, with the same code and the same packs.
 */
export function detachCourse(courseId: number, packs: PackRow[], codes: CodeRow[]) {
  return {
    packs: packs.map((pack) => ({
      id: pack.id,
      courses: pack.courses.filter((id) => id !== courseId),
      changed: pack.courses.includes(courseId),
    })),
    codes: codes.map((code) => ({
      id: code.id,
      code: code.code,
      packs: [...code.packs],
      requiredCourses: code.requiredCourses.filter((id) => id !== courseId),
      changed: code.requiredCourses.includes(courseId),
    })),
  }
}

/** True when every code still exists, with the same code text and the same packs. */
export function codesStillJoin(before: CodeRow[], after: { id: number; code: string; packs: number[] }[]) {
  return before.every((code) => {
    const next = after.find((row) => row.id === code.id)
    if (!next || next.code !== code.code) return false
    if (next.packs.length !== code.packs.length) return false
    return next.packs.every((id, index) => id === code.packs[index])
  })
}

/** Take a pack off access codes. The codes themselves stay. */
export function detachPack(packId: number, codes: CodeRow[]) {
  return codes.map((code) => ({
    id: code.id,
    code: code.code,
    packs: code.packs.filter((id) => id !== packId),
    requiredCourses: [...code.requiredCourses],
    changed: code.packs.includes(packId),
  }))
}
