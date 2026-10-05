import type { Payload, Where } from 'payload'
import { buildFeed, type CutInfo, type FeedPlan, type FeedSlot, type LaneDef, type ScaleDef, type SceneDef, type SceneOption } from '@/lib/heart'
import { DEFAULT_HELP_CONTACTS, DEFAULT_LANE } from '@/lib/opening-data'
import { idOf } from '@/lib/ids'
import { doorNumberOfClause, type Door } from '@/lib/doors'
import { loadDoors } from './doors'
import { now } from '@/lib/clock'
import { adoptedCourseIds, visibleCourseIds, type PortalDoc, type SessionUser } from './context'
import { normaliseSpans, type AppetiserSpan } from '@/lib/tiers'
import { ladderParentRef, talkChain, type PieceRef } from '@/lib/nesting'
import { backgroundSrc, readBackgroundsBaseUrl } from '@/lib/backgrounds'
import { cardForTalk, readCardCatalogue, sceneSrc, type StoredCard } from '@/lib/cards'
import { cleanThumbnail, hasWordsInPicture, isTitledThumbnail, isVerticalLesson } from '@/lib/shorts'
import { filmsForTalk, mixFeed, readFilmCatalogue, type BeatFilm } from '@/lib/films'
import { filesForTalk, isTypographyStyle, readTypographyManifest, type TypographyManifest } from '@/lib/typography'
import { clipWords, displayLine, feedTidy, parseLineTidy } from '@/lib/tidy-caption'
import { partTitle } from '@/lib/talk-title'
import { attachHorsToAppetisers, extractParents, extractVisible, parentAppetiserFor, presentClips, type TalkExtract } from '@/lib/extracts'
import { extractsForLessons } from './extracts'
import { laneOf, portraitFor, SLIDE_ART, slugify, type FeedItem, type SlideStyle } from './learner'

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
  route: { lanes: LaneDef[]; cuts: CutInfo[]; d0CutId: number | null; allowSuggested: boolean; showUnchecked: boolean }
  /** Display data for the clips the opening might hand off to (D0 and every lane's first starter). */
  starters: Record<string, FeedItem>
  /** Display data for every routable clip, so the device can build its own feed and keep its taps to itself. */
  clips: Record<string, FeedItem>
  /** Old cut ids that now stand for the talk's one carrier clip. */
  alias: Record<string, number>
  laneTitles: Record<string, string>
  trendsPrompt: boolean
  /** Bucket origin for the photographic stills. Empty in local dev, which keeps the six bundled stills. */
  backgroundsBaseUrl: string | null
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
  doors: Door[]
  tiers: Row[]
  extracts: TalkExtract[]
  showUnchecked: boolean
  /** Old cut ids that now stand for their talk's one tier clip. */
  alias: Map<number, number>
  typography: TypographyManifest
  films: { films: (BeatFilm & { youtubeId: string })[] }
  cards: { cards: StoredCard[] }
}

/** Learner questions: rejected stays hidden. Drafts are included only while show-unchecked is on. */
export function pointVisibleWhere(showUnchecked: boolean): Where {
  if (showUnchecked) return { or: [{ status: { not_equals: 'rejected' } }, { status: { exists: false } }] }
  return {
    and: [
      { or: [{ status: { not_equals: 'draft' } }, { status: { exists: false } }] },
      { or: [{ status: { not_equals: 'rejected' } }, { status: { exists: false } }] },
    ],
  }
}

/** Whether learners may see a talk's tier: checked always, a draft only while the master flag says so, rejected never. */
export function tierVisible(tier: Row | undefined, showUnchecked: boolean) {
  if (!tier) return true
  if (tier.status === 'checked') return true
  if (tier.status === 'rejected') return false
  return showUnchecked
}

function spansOf(value: unknown): AppetiserSpan[] {
  if (!Array.isArray(value)) return []
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
  return normaliseSpans(spans)
}

export async function showUncheckedTalks(payload: Payload) {
  const flags = (await payload.findGlobal({ slug: 'master-flags', overrideAccess: true }).catch(() => null)) as { showUnchecked?: boolean } | null
  return Boolean(flags?.showUnchecked)
}

