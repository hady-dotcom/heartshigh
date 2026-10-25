import { NextResponse } from 'next/server'
import { CARE_SAVED } from '@/lib/care-copy'
import type { Where } from 'payload'
import { draftsSkippingApproved, dualExtract, rowsKeptOnExtract, youtubeIdFromUrl, type ClauseCard } from '@/lib/extractor'
import { giveHarvest } from './scripture'
import { countsTowardProgress, pieceLevel } from '@/lib/progress'
import { recordShortBrowse } from './browse'
import { idOf, portalIdOf } from '@/lib/ids'
import { clipWords } from '@/lib/sentences'
import { extractWithFallback } from '@/lib/llm'
import { clientForPortal } from './portal-ai'
import { assembleConnection, mcpConnectorStatus, openPortalKey, parseStored, portalAiGate } from '@/lib/portal-ai'
import { defaultPlanName, flattenSlots, planAcrossDays, plural, studyDates } from '@/lib/schedule'
import { sortParts } from '@/lib/part-order'
import { lessonsByCourseOrder } from '@/lib/slot-course'
import { minutesADay } from '@/lib/study-plan'
import { partTitle } from '@/lib/talk-title'
import { planKeepPath, planNotify, planToast } from '@/lib/week'
import { clockEnabled, setTestNow } from '@/lib/clock'
import { authCookie } from '@/lib/cookies'
import { logError } from '@/lib/log'
import { gateAuth, tooManyAnswers } from '@/lib/auth-gate'
import { loginFailurePath } from '@/lib/demo-stage-gate'
import { clientIp, hit, hitAnswer, joinFailKeys, peek, resetLimits } from '@/lib/rate-limit'
import { slugProblem } from '@/lib/text-safety'
import { JOIN_FAILS_PER_CODE, JOIN_FAILS_PER_IP, JOIN_WINDOW_MS, codeRefusal, randomCode } from '@/lib/access-codes'
import { deskScreenName, escapeHtml } from '@/lib/action-error'
import { humanDayMonth } from '@/lib/human-date'
import { isUnavailableFilm } from '@/lib/bring-in-plan'
import { CAPTION_QUEUE_DETAIL, SHARE_LINK_DETAIL, bringInFlash, bringInNote, bringInStatus, captionLang, cleanedTimedTranscript, fetchYoutubeMeta, ingestYoutubeUrl, isAwaitingTranscript, noteAfterTranscriptUpload, speakerForBringIn, splitBringInLines } from '@/lib/youtube'
import { runTranscriptAction } from './transcript-desk'
import { packSaveNotice } from '@/lib/publish-state'
import { bringInAndPublish, commitBringIn, createHelperToken, deleteChannelSpeaker, previewBringIn, publishTalks, revokeHelperToken, saveChannelSpeaker, settleAutoPublish } from './bring-in'
import { replaceSeeHowClip, resetSeeHowClip } from './see-how-clips'
import { giveCourseToPackHolders } from './publish-holders'
import { addCourseToCode, giveCourseToJoinedLearners } from './course-offer'
import { withWorkLock } from '@/lib/work-lock'
import { now } from '@/lib/clock'
import { normaliseOption, startingClause } from '@/lib/placing'
import { attachExtraPlacing } from '@/seed/placing-seed'
import { doorOfClause } from '@/lib/doors'
import { loadDoors } from './doors'
import { delayToMs, unlockState } from '@/lib/unlock'
import { killListHits } from '@/lib/opening-data'
import { afterJoinPath, portalHomePath } from '@/lib/landing'
import { HORS_MAX, HORS_MIN, tierTimings } from '@/lib/tiers'
import { completionVerdict } from '@/lib/nesting'
import { placeOfLesson } from './harvest'
import { importedSheetDraftIds } from './imported-questions'
import { finishedBySchedule } from '@/lib/on-time'
import { showUncheckedTalks, tierVisible } from './opening'
import { tierSourceText } from './tier-source'
import { handleCircle } from './circle'
import { handleSafetyAction } from './safety-actions'
import { saveOwnedMedia } from './media'
import { afterLearnerWords, circleMutedUntil } from './safety'
import { hitShared, UPLOAD_PER_HOUR, HOUR_MS, uploadKey } from '@/lib/rate-store'
import { SLOW_DOWN } from '@/lib/safety'
import { randomUUID } from 'node:crypto'
import { adoptedCourseIds, coursesInPacks, getSession, loadPortal, visibleCourseIds, type Session, type SessionUser } from './context'
import { NEVER_ACTIONS, READ_ONLY, blocked, cookieValue, endSession, viewAsCookie, wrote } from './viewas'
import { changeOwnPassword, dispatchLearnerDesk } from './learner-desk'
import { isTimeZone } from '@/lib/zone-time'
import { parseLengthInput } from '@/lib/length'
import { refusalForTalk, sourceTalkSeconds } from '@/lib/talk-length'
import { portalLogo } from '@/lib/learner-brand'
import { PLAIN_LOOK, SCENE_PRESETS, safeSceneUrl } from '@/lib/portal-look'
import { fillSampleGaps, parseSaidSheet } from '@/lib/said-answers'
import { isSequencePortal, minTalkRefusal, minTalkSecondsOf, teacherCapOf, teacherCapRefusal } from '@/lib/sequence'
import { sequenceFeatureDefaults, sequenceFeaturesFromForm } from '@/lib/sequence-features'
import { screenAnswerSafe } from '@/lib/answer-moderation'
import { FEATURE_UNAVAILABLE, defaultFeatures, featuresFromForm } from '@/lib/features'
import { adoptLibraryCourses, loadPortalById, refuseFeature } from './features'
import { openedCourseIdsForCode } from './code-courses'
import { ensurePackAdopted } from './pack-adopt'

type Payload = Awaited<ReturnType<typeof getSession>>['payload']
type Doc = Record<string, unknown> & { id: number }

async function recordExperimentQuietly(payload: Payload, user: SessionUser, event: string, props?: Record<string, unknown>) {
  try {
    const { recordLearnerEvent } = await import('./experiments')
    await recordLearnerEvent(payload, { user, event, props, portalId: portalIdOf(user) })
  } catch {
    // Tracking must never break a save.
  }
}

async function recordFunnelQuietly(payload: Payload, user: SessionUser, step: string) {
  try {
    const { recordFunnel } = await import('./insights')
    await recordFunnel(payload, { user, portalId: portalIdOf(user), step })
  } catch {
    // Tracking must never break a save.
  }
}

function redirectTo(req: Request, path: string, error?: string, notice?: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const safe = path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\') ? path : '/'
  const url = new URL(safe, host ? `${proto}://${host}` : req.url)
  if (error) url.searchParams.set('error', error)
  if (notice) url.searchParams.set('notice', notice)
  return NextResponse.redirect(url, 303)
}

function refererPath(req: Request) {
  const referer = req.headers.get('referer') || ''
  try {
    const url = new URL(referer)
    const path = `${url.pathname}${url.search}`
    if (path.startsWith('/') && !path.startsWith('//')) return path
  } catch {
    // No usable referer.
  }
  return '/'
}

/** A generic failure keeps what was typed and offers one way back to the screen. */
function actionProblemPage(message: string, next: string, form?: FormData) {
  const safeNext = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/'
  const screen = deskScreenName(safeNext)
  const fields: string[] = []
  if (form) {
    for (const [key, value] of form.entries()) {
      if (typeof value !== 'string') continue
      fields.push(`<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}" />`)
    }
  }
  const retry = fields.length
    ? `<form method="post" action="/api/hearts" data-testid="kept-form">${fields.join('')}<p><button type="submit">Try again with these details</button></p></form>`
    : ''
  const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(message)}</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem;line-height:1.5"><div role="alert" data-testid="error">${escapeHtml(message)}</div><p><a data-testid="error-back" href="${escapeHtml(safeNext)}">Go back to ${escapeHtml(screen)}</a></p>${retry}</body></html>`
  return new NextResponse(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

/** "2:05", "1:02:05" or "125" as whole seconds; null when it is not a time. */
function secondsFrom(value: string) {
  const exact = exactSecondsFrom(value)
  return exact === null ? null : Math.round(exact)
}

/** Seconds to the hundredth, for tier in and out points that sit between sentences. */
function exactSecondsFrom(value: string) {
  const trimmed = value.trim()
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(trimmed)) return null
  return Math.round(trimmed.split(':').reduce((total, part) => total * 60 + Number(part), 0) * 100) / 100
}

/** The message of an error a hook meant people to read (APIError with isPublic), otherwise the fallback. */
function publicMessage(error: unknown, fallback: string) {
  const candidate = error as { isPublic?: boolean; message?: string } | null
  return candidate?.isPublic && candidate.message ? candidate.message : fallback
}

function tooManyJoins() {
  const body =
    '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Too many tries</title></head>' +
    '<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5">' +
    '<h1>Too many tries</h1><p>Several access codes from here were not recognised, so joining is paused for a few minutes. Check the code with whoever gave it to you, then try again.</p>' +
    '<p><a href="/join">Back to joining</a></p></body></html>'
  return new NextResponse(body, { status: 429, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': String(JOIN_WINDOW_MS / 1000) } })
}

function text(form: FormData, key: string) {
  return String(form.get(key) || '').trim()
}

function safeNext(next: string) {
  const value = (next || '/').trim() || '/'
  if (!value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}

/** Sign-in from the front door used to land back on the door. `/` means the person's own home. */
async function landingPath(payload: Awaited<ReturnType<typeof getSession>>['payload'], user: SessionUser, next: string) {
  const wanted = safeNext(next)
  if (wanted !== '/') return wanted
  if (user.role === 'master') return '/master'
  const portalId = portalIdOf(user)
  if (!portalId) return '/'
  const doc = await payload.findByID({ collection: 'portals', id: portalId, overrideAccess: true, depth: 0 }).catch(() => null)
  const slug = (doc as { slug?: string } | null)?.slug
  if (!slug) return '/'
  return portalHomePath(slug, user.role)
}

async function loginResponse(req: Request, email: string, password: string, next: string) {
  const { payload } = await getSession()
  const back = loginFailurePath(next)
  try {
    const result = await payload.login({ collection: 'users', data: { email, password } })
    if (!result.token || !result.user) return redirectTo(req, back, 'That email or password did not match.')
    const full = (await payload.findByID({ collection: 'users', id: result.user.id, overrideAccess: true, depth: 0 })) as SessionUser
    if (full.paused) return redirectTo(req, back, 'This account is paused. Ask your portal to let you back in.')
    if (full.role === 'learner' && (full.removed || !portalIdOf(full))) return redirectTo(req, back, 'This account is not in a portal. Ask your portal to add you again.')
    await payload.update({ collection: 'users', id: full.id, overrideAccess: true, data: { lastSeenAt: now().toISOString() } as never })
    const dest = full.mustChangePassword ? '/change-password' : await landingPath(payload, full, next)
    const response = redirectTo(req, dest)
    response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, result.token, 7200))
    return response
  } catch {
    return redirectTo(req, back, 'That email or password did not match.')
  }
}

function roleFromCode(role: string): SessionUser['role'] {
  if (role === 'admin') return 'portal-admin'
  if (role === 'teacher') return 'teacher'
  return 'learner'
}

const MAX_UPLOAD = 200 * 1024 * 1024

function tooBig(file: File) {
  return file.size > MAX_UPLOAD
}

/** A code may open this portal’s own courses, or a course from the HEARTS library. Other portals’ films are refused. */
async function coursesForThisPortal(payload: Payload, portalId: number, ids: number[]) {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  if (!unique.length) return { local: [] as number[], master: [] as number[] }
  const found = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: unique.length,
    where: { id: { in: unique } },
  })
  if (found.docs.length !== unique.length) return { error: 'Tick a course from this portal, or from the library.' as const }
  const local: number[] = []
  const master: number[] = []
  for (const course of found.docs) {
    const row = course as { id: number; origin?: string; portal?: unknown; importable?: boolean }
    if (row.origin === 'local' && idOf(row.portal) === portalId) local.push(row.id)
    else if (row.origin === 'master' && row.importable !== false) master.push(row.id)
    else return { error: 'Tick a course from this portal, or from the library.' as const }
  }
  return { local, master }
}

async function actingPortal(payload: Awaited<ReturnType<typeof getSession>>['payload'], user: SessionUser, form: FormData) {
  const slug = text(form, 'portalSlug')
  if (user.role !== 'master') {
    const mine = portalIdOf(user)
    if (!mine) return { error: 'Your account is not in a portal.' as const }
    const doc = await payload.findByID({ collection: 'portals', id: mine, overrideAccess: true, depth: 0 })
    const portal = doc as { id: number; slug?: string }
    if (slug && portal.slug !== slug) return { error: 'That portal is not yours.' as const }
    return { portal: { id: portal.id, slug: portal.slug || '' } }
  }
  if (!slug) return { error: 'Name the portal address.' as const }
  const found = await loadPortal(payload, slug)
  if (!found) return { error: 'That portal could not be found.' as const }
  return { portal: { id: found.id, slug: found.slug } }
}

async function featureBlock(
  payload: Awaited<ReturnType<typeof getSession>>['payload'],
  user: SessionUser,
  form: FormData,
  key: 'gather' | 'planner' | 'compass' | 'circle' | 'feedback' | 'workbook',
) {
  let id = portalIdOf(user)
  if (user.role === 'master' && text(form, 'portalSlug')) {
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return acting.error
    id = acting.portal.id
  }
  if (!id) return null
  return refuseFeature(await loadPortalById(payload, id), key)
}

async function courseOfLesson(payload: Awaited<ReturnType<typeof getSession>>['payload'], lessonId: number) {
  const lesson = await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 })
  const courseId = idOf((lesson as { course?: unknown }).course)
  const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 }) : null
  return { lesson, course }
}

function libraryLocked(user: SessionUser, course: { origin?: string } | null) {
  return Boolean(course && course.origin === 'master' && user.role !== 'master')
}

const LOCKED = 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.'

/** A portal admin edits only the local courses of their own portal. Master edits library courses. */
function editError(user: SessionUser, course: Record<string, unknown> | null) {
  if (!course) return 'That course could not be found.'
  if (user.role === 'master') return null
  if (user.role !== 'portal-admin') return 'Only a portal admin can change a course.'
  if (course.origin === 'master') return LOCKED
  if (idOf(course.portal) !== portalIdOf(user)) return 'That course is not in your portal.'
  return null
}

async function findDoc(payload: Payload, collection: string, id: number): Promise<Doc | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  try {
    return (await payload.findByID({ collection: collection as 'users', id, overrideAccess: true, depth: 0 })) as unknown as Doc
  } catch {
    return null
  }
}

/** Packs a portal may hand out: its own packs, and master packs it has adopted. */
async function packUsable(payload: Payload, user: SessionUser, portalId: number, packId: number) {
  const pack = await findDoc(payload, 'packs', packId)
  if (!pack) return false
  if (user.role === 'master') return true
  if (pack.owner === 'portal') return idOf(pack.portal) === portalId
  const adopted = await payload.find({
    collection: 'adoptions',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ portal: { equals: portalId } }, { pack: { equals: packId } }] },
  })
  return adopted.docs.length > 0
}

async function notify(payload: Payload, data: { user: number; portal?: number | null; title: string; body?: string; href?: string; key?: string }) {
  if (data.key) {
    const existing = await payload.find({ collection: 'notifications', overrideAccess: true, limit: 1, where: { and: [{ user: { equals: data.user } }, { key: { equals: data.key } }] } })
    if (existing.docs.length) return
  }
  await payload.create({
    collection: 'notifications',
    overrideAccess: true,
    data: { user: data.user, portal: data.portal || undefined, title: data.title, body: data.body, href: data.href || '/', channel: 'in-app', key: data.key },
  })
}

async function saveUpload(payload: Payload, file: File, portal: number | null, fallbackType: string, owner?: number | null, purpose: 'answer' | 'feedback' = 'answer') {
  return saveOwnedMedia(payload, file, { portal, owner, purpose, fallbackType, alt: file.name })
}

async function clauseCards(payload: Awaited<ReturnType<typeof getSession>>['payload']): Promise<ClauseCard[]> {
  const found = await payload.find({ collection: 'clauses', overrideAccess: true, depth: 0, limit: 50, sort: 'number' })
  return found.docs.map((doc) => {
    const row = doc as { number?: number; fragment?: string; core?: string; teaching?: string }
    return {
      number: row.number || 0,
      fragment: row.fragment || '',
      core: row.core || '',
      teaching: row.teaching || '',
    }
  })
}

async function orderedLessons(payload: Awaited<ReturnType<typeof getSession>>['payload'], courseIds: number[]) {
  if (!courseIds.length) return []
  const units = await payload.find({
    collection: 'units',
    overrideAccess: true,
    depth: 0,
    limit: 400,
    where: { course: { in: courseIds } },
    sort: 'order',
  })
  const lessons = await payload.find({
    collection: 'lessons',
    overrideAccess: true,
    depth: 0,
    limit: 800,
    where: { course: { in: courseIds } },
    sort: 'order',
  })
  const unitOrder = new Map(units.docs.map((doc, index) => [doc.id, index]))
  const ordered = sortParts(lessons.docs as { id: number; title?: string; course?: unknown; order?: number | null; unit?: unknown }[], (row) => unitOrder.get(idOf(row.unit) || 0) ?? 0)
  return lessonsByCourseOrder(ordered, courseIds)
}

export type AnswerInput = {
  pointId: number
  body?: string
  choice?: string
  image?: FormDataEntryValue | null
  video?: FormDataEntryValue | null
  audio?: FormDataEntryValue | null
  keepPrivate?: boolean
  shareWithTeacher?: boolean
  shareWithLearners?: boolean
  answeredAt?: string
  atSecond?: number
  viewingId?: string
  cutId?: number | null
  /** The short level the answer was given on, when it came from the feed. */
  level?: 'hors' | 'appetiser'
  pendingSync?: boolean
}

export type AnswerResult = { ok: true; answerId: number; updated: boolean; keepPrivate: boolean; sharedWithLearners: boolean; correct: boolean | null; care?: boolean } | { ok: false; status: number; error: string }

