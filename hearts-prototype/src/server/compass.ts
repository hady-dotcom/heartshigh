import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { attribute, portalSummary, rawScoreLeak, recalibrationDue, summarise, withLives, type AreaReading, type AttemptPoint, type LearnerCompass, type SteerTag, type WatchedItem } from '@/lib/compass'
import { applyMonth, formById, formForRound, LIFE_EVENTS, LIFE_NOTE_MAX, lifeByKeys } from '@/lib/compass-bank'
import { DEFAULT_COPY, FOCUS_NAMES, LIFE_OPTIONS, LIFE_PROMPT, type CompassCopy, type LifeOption, type PlaceCopy } from '@/lib/compass-data'
import { DEFAULT_MIX, normaliseMix, rankFeed, SCALE_DOOR, type FeedCandidate, type FeedKind, type Mix } from '@/lib/compass-feed'
import { doorNumberOfClause } from '@/lib/doors'
import { freshState, replayTaps, SCALE_KEYS, type ScaleDef, type ScaleKey, type SceneDef } from '@/lib/heart'
import { idOf, portalIdOf } from '@/lib/ids'
import { bandFromRow, nearestPersona, toRung, type PersonaBand } from '@/lib/persona'
import { PERSONA_V2 } from '@/lib/persona-v2'
import type { SessionUser } from './context'
import { audit } from './viewas'

type Row = Record<string, unknown> & { id: number }

export type CompassBundle = CompassCopy & { lifeCaption: string; lifeSubline: string; lifeOptions: LifeOption[] }

type StoredAttempt = AttemptPoint & { lifeKey: string; lifeKeys: string[]; lifeNote: string; bank: string; formKey: string }

const STAFF = new Set(['master', 'portal-admin', 'teacher'])