/** The cut that carries a talk with a tier record: its starter placeholder, or its earliest approved cut. */
function carrierCut(cuts: Row[], lessonId: number) {
  const own = cuts.filter((cut) => idOf(cut.lesson) === lessonId)
  return own.find((cut) => cut.placeholder) || own.filter((cut) => cut.status === 'approved').sort((a, b) => Number(a.start) - Number(b.start) || a.id - b.id)[0] || null
}

async function loadAll(payload: Payload, courseIds: number[]): Promise<Loaded> {
  const [lanes, scales, clauses, doors] = await Promise.all([all(payload, 'lanes'), all(payload, 'heart-scales'), all(payload, 'clauses'), loadDoors(payload)])
  const typography = readTypographyManifest()
  const films = readFilmCatalogue()
  const cards = readCardCatalogue()
  if (!courseIds.length) return { lanes, scales, clauses, doors, cuts: [], lessons: [], courses: [], tags: [], ladder: [], tiers: [], extracts: [], showUnchecked: false, alias: new Map(), typography, films, cards }
  const [courses, lessons, showUnchecked] = await Promise.all([all(payload, 'courses', { id: { in: courseIds } }), all(payload, 'lessons', { course: { in: courseIds } }), showUncheckedTalks(payload)])
  const lessonIds = lessons.map((row) => row.id)
  const [rawCuts, tiers] = await Promise.all([
    lessonIds.length
      ? all(payload, 'cuts', { and: [{ lesson: { in: lessonIds } }, { or: [{ status: { equals: 'approved' } }, { placeholder: { equals: true } }] }] })
      : Promise.resolve([] as Row[]),
    lessonIds.length ? all(payload, 'talk-tiers', { lesson: { in: lessonIds } }) : Promise.resolve([] as Row[]),
  ])
  // A talk with a tier record is one clip, timed by that record alone. Its other cuts lend it their lane tags and
  // are not served, and a tier learners may not see takes the talk out of the feed.
  const tierLessons = new Map(tiers.map((tier) => [idOf(tier.lesson) || 0, tier]))
  const alias = new Map<number, number>()
  const cuts: Row[] = []
  for (const cut of rawCuts) {
    const lessonId = idOf(cut.lesson) || 0
    const tier = tierLessons.get(lessonId)
    if (!tier) {
      if (cut.status === 'approved') cuts.push(cut)
      continue
    }
    if (!tierVisible(tier, showUnchecked)) continue
    const carrier = carrierCut(rawCuts, lessonId)
    if (!carrier) continue
    if (carrier.id === cut.id) cuts.push(cut)
    else alias.set(cut.id, carrier.id)
  }
  const cutIds = [...cuts.map((row) => row.id), ...alias.keys()]
  const [tags, ladder, extracts] = await Promise.all([
    cutIds.length ? all(payload, 'tags', { 'item.value': { in: cutIds } }) : Promise.resolve([] as Row[]),
    lessonIds.length ? all(payload, 'ladder-items', { and: [{ lesson: { in: lessonIds } }, { status: { equals: 'approved' } }] }) : Promise.resolve([] as Row[]),
    lessonIds.length ? extractsForLessons(payload, lessonIds) : Promise.resolve([] as TalkExtract[]),
  ])
  const cutTags = tags
    .filter((tag) => (tag.item as { relationTo?: string } | undefined)?.relationTo === 'cuts')
    .map((tag) => {
      const value = idOf((tag.item as { value?: unknown }).value) || 0
      return alias.has(value) ? { ...tag, item: { relationTo: 'cuts', value: alias.get(value) } } : tag
    })
  return { lanes, scales, clauses, doors, cuts, lessons, courses, tags: cutTags, ladder, tiers: tiers.filter((tier) => tierVisible(tier, showUnchecked)), extracts, showUnchecked, alias, typography, films, cards }
}

