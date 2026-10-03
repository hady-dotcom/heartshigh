import type { Payload } from 'payload'
import { now } from '@/lib/clock'
import { attribute, portalSummary, rawScoreLeak, recalibrationDue, steer, summarise, withLife, type AreaReading, type AttemptPoint, type LearnerCompass, type SteerTag, type WatchedItem } from '@/lib/compass'
import { DEFAULT_COPY, FOCUS_NAMES, LIFE_OPTIONS, LIFE_PROMPT, type CompassCopy, type LifeOption, type PlaceCopy } from '@/lib/compass-data'
import { freshState, replayTaps, SCALE_KEYS, type ScaleDef, type ScaleKey, type SceneDef } from '@/lib/heart'
import { idOf, portalIdOf } from '@/lib/ids'
import { bandFromRow, matchPersonas, toRung } from '@/lib/persona'
import type { SessionUser } from './context'
import { audit } from './viewas'

type Row = Record<string, unknown> & { id: number }

export type CompassBundle = CompassCopy & { lifeCaption: string; lifeSubline: string; lifeOptions: LifeOption[] }

type StoredAttempt = AttemptPoint & { lifeKey: string; bank: string }

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
  const doc = found.docs[0] as Row | undefined
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
  const scales = (await payload.find({ collection: 'heart-scales', overrideAccess: true, depth: 0, limit: 20 })).docs as Row[]
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
  return (found.docs as Row[]).map((row) => ({
    at: new Date(String(row.at || row.createdAt)).getTime(),
    scales: asScales(row.scales),
    lifeKey: typeof row.lifeKey === 'string' ? row.lifeKey : '',
    bank: String(row.bank || 'opening'),
  })).filter((row) => !Number.isNaN(row.at))
}