function asScales(value: unknown): Partial<Record<ScaleKey, number>> {
  if (!value || typeof value !== 'object') return {}
  const out: Partial<Record<ScaleKey, number>> = {}
  for (const key of SCALE_KEYS) {
    const raw = (value as Record<string, unknown>)[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw
  }
  return out
}

export function canGuide(actor: SessionUser, portalId: number) {
  if (!STAFF.has(actor.role)) return false
  if (actor.role === 'master') return true
  return portalIdOf(actor) === portalId
}

export async function loadCopy(payload: Payload): Promise<CompassBundle> {
  const found = await payload.find({ collection: 'compass-settings', overrideAccess: true, depth: 0, limit: 1, where: { key: { equals: 'default' } } })
  const doc = found.docs[0] as unknown as Row | undefined
  if (!doc) return { ...DEFAULT_COPY, lifeCaption: LIFE_PROMPT.caption, lifeSubline: LIFE_PROMPT.subline, lifeOptions: LIFE_OPTIONS }
  const places = ((doc.places as PlaceCopy[]) || []).filter((place) => place?.label)
  const lifeOptions = ((doc.lifeOptions as LifeOption[]) || []).filter((option) => option?.key && option.label && SCALE_KEYS.includes(option.boost))
  const frame = doc.frame === 'focusing' || doc.frame === 'places' || doc.frame === 'both' ? doc.frame : DEFAULT_COPY.frame
  return {
    frame,
    focusLead: String(doc.focusLead || DEFAULT_COPY.focusLead),
    places: places.length ? places : DEFAULT_COPY.places,
    movementUp: String(doc.movementUp || DEFAULT_COPY.movementUp),
    movementSame: String(doc.movementSame || DEFAULT_COPY.movementSame),
    movementOnward: String(doc.movementOnward || DEFAULT_COPY.movementOnward),
    lifeCaption: String(doc.lifeCaption || LIFE_PROMPT.caption),
    lifeSubline: String(doc.lifeSubline || LIFE_PROMPT.subline),
    lifeOptions: lifeOptions.length ? lifeOptions : LIFE_OPTIONS,
  }
}

async function scaleIndex(payload: Payload) {
  const scales = (await payload.find({ collection: 'heart-scales', overrideAccess: true, depth: 0, limit: 20 })).docs as unknown as Row[]
  const focus = new Map<ScaleKey, string>()
  const leon = new Map<ScaleKey, string>()
  const idToKey = new Map<number, ScaleKey>()
  for (const scale of scales) {
    const key = String(scale.key) as ScaleKey
    if (!SCALE_KEYS.includes(key)) continue
    focus.set(key, String(scale.focusName || FOCUS_NAMES[key]))
    leon.set(key, String(scale.leonName || key))
    idToKey.set(scale.id, key)
  }
  for (const key of SCALE_KEYS) if (!focus.has(key)) focus.set(key, FOCUS_NAMES[key])
  return { focus, leon, idToKey }
}

async function attemptsOf(payload: Payload, userId: number): Promise<StoredAttempt[]> {
  const found = await payload.find({ collection: 'compass-attempts', overrideAccess: true, depth: 0, limit: 100, sort: 'at', where: { user: { equals: userId } } })
  return (found.docs as unknown as Row[]).map((row) => ({
    at: new Date(String(row.at || row.createdAt)).getTime(),
    scales: asScales(row.scales),
    lifeKey: typeof row.lifeKey === 'string' ? row.lifeKey : '',
    lifeKeys: lifeKeysOf(row),
    lifeNote: typeof row.lifeNote === 'string' ? row.lifeNote : '',
    bank: String(row.bank || 'opening'),
    formKey: typeof row.formKey === 'string' ? row.formKey : '',
  })).filter((row) => !Number.isNaN(row.at))
}

function lifeKeysOf(row: Row) {
  const fromList = Array.isArray(row.lifeKeys) ? row.lifeKeys.map((key) => String(key)).filter((key) => LIFE_EVENTS.some((event) => event.key === key)) : []
  if (fromList.length) return fromList
  return typeof row.lifeKey === 'string' && row.lifeKey ? [row.lifeKey] : []
}

async function sceneDefs(payload: Payload): Promise<{ scenes: SceneDef[]; scales: ScaleDef[] }> {
  const [sceneRows, scaleRows, laneRows] = await Promise.all([
    payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 20, sort: 'order', where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'heart-scales', overrideAccess: true, depth: 0, limit: 20 }),
    payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 }),
  ])
  const laneKey = new Map((laneRows.docs as unknown as Row[]).map((lane) => [lane.id, String(lane.key)]))
  const scenes: SceneDef[] = (sceneRows.docs as unknown as Row[]).map((row) => ({
    key: String(row.key),
    order: Number(row.order || 0),
    layout: (row.layout as SceneDef['layout']) || 'grid4',
    caption: String(row.caption || ''),
    subline: String(row.subline || ''),
    options: ((row.options as { key?: string; label?: string; nudges?: { scale?: ScaleKey; delta?: number }[]; intentLane?: unknown; spineFirst?: boolean; crisis?: boolean; sensitivity?: 'normal' | 'private' }[]) || []).map((option) => ({
      key: String(option.key || ''),
      label: String(option.label || ''),
      nudges: (option.nudges || []).filter((nudge) => nudge.scale && (nudge.delta === -1 || nudge.delta === 0 || nudge.delta === 1)).map((nudge) => ({ scale: nudge.scale as ScaleKey, delta: nudge.delta as -1 | 0 | 1 })),
      intentLane: laneKey.get(idOf(option.intentLane) || 0),
      spineFirst: Boolean(option.spineFirst),
      crisis: Boolean(option.crisis),
      sensitivity: option.sensitivity,
    })),
  }))
  const scales: ScaleDef[] = (scaleRows.docs as unknown as Row[]).filter((row) => SCALE_KEYS.includes(String(row.key) as ScaleKey)).map((row) => ({
    key: String(row.key) as ScaleKey,
    firstOpenRead: row.firstOpenRead !== false,
  }))
  return { scenes, scales }
}

export async function readingFromTaps(payload: Payload, taps: { sceneKey: string; optionKey: string }[]) {
  const { scenes, scales } = await sceneDefs(payload)
  const state = freshState('', 1, now().getTime())
  state.taps = taps.filter((tap) => tap.optionKey !== 'pass').map((tap) => ({ scene: tap.sceneKey, option: tap.optionKey, at: now().getTime() }))
  return replayTaps(state, scenes, scales).s
}

