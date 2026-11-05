import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import { portalDisplayName } from '@/lib/portal-name'
import { actorScope } from '@/lib/learner-desk'
import {
  BULK_DELETE_LIMIT,
  DELETED_COURSE_NOTE,
  type CodeRow,
  type DeleteActor,
  type DeleteKind,
  type DeleteTarget,
  type PackRow,
  KINDS,
  bulkCountRefusal,
  confirmRefusal,
  courseRemovedFromDesk,
  deleteRefusal,
  detachCourse,
  detachPack,
  isDeleteKind,
  undoSentence,
} from '@/lib/desk-delete'
import type { SessionUser } from './context'

type Doc = Record<string, unknown> & { id: number }
type Result = { error?: string; notice?: string }

const BIN = 'desk-bin' as 'users'
const DROP = new Set(['id', 'createdAt', 'updatedAt', 'sizes'])

const CHILDREN: Partial<Record<DeleteKind, { collection: string; field: string }[]>> = {
  lesson: [
    { collection: 'cuts', field: 'lesson' },
    { collection: 'ladder-items', field: 'lesson' },
    { collection: 'engagement-points', field: 'lesson' },
    { collection: 'resources', field: 'lesson' },
  ],
  night: [
    { collection: 'rsvps', field: 'event' },
    { collection: 'checkins', field: 'event' },
  ],
  gathering: [
    { collection: 'gather-rsvps', field: 'gathering' },
    { collection: 'gather-checkins', field: 'gathering' },
    { collection: 'gather-reflections', field: 'gathering' },
    { collection: 'gather-photos', field: 'gathering' },
  ],
  live: [
    { collection: 'live-questions', field: 'session' },
    { collection: 'live-reminders', field: 'session' },
    { collection: 'live-presence', field: 'session' },
  ],
  mission: [{ collection: 'mission-joins', field: 'mission' }],
  experiment: [
    { collection: 'experiment-assignments', field: 'experiment' },
    { collection: 'experiment-events', field: 'experiment' },
  ],
  announcement: [{ collection: 'announcement-dismissals', field: 'announcement' }],
  placing: [{ collection: 'placing-answers', field: 'question' }],
}

const COLLECTION: Record<DeleteKind, string> = {
  course: 'courses',
  lesson: 'lessons',
  pack: 'packs',
  code: 'access-codes',
  portal: 'portals',
  announcement: 'announcements',
  night: 'events',
  season: 'calendar-seasons',
  'calendar-line': 'calendar-copy',
  gathering: 'gatherings',
  live: 'live-sessions',
  mission: 'missions',
  scene: 'opening-scenes',
  lane: 'lanes',
  placing: 'placing-questions',
  point: 'engagement-points',
  experiment: 'experiments',
  clip: 'cuts',
  ladder: 'ladder-items',
  sheet: 'sheet-imports',
  adoption: 'adoptions',
}

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function idsOf(form: FormData) {
  const fromMany = form.getAll('id').map((value) => Number(value))
  const single = Number(text(form, 'id'))
  const all = single > 0 ? [single, ...fromMany] : fromMany
  return [...new Set(all.filter((id) => Number.isInteger(id) && id > 0))].slice(0, BULK_DELETE_LIMIT + 1)
}

function col(name: string) {
  return name as 'users'
}

async function readDoc(payload: Payload, collection: string, id: number): Promise<Doc | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  return (await payload.findByID({ collection: col(collection), id, overrideAccess: true, depth: 0 }).catch(() => null)) as Doc | null
}

async function findWhere(payload: Payload, collection: string, where: Record<string, unknown>, limit = 200) {
  const found = await payload.find({ collection: col(collection), overrideAccess: true, depth: 0, limit, where: where as never })
  return found.docs as unknown as Doc[]
}

function numList(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => idOf(item)).filter((id): id is number => Boolean(id))
}

function restorable(doc: Doc) {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc)) {
    if (DROP.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in (value as object)) {
      out[key] = (value as { id: number }).id
      continue
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) => (item && typeof item === 'object' && 'id' in (item as object) ? (item as { id: number }).id : item))
      continue
    }
    out[key] = value
  }
  return out
}

