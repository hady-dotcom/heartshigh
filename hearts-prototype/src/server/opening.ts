import type { Payload } from 'payload'
import { buildFeed, type CutInfo, type FeedPlan, type FeedSlot, type LaneDef, type ScaleDef, type SceneDef, type SceneOption } from '@/lib/heart'
import { DEFAULT_HELP_CONTACTS, DEFAULT_LANE } from '@/lib/opening-data'
import { idOf } from '@/lib/ids'
import { now } from '@/lib/clock'
import { adoptedCourseIds, visibleCourseIds, type PortalDoc, type SessionUser } from './context'
import { laneOf, portraitFor, posterFor, slugify, type FeedItem, type SlideStyle } from './learner'

type Row = Record<string, unknown> & { id: number }

async function all(payload: Payload, collection: string, where?: Record<string, unknown>, limit = 2000) {
  const found = await payload.find({ collection: collection as never, overrideAccess: true, depth: 0, limit, where: where as never, pagination: false })
  return found.docs as unknown as Row[]
}

export type HelpContact = { label: string; phone?: string | null; url?: string | null; hours?: string | null }

export type OpeningData = {
  portal: string
  scenesVersion: number
  scenes: SceneDef[]
  scales: ScaleDef[]
  helpContacts: HelpContact[]
  d0CutId: number | null
  route: { lanes: LaneDef[]; cuts: CutInfo[]; d0CutId: number | null; allowSuggested: boolean }
  /** Display data for the clips the opening might hand off to (D0 and every lane's first starter). */
  starters: Record<string, FeedItem>
  laneTitles: Record<string, string>
  trendsPrompt: boolean
}

export async function openingConfig(payload: Payload, portalId: number | null) {
  const own = portalId ? (await all(payload, 'opening-configs', { portal: { equals: portalId } }, 1))[0] : null
  const master = (await all(payload, 'opening-configs', { portal: { exists: false } }, 1))[0] || null
  return { own, master }
}

/** Courses an anonymous visitor can play in this portal: what it adopted, plus its own published courses. */
export async function catalogueCourseIds(payload: Payload, portal: PortalDoc) {
  const adopted = await adoptedCourseIds(payload, portal.id)
  const local = await all(payload, 'courses', { and: [{ portal: { equals: portal.id } }, { visibility: { not_equals: 'draft' } }] })
  return [...new Set([...adopted, ...local.map((row) => row.id)])]
}

export async function routeCourseIds(payload: Payload, portal: PortalDoc, user: SessionUser | null) {
  if (!user || user.role !== 'learner') return catalogueCourseIds(payload, portal)
  return visibleCourseIds(payload, user)
}

type Loaded = {
  lanes: Row[]
  scales: Row[]
  cuts: Row[]
  lessons: Row[]
  courses: Row[]
  tags: Row[]
  ladder: Row[]
  clauses: Row[]
}

async function loadAll(payload: Payload, courseIds: number[]): Promise<Loaded> {
  const [lanes, scales, clauses] = await Promise.all([all(payload, 'lanes'), all(payload, 'heart-scales'), all(payload, 'clauses')])
  if (!courseIds.length) return { lanes, scales, clauses, cuts: [], lessons: [], courses: [], tags: [], ladder: [] }
  const [courses, lessons] = await Promise.all([all(payload, 'courses', { id: { in: courseIds } }), all(payload, 'lessons', { course: { in: courseIds } })])
  const lessonIds = lessons.map((row) => row.id)
  const cuts = lessonIds.length
    ? await all(payload, 'cuts', { and: [{ lesson: { in: lessonIds } }, { or: [{ status: { equals: 'approved' } }, { placeholder: { equals: true } }] }] })
    : []
  const cutIds = cuts.map((row) => row.id)
  const [tags, ladder] = await Promise.all([
    cutIds.length ? all(payload, 'tags', { 'item.value': { in: cutIds } }) : Promise.resolve([] as Row[]),
    lessonIds.length ? all(payload, 'ladder-items', { and: [{ lesson: { in: lessonIds } }, { status: { equals: 'approved' } }] }) : Promise.resolve([] as Row[]),
  ])
  return { lanes, scales, clauses, cuts, lessons, courses, tags: tags.filter((tag) => (tag.item as { relationTo?: string } | undefined)?.relationTo === 'cuts'), ladder }
}