function laneDefs(data: Loaded): LaneDef[] {
  const clauseNumber = new Map(data.clauses.map((row) => [row.id, Number(row.number)]))
  const scaleKey = new Map(data.scales.map((row) => [row.id, String(row.key)]))
  return data.lanes
    .filter((lane) => !lane.pseudo)
    .map((lane) => {
      const clauses = ((lane.clauses as { clause?: unknown; rank?: number }[]) || []).map((row) => ({ clause: clauseNumber.get(idOf(row.clause) || 0) || 0, rank: Number(row.rank || 1) }))
      const excludeClauses = ((lane.excludeClauses as unknown[]) || []).map((row) => clauseNumber.get(idOf(row) || 0) || 0).filter(Boolean)
      return {
        key: String(lane.key),
        title: String(lane.title),
        scale: (scaleKey.get(idOf(lane.scale) || 0) as LaneDef['scale']) || null,
        fit: (lane.fit as LaneDef['fit']) || 'workable',
        clauses,
        excludeClauses,
        doors: clauses.map((row) => ({ door: doorNumberOfClause(row.clause, data.doors) || 0, rank: row.rank })).filter((row) => row.door),
        excludeDoors: [...new Set(excludeClauses.map((clause) => doorNumberOfClause(clause, data.doors) || 0).filter(Boolean))],
        optInOnly: Boolean(lane.optInOnly),
        order: Number(lane.order || 1),
      }
    })
    .sort((a, b) => a.order - b.order)
}

function starterCut(data: Loaded, lessonId: number) {
  return carrierCut(data.cuts, lessonId)
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
      const lanes = laneTagsOf(data, cut.id)
      const confirmedClause = tags.find((tag) => tag.state === 'confirmed' && idOf(tag.clause))
      const lesson = data.lessons.find((row) => row.id === idOf(cut.lesson))
      const course = data.courses.find((row) => row.id === idOf(lesson?.course))
      const clause = confirmedClause ? clauseNumber.get(idOf(confirmedClause.clause) || 0) || null : Number(cut.bestClause || 0) || null
      return {
        id: cut.id,
        clause,
        door: doorNumberOfClause(clause, data.doors),
        lanes,
        approved: cut.status === 'approved',
        placeholder: Boolean(cut.placeholder),
        withheld: cut.status === 'rejected',
        hasHors: data.tiers.some((tier) => idOf(tier.lesson) === idOf(cut.lesson)) || data.extracts.some((row) => row.kind === 'hors' && Number(row.lesson) === Number(idOf(cut.lesson)) && extractVisible(row, data.showUnchecked)) || data.ladder.some((item) => item.kind === 'hors' && idOf(item.lesson) === idOf(cut.lesson) && Number(item.start) >= Number(cut.start) - 1 && Number(item.end) <= Number(cut.end) + 1),
        portalOwn: Boolean(course && course.origin === 'local' && idOf(course.portal) === portal.id),
        starter: starters.get(cut.id),
      }
    })
}

const STYLES: SlideStyle[] = ['kinetic', 'cinema', 'windows', 'conversation', 'unfold']

/**
 * The still behind a clip until it plays: the talk's scenic background, else its scene, else a slide. YouTube's
 * thumbnails carry the channel's title text (and a Short's carry its burned-in words), so they are never used here.
 */
function cleanPoster(src: string | null, index: number) {
  return src && !isTitledThumbnail(src) ? src : SLIDE_ART[STYLES[index % STYLES.length]]
}

function ownPoster(card: StoredCard | null, index: number) {
  const stored = card?.background ? backgroundSrc(card.background, readBackgroundsBaseUrl()) : null
  return stored || (card?.scene ? sceneSrc(card.scene) : null) || SLIDE_ART[card?.style && isTypographyStyle(card.style) ? card.style : STYLES[index % STYLES.length]]
}

function typographyFor(data: Loaded, lesson: Row, tier: Row | undefined) {
  const chosen = String(tier?.typographyStyle || '')
  if (!tier?.typographyInPlace || !isTypographyStyle(chosen)) return null
  const files = filesForTalk(data.typography, (lesson.youtubeId as string) || null, String(lesson.sourceTitle || lesson.title || ''))
  const src = files?.styles?.[chosen]
  return src ? { style: chosen, inPlace: true as const, src } : null
}