function titleOf(kind: DeleteKind, doc: Doc) {
  if (kind === 'portal') return portalDisplayName(doc).slice(0, 180)
  const raw = doc.title || doc.name || doc.prompt || doc.label || doc.code || doc.body || doc.fileName || doc.key || doc.land || doc.hook
  const textValue = typeof raw === 'string' ? raw.trim() : ''
  return (textValue || KINDS[kind].confirm).slice(0, 180)
}

async function courseOrigin(payload: Payload, courseId: number | null) {
  if (!courseId) return { origin: null as string | null, portalId: null as number | null }
  const course = await readDoc(payload, 'courses', courseId)
  if (!course) return { origin: null, portalId: null }
  return { origin: String(course.origin || ''), portalId: idOf(course.portal) }
}

async function targetOf(payload: Payload, kind: DeleteKind, doc: Doc): Promise<DeleteTarget> {
  if (kind === 'course') return { portalId: idOf(doc.portal), origin: String(doc.origin || '') }
  if (kind === 'pack') return { portalId: idOf(doc.portal), origin: String(doc.owner || '') }
  if (kind === 'lesson' || kind === 'point' || kind === 'clip' || kind === 'ladder') {
    const courseId = kind === 'lesson' ? idOf(doc.course) : idOf(doc.course) || null
    let resolved = courseId
    if (!resolved && (kind === 'point' || kind === 'clip' || kind === 'ladder')) {
      const lesson = await readDoc(payload, 'lessons', idOf(doc.lesson) || 0)
      resolved = idOf(lesson?.course)
    }
    const course = await courseOrigin(payload, resolved)
    return { portalId: idOf(doc.portal) || course.portalId, origin: course.origin }
  }
  if (kind === 'placing' || kind === 'experiment' || kind === 'sheet' || kind === 'announcement' || kind === 'night' || kind === 'gathering' || kind === 'live' || kind === 'adoption' || kind === 'code') {
    return { portalId: idOf(doc.portal) }
  }
  return { portalId: null }
}

async function alreadyBinned(payload: Payload, kind: DeleteKind, recordId: number) {
  const rows = await findWhere(payload, BIN, { and: [{ kind: { equals: kind } }, { recordId: { equals: recordId } }, { undone: { not_equals: true } }] }, 1).catch(() => [])
  return rows.length > 0
}

export async function openBinRecordIds(payload: Payload, kind: DeleteKind) {
  const rows = await findWhere(payload, BIN, { and: [{ kind: { equals: kind } }, { undone: { not_equals: true } }] }, 500).catch(() => [])
  return new Set(rows.map((row) => Number(row.recordId)).filter((id) => id > 0))
}

async function putBin(payload: Payload, actorId: number, kind: DeleteKind, recordId: number, title: string, portalId: number | null, mode: 'hide' | 'gone', snapshot: unknown) {
  const made = await payload.create({
    collection: BIN,
    overrideAccess: true,
    data: {
      kind,
      title: title.slice(0, 180),
      recordId,
      portal: portalId || undefined,
      actor: actorId,
      mode,
      snapshot,
      undone: false,
    } as never,
  })
  return made.id
}

async function blockLesson(payload: Payload, lessonId: number) {
  const answers = await findWhere(payload, 'answers', { lesson: { equals: lessonId } }, 1)
  if (answers.length) return 'This film has learner answers, so it stays.'
  return null
}

async function blockPoint(payload: Payload, pointId: number) {
  const answers = await findWhere(payload, 'answers', { point: { equals: pointId } }, 1)
  if (answers.length) return 'Learners have answered this question, so it stays.'
  return null
}

async function blockScene(doc: Doc) {
  const options = Array.isArray(doc.options) ? doc.options : []
  if (options.some((option) => option && typeof option === 'object' && (option as { crisis?: boolean }).crisis)) {
    return 'The scene with the help option cannot be deleted.'
  }
  return null
}

async function blockLane(payload: Payload, doc: Doc) {
  if (doc.pseudo === true) return 'The default lane cannot be deleted.'
  const scenes = await findWhere(payload, 'opening-scenes', {}, 50)
  const used = scenes.some((scene) => {
    const options = Array.isArray(scene.options) ? scene.options : []
    return options.some((option) => option && typeof option === 'object' && idOf((option as { intentLane?: unknown }).intentLane) === doc.id)
  })
  if (used) return 'A scene still points at this lane, so it stays.'
  return null
}