function laneDefs(data: Loaded): LaneDef[] {
  const clauseNumber = new Map(data.clauses.map((row) => [row.id, Number(row.number)]))
  const scaleKey = new Map(data.scales.map((row) => [row.id, String(row.key)]))
  return data.lanes
    .filter((lane) => !lane.pseudo)
    .map((lane) => ({
      key: String(lane.key),
      title: String(lane.title),
      scale: (scaleKey.get(idOf(lane.scale) || 0) as LaneDef['scale']) || null,
      fit: (lane.fit as LaneDef['fit']) || 'workable',
      clauses: ((lane.clauses as { clause?: unknown; rank?: number }[]) || []).map((row) => ({ clause: clauseNumber.get(idOf(row.clause) || 0) || 0, rank: Number(row.rank || 1) })),
      excludeClauses: ((lane.excludeClauses as unknown[]) || []).map((row) => clauseNumber.get(idOf(row) || 0) || 0).filter(Boolean),
      optInOnly: Boolean(lane.optInOnly),
      order: Number(lane.order || 1),
    }))
    .sort((a, b) => a.order - b.order)
}

function starterCut(data: Loaded, lessonId: number) {
  const own = data.cuts.filter((cut) => idOf(cut.lesson) === lessonId)
  return own.find((cut) => cut.placeholder) || own.filter((cut) => cut.status === 'approved').sort((a, b) => Number(a.start) - Number(b.start))[0] || null
}

function cutInfos(data: Loaded, portal: PortalDoc): CutInfo[] {
  const laneKey = new Map(data.lanes.map((row) => [row.id, String(row.key)]))
  const clauseNumber = new Map(data.clauses.map((row) => [row.id, Number(row.number)]))
  const starters = new Map<number, { lane: string; role: 'first' | 'next' | 'mains' }>()
  for (const lane of data.lanes) {
    for (const row of (lane.starters as { lesson?: unknown; role?: string }[]) || []) {
      const cut = starterCut(data, idOf(row.lesson) || 0)
      if (cut && !starters.has(cut.id)) starters.set(cut.id, { lane: String(lane.key), role: (row.role as 'first' | 'next' | 'mains') || 'next' })
    }
  }
  return data.cuts
    .filter((cut) => cut.playable !== false)
    .map((cut) => {
      const tags = data.tags.filter((tag) => idOf((tag.item as { value?: unknown }).value) === cut.id)
      const confirmedClause = tags.find((tag) => tag.state === 'confirmed' && idOf(tag.clause))
      const lesson = data.lessons.find((row) => row.id === idOf(cut.lesson))
      const course = data.courses.find((row) => row.id === idOf(lesson?.course))
      return {
        id: cut.id,
        clause: confirmedClause ? clauseNumber.get(idOf(confirmedClause.clause) || 0) || null : Number(cut.bestClause || 0) || null,
        lanes: tags
          .filter((tag) => idOf(tag.lane))
          .map((tag) => ({ lane: laneKey.get(idOf(tag.lane) || 0) || '', weight: Number(tag.weight ?? 1), confirmed: tag.state === 'confirmed' }))
          .filter((tag) => tag.lane && tag.lane !== DEFAULT_LANE),
        approved: cut.status === 'approved',
        hasHors: data.ladder.some((item) => item.kind === 'hors' && idOf(item.lesson) === idOf(cut.lesson) && Number(item.start) >= Number(cut.start) - 1 && Number(item.end) <= Number(cut.end) + 1),
        portalOwn: Boolean(course && course.origin === 'local' && idOf(course.portal) === portal.id),
        starter: starters.get(cut.id),
      }
    })
}

const STYLES: SlideStyle[] = ['kinetic', 'cinema', 'windows', 'conversation', 'unfold']

