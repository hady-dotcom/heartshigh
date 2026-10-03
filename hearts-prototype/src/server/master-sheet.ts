// Loads the library, applies a master-sheet plan, and puts the last import back.
import type { Payload, Where } from 'payload'
import { idOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { audit } from '@/server/viewas'
import { tierSourceText } from '@/server/tier-source'
import {
  buildWorkbook,
  emptyCatalogue,
  planCounts,
  planSheet,
  readWorkbook,
  rowsFromCatalogue,
  type CourseRow,
  type CutRow,
  type KeyRow,
  type LessonRow,
  type PointRow,
  type Ref,
  type ResourceRow,
  type SeatRow,
  type SheetCatalogue,
  type SheetOp,
  type SheetPlan,
  type TierRow,
  type UnitRow,
} from '@/lib/master-sheet'

export type SheetScope = { kind: 'library' | 'portal' | 'course'; portalId: number | null; courseId: number | null; desk: 'master' | 'portal' }

type Doc = Record<string, unknown> & { id: number }

export type SheetSnapshot = {
  created: Record<string, number[]>
  updated: { collection: string; id: number; before: Record<string, unknown> }[]
  deleted: { collection: string; data: Record<string, unknown> }[]
}

const CHILD_ORDER = ['engagement-points', 'resources', 'talk-tiers', 'sheet-keys', 'cuts', 'ladder-items', 'lessons', 'units', 'courses']

function emptySnapshot(): SheetSnapshot {
  return { created: {}, updated: [], deleted: [] }
}

function rememberCreated(snapshot: SheetSnapshot, collection: string, id: number) {
  const list = snapshot.created[collection] || []
  list.push(id)
  snapshot.created[collection] = list
}

async function allDocs(payload: Payload, collection: string, where?: Where) {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit: 200, page, where })
    docs.push(...(found.docs as unknown as Doc[]))
    if (!found.hasNextPage || page > 40) break
    page += 1
  }
  return docs
}

function num(value: unknown) {
  const id = idOf(value)
  return id
}

export async function loadCatalogue(payload: Payload, scope: SheetScope): Promise<SheetCatalogue> {
  const [courses, units, lessons, tiers, points, resources, keys, cuts, seats, clauses] = await Promise.all([
    allDocs(payload, 'courses'),
    allDocs(payload, 'units'),
    allDocs(payload, 'lessons'),
    allDocs(payload, 'talk-tiers'),
    allDocs(payload, 'engagement-points'),
    allDocs(payload, 'resources'),
    allDocs(payload, 'sheet-keys').catch(() => [] as Doc[]),
    allDocs(payload, 'cuts'),
    allDocs(payload, 'seats'),
    allDocs(payload, 'clauses'),
  ])
  const clauseNumber = new Map(clauses.map((clause) => [clause.id, Number(clause.number)]))
  const inScope = (course: Doc) => {
    if (scope.kind === 'course') return course.id === scope.courseId
    if (scope.kind === 'portal') return course.origin === 'local' && num(course.portal) === scope.portalId
    return course.origin === 'master'
  }
  const courseRows: CourseRow[] = courses.map((course) => ({
    id: course.id, title: String(course.title || ''), origin: String(course.origin || 'master'), portal: num(course.portal), speaker: String(course.speaker || ''), inScope: inScope(course),
  }))
  const scoped = new Set(courseRows.filter((course) => course.inScope).map((course) => course.id))
  const unitRows: UnitRow[] = units.map((unit) => ({ id: unit.id, course: num(unit.course) || 0, title: String(unit.title || ''), order: Number(unit.order || 1) }))
  const lessonRows: LessonRow[] = lessons.map((lesson) => ({
    id: lesson.id,
    title: String(lesson.title || ''),
    course: num(lesson.course) || 0,
    unit: num(lesson.unit),
    order: Number(lesson.order || 1),
    speaker: String(lesson.speaker || ''),
    youtubeId: String(lesson.youtubeId || ''),
    durationSeconds: lesson.durationSeconds == null || lesson.durationSeconds === '' ? null : Number(lesson.durationSeconds),
    starterLane: String(lesson.starterLane || ''),
    transcript: tierSourceText(lesson as { youtubeId?: string; transcript?: string }) || String(lesson.transcript || ''),
    inScope: scoped.has(num(lesson.course) || 0),
  }))
  const tierRows: TierRow[] = tiers.map((tier) => ({
    id: tier.id, lesson: num(tier.lesson) || 0, horsStart: Number(tier.horsStart), horsEnd: Number(tier.horsEnd), appetiserStart: Number(tier.appetiserStart), appetiserEnd: Number(tier.appetiserEnd),
    hook: String(tier.hook || ''), turn: String(tier.turn || ''), land: String(tier.land || ''), note: String(tier.note || ''), status: String(tier.status || 'draft'),
  }))
  const pointRows: PointRow[] = points.map((point) => ({
    id: point.id, lesson: num(point.lesson) || 0, second: Number(point.second || 0), kind: String(point.kind || 'reflection'), prompt: String(point.prompt || ''),
    options: Array.isArray(point.options) ? (point.options as unknown[]).map(String) : [], correctOption: String(point.correctOption || ''), status: String(point.status || 'published'), draftNote: String(point.draftNote || ''),
  }))
  const resourceRows: ResourceRow[] = resources.map((resource) => ({ id: resource.id, lesson: num(resource.lesson) || 0, name: String(resource.name || ''), url: String(resource.url || ''), kind: String(resource.kind || 'link') }))
  const keyRows: KeyRow[] = keys.map((key) => ({ id: key.id, talkKey: String(key.talkKey || ''), lesson: num(key.lesson) || 0, channel: String(key.channel || ''), sheetStatus: String(key.sheetStatus || '') }))
  const seatRows: SeatRow[] = seats.map((seat) => ({ id: seat.id, clause: clauseNumber.get(num(seat.clause) || 0) || 0, position: Number(seat.position || 0) }))
  const seatById = new Map(seats.map((seat) => [seat.id, seat]))
  const cutRows: CutRow[] = cuts.map((cut) => {
    const seat = seatById.get(num(cut.seat) || 0)
    return {
      id: cut.id, lesson: num(cut.lesson) || 0, bestClause: cut.bestClause == null || cut.bestClause === '' ? null : Number(cut.bestClause), seatId: num(cut.seat),
      seatClause: seat ? clauseNumber.get(num(seat.clause) || 0) || null : null, seatPosition: seat ? Number(seat.position || 0) : null,
      placeholder: Boolean(cut.placeholder), status: String(cut.status || ''), start: Number(cut.start || 0), course: num(cut.course),
    }
  })
  return { scopeKind: scope.kind, portalId: scope.portalId, courseId: scope.courseId, courses: courseRows, units: unitRows, lessons: lessonRows, tiers: tierRows, points: pointRows, resources: resourceRows, keys: keyRows, cuts: cutRows, seats: seatRows }
}