async function loadCodes(payload: Payload): Promise<CodeRow[]> {
  const rows = await findWhere(payload, 'access-codes', {}, 1000)
  return rows.map((row) => ({
    id: row.id,
    code: String(row.code || ''),
    packs: numList(row.packs),
    requiredCourses: numList(row.requiredCourses),
  }))
}

async function loadPacks(payload: Payload): Promise<PackRow[]> {
  const rows = await findWhere(payload, 'packs', {}, 500)
  return rows.map((row) => ({ id: row.id, courses: numList(row.courses) }))
}

async function hideCourse(payload: Payload, actorId: number, doc: Doc): Promise<Result> {
  if (courseRemovedFromDesk(doc as { hidden?: boolean; hiddenNote?: unknown })) return { error: 'That course is already in the bin.' }
  const [packs, codes] = await Promise.all([loadPacks(payload), loadCodes(payload)])
  const plan = detachCourse(doc.id, packs, codes)
  for (const pack of plan.packs) {
    if (!pack.changed) continue
    await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: pack.courses } as never })
  }
  for (const code of plan.codes) {
    if (!code.changed) continue
    await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: { requiredCourses: code.requiredCourses } as never })
  }
  await payload.update({
    collection: 'courses',
    id: doc.id,
    overrideAccess: true,
    data: { hidden: true, visibility: 'draft', hiddenNote: DELETED_COURSE_NOTE } as never,
  })
  await putBin(payload, actorId, 'course', doc.id, titleOf('course', doc), idOf(doc.portal), 'hide', {
    hidden: doc.hidden === true,
    visibility: doc.visibility || 'published',
    hiddenNote: doc.hiddenNote || null,
    packs: plan.packs.filter((pack) => pack.changed).map((pack) => ({ id: pack.id, courses: packs.find((row) => row.id === pack.id)?.courses || [] })),
    codes: plan.codes.filter((code) => code.changed).map((code) => ({ id: code.id, requiredCourses: codes.find((row) => row.id === code.id)?.requiredCourses || [] })),
  })
  return { notice: `${titleOf('course', doc)} is deleted. Learners will no longer see it. Join codes are unchanged. ${undoSentence('course')}` }
}

async function hidePortal(payload: Payload, actorId: number, doc: Doc): Promise<Result> {
  if (await alreadyBinned(payload, 'portal', doc.id)) return { error: 'That portal is already in the bin.' }
  await payload.update({ collection: 'portals', id: doc.id, overrideAccess: true, data: { closed: true } as never })
  await putBin(payload, actorId, 'portal', doc.id, titleOf('portal', doc), doc.id, 'hide', { closed: doc.closed === true })
  return { notice: `${titleOf('portal', doc)} is in the bin. Learners cannot sign in. ${undoSentence('portal')}` }
}

async function hideScene(payload: Payload, actorId: number, doc: Doc): Promise<Result> {
  const blocked = await blockScene(doc)
  if (blocked) return { error: blocked }
  if (await alreadyBinned(payload, 'scene', doc.id)) return { error: 'That scene is already in the bin.' }
  await payload.update({ collection: 'opening-scenes', id: doc.id, overrideAccess: true, data: { status: 'draft' } as never })
  await putBin(payload, actorId, 'scene', doc.id, titleOf('scene', doc), null, 'hide', { status: doc.status || 'draft' })
  return { notice: `${titleOf('scene', doc)} is deleted. Newcomers will no longer see it. ${undoSentence('scene')}` }
}

