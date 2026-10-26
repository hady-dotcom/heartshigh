import type { Payload } from 'payload'
import { idOf } from '@/lib/ids'
import {
  SEQUENCE_COPY,
  coursesFromSheet,
  groupByBookSheet,
  httpsLogo,
  hexColour,
  isCourseSheet,
  isSequencePortal,
  isUnderPortalMin,
  minTalkSecondsOf,
  modulesInSheetOrder,
  parseCourseSheet,
  parseVideoList,
  type CourseFilm,
  type ParsedVideo,
  type ShapeSource,
} from '@/lib/sequence'
import { cleanPortalScenes } from '@/lib/portal-scenes'
import { readSaidAnswers } from '@/lib/said-answers'
import { buildExportZip, type ExportAnswer, type ExportPortal, type ExportVideo } from '@/lib/sequence-export'
import { transcriptFor } from '@/lib/youtube'
import { sortParts } from '@/lib/part-order'
import { matchQuestions } from '@/lib/question-keep'
import { fetchVimeoMetas, shouldFetchVimeo, type VimeoMeta } from '@/lib/vimeo-meta'

type Doc = Record<string, unknown> & { id: number }

export type LookupResult = {
  title?: string
  speaker?: string
  durationSeconds?: number
  posterUrl?: string
  transcript?: string
  note?: string
}

export type VideoLookup = (video: ParsedVideo) => Promise<LookupResult>

const LOOKUP_BUDGET_MS = 8000
const LOOKUP_EACH_MS = 1500

async function readJson(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(LOOKUP_EACH_MS) })
  if (!response.ok) return null
  return (await response.json()) as { title?: string; author_name?: string; duration?: number; thumbnail_url?: string }
}