/** A cut's lane tags, one per lane (the strongest), with tags from the talk's other cuts folded in. */
function laneTagsOf(data: Loaded, cutId: number) {
  const laneKeyMap = new Map(data.lanes.map((row) => [row.id, String(row.key)]))
  const byLane = new Map<string, { lane: string; weight: number; confirmed: boolean }>()
  for (const tag of data.tags) {
    if (idOf((tag.item as { value?: unknown }).value) !== cutId || !idOf(tag.lane)) continue
    const lane = laneKeyMap.get(idOf(tag.lane) || 0) || ''
    if (!lane || lane === DEFAULT_LANE) continue
    const row = { lane, weight: Number(tag.weight ?? 1), confirmed: tag.state === 'confirmed' }
    const held = byLane.get(lane)
    if (!held || (row.confirmed && !held.confirmed) || (row.confirmed === held.confirmed && row.weight > held.weight)) byLane.set(lane, row)
  }
  return [...byLane.values()]
}

function parentsFor(lessonId: number, ladder: Row[]): { hors: PieceRef; appetiser: PieceRef } {
  const chain = talkChain(lessonId)
  const appetisers = ladder
    .filter((row) => row.kind === 'appetiser')
    .map((row) => ({ id: row.id, kind: 'appetiser', start: Number(row.start || 0), end: Number(row.end || 0) }))
  const hors = ladder.find((row) => row.kind === 'hors')
  const appetiser = appetisers[0]
  return {
    hors: {
      ...chain.hors,
      id: hors ? `hors:${hors.id}` : chain.hors.id,
      parentId: hors ? ladderParentRef({ kind: 'hors', start: Number(hors.start || 0), end: Number(hors.end || 0) }, appetisers, lessonId) : chain.hors.parentId,
      parentLevel: 'appetiser',
    },
    appetiser: {
      ...chain.appetiser,
      id: appetiser?.id ? `appetiser:${appetiser.id}` : chain.appetiser.id,
      parentId: `talk:${lessonId}`,
      parentLevel: 'talk',
    },
  }
}

const lineList = (value: unknown) =>
  Array.isArray(value) ? (value as { at?: unknown; text?: unknown }[]).filter((row) => Number.isFinite(Number(row?.at)) && typeof row?.text === 'string').map((row) => ({ at: Number(row.at), text: String(row.text) })) : []

/** Tidied lines for the screen. The raw hook, turn, land and caption text are left as said. */
function tidyOf(speaker: string, stored: unknown, raw: { hook: string; turn: string; land: string; horsLines: { at: number; text: string }[] }) {
  const tidy = parseLineTidy(stored)
  const hints = { speakers: speaker ? [speaker] : [] }
  const line = (text: string, saved?: { raw?: string; text?: string } | null) => displayLine(text, saved, hints)
  const hookTidy = line(raw.hook, tidy?.hook)
  const turnTidy = line(raw.turn, tidy?.turn)
  const landTidy = line(raw.land, tidy?.land)
  const storedLines = tidy?.horsLines || []
  const indexed = storedLines.length === raw.horsLines.length
  return {
    hookTidy,
    turnTidy,
    landTidy,
    quoteTidy: tidy?.quote?.text?.trim() || '',
    scenic: { hook: clipWords(hookTidy), turn: clipWords(turnTidy), land: clipWords(landTidy) },
    horsLines: raw.horsLines.map((row, index) => ({
      at: row.at,
      text: row.text,
      tidy: feedTidy(
        row.text,
        storedLines.find((item) => item.raw === row.text && (item.at === undefined || Number(item.at) === row.at)),
        indexed ? storedLines[index] : null,
        hints,
      ),
    })),
  }
}

/**
 * The display item for a cut. A talk with a tier record is timed and worded by that record alone: the hors
 * d'oeuvre, the appetiser and where it stops, the hook, turn and land, and the resume point. A talk without one
 * (a portal's own course cut by the extractor) keeps its cut and ladder.
 */