async function removeGone(payload: Payload, actorId: number, kind: DeleteKind, doc: Doc, portalId: number | null): Promise<Result> {
  const children = CHILDREN[kind] || []
  const saved: { collection: string; field: string; docs: Record<string, unknown>[] }[] = []
  for (const child of children) {
    const rows = await findWhere(payload, child.collection, { [child.field]: { equals: doc.id } }, 500)
    saved.push({ collection: child.collection, field: child.field, docs: rows.map(restorable) })
  }
  const extra: Record<string, unknown> = {}
  if (kind === 'pack') {
    const codes = await loadCodes(payload)
    const next = detachPack(doc.id, codes)
    extra.codes = next.filter((code) => code.changed).map((code) => ({ id: code.id, packs: codes.find((row) => row.id === code.id)?.packs || [] }))
    for (const code of next) {
      if (!code.changed) continue
      await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: { packs: code.packs } as never })
    }
  }
  if (kind === 'code') {
    const holders = await findWhere(payload, 'users', { accessCode: { equals: doc.id } }, 500)
    const linked = await findWhere(payload, 'access-codes', { or: [{ linkedTeacherCode: { equals: doc.id } }, { parentMentorCode: { equals: doc.id } }] }, 200)
    extra.holders = holders.map((row) => row.id)
    extra.linked = linked.map((row) => row.id)
    for (const holder of holders) {
      await payload.update({ collection: 'users', id: holder.id, overrideAccess: true, data: { accessCode: null } as never })
    }
    for (const code of linked) {
      const data: Record<string, unknown> = {}
      if (idOf(code.linkedTeacherCode) === doc.id) data.linkedTeacherCode = null
      if (idOf(code.parentMentorCode) === doc.id) data.parentMentorCode = null
      if (Object.keys(data).length) await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: data as never })
    }
  }
  for (const child of [...children].reverse()) {
    const rows = await findWhere(payload, child.collection, { [child.field]: { equals: doc.id } }, 500)
    for (const row of rows) await payload.delete({ collection: col(child.collection), id: row.id, overrideAccess: true })
  }
  await payload.delete({ collection: col(COLLECTION[kind]), id: doc.id, overrideAccess: true })
  if (KINDS[kind].undo) {
    await putBin(payload, actorId, kind, doc.id, titleOf(kind, doc), portalId, 'gone', { doc: restorable(doc), children: saved, extra })
  }
  const tail = undoSentence(kind)
  return { notice: `${titleOf(kind, doc)} is deleted. ${tail}` }
}

async function hideLesson(payload: Payload, actorId: number, doc: Doc, portalId: number | null): Promise<Result> {
  if (doc.binned === true || (await alreadyBinned(payload, 'lesson', doc.id))) return { error: 'That talk is already in the bin.' }
  await payload.update({ collection: 'lessons', id: doc.id, overrideAccess: true, data: { binned: true } as never })
  await putBin(payload, actorId, 'lesson', doc.id, titleOf('lesson', doc), portalId, 'hide', { binned: false, courseId: idOf(doc.course) })
  return { notice: `${titleOf('lesson', doc)} is in the bin. Learners and courses will not show it. Join codes still open the same course. You can put it back from the bin.` }
}

async function eraseLesson(payload: Payload, doc: Doc) {
  const children = CHILDREN.lesson || []
  for (const child of [...children].reverse()) {
    const rows = await findWhere(payload, child.collection, { [child.field]: { equals: doc.id } }, 500)
    for (const row of rows) await payload.delete({ collection: col(child.collection), id: row.id, overrideAccess: true })
  }
  await payload.delete({ collection: 'lessons', id: doc.id, overrideAccess: true })
}

async function preflight(payload: Payload, kind: DeleteKind, doc: Doc): Promise<string | null> {
  if (kind === 'lesson' && doc.binned === true) return 'That talk is already in the bin.'
  if (kind === 'point') return blockPoint(payload, doc.id)
  if (kind === 'lane') return blockLane(payload, doc)
  if (kind === 'course' && courseRemovedFromDesk(doc as { hidden?: boolean; hiddenNote?: unknown })) return 'That course is already in the bin.'
  if (kind === 'scene') {
    const blocked = await blockScene(doc)
    if (blocked) return blocked
    if (await alreadyBinned(payload, 'scene', doc.id)) return 'That is already in the bin.'
    return null
  }
  if (kind === 'portal' && (await alreadyBinned(payload, 'portal', doc.id))) return 'That is already in the bin.'
  return null
}

async function commit(payload: Payload, actorId: number, kind: DeleteKind, doc: Doc, portalId: number | null): Promise<Result> {
  if (kind === 'course') return hideCourse(payload, actorId, doc)
  if (kind === 'lesson') return hideLesson(payload, actorId, doc, portalId)
  if (kind === 'portal') return hidePortal(payload, actorId, doc)
  if (kind === 'scene') return hideScene(payload, actorId, doc)
  return removeGone(payload, actorId, kind, doc, portalId)
}