/** Titles from the public oEmbed page, and captions when YouTube will give them. */
export async function lookupVideo(video: ParsedVideo): Promise<LookupResult> {
  let title = ''
  let speaker = ''
  let durationSeconds = 0
  let posterUrl = ''
  try {
    const endpoint = video.provider === 'youtube'
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(video.url)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(video.url)}`
    const meta = await readJson(endpoint)
    title = String(meta?.title || '').trim()
    speaker = String(meta?.author_name || '').trim()
    durationSeconds = Number(meta?.duration || 0)
    posterUrl = /^https:\/\//i.test(String(meta?.thumbnail_url || '')) ? String(meta?.thumbnail_url) : ''
  } catch {
    title = ''
  }
  if (video.provider !== 'youtube') {
    return { title, speaker, durationSeconds: durationSeconds || undefined, posterUrl: posterUrl || undefined, note: SEQUENCE_COPY.captions }
  }
  const got = await transcriptFor(video.id)
  if (got.transcript) {
    return { title, speaker, durationSeconds: durationSeconds || got.duration || undefined, posterUrl: posterUrl || undefined, transcript: got.transcript }
  }
  return { title, speaker, durationSeconds: durationSeconds || undefined, posterUrl: posterUrl || undefined, note: SEQUENCE_COPY.captions }
}

async function lookupAll(videos: ParsedVideo[], lookup: VideoLookup) {
  const out: LookupResult[] = videos.map(() => ({ note: SEQUENCE_COPY.captions }))
  const deadline = Date.now() + LOOKUP_BUDGET_MS
  let cursor = 0
  async function worker() {
    while (cursor < videos.length && Date.now() < deadline) {
      const index = cursor
      cursor += 1
      const left = deadline - Date.now()
      if (left <= 0) return
      try {
        out[index] = await Promise.race([
          lookup(videos[index]),
          new Promise<LookupResult>((resolve) => setTimeout(() => resolve({ note: SEQUENCE_COPY.captions }), Math.min(left, LOOKUP_EACH_MS + 200))),
        ])
      } catch {
        out[index] = { note: SEQUENCE_COPY.captions }
      }
    }
  }
  const workers = Math.min(4, videos.length)
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return out
}

function asDoc(value: unknown) {
  return value as unknown as Doc
}

function shapeOf(portal: Doc): ShapeSource {
  return {
    shape: typeof portal.shape === 'string' ? portal.shape : null,
    teacherCap: typeof portal.teacherCap === 'number' ? portal.teacherCap : null,
    minTalkSeconds: typeof portal.minTalkSeconds === 'number' ? portal.minTalkSeconds : null,
    lockOrder: typeof portal.lockOrder === 'boolean' ? portal.lockOrder : null,
    colour: typeof portal.colour === 'string' ? portal.colour : null,
    accent: typeof portal.accent === 'string' ? portal.accent : null,
  }
}

async function portalDoc(payload: Payload, portalId: number) {
  return asDoc(await payload.findByID({ collection: 'portals', id: portalId, depth: 0, overrideAccess: true }))
}

/** The checked kinetic clip for one film, or null when there is none. */
export async function kineticClipFor(payload: Payload, lessonId: number) {
  const found = await payload.find({
    collection: 'talk-tiers',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ lesson: { equals: lessonId } }, { status: { equals: 'checked' } }] },
  })
  const row = found.docs[0] as { horsStart?: number; horsEnd?: number; horsQuote?: string | null } | undefined
  if (!row) return null
  const start = Number(row.horsStart)
  const end = Number(row.horsEnd)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end, quote: String(row.horsQuote || '') }
}

export async function sequenceCourseFor(payload: Payload, portalId: number) {
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 5,
    sort: 'createdAt',
    where: { and: [{ origin: { equals: 'local' } }, { portal: { equals: portalId } }, { hidden: { not_equals: true } }] },
  })
  return found.docs[0] ? asDoc(found.docs[0]) : null
}

async function ensureCourse(payload: Payload, portal: Doc) {
  const existing = await sequenceCourseFor(payload, portal.id)
  if (existing) return existing
  const course = (await payload.create({
    collection: 'courses',
    overrideAccess: true,
    data: {
      title: 'Films, in order',
      summary: SEQUENCE_COPY.examples,
      origin: 'local',
      portal: portal.id,
      importable: false,
      visibility: 'published',
      hidden: false,
    },
  })) as unknown as Doc
  await payload.create({
    collection: 'units',
    overrideAccess: true,
    data: { title: 'Films', course: course.id, order: 1 },
  })
  return course
}

function lessonKey(row: Doc) {
  const provider = String(row.videoProvider || 'youtube')
  const id = provider === 'vimeo' ? String(row.vimeoId || '') : String(row.youtubeId || '')
  return `${provider}:${id}`
}

const LESSON_CHILDREN = ['answers', 'talk-tiers', 'cuts', 'engagement-points', 'resources', 'ladder-items', 'completions', 'watch-sessions', 'lesson-visits'] as const

async function deleteWhere(payload: Payload, collection: (typeof LESSON_CHILDREN)[number], lessonId: number) {
  const found = await payload.find({
    collection,
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { lesson: { equals: lessonId } },
  })
  for (const doc of found.docs) {
    await payload.delete({ collection, id: doc.id, overrideAccess: true })
  }
}

async function deleteLesson(payload: Payload, lessonId: number) {
  for (const collection of LESSON_CHILDREN) await deleteWhere(payload, collection, lessonId)
  await payload.delete({ collection: 'lessons', id: lessonId, overrideAccess: true })
}

function calloutFields(lessonId: number, callout: CourseFilm['callouts'][number]) {
  return {
    lesson: lessonId,
    triggerType: 'timestamp' as const,
    second: callout.second,
    kind: callout.kind,
    prompt: callout.prompt,
    options: callout.options.length ? callout.options : undefined,
    correctOption: callout.correct || undefined,
    timing: 'immediate' as const,
    audience: 'everyone' as const,
    status: 'published' as const,
  }
}

async function deleteAnswersForPoints(payload: Payload, pointIds: number[]) {
  if (!pointIds.length) return
  for (;;) {
    const found = await payload.find({
      collection: 'answers',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      where: { point: { in: pointIds } },
    })
    if (!found.docs.length) return
    for (const doc of found.docs) await payload.delete({ collection: 'answers', id: doc.id, overrideAccess: true })
    if (found.docs.length < 100) return
  }
}

/** Keeps learner answers when the question text is the same. A changed question drops only its own answers. */
async function syncFilmQuestions(payload: Payload, lessonId: number, callouts: CourseFilm['callouts']) {
  const existing = await payload.find({
    collection: 'engagement-points',
    overrideAccess: true,
    depth: 0,
    limit: 50,
    where: { lesson: { equals: lessonId } },
  })
  const points = existing.docs.map((row) => asDoc(row)).map((row) => ({ id: row.id, prompt: String(row.prompt || '') }))
  const plan = matchQuestions(points, callouts.map((callout) => callout.prompt))
  for (const kept of plan.kept) {
    const callout = callouts.find((row) => row.prompt === kept.prompt)
    if (!callout) continue
    await payload.update({
      collection: 'engagement-points',
      id: kept.id,
      overrideAccess: true,
      context: { sequenceCallout: true },
      data: calloutFields(lessonId, callout),
    })
  }
  await deleteAnswersForPoints(payload, plan.dropped)
  for (const id of plan.dropped) await payload.delete({ collection: 'engagement-points', id, overrideAccess: true })
  for (const prompt of plan.fresh) {
    const callout = callouts.find((row) => row.prompt === prompt)
    if (!callout) continue
    await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      context: { sequenceCallout: true },
      data: calloutFields(lessonId, callout),
    })
  }
}

function filmKey(film: CourseFilm) {
  return film.vimeoId ? `vimeo:${film.vimeoId}` : `title:${titleKey(film.publicTitle || film.title)}`
}

function titleKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function rowKey(row: Doc) {
  const vimeoId = String(row.vimeoId || '').trim()
  if (vimeoId) return `vimeo:${vimeoId}`
  const title = titleKey(String(row.title || row.sourceTitle || ''))
  return title ? `title:${title}` : ''
}

function rememberLesson(buckets: Map<string, Doc[]>, key: string, row: Doc) {
  if (!key) return
  const list = buckets.get(key) || []
  if (!list.includes(row)) list.push(row)
  buckets.set(key, list)
}

function sameCourseTitle(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

async function courseNamed(payload: Payload, portal: Doc, title: string, extra?: { sheetTitle?: string; sheetOrder?: number }) {
  const name = title.trim().slice(0, 200)
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] },
  })
  const match = found.docs.map((row) => asDoc(row)).find((row) => sameCourseTitle(String(row.title || ''), name))
  const data = {
    title: name,
    summary: 'Watch the films in order.',
    origin: 'local' as const,
    portal: portal.id,
    importable: false,
    visibility: 'published' as const,
    hidden: false,
    ...(extra?.sheetTitle ? { sheetTitle: extra.sheetTitle.slice(0, 200) } : {}),
    ...(extra?.sheetOrder ? { sheetOrder: extra.sheetOrder } : {}),
  }
  if (match) {
    await payload.update({ collection: 'courses', id: match.id, overrideAccess: true, data })
    return { course: { ...match, ...data }, created: false }
  }
  const course = (await payload.create({
    collection: 'courses',
    overrideAccess: true,
    data,
  })) as unknown as Doc
  await offerCourse(payload, portal.id, course.id)
  return { course, created: true }
}

async function everyDoc(payload: Payload, collection: 'courses' | 'lessons' | 'units' | 'answers', where: Record<string, unknown>) {
  const docs: Doc[] = []
  let page = 1
  for (;;) {
    const found = await payload.find({
      collection,
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      sort: 'id',
      where: where as never,
    })
    docs.push(...found.docs.map((row) => asDoc(row)))
    if (!found.hasNextPage || !found.docs.length) return docs
    page += 1
    if (page > 40) return docs
  }
}

async function lessonHasAnswers(payload: Payload, lessonId: number) {
  const found = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { lesson: { equals: lessonId } },
  })
  return found.docs.length > 0
}

/** A new course is on this portal's codes and on the accounts that already joined. */
async function offerCourse(payload: Payload, portalId: number, courseId: number) {
  const codes = await payload.find({
    collection: 'access-codes',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { portal: { equals: portalId } },
  })
  for (const code of codes.docs) {
    const current = ((code.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    if (current.includes(courseId)) continue
    await payload.update({ collection: 'access-codes', id: code.id, overrideAccess: true, data: { courses: [...current, courseId] } })
  }
  const { giveCourseToJoinedLearners } = await import('./course-offer')
  await giveCourseToJoinedLearners(payload, portalId, courseId)
}

/**
 * Bring a master sheet into this portal only.
 * The course stays local, so it is left out of the HEARTS library.
 */
export async function importPortalSheet(payload: Payload, portalId: number, raw: string, title: string) {
  const name = title.trim()
  if (!name) return { error: 'Name the course first.' }
  return syncCourseSheet(payload, portalId, raw, { anyPortal: true, title: name })
}

/** A master sheet becomes a collection. Each module becomes a course. Existing lessons move and keep their ids. */
export async function syncCourseSheet(payload: Payload, portalId: number, raw: string, opts?: { anyPortal?: boolean; title?: string; vimeoMetas?: Map<string, VimeoMeta> }) {
  const portal = await portalDoc(payload, portalId)
  if (!opts?.anyPortal && !isSequencePortal(shapeOf(portal))) return { error: 'This portal does not use a sequenced course.' }
  const parsed = parseCourseSheet(raw)
  if (parsed.error) return { error: parsed.error }
  if (!parsed.films.length) return { error: 'That sheet has no films.' }
  const anchor = await sequenceCourseFor(payload, portal.id)
  const collectionTitle = (opts?.title || String(anchor?.sheetTitle || '') || String(anchor?.title || '')).trim() || 'Films'
  const groupByBook = groupByBookSheet(collectionTitle)
  const plans = coursesFromSheet(parsed.films, { groupByBook })
  const moduleNames = modulesInSheetOrder(parsed.films)
  if (moduleNames.length !== plans.length) return { error: 'A film is missing its course.' }
  const vimeoMetas = opts?.vimeoMetas || (shouldFetchVimeo() ? await fetchVimeoMetas(parsed.films.map((film) => film.vimeoId)) : new Map<string, VimeoMeta>())
  const portalCourses = await everyDoc(payload, 'courses', { and: [{ origin: { equals: 'local' } }, { portal: { equals: portal.id } }] })
  const courseIdsOnPortal = portalCourses.map((row) => row.id)
  const lessons = courseIdsOnPortal.length
    ? await everyDoc(payload, 'lessons', { course: { in: courseIdsOnPortal } })
    : []
  const buckets = new Map<string, Doc[]>()
  const home = new Map<number, number>()
  for (const row of lessons) {
    home.set(row.id, idOf(row.course) || 0)
    rememberLesson(buckets, rowKey(row), row)
    rememberLesson(buckets, `title:${titleKey(String(row.title || ''))}`, row)
    rememberLesson(buckets, `title:${titleKey(String(row.sourceTitle || ''))}`, row)
  }
  const kept = new Set<number>()
  const usedCourses = new Set<number>()
  const courseIds: number[] = []
  let createdCourse = false
  for (const plan of plans) {
    const named = await courseNamed(payload, portal, plan.title, { sheetTitle: collectionTitle, sheetOrder: plan.order })
    if (named.created) createdCourse = true
    const course = named.course
    usedCourses.add(course.id)
    courseIds.push(course.id)
    const unitRows = await everyDoc(payload, 'units', { course: { equals: course.id } })
    const unitsByTitle = new Map(unitRows.map((row) => [String(row.title || ''), row]))
    const sectionNames: string[] = []
    for (const film of plan.films) {
      if (!sectionNames.includes(film.section)) sectionNames.push(film.section)
    }
    const unitId = new Map<string, number>()
    for (let index = 0; index < sectionNames.length; index++) {
      const name = sectionNames[index]
      const existing = unitsByTitle.get(name)
      if (existing) {
        if (Number(existing.order) !== index + 1) {
          await payload.update({ collection: 'units', id: existing.id, overrideAccess: true, data: { order: index + 1 } })
        }
        unitId.set(name, existing.id)
        continue
      }
      const created = await payload.create({
        collection: 'units',
        overrideAccess: true,
        data: { title: name, course: course.id, order: index + 1 },
      })
      unitId.set(name, created.id)
    }
    for (let index = 0; index < plan.films.length; index++) {
      const film = plan.films[index]
      const unused = (key: string) => (buckets.get(key) || []).find((row) => !kept.has(row.id))
      const current = unused(filmKey(film)) || unused(`title:${titleKey(film.publicTitle)}`) || unused(`title:${titleKey(film.title)}`)
      const unit = unitId.get(film.section)
      if (!unit) return { error: 'A film is missing its section.' }
      const meta = film.vimeoId ? vimeoMetas.get(film.vimeoId) : undefined
      const priorDuration = Number(current?.durationSeconds || 0)
      const priorPoster = String(current?.posterUrl || '').trim()
      const priorHash = String(current?.vimeoHash || '').trim()
      const sameVideo = Boolean(current) && String(current?.vimeoId || '') === (film.vimeoId || '')
      const metaHash = meta?.hash && /^[0-9a-f]{6,20}$/i.test(meta.hash) ? meta.hash : ''
      const keptHash = metaHash || (sameVideo ? priorHash : '')
      const data = {
        title: film.publicTitle.slice(0, 240),
        sourceTitle: film.title.slice(0, 240),
        unit,
        course: course.id,
        portal: portal.id,
        master: false,
        order: index + 1,
        speaker: '',
        speakerProfile: null,
        sourceUrl: (film.vimeoLink || film.drive).slice(0, 500) || null,
        youtubeUrl: null,
        youtubeId: null,
        vimeoId: film.vimeoId || null,
        vimeoHash: keptHash || null,
        videoProvider: film.vimeoId ? 'vimeo' as const : null,
        transcript: null,
        transcriptSource: 'none' as const,
        transcriptNote: film.transcript.slice(0, 2000) || null,
        tooShort: false,
        publishState: 'published' as const,
        jibrilSection: null,
        ghunyaHeading: null,
        ...(Number(meta?.durationSeconds || 0) || priorDuration ? { durationSeconds: Number(meta?.durationSeconds || 0) || priorDuration } : {}),
        ...((meta?.posterUrl || priorPoster) ? { posterUrl: meta?.posterUrl || priorPoster } : {}),
      }
      const lesson = current
        ? await payload.update({ collection: 'lessons', id: current.id, overrideAccess: true, data })
        : await payload.create({ collection: 'lessons', overrideAccess: true, data })
      const lessonId = lesson.id
      kept.add(lessonId)
      home.set(lessonId, course.id)
      await syncFilmQuestions(payload, lessonId, film.callouts)
    }
    const wantedUnits = new Set(unitId.values())
    for (const row of unitRows) {
      if (wantedUnits.has(row.id)) continue
      const still = await payload.find({
        collection: 'lessons',
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { unit: { equals: row.id } },
      })
      if (!still.docs.length) await payload.delete({ collection: 'units', id: row.id, overrideAccess: true })
    }
  }
  const planTitles = new Set(plans.map((plan) => plan.title))
  const managed = new Set(portalCourses.filter((row) => {
    const title = String(row.title || '')
    const sheet = String(row.sheetTitle || '')
    return sheet === collectionTitle || title === collectionTitle || planTitles.has(title) || usedCourses.has(row.id)
  }).map((row) => row.id))
  for (const row of lessons) {
    if (kept.has(row.id)) continue
    if (!managed.has(home.get(row.id) || 0)) continue
    if (await lessonHasAnswers(payload, row.id)) continue
    await deleteLesson(payload, row.id)
    home.delete(row.id)
  }
  for (const row of portalCourses) {
    if (usedCourses.has(row.id)) continue
    if (!managed.has(row.id)) continue
    const left = [...home.values()].filter((courseId) => courseId === row.id).length
    if (left) continue
    await payload.update({ collection: 'courses', id: row.id, overrideAccess: true, data: { hidden: true, sheetTitle: collectionTitle } as never })
  }
  await rememberSheetCourses(payload, portal.id, courseIds)
  const extra = parsed.skipped.length ? ` ${parsed.skipped.slice(0, 2).join(' ')}` : ''
  const notice = createdCourse && portalCourses.length === 0
    ? `${SEQUENCE_COPY.sheetMade} ${collectionTitle}, ${parsed.films.length} films.${extra}`
    : `Updated ${collectionTitle}. ${parsed.films.length} films.${extra}`
  return { notice, courseIds, courseId: courseIds[0] || 0 }
}

/** Codes, packs and saved course lists pick up every course in the collection. */
async function rememberSheetCourses(payload: Payload, portalId: number, courseIds: number[]) {
  for (const courseId of courseIds) await offerCourse(payload, portalId, courseId)
  const packs = await payload.find({
    collection: 'packs',
    overrideAccess: true,
    depth: 0,
    limit: 20,
    where: { portal: { equals: portalId } },
  })
  for (const pack of packs.docs) {
    const current = ((pack.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const next = [...new Set([...current, ...courseIds])]
    if (next.length === current.length) continue
    await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: next } })
  }
  const users = await payload.find({
    collection: 'users',
    overrideAccess: true,
    depth: 0,
    limit: 200,
    where: { 'tenants.tenant': { equals: portalId } },
  }).catch(() => null)
  for (const user of users?.docs || []) {
    const current = ((user.courseList as unknown[]) || []).map((item) => Number(item)).filter((id) => Number.isFinite(id) && id > 0)
    if (!current.length) continue
    const next = [...new Set([...current, ...courseIds])]
    if (next.length === current.length) continue
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { courseList: next } })
  }
}

export async function saveSequenceImport(payload: Payload, portalId: number, raw: string, lookup: VideoLookup = lookupVideo) {
  if (isCourseSheet(raw)) return syncCourseSheet(payload, portalId, raw)
  const portal = await portalDoc(payload, portalId)
  if (!isSequencePortal(shapeOf(portal))) return { error: 'This portal does not use a sequenced course.' }
  const parsed = parseVideoList(raw)
  if (parsed.error) return { error: parsed.error }
  if (!parsed.videos.length) return { error: 'Paste at least one YouTube or Vimeo link.' }
  const course = await ensureCourse(payload, portal)
  const units = await payload.find({ collection: 'units', overrideAccess: true, depth: 0, limit: 1, sort: 'order', where: { course: { equals: course.id } } })
  const unit = units.docs[0] ? asDoc(units.docs[0]) : undefined
  if (!unit) return { error: 'That course has no unit yet.' }
  const existing = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 300,
    sort: 'order',
    where: { course: { equals: course.id } },
  })
  const known = new Set(existing.docs.map((row) => lessonKey(asDoc(row))))
  const fresh = parsed.videos.filter((video) => !known.has(`${video.provider}:${video.id}`))
  const repeats = parsed.videos.length - fresh.length
  const looked = await lookupAll(fresh, lookup)
  const minSeconds = minTalkSecondsOf(shapeOf(portal))
  let order = existing.docs.length
  let added = 0
  const notes = [...parsed.skipped]
  if (repeats) notes.push(repeats === 1 ? '1 film was already in the list.' : `${repeats} films were already in the list.`)
  for (let index = 0; index < fresh.length; index++) {
    const video = fresh[index]
    const meta = looked[index] || {}
    const duration = Number(meta.durationSeconds || 0)
    const title = (video.title || meta.title || `Film ${order + 1}`).slice(0, 180)
    if (isUnderPortalMin(duration, minSeconds)) {
      notes.push(`Skipped “${title}” because it is under the minimum length.`)
      continue
    }
    order += 1
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title,
        unit: unit.id,
        course: course.id,
        portal: portal.id,
        master: false,
        order,
        speaker: (video.speaker || meta.speaker || '').slice(0, 120),
        sourceTitle: (meta.title || video.title || '').slice(0, 180),
        sourceUrl: video.url,
        youtubeUrl: video.provider === 'youtube' ? video.url : undefined,
        youtubeId: video.provider === 'youtube' ? video.id : undefined,
        vimeoId: video.provider === 'vimeo' ? video.id : undefined,
        vimeoHash: video.hash || undefined,
        videoProvider: video.provider,
        durationSeconds: duration || undefined,
        ...(meta.posterUrl ? { posterUrl: meta.posterUrl } : {}),
        transcript: meta.transcript || undefined,
        transcriptSource: meta.transcript ? video.provider : 'none',
        transcriptNote: meta.transcript ? undefined : meta.note || SEQUENCE_COPY.captions,
        tooShort: false,
        publishState: 'published',
      },
    })
    added += 1
  }
  const notice = added
    ? `Added ${added} film${added === 1 ? '' : 's'}.${notes.length ? ` ${notes.slice(0, 3).join(' ')}` : ''}`
    : notes[0] || 'Nothing new was added.'
  return { notice }
}

export async function saveSequenceOrder(payload: Payload, portalId: number, orderIds: number[], titles: Map<number, string>) {
  const portal = await portalDoc(payload, portalId)
  if (!isSequencePortal(shapeOf(portal))) return { error: 'This portal does not use a sequenced course.' }
  const course = await sequenceCourseFor(payload, portalId)
  if (!course) return { error: 'Add a film before changing the order.' }
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 300,
    where: { course: { equals: course.id } },
  })
  const byId = new Map(lessons.docs.map((row) => asDoc(row)).map((row) => [row.id, row]))
  if (!orderIds.length || orderIds.some((id) => !byId.has(id)) || orderIds.length !== byId.size) {
    return { error: 'Save the full list. Every film needs a place.' }
  }
  for (let index = 0; index < orderIds.length; index++) {
    const id = orderIds[index]
    const title = (titles.get(id) || String(byId.get(id)?.title || '')).trim().slice(0, 180)
    if (!title) return { error: 'Every film needs a title.' }
    await payload.update({
      collection: 'lessons',
      id,
      overrideAccess: true,
      data: { order: index + 1, title },
    })
  }
  return { notice: 'Order saved.' }
}

export async function saveSequenceSettings(payload: Payload, portalId: number, input: {
  name: string
  welcome: string
  colour: string
  accent: string
  logoUrl: string
  brandName?: string
  lockOrder: boolean
  minTalkSeconds: number
}) {
  const portal = await portalDoc(payload, portalId)
  if (!isSequencePortal(shapeOf(portal))) return { error: 'This portal does not use a sequenced course.' }
  const name = input.name.trim().slice(0, 80)
  if (!name) return { error: 'The portal needs a name.' }
  if (input.logoUrl.trim() && !httpsLogo(input.logoUrl) && !(input.logoUrl.trim().startsWith('/') && !input.logoUrl.trim().startsWith('//') && !input.logoUrl.includes('..'))) {
    return { error: 'The logo needs to be a path like /icons/hady-home.svg or an https link.' }
  }
  const minTalkSeconds = input.minTalkSeconds === 300 ? 300 : 0
  await payload.update({
    collection: 'portals',
    id: portalId,
    overrideAccess: true,
    data: {
      name,
      organisationName: name,
      welcome: input.welcome.trim().slice(0, 500),
      colour: hexColour(input.colour, '#1f3a5f'),
      accent: hexColour(input.accent, '#e07a5f'),
      logoUrl: httpsLogo(input.logoUrl) || (input.logoUrl.trim().startsWith('/') && !input.logoUrl.includes('..') ? input.logoUrl.trim() : ''),
      ...(input.brandName !== undefined ? { brandName: input.brandName.trim().slice(0, 80) } : {}),
      lockOrder: input.lockOrder,
      minTalkSeconds,
    },
  })
  const { markShortTalks } = await import('./short-talks')
  await markShortTalks(payload)
  return { notice: 'Portal look saved.' }
}

export async function exportSequenceApp(payload: Payload, portal: {
  id: number
  name?: string | null
  slug?: string | null
  organisationName?: string | null
  brandName?: string | null
  welcome?: string | null
  colour?: string | null
  accent?: string | null
  logoUrl?: string | null
  lockOrder?: boolean | null
  shape?: string | null
  minTalkSeconds?: number | null
  teacherCap?: number | null
}, opts?: { joinCode?: string }) {
  if (!isSequencePortal(shapeOf(asDoc(portal)))) return { error: 'This portal does not use a sequenced course.' as const }
  const course = await sequenceCourseFor(payload, portal.id)
  const lessons = course
    ? (await payload.find({
        collection: 'lessons',
        overrideAccess: true,
        depth: 0,
        limit: 300,
        sort: 'order',
        where: { course: { equals: course.id } },
      })).docs.map((row) => asDoc(row))
    : []
  const parts = sortParts(lessons.map((row) => ({
    id: row.id,
    title: String(row.title || ''),
    sourceTitle: String(row.sourceTitle || ''),
    order: Number(row.order || 0),
  })))
  const byId = new Map(lessons.map((row) => [row.id, row]))
  const ordered = parts.map((part) => byId.get(part.id)).filter((row): row is Doc => Boolean(row))
  const ids = ordered.map((row) => row.id)
  const [cuts, points] = ids.length
    ? await Promise.all([
        payload.find({ collection: 'cuts', overrideAccess: true, depth: 0, limit: 300, where: { lesson: { in: ids } } }),
        payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 400, where: { lesson: { in: ids } } }),
      ])
    : [{ docs: [] as unknown[] }, { docs: [] as unknown[] }]
  const videos: ExportVideo[] = ordered.map((row, index) => {
    const cut = cuts.docs.map((item) => asDoc(item)).find((item) => idOf(item.lesson) === row.id)
    const filmPoints = points.docs.map((item) => asDoc(item)).filter((item) => idOf(item.lesson) === row.id)
    const point = filmPoints[0]
    const provider = String(row.videoProvider || 'youtube') === 'vimeo' ? 'vimeo' : 'youtube'
    const order = Number(row.order || index + 1)
    return {
      order,
      title: String(row.title || `Film ${index + 1}`),
      speaker: String(row.speaker || ''),
      provider,
      id: provider === 'vimeo' ? String(row.vimeoId || '') : String(row.youtubeId || ''),
      hash: /^[0-9a-f]{6,20}$/i.test(String(row.vimeoHash || '')) ? String(row.vimeoHash) : '',
      durationSeconds: Number(row.durationSeconds || 0),
      hook: String(cut?.hook || ''),
      turn: String(cut?.turn || ''),
      land: String(cut?.land || ''),
      question: String(point?.prompt || ''),
      questions: filmPoints.map((item) => ({ second: Number(item.second || 0), prompt: String(item.prompt || '') })).filter((item) => item.prompt),
    }
  })
  const brandName = String(portal.brandName || '').trim()
  const stored = readSaidAnswers((course as { sampleAnswers?: unknown } | null)?.sampleAnswers)
  const answers: ExportAnswer[] = stored.map((row) => ({
    order: row.order,
    phase: row.phase,
    label: row.label,
    question: row.question,
    text: row.text,
    ...(row.sample ? { sample: true } : {}),
  }))
  const config = await payload.find({
    collection: 'opening-configs',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { portal: { equals: portal.id } },
  })
  const ownScenes = cleanPortalScenes(config.docs[0]?.extraScenes).scenes
  const packed: ExportPortal = {
    name: String(portal.organisationName || portal.name || 'Course'),
    slug: String(portal.slug || 'course'),
    colour: hexColour(String(portal.colour || ''), '#1f3a5f'),
    accent: hexColour(String(portal.accent || ''), '#e07a5f'),
    logoUrl: httpsLogo(String(portal.logoUrl || '')),
    lockOrder: portal.lockOrder !== false,
    note: String(portal.welcome || SEQUENCE_COPY.examples),
    joinCode: opts?.joinCode || '',
    brandName: brandName || undefined,
    opening: ownScenes.length ? ownScenes.map((scene) => ({ prompt: scene.caption.replace(/\*\*/g, ''), options: scene.options.map((option) => option.label) })) : undefined,
    answers: answers.length ? answers : undefined,
  }
  return { zip: buildExportZip(packed, videos), filename: `${packed.slug}-app.zip` }
}