function itemFor(data: Loaded, cut: Row, laneKey: string | null, laneTitles: Record<string, string>, index: number): FeedItem | null {
  const lesson = data.lessons.find((row) => row.id === idOf(cut.lesson))
  if (!lesson) return null
  const course = data.courses.find((row) => row.id === idOf(lesson.course))
  if (!course) return null
  const speaker = String(lesson.speaker || course.speaker || 'The speaker')
  const slug = slugify(speaker)
  const youtubeId = (lesson.youtubeId as string) || null
  const tagged = laneTagsOf(data, cut.id)
  const shownLane = laneKey || tagged.find((tag) => tag.confirmed)?.lane || null
  const fallback = laneOf(cut.theme as string)
  const slide = cut.presentation === 'slide' || !youtubeId
  const base = {
    id: `cut-${cut.id}`,
    cutId: cut.id,
    lane: shownLane || fallback.key,
    laneLabel: shownLane ? laneTitles[shownLane] || fallback.label : fallback.label,
    laneKey,
    laneTags: tagged.filter((tag) => tag.confirmed).map(({ lane, weight }) => ({ lane, weight })),
    speaker,
    speakerSlug: slug,
    portrait: portraitFor(slug),
    poster: cleanPoster(ownPoster(cardForTalk(data.cards, youtubeId), index), index),
    youtubeId,
    vertical: isVerticalLesson(lesson),
    wordsInPicture: hasWordsInPicture(lesson),
    cleanThumb: cleanThumbnail(lesson),
    courseId: course.id,
    courseTitle: String(course.title || ''),
    lessonId: lesson.id,
    lessonTitle: partTitle(lesson, String(course.title || '')),
    style: slide ? STYLES[index % STYLES.length] : null,
    typography: typographyFor(data, lesson, data.tiers.find((row) => idOf(row.lesson) === lesson.id)),
    films: filmsForTalk(data.films, youtubeId),
    beats: cardForTalk(data.cards, youtubeId)?.beats,
    cardStyle: cardForTalk(data.cards, youtubeId)?.style || null,
    cardScene: cardForTalk(data.cards, youtubeId)?.scene || null,
    cardBackground: cardForTalk(data.cards, youtubeId)?.background || null,
    clause: (cut.bestClause as number) || null,
    door: doorNumberOfClause((cut.bestClause as number) || null, data.doors),
    transcriptReady: Boolean(lesson.transcript) && lesson.transcriptSource !== 'pending',
  }
  const tier = data.tiers.find((row) => idOf(row.lesson) === lesson.id)
  if (tier) {
    const land = String(tier.land || '')
    const spans = spansOf(tier.appetiserSpans)
    const appetiser = {
      start: spans[0]?.start ?? Number(tier.appetiserStart),
      end: spans.length ? spans[spans.length - 1].end : Number(tier.appetiserEnd),
      quote: land,
      ...(spans.length ? { spans } : {}),
    }
    const atSpan = (role: 'hook' | 'turn' | 'land', fallback: number) => spans.find((span) => span.role === role)?.start ?? fallback
    const hookAt = atSpan('hook', Number.isFinite(Number(tier.hookAt)) && tier.hookAt !== null ? Number(tier.hookAt) : appetiser.start)
    const landAt = atSpan('land', Number.isFinite(Number(tier.landAt)) && tier.landAt !== null ? Number(tier.landAt) : appetiser.start + (appetiser.end - appetiser.start) * 0.75)
    const turnAt = atSpan('turn', Number.isFinite(Number(tier.turnAt)) && tier.turnAt !== null ? Number(tier.turnAt) : (hookAt + landAt) / 2)
    const horsQuote = String(tier.horsQuote || land)
    const horsLines = lineList(tier.horsLines)
    const tidy = tidyOf(speaker, tier.lineTidy, { hook: String(tier.hook || ''), turn: String(tier.turn || ''), land, horsLines: horsLines.length ? horsLines : [{ at: Number(tier.horsStart), text: horsQuote }] })
    return {
      ...base,
      hookTidy: tidy.hookTidy,
      turnTidy: tidy.turnTidy,
      landTidy: tidy.landTidy,
      scenic: tidy.scenic,
      hors: { start: Number(tier.horsStart), end: Number(tier.horsEnd), quote: tidy.quoteTidy || horsQuote, lines: tidy.horsLines },
      appetiser: {
        ...appetiser,
        lines: [
          { at: hookAt, text: String(tier.hook || ''), role: 'hook' as const },
          { at: turnAt, text: String(tier.turn || ''), role: 'turn' as const },
          { at: landAt, text: land, role: 'land' as const },
        ].filter((line) => line.text),
      },
      hook: String(tier.hook || ''),
      turn: String(tier.turn || ''),
      land,
      placeholder: false,
      tierStatus: tier.status === 'checked' ? 'checked' : 'draft',
      offerResume: tier.offerResume !== false,
      ...extractFields(data, lesson.id, parentsFor(lesson.id, data.ladder.filter((item) => idOf(item.lesson) === lesson.id))),
    }
  }
  const start = Number(cut.start)
  const end = Number(cut.end)
  const within = data.ladder.filter((item) => idOf(item.lesson) === lesson.id && Number(item.start) >= start - 1 && Number(item.end) <= end + 1)
  const hors = within.find((item) => item.kind === 'hors')
  const appetiser = within.find((item) => item.kind === 'appetiser')
  const placeholder = Boolean(cut.placeholder)
  const quote = placeholder ? '' : String(hors?.quote || cut.land || '')
  const shown = appetiser ? { start: Number(appetiser.start), end: Number(appetiser.end), quote: String(appetiser.quote || cut.land) } : { start, end: placeholder ? end + 600 : end, quote }
  const rough = hors && !placeholder ? { start: Number(hors.start), end: Number(hors.end) } : { start: placeholder ? start : Math.max(start, end - 18), end }
  // The hors d'oeuvre is part of the appetiser, so a ladder rung that strays outside it is pulled back in.
  const horsStart = Math.max(shown.start, Math.min(rough.start, shown.end - 1))
  const hook = placeholder ? '' : String(cut.hook || '')
  const turn = placeholder ? '' : String(cut.turn || '')
  const landLine = placeholder ? '' : String(cut.land || '')
  const horsEnd = Math.min(shown.end, Math.max(rough.end, horsStart + 1))
  const tidy = tidyOf(speaker, null, { hook, turn, land: landLine, horsLines: quote ? [{ at: horsStart, text: quote }] : [] })
  return {
    ...base,
    hookTidy: tidy.hookTidy,
    turnTidy: tidy.turnTidy,
    landTidy: tidy.landTidy,
    scenic: tidy.scenic,
    hors: { start: horsStart, end: horsEnd, quote, lines: tidy.horsLines.length ? tidy.horsLines : undefined },
    appetiser: shown,
    hook,
    turn,
    land: landLine,
    placeholder,
    tierStatus: null,
    offerResume: true,
    ...extractFields(data, lesson.id, parentsFor(lesson.id, data.ladder.filter((item) => idOf(item.lesson) === lesson.id))),
  }
}