async function sceneDefs(payload: Payload): Promise<{ scenes: SceneDef[]; scales: ScaleDef[] }> {
  const [sceneRows, scaleRows, laneRows] = await Promise.all([
    payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 20, sort: 'order', where: { status: { equals: 'published' } } }),
    payload.find({ collection: 'heart-scales', overrideAccess: true, depth: 0, limit: 20 }),
    payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 }),
  ])
  const laneKey = new Map((laneRows.docs as Row[]).map((lane) => [lane.id, String(lane.key)]))
  const scenes: SceneDef[] = (sceneRows.docs as Row[]).map((row) => ({
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
  const scales: ScaleDef[] = (scaleRows.docs as Row[]).filter((row) => SCALE_KEYS.includes(String(row.key) as ScaleKey)).map((row) => ({
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

export async function recordAttempt(payload: Payload, userId: number, portalId: number, scales: Partial<Record<ScaleKey, number>>, bank: 'opening' | 'month', lifeKey?: string) {
  await payload.create({
    collection: 'compass-attempts',
    overrideAccess: true,
    data: { user: userId, portal: portalId, at: now().toISOString(), bank, lifeKey: lifeKey || undefined, scales } as never,
  })
}

export async function recordOpeningAttempt(payload: Payload, userId: number, portalId: number, taps: { sceneKey: string; optionKey: string }[]) {
  const scales = await readingFromTaps(payload, taps)
  await recordAttempt(payload, userId, portalId, scales, 'opening')
}

async function watchedBy(payload: Payload, userIds: number[]) {
  const index = await scaleIndex(payload)
  const { idToKey } = index
  const lanes = (await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 })).docs as Row[]
  const laneScale = new Map<number, ScaleKey>()
  const laneKeyByScale = new Map<ScaleKey, string>()
  for (const lane of lanes) {
    const key = idToKey.get(idOf(lane.scale) || 0)
    if (!key) continue
    laneScale.set(lane.id, key)
    if (!lane.optInOnly && !laneKeyByScale.has(key)) laneKeyByScale.set(key, String(lane.key))
  }
  const completions = userIds.length
    ? ((await payload.find({ collection: 'completions', overrideAccess: true, depth: 0, limit: 2000, where: { user: { in: userIds } } })).docs as Row[])
    : []
  const lessonIds = [...new Set(completions.map((row) => idOf(row.lesson)).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: lessonIds.length, where: { id: { in: lessonIds } } })).docs as Row[]) : []
  const titleOf = new Map(lessons.map((row) => [row.id, String(row.title || 'A talk')]))
  const cuts = lessonIds.length ? ((await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 1000, where: { lesson: { in: lessonIds } } })).docs as Row[]) : []
  const cutLesson = new Map(cuts.map((row) => [row.id, idOf(row.lesson)]))
  const tags = (await payload.find({ collection: 'tags', overrideAccess: true, depth: 0, limit: 2000 })).docs as Row[]
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

async function talksFor(payload: Payload, slug: string) {
  const index = await scaleIndex(payload)
  const laneKeyByScale = new Map<ScaleKey, string>()
  const lanes = (await payload.find({ collection: 'lanes', overrideAccess: true, depth: 0, limit: 30 })).docs as Row[]
  const laneScale = new Map<number, ScaleKey>()
  for (const lane of lanes) {
    const key = index.idToKey.get(idOf(lane.scale) || 0)
    if (key) laneScale.set(lane.id, key)
    if (key && !lane.optInOnly) laneKeyByScale.set(key, String(lane.key))
  }
  const tags = (await payload.find({ collection: 'tags', overrideAccess: true, depth: 0, limit: 2000, where: { state: { equals: 'confirmed' } } })).docs as Row[]
  const cuts = (await payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 1000 })).docs as Row[]
  const cutLesson = new Map(cuts.map((row) => [row.id, idOf(row.lesson)]))
  const lessonIds = [...new Set(tags.map((tag) => {
    const item = tag.item as { relationTo?: string; value?: unknown }
    const value = idOf(item?.value)
    return item?.relationTo === 'lessons' ? value : cutLesson.get(value || 0) || null
  }).filter((id): id is number => Boolean(id)))]
  const lessons = lessonIds.length ? ((await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: lessonIds.length, where: { id: { in: lessonIds } } })).docs as Row[]) : []
  const titles = new Map(lessons.map((row) => [row.id, String(row.title || 'A talk')]))
  const grouped = new Map<number, Map<ScaleKey, number>>()
  for (const tag of tags) {
    const item = tag.item as { relationTo?: string; value?: unknown }
    const value = idOf(item?.value)
    const lessonId = item?.relationTo === 'lessons' ? value : cutLesson.get(value || 0) || null
    const scale = index.idToKey.get(idOf(tag.scale) || 0) || laneScale.get(idOf(tag.lane) || 0)
    if (!lessonId || !scale) continue
    const map = grouped.get(lessonId) || new Map()
    map.set(scale, Math.max(map.get(scale) || 0, Number(tag.weight ?? 1) || 1))
    grouped.set(lessonId, map)
  }
  const talks: { title: string; href: string; scales: SteerTag[] }[] = []
  for (const [lessonId, scales] of grouped) {
    const title = titles.get(lessonId) || 'A talk'
    const strongest = [...scales.entries()].sort((a, b) => b[1] - a[1])[0]
    const lane = strongest ? laneKeyByScale.get(strongest[0]) : undefined
    const href = lane ? `/p/${slug}/feed?lane=${lane}` : `/p/${slug}/lanes`
    const talk = { title, href, scales: [...scales.entries()].map(([scale, weight]) => ({ scale, weight })) }
    if (rawScoreLeak({ title: talk.title, href: talk.href })) continue
    talks.push(talk)
  }
  return talks
}

