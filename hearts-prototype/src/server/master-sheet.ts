// Loads the library, applies a master-sheet plan, and puts the last import back.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { APIError, type Payload, type Where } from 'payload'
import { idOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { audit } from '@/server/viewas'
import { horsCapOf, normaliseSpans, type AppetiserSpan } from '@/lib/tiers'
import { transcriptFileKind, transcriptFromFile } from '@/lib/transcript-file'
import { tierSourceText } from '@/server/tier-source'
import {
  buildWorkbook,
  emptyCatalogue,
  planCounts,
  planSheet,
  readWorkbook,
  remapRefs,
  rowsFromCatalogue,
  type CircleRow,
  type CourseRow,
  type CutRow,
  type KeyRow,
  type LessonRow,
  type PointRow,
  type Ref,
  type ResourceRow,
  type SeatRow,
  type PackRow,
  type SheetCatalogue,
  type SheetOp,
  type SheetPlan,
  type SpeakerRow,
  type TierRow,
  type UnitRow,
} from '@/lib/master-sheet'

export type SheetScope = { kind: 'library' | 'portal' | 'course'; portalId: number | null; courseId: number | null; desk: 'master' | 'portal' }

type Doc = Record<string, unknown> & { id: number }

export type SheetSnapshot = {
  created: Record<string, number[]>
  updated: { collection: string; id: number; before: Record<string, unknown> }[]
  deleted: { collection: string; data: Record<string, unknown>; formerId?: number }[]
  pushedLearners?: number
}

const CHILD_ORDER = ['circle-answers', 'engagement-points', 'resources', 'talk-tiers', 'sheet-keys', 'cuts', 'ladder-items', 'lessons', 'units', 'courses', 'speakers']

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
  const [courses, units, lessons, tiers, points, resources, keys, cuts, seats, clauses, circle, speakers, packs] = await Promise.all([
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
    allDocs(payload, 'circle-answers', scope.desk === 'portal' ? { or: [{ portal: { exists: false } }, { portal: { equals: scope.portalId } }] } : undefined),
    allDocs(payload, 'speakers'),
    allDocs(payload, 'packs'),
  ])
  const clauseNumber = new Map(clauses.map((clause) => [clause.id, Number(clause.number)]))
  const inScope = (course: Doc) => {
    if (scope.kind === 'course') return course.id === scope.courseId
    if (scope.kind === 'portal') return course.origin === 'local' && num(course.portal) === scope.portalId
    return course.origin === 'master'
  }
  const courseRows: CourseRow[] = courses.map((course) => ({
    id: course.id, title: String(course.title || ''), origin: String(course.origin || 'master'), portal: num(course.portal), speaker: String(course.speaker || ''), speakerId: num(course.speakerProfile), inScope: inScope(course),
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
    speakerId: num(lesson.speakerProfile),
    youtubeId: String(lesson.youtubeId || ''),
    durationSeconds: lesson.durationSeconds == null || lesson.durationSeconds === '' ? null : Number(lesson.durationSeconds),
    starterLane: String(lesson.starterLane || ''),
    transcript: tierSourceText(lesson as { youtubeId?: string; transcript?: string }) || String(lesson.transcript || ''),
    transcriptNote: String(lesson.transcriptNote || ''),
    provider: String(lesson.videoProvider || ''),
    vimeoId: String(lesson.vimeoId || ''),
    mediaId: num(lesson.film),
    inScope: scoped.has(num(lesson.course) || 0),
  }))
  const tierRows: TierRow[] = tiers.map((tier) => ({
    id: tier.id, lesson: num(tier.lesson) || 0, horsStart: Number(tier.horsStart), horsEnd: Number(tier.horsEnd), appetiserStart: Number(tier.appetiserStart), appetiserEnd: Number(tier.appetiserEnd),
    appetiserSpans: spansOf(tier.appetiserSpans),
    hook: String(tier.hook || ''), turn: String(tier.turn || ''), land: String(tier.land || ''), note: String(tier.note || ''), status: String(tier.status || 'draft'),
  }))
  const pointRows: PointRow[] = points.map((point) => ({
    id: point.id, lesson: num(point.lesson) || 0, second: Number(point.second || 0), kind: String(point.kind || 'reflection'), prompt: String(point.prompt || ''),
    options: Array.isArray(point.options) ? (point.options as unknown[]).map(String) : [], correctOption: String(point.correctOption || ''), status: String(point.status || 'published'), draftNote: String(point.draftNote || ''),
    dueDays: point.dueDays == null || point.dueDays === '' ? null : Number(point.dueDays), evidence: String(point.evidence || ''), showImam: Boolean(point.showImam), family: String(point.family || ''),
  }))
  const resourceRows: ResourceRow[] = resources.map((resource) => ({ id: resource.id, lesson: num(resource.lesson) || 0, name: String(resource.name || ''), url: String(resource.url || ''), kind: String(resource.kind || 'link'), body: String(resource.body || ''), mediaId: num(resource.file) }))
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
  const pointLesson = new Map(pointRows.map((point) => [point.id, point.lesson]))
  const circleRows: CircleRow[] = circle.flatMap((answer) => {
    const point = num(answer.point) || 0
    const lesson = pointLesson.get(point)
    if (!lesson) return []
    return [{
      id: answer.id, point, lesson, portal: num(answer.portal), name: String(answer.name || ''), body: String(answer.body || ''),
      tone: String(answer.tone || ''), length: String(answer.length || ''), origin: String(answer.origin || 'staff'), enabled: answer.enabled !== false,
    }]
  })
  const speakerRows: SpeakerRow[] = speakers.map((speaker) => ({
    id: speaker.id, name: String(speaker.name || ''), honorific: String(speaker.honorific || ''), displayName: String(speaker.displayName || ''), slug: String(speaker.slug || ''),
    aliases: Array.isArray(speaker.aliases) ? (speaker.aliases as unknown[]).map(String) : [], bio: String(speaker.bio || ''), photoUrl: String(speaker.photoUrl || ''),
    links: linkRows(speaker.links), sources: String(speaker.sources || ''), status: String(speaker.status || 'draft'),
  }))
  const packScope = scope.kind === 'portal' || (scope.kind === 'course' && scope.portalId)
  const packRows: PackRow[] = packs.map((pack) => ({
    id: pack.id, title: String(pack.title || ''), owner: String(pack.owner || ''), portal: num(pack.portal),
    courseIds: Array.isArray(pack.courses) ? (pack.courses as unknown[]).map((course) => num(course) || 0).filter(Boolean) : [],
    inScope: packScope ? pack.owner === 'portal' && num(pack.portal) === scope.portalId : pack.owner === 'master',
  }))
  return {
    scopeKind: scope.kind, portalId: scope.portalId, courseId: scope.courseId, courses: courseRows, units: unitRows, lessons: lessonRows, tiers: tierRows, points: pointRows, resources: resourceRows, keys: keyRows, cuts: cutRows, seats: seatRows,
    circle: circleRows, circlePortal: scope.desk === 'portal' ? scope.portalId : null, speakers: speakerRows, packs: packRows,
  }
}