export async function recordAttempt(
  payload: Payload,
  userId: number,
  portalId: number,
  scales: Partial<Record<ScaleKey, number>>,
  bank: 'opening' | 'month',
  lifeKey?: string,
  extra?: { lifeKeys?: string[]; lifeNote?: string; formKey?: string; demoKey?: string },
) {
  const lifeKeys = (extra?.lifeKeys || (lifeKey ? [lifeKey] : [])).filter((key) => LIFE_EVENTS.some((event) => event.key === key))
  await payload.create({
    collection: 'compass-attempts',
    overrideAccess: true,
    data: {
      user: userId,
      portal: portalId,
      at: now().toISOString(),
      bank,
      lifeKey: lifeKeys[0] || lifeKey || undefined,
      lifeKeys,
      lifeNote: extra?.lifeNote ? extra.lifeNote.slice(0, LIFE_NOTE_MAX) : undefined,
      formKey: extra?.formKey || undefined,
      demoKey: extra?.demoKey || undefined,
      scales,
    } as never,
  })
}

export async function recordOpeningAttempt(payload: Payload, userId: number, portalId: number, taps: { sceneKey: string; optionKey: string }[]) {
  const scales = await readingFromTaps(payload, taps)
  await recordAttempt(payload, userId, portalId, scales, 'opening')
}

async function watchedBy(payload: Payload, userIds: number[]) {
  const index = await scaleIndex(payload)
  const { idToKey } = index
  const lanes = (await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 })).docs as unknown as Row[]
  const laneScale = new Map<number, ScaleKey>()
  const laneKeyByScale = new Map<ScaleKey, string>()
  for (const lane of lanes) {
    const key = idToKey.get(idOf(lane.scale) || 0)
    if (!key) continue
    laneScale.set(lane.id, key)
    if (!lane.optInOnly && !laneKeyByScale.has(key)) laneKeyByScale.set(key, String(lane.key))
  }
  const completions = userIds.length
    ? ((await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 2000, where: { user: { in: userIds } } })).docs as unknown as Row[])
    : []
  const lessonIds = [...new Set(completions.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: lessonIds.length, where: { id: { in: lessonIds } } })).docs as unknown as Row[]) : []
  const titleOf = new Map(lessons.map((row) => [row.id, String(row.title || 'A talk')]))
  const cuts = lessonIds.length ? ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 1000, where: { lesson: { in: lessonIds } } })).docs as unknown as Row[]) : []
  const cutLesson = new Map(cuts.map((row) => [row.id, idOf(row.lesson)]))
  const tags = (await payload.find({ collection: 'tags', overrideAccess: true, depth: 0, limit: 2000 })).docs as unknown as Row[]
  const scalesOf = new Map<number, Map<ScaleKey, number>>()
  const add = (lessonId: number | null, scale: ScaleKey | undefined, weight: number) => {
    if (!lessonId || !scale) return
    const map = scalesOf.get(lessonId) || new Map()
    map.set(scale, Math.max(map.get(scale) || 0, weight))
    scalesOf.set(lessonId, map)
  }
  for (const tag of tags) {
    const item = tag.item as { relationTo?: string; value?: unknown }
    const value = idOf(item?.value)
    const scale = idToKey.get(idOf(tag.scale) || 0) || laneScale.get(idOf(tag.lane) || 0)
    const weight = Number(tag.weight ?? 1) || 1
    if (item?.relationTo === 'lessons') add(value, scale, weight)
    if (item?.relationTo === 'cuts') add(cutLesson.get(value || 0) || null, scale, weight)
  }
  const byUser = new Map<number, WatchedItem[]>()
  for (const row of completions) {
    const userId = idOf(row.user)
    const lessonId = idOf(row.lesson)
    if (!userId || !lessonId) continue
    const at = new Date(String(row.watchedAt || row.createdAt)).getTime()
    const list = byUser.get(userId) || []
    list.push({ at, title: titleOf.get(lessonId) || 'A talk', scales: [...(scalesOf.get(lessonId)?.keys() || [])] })
    byUser.set(userId, list)
  }
  return { byUser, scalesOf, titleOf, laneKeyByScale, focus: index.focus, leon: index.leon }
}