function itemFor(data: Loaded, cut: Row, laneKey: string | null, laneTitles: Record<string, string>, index: number): FeedItem | null {
  const lesson = data.lessons.find((row) => row.id === idOf(cut.lesson))
  if (!lesson) return null
  const course = data.courses.find((row) => row.id === idOf(lesson.course))
  if (!course) return null
  const start = Number(cut.start)
  const end = Number(cut.end)
  const within = data.ladder.filter((item) => idOf(item.lesson) === lesson.id && Number(item.start) >= start - 1 && Number(item.end) <= end + 1)
  const hors = within.find((item) => item.kind === 'hors')
  const appetiser = within.find((item) => item.kind === 'appetiser')
  const speaker = String(lesson.speaker || course.speaker || 'The speaker')
  const slug = slugify(speaker)
  const youtubeId = (lesson.youtubeId as string) || null
  const laneKeyMap = new Map(data.lanes.map((row) => [row.id, String(row.key)]))
  const tagged = data.tags
    .filter((tag) => idOf((tag.item as { value?: unknown }).value) === cut.id && idOf(tag.lane))
    .map((tag) => ({ lane: laneKeyMap.get(idOf(tag.lane) || 0) || '', weight: Number(tag.weight ?? 1), confirmed: tag.state === 'confirmed' }))
    .filter((tag) => tag.lane && tag.lane !== DEFAULT_LANE)
  const shownLane = laneKey || tagged.find((tag) => tag.confirmed)?.lane || null
  const fallback = laneOf(cut.theme as string)
  const slide = cut.presentation === 'slide' || !youtubeId
  const placeholder = Boolean(cut.placeholder)
  const quote = placeholder ? '' : String(hors?.quote || cut.land || '')
  return {
    id: `cut-${cut.id}`,
    cutId: cut.id,
    lane: shownLane || fallback.key,
    laneLabel: shownLane ? laneTitles[shownLane] || fallback.label : fallback.label,
    laneKey,
    laneTags: tagged.filter((tag) => tag.confirmed).map(({ lane, weight }) => ({ lane, weight })),
    speaker,
    speakerSlug: slug,
    portrait: portraitFor(slug),
    poster: posterFor(youtubeId),
    youtubeId,
    courseId: course.id,
    courseTitle: String(course.title || ''),
    lessonId: lesson.id,
    lessonTitle: String(lesson.sourceTitle || lesson.title || ''),
    hors: hors && !placeholder ? { start: Number(hors.start), end: Number(hors.end), quote } : { start: placeholder ? start : Math.max(start, end - 18), end, quote },
    appetiser: appetiser ? { start: Number(appetiser.start), end: Number(appetiser.end), quote: String(appetiser.quote || cut.land) } : { start: placeholder ? end : start, end: placeholder ? end + 600 : end, quote },
    hook: placeholder ? '' : String(cut.hook || ''),
    turn: placeholder ? '' : String(cut.turn || ''),
    land: placeholder ? '' : String(cut.land || ''),
    style: slide ? STYLES[index % STYLES.length] : null,
    clause: (cut.bestClause as number) || null,
    placeholder,
    transcriptReady: Boolean(lesson.transcript) && lesson.transcriptSource !== 'pending',
  }
}

function laneTitleMap(data: Loaded) {
  return Object.fromEntries(data.lanes.filter((lane) => !lane.pseudo).map((lane) => [String(lane.key), String(lane.title)]))
}

function effectiveScenes(scenes: Row[], laneKey: Map<number, string>, own: Row | null) {
  const hidden = new Set(((own?.hiddenScenes as unknown[]) || []).map((row) => idOf(row)))
  const wording = new Map(((own?.wording as { scene?: unknown; caption?: string; subline?: string; labels?: Record<string, string> }[]) || []).map((row) => [idOf(row.scene), row]))
  return scenes
    .filter((scene) => scene.status === 'published' && !hidden.has(scene.id))
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((scene) => {
      const words = wording.get(scene.id)
      const options = ((scene.options as Record<string, unknown>[]) || []).map(
        (option): SceneOption => ({
          key: String(option.key),
          label: words?.labels?.[String(option.key)] || String(option.label),
          replyPill: (option.replyPill as string) || undefined,
          nudges: ((option.nudges as { scale: string; delta: number }[]) || []).map((row) => ({ scale: row.scale as never, delta: Math.sign(Number(row.delta || 0)) as -1 | 0 | 1 })),
          intentLane: laneKey.get(idOf(option.intentLane) || 0),
          spineFirst: Boolean(option.spineFirst),
          crisis: Boolean(option.crisis),
          sensitivity: (option.sensitivity as 'normal' | 'private') || 'normal',
        }),
      )
      return {
        key: String(scene.key),
        order: Number(scene.order),
        layout: (scene.layout as SceneDef['layout']) || 'grid4',
        caption: words?.caption || String(scene.caption),
        subline: words?.subline || String(scene.subline || ''),
        options,
        version: Number(scene.version || 1),
      } as SceneDef & { version: number }
    })
}