export async function exportBuffer(payload: Payload, scope: SheetScope) {
  const catalogue = await loadCatalogue(payload, scope)
  return buildWorkbook(rowsFromCatalogue(catalogue))
}

export async function planBuffer(payload: Payload, scope: SheetScope, buffer: Buffer) {
  const [parsed, catalogue] = await Promise.all([readWorkbook(buffer), loadCatalogue(payload, scope)])
  const plan = planSheet(parsed, catalogue)
  return { plan, counts: planCounts(plan) }
}

function resolveRef(ref: Ref, temps: Map<string, number>) {
  if ('id' in ref) return ref.id
  const id = temps.get(ref.temp)
  if (!id) throw new Error('A row in this sheet depended on a talk that was not saved.')
  return id
}

function publicMessage(error: unknown) {
  const candidate = error as { isPublic?: boolean; message?: string } | null
  return candidate?.isPublic && candidate.message ? candidate.message : 'That row could not be saved.'
}

async function remember(payload: Payload, snapshot: SheetSnapshot, collection: string, id: number, patch: Record<string, unknown>) {
  const doc = (await payload.findByID({ collection: collection as never, id, depth: 0, overrideAccess: true })) as unknown as Doc
  const before: Record<string, unknown> = {}
  for (const key of Object.keys(patch)) before[key] = doc[key] ?? null
  snapshot.updated.push({ collection, id, before })
}

const STRIP = new Set(['id', 'createdAt', 'updatedAt', 'collection'])

async function wipeLesson(payload: Payload, snapshot: SheetSnapshot, lessonId: number) {
  const answers = await payload.count({ collection: 'answers', overrideAccess: true, where: { lesson: { equals: lessonId } } })
  if (answers.totalDocs) throw new Error('Learners have answered a question on this talk, so the sheet will not delete it.')
  const groups: [string, Where][] = [
    ['engagement-points', { lesson: { equals: lessonId } }],
    ['resources', { lesson: { equals: lessonId } }],
    ['talk-tiers', { lesson: { equals: lessonId } }],
    ['sheet-keys', { lesson: { equals: lessonId } }],
    ['cuts', { lesson: { equals: lessonId } }],
    ['ladder-items', { lesson: { equals: lessonId } }],
  ]
  for (const [collection, where] of groups) {
    const docs = await allDocs(payload, collection, where)
    for (const doc of docs) {
      const data = { ...doc }
      for (const key of STRIP) delete data[key]
      snapshot.deleted.push({ collection, data })
      await payload.delete({ collection: collection as never, id: doc.id, overrideAccess: true })
    }
  }
  const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true })) as unknown as Doc
  const data = { ...lesson }
  for (const key of STRIP) delete data[key]
  snapshot.deleted.push({ collection: 'lessons', data })
  await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
}