function areasOf(point: StoredAttempt | undefined, focus: Map<ScaleKey, string>): AreaReading[] {
  if (!point) return []
  return SCALE_KEYS.flatMap((scale) => {
    const value = point.scales[scale]
    if (value == null) return []
    const rung = toRung(value)
    if (rung == null) return []
    return [{ scale, focus: focus.get(scale) || FOCUS_NAMES[scale], rung }]
  })
}

function kindOf(seconds: number | null, relation: string): FeedKind {
  if (relation === 'courses') return 'course'
  if (seconds != null && seconds > 0 && seconds <= 45) return 'hors'
  if (seconds != null && seconds > 0 && seconds <= 400) return 'appetiser'
  return 'talk'
}

async function talksFor(payload: Payload, slug: string, portalId: number | null): Promise<FeedCandidate[]> {
  const index = await scaleIndex(payload)
  const laneKeyByScale = new Map<ScaleKey, string>()
  const lanes = (await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 })).docs as unknown as Row[]
  const laneScale = new Map<number, ScaleKey>()
  for (const lane of lanes) {
    const key = index.idToKey.get(idOf(lane.scale) || 0)
    if (key) laneScale.set(lane.id, key)
    if (key && !lane.optInOnly) laneKeyByScale.set(key, String(lane.key))
  }
  const [tags, cuts, clauses] = await Promise.all([
    payload.find({ collection: 'tags', overrideAccess: true, depth: 0, limit: 2000, where: { state: { equals: 'confirmed' } } }),
    payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 1000 }),
    payload.find({ collection: 'clauses', overrideAccess: true, depth: 0, limit: 80 }),
  ])
  const cutLesson = new Map((cuts.docs as unknown as Row[]).map((row) => [row.id, idOf(row.lesson)]))
  const clauseNumber = new Map((clauses.docs as unknown as Row[]).map((row) => [row.id, Number(row.number)]))
  const lessonIds = new Set<number>()
  const courseIds = new Set<number>()
  for (const tag of tags.docs as unknown as Row[]) {
    const item = tag.item as { relationTo?: string; value?: unknown }
    const value = idOf(item?.value)
    if (!value) continue
    if (item?.relationTo === 'lessons') lessonIds.add(value)
    if (item?.relationTo === 'cuts') {
      const lessonId = cutLesson.get(value)
      if (lessonId) lessonIds.add(lessonId)
    }
    if (item?.relationTo === 'courses') courseIds.add(value)
  }
  const lessons = lessonIds.size ? ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: lessonIds.size, where: { id: { in: [...lessonIds] } } })).docs as unknown as Row[]) : []
  const lessonCourseIds = lessons.map((row) => idOf(row.course)).filter((id): id is number => Boolean(id))
  const courses = [...new Set([...courseIds, ...lessonCourseIds])]
  const courseRows = courses.length ? ((await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: courses.length, where: { id: { in: courses } } })).docs as unknown as Row[]) : []
  const coursePortal = new Map(courseRows.map((row) => [row.id, idOf(row.portal)]))
  const here = (local: number | null) => !local || local === portalId
  const visibleLessons = new Map(lessons.filter((row) => here(idOf(row.portal) || coursePortal.get(idOf(row.course) || 0) || null)).map((row) => [row.id, row]))
  const visibleCourses = new Map(courseRows.filter((row) => courseIds.has(row.id) && here(idOf(row.portal))).map((row) => [row.id, row]))
  const grouped = new Map<string, { id: string; title: string; href: string; kind: FeedKind; door: number | null; scales: Map<ScaleKey, number> }>()
  const ensure = (id: string, title: string, href: string, kind: FeedKind) => {
    const found = grouped.get(id)
    if (found) return found
    const row = { id, title, href, kind, door: null as number | null, scales: new Map<ScaleKey, number>() }
    grouped.set(id, row)
    return row
  }
  for (const tag of tags.docs as unknown as Row[]) {
    const item = tag.item as { relationTo?: string; value?: unknown }
    const value = idOf(item?.value)
    const scale = index.idToKey.get(idOf(tag.scale) || 0) || laneScale.get(idOf(tag.lane) || 0)
    const weight = Number(tag.weight ?? 1) || 1
    const door = doorNumberOfClause(clauseNumber.get(idOf(tag.clause) || 0))
    if (item?.relationTo === 'courses' && value && visibleCourses.has(value)) {
      const course = visibleCourses.get(value)!
      const row = ensure(`course:${value}`, String(course.title || 'A course'), `/p/${slug}/course/${value}`, 'course')
      if (scale) row.scales.set(scale, Math.max(row.scales.get(scale) || 0, weight))
      if (door && !row.door) row.door = door
    }
    const lessonId = item?.relationTo === 'lessons' ? value : item?.relationTo === 'cuts' ? cutLesson.get(value || 0) || null : null
    if (!lessonId || !visibleLessons.has(lessonId) || !scale) continue
    const lesson = visibleLessons.get(lessonId)!
    const strongestLane = laneKeyByScale.get(scale)
    const href = strongestLane ? `/p/${slug}/feed?lane=${strongestLane}` : `/p/${slug}/lanes`
    const row = ensure(`lesson:${lessonId}`, String(lesson.title || 'A talk'), href, kindOf(typeof lesson.durationSeconds === 'number' ? lesson.durationSeconds : null, 'lessons'))
    row.scales.set(scale, Math.max(row.scales.get(scale) || 0, weight))
    if (door && !row.door) row.door = door
  }
  const talks: FeedCandidate[] = []
  for (const row of grouped.values()) {
    const scales = [...row.scales.entries()].map(([scale, weight]) => ({ scale, weight }))
    const strongest = scales.slice().sort((a, b) => b.weight - a.weight)[0]?.scale
    const door = row.door || (strongest ? SCALE_DOOR[strongest] : null)
    const talk = { id: row.id, title: row.title, href: row.href, kind: row.kind, door, scales }
    if (rawScoreLeak({ title: talk.title, href: talk.href })) continue
    talks.push(talk)
  }
  return talks
}