/** Saves one pop-up answer and its workbook entry, for the answer sheet and for POST /api/answers. */
export async function saveAnswer(payload: Payload, user: SessionUser, input: AnswerInput): Promise<AnswerResult> {
  const fail = (status: number, error: string) => ({ ok: false as const, status, error })
    const pointId = input.pointId
    const point = await findDoc(payload, 'engagement-points', pointId)
    if (!point || point.status === 'rejected') return fail(404, 'That question could not be found.')
    if (point.status === 'draft' && !(await showUncheckedTalks(payload))) return fail(404, 'That question could not be found.')
    const lessonId = idOf(point.lesson)
    const portal = portalIdOf(user)
    if (!portal) return fail(403, 'Your account is not in a portal.')
    const lessonDoc = lessonId ? await findDoc(payload, 'lessons', lessonId) : null
    const courseOfPoint = lessonDoc ? idOf(lessonDoc.course) : null
    const mayAnswer = courseOfPoint && (await visibleCourseIds(payload, user)).includes(courseOfPoint)
    if (!mayAnswer) return fail(403, 'That question is not in your portal.')
    const authorPortal = point.author ? portalIdOf((await findDoc(payload, 'users', idOf(point.author) || 0)) as SessionUser | null) : null
    if (point.audience === 'self' && idOf(point.author) !== user.id) return fail(403, 'That question is not for you.')
    if (point.audience === 'selected' && !((point.audienceUsers as unknown[]) || []).map((row) => idOf(row)).includes(user.id)) {
      return fail(403, 'That question is not for you.')
    }
    if (authorPortal && authorPortal !== portal) return fail(403, 'That question is not in your portal.')
    if (point.timing === 'future') {
      const contingentId = idOf(point.contingent)
      const mine = await payload.find({ collection: 'answers', overrideAccess: true, depth: 0, limit: 50, where: { user: { equals: user.id } } })
      const answeredAt = (id: number | null) => {
        const row = mine.docs.find((doc) => idOf((doc as { point?: unknown }).point) === id)
        return row ? new Date((row as { createdAt: string }).createdAt) : null
      }
      const seen = await payload.find({ collection: 'lesson-visits', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] }, sort: 'createdAt' })
      const state = unlockState({
        timing: 'future',
        delayMs: delayToMs(Number(point.delayAmount || 0), String(point.delayUnit || 'week')),
        hasContingent: Boolean(contingentId),
        contingentAnsweredAt: answeredAt(contingentId),
        seenAt: seen.docs[0] ? new Date((seen.docs[0] as { createdAt: string }).createdAt) : null,
        at: now(),
      })
      if (state.state !== 'open') return fail(409, 'This question has not opened yet. The countdown shows when it will.')
    }
    let body = (input.body || '').trim()
    const choice = (input.choice || '').trim()
    const image = input.image
    const video = input.video
    const audioFile = input.audio
    const hasVideo = video instanceof File && video.size > 0
    const hasAudio = audioFile instanceof File && audioFile.size > 0
    const evidence = String(point.evidence || 'none')
    if (point.kind === 'task' && evidence === 'note' && body.length < 2) return fail(400, 'Write a short note about what you did.')
    if (point.kind === 'task' && evidence === 'photo' && !(image instanceof File && image.size > 0)) return fail(400, 'Add a photo of what you did.')
    if (point.kind === 'task' && evidence === 'none' && !body && !choice && !(image instanceof File && image.size > 0)) body = 'Done'
    if (!body && !choice && !(image instanceof File && image.size > 0) && !hasVideo && !hasAudio) {
      return fail(400, 'Write a few words, or add an image, a sound, or a video.')
    }
    for (const file of [image, video, audioFile]) {
      if (file instanceof File && tooBig(file)) return fail(400, 'That file is over 200 MB.')
    }
    let imageId: number | undefined
    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith('image/')) return fail(400, 'That file needs to be an image.')
      imageId = await saveUpload(payload, image, portal, 'image/jpeg', user.id, 'answer')
    }
    const audio = audioFile
    let audioId: number | undefined
    if (audio instanceof File && audio.size > 0) {
      audioId = await saveUpload(payload, audio, portal, 'audio/webm', user.id, 'answer')
    }
    let videoId: number | undefined
    if (video instanceof File && video.size > 0) {
      videoId = await saveUpload(payload, video, portal, 'video/mp4', user.id, 'answer')
    }
    if (imageId || audioId || videoId) {
      const limited = await hitShared(payload, uploadKey(user.id), UPLOAD_PER_HOUR, HOUR_MS)
      if (!limited.allowed) return fail(429, SLOW_DOWN)
    }
    const keepPrivate = Boolean(input.keepPrivate)
    const shareWithTeacher = Boolean(input.shareWithTeacher) || Boolean(point.showImam)
    // Other learners read an answer only when its author opted in to sharing with learners and chose it here.
    let shareWithLearners = !keepPrivate && Boolean(input.shareWithLearners) && Boolean(user.shareWithLearners)
    if (shareWithLearners && (await circleMutedUntil(payload, user.id))) shareWithLearners = false
    const screened = await screenAnswerSafe([body, choice].filter(Boolean).join(' '))
    const crisis = Boolean(point.crisisOption && (body === point.crisisOption || choice === point.crisisOption))
    const care = crisis || screened.atRisk
    const correct = point.kind === 'multiple_choice' && point.correctOption ? choice === point.correctOption : null
    const extra = {
      answeredAt: input.answeredAt || now().toISOString(),
      atSecond: input.atSecond ?? Number(point.second),
      viewingId: input.viewingId,
      cut: input.cutId || null,
      sourceLevel: (input.cutId ? input.level || 'appetiser' : 'talk') as 'hors' | 'appetiser' | 'talk',
      pendingSync: Boolean(input.pendingSync),
      correct: correct ?? undefined,
      swarmHidden: !screened.show,
      swarmReason: screened.show ? undefined : screened.reason,
    }
    const earlier = await payload.find({ collection: 'answers', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ point: { equals: pointId } }, { user: { equals: user.id } }] } })
    if (earlier.docs.length) {
      await payload.update({
        collection: 'answers',
        id: earlier.docs[0].id,
        overrideAccess: true,
        data: { body, choice, keepPrivate, shareWithTeacher, shareWithLearners, ...extra, ...(imageId ? { image: imageId } : {}), ...(audioId ? { audio: audioId } : {}), ...(videoId ? { video: videoId } : {}) },
      })
      const entry = await payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 0, limit: 1, where: { answer: { equals: earlier.docs[0].id } } })
      if (entry.docs[0]) {
        await payload.update({ collection: 'workbook-entries', id: entry.docs[0].id, overrideAccess: true, data: { body: body || choice, consent: shareWithTeacher, ...(imageId ? { image: imageId } : {}) } })
      }
      await afterLearnerWords(payload, user, portal, body || choice, { type: 'answer', id: earlier.docs[0].id }, crisis)
      return { ok: true as const, answerId: earlier.docs[0].id, updated: true, keepPrivate, sharedWithLearners: shareWithLearners, correct, care }
    }
    const answer = await payload.create({
      collection: 'answers',
      overrideAccess: true,
      data: {
        point: pointId,
        user: user.id,
        lesson: lessonId || undefined,
        body,
        choice,
        image: imageId,
        audio: audioId,
        video: videoId,
        keepPrivate,
        shareWithTeacher,
        shareWithLearners,
        portal,
        ...extra,
      },
    })
    const lesson = lessonId ? await payload.findByID({ collection: 'lessons', id: lessonId, overrideAccess: true, depth: 0 }) : null
    await payload.create({
      collection: 'workbook-entries',
      overrideAccess: true,
      data: {
        user: user.id,
        answer: answer.id,
        lesson: lessonId || undefined,
        course: lesson ? idOf((lesson as { course?: unknown }).course) || undefined : undefined,
        body: body || choice,
        image: imageId,
        consent: shareWithTeacher,
        portal,
      },
    })
    await afterLearnerWords(payload, user, portal, body || choice, { type: 'answer', id: answer.id }, crisis)
    if (shareWithTeacher) await notifyTeachers(payload, user, portal, 'A learner shared an answer', `${user.name || 'A learner'} shared an answer with you.`)
    void recordExperimentQuietly(payload, user, 'question_answered', { point: pointId, lesson: lessonId || 0 })
    const followers = await payload.find({ collection: 'engagement-points', overrideAccess: true, depth: 0, limit: 20, where: { contingent: { equals: pointId } } })
    for (const follower of followers.docs) {
      await notify(payload, {
        user: user.id,
        portal,
        title: 'A follow-up question is on its way',
        body: `A follow-up to "${clipWords(String(point.prompt), 60)}" opens after its waiting time. You will see a countdown on the film.`,
        key: `queued-${follower.id}`,
      })
    }
    return { ok: true as const, answerId: answer.id, updated: false, keepPrivate, sharedWithLearners: shareWithLearners, correct, care }
  }

export function answerSavedMessage(result: { keepPrivate: boolean; sharedWithLearners: boolean; care?: boolean }) {
  if (result.care) return CARE_SAVED
  if (result.keepPrivate) return 'Saved privately in your workbook.'
  return result.sharedWithLearners ? 'Saved in your workbook and shared with other learners.' : 'Saved in your workbook.'
}

export async function handlePost(req: Request) {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return actionProblemPage('That form could not be read. Please try again.', refererPath(req))
  }
  const action = text(form, 'action')
  const session = await getSession({ touch: action !== 'clock' })
  const { payload, viewAs } = session
  if (viewAs && action === 'logout') {
    const live = await payload.find({ collection: 'view-as-sessions', overrideAccess: true, depth: 0, limit: 1, where: { id: { equals: viewAs.id } } })
    if (live.docs[0]) await endSession(payload, live.docs[0] as never, 'actor-signed-out')
  }
  if (viewAs && !['logout', 'login', 'clock'].includes(action)) {
    const settingsTouchPrivate = action === 'me-pref' && ['keepPlace', 'shareOpening', 'shareWithLearners'].includes(text(form, 'name'))
    if (NEVER_ACTIONS.has(action) || settingsTouchPrivate || !viewAs.writeEnabled) {
      await blocked(payload, viewAs, { action, via: 'form', never: NEVER_ACTIONS.has(action) || settingsTouchPrivate })
      return NextResponse.json({ error: READ_ONLY, message: 'Read-only while viewing as someone else.' }, { status: 403 })
    }
  }
  try {
    const response = await handleForm(req, form, session)
    if (viewAs && !['logout', 'login', 'clock'].includes(action) && response.status < 400) {
      const location = response.headers.get('location') || ''
      if (!location.includes('error=')) {
        await payload.update({ collection: 'users', id: viewAs.target.id, overrideAccess: true, data: { updatedBy: viewAs.actorId, onBehalfOf: viewAs.target.id } as never })
        await wrote(payload, viewAs, { action, collection: 'users', id: viewAs.target.id, via: 'form' })
      }
    }
    if (action === 'logout' && cookieValue(req.headers.get('cookie'))) response.headers.append('Set-Cookie', viewAsCookie(null, req))
    return response
  } catch (error) {
    logError('action failed', error, { action: text(form, 'action') })
    return actionProblemPage('Something went wrong with that. Nothing was saved. Please try again.', text(form, 'next') || refererPath(req), form)
  }
}