async function deleteOne(payload: Payload, actor: DeleteActor & { id: number }, kind: DeleteKind, id: number, confirm: { sure: boolean; typed: string }, checkConfirm: boolean): Promise<Result> {
  const doc = await readDoc(payload, COLLECTION[kind], id)
  if (!doc) return { error: 'That could not be found. Nothing was deleted.' }
  const target = await targetOf(payload, kind, doc)
  const refused = deleteRefusal(actor, kind, target)
  if (refused) return { error: refused }
  const blocked = await preflight(payload, kind, doc)
  if (blocked) return { error: blocked }
  if (checkConfirm) {
    const confirmError = confirmRefusal(kind, { ...confirm, title: titleOf(kind, doc) })
    if (confirmError) return { error: confirmError }
  }
  try {
    return await commit(payload, actor.id, kind, doc, target.portalId)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That could not be deleted.' }
  }
}

export async function deskDelete(payload: Payload, user: SessionUser, form: FormData): Promise<Result> {
  const kind = text(form, 'kind')
  if (!isDeleteKind(kind)) return { error: 'That cannot be deleted from here.' }
  const actor = { ...actorScope(user), id: user.id }
  const ids = idsOf(form)
  const bulk = text(form, 'action') === 'desk-bulk-delete'
  if (bulk && !KINDS[kind].bulk) return { error: 'Delete these one at a time.' }
  const crowded = bulkCountRefusal(ids.length)
  if (crowded) return { error: crowded }
  const confirm = { sure: text(form, 'sure') === 'yes', typed: text(form, 'confirm') }
  if (bulk) {
    const confirmError = confirmRefusal(kind, { ...confirm, title: '' })
    if (confirmError) return { error: confirmError }
    const ready: Doc[] = []
    for (const id of ids) {
      const doc = await readDoc(payload, COLLECTION[kind], id)
      if (!doc) return { error: 'One of those could not be found. Nothing was deleted.' }
      const target = await targetOf(payload, kind, doc)
      const refused = deleteRefusal(actor, kind, target)
      if (refused) return { error: `${refused} Nothing was deleted.` }
      const blocked = await preflight(payload, kind, doc)
      if (blocked) return { error: `${blocked} Nothing was deleted.` }
      ready.push(doc)
    }
    for (const doc of ready) {
      const result = await deleteOne(payload, actor, kind, doc.id, confirm, false)
      if (result.error) return { error: result.error }
    }
    return { notice: `${ready.length} deleted. ${undoSentence(kind)}` }
  }
  return deleteOne(payload, actor, kind, ids[0] || 0, confirm, true)
}

async function undoHide(payload: Payload, kind: DeleteKind, recordId: number, snapshot: Record<string, unknown>) {
  if (kind === 'lesson') {
    await payload.update({
      collection: 'lessons',
      id: recordId,
      overrideAccess: true,
      data: { binned: snapshot.binned === true } as never,
    })
    return
  }
  if (kind === 'course') {
    await payload.update({
      collection: 'courses',
      id: recordId,
      overrideAccess: true,
      data: {
        hidden: snapshot.hidden === true,
        visibility: snapshot.visibility || 'published',
        hiddenNote: snapshot.hiddenNote || null,
      } as never,
    })
    for (const pack of (snapshot.packs as { id: number; courses: number[] }[]) || []) {
      await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: pack.courses } as never })
    }
    for (const code of (snapshot.codes as { id: number; requiredCourses: number[] }[]) || []) {
      await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: { requiredCourses: code.requiredCourses } as never })
    }
    return
  }
  if (kind === 'portal') {
    await payload.update({ collection: 'portals', id: recordId, overrideAccess: true, data: { closed: snapshot.closed === true } as never })
    return
  }
  if (kind === 'scene') {
    await payload.update({ collection: 'opening-scenes', id: recordId, overrideAccess: true, data: { status: snapshot.status || 'draft' } as never })
  }
}