async function portalIdForSlug(payload: Payload, slug: string) {
  const found = await payload.find({ collection: 'portals', overrideAccess: true, depth: 0, limit: 1, where: { slug: { equals: slug } } })
  return (found.docs[0] as unknown as Row | undefined)?.id || null
}

export async function loadMix(payload: Payload, portalId: number): Promise<Mix> {
  const found = await payload.find({ collection: 'compass-mixes', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } } as never)
  const doc = found.docs[0] as unknown as Row | undefined
  if (!doc) return DEFAULT_MIX
  return normaliseMix({ deficit: Number(doc.deficit), strength: Number(doc.strength), discovery: Number(doc.discovery) })
}

export async function saveMix(payload: Payload, actor: SessionUser, portalId: number, mix: Partial<Mix>) {
  if (!canGuide(actor, portalId)) return null
  const normal = normaliseMix(mix)
  const found = await payload.find({ collection: 'compass-mixes', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } } as never)
  const doc = found.docs[0] as unknown as Row | undefined
  const data = { portal: portalId, deficit: normal.deficit, strength: normal.strength, discovery: normal.discovery }
  if (doc) await payload.update({ collection: 'compass-mixes', id: doc.id, overrideAccess: true, data } as never)
  else await payload.create({ collection: 'compass-mixes', overrideAccess: true, data } as never)
  return normal
}

async function recentDoors(payload: Payload, userId: number) {
  const found = await payload.find({ collection: 'compass-serves', overrideAccess: true, depth: 0, limit: 12, sort: '-at', where: { user: { equals: userId } } } as never)
  return (found.docs as unknown as Row[]).map((row) => Number(row.door)).filter((door) => Number.isInteger(door) && door > 0)
}