export async function loadOpening(payload: Payload, portal: PortalDoc, user: SessionUser | null = null): Promise<OpeningData> {
  const courseIds = await routeCourseIds(payload, portal, user)
  const data = await loadAll(payload, courseIds)
  const laneKey = new Map(data.lanes.map((row) => [row.id, String(row.key)]))
  const { own, master } = await openingConfig(payload, portal.id)
  const sceneRows = await all(payload, 'opening-scenes')
  const scenes = effectiveScenes(sceneRows, laneKey, own)
  const contacts = ((own?.helpContacts as HelpContact[]) || []).length ? (own!.helpContacts as HelpContact[]) : ((master?.helpContacts as HelpContact[]) || []).length ? (master!.helpContacts as HelpContact[]) : DEFAULT_HELP_CONTACTS
  const d0CutId = idOf(own?.defaultClip) || idOf(master?.defaultClip) || null
  const lanes = laneDefs(data)
  const cuts = cutInfos(data, portal)
  const laneTitles = laneTitleMap(data)
  const starters: Record<string, FeedItem> = {}
  const wanted = new Set<number>([...(d0CutId ? [d0CutId] : []), ...cuts.filter((cut) => cut.starter?.role === 'first').map((cut) => cut.id)])
  for (const [index, id] of [...wanted].entries()) {
    const row = data.cuts.find((cut) => cut.id === id)
    const info = cuts.find((cut) => cut.id === id)
    const item = row ? itemFor(data, row, info?.starter?.lane || null, laneTitles, index) : null
    if (item) starters[String(id)] = item
  }
  return {
    portal: portal.slug,
    scenesVersion: Math.max(1, ...scenes.map((scene) => (scene as SceneDef & { version: number }).version)),
    scenes: scenes.map(({ version: _version, ...scene }) => scene as SceneDef),
    scales: data.scales.map((row) => ({ key: row.key as ScaleDef['key'], firstOpenRead: row.firstOpenRead !== false })),
    helpContacts: contacts.map(({ label, phone, url, hours }) => ({ label, phone: phone || null, url: url || null, hours: hours || null })),
    d0CutId,
    route: { lanes, cuts, d0CutId, allowSuggested: process.env.HEARTS_ALLOW_SUGGESTED_LANES === '1' },
    starters,
    laneTitles,
    trendsPrompt: own?.trendsContributionPrompt !== false && master?.trendsContributionPrompt !== false,
  }
}

/** Section 3.4 on the server, from lane scores only (P2). Returns display items for the slots. */
export async function serveFeed(payload: Payload, portal: PortalDoc, user: SessionUser | null, plan: FeedPlan) {
  const courseIds = await routeCourseIds(payload, portal, user)
  const data = await loadAll(payload, courseIds)
  const { own, master } = await openingConfig(payload, portal.id)
  const d0CutId = idOf(own?.defaultClip) || idOf(master?.defaultClip) || null
  const ctx = { lanes: laneDefs(data), scales: [], cuts: cutInfos(data, portal), d0CutId, now: now().getTime(), allowSuggested: process.env.HEARTS_ALLOW_SUGGESTED_LANES === '1' }
  const built = buildFeed(plan, ctx)
  let slots: FeedSlot[] = built.items
  // Once the learner has seen everything, start the spine again rather than leave the feed empty.
  if (!slots.length) slots = buildFeed({ ...plan, served: [], spinePointer: 0 }, ctx).items
  const laneTitles = laneTitleMap(data)
  const items = slots
    .map((slot, index) => {
      const row = data.cuts.find((cut) => cut.id === slot.cutId)
      return row ? itemFor(data, row, slot.laneKey, laneTitles, index) : null
    })
    .filter((item): item is FeedItem => Boolean(item))
  return { slots, items, spinePointer: built.spinePointer }
}

/** Lessons for each lane's Mains shelf (the lane's mains starter first). */
export async function mainsFor(payload: Payload, laneKeyValue: string) {
  const lane = (await all(payload, 'lanes', { key: { equals: laneKeyValue } }, 1))[0]
  if (!lane) return null
  const row = ((lane.starters as { lesson?: unknown; role?: string }[]) || []).find((item) => item.role === 'mains')
  const lessonId = idOf(row?.lesson)
  if (!lessonId) return null
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }).catch(() => null)
  return lesson ? { lessonId, courseId: idOf((lesson as { course?: unknown }).course), title: String((lesson as { sourceTitle?: string; title?: string }).sourceTitle || (lesson as { title?: string }).title) } : null
}