function linkRows(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as { label?: unknown; url?: unknown }
    const url = String(row.url || '')
    if (!url) return []
    return [{ label: String(row.label || 'Link'), url }]
  })
}

export async function exportBuffer(payload: Payload, scope: SheetScope) {
  const catalogue = await loadCatalogue(payload, scope)
  return buildWorkbook(rowsFromCatalogue(catalogue))
}

function spansOf(value: unknown): AppetiserSpan[] | null {
  if (!Array.isArray(value)) return null
  const spans: AppetiserSpan[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const row = item as { role?: string; start?: unknown; end?: unknown }
    if (row.role !== 'hook' && row.role !== 'turn' && row.role !== 'land') continue
    const start = Number(row.start)
    const end = Number(row.end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue
    spans.push({ role: row.role, start, end })
  }
  return spans.length ? normaliseSpans(spans) : null
}

export async function planBuffer(payload: Payload, scope: SheetScope, buffer: Buffer) {
  const [parsed, catalogue, flags] = await Promise.all([
    readWorkbook(buffer),
    loadCatalogue(payload, scope),
    payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null) as Promise<{ horsMaxSeconds?: number } | null>,
  ])
  catalogue.horsMaxSeconds = horsCapOf(flags?.horsMaxSeconds)
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

async function removeDoc(payload: Payload, snapshot: SheetSnapshot, collection: string, id: number) {
  const doc = (await payload.findByID({ collection: collection as never, id, depth: 0, overrideAccess: true })) as unknown as Doc
  const data = { ...doc }
  for (const key of STRIP) delete data[key]
  snapshot.deleted.push({ collection, data, formerId: id })
  await payload.delete({ collection: collection as never, id, overrideAccess: true })
}

async function wipeLesson(payload: Payload, snapshot: SheetSnapshot, lessonId: number) {
  const answers = await payload.count({ collection: 'answers', overrideAccess: true, where: { lesson: { equals: lessonId } } })
  if (answers.totalDocs) throw new Error('Learners have answered a question on this talk, so the sheet will not delete it.')
  const pointIds = (await allDocs(payload, 'engagement-points', { lesson: { equals: lessonId } })).map((point) => point.id)
  const groups: [string, Where][] = [
    ['circle-answers', pointIds.length ? { or: [{ lesson: { equals: lessonId } }, { point: { in: pointIds } }] } : { lesson: { equals: lessonId } }],
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
      snapshot.deleted.push({ collection, data, formerId: doc.id })
      await payload.delete({ collection: collection as never, id: doc.id, overrideAccess: true })
    }
  }
  const lesson = (await payload.findByID({ collection: 'lessons', id: lessonId, depth: 0, overrideAccess: true })) as unknown as Doc
  const data = { ...lesson }
  for (const key of STRIP) delete data[key]
  snapshot.deleted.push({ collection: 'lessons', data, formerId: lessonId })
  await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
}