export async function applyPlan(payload: Payload, plan: SheetPlan, actorId: number | null): Promise<SheetSnapshot> {
  const snapshot = emptySnapshot()
  const temps = new Map<string, number>()
  for (const op of plan.ops) {
    try {
      await applyOp(payload, op, temps, snapshot, actorId)
    } catch (error) {
      const wrapped = new Error(publicMessage(error))
      ;(wrapped as { snapshot?: SheetSnapshot }).snapshot = snapshot
      throw wrapped
    }
  }
  return snapshot
}

async function applyOp(payload: Payload, op: SheetOp, temps: Map<string, number>, snapshot: SheetSnapshot, actorId: number | null) {
  if (op.op === 'course.create') {
    const doc = (await payload.create({ collection: 'courses', overrideAccess: true, data: { title: op.title, speaker: op.speaker, origin: op.origin, portal: op.portal || undefined, importable: op.origin === 'master', visibility: 'published' } as never })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'courses', doc.id)
    return
  }
  if (op.op === 'unit.create') {
    const doc = (await payload.create({ collection: 'units', overrideAccess: true, data: { title: op.title, course: resolveRef(op.course, temps), order: 1 } as never })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'units', doc.id)
    return
  }
  if (op.op === 'lesson.create') {
    const doc = (await payload.create({
      collection: 'lessons', overrideAccess: true,
      data: {
        title: op.title, sourceTitle: op.title, course: resolveRef(op.course, temps), unit: resolveRef(op.unit, temps), speaker: op.speaker, youtubeId: op.youtubeId,
        youtubeUrl: op.youtubeId ? `https://www.youtube.com/watch?v=${op.youtubeId}` : undefined, order: op.order ?? 1, starterLane: op.lane, portal: op.portal || undefined, master: op.master, transcriptSource: 'none',
      } as never,
    })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'lessons', doc.id)
    return
  }
  if (op.op === 'lesson.update') {
    const patch = { ...op.patch }
    if (typeof patch.youtubeId === 'string') patch.youtubeUrl = `https://www.youtube.com/watch?v=${patch.youtubeId}`
    await remember(payload, snapshot, 'lessons', op.id, patch)
    await payload.update({ collection: 'lessons', id: op.id, overrideAccess: true, data: patch as never })
    return
  }
  if (op.op === 'lesson.delete') {
    await wipeLesson(payload, snapshot, op.id)
    return
  }
  if (op.op === 'tier.create' || op.op === 'tier.update') {
    const data = { ...(op.op === 'tier.create' ? op.data : op.patch) }
    if (data.status === 'checked' && actorId) {
      data.checkedBy = actorId
      data.checkedAt = now().toISOString()
    }
    if (op.op === 'tier.create') {
      const doc = (await payload.create({ collection: 'talk-tiers', overrideAccess: true, data: { ...data, lesson: resolveRef(op.lesson, temps), offerResume: true, source: 'master sheet' } as never })) as unknown as Doc
      rememberCreated(snapshot, 'talk-tiers', doc.id)
    } else {
      await remember(payload, snapshot, 'talk-tiers', op.id, data)
      await payload.update({ collection: 'talk-tiers', id: op.id, overrideAccess: true, data: data as never })
    }
    return
  }
  if (op.op === 'tier.delete') {
    const doc = (await payload.findByID({ collection: 'talk-tiers', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'talk-tiers', data })
    await payload.delete({ collection: 'talk-tiers', id: op.id, overrideAccess: true })
    return
  }
  if (op.op === 'point.create' || op.op === 'point.update') {
    const data = { ...(op.op === 'point.create' ? op.data : op.patch) }
    if (data.status === 'published' && actorId) data.reviewedBy = actorId
    if (op.op === 'point.create') {
      const doc = (await payload.create({ collection: 'engagement-points', overrideAccess: true, data: { ...data, lesson: resolveRef(op.lesson, temps) } as never })) as unknown as Doc
      rememberCreated(snapshot, 'engagement-points', doc.id)
    } else {
      await remember(payload, snapshot, 'engagement-points', op.id, data)
      await payload.update({ collection: 'engagement-points', id: op.id, overrideAccess: true, data: data as never })
    }
    return
  }
  if (op.op === 'point.delete') {
    const answers = await payload.count({ collection: 'answers', overrideAccess: true, where: { point: { equals: op.id } } })
    if (answers.totalDocs) throw new Error('Learners have answered this question, so the sheet will not delete it.')
    const doc = (await payload.findByID({ collection: 'engagement-points', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'engagement-points', data })
    await payload.delete({ collection: 'engagement-points', id: op.id, overrideAccess: true })
    return
  }
  if (op.op === 'resource.create') {
    const doc = (await payload.create({ collection: 'resources', overrideAccess: true, data: { ...op.data, lesson: resolveRef(op.lesson, temps) } as never })) as unknown as Doc
    rememberCreated(snapshot, 'resources', doc.id)
    return
  }
  if (op.op === 'resource.update') {
    await remember(payload, snapshot, 'resources', op.id, op.patch)
    await payload.update({ collection: 'resources', id: op.id, overrideAccess: true, data: op.patch as never })
    return
  }
  if (op.op === 'resource.delete') {
    const doc = (await payload.findByID({ collection: 'resources', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'resources', data })
    await payload.delete({ collection: 'resources', id: op.id, overrideAccess: true })
    return
  }
  if (op.op === 'key.upsert') {
    const data = { talkKey: op.talkKey, lesson: resolveRef(op.lesson, temps), channel: op.channel ?? null, sheetStatus: op.sheetStatus ?? null }
    if (op.id) {
      await remember(payload, snapshot, 'sheet-keys', op.id, data)
      await payload.update({ collection: 'sheet-keys', id: op.id, overrideAccess: true, data: data as never })
    } else {
      const doc = (await payload.create({ collection: 'sheet-keys', overrideAccess: true, data: data as never })) as unknown as Doc
      rememberCreated(snapshot, 'sheet-keys', doc.id)
    }
    return
  }
  if (op.op === 'key.delete') {
    const doc = (await payload.findByID({ collection: 'sheet-keys', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'sheet-keys', data })
    await payload.delete({ collection: 'sheet-keys', id: op.id, overrideAccess: true })
    return
  }
  if (op.op === 'cut.create') {
    const doc = (await payload.create({ collection: 'cuts', overrideAccess: true, data: { ...op.data, lesson: resolveRef(op.lesson, temps), course: resolveRef(op.course, temps) } as never })) as unknown as Doc
    rememberCreated(snapshot, 'cuts', doc.id)
    return
  }
  if (op.op === 'cut.update') {
    await remember(payload, snapshot, 'cuts', op.id, op.patch)
    await payload.update({ collection: 'cuts', id: op.id, overrideAccess: true, data: op.patch as never })
    return
  }
  if (op.op === 'child.delete') {
    await payload.delete({ collection: op.collection, id: op.id, overrideAccess: true })
  }
}

const RESTORE_ORDER = ['courses', 'units', 'lessons', 'talk-tiers', 'cuts', 'engagement-points', 'resources', 'sheet-keys', 'ladder-items']

export async function undoSnapshot(payload: Payload, snapshot: SheetSnapshot) {
  for (const collection of CHILD_ORDER) {
    for (const id of snapshot.created[collection] || []) {
      await payload.delete({ collection: collection as never, id, overrideAccess: true }).catch(() => undefined)
    }
  }
  const deleted = [...snapshot.deleted].sort((a, b) => RESTORE_ORDER.indexOf(a.collection) - RESTORE_ORDER.indexOf(b.collection))
  for (const row of deleted) {
    await payload.create({ collection: row.collection as never, overrideAccess: true, data: row.data as never })
  }
  for (const row of snapshot.updated) {
    await payload.update({ collection: row.collection as never, id: row.id, overrideAccess: true, data: row.before as never })
  }
}

export function summaryOf(plan: SheetPlan, fileName: string) {
  const counts = planCounts(plan)
  return {
    fileName,
    counts,
    errors: plan.errors.slice(0, 200),
    errorTotal: plan.errors.length,
    changes: plan.changes.slice(0, 200),
    changeTotal: plan.changes.length,
  }
}

export async function writeAudit(payload: Payload, event: string, actor: { id: number; role?: string } | null, portal: number | null, detail: Record<string, unknown>) {
  await audit(payload, event, { actor: actor?.id, actorRole: actor?.role, portal: portal || undefined, detail, at: now().toISOString() })
}

export function scopeFrom(kind: string, portalId: number | null, courseId: number | null, desk: 'master' | 'portal'): SheetScope {
  const safe = kind === 'portal' || kind === 'course' ? kind : 'library'
  return { kind: desk === 'portal' && safe === 'library' ? 'portal' : safe, portalId, courseId, desk }
}

export { emptyCatalogue }