function extractFields(data: Loaded, lessonId: number, fallback: { hors: PieceRef; appetiser: PieceRef }) {
  const own = data.extracts.filter((row) => Number(row.lesson) === Number(lessonId))
  const linked = attachHorsToAppetisers(own)
  const visible = linked.filter((row) => extractVisible(row, data.showUnchecked))
  const hors = visible.filter((row) => row.kind === 'hors')
  const appetisers = visible.filter((row) => row.kind === 'appetiser')
  const first = hors[0]
  const parent = first ? (appetisers.find((row) => row.id === first.parent) || parentAppetiserFor(first, appetisers)) : appetisers[0] || null
  return {
    extracts: linked,
    extractId: first?.id ?? null,
    parentExtractId: parent?.id ?? null,
    parents: first ? extractParents(first, parent, lessonId) : fallback,
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
  const d0Raw = idOf(own?.defaultClip) || idOf(master?.defaultClip) || null
  const d0CutId = d0Raw ? data.alias.get(d0Raw) || d0Raw : null
  const lanes = laneDefs(data)
  const cuts = cutInfos(data, portal)
  const laneTitles = laneTitleMap(data)
  const starters: Record<string, FeedItem> = {}
  const wanted = new Set<number>([...(d0CutId ? [d0CutId] : []), ...cuts.filter((cut) => cut.starter?.role === 'first').map((cut) => cut.id)])
  for (const [index, id] of [...wanted].entries()) {
    const row = data.cuts.find((cut) => cut.id === id)
    const info = cuts.find((cut) => cut.id === id)
    const item = row ? itemFor(data, row, info?.starter?.lane || null, laneTitles, index) : null
    if (item) starters[String(id)] = presentClips([item], data.showUnchecked)[0] || item
  }
  const clips: Record<string, FeedItem> = {}
  for (const [index, info] of cuts.entries()) {
    const row = data.cuts.find((cut) => cut.id === info.id)
    const item = row ? itemFor(data, row, info.starter?.lane || null, laneTitles, index) : null
    if (item) clips[String(info.id)] = presentClips([item], data.showUnchecked)[0] || item
  }
  const alias: Record<string, number> = {}
  for (const [from, to] of data.alias) {
    alias[String(from)] = to
    if (clips[String(to)] && !clips[String(from)]) clips[String(from)] = clips[String(to)]
  }
  return {
    portal: portal.slug,
    scenesVersion: Math.max(1, ...scenes.map((scene) => (scene as SceneDef & { version: number }).version)),
    scenes: scenes.map(({ version: _version, ...scene }) => scene as SceneDef),
    scales: data.scales.map((row) => ({ key: row.key as ScaleDef['key'], firstOpenRead: row.firstOpenRead !== false })),
    helpContacts: contacts.map(({ label, phone, url, hours }) => ({ label, phone: phone || null, url: url || null, hours: hours || null })),
    d0CutId,
    route: { lanes, cuts, d0CutId, allowSuggested: process.env.HEARTS_ALLOW_SUGGESTED_LANES === '1', showUnchecked: data.showUnchecked },
    starters,
    clips,
    alias,
    laneTitles,
    trendsPrompt: own?.trendsContributionPrompt !== false && master?.trendsContributionPrompt !== false,
    backgroundsBaseUrl: readBackgroundsBaseUrl(),
  }
}

/** Section 3.4 on the server, from lane scores only (P2). Returns display items for the slots. */
export async function serveFeed(payload: Payload, portal: PortalDoc, user: SessionUser | null, plan: FeedPlan) {
  const courseIds = await routeCourseIds(payload, portal, user)
  const data = await loadAll(payload, courseIds)
  const { own, master } = await openingConfig(payload, portal.id)
  const d0Raw = idOf(own?.defaultClip) || idOf(master?.defaultClip) || null
  const d0CutId = d0Raw ? data.alias.get(d0Raw) || d0Raw : null
  const ctx = { lanes: laneDefs(data), scales: [], cuts: cutInfos(data, portal), d0CutId, now: now().getTime(), allowSuggested: process.env.HEARTS_ALLOW_SUGGESTED_LANES === '1', showUnchecked: data.showUnchecked }
  const built = buildFeed(plan, ctx)
  let slots: FeedSlot[] = built.items
  // Once the learner has seen everything, start the spine again rather than leave the feed empty.
  if (!slots.length) slots = buildFeed({ ...plan, served: [], spinePointer: 0 }, ctx).items
  const laneTitles = laneTitleMap(data)
  const talks = slots
    .map((slot, index) => {
      const row = data.cuts.find((cut) => cut.id === slot.cutId)
      return row ? itemFor(data, row, slot.laneKey, laneTitles, index) : null
    })
    .filter((item): item is FeedItem => Boolean(item))
  const items = mixFeed(presentClips(talks, data.showUnchecked), plan.served.length, readBackgroundsBaseUrl())
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
  return lesson ? { lessonId, courseId: idOf((lesson as { course?: unknown }).course), title: String((lesson as { title?: string; sourceTitle?: string }).title || (lesson as { sourceTitle?: string }).sourceTitle) } : null
}

/**
 * Every clip this learner may see, built exactly as the feed builds them, so Lanes, Home and the speaker page show
 * the same tier times as the feed.
 */
export async function learnerClips(payload: Payload, portal: PortalDoc, user: SessionUser | null) {
  const opening = await loadOpening(payload, portal, user)
  return { opening, items: presentClips(Object.values(opening.clips)) }
}