export async function applyPlan(payload: Payload, plan: SheetPlan, actorId: number | null, options?: { pushLearners?: boolean }): Promise<SheetSnapshot> {
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
  if (options?.pushLearners) snapshot.pushedLearners = await pushAddedCourses(payload, plan, temps, snapshot)
  return snapshot
}

function relationId(value: unknown, temps: Map<string, number>) {
  if (value && typeof value === 'object' && ('id' in value || 'temp' in value)) return resolveRef(value as Ref, temps)
  return value
}

async function pushAddedCourses(payload: Payload, plan: SheetPlan, temps: Map<string, number>, snapshot: SheetSnapshot) {
  const pushed = new Set<number>()
  for (const op of plan.ops) {
    if (op.op !== 'pack.add') continue
    const courseId = resolveRef(op.course, temps)
    const codes = await allDocs(payload, 'access-codes')
    const codeIds = codes.filter((code) => ((code.packs as unknown[]) || []).some((pack) => num(pack) === op.id)).map((code) => code.id)
    if (!codeIds.length) continue
    const users = await allDocs(payload, 'users', { accessCode: { in: codeIds } })
    for (const user of users) {
      if (!Array.isArray(user.courseList)) continue
      const list = (user.courseList as unknown[]).map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
      if (list.includes(courseId)) continue
      const remembered = snapshot.updated.find((row) => row.collection === 'users' && row.id === user.id && Object.prototype.hasOwnProperty.call(row.before, 'courseList'))
      if (!remembered) snapshot.updated.push({ collection: 'users', id: user.id, before: { courseList: list } })
      const next = [...list, courseId]
      user.courseList = next
      await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { courseList: next } as never })
      pushed.add(user.id)
    }
  }
  return pushed.size
}