async function rememberServes(payload: Payload, userId: number, portalId: number, ranked: { id: string; title: string; kind: FeedKind; why: string; bucket: string; door: number | null }[], mix: Mix) {
  const start = new Date(now())
  start.setUTCHours(0, 0, 0, 0)
  const existing = await payload.find({
    collection: 'compass-serves',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { and: [{ user: { equals: userId } }, { at: { greater_than_equal: start.toISOString() } }] },
  } as never)
  const have = new Set((existing.docs as unknown as Row[]).map((row) => String(row.title)))
  for (const talk of ranked) {
    if (have.has(talk.title)) continue
    const lessonId = talk.id.startsWith('lesson:') ? Number(talk.id.slice(7)) : undefined
    await payload.create({
      collection: 'compass-serves',
      overrideAccess: true,
      data: {
        user: userId,
        portal: portalId,
        lesson: lessonId || undefined,
        title: talk.title,
        kind: talk.kind,
        why: talk.why,
        mix,
        at: now().toISOString(),
        door: talk.door || undefined,
        bucket: talk.bucket,
      },
    } as never)
  }
}

async function shelfFor(payload: Payload, userId: number, slug: string) {
  const portalId = await portalIdForSlug(payload, slug)
  const [attempts, talks, mix, doors] = await Promise.all([
    attemptsOf(payload, userId),
    talksFor(payload, slug, portalId),
    portalId ? loadMix(payload, portalId) : Promise.resolve(DEFAULT_MIX),
    recentDoors(payload, userId),
  ])
  const latest = attempts.at(-1)
  const events = lifeByKeys(latest?.lifeKeys || [])
  const reading = withLives(latest?.scales || {}, [...new Set(events.flatMap((event) => event.scales))])
  const ranked = rankFeed(talks, reading, { take: 4, mix, life: events, recentDoors: doors })
  return { attempts, ranked, mix, portalId }
}

export async function learnerPath(payload: Payload, userId: number, slug: string): Promise<LearnerCompass> {
  const [copy, index, shelf] = await Promise.all([loadCopy(payload), scaleIndex(payload), shelfFor(payload, userId, slug)])
  const { attempts, ranked, mix, portalId } = shelf
  const latest = attempts.at(-1)
  const previous = attempts.length > 1 ? attempts[attempts.length - 2] : null
  const ordered = ranked.map((talk) => ({ title: talk.title, href: talk.href, scales: [] as SteerTag[] }))
  const summary = summarise({ copy, now: areasOf(latest, index.focus), before: areasOf(previous || undefined, index.focus), talks: ordered })
  summary.talks = ranked.filter((talk) => !rawScoreLeak({ title: talk.title, href: talk.href })).map((talk) => ({ title: talk.title, href: talk.href }))
  if (portalId && ranked.length) await rememberServes(payload, userId, portalId, ranked, mix)
  if (rawScoreLeak(summary)) {
    return { ...summary, talks: summary.talks.filter((talk) => !rawScoreLeak(talk)), movement: summary.movement.filter((line) => !rawScoreLeak(line)) }
  }
  return summary
}

export async function recalibrationDueFor(payload: Payload, userId: number) {
  const attempts = await attemptsOf(payload, userId)
  const latest = attempts.at(-1)
  return recalibrationDue(latest ? latest.at : null, now().getTime())
}

export async function monthMoments(payload: Payload, userId: number) {
  const [copy, attempts] = await Promise.all([loadCopy(payload), attemptsOf(payload, userId)])
  const round = attempts.filter((attempt) => attempt.bank === 'month').length
  const form = formForRound(round)
  return {
    copy,
    formId: form.id,
    scenes: form.items.map((item) => ({
      key: item.key,
      caption: item.caption,
      subline: item.subline,
      options: item.options.map((option) => ({ key: option.key, label: option.label })),
    })),
  }
}

export async function saveMonth(payload: Payload, userId: number, portalId: number, formId: string, picks: { key: string; option: string }[], lifeKeys: string[], lifeNote: string) {
  const form = formById(formId)
  if (!form) return 'That sitting could not be found.'
  const chosen: { scale: ScaleKey; delta: -1 | 0 | 1 }[] = []
  for (const item of form.items) {
    const pick = picks.find((row) => row.key === item.key)
    const option = item.options.find((row) => row.key === pick?.option)
    if (!option) return 'Choose one answer for each moment.'
    chosen.push({ scale: item.scale, delta: option.delta })
  }
  const known = lifeKeys.filter((key) => LIFE_EVENTS.some((event) => event.key === key))
  const attempts = await attemptsOf(payload, userId)
  const scales = applyMonth(attempts.at(-1)?.scales, chosen)
  await recordAttempt(payload, userId, portalId, scales, 'month', known[0], { lifeKeys: known, lifeNote: lifeNote.slice(0, LIFE_NOTE_MAX), formKey: form.id })
  return null
}