async function undoGone(payload: Payload, kind: DeleteKind, snapshot: Record<string, unknown>) {
  const body = (snapshot.doc || {}) as Record<string, unknown>
  const made = await payload.create({ collection: col(COLLECTION[kind]), overrideAccess: true, data: body as never })
  const children = (snapshot.children || []) as { collection: string; field: string; docs: Record<string, unknown>[] }[]
  for (const child of children) {
    for (const doc of child.docs) {
      await payload.create({
        collection: col(child.collection),
        overrideAccess: true,
        data: { ...doc, [child.field]: made.id } as never,
      })
    }
  }
  const extra = (snapshot.extra || {}) as { holders?: number[]; linked?: number[]; codes?: { id: number; packs: number[] }[] }
  if (kind === 'code') {
    for (const holder of extra.holders || []) {
      await payload.update({ collection: 'users', id: holder, overrideAccess: true, data: { accessCode: made.id } as never })
    }
    for (const linked of extra.linked || []) {
      const row = await readDoc(payload, 'access-codes', linked)
      if (!row) continue
      const data: Record<string, unknown> = {}
      if (!idOf(row.linkedTeacherCode)) data.linkedTeacherCode = made.id
      if (!idOf(row.parentMentorCode) && row.role === 'parent') data.parentMentorCode = made.id
      if (Object.keys(data).length) await payload.update({ collection: 'access-codes', id: linked, overrideAccess: true, data: data as never })
    }
  }
  if (kind === 'pack') {
    for (const code of extra.codes || []) {
      const packs = [...new Set([...(code.packs || []).filter((id) => id !== Number(body.id || 0)), made.id])]
      await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: { packs } as never })
    }
  }
}

export async function deskUndo(payload: Payload, user: SessionUser, binId: number): Promise<Result> {
  const actor = actorScope(user)
  if (actor.role !== 'master' && actor.role !== 'portal-admin' && actor.role !== 'teacher') return { error: 'Only the desk can undo a delete.' }
  const row = await readDoc(payload, BIN, binId)
  if (!row || row.undone === true) return { error: 'That is not in the bin.' }
  const kind = String(row.kind || '')
  if (!isDeleteKind(kind)) return { error: 'That cannot be put back.' }
  const portalId = idOf(row.portal)
  if (actor.role !== 'master' && (portalId == null || portalId !== actor.portalId)) return { error: 'That is in another portal.' }
  if (!KINDS[kind].undo) return { error: "That can't be undone." }
  const snapshot = (row.snapshot && typeof row.snapshot === 'object' ? row.snapshot : {}) as Record<string, unknown>
  try {
    if (String(row.mode) === 'hide') await undoHide(payload, kind, Number(row.recordId), snapshot)
    else await undoGone(payload, kind, snapshot)
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'That could not be put back.' }
  }
  await payload.update({ collection: BIN, id: row.id, overrideAccess: true, data: { undone: true } as never })
  return { notice: `${String(row.title || 'It')} is back.` }
}

export async function deskEmptyBin(payload: Payload, user: SessionUser): Promise<Result> {
  const actor = actorScope(user)
  if (actor.role !== 'master' && actor.role !== 'portal-admin') return { error: 'Only the desk can empty the bin.' }
  const where = actor.role === 'master'
    ? { and: [{ kind: { equals: 'lesson' } }, { undone: { not_equals: true } }] }
    : { and: [{ kind: { equals: 'lesson' } }, { undone: { not_equals: true } }, { portal: { equals: actor.portalId } }] }
  const rows = await findWhere(payload, BIN, where, 500)
  let removed = 0
  let kept = 0
  for (const row of rows) {
    const lessonId = Number(row.recordId)
    const lesson = await readDoc(payload, 'lessons', lessonId)
    if (lesson) {
      const blocked = await blockLesson(payload, lesson.id)
      if (blocked) {
        kept += 1
        continue
      }
      await eraseLesson(payload, lesson)
    }
    await payload.delete({ collection: BIN, id: row.id, overrideAccess: true })
    removed += 1
  }
  if (!removed && !kept) return { notice: 'The bin has no talks. Join codes are unchanged.' }
  if (kept) return { notice: `Removed ${removed} talks. Left ${kept} because a learner has answered ${kept === 1 ? 'it' : 'them'}. Join codes are unchanged.` }
  return { notice: `Removed ${removed} ${removed === 1 ? 'talk' : 'talks'} from the bin. Join codes are unchanged.` }
}

export async function runDeskDelete(payload: Payload, user: SessionUser, form: FormData): Promise<Result> {
  const action = text(form, 'action')
  if (action === 'desk-undo') return deskUndo(payload, user, Number(text(form, 'bin')))
  if (action === 'desk-empty-bin') {
    if (text(form, 'sure') !== 'yes') return { error: 'Tick Yes, empty the bin. Nothing was removed.' }
    return deskEmptyBin(payload, user)
  }
  if (action === 'desk-delete' || action === 'desk-bulk-delete') return deskDelete(payload, user, form)
  return { error: 'That action is not known.' }
}