async function handleForm(req: Request, form: FormData, session: Session) {
  const action = text(form, 'action')
  const { payload, user } = session

  if (action === 'login') {
    const next = text(form, 'next') || '/'
    const email = text(form, 'email').toLowerCase()
    const blocked = await gateAuth(req, form, 'login', email, loginFailurePath(next))
    if (blocked) return blocked
    return loginResponse(req, email, text(form, 'password'), next)
  }

  if (action === 'forgot-password') {
    const email = text(form, 'email').toLowerCase()
    const blocked = await gateAuth(req, form, 'forgot', email, '/forgot')
    if (blocked) return blocked
    try {
      if (email) await payload.forgotPassword({ collection: 'users', data: { email } })
    } catch {
      // Same notice either way, so a guesser cannot tell whether the email is on the books.
    }
    return redirectTo(req, '/forgot', undefined, 'If that email has an account, we have sent a reset link.')
  }

  if (action === 'reset-password') {
    const token = text(form, 'token')
    const password = text(form, 'password')
    const blocked = await gateAuth(req, form, 'reset', '', `/reset${token ? `?token=${encodeURIComponent(token)}` : ''}`)
    if (blocked) return blocked
    if (!token || password.length < 8) return redirectTo(req, '/reset', 'Use the link from your email, and at least 8 characters for the password.')
    try {
      await payload.resetPassword({ collection: 'users', data: { token, password }, overrideAccess: true })
    } catch {
      return redirectTo(req, '/reset', 'That reset link is not valid any more. Ask for a new one.')
    }
    return redirectTo(req, '/login', undefined, 'Your password is updated. Sign in with the new one.')
  }

  if (action === 'logout') {
    const next = text(form, 'next')
    const dest = next === '/login' ? '/login' : '/'
    const response = redirectTo(req, dest)
    response.headers.append('Set-Cookie', authCookie(`${payload.config.cookiePrefix}-token`, '', 0))
    return response
  }

  if (action === 'join') {
    const codeValue = text(form, 'code').toUpperCase().replace(/\s+/g, '')
    const name = text(form, 'name')
    const email = text(form, 'email').toLowerCase()
    const password = text(form, 'password')
    if (!name || !email || !password) return redirectTo(req, `/join?code=${encodeURIComponent(codeValue)}`, 'Name, email and a password are all needed.')
    if (password.length < 8) return redirectTo(req, `/join?code=${encodeURIComponent(codeValue)}`, 'Use at least 8 characters for the password.')
    const joinBack = `/join?code=${encodeURIComponent(codeValue)}`
    const blocked = await gateAuth(req, form, 'join', email, joinBack)
    if (blocked) return blocked
    const keys = joinFailKeys(clientIp(req), codeValue)
    if (!peek(keys.pair, JOIN_FAILS_PER_CODE, JOIN_WINDOW_MS).allowed || (keys.address && !peek(keys.address, JOIN_FAILS_PER_IP, JOIN_WINDOW_MS).allowed)) return tooManyJoins()
    const found = await payload.find({
      collection: 'access-codes',
      overrideAccess: true,
      depth: 0,
      limit: 1,
      where: { code: { equals: codeValue } },
    })
    const access = found.docs[0] as
      | { id: number; role?: string; portal?: unknown; packs?: unknown[]; disabled?: boolean; expiresAt?: string | null; maxUses?: number | null; uses?: number | null }
      | undefined
    const refusal = codeRefusal(access, now())
    if (refusal) {
      hit(keys.pair, JOIN_FAILS_PER_CODE, JOIN_WINDOW_MS)
      if (keys.address) hit(keys.address, JOIN_FAILS_PER_IP, JOIN_WINDOW_MS)
      return redirectTo(req, '/join', refusal)
    }
    if (!access) return redirectTo(req, '/join', 'That access code was not recognised.')
    const portal = idOf(access.portal)
    if (!portal) return redirectTo(req, '/join', 'That access code is not attached to a portal.')
    const portalDoc = await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 })
    if ((portalDoc as { closed?: boolean }).closed) return redirectTo(req, '/join', 'This portal is deactivated. Ask the master desk to open it again.')
    const existing = await payload.find({ collection: 'users', overrideAccess: true, limit: 1, where: { email: { equals: email } } })
    if (existing.docs.length) return redirectTo(req, `/login?next=/p/${(portalDoc as { slug?: string }).slug || ''}`, 'That email already has an account. Sign in instead.')
    const slug = (portalDoc as { slug?: string }).slug || ''
    const packIds = (access.packs || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    for (const packId of packIds) await ensurePackAdopted(payload, portal, packId)
    const courseList = await openedCourseIdsForCode(payload, access as { courses?: unknown; packs?: unknown })
    await adoptLibraryCourses(payload, portal, courseList)
    const codeRole = access.role || 'learner'
    const usesBefore = access.uses || 0
    const claimed = await payload.update({
      collection: 'access-codes',
      overrideAccess: true,
      where: { and: [{ id: { equals: access.id } }, usesBefore ? { uses: { equals: usesBefore } } : { or: [{ uses: { equals: 0 } }, { uses: { exists: false } }] }] },
      data: { uses: usesBefore + 1 },
    })
    if (!claimed.docs.length) return redirectTo(req, '/join', 'That access code was just used by someone else. Please try again.')
    let createdId = 0
    try {
      const created = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email,
          password,
          name,
          role: roleFromCode(codeRole),
          audience: codeRole === 'parent' ? 'parent' : codeRole,
          accessCode: access.id,
          courseList,
          tenants: [{ tenant: portal }],
          onboarded: codeRole !== 'learner' && codeRole !== 'parent',
        },
      })
      createdId = created.id
    } catch (error) {
      await payload.update({ collection: 'access-codes', id: access.id, overrideAccess: true, data: { uses: usesBefore } })
      throw error
    }
    const guest = text(form, 'gatherGuest')
    if (guest && createdId) {
      const { claimGuestRsvp } = await import('./gather')
      await claimGuestRsvp(payload, guest, createdId)
    }
    const after = text(form, 'after')
    const gatherNext = after.startsWith(`/p/${slug}/`) ? after : ''
    const shape = (portalDoc as { shape?: string }).shape === 'sequence' ? 'sequence' : 'hearts'
    const next = gatherNext || afterJoinPath(slug, codeRole, shape)
    return loginResponse(req, email, password, next)
  }

  if (!user || !session.actor) return redirectTo(req, '/login', 'Please sign in first.')

  if (session.actor.mustChangePassword && action !== 'change-password' && action !== 'logout') {
    return redirectTo(req, '/change-password', 'Choose a new password before you carry on.')
  }

  if (action === 'change-password') {
    const changed = await changeOwnPassword(payload, session.actor, text(form, 'password'), text(form, 'again'))
    if (changed.error) return redirectTo(req, '/change-password', changed.error)
    return redirectTo(req, text(form, 'next') || (await landingPath(payload, session.actor, '/')), undefined, changed.notice)
  }

  const safety = await handleSafetyAction(action, form, payload, user, req, (path, error, notice) => redirectTo(req, path, error, notice))
  if (safety) return safety

  if (action === 'clock') {
    if (!clockEnabled()) return redirectTo(req, text(form, 'next') || '/', 'The test clock is off.')
    if (session.actor?.role !== 'master') return NextResponse.json({ error: 'The test clock is for the master desk.' }, { status: 403 })
    try {
      const iso = text(form, 'iso')
      setTestNow(iso || null)
      resetLimits()
      return redirectTo(req, text(form, 'next') || '/', undefined, 'Clock moved.')
    } catch (error) {
      return redirectTo(req, text(form, 'next') || '/', error instanceof Error ? error.message : 'Clock refused.')
    }
  }

  if (user.role !== 'master') {
    const mine = portalIdOf(user)
    const home = mine ? await findDoc(payload, 'portals', mine) : null
    if (!home) return redirectTo(req, '/', 'Your account is not in a portal.')
    if (home.closed) return redirectTo(req, '/', 'This portal has been paused by the master desk, so changes cannot be saved at the moment.')
  }

  if (
    action === 'learner-reset' ||
    action === 'learner-move' ||
    action === 'learner-pause' ||
    action === 'learner-unpause' ||
    action === 'learner-remove' ||
    action === 'learner-delete' ||
    action === 'learner-bulk' ||
    action === 'plan-edit' ||
    action === 'plan-delete' ||
    action === 'plan-bulk-delete' ||
    action === 'diary-delete' ||
    action === 'diary-bulk-delete'
  ) {
    const result = await dispatchLearnerDesk(payload, user, form)
    return redirectTo(req, text(form, 'next') || '/', result.error, result.notice)
  }

  if (action === 'desk-delete' || action === 'desk-bulk-delete' || action === 'desk-undo' || action === 'desk-empty-bin') {
    const { runDeskDelete } = await import('./desk-delete')
    const result = await runDeskDelete(payload, user, form)
    return redirectTo(req, text(form, 'next') || '/', result.error, result.notice)
  }

  if (action === 'create-portal') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can open a portal.')
    const name = text(form, 'name')
    const slug = text(form, 'slug').toLowerCase().replace(/\s+/g, '-')
    if (!name || !slug) return redirectTo(req, '/master', 'A portal needs a name and a short address.')
    const slugIssue = slugProblem(slug)
    if (slugIssue) return redirectTo(req, '/master', slugIssue)
    const clash = await payload.find({ collection: 'portals', overrideAccess: true, limit: 1, where: { slug: { equals: slug } } })
    if (clash.docs.length) return redirectTo(req, '/master', 'That address is already in use.')
    const shape = text(form, 'shape') === 'sequence' ? 'sequence' : 'hearts'
    const features = shape === 'sequence'
      ? (form.get('featuresForm') === 'yes' ? sequenceFeaturesFromForm(form) : sequenceFeatureDefaults())
      : (form.get('featuresForm') === 'yes' ? featuresFromForm(form) : defaultFeatures())
    const colourRaw = text(form, 'colour')
    if (colourRaw && !/^#[0-9a-f]{6}$/i.test(colourRaw)) return redirectTo(req, '/master', 'The colour needs to look like #1f3a5f.')
    const accentRaw = text(form, 'accent')
    if (accentRaw && !/^#[0-9a-f]{6}$/i.test(accentRaw)) return redirectTo(req, '/master', 'The accent colour needs to look like #e07a5f.')
    const logoRaw = text(form, 'logoUrl')
    const logo = portalLogo(logoRaw)
    if (logoRaw && !logo) return redirectTo(req, '/master', 'The logo needs to be a path like /icons/hady-home.svg or an https link.')
    const brandName = text(form, 'brandName').slice(0, 80)
    const accent = accentRaw || (shape === 'sequence' ? '#e07a5f' : '')
    const created = await payload.create({
      collection: 'portals',
      overrideAccess: true,
      data: {
        name,
        slug,
        kind: (shape === 'sequence' ? 'other' : ['mosque', 'church', 'synagogue', 'other'].includes(text(form, 'kind')) ? text(form, 'kind') : 'mosque') as 'mosque',
        welcome: text(form, 'welcome') || `${name}. Watch the films here.`,
        colour: colourRaw || (shape === 'sequence' ? '#1f3a5f' : '#1f4d3a'),
        ...PLAIN_LOOK,
        watchHistoryOptIn: false,
        wizardDone: true,
        shape,
        ...(brandName ? { brandName } : {}),
        ...(accent ? { accent } : {}),
        ...(logo ? { logoUrl: logo } : {}),
        ...(shape === 'sequence' ? {
          lockOrder: true,
          minTalkSeconds: 0,
          kineticOn: form.get('kineticField') === 'yes' ? form.get('kinetic') === 'on' : true,
        } : {}),
        ...(features ? { features } : {}),
      },
    })
    const courseIds = form.getAll('course').map((value) => Number(value)).filter(Boolean)
    if (courseIds.length && shape !== 'sequence') await adoptLibraryCourses(payload, created.id, courseIds)
    return redirectTo(req, text(form, 'next') || '/master', undefined, `${name} is open.`)
  }

  if (action === 'portal-features') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can change portal features.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
    const data: Record<string, unknown> = {}
    if (form.has('name') && text(form, 'name')) data.name = text(form, 'name')
    if (form.has('welcome')) data.welcome = text(form, 'welcome')
    if (form.has('kind') && ['mosque', 'church', 'synagogue', 'other'].includes(text(form, 'kind'))) data.kind = text(form, 'kind')
    const stored = await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })
    if (form.get('featuresForm') === 'yes') data.features = isSequencePortal(stored) ? sequenceFeaturesFromForm(form) : featuresFromForm(form)
    if (isSequencePortal(stored) && form.get('kineticField') === 'yes') data.kineticOn = form.get('kinetic') === 'on'
    await payload.update({ collection: 'portals', id: acting.portal.id, overrideAccess: true, data })
    const courseIds = form.getAll('course').map((value) => Number(value)).filter(Boolean)
    if (!isSequencePortal(stored) && (form.has('course') || form.get('featuresForm') === 'yes')) await adoptLibraryCourses(payload, acting.portal.id, courseIds, true)
    return redirectTo(req, text(form, 'next') || `/master/portals/${acting.portal.slug}`, undefined, 'Features saved. They are live now.')
  }

  if (action === 'create-pack') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot make a course pack.')
    const title = text(form, 'title')
    if (!title) return redirectTo(req, text(form, 'next') || '/master', 'Give the course pack a name.')
    const wantsMasterPack = user.role === 'master' && (text(form, 'owner') === 'master' || !text(form, 'portalSlug'))
    let portalId: number | undefined
    if (!wantsMasterPack) {
      const acting = await actingPortal(payload, user, form)
      if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
      portalId = acting.portal.id
    }
    await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: {
        title,
        summary: text(form, 'summary'),
        owner: portalId ? 'portal' : 'master',
        portal: portalId,
        courses: [],
      },
    })
    return redirectTo(req, text(form, 'next') || '/master', undefined, 'Course pack saved.')
  }

  if (action === 'create-code') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot make an access code.')
    const role = text(form, 'role')
    const packId = Number(text(form, 'pack'))
    const courseIds = [...new Set(form.getAll('course').map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))]
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
    const code = text(form, 'code').toUpperCase().replace(/\s+/g, '') || randomCode(acting.portal.slug || '')
    if (!role) return redirectTo(req, text(form, 'next') || '/master', 'Choose who the code is for.')
    if (!['admin', 'teacher', 'learner', 'parent'].includes(role)) return redirectTo(req, text(form, 'next') || '/master', 'Choose who the code is for.')
    if (!/^[A-Z0-9-]{8,32}$/.test(code)) return redirectTo(req, text(form, 'next') || '/master', 'Use 8 to 32 letters, numbers or dashes for the code, or leave it empty for a random one.')
    const maxUsesText = text(form, 'maxUses')
    const maxUses = maxUsesText ? Number(maxUsesText) : null
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000)) return redirectTo(req, text(form, 'next') || '/master', 'Uses must be a whole number from 1 to 10,000, or empty for no limit.')
    const daysText = text(form, 'expiresInDays')
    const days = daysText ? Number(daysText) : null
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 366)) return redirectTo(req, text(form, 'next') || '/master', 'Expiry must be 1 to 366 days, or empty for none.')
    const expiresAt = days ? new Date(now().getTime() + days * 86_400_000).toISOString() : null
    const picking = text(form, 'coursesForm') === 'yes' || courseIds.length > 0
    const portalRow = await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })
    let storedCourses: number[] | undefined
    let storedPacks: number[] | undefined
    if (isSequencePortal(portalRow)) {
      const { sequenceCourseFor } = await import('./sequence-desk')
      const course = await sequenceCourseFor(payload, acting.portal.id)
      if (!course) return redirectTo(req, text(form, 'next') || '/master', 'Add the course films first.')
      storedCourses = [course.id]
      storedPacks = []
    } else if (picking) {
      const opened = await coursesForThisPortal(payload, acting.portal.id, courseIds)
      if ('error' in opened) return redirectTo(req, text(form, 'next') || '/master', opened.error)
      const chosen = [...opened.local, ...opened.master]
      if (role === 'parent' && chosen.length !== 1) return redirectTo(req, text(form, 'next') || '/master', 'A parent code opens one course.')
      await adoptLibraryCourses(payload, acting.portal.id, opened.master)
      storedCourses = chosen
      storedPacks = []
    } else if (packId) {
      if (!(await packUsable(payload, user, acting.portal.id, packId))) return redirectTo(req, text(form, 'next') || '/master', 'That course pack is not available in this portal.')
      await ensurePackAdopted(payload, acting.portal.id, packId)
      if (role === 'parent') {
        const packed = await coursesInPacks(payload, [packId])
        if (packed.length !== 1) return redirectTo(req, text(form, 'next') || '/master', 'A parent code opens one course.')
      }
      storedPacks = [packId]
    } else if (role === 'parent') {
      return redirectTo(req, text(form, 'next') || '/master', 'A parent code opens one course.')
    }
    const linkedId = Number(text(form, 'linkedTeacherCode') || 0)
    if (linkedId) {
      const teacherCode = await findDoc(payload, 'access-codes', linkedId)
      if (!teacherCode || teacherCode.role !== 'teacher' || idOf(teacherCode.portal) !== acting.portal.id) {
        return redirectTo(req, text(form, 'next') || '/master', 'Link the code to a teacher code from this portal.')
      }
    }
    if ((role === 'learner' || role === 'parent') && !text(form, 'linkedTeacherCode')) {
      return redirectTo(req, text(form, 'next') || '/master', 'A learner code needs a teacher code, so someone can see their progress.')
    }
    if (role === 'teacher') {
      const cap = teacherCapOf(portalRow)
      if (cap != null) {
        const teachers = await payload.find({
          collection: 'access-codes',
          overrideAccess: true,
          depth: 0,
          limit: cap + 1,
          where: { and: [{ portal: { equals: acting.portal.id } }, { role: { equals: 'teacher' } }, { disabled: { not_equals: true } }] },
        })
        const refusal = teacherCapRefusal(teachers.docs.length, cap)
        if (refusal) return redirectTo(req, text(form, 'next') || '/master', refusal)
      }
    }
    const clash = await payload.find({ collection: 'access-codes', overrideAccess: true, limit: 1, where: { code: { equals: code } } })
    if (clash.docs.length) return redirectTo(req, text(form, 'next') || '/master', 'That access code is already taken.')
    const linked = text(form, 'linkedTeacherCode')
    const required = form.getAll('requiredCourse').map((value) => Number(value)).filter(Boolean)
    await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code,
        role: role as 'learner',
        ...(storedPacks ? { packs: storedPacks } : {}),
        ...(storedCourses ? { courses: storedCourses } : {}),
        portal: acting.portal.id,
        linkedTeacherCode: linked ? Number(linked) : undefined,
        parentMentorCode: role === 'parent' && linked ? Number(linked) : undefined,
        requiredCourses: required,
        label: text(form, 'label').slice(0, 80) || undefined,
        maxUses,
        expiresAt,
        uses: 0,
        disabled: false,
      },
    })
    const ready = `Access code ${code} is ready.`
    const back = text(form, 'next') || '/master'
    if (text(form, 'quick') === 'yes') {
      const url = new URL(back, 'http://localhost')
      url.searchParams.set('fresh', code)
      return redirectTo(req, `${url.pathname}${url.search}`, undefined, ready)
    }
    return redirectTo(req, back, undefined, ready)
  }

  if (action === 'quick-join-link') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot make an access code.')
    const role = text(form, 'role')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    if (!['admin', 'teacher', 'learner'].includes(role)) return redirectTo(req, text(form, 'next') || '/', 'Choose a teacher, a learner or an admin.')
    const portalRow = await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })
    if (isSequencePortal(portalRow)) {
      const { sequenceCourseFor } = await import('./sequence-desk')
      const course = await sequenceCourseFor(payload, acting.portal.id)
      if (!course) return redirectTo(req, text(form, 'next') || '/', 'Add the course films first.')
      let teacherId = 0
      if (role === 'learner') {
        const teachers = await payload.find({
          collection: 'access-codes',
          overrideAccess: true,
          depth: 0,
          limit: 1,
          where: { and: [{ portal: { equals: acting.portal.id } }, { role: { equals: 'teacher' } }, { disabled: { not_equals: true } }] },
        })
        const existing = teachers.docs[0] as { id: number } | undefined
        if (existing) teacherId = existing.id
        else {
          const cap = teacherCapOf(portalRow)
          if (cap != null) {
            const teacherCount = await payload.find({
              collection: 'access-codes',
              overrideAccess: true,
              depth: 0,
              limit: cap + 1,
              where: { and: [{ portal: { equals: acting.portal.id } }, { role: { equals: 'teacher' } }, { disabled: { not_equals: true } }] },
            })
            const refusal = teacherCapRefusal(teacherCount.docs.length, cap)
            if (refusal) return redirectTo(req, text(form, 'next') || '/', refusal)
          }
          const madeTeacher = await payload.create({
            collection: 'access-codes',
            overrideAccess: true,
            data: { code: randomCode(acting.portal.slug || ''), role: 'teacher', courses: [course.id], packs: [], portal: acting.portal.id, uses: 0, disabled: false, label: 'Teacher' },
          })
          teacherId = madeTeacher.id
        }
      }
      const made = randomCode(acting.portal.slug || '')
      await payload.create({
        collection: 'access-codes',
        overrideAccess: true,
        data: {
          code: made,
          role: role as 'learner',
          courses: [course.id],
          packs: [],
          portal: acting.portal.id,
          linkedTeacherCode: teacherId || undefined,
          label: role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Learner',
          uses: 0,
          disabled: false,
        },
      })
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
      const proto = req.headers.get('x-forwarded-proto') || 'http'
      const link = host ? `${proto}://${host}/join?code=${encodeURIComponent(made)}` : `/join?code=${made}`
      return redirectTo(req, text(form, 'next') || '/', undefined, `New ${role} link: ${link}. Copy, WhatsApp and the QR are on the row below.`)
    }
    const packs = await payload.find({
      collection: 'packs',
      overrideAccess: true,
      depth: 0,
      limit: 80,
      sort: 'title',
      where: { or: [{ and: [{ owner: { equals: 'portal' } }, { portal: { equals: acting.portal.id } }] }, { owner: { equals: 'master' } }] },
    })
    const pack = packs.docs.find((row) => (row as { owner?: string }).owner === 'portal') || packs.docs[0]
    if (!pack) return redirectTo(req, text(form, 'next') || '/', 'Make a course pack first, then the link can be made in one tap.')
    if (!(await packUsable(payload, user, acting.portal.id, pack.id))) return redirectTo(req, text(form, 'next') || '/', 'That course pack is not available in this portal.')
    await ensurePackAdopted(payload, acting.portal.id, pack.id)
    let teacherId = 0
    if (role === 'learner') {
      const teachers = await payload.find({
        collection: 'access-codes',
        overrideAccess: true,
        depth: 0,
        limit: 1,
        where: { and: [{ portal: { equals: acting.portal.id } }, { role: { equals: 'teacher' } }, { disabled: { not_equals: true } }] },
      })
      const existing = teachers.docs[0] as { id: number } | undefined
      if (existing) teacherId = existing.id
      else {
        const full = await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })
        const cap = teacherCapOf(full)
        if (cap != null) {
          const teacherCount = await payload.find({
            collection: 'access-codes',
            overrideAccess: true,
            depth: 0,
            limit: cap + 1,
            where: { and: [{ portal: { equals: acting.portal.id } }, { role: { equals: 'teacher' } }, { disabled: { not_equals: true } }] },
          })
          const refusal = teacherCapRefusal(teacherCount.docs.length, cap)
          if (refusal) return redirectTo(req, text(form, 'next') || '/', refusal)
        }
        const made = await payload.create({
          collection: 'access-codes',
          overrideAccess: true,
          data: { code: randomCode(acting.portal.slug || ''), role: 'teacher', packs: [pack.id], portal: acting.portal.id, uses: 0, disabled: false, label: 'Teacher' },
        })
        teacherId = made.id
      }
    }
    const made = randomCode(acting.portal.slug || '')
    await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code: made,
        role: role as 'learner',
        packs: [pack.id],
        portal: acting.portal.id,
        linkedTeacherCode: teacherId || undefined,
        label: role === 'admin' ? 'Admin' : role === 'teacher' ? 'Teacher' : 'Learner',
        uses: 0,
        disabled: false,
      },
    })
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    const link = host ? `${proto}://${host}/join?code=${encodeURIComponent(made)}` : `/join?code=${made}`
    return redirectTo(req, text(form, 'next') || '/', undefined, `New ${role} link: ${link}. Copy, WhatsApp and the QR are on the row below.`)
  }

  if (action === 'code-switch') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot change an access code.')
    const next = text(form, 'next') || '/master'
    const target = await findDoc(payload, 'access-codes', Number(text(form, 'id')))
    if (!target) return redirectTo(req, next, 'That access code was not found.')
    if (user.role !== 'master' && idOf(target.portal) !== portalIdOf(user)) return redirectTo(req, next, 'That access code belongs to another portal.')
    const disabled = text(form, 'disabled') === 'true'
    await payload.update({ collection: 'access-codes', id: target.id, overrideAccess: true, data: { disabled } })
    return redirectTo(req, next, undefined, disabled ? `Access code ${target.code} is switched off.` : `Access code ${target.code} works again.`)
  }

  if (action === 'create-course') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot build a course.')
    const title = text(form, 'title')
    const next = text(form, 'next') || '/master'
    if (!title) return redirectTo(req, next, 'Give the course a name.')
    const length = parseLengthInput(text(form, 'duration'))
    if (!length.ok) return redirectTo(req, next, length.message)
    const origin = user.role !== 'master' || text(form, 'origin') === 'local' ? 'local' : 'master'
    let portal: number | null = null
    let minSeconds = 300
    if (origin === 'local') {
      const acting = await actingPortal(payload, user, form)
      if ('error' in acting) return redirectTo(req, next, acting.error)
      portal = acting.portal.id
      const full = await payload.findByID({ collection: 'portals', id: portal, depth: 0, overrideAccess: true })
      minSeconds = minTalkSecondsOf(full)
    }
    const shortTalk = minSeconds === 300 ? refusalForTalk(length.seconds) : minTalkRefusal(length.seconds, minSeconds)
    if (shortTalk) return redirectTo(req, next, shortTalk)
    const course = await payload.create({
      collection: 'courses',
      overrideAccess: true,
      data: {
        title,
        summary: text(form, 'summary'),
        speaker: text(form, 'speaker'),
        origin,
        portal: portal || undefined,
        importable: origin === 'master',
        visibility: text(form, 'visibility') === 'draft' ? 'draft' : 'published',
      },
    })
    const unit = await payload.create({
      collection: 'units',
      overrideAccess: true,
      data: { title: text(form, 'unit') || 'Unit 1', course: course.id, order: 1 },
    })
    const lessonTitle = text(form, 'lesson') || title
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title: lessonTitle,
        unit: unit.id,
        course: course.id,
        portal: portal || undefined,
        master: origin === 'master',
        order: 1,
        speaker: text(form, 'speaker'),
        transcriptSource: 'none',
        durationSeconds: length.seconds,
      },
    })
    const onCode = Number(text(form, 'onCode') || 0)
    if (onCode && portal) {
      const linked = await findDoc(payload, 'access-codes', onCode)
      if (linked && idOf(linked.portal) === portal) {
        const opened = await openedCourseIdsForCode(payload, linked as { courses?: unknown; packs?: unknown })
        if (!opened.includes(course.id)) {
          await payload.update({
            collection: 'access-codes',
            id: linked.id,
            overrideAccess: true,
            data: { courses: [...opened, course.id] },
          })
        }
      }
    }
    const packId = Number(text(form, 'pack') || 0)
    if (packId && (await packUsable(payload, user, portal || 0, packId))) {
      const pack = await payload.findByID({ collection: 'packs', id: packId, overrideAccess: true, depth: 0 })
      const existing = ((pack as { courses?: unknown[] }).courses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      await payload.update({
        collection: 'packs',
        id: packId,
        overrideAccess: true,
        data: { courses: [...new Set([...existing, course.id])] },
      })
    }
    return redirectTo(req, next, undefined, 'Course saved.')
  }

  if (action === 'add-lesson') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot add a lesson.')
    const courseId = Number(text(form, 'course'))
    const youtube = text(form, 'youtube')
    let title = text(form, 'title')
    let youtubeId = ''
    let sourceTitle = ''
    if (youtube) {
      youtubeId = youtubeIdFromUrl(youtube) || ''
      if (!youtubeId) return redirectTo(req, text(form, 'next') || '/', 'That does not look like a YouTube link. Paste a watch, share or youtu.be link, or type a title.')
      if (!title) {
        const meta = await fetchYoutubeMeta(youtubeId)
        title = String(meta?.title || '').trim()
        sourceTitle = title
        if (!title) return redirectTo(req, text(form, 'next') || '/', 'YouTube did not give a title for that film. Type a title and try again.')
      }
    }
    if (!courseId || !title) return redirectTo(req, text(form, 'next') || '/', 'Type a title, or paste a YouTube link and leave the title blank.')
    const courseDoc = await findDoc(payload, 'courses', courseId)
    const denied = editError(user, courseDoc)
    if (denied) return redirectTo(req, text(form, 'next') || '/', denied)
    const units = await payload.find({ collection: 'units', overrideAccess: true, limit: 1, where: { course: { equals: courseId } }, sort: 'order' })
    const unit = units.docs[0]
    if (!unit) return redirectTo(req, text(form, 'next') || '/', 'That course has no unit yet.')
    const course = await payload.findByID({ collection: 'courses', id: courseId, overrideAccess: true, depth: 0 })
    const count = await payload.count({ collection: 'lessons', overrideAccess: true, where: { course: { equals: courseId } } })
    await payload.create({
      collection: 'lessons',
      overrideAccess: true,
      data: {
        title,
        unit: unit.id,
        course: courseId,
        portal: idOf((course as { portal?: unknown }).portal) || undefined,
        master: (course as { origin?: string }).origin === 'master',
        order: count.totalDocs + 1,
        speaker: (course as { speaker?: string }).speaker,
        transcriptSource: 'none',
        ...(youtubeId ? { youtubeId, videoProvider: 'youtube' as const, sourceUrl: youtube.slice(0, 500), ...(sourceTitle ? { sourceTitle } : {}) } : {}),
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Lesson added.')
  }

  if (action === 'adopt') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot adopt into this portal.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const portalRow = await payload.findByID({ collection: 'portals', id: portal, depth: 0, overrideAccess: true })
    if (isSequencePortal(portalRow)) return redirectTo(req, text(form, 'next') || '/', 'This course keeps its own films.')
    const kind = text(form, 'kind') === 'course' ? 'course' : 'pack'
    if (kind === 'course') {
      const course = await findDoc(payload, 'courses', Number(text(form, 'course')))
      if (!course || course.origin !== 'master') return redirectTo(req, text(form, 'next') || '/', 'Only library courses can be adopted.')
      if (!course.importable) return redirectTo(req, text(form, 'next') || '/', 'That course is not available to add.')
    } else {
      const pack = await findDoc(payload, 'packs', Number(text(form, 'pack')))
      if (!pack || pack.owner !== 'master') return redirectTo(req, text(form, 'next') || '/', 'Only library packs can be adopted.')
    }
    const target: Where = kind === 'pack' ? { pack: { equals: Number(text(form, 'pack')) } } : { course: { equals: Number(text(form, 'course')) } }
    const twice = await payload.find({ collection: 'adoptions', overrideAccess: true, limit: 1, where: { and: [{ portal: { equals: portal } }, target] } })
    if (twice.docs.length) return redirectTo(req, text(form, 'next') || '/', undefined, 'That is already linked in this portal.')
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: {
        kind,
        portal,
        pack: kind === 'pack' ? Number(text(form, 'pack')) : undefined,
        course: kind === 'course' ? Number(text(form, 'course')) : undefined,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, kind === 'pack' ? 'Pack adopted. It stays linked to the master.' : 'Course adopted. It stays linked to the master.')
  }

  if (action === 'split-pack') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot split a pack.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const portalRow = await payload.findByID({ collection: 'portals', id: portal, depth: 0, overrideAccess: true })
    if (isSequencePortal(portalRow)) return redirectTo(req, text(form, 'next') || '/', 'This course keeps its own films.')
    const title = text(form, 'title')
    const courseIds = form.getAll('course').map((value) => Number(value)).filter(Boolean)
    if (!title || !courseIds.length) return redirectTo(req, text(form, 'next') || '/', 'Name the new pack and tick at least one course.')
    const library = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: 0, pagination: false, where: { and: [{ origin: { equals: 'master' } }, { importable: { not_equals: false } }] } })
    const allowed = new Set(user.role === 'master' ? courseIds : [...(await visibleCourseIds(payload, user)), ...library.docs.map((course) => course.id)])
    if (courseIds.some((id) => !allowed.has(id))) return redirectTo(req, text(form, 'next') || '/', 'One of those courses is not in this portal or the library.')
    const pack = await payload.create({
      collection: 'packs',
      overrideAccess: true,
      data: { title, owner: 'portal', portal, courses: courseIds, summary: 'Chosen from the library.' },
    })
    await payload.create({
      collection: 'adoptions',
      overrideAccess: true,
      data: { kind: 'pack', portal, pack: pack.id },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, `${title} is ready with ${plural(courseIds.length, 'course')}. Only the courses you ticked came across.`)
  }

  if (action === 'ingest') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot bring in a film.')
    const lessonId = Number(text(form, 'lesson'))
    const next = text(form, 'next') || '/'
    if (!(await findDoc(payload, 'lessons', lessonId))) return redirectTo(req, next, 'That lesson could not be found.')
    const owned = await courseOfLesson(payload, lessonId)
    const denied = editError(user, owned.course as Doc | null)
    if (denied) return redirectTo(req, next, denied)
    const lines = splitBringInLines(text(form, 'url'))
    if (!lines.length) return redirectTo(req, next, 'Paste a YouTube link first.')
    const asked = form.getAll('fetchTranscript').map(String)
    const wantTranscript = asked.length === 0 || asked.includes('yes')
    const lang = captionLang(text(form, 'captionLang'))
    const retry = text(form, 'retry') === 'yes'
    const replaceFilm = text(form, 'replaceFilm') === 'yes'
    const course = owned.course as { id: number; title?: string | null; speaker?: string | null; origin?: string; portal?: unknown }
    const homeId = idOf(course.portal)
    if (homeId) {
      const home = await payload.findByID({ collection: 'portals', id: homeId, depth: 0, overrideAccess: true }).catch(() => null)
      if (isSequencePortal(home)) return redirectTo(req, next, 'Add films from Course films.')
    }
    const lessonSpeaker = (owned.lesson as { speaker?: string | null }).speaker
    const lockKey = `bringin:${course.id}:${lines.map((line) => line.link).sort().join('\n')}`
    return withWorkLock(lockKey, async () => {
      const open = (await findDoc(payload, 'lessons', lessonId)) as { youtubeId?: string | null; vimeoId?: string | null; videoProvider?: string | null; transcriptNote?: string | null } | null
      if (!open) return redirectTo(req, next, 'That lesson could not be found.')
      const openHasFilm = Boolean(open.youtubeId || open.vimeoId || open.videoProvider === 'file')
      const units = await payload.find({ collection: 'units', overrideAccess: true, limit: 1, sort: 'order', where: { course: { equals: course.id } } })
      const unit = units.docs[0]
      let orderBase = (await payload.count({ collection: 'lessons', overrideAccess: true, where: { course: { equals: course.id } } })).totalDocs
      const outcomes: string[] = []
      let clipsSetAside = 0
      let saved = 0
      let failed = 0
      let waiting = 0
      let skipped = 0
      let drafts = 0
      let keptPublished = 0
      let refused = 0
      const openPublish = (open as { publishState?: string | null }).publishState
      const fillOpen = retry || (replaceFilm && openHasFilm) || !openHasFilm
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index]
        const url = line.link
        const speaker = speakerForBringIn({ lineSpeaker: line.speaker, courseSpeaker: course.speaker, lessonSpeaker, retry })
        const useOpen = index === 0 && fillOpen
        let parsedUrl: URL | null = null
        try {
          parsedUrl = new URL(url)
        } catch {
          parsedUrl = null
        }
        const previewId = youtubeIdFromUrl(url)
        if (!previewId) {
          const sameLine = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 1, where: { and: [{ course: { equals: course.id } }, { sourceUrl: { equals: url.slice(0, 500) } }] } })
          const prior = sameLine.docs[0] as { id: number } | undefined
          if (prior && !(useOpen && prior.id === lessonId)) {
            outcomes.push('That line is already on this course, so it was not added again.')
            skipped++
            continue
          }
        }
        if (previewId) {
          const existing = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 1, where: { youtubeId: { equals: previewId } } })
          const found = existing.docs[0] as { id: number; title?: string | null } | undefined
          if (found && found.id !== lessonId) {
            outcomes.push(`Already in the library (${found.title || previewId}). That film was not added again.`)
            skipped++
            continue
          }
          if (found && found.id === lessonId && !useOpen) {
            outcomes.push('That film is already this part. It was not added again.')
            skipped++
            continue
          }
        }
        const wasDraft = openPublish === 'draft'
        const keepPublished = useOpen && !wasDraft && (retry || (replaceFilm && openHasFilm))
        const makingDraft = !keepPublished && !(useOpen && wasDraft)
        const draftPatch = makingDraft ? { publishState: 'draft' as const } : {}
        if (makingDraft) drafts++
        if (keepPublished) keptPublished++
        let targetId = lessonId
        if (!useOpen) {
          if (!unit) {
            outcomes.push('This course has no unit yet, so the extra links were not added.')
            failed += lines.length - index
            break
          }
          orderBase += 1
          const created = await payload.create({
            collection: 'lessons',
            overrideAccess: true,
            data: {
              title: `Film ${orderBase}`,
              unit: unit.id,
              course: course.id,
              portal: idOf(course.portal) || undefined,
              master: course.origin === 'master',
              order: orderBase,
              ...(speaker ? { speaker } : {}),
              transcriptSource: 'none',
              transcriptNote: bringInNote('processing', 'Waiting for YouTube.', lang),
              publishState: 'draft',
            },
          })
          targetId = created.id
        } else if (replaceFilm && openHasFilm && index === 0) {
          const oldCuts = await payload.find({ collection: 'cuts', overrideAccess: true, limit: 200, where: { lesson: { equals: targetId } } })
          for (const cut of oldCuts.docs) {
            if ((cut as { status?: string }).status !== 'rejected') {
              await payload.update({ collection: 'cuts', id: cut.id, overrideAccess: true, data: { status: 'rejected' } })
              clipsSetAside += 1
            }
          }
          const oldLadder = await payload.find({ collection: 'ladder-items', overrideAccess: true, limit: 200, where: { lesson: { equals: targetId } } })
          for (const item of oldLadder.docs) {
            if ((item as { status?: string }).status !== 'rejected') {
              await payload.update({ collection: 'ladder-items', id: item.id, overrideAccess: true, data: { status: 'rejected' } })
              clipsSetAside += 1
            }
          }
        }
        if (useOpen) {
          await payload.update({
            collection: 'lessons',
            id: targetId,
            overrideAccess: true,
            data: { transcriptNote: bringInNote('processing', 'Waiting for YouTube.', lang), ...draftPatch },
          })
        }
        if (!parsedUrl || !/^https?:$/.test(parsedUrl.protocol)) {
          const reason = 'That is not a web link. Paste a link that starts with https://'
          await payload.update({
            collection: 'lessons',
            id: targetId,
            overrideAccess: true,
            data: { sourceUrl: url.slice(0, 500), transcriptNote: bringInNote('failed', reason, lang), ...draftPatch },
          })
          outcomes.push(reason)
          failed++
          continue
        }
        const result = await ingestYoutubeUrl(url, wantTranscript ? { lang } : { lang, providers: [] })
        if (!result.ok && !result.id && !/youtu\.?be/i.test(parsedUrl.hostname)) {
          await payload.update({
            collection: 'lessons',
            id: targetId,
            overrideAccess: true,
            data: {
              sourceUrl: url,
              transcriptNote: bringInNote('failed', SHARE_LINK_DETAIL, lang),
              // The empty part stays hidden by the failed note. Do not also turn a published local talk into a draft:
              // uploading the transcript is what makes this part visible.
              ...(makingDraft ? { publishState: 'published' as const } : {}),
            },
          })
          outcomes.push('A share link was saved without a film file.')
          failed++
          continue
        }
        if (!result.id) {
          const reason = result.ok ? 'That link had no film id.' : result.error
          await payload.update({
            collection: 'lessons',
            id: targetId,
            overrideAccess: true,
            data: { sourceUrl: url, transcriptNote: bringInNote('failed', reason, lang), ...draftPatch },
          })
          outcomes.push(reason)
          failed++
          continue
        }
        const meta = result.meta
        const duration = result.durationSeconds && result.durationSeconds > 0 ? Math.round(result.durationSeconds) : 0
        const talkSeconds = sourceTalkSeconds({ durationSeconds: duration || null, transcript: result.ok ? result.transcript : null })
        const refusal = refusalForTalk(talkSeconds)
        if (refusal) {
          if (!useOpen) await payload.delete({ collection: 'lessons', id: targetId, overrideAccess: true }).catch(() => undefined)
          else {
            await payload.update({
              collection: 'lessons',
              id: targetId,
              overrideAccess: true,
              data: {
                transcriptNote: open.transcriptNote || null,
                ...(makingDraft ? { publishState: wasDraft ? 'draft' : 'published' } : {}),
              },
            })
          }
          if (makingDraft) drafts = Math.max(0, drafts - 1)
          if (keepPublished) keptPublished = Math.max(0, keptPublished - 1)
          outcomes.push(refusal)
          refused++
          continue
        }
        const filmOnly = !wantTranscript
        const unavailable = isUnavailableFilm({ title: meta?.title, error: result.ok ? '' : result.error }) || (!result.ok && result.captionOutcome === 'unavailable')
        const outcome = result.ok ? 'captions' : result.captionOutcome
        const waitingForTranscript = !filmOnly && !unavailable && (outcome === 'blocked' || outcome === 'failed' || outcome === 'missing')
        const noCaptions = !filmOnly && !unavailable && outcome === 'none'
        let note = bringInNote('failed', result.ok ? 'Captions fetched.' : result.error, lang)
        let source: 'none' | 'youtube' | 'pending' = 'none'
        let transcript: string | undefined
        if (unavailable) {
          note = bringInNote('failed', result.ok ? 'This film is not available.' : result.error || 'This film is not available.', lang)
        } else if (result.ok) {
          const stored = cleanedTimedTranscript(result.transcript)
          transcript = stored.cleaned
          source = 'youtube'
          note = bringInNote('processed', `Captions fetched by ${result.provider}.`, lang)
          if (stored.raw !== stored.cleaned && stored.raw.length <= 450_000) {
            const media = await payload.create({
              collection: 'media',
              overrideAccess: true,
              data: { alt: `Raw captions ${result.id}`, purpose: 'portal-asset' } as never,
              file: {
                data: Buffer.from(stored.raw),
                mimetype: 'text/vtt',
                name: `${result.id}-raw.vtt`,
                size: Buffer.byteLength(stored.raw),
              },
            }).catch(() => null)
            if (media && typeof (media as { id?: number }).id === 'number') {
              await payload.create({
                collection: 'resources',
                overrideAccess: true,
                data: { lesson: targetId, name: 'Raw captions', kind: 'transcript', file: (media as { id: number }).id },
              }).catch(() => undefined)
            }
          }
        } else if (filmOnly) {
          source = 'pending'
          note = bringInNote('waiting', CAPTION_QUEUE_DETAIL, lang)
        } else if (waitingForTranscript) {
          source = 'pending'
          note = bringInNote('waiting', result.error, lang)
        } else if (noCaptions) {
          source = 'pending'
          note = bringInNote('waiting', result.error, lang)
        }
        await payload.update({
          collection: 'lessons',
          id: targetId,
          overrideAccess: true,
          data: {
            youtubeId: result.id,
            youtubeUrl: `https://www.youtube.com/watch?v=${result.id}`,
            ...(meta && !text(form, 'keepTitle') ? { title: meta.title } : {}),
            ...(speaker ? { speaker } : {}),
            ...(duration > 0 ? { durationSeconds: duration } : {}),
            ...(transcript ? { transcript, transcriptSource: source } : filmOnly || waitingForTranscript || noCaptions ? { transcriptSource: 'pending' as const } : replaceFilm ? { transcript: '', transcriptSource: 'none' as const } : {}),
            transcriptNote: note,
            ...draftPatch,
          },
        })
        if (unavailable) {
          failed++
          outcomes.push(result.ok ? 'This film is not available.' : result.error)
        } else if (result.ok) saved++
        else if (filmOnly || waitingForTranscript || noCaptions) {
          waiting++
          outcomes.push(filmOnly ? CAPTION_QUEUE_DETAIL : result.error)
        } else {
          failed++
          outcomes.push(result.error)
        }
      }
      const shortMessages = [...new Set(outcomes.filter((line) => line.includes('Talks need to be at least 5 minutes.')))]
      if (!saved && !waiting && !skipped && !failed && shortMessages.length) return redirectTo(req, next, shortMessages.join(' '))
      if (!saved && !waiting && failed && !skipped) return redirectTo(req, next, outcomes[0] || 'Those films could not be brought in.')
      return redirectTo(req, next, undefined, [bringInFlash({ saved, waiting, failed, skipped, clipsSetAside, drafts, retry, keptPublished }), shortMessages.join(' ')].filter(Boolean).join(' '))
    })
  }

  if (action === 'preview-bring-in' || action === 'bring-in-ready' || action === 'commit-bring-in' || action === 'publish-talks' || action === 'save-channel-speaker' || action === 'delete-channel-speaker' || action === 'create-helper-token' || action === 'revoke-helper-token') {
    if (!user) return redirectTo(req, '/login', 'Please sign in first.')
    const next = text(form, 'next') || '/master/bring-in'
    const result = action === 'preview-bring-in'
      ? await previewBringIn(payload, user, form)
      : action === 'bring-in-ready'
        ? await bringInAndPublish(payload, user, form)
        : action === 'commit-bring-in'
        ? await commitBringIn(payload, user, form)
        : action === 'publish-talks'
          ? await publishTalks(payload, user, form)
          : action === 'save-channel-speaker'
            ? await saveChannelSpeaker(payload, user, form)
            : action === 'delete-channel-speaker'
              ? await deleteChannelSpeaker(payload, user, form)
              : action === 'create-helper-token'
                ? await createHelperToken(payload, user, form)
                : await revokeHelperToken(payload, user, form)
    if ('error' in result && result.error) return redirectTo(req, next, result.error)
    const previewId = 'previewId' in result ? result.previewId : 0
    const lessons = 'lessons' in result && Array.isArray(result.lessons) ? result.lessons.join(',') : ''
    const url = new URL(next, 'http://localhost')
    if (previewId) url.searchParams.set('preview', String(previewId))
    if (lessons) url.searchParams.set('lessons', lessons)
    const notice = 'notice' in result && typeof result.notice === 'string' ? result.notice : ''
    if (notice) url.searchParams.set('notice', notice)
    const response = redirectTo(req, `${url.pathname}${url.search}`)
    const secret = 'secret' in result && typeof result.secret === 'string' ? result.secret : ''
    if (secret) {
      response.cookies.set('hearts_helper_once', secret, { httpOnly: true, maxAge: 120, path: '/', sameSite: 'lax' })
    }
    return response
  }

  if (action === 'see-how-replace' || action === 'see-how-reset') {
    const next = safeNext(text(form, 'next') || '/master/see-how')
    if (!user || user.role !== 'master') return redirectTo(req, next, 'Only the master desk can change a See how clip.')
    const pageId = text(form, 'page')
    if (action === 'see-how-reset' && text(form, 'sure') !== 'yes') return redirectTo(req, next, 'Tick Yes, delete it. Nothing was deleted.')
    const result = action === 'see-how-reset'
      ? await resetSeeHowClip(payload, pageId)
      : await replaceSeeHowClip(payload, pageId, form.get('file') instanceof File ? (form.get('file') as File) : new File([], ''))
    return redirectTo(req, next, result.error, result.notice)
  }

  if (action === 'upload-transcript') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot upload a transcript.')
    const file = form.get('file')
    const next = text(form, 'next') || '/'
    if (!(file instanceof File) || file.size === 0) return redirectTo(req, next, 'Choose a .vtt, .srt or .txt transcript.')
    if (tooBig(file)) return redirectTo(req, next, 'That file is over 200 MB. Compress it, or upload a transcript instead.')
    if (!(await findDoc(payload, 'lessons', Number(text(form, 'lesson'))))) return redirectTo(req, next, 'That lesson could not be found.')
    const owned = await courseOfLesson(payload, Number(text(form, 'lesson')))
    const denied = editError(user, owned.course as Doc | null)
    if (denied) return redirectTo(req, next, denied)
    if (file.size > 5 * 1024 * 1024) return redirectTo(req, next, 'A transcript should be under 5 MB. That file looks like a video or audio file.')
    const name = file.name.toLowerCase()
    if (!name.endsWith('.vtt') && !name.endsWith('.srt') && !name.endsWith('.txt') && !name.endsWith('.md')) {
      return redirectTo(req, next, 'Use a .vtt, .srt or .txt file.')
    }
    const transcript = await file.text()
    if (!transcript.trim()) return redirectTo(req, next, 'That file was empty.')
    const previousNote = (owned.lesson as { transcriptNote?: string }).transcriptNote
    const uploadedLength = sourceTalkSeconds({
      durationSeconds: Number((owned.lesson as { durationSeconds?: number }).durationSeconds) || null,
      transcript,
    })
    const uploadedRefusal = refusalForTalk(uploadedLength)
    if (uploadedRefusal) return redirectTo(req, next, uploadedRefusal)
    const attached = noteAfterTranscriptUpload(previousNote, file.name, (owned.lesson as { publishState?: string | null }).publishState)
    await payload.update({
      collection: 'lessons',
      id: Number(text(form, 'lesson')),
      overrideAccess: true,
      data: {
        transcript,
        transcriptSource: 'upload',
        transcriptNote: attached.transcriptNote,
      },
    })
    const settled = await settleAutoPublish(payload, Number(text(form, 'lesson')), previousNote)
    return redirectTo(req, next, undefined, settled.published ? 'Captions are in. Learners who already have this course can see this talk.' : attached.notice)
  }

  if (action === 'upload-transcript-file' || action === 'fetch-talk-captions' || action === 'save-transcript' || action === 'undo-transcript' || action === 'redo-transcript') {
    if (!user || user.role !== 'master') return redirectTo(req, '/', 'Only the master desk edits transcripts.')
    const result = await runTranscriptAction(payload, action, form)
    const next = result.next || text(form, 'next') || '/master/transcripts'
    if (result.error) return redirectTo(req, next, result.error)
    return redirectTo(req, next, undefined, result.notice)
  }

  if (action === 'attach-transcript') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can attach a waiting transcript.')
    const next = text(form, 'next') || '/master/transcripts'
    const lessonId = Number(text(form, 'lesson'))
    const lesson = await findDoc(payload, 'lessons', lessonId)
    if (!lesson) return redirectTo(req, next, 'That talk could not be found.')
    if (bringInStatus((lesson as { transcriptNote?: string }).transcriptNote) === 'failed') {
      return redirectTo(req, next, 'This film does not play, so a transcript does not show it to learners.')
    }
    if (!isAwaitingTranscript((lesson as { transcriptNote?: string }).transcriptNote) && text(form, 'force') !== 'yes') {
      return redirectTo(req, next, 'That talk is not waiting for a transcript.')
    }
    const previousNote = (lesson as { transcriptNote?: string }).transcriptNote
    const file = form.get('file')
    const pasted = text(form, 'transcript')
    const raw = file instanceof File && file.size ? await file.text() : pasted
    if (!raw.trim()) return redirectTo(req, next, 'Paste a timed transcript, or choose a file.')
    const stored = cleanedTimedTranscript(raw)
    const attachedLength = sourceTalkSeconds({
      durationSeconds: Number((lesson as { durationSeconds?: number }).durationSeconds) || null,
      transcript: stored.cleaned || raw,
    })
    const attachedRefusal = refusalForTalk(attachedLength)
    if (attachedRefusal) return redirectTo(req, next, attachedRefusal)
    await payload.update({
      collection: 'lessons',
      id: lessonId,
      overrideAccess: true,
      data: {
        transcript: stored.cleaned,
        transcriptSource: 'upload',
        transcriptNote: bringInNote('processed', 'A timed transcript was attached while this server was waiting.', captionLang(text(form, 'captionLang'))),
      },
    })
    const settled = await settleAutoPublish(payload, lessonId, previousNote)
    const draft = !settled.published && (lesson as { publishState?: string | null }).publishState === 'draft'
    return redirectTo(req, next, undefined, settled.published
      ? 'The timed transcript is attached. Learners who already have this course can see this talk.'
      : draft
        ? 'The timed transcript is attached. This talk is still a draft, so learners cannot see it until you publish it.'
        : 'The timed transcript is attached. Learners who already have this course can see this talk.')
  }

  if (action === 'extract') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot run the extractor.')
    const lessonId = Number(text(form, 'lesson'))
    const next = text(form, 'next') || '/'
    if (!(await findDoc(payload, 'lessons', lessonId))) return redirectTo(req, next, 'That lesson could not be found.')
    const owned = await courseOfLesson(payload, lessonId)
    const denied = editError(user, owned.course as Doc | null)
    if (denied) return redirectTo(req, next, denied)
    const lesson = owned.lesson
    const transcript = (lesson as { transcript?: string }).transcript || ''
    if (!transcript.trim()) return redirectTo(req, next, 'This lesson has no transcript yet. Paste a YouTube link that has captions, or upload a .vtt, .srt or .txt file.')
    const portalForAi = user.role === 'portal-admin' ? idOf((owned.course as { portal?: unknown } | null)?.portal) : null
    const gate = portalAiGate({ role: user.role, realRole: session.actor?.role, usePortalAi: text(form, 'usePortalAi') === 'yes', confirmed: text(form, 'confirmAi') === 'yes' })
    if (gate.error) return redirectTo(req, next, gate.error)
    const client = gate.spend ? await clientForPortal(payload, portalForAi, user.role, session.actor?.role || user.role) : null
    const result = await extractWithFallback(transcript, await clauseCards(payload), { client })
    const old = await payload.find({ collection: 'cuts', overrideAccess: true, limit: 200, where: { lesson: { equals: lessonId } } })
    const keptCuts = rowsKeptOnExtract(old.docs as { id: number; status?: string | null; start?: number | null; end?: number | null }[])
    for (const cut of keptCuts.drop) await payload.delete({ collection: 'cuts', id: cut.id, overrideAccess: true })
    const oldLadder = await payload.find({ collection: 'ladder-items', overrideAccess: true, limit: 200, where: { lesson: { equals: lessonId } } })
    const keptLadder = rowsKeptOnExtract(oldLadder.docs as { id: number; status?: string | null; start?: number | null; end?: number | null }[])
    for (const item of keptLadder.drop) await payload.delete({ collection: 'ladder-items', id: item.id, overrideAccess: true })
    const clauseByNumber = new Map((await clauseCards(payload)).map((card) => [card.number, card]))
    const clauses = await payload.find({ collection: 'clauses', overrideAccess: true, limit: 50 })
    const clauseId = new Map(clauses.docs.map((doc) => [(doc as { number?: number }).number, doc.id]))
    const spanOf = (row: { start?: number | null; end?: number | null }) => ({ start: Number(row.start || 0), end: Number(row.end || 0) })
    const freshCuts = draftsSkippingApproved(result.cuts, keptCuts.keep.map(spanOf))
    const freshLadder = draftsSkippingApproved(result.ladder, keptLadder.keep.map(spanOf))
    for (const cut of freshCuts) {
      const saved = await payload.create({
        collection: 'cuts',
        overrideAccess: true,
        data: {
          lesson: lessonId,
          course: idOf((lesson as { course?: unknown }).course) || undefined,
          status: 'draft',
          start: Math.round(cut.start),
          end: Math.round(cut.end),
          timestamp: cut.timestamp,
          hook: cut.hook,
          turn: cut.turn,
          land: cut.land,
          fullContext: cut.fullContext,
          theme: cut.theme,
          device: cut.device,
          whyItAllures: cut.whyItAllures,
          bestClause: cut.bestClause,
          clauseFragment: cut.clauseFragment,
          hangStrength: cut.hangStrength,
          whyHang: cut.whyHang,
          seatHint: cut.seatHint,
          stage2Form: cut.stage2Form,
          currencyNote: cut.currencyNote,
          quoteConfidence: cut.quoteConfidence,
          exemplarAffinity: cut.exemplarAffinity,
          kind: cut.kind,
          engine: result.engine,
        },
      })
      if (cut.bestClause && clauseId.get(cut.bestClause)) {
        await payload.create({
          collection: 'tags',
          overrideAccess: true,
          data: {
            item: { relationTo: 'cuts', value: saved.id },
            clause: clauseId.get(cut.bestClause),
            state: 'suggested',
            note: cut.whyHang,
          },
        })
      }
          }
    for (const item of freshLadder) {
      await payload.create({
        collection: 'ladder-items',
        overrideAccess: true,
        data: {
          lesson: lessonId,
          kind: item.kind,
          start: Math.round(item.start),
          end: Math.round(item.end),
          quote: item.quote,
          status: 'draft',
        },
      })
    }
    const engineNote = result.engine === 'llm' ? 'by this portal’s AI account' : 'by the built-in extractor'
    const keptApproved = keptCuts.keep.length
    const keptNote = keptApproved ? ` ${keptApproved} approved clip${keptApproved === 1 ? ' was' : 's were'} kept.` : ''
    const skippedDupes = result.cuts.length - freshCuts.length
    const dupeNote = skippedDupes ? ` ${skippedDupes} new clip${skippedDupes === 1 ? '' : 's'} matched an approved one and ${skippedDupes === 1 ? 'was' : 'were'} not added again.` : ''
    const pauseNote = result.notes.find((note) => /no full stops/i.test(note))
    const paidNote = result.notes.find((note) => /portal AI call failed|portal AI account|built-in extractor was used|Deterministic extractor used/i.test(note))
    const emptyNote = freshCuts.length === 0 ? result.notes.find((note) => /No clips were found/.test(note)) : ''
    const extra = [pauseNote, paidNote].filter(Boolean).join(' ')
    const message = emptyNote
      ? `${emptyNote}${keptNote}${dupeNote}${extra ? ` ${extra}` : ''}`
      : `${freshCuts.length} cuts and ${freshLadder.length} short clips drafted ${engineNote}.${keptNote}${dupeNote}${extra ? ` ${extra}` : ''} Review them below.`
    return redirectTo(req, next, undefined, message)
  }

  if (action === 'cut-status') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot review cuts.')
    const cut = await findDoc(payload, 'cuts', Number(text(form, 'cut')))
    if (!cut) return redirectTo(req, text(form, 'next') || '/', 'That cut could not be found.')
    const courseId = idOf(cut.course)
    const course = courseId ? await findDoc(payload, 'courses', courseId) : null
    const denied = editError(user, course)
    if (denied) return redirectTo(req, text(form, 'next') || '/', denied)
    const status = (['draft', 'approved', 'rejected'].includes(text(form, 'status')) ? text(form, 'status') : cut.status) as 'draft' | 'approved' | 'rejected'
    const clauseNumber = Number(text(form, 'clause') || 0)
    const seatId = Number(text(form, 'seat') || 0)
    let clauseDocId: number | undefined
    if (clauseNumber) {
      const found = await payload.find({ collection: 'clauses', overrideAccess: true, limit: 1, where: { number: { equals: clauseNumber } } })
      clauseDocId = found.docs[0]?.id as number | undefined
      if (!clauseDocId) return redirectTo(req, text(form, 'next') || '/', 'Choose a line that sits on one of the 20 doors.')
    }
    if (seatId) {
      const seat = await findDoc(payload, 'seats', seatId)
      if (!seat) return redirectTo(req, text(form, 'next') || '/', 'That seat could not be found.')
    }
    await payload.update({
      collection: 'cuts',
      id: cut.id,
      overrideAccess: true,
      data: {
        status,
        ...(clauseNumber ? { bestClause: clauseNumber } : {}),
        ...(seatId ? { seat: seatId } : {}),
      },
    })
    if (status !== cut.status) {
      const ladder = await payload.find({ collection: 'ladder-items', overrideAccess: true, limit: 20, where: { and: [{ lesson: { equals: idOf(cut.lesson) } }, { start: { greater_than_equal: Number(cut.start) } }, { end: { less_than_equal: Number(cut.end) + 1 } }] } })
      for (const item of ladder.docs) {
        if ((item as { status?: string }).status === 'draft' || status !== 'approved') {
          await payload.update({ collection: 'ladder-items', id: item.id, overrideAccess: true, data: { status } })
        }
      }
    }
    if (clauseDocId) {
      const tags = await payload.find({ collection: 'tags', overrideAccess: true, limit: 20, where: { and: [{ 'item.value': { equals: cut.id } }, { 'item.relationTo': { equals: 'cuts' } }] } })
      if (tags.docs.length) {
        for (const tag of tags.docs) await payload.update({ collection: 'tags', id: tag.id, overrideAccess: true, data: { clause: clauseDocId, seat: seatId || undefined, state: 'confirmed' } })
      } else {
        await payload.create({ collection: 'tags', overrideAccess: true, data: { item: { relationTo: 'cuts', value: cut.id }, clause: clauseDocId, seat: seatId || undefined, state: 'confirmed', note: 'Chosen by an admin.' } })
      }
    }
    if (text(form, 'confirm') === 'yes') {
      const cutId = Number(text(form, 'cut'))
      const tags = await payload.find({
        collection: 'tags',
        overrideAccess: true,
        limit: 20,
        where: { and: [{ 'item.value': { equals: cutId } }, { 'item.relationTo': { equals: 'cuts' } }] },
      })
      for (const tag of tags.docs) {
        await payload.update({ collection: 'tags', id: tag.id, overrideAccess: true, data: { state: 'confirmed' } })
      }
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, status === 'approved' ? 'Cut approved. Learners can now see it in their feed.' : status === 'rejected' ? 'Cut set aside.' : 'Cut saved.')
  }

  if (action === 'framing-override') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can override framing.')
    const cut = await findDoc(payload, 'cuts', Number(text(form, 'cut')))
    if (!cut) return redirectTo(req, text(form, 'next') || '/', 'That clip could not be found.')
    const lesson = await findDoc(payload, 'lessons', idOf(cut.lesson) || 0)
    const youtubeId = String(lesson?.youtubeId || '')
    if (!youtubeId) return redirectTo(req, text(form, 'next') || '/', 'That clip has no YouTube id.')
    const { isFramingMode } = await import('@/lib/framing/validate')
    const { trackForClip } = await import('@/lib/framing/store')
    const { fallbackTrack, parseTrack } = await import('@/lib/framing/validate')
    const { applyFramingOverride } = await import('@/lib/framing/learner')
    const mode = text(form, 'mode')
    if (!isFramingMode(mode)) return redirectTo(req, text(form, 'next') || '/', 'Mode must be A, B, C, D, E or F.')
    const index = Number(text(form, 'index'))
    const existing = parseTrack(cut.framingTrack) || trackForClip(youtubeId, Number(cut.start), Number(cut.end), lesson?.framingTrack) || fallbackTrack(youtubeId, Number(cut.start), Number(cut.end))
    const saved = applyFramingOverride(existing, index, mode)
    if (!saved.ok) return redirectTo(req, text(form, 'next') || '/', saved.error)
    await payload.update({ collection: 'cuts', id: cut.id, overrideAccess: true, data: { framingTrack: saved.track } as never })
    return redirectTo(req, text(form, 'next') || '/', undefined, saved.notice)
  }

  if (action === 'ladder-status') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot review clips.')
    const item = await findDoc(payload, 'ladder-items', Number(text(form, 'item')))
    if (!item) return redirectTo(req, text(form, 'next') || '/', 'That clip could not be found.')
    const owned = await courseOfLesson(payload, idOf(item.lesson) || 0)
    const denied = editError(user, owned.course as Doc | null)
    if (denied) return redirectTo(req, text(form, 'next') || '/', denied)
    const status = text(form, 'status') === 'approved' ? 'approved' : text(form, 'status') === 'rejected' ? 'rejected' : 'draft'
    await payload.update({ collection: 'ladder-items', id: item.id, overrideAccess: true, data: { status } })
    return redirectTo(req, text(form, 'next') || '/', undefined, status === 'approved' ? 'Clip approved for the feed.' : status === 'rejected' ? 'Clip set aside.' : 'Clip moved back to draft.')
  }

  if (action === 'create-point') {
    if (user.role === 'learner') return redirectTo(req, '/', 'You cannot place a question.')
    const prompt = text(form, 'prompt')
    const next = text(form, 'next') || '/'
    if (!prompt) return redirectTo(req, next, 'Write the question first.')
    const lessonId = Number(text(form, 'lesson'))
    if (!(await findDoc(payload, 'lessons', lessonId))) return redirectTo(req, next, 'That film could not be found.')
    const owned = await courseOfLesson(payload, lessonId)
    const course = owned.course as { id: number; origin?: string; portal?: unknown } | null
    const second = Number(text(form, 'second') || 0)
    if (!Number.isFinite(second) || second < 0) return redirectTo(req, next, 'The second needs to be 0 or more.')
    const kind = ['reflection', 'question', 'multiple_choice', 'task'].includes(text(form, 'kind')) ? text(form, 'kind') : 'reflection'
    if (kind === 'multiple_choice' && text(form, 'options').split('\n').filter((line) => line.trim()).length < 2) {
      return redirectTo(req, next, 'A multiple choice question needs at least two answers, one per line.')
    }
    const delayUnit = ['second', 'minute', 'hour', 'day', 'week'].includes(text(form, 'delayUnit')) ? text(form, 'delayUnit') : 'week'
    if (user.role !== 'master') {
      const portal = portalIdOf(user)
      const localHere = course?.origin === 'local' && idOf(course.portal) === portal
      const adopted = portal ? await adoptedCourseIds(payload, portal) : []
      const libraryHere = course?.origin === 'master' && adopted.includes(course.id)
      if (!localHere && !libraryHere) return redirectTo(req, next, 'That film is not in your portal.')
    }
    const audience = text(form, 'audience') || 'everyone'
    const selected = form.getAll('learner').map((value) => Number(value)).filter(Boolean)
    if (audience === 'selected' && !selected.length) return redirectTo(req, next, 'Choose at least one learner, or keep the question to yourself.')
    const options = text(form, 'options')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const onLibrary = course?.origin === 'master' && user.role !== 'master'
    await payload.create({
      collection: 'engagement-points',
      overrideAccess: true,
      data: {
        lesson: lessonId,
        second: Math.round(second),
        kind: kind as 'reflection',
        prompt,
        options: options.length ? options : undefined,
        timing: onLibrary ? 'immediate' : text(form, 'timing') === 'future' ? 'future' : 'immediate',
        delayAmount: onLibrary ? 0 : Number(text(form, 'delayAmount') || 0),
        delayUnit: delayUnit as 'week',
        contingent: onLibrary ? undefined : text(form, 'contingent') ? Number(text(form, 'contingent')) : undefined,
        link: text(form, 'link') || undefined,
        timeLimit: text(form, 'timeLimit') ? Number(text(form, 'timeLimit')) : undefined,
        author: user.id,
        audience: audience === 'self' || audience === 'selected' ? audience : 'everyone',
        audienceUsers: audience === 'selected' ? selected : undefined,
      },
    })
    return redirectTo(req, next, undefined, 'Question placed on the timeline.')
  }

  if (action === 'answer') {
    const limited = hitAnswer(user.id, clientIp(req))
    if (!limited.allowed) return tooManyAnswers(limited.retryAfterSec, false)
    const result = await saveAnswer(payload, user, {
      pointId: Number(text(form, 'point')),
      body: text(form, 'body'),
      choice: text(form, 'choice'),
      image: form.get('image'),
      video: form.get('video'),
      audio: form.get('audio'),
      keepPrivate: form.get('keepPrivate') === 'on',
      shareWithTeacher: form.get('shareWithTeacher') === 'on',
      shareWithLearners: form.get('shareWithLearners') === 'on',
      viewingId: text(form, 'viewingId') || undefined,
      atSecond: text(form, 'atSecond') ? Number(text(form, 'atSecond')) : undefined,
    })
    if (!result.ok) return redirectTo(req, result.status === 400 || result.status === 409 ? text(form, 'next') || '/' : '/', result.error)
    if (result.updated) return redirectTo(req, text(form, 'next') || '/', undefined, 'Your answer is updated in your workbook.')
    return redirectTo(req, text(form, 'next') || '/', undefined, answerSavedMessage(result))
  }

  if (action === 'placing') {
    const portal = portalIdOf(user)
    const portalRow = portal ? await payload.findByID({ collection: 'portals', id: portal, overrideAccess: true, depth: 0 }) : null
    const sequence = isSequencePortal(portalRow)
    const questions = await payload.find({
      collection: 'placing-questions',
      overrideAccess: true,
      limit: 20,
      sort: 'order',
      where: sequence ? { portal: { equals: portal } } : { or: [{ portal: { exists: false } }, { portal: { equals: portal } }] },
    })
    const answers: { options: unknown; choice: string }[] = []
    for (const question of questions.docs as { id: number; options?: unknown }[]) {
      const choice = text(form, `q-${question.id}`)
      if (!choice) return redirectTo(req, text(form, 'next') || '/', 'Please choose an answer for each question. One is still empty.')
      answers.push({ options: question.options, choice })
    }
    const old = await payload.find({ collection: 'placing-answers', overrideAccess: true, limit: 50, where: { user: { equals: user.id } } })
    for (const row of old.docs) await payload.delete({ collection: 'placing-answers', id: row.id, overrideAccess: true })
    for (const [index, question] of questions.docs.entries()) {
      await payload.create({ collection: 'placing-answers', overrideAccess: true, data: { user: user.id, question: question.id, choice: answers[index].choice, portal: portal || undefined } })
    }
    const doors = await loadDoors(payload)
    const starting = sequence ? null : startingClause(answers, doors)
    const startDoor = starting ? doorOfClause(starting, doors) : null
    const learner = user.role === 'learner'
    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: sequence
        ? { onboarded: true, seenWelcome: true }
        : learner ? { startingClause: starting } : { onboarded: true, startingClause: starting },
    })
    if (sequence) return redirectTo(req, text(form, 'next') || '/', undefined, 'Thank you. Your first film is ready.')
    return redirectTo(req, text(form, 'next') || '/', undefined, startDoor ? `Thank you. We have chosen a first sitting for you, starting from door ${startDoor.number}: ${startDoor.title}.` : 'Thank you. We have chosen a first sitting for you.')
  }

  if (action === 'schedule') {
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    if (refuseFeature(await loadPortalById(payload, acting.portal.id), 'planner')) {
      return redirectTo(req, text(form, 'next') || '/', FEATURE_UNAVAILABLE)
    }
    const portal = acting.portal.id
    const targetType: 'course' | 'pack' = text(form, 'targetType') === 'pack' ? 'pack' : 'course'
    let courseIds: number[] = []
    if (targetType === 'pack') {
      const pack = await findDoc(payload, 'packs', Number(text(form, 'pack')))
      if (!pack) return redirectTo(req, text(form, 'next') || '/', 'Choose a course pack.')
      courseIds = ((pack.courses as unknown[]) || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    } else {
      courseIds = [Number(text(form, 'course'))].filter(Boolean)
    }
    if (!courseIds.length) return redirectTo(req, text(form, 'next') || '/', 'Choose a course to plan.')
    const visible = new Set(await visibleCourseIds(payload, user))
    if (courseIds.some((id) => !visible.has(id))) return redirectTo(req, text(form, 'next') || '/', 'That course is not in your portal.')
    const lessons = await orderedLessons(payload, courseIds)
    if (!lessons.length) return redirectTo(req, text(form, 'next') || '/', 'There are no lessons to split yet.')
    const courseTitle = targetType === 'course' ? String((await findDoc(payload, 'courses', courseIds[0]))?.title || '') : ''
    const name = text(form, 'name').slice(0, 80) || defaultPlanName(now())
    let dates: string[]
    const weekdays = form.getAll('weekday').map((value) => Number(value))
    try {
      dates = studyDates(text(form, 'start'), text(form, 'end'), weekdays)
    } catch (error) {
      return redirectTo(req, text(form, 'next') || '/', error instanceof Error ? error.message : 'Those dates did not work.')
    }
    const minutesRaw = text(form, 'minutes')
    const minutes = minutesRaw ? minutesADay(minutesRaw) : 20
    if (!minutes) return redirectTo(req, text(form, 'next') || '/', 'Choose 10, 20, 30 or 45 minutes a day.')
    const planned = planAcrossDays(lessons.map((lesson) => ({
      id: lesson.id,
      title: partTitle(lesson, courseTitle),
      courseId: idOf(lesson.course),
    })), dates)
    const slots = flattenSlots(planned.slots)
    const learnerIds = [...new Set(form.getAll('learner').map((value) => Number(value)).filter(Boolean))]
    if (learnerIds.length && user.role === 'learner') return redirectTo(req, text(form, 'next') || '/', 'You can plan your own days. A teacher plans for others.')
    if (learnerIds.length) {
      const people = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: learnerIds.length, where: { id: { in: learnerIds } } })
      if (people.docs.length !== learnerIds.length || people.docs.some((person) => portalIdOf(person as SessionUser) !== portal)) {
        return redirectTo(req, text(form, 'next') || '/', 'One of those learners is not in this portal.')
      }
    }
    const startDate = text(form, 'start') || slots[0]?.date || dates[0]
    const endDate = text(form, 'end') || slots[slots.length - 1]?.date || dates[dates.length - 1]
    const targets = learnerIds.length ? learnerIds : [user.id]
    const staff = user.role === 'teacher' || user.role === 'portal-admin' || user.role === 'master'
    const existing = await payload.find({ collection: 'schedules', overrideAccess: true, depth: 0, limit: 200, where: { portal: { equals: portal } } })
    const ownerIds = [...new Set(existing.docs.map((row) => idOf(row.owner)).filter((id): id is number => Boolean(id)))]
    const owners = ownerIds.length ? await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: ownerIds.length, where: { id: { in: ownerIds } } }) : { docs: [] as { id: number; role?: string }[] }
    const ownerRole = (id: number | null) => owners.docs.find((person) => person.id === id)?.role
    const ownerIsStaff = (id: number | null) => {
      const role = ownerRole(id)
      return role === 'teacher' || role === 'portal-admin' || role === 'master'
    }
    const matchesCourse = (plan: { course?: unknown; pack?: unknown; owner?: unknown; learners?: unknown }) => {
      const courseMatch = targetType === 'course' ? idOf(plan.course) === courseIds[0] : idOf(plan.pack) === Number(text(form, 'pack'))
      return Boolean(courseMatch)
    }
    const covers = (plan: { owner?: unknown; learners?: unknown }, learnerId: number) => {
      const learners = (plan.learners as unknown[]) || []
      return idOf(plan.owner) === learnerId || learners.some((item) => idOf(item) === learnerId)
    }
    const usedDates = [...new Set(slots.map((slot) => slot.date).filter(Boolean))]
    const keepForm = (path: string) => planKeepPath(path, {
      course: courseIds[0],
      start: text(form, 'start'),
      end: text(form, 'end'),
      weekdays,
      minutes,
      learners: learnerIds,
    })
    for (const learnerId of targets) {
      const matching = existing.docs.filter((plan) => matchesCourse(plan) && covers(plan, learnerId))
      const teacherPlan = matching.find((plan) => ownerIsStaff(idOf(plan.owner)) && idOf(plan.owner) !== learnerId)
      const selfPlan = matching.find((plan) => !teacherPlan || plan.id !== teacherPlan.id)
      if (!staff && teacherPlan) return redirectTo(req, keepForm(text(form, 'next') || '/'), 'Your teacher has set this plan. You can still watch at your own pace.')
      if (staff && teacherPlan && idOf(teacherPlan.owner) !== user.id) return redirectTo(req, keepForm(text(form, 'next') || '/'), 'This plan has been made by another teacher.')
      const data = {
        name,
        owner: user.id,
        learners: [learnerId],
        targetType,
        course: targetType === 'course' ? courseIds[0] : undefined,
        pack: targetType === 'pack' ? Number(text(form, 'pack')) : undefined,
        startDate,
        endDate,
        weekdays,
        slots,
        minutesPerDay: minutes,
        portal,
      }
      const keep = staff ? teacherPlan || selfPlan : selfPlan
      if (keep) await payload.update({ collection: 'schedules', id: keep.id, overrideAccess: true, data })
      else await payload.create({ collection: 'schedules', overrideAccess: true, data })
      for (const extra of matching) {
        if (keep && extra.id === keep.id) continue
        if (staff || idOf(extra.owner) === user.id) await payload.delete({ collection: 'schedules', id: extra.id, overrideAccess: true })
      }
      if (staff && learnerId !== user.id) {
        await notify(payload, { user: learnerId, portal, title: 'A study plan was made for you', body: planNotify(slots.length, usedDates), href: `/p/${acting.portal.slug}/week` })
      }
    }
    void recordExperimentQuietly(payload, user, 'plan_created', { name })
    void recordFunnelQuietly(payload, user, 'study_plan_saved')
    const toast = planToast(slots.length, usedDates)
    return redirectTo(req, planKeepPath(text(form, 'next') || '/', { course: courseIds[0], start: text(form, 'start'), end: text(form, 'end'), weekdays, minutes }), undefined, toast)
  }

  if (action === 'rsvp' || action === 'checkin') {
    const portal = portalIdOf(user)
    const eventId = Number(text(form, 'event'))
    const event = await findDoc(payload, 'events', eventId)
    if (!event || (user.role !== 'master' && idOf(event.portal) !== portal)) return redirectTo(req, '/', 'That night is not in your portal.')
    if (refuseFeature(await loadPortalById(payload, idOf(event.portal) || portal || 0), 'gather')) {
      return redirectTo(req, text(form, 'next') || '/', FEATURE_UNAVAILABLE)
    }
    const eventPortal = idOf(event.portal)
    if (action === 'rsvp') {
      const existing = await payload.find({
        collection: 'rsvps',
        overrideAccess: true,
        limit: 1,
        where: { and: [{ event: { equals: eventId } }, { user: { equals: user.id } }] },
      })
      if (existing.docs.length) return redirectTo(req, text(form, 'next') || '/', undefined, 'You already have a place for this night.')
      const weekAgo = new Date(now().getTime() - 7 * 86_400_000).toISOString()
      const recent = await payload.count({ collection: 'completions', overrideAccess: true, where: { and: [{ user: { equals: user.id } }, { createdAt: { greater_than: weekAgo } }] } })
      const ticketKind = recent.totalDocs > 0 ? 'earned' : 'held'
      const ticket = `${String(event.title || 'NIGHT').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'NGHT'}-${randomUUID().slice(0, 6).toUpperCase()}`
      await payload.create({ collection: 'rsvps', overrideAccess: true, data: { event: eventId, user: user.id, status: 'going', ticket, ticketKind, portal: eventPortal || undefined } })
      return redirectTo(
        req,
        text(form, 'next') || '/',
        undefined,
        ticketKind === 'earned'
          ? `You have a place. Your ticket is ${ticket}. Show it at the door.`
          : `You have a place. Your ticket is ${ticket}. The teacher will welcome you in at the door.`,
      )
    }
    const staff = user.role !== 'learner'
    const learnerId = staff ? Number(text(form, 'learner') || 0) : user.id
    if (!learnerId) return redirectTo(req, text(form, 'next') || '/', 'Choose who is arriving.')
    const learner = await findDoc(payload, 'users', learnerId)
    if (!learner || portalIdOf(learner as SessionUser) !== eventPortal) return redirectTo(req, text(form, 'next') || '/', 'That person is not in this portal.')
    const rsvp = await payload.find({ collection: 'rsvps', overrideAccess: true, limit: 1, where: { and: [{ event: { equals: eventId } }, { user: { equals: learnerId } }] } })
    const ticket = rsvp.docs[0] as { ticketKind?: string } | undefined
    const override = staff && form.get('override') === 'on'
    if (!staff && form.get('override') === 'on') return redirectTo(req, text(form, 'next') || '/', 'Only a teacher or admin can let someone in without a ticket.')
    if (!ticket && !override) return redirectTo(req, text(form, 'next') || '/', staff ? 'They have no ticket yet. Tick "Let them in anyway" to welcome them.' : 'Please reserve a place first.')
    if (!staff && ticket?.ticketKind !== 'earned') return redirectTo(req, text(form, 'next') || '/', 'Your place is held. A teacher will check you in at the door.')
    const already = await payload.find({ collection: 'checkins', overrideAccess: true, limit: 1, where: { and: [{ event: { equals: eventId } }, { user: { equals: learnerId } }] } })
    if (already.docs.length) return redirectTo(req, text(form, 'next') || '/', undefined, 'Already checked in.')
    await payload.create({
      collection: 'checkins',
      overrideAccess: true,
      data: { event: eventId, user: learnerId, override, byStaff: staff ? user.id : undefined, portal: eventPortal || undefined },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, override ? 'Welcomed in by a teacher.' : 'Checked in. Welcome.')
  }

  if (action === 'board') {
    const written = text(form, 'body').slice(0, 2000)
    const portal = portalIdOf(user)
    if (!written) return redirectTo(req, text(form, 'next') || '/', 'Write a note for the board.')
    const body = text(form, 'prefix') ? `A question for ${text(form, 'prefix').slice(0, 80)}: ${written}` : written
    await payload.create({ collection: 'messages', overrideAccess: true, data: { body, author: user.id, portal: portal || undefined } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Posted to the board.')
  }

  if (action === 'reply' || action === 'reply-done') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners do not reply on this desk.')
    const doneOnly = action === 'reply-done'
    const reply = text(form, 'reply')
    if (!doneOnly && !reply) return redirectTo(req, text(form, 'next') || '/', 'Write a reply first.')
    let entry = await findDoc(payload, 'workbook-entries', Number(text(form, 'entry')))
    if (!entry) {
      const answerId = Number(text(form, 'answer'))
      if (answerId) {
        const found = await payload.find({ collection: 'workbook-entries', overrideAccess: true, depth: 0, limit: 1, where: { answer: { equals: answerId } } })
        entry = (found.docs[0] as unknown as Doc) || null
      }
    }
    if (!entry) return redirectTo(req, text(form, 'next') || '/', 'That workbook entry could not be found.')
    if (user.role !== 'master' && idOf(entry.portal) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That workbook is not in your portal.')
    }
    if (!entry.consent) return redirectTo(req, text(form, 'next') || '/', 'The learner has kept this entry to themselves, so it cannot be replied to.')
    if (refuseFeature(await loadPortalById(payload, idOf(entry.portal) || portalIdOf(user) || 0), 'feedback')) {
      return redirectTo(req, text(form, 'next') || '/', FEATURE_UNAVAILABLE)
    }
    const when = now().toISOString()
    await payload.update({
      collection: 'workbook-entries',
      id: entry.id,
      overrideAccess: true,
      data: doneOnly ? { doneAt: when } : { teacherReply: reply, repliedAt: when, doneAt: null },
    })
    const learnerId = idOf((entry as { user?: unknown }).user)
    if (!doneOnly && learnerId) {
      const portal = idOf((entry as { portal?: unknown }).portal)
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: portal || undefined,
          title: 'Your teacher replied',
          body: reply,
          href: text(form, 'href') || '/',
          channel: 'in-app' as const,
        },
      })
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: portal || undefined,
          title: 'Email not sent',
          body: "Reply sent. They'll see it in their workbook.",
          href: text(form, 'href') || '/',
          channel: 'email-stub' as const,
        },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, doneOnly ? 'Marked done.' : 'Reply saved.')
  }

  if (action === 'browse') {
    const result = await recordShortBrowse(payload, user, {
      level: text(form, 'level'),
      event: text(form, 'event'),
      lessonId: Number(text(form, 'lesson')),
      speaker: text(form, 'speaker'),
      speakerSlug: text(form, 'speakerSlug'),
      start: Number(text(form, 'start') || 0),
      end: Number(text(form, 'end') || 0),
      parent: text(form, 'parent'),
    })
    const asJson = (req.headers.get('accept') || '').includes('application/json')
    if (!result.ok) {
      if (asJson) return NextResponse.json({ error: result.error, counted: false }, { status: result.status })
      return redirectTo(req, text(form, 'next') || '/', result.error)
    }
    if (asJson) return NextResponse.json(result)
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Kept with the speakers you are drawn to.')
  }

  if (action === 'watch') {
    const lessonId = Number(text(form, 'lesson'))
    const seconds = Number(text(form, 'seconds') || 0)
    const portal = portalIdOf(user)
    const lesson = await findDoc(payload, 'lessons', lessonId)
    const asJson = (req.headers.get('accept') || '').includes('application/json')
    if (!lesson || !(await visibleCourseIds(payload, user)).includes(idOf(lesson.course) || 0)) {
      if (asJson) return NextResponse.json({ error: 'That film is not in your portal.', counted: false }, { status: 403 })
      return redirectTo(req, text(form, 'next') || '/', 'That film is not in your portal.')
    }
    const duration = Number((lesson as { durationSeconds?: number }).durationSeconds || 0)
    const position = Number(text(form, 'at') || 0)
    const { recordPersonalWatch } = await import('./missions')
    await recordPersonalWatch(payload, {
      userId: user.id,
      lessonId,
      seconds: duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.min(Math.max(0, seconds), 3600),
      portalId: portal,
      position,
    })
    if (asJson) return NextResponse.json({ ok: true, counted: false })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Kept with the time you have given.')
  }

  if (action === 'complete') {
    const asJson = (req.headers.get('accept') || '').includes('application/json')
    const fail = (message: string, status = 400) => (asJson ? NextResponse.json({ error: message, counted: false }, { status }) : redirectTo(req, text(form, 'next') || '/', message))
    const lessonId = Number(text(form, 'lesson'))
    if (!countsTowardProgress({ level: pieceLevel(text(form, 'level') || 'talk'), inCourse: true, event: 'watch' })) {
      return fail('A short clip does not finish a talk.')
    }
    const portal = portalIdOf(user)
    const lesson = await findDoc(payload, 'lessons', lessonId)
    if (!lesson || !(await visibleCourseIds(payload, user)).includes(idOf(lesson.course) || 0)) return fail('That film is not in your portal.', 403)
    const duration = Number((lesson as { durationSeconds?: number }).durationSeconds || 0)
    const seconds = Number(text(form, 'seconds') || 0)
    const media = Number(text(form, 'media') || 0)
    const { recordPersonalWatch } = await import('./missions')
    if (seconds > 0) {
      await recordPersonalWatch(payload, { userId: user.id, lessonId, seconds: duration > 0 ? Math.min(seconds, duration) : Math.min(seconds, 3600), portalId: portal })
    }
    const verdict = completionVerdict({ duration, watched: seconds, ended: text(form, 'ended') === 'yes', media })
    if (!verdict.counts) return fail(verdict.reason)
    const percent = verdict.percent
    let onTime = false
    if (portal) {
      const plans = await payload.find({
        collection: 'schedules',
        overrideAccess: true,
        depth: 0,
        limit: 20,
        where: { and: [{ portal: { equals: portal } }, { learners: { contains: user.id } }] },
      })
      const today = now().toISOString().slice(0, 10)
      const dates: string[] = []
      for (const plan of plans.docs as { slots?: { date?: string; lessonId?: number }[] }[]) {
        for (const slot of plan.slots || []) {
          if (slot.lessonId === lessonId && slot.date) dates.push(String(slot.date))
        }
      }
      onTime = finishedBySchedule(dates, today)
    }
    const existing = await payload.find({
      collection: 'completions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }] },
    })
    if (!existing.docs.length) {
      await payload.create({
        collection: 'completions',
        overrideAccess: true,
        data: { user: user.id, lesson: lessonId, portal: portal || undefined, percent, onTime, sourceLevel: 'talk' },
      })
    }
    const transcript = (lesson as { transcript?: string }).transcript || ''
    if (transcript) {
      const already = await payload.find({
        collection: 'harvest-entries',
        overrideAccess: true,
        limit: 1,
        where: { and: [{ user: { equals: user.id } }, { lesson: { equals: lessonId } }, { or: [{ surface: { exists: false } }, { surface: { equals: 'talk' } }] }] },
      })
      if (!already.docs.length) {
        const place = await placeOfLesson(payload, lessonId)
        await giveHarvest(payload, user.id, lessonId, transcript, portal || undefined, { speaker: place?.speaker || undefined, door: place?.door || undefined, surface: 'talk', gatheredAt: now().toISOString() })
      }
    }
    void recordExperimentQuietly(payload, user, 'full_talk_complete', { lesson: lessonId, seconds })
    if (asJson) return NextResponse.json({ ok: true, counted: true })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Marked as watched. You will see it in your courses.')
  }

  if (action === 'seat') {
    const seatId = Number(text(form, 'seat'))
    const portal = portalIdOf(user)
    if (!(await findDoc(payload, 'seats', seatId))) return redirectTo(req, text(form, 'next') || '/', 'That seat could not be found.')
    const existing = await payload.find({
      collection: 'seat-visits',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ user: { equals: user.id } }, { seat: { equals: seatId } }] },
    })
    if (!existing.docs.length) {
      await payload.create({ collection: 'seat-visits', overrideAccess: true, data: { user: user.id, seat: seatId, returned: false, portal: portal || undefined } })
    } else if (text(form, 'returned') === 'yes') {
      await payload.update({ collection: 'seat-visits', id: existing.docs[0].id, overrideAccess: true, data: { returned: true } })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Noted in your courses.')
  }

  if (action === 'ritual') {
    const note = text(form, 'note').slice(0, 280)
    if (!note) return redirectTo(req, text(form, 'next') || '/', 'Write the small act first, then keep it.')
    await payload.create({
      collection: 'rituals',
      overrideAccess: true,
      data: { user: user.id, note, portal: portalIdOf(user) || undefined },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Thank you. That is noted in your courses.')
  }

  if (action === 'ai-connect') {
    const next = text(form, 'next') || '/'
    const signedIn = session.actor?.role || user?.role
    if (!user || signedIn === 'master' || user.role !== 'portal-admin') return redirectTo(req, next, 'Only a portal admin can connect this portal’s AI account. The master desk does not spend.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, next, acting.error)
    if (text(form, 'kind') === 'mcp') return redirectTo(req, next, mcpConnectorStatus().note)
    if (text(form, 'clear') === 'yes') {
      await payload.update({ collection: 'portals', id: acting.portal.id, overrideAccess: true, data: { aiConnection: null } })
      return redirectTo(req, next, undefined, 'This portal’s AI account is disconnected. Desk tools use the built-in path.')
    }
    const current = (await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })) as { aiConnection?: unknown }
    const existing = parseStored(current.aiConnection)
    let apiKey = text(form, 'apiKey')
    if (!apiKey && existing) {
      try {
        apiKey = openPortalKey(existing.keyCipher)
      } catch {
        apiKey = ''
      }
    }
    const built = assembleConnection({ baseUrl: text(form, 'baseUrl') || existing?.baseUrl || '', model: text(form, 'model') || existing?.model || '', apiKey })
    if (!built.ok) return redirectTo(req, next, built.error)
    await payload.update({ collection: 'portals', id: acting.portal.id, overrideAccess: true, data: { aiConnection: built.stored } })
    return redirectTo(req, next, undefined, 'This portal’s AI account is connected. The key is stored encrypted and is not shown again. A run is billed to that account, not to HEARTS.')
  }

  if (action === 'sequence-features') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, text(form, 'next') || '/', 'Only a portal admin can change the course.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const stored = await payload.findByID({ collection: 'portals', id: acting.portal.id, depth: 0, overrideAccess: true })
    if (!isSequencePortal(stored)) return redirectTo(req, text(form, 'next') || '/', 'This portal does not use a sequenced course.')
    await payload.update({
      collection: 'portals',
      id: acting.portal.id,
      overrideAccess: true,
      data: { features: sequenceFeaturesFromForm(form), kineticOn: form.get('kinetic') === 'on' },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Features saved.')
  }

  if (action === 'portal-sheet' || action === 'portal-answers' || action === 'portal-callout') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, text(form, 'next') || '/', 'Only a portal admin can bring films into this portal.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    if (action === 'portal-sheet') {
      const { importPortalSheet } = await import('./sequence-desk')
      let raw = ''
      const sheet = form.get('sheet')
      if (sheet instanceof File && sheet.size > 0) {
        if (sheet.size > 2_000_000) return redirectTo(req, text(form, 'next') || '/', 'That sheet is too big. Split it into a smaller file.')
        raw = await sheet.text()
      }
      const result = await importPortalSheet(payload, acting.portal.id, raw, text(form, 'courseTitle')) as { error?: string; notice?: string }
      return redirectTo(req, text(form, 'next') || '/', result.error, result.notice)
    }
    if (action === 'portal-answers') {
      const course = await findDoc(payload, 'courses', Number(text(form, 'course')))
      const row = course as { origin?: string; portal?: unknown; id: number } | null
      if (!row || row.origin !== 'local' || idOf(row.portal) !== acting.portal.id) return redirectTo(req, text(form, 'next') || '/', 'Those answers belong on a course in this portal.')
      const file = form.get('answers')
      if (!(file instanceof File) || file.size <= 0) return redirectTo(req, text(form, 'next') || '/', 'Choose an answers sheet.')
      if (file.size > 2_000_000) return redirectTo(req, text(form, 'next') || '/', 'That sheet is too big. Split it into a smaller file.')
      const parsed = parseSaidSheet(await file.text())
      if (parsed.error) return redirectTo(req, text(form, 'next') || '/', parsed.error)
      const rows = form.get('gaps') === 'on' ? fillSampleGaps(parsed.rows) : parsed.rows
      await payload.update({ collection: 'courses', id: row.id, overrideAccess: true, data: { sampleAnswers: rows } as never })
      return redirectTo(req, text(form, 'next') || '/', undefined, `${rows.length} answers saved on this course.`)
    }
    const pointId = Number(text(form, 'point'))
    const prompt = text(form, 'prompt').slice(0, 2000)
    if (!prompt) return redirectTo(req, text(form, 'next') || '/', 'Write the question.')
    const point = await findDoc(payload, 'engagement-points', pointId)
    const lessonId = idOf(point?.lesson)
    if (!point || !lessonId) return redirectTo(req, text(form, 'next') || '/', 'That question could not be found.')
    const { course } = await courseOfLesson(payload, lessonId)
    const owned = course as { origin?: string; portal?: unknown } | null
    if (!owned || owned.origin !== 'local' || idOf(owned.portal) !== acting.portal.id) return redirectTo(req, text(form, 'next') || '/', 'That question is not on a film in this portal.')
    await payload.update({ collection: 'engagement-points', id: pointId, overrideAccess: true, data: { prompt } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Question saved on this film.')
  }

  if (action === 'teacher-group-code') {
    if (user.role !== 'teacher') return redirectTo(req, text(form, 'next') || '/', 'A teacher makes the code for their own group.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const teacherCode = await findDoc(payload, 'access-codes', idOf(user.accessCode) || 0)
    if (!teacherCode || teacherCode.role !== 'teacher' || idOf(teacherCode.portal) !== acting.portal.id) {
      return redirectTo(req, text(form, 'next') || '/', 'Your teacher code could not be found in this portal.')
    }
    const courseIds = await openedCourseIdsForCode(payload, teacherCode as { courses?: unknown; packs?: unknown })
    if (!courseIds.length) return redirectTo(req, text(form, 'next') || '/', 'Your teacher code has no courses yet. Ask the portal admin to add one.')
    const code = text(form, 'code').toUpperCase().replace(/\s+/g, '') || randomCode(acting.portal.slug || '')
    if (!/^[A-Z0-9-]{8,32}$/.test(code)) return redirectTo(req, text(form, 'next') || '/', 'Use 8 to 32 letters, numbers or dashes for the code, or leave it empty for a random one.')
    const clash = await payload.find({ collection: 'access-codes', overrideAccess: true, limit: 1, where: { code: { equals: code } } })
    if (clash.docs.length) return redirectTo(req, text(form, 'next') || '/', 'That access code is already taken.')
    const opened = await coursesForThisPortal(payload, acting.portal.id, courseIds)
    if ('error' in opened) return redirectTo(req, text(form, 'next') || '/', opened.error)
    await adoptLibraryCourses(payload, acting.portal.id, opened.master)
    await payload.create({
      collection: 'access-codes',
      overrideAccess: true,
      data: {
        code,
        role: 'learner',
        courses: [...opened.local, ...opened.master],
        packs: [],
        portal: acting.portal.id,
        linkedTeacherCode: teacherCode.id,
        label: 'Group',
        uses: 0,
        disabled: false,
      },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, `Group code ${code} is ready.`)
  }

  if (action === 'sequence-import' || action === 'sequence-order' || action === 'sequence-settings') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, text(form, 'next') || '/', 'Only a portal admin can change the course.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const { saveSequenceImport, saveSequenceOrder, saveSequenceSettings } = await import('./sequence-desk')
    type DeskResult = { error?: string; notice?: string }
    if (action === 'sequence-import') {
      let raw = text(form, 'links')
      const sheet = form.get('sheet')
      if (sheet instanceof File && sheet.size > 0) {
        if (sheet.size > 2_000_000) return redirectTo(req, text(form, 'next') || '/', 'That sheet is too big. Split it into a smaller file.')
        raw = `${raw}\n${await sheet.text()}`
      }
      const result = await saveSequenceImport(payload, acting.portal.id, raw) as DeskResult
      return redirectTo(req, text(form, 'next') || '/', result.error, result.notice)
    }
    if (action === 'sequence-order') {
      const orderIds = text(form, 'order').split(',').map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0)
      const titles = new Map<number, string>()
      for (const [key, value] of form.entries()) {
        if (typeof key === 'string' && key.startsWith('title:') && typeof value === 'string') titles.set(Number(key.slice(6)), value)
      }
      const result = await saveSequenceOrder(payload, acting.portal.id, orderIds, titles) as DeskResult
      return redirectTo(req, text(form, 'next') || '/', result.error, result.notice)
    }
    const result = await saveSequenceSettings(payload, acting.portal.id, {
      name: text(form, 'name'),
      welcome: text(form, 'welcome'),
      colour: text(form, 'colour'),
      accent: text(form, 'accent'),
      logoUrl: text(form, 'logoUrl'),
      ...(form.has('brandName') ? { brandName: text(form, 'brandName') } : {}),
      lockOrder: text(form, 'lockOrder') !== 'no',
      minTalkSeconds: text(form, 'minTalk') === '300' ? 300 : 0,
    })
    return redirectTo(req, text(form, 'next') || '/', (result as DeskResult).error, (result as DeskResult).notice)
  }

  if (action === 'settings') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'Only a portal admin can change this.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    const data: Record<string, unknown> = {}
    for (const key of ['welcome', 'colour', 'organisationName', 'description', 'calendarUrl', 'notificationEmails', 'learnerWelcomeUrl', 'learnerIntroUrl', 'teacherWelcomeUrl', 'teacherIntroUrl', 'learnerLabel', 'teacherLabel']) {
      if (form.has(key)) data[key] = text(form, key)
    }
    if (form.has('brandName')) data.brandName = text(form, 'brandName').slice(0, 80)
    if (form.has('accent')) {
      const accent = text(form, 'accent')
      if (accent && !/^#[0-9a-f]{6}$/i.test(accent)) return redirectTo(req, text(form, 'next') || '/', 'The accent colour needs to look like #e07a5f.')
      data.accent = accent
    }
    if (form.has('logoUrl')) {
      const logoRaw = text(form, 'logoUrl')
      const logo = portalLogo(logoRaw)
      if (logoRaw && !logo) return redirectTo(req, text(form, 'next') || '/', 'The logo needs to be a path like /icons/hady-home.svg or an https link.')
      data.logoUrl = logo
    }
    if (typeof data.colour === 'string' && data.colour && !/^#[0-9a-f]{6}$/i.test(data.colour)) return redirectTo(req, text(form, 'next') || '/', 'The colour needs to look like #1f4d3a.')
    for (const key of ['calendarUrl', 'learnerWelcomeUrl', 'learnerIntroUrl', 'teacherWelcomeUrl', 'teacherIntroUrl']) {
      const value = data[key]
      if (typeof value === 'string' && value && !/^https:\/\//i.test(value)) return redirectTo(req, text(form, 'next') || '/', 'Links need to start with https://')
    }
    if (form.has('theme')) data.theme = text(form, 'theme') === 'dark' ? 'dark' : 'light'
    if (form.has('timeZone')) {
      if (!isTimeZone(text(form, 'timeZone'))) return redirectTo(req, text(form, 'next') || '/', 'Choose a time zone such as Europe/London.')
      data.timeZone = text(form, 'timeZone')
    }
    if (form.get('settingsForm') === 'yes') {
      data.showOthersAnswers = form.get('showOthersAnswers') === 'on'
      data.watchHistoryOptIn = form.get('watchHistoryOptIn') === 'on'
    }
    if (form.get('wizardDone') === 'on') data.wizardDone = true
    if (form.has('sceneKey')) {
      const key = text(form, 'sceneKey')
      const allowed = new Set([...SCENE_PRESETS.map((scene) => scene.key), 'upload'])
      if (!allowed.has(key)) return redirectTo(req, text(form, 'next') || '/', 'Choose a scene from the list.')
      data.sceneKey = key
    }
    if (form.has('sceneUrl')) {
      const sceneUrl = safeSceneUrl(text(form, 'sceneUrl'))
      if (text(form, 'sceneUrl') && !sceneUrl) return redirectTo(req, text(form, 'next') || '/', 'A scene link needs to start with https:// or be a path on this site.')
      data.sceneUrl = sceneUrl
    }
    const sceneFile = form.get('sceneFile')
    if (sceneFile instanceof File && sceneFile.size > 0) {
      if (sceneFile.size > 4_000_000) return redirectTo(req, text(form, 'next') || '/', 'That picture is too big. Use one under 4 MB.')
      const kind = sceneFile.type
      const ext = kind === 'image/png' ? 'png' : kind === 'image/webp' ? 'webp' : kind === 'image/jpeg' ? 'jpg' : ''
      if (!ext) return redirectTo(req, text(form, 'next') || '/', 'Use a JPG, PNG or WebP picture.')
      const { mkdir, writeFile } = await import('node:fs/promises')
      const path = await import('node:path')
      const dir = path.join(process.cwd(), 'public/uploads/scenes')
      await mkdir(dir, { recursive: true })
      const filename = `${portal}-${Date.now()}.${ext}`
      await writeFile(path.join(dir, filename), Buffer.from(await sceneFile.arrayBuffer()))
      data.sceneKey = 'upload'
      data.sceneUrl = `/uploads/scenes/${filename}`
    }
    if (form.has('courseHome')) data.courseHome = text(form, 'courseHome') === 'garden' ? 'garden' : 'cards'
    if (form.has('supportNote')) data.supportNote = text(form, 'supportNote').slice(0, 240)
    if (form.has('markKind')) data.markKind = text(form, 'markKind') === 'hearts' ? 'hearts' : 'plain'
    await payload.update({
      collection: 'portals',
      id: portal,
      overrideAccess: true,
      data,
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Portal settings saved.')
  }

  if (action === 'placing-question') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot edit the questions.')
    const prompt = text(form, 'prompt')
    const placingDoors = await loadDoors(payload)
    const options = text(form, 'options').split('\n').map((line) => normaliseOption(line.trim(), placingDoors)).filter(Boolean)
    if (!prompt || options.length < 2) return redirectTo(req, text(form, 'next') || '/', 'A question needs words and at least two answers.')
    let placingPortal: number | null = null
    if (user.role !== 'master' || text(form, 'portalSlug')) {
      const acting = await actingPortal(payload, user, form)
      if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
      placingPortal = acting.portal.id
    }
    await payload.create({
      collection: 'placing-questions',
      overrideAccess: true,
      data: {
        prompt,
        why: text(form, 'why'),
        options,
        order: Number(text(form, 'order') || 10),
        portal: placingPortal || undefined,
      },
    })
    return redirectTo(req, text(form, 'next') || '/master', undefined, 'Question saved.')
  }

  if (action === 'placing-bank-attach') {
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, '/', 'You cannot edit the questions.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const keys = form.getAll('bankKey').map((value) => String(value || '').trim()).filter(Boolean)
    const added = await attachExtraPlacing(payload, acting.portal.id, keys.length ? keys : undefined)
    return redirectTo(req, text(form, 'next') || '/', undefined, added ? `${added} joining question${added === 1 ? '' : 's'} added for this portal.` : 'Those questions are already on this portal.')
  }

  if (action === 'create-event') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot open Live in person.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const portal = acting.portal.id
    if (text(form, 'startsAt') && Number.isNaN(Date.parse(text(form, 'startsAt')))) return redirectTo(req, text(form, 'next') || '/', 'That date and time could not be read.')
    const kind = text(form, 'kind') || 'Night'
    const startsRaw = text(form, 'startsAt')
    const dated = startsRaw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    const nightWhen = dated ? new Date(Date.UTC(Number(dated[1]), Number(dated[2]) - 1, Number(dated[3]))) : now()
    const nightTitle = text(form, 'title') || `${kind} · ${humanDayMonth(nightWhen, true)}`
    await payload.create({
      collection: 'events',
      overrideAccess: true,
      data: {
        title: nightTitle,
        place: text(form, 'place'),
        note: text(form, 'note'),
        startsAt: text(form, 'startsAt') ? new Date(text(form, 'startsAt')).toISOString() : undefined,
        portal,
      },
    })
    const alerted = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 500, where: { and: [{ 'tenants.tenant': { equals: portal } }, { nightAlerts: { equals: true } }] } })
    for (const person of alerted.docs) {
      await notify(payload, { user: person.id, portal, title: 'Live in person has a new evening', body: `${nightTitle}${text(form, 'place') ? ` at ${text(form, 'place')}` : ''}.`, href: `/p/${acting.portal.slug}/me/circle` })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Live in person saved.')
  }

  if (action === 'pack-courses') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can change a library pack.')
    const pack = await findDoc(payload, 'packs', Number(text(form, 'pack')))
    if (!pack || pack.owner !== 'master') return redirectTo(req, text(form, 'next') || '/master/packs', 'That library pack could not be found.')
    const courseIds = [...new Set(form.getAll('course').map((value) => Number(value)).filter(Boolean))]
    if (courseIds.length) {
      const found = await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: courseIds.length, where: { and: [{ id: { in: courseIds } }, { origin: { equals: 'master' } }] } })
      if (found.docs.length !== courseIds.length) return redirectTo(req, text(form, 'next') || '/master/packs', 'Only library courses can go in a library pack.')
    }
    const before = ((pack as { courses?: unknown[] }).courses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const added = courseIds.filter((id) => !before.includes(id))
    await payload.update({ collection: 'packs', id: pack.id, overrideAccess: true, data: { courses: courseIds } })
    const give = text(form, 'giveHolders') === 'yes'
    const given = give && added.length ? await giveCourseToPackHolders(payload, added) : { updated: 0, live: 0, users: [] as number[] }
    return redirectTo(req, text(form, 'next') || '/master/packs', undefined, packSaveNotice({ added: added.length, give, holdersUpdated: given.updated, holdersLive: given.live }))
  }

  if (action === 'read-notes') {
    const notes = await payload.find({
      collection: 'notifications',
      overrideAccess: true,
      limit: 50,
      where: { user: { equals: user.id } },
    })
    for (const note of notes.docs) {
      await payload.update({ collection: 'notifications', id: note.id, overrideAccess: true, data: { read: true } })
    }
    return redirectTo(req, text(form, 'next') || '/')
  }

  if (action === 'deactivate') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can deactivate a portal.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/master', acting.error)
    const closed = text(form, 'closed') !== 'no'
    if (closed && text(form, 'confirm') !== 'yes') return redirectTo(req, text(form, 'next') || '/master', 'Tick the box to confirm before you deactivate a portal.')
    await payload.update({ collection: 'portals', id: acting.portal.id, overrideAccess: true, data: { closed } })
    return redirectTo(req, text(form, 'next') || '/master', undefined, closed ? 'Portal deactivated.' : 'Portal is active again.')
  }

  if (action === 'remove-adoption') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot remove a link.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const adoption = await payload.findByID({ collection: 'adoptions', id: Number(text(form, 'adoption')), overrideAccess: true, depth: 0 })
    if (idOf((adoption as { portal?: unknown }).portal) !== acting.portal.id) return redirectTo(req, '/', 'That link is not in your portal.')
    if (text(form, 'sure') !== 'yes') return redirectTo(req, text(form, 'next') || '/', 'Tick Yes, delete it. Nothing was deleted.')
    await payload.delete({ collection: 'adoptions', id: adoption.id, overrideAccess: true })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'The link is removed. The library course is unchanged.')
  }

  if (action === 'import-token') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot import a course.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const token = text(form, 'token')
    const found = await payload.find({ collection: 'courses', overrideAccess: true, limit: 1, where: { importToken: { equals: token } } })
    const course = found.docs[0] as { id: number; importable?: boolean; title?: string } | undefined
    if (!course || course.importable === false) return redirectTo(req, text(form, 'next') || '/', 'That share code was not recognised.')
    const already = await payload.find({
      collection: 'adoptions',
      overrideAccess: true,
      limit: 1,
      where: { and: [{ portal: { equals: acting.portal.id } }, { course: { equals: course.id } }] },
    })
    if (!already.docs.length) {
      await payload.create({
        collection: 'adoptions',
        overrideAccess: true,
        data: { kind: 'course', portal: acting.portal.id, course: course.id },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, `${course.title || 'Course'} is linked. Nobody sees it until a code or a personal grant includes it.`)
  }

  if (action === 'update-code') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot edit an access code.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const codeId = Number(text(form, 'codeId'))
    const code = await findDoc(payload, 'access-codes', codeId)
    if (!code || idOf(code.portal) !== acting.portal.id) return redirectTo(req, '/', 'That access code is not in your portal.')
    const picking = text(form, 'coursesForm') === 'yes'
    const packId = Number(text(form, 'pack') || 0)
    let nextIds: number[] = []
    if (picking) {
      const picked = [...new Set(form.getAll('course').map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0))]
      const opened = await coursesForThisPortal(payload, acting.portal.id, picked)
      if ('error' in opened) return redirectTo(req, text(form, 'next') || '/', opened.error)
      nextIds = [...opened.local, ...opened.master]
      if ((code as { role?: string }).role === 'parent' && nextIds.length !== 1) return redirectTo(req, text(form, 'next') || '/', 'A parent code opens one course.')
      await adoptLibraryCourses(payload, acting.portal.id, opened.master)
      await payload.update({ collection: 'access-codes', id: codeId, overrideAccess: true, data: { courses: nextIds, packs: [] } })
    } else {
      if (packId && !(await packUsable(payload, user, acting.portal.id, packId))) return redirectTo(req, text(form, 'next') || '/', 'That course pack is not available in this portal.')
      const packIds = packId ? [packId] : ((code as { packs?: unknown[] }).packs || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      for (const id of packIds) await ensurePackAdopted(payload, acting.portal.id, id)
      if (packId) {
        await payload.update({ collection: 'access-codes', id: codeId, overrideAccess: true, data: { packs: packIds } })
      }
      nextIds = await coursesInPacks(payload, packIds)
    }
    const apply = text(form, 'apply') || 'leave'
    if (apply !== 'leave') {
      const holders = await payload.find({
        collection: 'users',
        overrideAccess: true,
        depth: 0,
        limit: 200,
        where: { accessCode: { equals: codeId } },
      })
      for (const holder of holders.docs) {
        const current = Array.isArray((holder as { courseList?: unknown }).courseList)
          ? ((holder as { courseList: unknown[] }).courseList.map((item) => Number(item)).filter(Boolean))
          : []
        let courseList = current
        if (apply === 'overwrite') courseList = nextIds
        if (apply === 'add') courseList = [...new Set([...current, ...nextIds])]
        if (apply === 'remove') courseList = current.filter((id) => !nextIds.includes(id))
        await payload.update({ collection: 'users', id: holder.id, overrideAccess: true, data: { courseList } })
      }
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, apply === 'leave' ? 'Existing people were left as they are.' : 'Access updated. It is already in their account.')
  }

  if (action === 'grant-many') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners cannot grant courses.')
    const next = text(form, 'next') || '/'
    const learnerIds = [...new Set(form.getAll('learner').map((value) => Number(value)).filter((id) => id > 0))]
    const courseIds = [...new Set(form.getAll('course').map((value) => Number(value)).filter((id) => id > 0))]
    if (!learnerIds.length || !courseIds.length) return redirectTo(req, next, 'Choose a course and at least one learner.')
    const visible = new Set(await visibleCourseIds(payload, user))
    if (courseIds.some((id) => !visible.has(id))) return redirectTo(req, next, 'That course is not in your portal.')
    let count = 0
    for (const learnerId of learnerIds) {
      const learner = await findDoc(payload, 'users', learnerId)
      if (!learner || (user.role !== 'master' && portalIdOf(learner as SessionUser) !== portalIdOf(user))) continue
      const existing = ((learner as { extraCourses?: unknown[] }).extraCourses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
      await payload.update({
        collection: 'users',
        id: learnerId,
        overrideAccess: true,
        data: { extraCourses: [...new Set([...existing, ...courseIds])] },
      })
      count += 1
    }
    return redirectTo(req, next, undefined, `Given to ${count} learner${count === 1 ? '' : 's'}. They can see it on Lanes.`)
  }

  if (action === 'grant') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners cannot grant courses.')
    const learnerId = Number(text(form, 'learner'))
    const courseId = Number(text(form, 'course'))
    const learner = await findDoc(payload, 'users', learnerId)
    if (!learner || (user.role !== 'master' && portalIdOf(learner as SessionUser) !== portalIdOf(user))) {
      return redirectTo(req, '/', 'That learner is not in your portal.')
    }
    if (!(await visibleCourseIds(payload, user)).includes(courseId)) return redirectTo(req, text(form, 'next') || '/', 'That course is not in your portal.')
    const existing = ((learner as { extraCourses?: unknown[] }).extraCourses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    await payload.update({
      collection: 'users',
      id: learnerId,
      overrideAccess: true,
      data: { extraCourses: [...new Set([...existing, courseId])] },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Granted. They can see it on the next page, without signing in again.')
  }

  if (action === 'offer-on-code' || action === 'offer-joined') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot put a course on a code.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, text(form, 'next') || '/', acting.error)
    const courseId = Number(text(form, 'course') || 0)
    if (!courseId) return redirectTo(req, text(form, 'next') || '/', 'Choose a course.')
    if (action === 'offer-joined') {
      const given = await giveCourseToJoinedLearners(payload, acting.portal.id, courseId)
      return redirectTo(req, text(form, 'next') || '/', given.error, given.notice)
    }
    const placed = await addCourseToCode(payload, { portalId: acting.portal.id, courseId, codeId: Number(text(form, 'code') || 0), giveJoined: text(form, 'giveJoined') === 'yes' })
    return redirectTo(req, text(form, 'next') || '/', placed.error, placed.notice)
  }

  if (action === 'feedback') {
    if (user.role === 'learner') return redirectTo(req, '/', 'Learners do not leave this kind of feedback.')
    const answer = await findDoc(payload, 'answers', Number(text(form, 'answer')))
    if (!answer) return redirectTo(req, text(form, 'next') || '/', 'That answer could not be found.')
    if (user.role !== 'master' && idOf(answer.portal) !== portalIdOf(user)) {
      return redirectTo(req, '/', 'That answer is not in your portal.')
    }
    if (refuseFeature(await loadPortalById(payload, idOf(answer.portal) || portalIdOf(user) || 0), 'feedback')) {
      return redirectTo(req, text(form, 'next') || '/', FEATURE_UNAVAILABLE)
    }
    const body = text(form, 'body')
    if (!body) return redirectTo(req, text(form, 'next') || '/', 'Write the feedback first.')
    const audio = form.get('audio')
    let audioId: number | undefined
    if (audio instanceof File && audio.size > 0) {
      if (tooBig(audio)) return redirectTo(req, text(form, 'next') || '/', 'That file is over 200 MB.')
      audioId = await saveUpload(payload, audio, idOf(answer.portal), 'audio/webm', user.id, 'feedback')
    }
    await payload.create({
      collection: 'feedback-notes',
      overrideAccess: true,
      data: {
        answer: answer.id,
        author: user.id,
        second: Number(text(form, 'second') || 0),
        body,
        audio: audioId,
        portal: idOf((answer as { portal?: unknown }).portal) || undefined,
      },
    })
    const learnerId = idOf((answer as { user?: unknown }).user)
    if (learnerId) {
      await payload.create({
        collection: 'notifications',
        overrideAccess: true,
        data: {
          user: learnerId,
          portal: idOf((answer as { portal?: unknown }).portal) || undefined,
          title: 'Feedback on your evidence',
          body,
          href: text(form, 'href') || '/',
        },
      })
    }
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Feedback is on the timeline.')
  }

  if (action === 'seen-welcome') {
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { seenWelcome: true } })
    return redirectTo(req, text(form, 'next') || '/')
  }

  if (action === 'watch-opt-in') {
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { shareWatch: form.get('shareWatch') === 'on' } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Watch history preference saved.')
  }

  if (action === 'rename-course') {
    if (user.role !== 'portal-admin' && user.role !== 'master') return redirectTo(req, '/', 'You cannot rename that course.')
    const course = await findDoc(payload, 'courses', Number(text(form, 'course')))
    const denied = editError(user, course)
    if (denied || !course) return redirectTo(req, text(form, 'next') || '/', denied || 'That course could not be found.')
    await payload.update({
      collection: 'courses',
      id: course.id,
      overrideAccess: true,
      data: { title: text(form, 'title') || (course as { title?: string }).title, importable: form.get('importable') === 'on' },
    })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Course updated.')
  }

  if (action === 'workbook-consent') {
    const entry = await findDoc(payload, 'workbook-entries', Number(text(form, 'entry')))
    if (!entry || idOf(entry.user) !== user.id) return redirectTo(req, text(form, 'next') || '/', 'That entry is not yours.')
    const consent = text(form, 'consent') === 'yes'
    await payload.update({ collection: 'workbook-entries', id: entry.id, overrideAccess: true, data: { consent } })
    const answerId = idOf(entry.answer)
    if (answerId) await payload.update({ collection: 'answers', id: answerId, overrideAccess: true, data: { shareWithTeacher: consent } })
    if (consent) await notifyTeachers(payload, user, portalIdOf(user), 'A learner shared a workbook entry', `${user.name || 'A learner'} shared a workbook entry with you.`)
    return redirectTo(req, text(form, 'next') || '/', undefined, consent ? 'Your teacher can now read this entry and reply.' : 'This entry is back to being just for you.')
  }

  if (action === 'night-alerts') {
    const on = form.get('nightAlerts') === 'on'
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { nightAlerts: on } })
    return redirectTo(req, text(form, 'next') || '/', undefined, on ? 'We will let you know when Live in person opens a new evening.' : 'Live in person alerts are off.')
  }

  if (action === 'my-list') {
    const courseId = Number(text(form, 'course'))
    const next = text(form, 'next') || '/'
    const portalId = portalIdOf(user)
    const allowed = portalId ? [...(await adoptedCourseIds(payload, portalId)), ...(await visibleCourseIds(payload, user))] : []
    if (!courseId || !allowed.includes(courseId)) return redirectTo(req, next, 'That course is not in your portal.')
    const existing = (user.extraCourses || []).map((item) => idOf(item)).filter((id): id is number => Boolean(id))
    const remove = text(form, 'remove') === 'yes'
    const extraCourses = remove ? existing.filter((id) => id !== courseId) : [...new Set([...existing, courseId])]
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { extraCourses } as never })
    return redirectTo(req, next, undefined, remove ? 'Taken out of your list.' : 'Kept in your list.')
  }

  if (action === 'profile') {
    const name = text(form, 'name').slice(0, 80)
    if (!name) return redirectTo(req, text(form, 'next') || '/', 'Write the name you would like us to use.')
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { name } as never })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Name saved.')
  }

  if (action === 'me-pref') {
    const name = text(form, 'name')
    const value = text(form, 'value') === 'on'
    if (!['keepPlace', 'shareOpening', 'trendsOptIn', 'haptics', 'shareWithLearners', 'nightAlerts', 'shareWatch'].includes(name)) return redirectTo(req, text(form, 'next') || '/', 'That setting is not known.')
    await payload.update({ collection: 'users', id: user.id, overrideAccess: true, data: { [name]: value } as never })
    if (name === 'shareOpening') {
      const rows = await payload.find({ collection: 'opening-answers', overrideAccess: true, depth: 0, limit: 50, where: { user: { equals: user.id } } })
      for (const row of rows.docs as { id: number; private?: boolean }[]) {
        await payload.update({ collection: 'opening-answers', id: row.id, overrideAccess: true, data: { staffVisible: value && !row.private } as never })
      }
    }
    if (name === 'shareWithLearners' && !value) {
      await payload.update({ collection: 'answers', overrideAccess: true, where: { user: { equals: user.id } }, data: { shareWithLearners: false } as never })
    }
    if (name === 'keepPlace' && !value) await payload.delete({ collection: 'heart-states', overrideAccess: true, where: { user: { equals: user.id } } })
    return redirectTo(req, text(form, 'next') || '/', undefined, 'Saved.')
  }

  if (action === 'scene-wording') {
    const back = text(form, 'next') || '/master/opening'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk edits the opening scenes.')
    const scene = await findDoc(payload, 'opening-scenes', Number(text(form, 'scene')))
    if (!scene) return redirectTo(req, back, 'That scene was not found.')
    const caption = text(form, 'caption').slice(0, 140)
    if (!caption) return redirectTo(req, back, 'A scene needs a caption.')
    const status = text(form, 'status') === 'published' ? 'published' : 'draft'
    const monthCaption = text(form, 'monthCaption').slice(0, 140)
    const monthSubline = text(form, 'monthSubline').slice(0, 200)
    try {
      await payload.update({ collection: 'opening-scenes', id: scene.id, overrideAccess: true, data: { caption, subline: text(form, 'subline').slice(0, 200), monthCaption, monthSubline, status } as never })
    } catch (error) {
      return redirectTo(req, back, error instanceof Error ? error.message : 'That could not be saved.')
    }
    return redirectTo(req, back, undefined, status === 'published' ? 'Scene saved and published.' : 'Scene saved as a draft.')
  }

  if (action === 'typography-save') {
    const back = text(form, 'next') || '/master/tiers'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk edits typography.')
    const tier = await findDoc(payload, 'talk-tiers', Number(text(form, 'tier')))
    if (!tier) return redirectTo(req, back, 'That talk was not found.')
    const style = text(form, 'typographyStyle')
    const allowed = ['kinetic', 'windows', 'conversation', 'cinema', 'unfold']
    if (style && !allowed.includes(style)) return redirectTo(req, back, 'Choose Kinetic, Windows, Conversation, Cinema or Unfold.')
    const inPlace = form.get('typographyInPlace') === 'on'
    if (inPlace && !style) return redirectTo(req, back, 'Choose a style before using typography in place of the clip.')
    try {
      await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: { typographyStyle: style || null, typographyInPlace: inPlace } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That typography choice was not saved.'))
    }
    return redirectTo(req, back, undefined, inPlace ? 'Typography in place of the clip.' : 'Typography saved.')
  }

  if (action === 'tier-save') {
    const back = text(form, 'next') || '/master/tiers'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk edits talk tiers.')
    const tier = await findDoc(payload, 'talk-tiers', Number(text(form, 'tier')))
    if (!tier) return redirectTo(req, back, 'That talk was not found.')
    const times = ['horsStart', 'horsEnd', 'appetiserStart', 'appetiserEnd'].map((key) => exactSecondsFrom(text(form, key)))
    if (times.some((value) => value === null)) return redirectTo(req, back, 'Times are minutes and seconds, for example 2:05, or plain seconds.')
    const [horsStart, horsEnd, appetiserStart, appetiserEnd] = times as number[]
    const checking = text(form, 'check') === 'yes'
    const data: Record<string, unknown> = {
      horsStart,
      horsEnd,
      appetiserStart,
      appetiserEnd,
      horsQuote: text(form, 'horsQuote').slice(0, 400),
      hook: text(form, 'hook').slice(0, 400),
      turn: text(form, 'turn').slice(0, 400),
      land: text(form, 'land').slice(0, 400),
      offerResume: form.get('offerResume') === 'on',
      note: text(form, 'note').slice(0, 1000),
      source: 'human',
    }
    if (checking) Object.assign(data, { status: 'checked', checkedBy: user.id, checkedAt: now().toISOString() })
    else if (text(form, 'reopen') === 'yes') Object.assign(data, { status: 'draft', checkedBy: null, checkedAt: null })
    const lesson = await findDoc(payload, 'lessons', idOf(tier.lesson) || 0)
    const source = tierSourceText(lesson as { youtubeId?: string; transcript?: string } | null)
    if (source) Object.assign(data, tierTimings(source, data as Parameters<typeof tierTimings>[1]))
    try {
      await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: data as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'Those times were not saved.'))
    }
    const live = tierVisible({ ...tier, ...data, id: tier.id }, await showUncheckedTalks(payload))
    return redirectTo(req, back, undefined, `${checking ? 'Saved and marked as checked by you.' : 'Saved.'} ${live ? 'Learners see the new times straight away.' : 'Learners see this talk once it is approved.'}`)
  }

  if (action === 'tier-review') {
    const back = text(form, 'next') || '/master/review'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk reviews talk tiers.')
    const tier = await findDoc(payload, 'talk-tiers', Number(text(form, 'tier')))
    if (!tier) return redirectTo(req, back, 'That talk was not found.')
    const decision = text(form, 'decision')
    const data =
      decision === 'approve'
        ? { status: 'checked', checkedBy: user.id, checkedAt: now().toISOString() }
        : decision === 'reject'
          ? { status: 'rejected', checkedBy: user.id, checkedAt: now().toISOString() }
          : { status: 'draft', checkedBy: null, checkedAt: null }
    try {
      await payload.update({ collection: 'talk-tiers', id: tier.id, overrideAccess: true, data: data as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That review was not saved.'))
    }
    const notice = decision === 'approve' ? 'Approved. Learners see this talk.' : decision === 'reject' ? 'Rejected. Learners no longer see this talk.' : 'Back to draft.'
    return redirectTo(req, back, undefined, notice)
  }

  if (action === 'popup-review') {
    const back = text(form, 'next') || '/master/review/popups'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk reviews pop-ups.')
    const point = await findDoc(payload, 'engagement-points', Number(text(form, 'point')))
    if (!point) return redirectTo(req, back, 'That pop-up was not found.')
    const decision = text(form, 'decision')
    const status = decision === 'approve' ? 'published' : decision === 'reject' ? 'rejected' : 'draft'
    try {
      await payload.update({ collection: 'engagement-points', id: point.id, overrideAccess: true, data: { status, reviewedBy: user.id } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That review was not saved.'))
    }
    return redirectTo(req, back, undefined, status === 'published' ? 'Approved and published. Learners meet it in the main.' : status === 'rejected' ? 'Rejected. Learners never see it.' : 'Back to draft.')
  }

  if (action === 'swarm-review') {
    const back = text(form, 'next') || '/master/review/swarm'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk reviews swarm answers.')
    const answer = await findDoc(payload, 'answers', Number(text(form, 'answer')))
    if (!answer) return redirectTo(req, back, 'That answer was not found.')
    const decision = text(form, 'decision')
    const hidden = decision !== 'approve'
    try {
      await payload.update({ collection: 'answers', id: answer.id, overrideAccess: true, data: { swarmHidden: hidden, swarmReason: hidden ? String(answer.swarmReason || 'Kept hidden by review.') : null } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That review was not saved.'))
    }
    return redirectTo(req, back, undefined, hidden ? 'Kept hidden from the swarm.' : 'Shown in the swarm as initials.')
  }

  if (action === 'popup-approve-all') {
    const back = text(form, 'next') || '/master/review/popups'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk reviews pop-ups.')
    const ids = await importedSheetDraftIds(payload)
    for (const id of ids) {
      await payload.update({ collection: 'engagement-points', id, overrideAccess: true, data: { status: 'published', reviewedBy: user.id } as never })
    }
    const approved = ids.length
    return redirectTo(req, back, undefined, approved ? `${approved} imported question${approved === 1 ? '' : 's'} approved and published.` : 'No imported drafts were waiting.')
  }

  if (action === 'show-unchecked') {
    const back = text(form, 'next') || '/master/review'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk changes this.')
    const on = text(form, 'value') === 'on'
    await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { showUnchecked: on } as never })
    return redirectTo(req, back, undefined, on ? 'Unchecked talks and their draft questions are shown to learners.' : 'Only approved talks and published questions are shown to learners.')
  }

  if (action === 'mark-short-talks' || action === 'restore-short-talk') {
    if (user.role !== 'master') return redirectTo(req, '/', 'Only the master desk can change which talks are too short.')
    const next = text(form, 'next') || '/master/library?show=too-short'
    const { markShortTalks, restoreShortTalk } = await import('./short-talks')
    if (action === 'restore-short-talk') {
      const result = await restoreShortTalk(payload, Number(text(form, 'lesson')))
      if (result.error) return redirectTo(req, next, result.error)
      return redirectTo(req, next, undefined, result.notice)
    }
    const result = await markShortTalks(payload)
    return redirectTo(req, next, undefined, `Marked ${result.marked} talk${result.marked === 1 ? '' : 's'} as too short. ${result.already} were already marked.`)
  }

  if (action === 'hors-max') {
    const back = text(form, 'next') || '/master/review'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk changes this.')
    const raw = Number(text(form, 'horsMaxSeconds'))
    if (!Number.isInteger(raw) || raw < HORS_MAX || raw > 180) return redirectTo(req, back, `The hors d'oeuvre cap is a whole number of seconds from ${HORS_MAX} to 180.`)
    await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { horsMaxSeconds: raw } as never })
    return redirectTo(req, back, undefined, `Hors d'oeuvre cap saved at ${raw} seconds. ${HORS_MIN} to ${HORS_MAX} is still the usual length.`)
  }

  if (action === 'popup-save' || action === 'popup-publish') {
    const back = text(form, 'next') || '/master/tiers'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk edits these pop-ups.')
    const lesson = await findDoc(payload, 'lessons', Number(text(form, 'lesson')))
    if (!lesson) return redirectTo(req, back, 'That talk was not found.')
    const point = text(form, 'point') ? await findDoc(payload, 'engagement-points', Number(text(form, 'point'))) : null
    if (point && idOf(point.lesson) !== lesson.id) return redirectTo(req, back, 'That pop-up belongs to another talk.')
    if (action === 'popup-publish') {
      if (!point) return redirectTo(req, back, 'That pop-up was not found.')
      const publish = text(form, 'status') !== 'draft'
      await payload.update({ collection: 'engagement-points', id: point.id, overrideAccess: true, data: { status: publish ? 'published' : 'draft' } as never })
      return redirectTo(req, back, undefined, publish ? 'Pop-up published. Learners meet it in the main.' : 'Pop-up back to draft. Learners no longer see it.')
    }
    const second = secondsFrom(text(form, 'second'))
    const prompt = text(form, 'prompt').slice(0, 400)
    const duration = Number(lesson.durationSeconds || 0)
    if (second === null) return redirectTo(req, back, 'The time is minutes and seconds, for example 12:30.')
    if (duration && second > duration) return redirectTo(req, back, `That time is after the end of the talk (${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}).`)
    if (prompt.length < 10) return redirectTo(req, back, 'Write the question in at least 10 characters.')
    const kind = ['reflection', 'task', 'question'].includes(text(form, 'kind')) ? text(form, 'kind') : String(point?.kind || 'reflection')
    try {
      if (point) await payload.update({ collection: 'engagement-points', id: point.id, overrideAccess: true, data: { second, prompt, kind, author: user.id } as never })
      else await payload.create({ collection: 'engagement-points', overrideAccess: true, data: { lesson: lesson.id, second, prompt, kind, triggerType: 'timestamp', timing: 'immediate', status: 'draft', draftNote: 'Written on the master desk.', author: user.id } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That pop-up was not saved.'))
    }
    return redirectTo(req, back, undefined, point ? 'Pop-up saved.' : 'Pop-up added as a draft. Publish it when it reads right.')
  }

  if (action === 'master-flags') {
    const back = text(form, 'next') || '/master/opening'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk changes these.')
    await payload.updateGlobal({ slug: 'master-flags', overrideAccess: true, data: { popupOverPlayer: form.get('popupOverPlayer') === 'on', chromeOverPlayer: form.get('chromeOverPlayer') === 'on' } as never })
    return redirectTo(req, back, undefined, 'Player layout saved.')
  }

  if (action === 'lane-tag') {
    const back = text(form, 'next') || '/master/lanes'
    if (user.role !== 'master') return redirectTo(req, back, 'Only the master desk tags lanes.')
    const tag = await findDoc(payload, 'tags', Number(text(form, 'tag')))
    if (!tag || !idOf(tag.lane)) return redirectTo(req, back, 'That suggestion was not found.')
    if (text(form, 'decision') === 'reject') {
      await payload.delete({ collection: 'tags', id: tag.id, overrideAccess: true })
      return redirectTo(req, back, undefined, 'Suggestion taken off.')
    }
    const weight = Math.min(1, Math.max(0, Number(text(form, 'weight') || tag.weight || 1)))
    await payload.update({ collection: 'tags', id: tag.id, overrideAccess: true, data: { state: 'confirmed', weight } as never })
    return redirectTo(req, back, undefined, 'Lane confirmed. The clip can now be routed in that lane.')
  }

  if (action === 'opening-extra-scene' || action === 'opening-extra-scene-remove') {
    const back = text(form, 'next') || '/'
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, back, 'Only a portal admin changes the opening.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, back, acting.error)
    const portalId = acting.portal.id
    const found = await payload.find({ collection: 'opening-configs', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } })
    const config = (found.docs[0] as unknown as (Record<string, unknown> & { id: number }) | undefined) || ((await payload.create({ collection: 'opening-configs', overrideAccess: true, data: { portal: portalId } as never })) as unknown as Record<string, unknown> & { id: number })
    const { cleanPortalScenes, portalSceneFromForm } = await import('@/lib/portal-scenes')
    const current = cleanPortalScenes(config.extraScenes).scenes
    let next = current
    if (action === 'opening-extra-scene-remove') {
      if (text(form, 'sure') !== 'yes') return redirectTo(req, back, 'Tick Yes, delete it. Nothing was deleted.')
      const key = text(form, 'key')
      next = current.filter((scene) => scene.key !== key)
    } else {
      const labels = [text(form, 'opt1'), text(form, 'opt2'), text(form, 'opt3'), text(form, 'opt4'), text(form, 'opt5'), text(form, 'opt6')]
      const result = portalSceneFromForm({ caption: text(form, 'caption'), subline: text(form, 'subline'), labels, existing: current })
      if (result.error) return redirectTo(req, back, result.error)
      if (result.scenes.length <= current.length) return redirectTo(req, back, 'Write a question and at least two answers.')
      next = result.scenes
    }
    try {
      await payload.update({ collection: 'opening-configs', id: config.id, overrideAccess: true, data: { extraScenes: next } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'That question was not saved.'))
    }
    return redirectTo(req, back, undefined, action === 'opening-extra-scene-remove' ? 'Question removed.' : 'Question added for this portal.')
  }

  if (action === 'opening-config' || action === 'help-contact' || action === 'help-contact-remove') {
    const back = text(form, 'next') || '/'
    if (user.role !== 'master' && user.role !== 'portal-admin') return redirectTo(req, back, 'Only a portal admin changes the opening.')
    const acting = await actingPortal(payload, user, form)
    if ('error' in acting) return redirectTo(req, back, acting.error)
    const portalId = acting.portal.id
    const found = await payload.find({ collection: 'opening-configs', overrideAccess: true, depth: 0, limit: 1, where: { portal: { equals: portalId } } })
    const config = (found.docs[0] as unknown as (Record<string, unknown> & { id: number }) | undefined) || ((await payload.create({ collection: 'opening-configs', overrideAccess: true, data: { portal: portalId } as never })) as unknown as Record<string, unknown> & { id: number })
    if (action === 'opening-config') {
      const sceneId = Number(text(form, 'scene'))
      const scene = await findDoc(payload, 'opening-scenes', sceneId)
      if (!scene) return redirectTo(req, back, 'That scene was not found.')
      const caption = text(form, 'caption').slice(0, 140)
      const subline = text(form, 'subline').slice(0, 200)
      const hits = killListHits(`${caption} ${subline}`)
      if (hits.length) return redirectTo(req, back, `These words are not used with learners: ${hits.join(', ')}.`)
      const wording = ((config.wording as { scene?: unknown; caption?: string; subline?: string }[]) || []).filter((row) => idOf(row.scene) !== sceneId).map((row) => ({ ...row, scene: idOf(row.scene) }))
      if (caption || subline) wording.push({ scene: sceneId, caption: caption || undefined, subline: subline || undefined })
      const hidden = ((config.hiddenScenes as unknown[]) || []).map((row) => idOf(row)).filter((id): id is number => Boolean(id) && id !== sceneId)
      if (form.get('hidden') === 'on') {
        const sceneRow = scene as { options?: { crisis?: boolean }[] }
        if ((sceneRow.options || []).some((option) => option.crisis)) return redirectTo(req, back, 'The scene with the help option cannot be hidden.')
        hidden.push(sceneId)
      }
      try {
        await payload.update({ collection: 'opening-configs', id: config.id, overrideAccess: true, data: { wording, hiddenScenes: hidden } as never })
      } catch (error) {
        return redirectTo(req, back, publicMessage(error, 'That change to the opening was not saved.'))
      }
      return redirectTo(req, back, undefined, 'Opening saved for your portal.')
    }
    const contacts = ((config.helpContacts as { label?: string; phone?: string; url?: string; hours?: string }[]) || []).map(({ label, phone, url, hours }) => ({ label, phone, url, hours }))
    if (action === 'help-contact-remove') {
      if (text(form, 'sure') !== 'yes') return redirectTo(req, back, 'Tick Yes, delete it. Nothing was deleted.')
      contacts.splice(Number(text(form, 'index')), 1)
    }
    else {
      const label = text(form, 'label').slice(0, 80)
      if (!label || (!text(form, 'phone') && !text(form, 'url'))) return redirectTo(req, back, 'A help contact needs a name and a phone number or a link.')
      contacts.push({ label, phone: text(form, 'phone') || undefined, url: text(form, 'url') || undefined, hours: text(form, 'hours') || undefined })
    }
    try {
      await payload.update({ collection: 'opening-configs', id: config.id, overrideAccess: true, data: { helpContacts: contacts } as never })
    } catch (error) {
      return redirectTo(req, back, publicMessage(error, 'Those help contacts were not saved.'))
    }
    return redirectTo(req, back, undefined, 'Help contacts saved.')
  }

  if (action === 'visit') {
    const lessonId = Number(text(form, 'lesson'))
    const lesson = await findDoc(payload, 'lessons', lessonId)
    if (!lesson || !(await visibleCourseIds(payload, user)).includes(idOf(lesson.course) || 0)) return redirectTo(req, '/', 'That film is not in your portal.')
    return redirectTo(req, text(form, 'next') || '/')
  }

  if (action.startsWith('circle-')) {
    const blocked = await featureBlock(payload, user, form, 'circle')
    if (blocked) return redirectTo(req, text(form, 'next') || '/', blocked)
    return handleCircle(action, form, payload, user, (path, error, notice) => redirectTo(req, path, error, notice), session.actor?.role || user.role)
  }

  return actionProblemPage('That action is not known.', text(form, 'next') || refererPath(req), form)
}

async function notifyTeachers(payload: Payload, learner: SessionUser, portal: number | null, title: string, body: string) {
  if (!portal) return
  const codeId = idOf(learner.accessCode)
  const code = codeId ? await findDoc(payload, 'access-codes', codeId) : null
  const teacherCode = code ? idOf(code.linkedTeacherCode) : null
  const where: Where = teacherCode
    ? { and: [{ accessCode: { equals: teacherCode } }, { role: { equals: 'teacher' } }] }
    : { and: [{ 'tenants.tenant': { equals: portal } }, { role: { equals: 'teacher' } }] }
  const teachers = await payload.find({ collection: 'users', overrideAccess: true, depth: 0, limit: 50, where })
  const slug = ((await findDoc(payload, 'portals', portal))?.slug as string) || ''
  for (const teacher of teachers.docs) {
    await notify(payload, { user: teacher.id, portal, title, body, href: `/p/${slug}/admin/teach` })
  }
}

export { dualExtract }