const MONTH_INVITE = {
  title: 'A fresh look, when you have a moment',
  body: 'Five short questions, in different words, and one line about life just now.',
}

export async function ensureMonthNote(payload: Payload, userId: number, portalId: number, slug: string) {
  if (!(await recalibrationDueFor(payload, userId))) return
  const key = `compass-month-${userId}-${now().toISOString().slice(0, 7)}`
  const existing = await payload.find({ collection: 'notifications', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: userId } }, { key: { equals: key } }] } })
  if (existing.docs.length) return
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { user: userId, portal: portalId, title: MONTH_INVITE.title, body: MONTH_INVITE.body, href: `/p/${slug}/recalibrate`, channel: 'in-app', key },
  })
}

async function loadBands(payload: Payload): Promise<PersonaBand[]> {
  const bandRows = await payload.find({ collection: 'persona-bands', overrideAccess: true, depth: 0, limit: 50, where: { status: { equals: 'published' } } })
  const bands = (bandRows.docs as unknown as Row[]).map((row) => bandFromRow(row as never))
  const current = bands.filter((band) => (band.version || 0) >= 2 && band.ranges.every((row) => row.present && row.min != null))
  return current.length >= 10 ? current : PERSONA_V2
}

function pointsOf(attempt: StoredAttempt, leon: Map<ScaleKey, string>) {
  return SCALE_KEYS.flatMap((scale) => {
    const value = attempt.scales[scale]
    if (value == null) return []
    const rung = toRung(value)
    if (rung == null) return []
    return [{ scale, name: leon.get(scale) || scale, rung }]
  })
}

export async function staffLearner(payload: Payload, actor: SessionUser, learner: SessionUser, portalId: number) {
  if (!canGuide(actor, portalId) || portalIdOf(learner) !== portalId) return null
  await audit(payload, 'compass.view', { actor: actor.id, actorRole: actor.role, target: learner.id, portal: portalId })
  const [index, attempts, watched, bands] = await Promise.all([
    scaleIndex(payload),
    attemptsOf(payload, learner.id),
    watchedBy(payload, [learner.id]),
    loadBands(payload),
  ])
  const watches = watched.byUser.get(learner.id) || []
  const titleOf = new Map(bands.map((band) => [band.key, band.title]))
  const personaTimeline = attempts.flatMap((attempt) => {
    const key = nearestPersona(attempt.scales, bands)
    if (!key) return []
    return [{ at: new Date(attempt.at).toISOString(), title: titleOf.get(key) || key }]
  })
  const series = SCALE_KEYS.map((scale) => ({
    scale,
    name: index.leon.get(scale) || scale,
    points: attempts.flatMap((attempt) => {
      const point = pointsOf(attempt, index.leon).find((row) => row.scale === scale)
      return point ? [{ at: attempt.at, rung: point.rung }] : []
    }),
  })).filter((row) => row.points.length)
  const life = attempts.flatMap((attempt) => {
    const keys = attempt.lifeKeys.length ? attempt.lifeKeys : []
    if (!keys.length && !attempt.lifeNote) return []
    const label = keys.map((key) => LIFE_EVENTS.find((event) => event.key === key)?.label || key).join(' · ')
    return [{ at: new Date(attempt.at).toISOString(), label: label || 'A note', note: attempt.lifeNote }]
  })
  const serveRows = (await payload.find({ collection: 'compass-serves', overrideAccess: true, depth: 0, limit: 80, sort: 'at', where: { user: { equals: learner.id } } } as never)).docs as unknown as Row[]
  const completions = (await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 200, where: { user: { equals: learner.id } } })).docs as unknown as Row[]
  const serves = serveRows.map((row) => {
    const at = new Date(String(row.at)).getTime()
    const lessonId = idOf(row.lesson)
    const engaged = completions.some((item) => {
      const when = new Date(String(item.watchedAt || item.createdAt)).getTime()
      if (Number.isNaN(when) || when < at) return false
      if (lessonId && idOf(item.lesson) === lessonId) return true
      return false
    })
    return { at: new Date(at).toISOString(), title: String(row.title || 'A talk'), kind: String(row.kind || 'talk'), why: String(row.why || ''), engaged }
  })
  const portal = await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)
  const shelf = portal ? await shelfFor(payload, learner.id, String((portal as { slug?: string }).slug || '')) : null
  return {
    kind: 'learner' as const,
    name: learner.name || learner.email,
    attempts: attempts.map((attempt) => ({ at: new Date(attempt.at).toISOString(), bank: attempt.bank, points: pointsOf(attempt, index.leon) })),
    attribution: attribute(attempts, watches).map((row) => ({ ...row, name: index.leon.get(row.scale) || row.scale })),
    guide: personaTimeline.length ? [personaTimeline[personaTimeline.length - 1].title] : [],
    personaTimeline,
    series,
    life,
    serves,
    whyNow: (shelf?.ranked || []).map((talk) => ({ title: talk.title, kind: talk.kind, why: talk.why, bucket: talk.bucket })),
  }
}