export async function learnerPath(payload: Payload, userId: number, slug: string): Promise<LearnerCompass> {
  const [copy, index, attempts, talks] = await Promise.all([loadCopy(payload), scaleIndex(payload), attemptsOf(payload, userId), talksFor(payload, slug)])
  const latest = attempts.at(-1)
  const previous = attempts.length > 1 ? attempts[attempts.length - 2] : null
  const boost = copy.lifeOptions.find((option) => option.key === latest?.lifeKey)?.boost || null
  const reading = withLife(latest?.scales || {}, boost)
  const steered = steer(talks, reading, 3).map((talk) => ({ title: talk.title, href: talk.href, scales: [] as SteerTag[] }))
  const summary = summarise({ copy, now: areasOf(latest, index.focus), before: areasOf(previous || undefined, index.focus), talks: steered })
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

export async function monthMoments(payload: Payload) {
  const copy = await loadCopy(payload)
  const scenes = (await payload.find({ collection: 'opening-scenes', overrideAccess: true, depth: 0, limit: 20, sort: 'order', where: { status: { equals: 'published' } } })).docs as Row[]
  return {
    copy,
    scenes: scenes.map((scene) => {
      const labels = (scene.monthLabels && typeof scene.monthLabels === 'object' ? scene.monthLabels : {}) as Record<string, string>
      const options = ((scene.options as { key?: string; label?: string; crisis?: boolean }[]) || []).filter((option) => !option.crisis)
      return {
        key: String(scene.key),
        caption: String(scene.monthCaption || scene.caption || ''),
        subline: String(scene.monthSubline || ''),
        options: options.map((option) => ({ key: String(option.key), label: labels[String(option.key)] || String(option.label || '') })),
      }
    }),
  }
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
  const [index, attempts, watched, bandRows] = await Promise.all([
    scaleIndex(payload),
    attemptsOf(payload, learner.id),
    watchedBy(payload, [learner.id]),
    payload.find({ collection: 'persona-bands', overrideAccess: true, depth: 0, limit: 50, where: { status: { equals: 'published' } } }),
  ])
  const watches = watched.byUser.get(learner.id) || []
  const latest = attempts.at(-1)
  const bands = (bandRows.docs as Row[]).map((row) => bandFromRow(row))
  return {
    kind: 'learner' as const,
    name: learner.name || learner.email,
    attempts: attempts.map((attempt) => ({ at: new Date(attempt.at).toISOString(), bank: attempt.bank, points: pointsOf(attempt, index.leon) })),
    attribution: attribute(attempts, watches).map((row) => ({ ...row, name: index.leon.get(row.scale) || row.scale })),
    guide: latest ? matchPersonas(latest.scales, bands) : [],
  }
}

export async function staffPortal(payload: Payload, actor: SessionUser, portalId: number) {
  if (!canGuide(actor, portalId)) return null
  await audit(payload, 'compass.portal', { actor: actor.id, actorRole: actor.role, portal: portalId })
  const people = (await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 200, where: { and: [{ role: { equals: 'learner' } }, { 'tenants.tenant': { equals: portalId } }] } })).docs as Row[]
  const ids = people.map((person) => person.id)
  const [index, attemptRows, watched] = await Promise.all([
    scaleIndex(payload),
    ids.length ? payload.find({ collection: 'compass-attempts', overrideAccess: true, depth: 0, limit: 2000, where: { user: { in: ids } } }) : Promise.resolve({ docs: [] }),
    watchedBy(payload, ids),
  ])
  const byUser = new Map<number, StoredAttempt[]>()
  for (const row of attemptRows.docs as Row[]) {
    const userId = idOf(row.user)
    if (!userId) continue
    const list = byUser.get(userId) || []
    list.push({ at: new Date(String(row.at)).getTime(), scales: asScales(row.scales), lifeKey: '', bank: String(row.bank || '') })
    byUser.set(userId, list)
  }
  const summary = portalSummary(ids.map((id) => ({ attempts: byUser.get(id) || [], watched: watched.byUser.get(id) || [] })))
  return {
    kind: 'portal' as const,
    learners: people.map((person) => ({ id: person.id, name: String(person.name || person.email || 'A learner'), attempts: (byUser.get(person.id) || []).length })),
    scales: summary.map((row) => ({ ...row, name: index.leon.get(row.scale) || row.scale })),
  }
}