async function applyOp(payload: Payload, op: SheetOp, temps: Map<string, number>, snapshot: SheetSnapshot, actorId: number | null) {
  if (op.op === 'speaker.create') {
    const doc = (await payload.create({ collection: 'speakers', overrideAccess: true, data: op.data as never })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'speakers', doc.id)
    return
  }
  if (op.op === 'speaker.update') {
    await remember(payload, snapshot, 'speakers', op.id, op.patch)
    await payload.update({ collection: 'speakers', id: op.id, overrideAccess: true, data: op.patch as never })
    return
  }
  if (op.op === 'course.create') {
    const doc = (await payload.create({ collection: 'courses', overrideAccess: true, data: { title: op.title, speaker: op.speaker, speakerProfile: op.speakerProfile ? resolveRef(op.speakerProfile, temps) : undefined, origin: op.origin, portal: op.portal || undefined, importable: op.origin === 'master', visibility: 'published' } as never })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'courses', doc.id)
    return
  }
  if (op.op === 'course.update') {
    const patch = { ...op.patch }
    if ('speakerProfile' in patch) patch.speakerProfile = relationId(patch.speakerProfile, temps)
    await remember(payload, snapshot, 'courses', op.id, patch)
    await payload.update({ collection: 'courses', id: op.id, overrideAccess: true, data: patch as never })
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
        title: op.title, sourceTitle: op.title, course: resolveRef(op.course, temps), unit: resolveRef(op.unit, temps), speaker: op.speaker, speakerProfile: op.speakerProfile ? resolveRef(op.speakerProfile, temps) : undefined, youtubeId: op.youtubeId,
        youtubeUrl: op.youtubeId ? `https://www.youtube.com/watch?v=${op.youtubeId}` : undefined, order: op.order ?? 1, starterLane: op.lane, portal: op.portal || undefined, master: op.master,
        transcriptSource: op.transcriptSource || 'none', videoProvider: op.provider || undefined, vimeoId: op.vimeoId || undefined, film: op.mediaId || undefined,
        durationSeconds: op.durationSeconds ?? undefined, transcript: op.transcript || undefined, transcriptNote: op.transcriptNote || undefined,
      } as never,
    })) as unknown as Doc
    temps.set(op.temp, doc.id)
    rememberCreated(snapshot, 'lessons', doc.id)
    return
  }
  if (op.op === 'pack.add') {
    const courseId = resolveRef(op.course, temps)
    const pack = (await payload.findByID({ collection: 'packs', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const current = Array.isArray(pack.courses) ? (pack.courses as unknown[]).map((course) => num(course) || 0).filter(Boolean) : []
    if (current.includes(courseId)) return
    const remembered = snapshot.updated.find((row) => row.collection === 'packs' && row.id === op.id && Object.prototype.hasOwnProperty.call(row.before, 'courses'))
    if (!remembered) snapshot.updated.push({ collection: 'packs', id: op.id, before: { courses: current } })
    await payload.update({ collection: 'packs', id: op.id, overrideAccess: true, data: { courses: [...current, courseId] } as never })
    return
  }
  if (op.op === 'lesson.update') {
    const patch = { ...op.patch }
    if ('speakerProfile' in patch) patch.speakerProfile = relationId(patch.speakerProfile, temps)
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
    snapshot.deleted.push({ collection: 'talk-tiers', data, formerId: op.id })
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
    for (const answer of await allDocs(payload, 'circle-answers', { point: { equals: op.id } })) await removeDoc(payload, snapshot, 'circle-answers', answer.id)
    const doc = (await payload.findByID({ collection: 'engagement-points', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'engagement-points', data, formerId: op.id })
    await payload.delete({ collection: 'engagement-points', id: op.id, overrideAccess: true })
    return
  }
  if (op.op === 'resource.create') {
    const lessonId = resolveRef(op.lesson, temps)
    const doc = (await payload.create({ collection: 'resources', overrideAccess: true, data: { ...op.data, lesson: lessonId } as never })) as unknown as Doc
    rememberCreated(snapshot, 'resources', doc.id)
    await ingestResourceFile(payload, snapshot, lessonId, String(op.data.kind || ''), op.data.file)
    return
  }
  if (op.op === 'resource.update') {
    await remember(payload, snapshot, 'resources', op.id, op.patch)
    await payload.update({ collection: 'resources', id: op.id, overrideAccess: true, data: op.patch as never })
    if (op.patch.kind === 'transcript' || op.patch.file) {
      const resource = (await payload.findByID({ collection: 'resources', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
      await ingestResourceFile(payload, snapshot, num(resource.lesson) || 0, String(resource.kind || ''), resource.file)
    }
    return
  }
  if (op.op === 'resource.delete') {
    const doc = (await payload.findByID({ collection: 'resources', id: op.id, depth: 0, overrideAccess: true })) as unknown as Doc
    const data = { ...doc }
    for (const key of STRIP) delete data[key]
    snapshot.deleted.push({ collection: 'resources', data, formerId: op.id })
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
    snapshot.deleted.push({ collection: 'sheet-keys', data, formerId: op.id })
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
  if (op.op === 'circle.create') {
    const doc = (await payload.create({ collection: 'circle-answers' as never, overrideAccess: true, data: { ...op.data, point: op.point, lesson: op.lesson, author: actorId || undefined } as never })) as unknown as Doc
    rememberCreated(snapshot, 'circle-answers', doc.id)
    return
  }
  if (op.op === 'circle.update') {
    await remember(payload, snapshot, 'circle-answers', op.id, op.patch)
    await payload.update({ collection: 'circle-answers' as never, id: op.id, overrideAccess: true, data: op.patch as never })
    return
  }
  if (op.op === 'circle.delete') {
    await removeDoc(payload, snapshot, 'circle-answers', op.id)
    return
  }
  if (op.op === 'child.delete') {
    await payload.delete({ collection: op.collection, id: op.id, overrideAccess: true })
  }
}

const RESTORE_ORDER = ['courses', 'units', 'lessons', 'talk-tiers', 'cuts', 'engagement-points', 'circle-answers', 'resources', 'sheet-keys', 'ladder-items']

/** A created talk or question that a learner has already answered stays. Undo must not remove their work. */
export async function undoBlockedReason(payload: Payload, snapshot: SheetSnapshot): Promise<string | null> {
  const lessonIds = snapshot.created.lessons || []
  const pointIds = snapshot.created['engagement-points'] || []
  if (lessonIds.length) {
    const answers = await payload.count({ collection: 'answers', overrideAccess: true, where: { lesson: { in: lessonIds } } })
    if (answers.totalDocs) return 'Learners have answered a question on this talk, so the sheet will not delete it.'
  }
  if (pointIds.length) {
    const answers = await payload.count({ collection: 'answers', overrideAccess: true, where: { point: { in: pointIds } } })
    if (answers.totalDocs) return 'Learners have answered this question, so the sheet will not delete it.'
  }
  return null
}

export async function undoSnapshot(payload: Payload, snapshot: SheetSnapshot) {
  const blocked = await undoBlockedReason(payload, snapshot)
  if (blocked) throw new Error(blocked)
  const createdPoints = snapshot.created['engagement-points'] || []
  const createdLessons = snapshot.created.lessons || []
  if (createdPoints.length || createdLessons.length) {
    // Circle answers written since for a question this import added go with it, so none is left under nothing.
    const where: Where = { or: [...(createdPoints.length ? [{ point: { in: createdPoints } }] : []), ...(createdLessons.length ? [{ lesson: { in: createdLessons } }] : [])] }
    for (const answer of await allDocs(payload, 'circle-answers', where)) {
      await payload.delete({ collection: 'circle-answers' as never, id: answer.id, overrideAccess: true }).catch(() => undefined)
    }
  }
  for (const collection of CHILD_ORDER) {
    for (const id of snapshot.created[collection] || []) {
      await payload.delete({ collection: collection as never, id, overrideAccess: true }).catch(() => undefined)
    }
  }
  const deleted = [...snapshot.deleted].sort((a, b) => RESTORE_ORDER.indexOf(a.collection) - RESTORE_ORDER.indexOf(b.collection))
  // Postgres gives a restored row a new id, so rows restored after it are pointed at the new one.
  const moved = new Map<string, Map<number, number>>()
  for (const row of deleted) {
    const doc = (await payload.create({ collection: row.collection as never, overrideAccess: true, data: remapRefs(row.data, moved) as never })) as unknown as Doc
    if (row.formerId) {
      const ids = moved.get(row.collection) || new Map<number, number>()
      ids.set(row.formerId, doc.id)
      moved.set(row.collection, ids)
    }
  }
  for (const row of snapshot.updated) {
    const id = moved.get(row.collection)?.get(row.id) ?? row.id
    await payload.update({ collection: row.collection as never, id, overrideAccess: true, data: remapRefs(row.before, moved) as never })
  }
}

async function ingestResourceFile(payload: Payload, snapshot: SheetSnapshot, lessonId: number, kind: string, file: unknown) {
  const mediaId = num(file)
  if (!lessonId || !mediaId || (kind !== 'transcript' && kind !== 'file')) return
  const media = (await payload.findByID({ collection: 'media', id: mediaId, depth: 0, overrideAccess: true }).catch(() => null)) as { filename?: string; mimeType?: string } | null
  if (!media?.filename) {
    if (kind === 'transcript') throw new APIError('That transcript file was not found. Upload it first, then put its media id on the row.', 400, null, true)
    return
  }
  if (!transcriptFileKind(kind, media.mimeType || '', media.filename)) {
    if (kind === 'transcript') throw new APIError('A transcript resource needs a text file, such as .txt or .vtt.', 400, null, true)
    return
  }
  let bytes: Buffer
  try {
    bytes = readFileSync(path.join(process.cwd(), 'media', media.filename))
  } catch {
    throw new APIError('That transcript file was not found on disk.', 400, null, true)
  }
  const parsed = transcriptFromFile(bytes)
  if (!parsed.ok) throw new APIError(parsed.message, 400, null, true)
  const patch = { transcript: parsed.text, transcriptSource: 'upload' }
  await remember(payload, snapshot, 'lessons', lessonId, patch)
  await payload.update({ collection: 'lessons', id: lessonId, overrideAccess: true, data: patch as never })
}

export function summaryOf(plan: SheetPlan, fileName: string) {
  const counts = planCounts(plan)
  return {
    fileName,
    counts,
    errors: plan.errors.slice(0, 200),
    errorTotal: plan.errors.length,
    warnings: (plan.warnings || []).slice(0, 200),
    warningTotal: plan.warnings?.length || 0,
    changes: plan.changes.slice(0, 200),
    changeTotal: plan.changes.length,
  }
}

/** Applies a preview and, when the desk ticked it, records that learners with a saved course list were updated. */
export async function applyImportedPlan(payload: Payload, plan: SheetPlan, user: { id: number; role?: string } | null, portalId: number | null, options: { pushLearners: boolean; fileName: string; importId?: number | null }) {
  const snapshot = await applyPlan(payload, plan, user?.id ?? null, { pushLearners: options.pushLearners })
  if (options.pushLearners) {
    await writeAudit(payload, 'sheet.push-learners', user, portalId, { importId: options.importId ?? null, fileName: options.fileName, pushedLearners: snapshot.pushedLearners || 0 })
  }
  return snapshot
}

export async function writeAudit(payload: Payload, event: string, actor: { id: number; role?: string } | null, portal: number | null, detail: Record<string, unknown>) {
  await audit(payload, event, { actor: actor?.id, actorRole: actor?.role, portal: portal || undefined, detail, at: now().toISOString() })
}

export function scopeFrom(kind: string, portalId: number | null, courseId: number | null, desk: 'master' | 'portal'): SheetScope {
  const safe = kind === 'portal' || kind === 'course' ? kind : 'library'
  return { kind: desk === 'portal' && safe === 'library' ? 'portal' : safe, portalId, courseId, desk }
}

export { emptyCatalogue }