export async function staffPortal(payload: Payload, actor: SessionUser, portalId: number) {
  if (!canGuide(actor, portalId)) return null
  await audit(payload, 'compass.portal', { actor: actor.id, actorRole: actor.role, portal: portalId })
  const people = (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 200, where: { and: [{ role: { equals: 'learner' } }, { 'tenants.tenant': { equals: portalId } }] } })).docs as unknown as Row[]
  const ids = people.map((person) => person.id)
  const [index, attemptRows, watched] = await Promise.all([
    scaleIndex(payload),
    ids.length ? payload.find({ collection: 'compass-attempts', overrideAccess: true, depth: 0, limit: 2000, where: { user: { in: ids } } }) : Promise.resolve({ docs: [] }),
    watchedBy(payload, ids),
  ])
  const byUser = new Map<number, StoredAttempt[]>()
  for (const row of attemptRows.docs as unknown as Row[]) {
    const userId = idOf(row.user)
    if (!userId) continue
    const list = byUser.get(userId) || []
    list.push({ at: new Date(String(row.at)).getTime(), scales: asScales(row.scales), lifeKey: '', lifeKeys: lifeKeysOf(row), lifeNote: '', bank: String(row.bank || ''), formKey: '' })
    byUser.set(userId, list)
  }
  const summary = portalSummary(ids.map((id) => ({ attempts: byUser.get(id) || [], watched: watched.byUser.get(id) || [] })))
  const bands = await loadBands(payload)
  const titleOf = new Map(bands.map((band) => [band.key, band.title]))
  const personaCounts = new Map<string, number>()
  for (const id of ids) {
    const ordered = (byUser.get(id) || []).slice().sort((a, b) => a.at - b.at)
    const latest = ordered.at(-1)
    if (!latest) continue
    const key = nearestPersona(latest.scales, bands)
    if (!key) continue
    personaCounts.set(key, (personaCounts.get(key) || 0) + 1)
  }
  const scales = summary.map((row) => ({ ...row, name: index.leon.get(row.scale) || row.scale }))
  const weakest = scales.filter((row) => row.meanNow != null).slice().sort((a, b) => (a.meanNow || 0) - (b.meanNow || 0)).slice(0, 3)
  return {
    kind: 'portal' as const,
    learners: people.map((person) => ({ id: person.id, name: String(person.name || person.email || 'A learner'), attempts: (byUser.get(person.id) || []).length })),
    scales,
    personas: [...personaCounts.entries()].map(([key, count]) => ({ key, title: titleOf.get(key) || key, count })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title)),
    weakest: weakest.map((row) => ({ scale: row.scale, name: row.name, mean: row.meanNow })),
    mix: await loadMix(payload, portalId),
  }
}
