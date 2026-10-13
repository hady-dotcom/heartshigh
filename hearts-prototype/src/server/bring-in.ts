import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Payload } from 'payload'
import {
  ghunyaHeading,
  jibrilSection,
  looseBringInPaste,
  markBringInSkips,
  speakerForCandidate,
  suggestedCourseName,
  suggestedCourseSpeaker,
  type BringInRow,
  type ChannelMapRow,
} from '@/lib/bring-in-plan'
import { expandBringInText, joinBringInErrors } from '@/lib/youtube-list'
import { newHelperToken } from '@/lib/helper-token'
import { idOf, portalIdOf } from '@/lib/ids'
import { withWorkLock } from '@/lib/work-lock'
import { bringInFlash, bringInNote, bringInStatus, captionLang, captionsBlockPublish, ingestYoutubeUrl, withCaptionPublishPlan, type YoutubeMeta } from '@/lib/youtube'
import { decideBringInWrite, draftLessonWhere } from '@/lib/bring-in-plan'
import type { SessionUser } from './context'
import { giveCourseToPackHolders, packsContaining } from './publish-holders'
import { captionReadyNotice, publishNotice } from '@/lib/publish-state'

type Doc = Record<string, unknown> & { id: number }

export type PreviewBody = {
  courseId: number | null
  newTitle: string
  courseSpeaker: string
  lang: string
  origin: 'master' | 'local'
  portalId: number | null
  rows: BringInRow[]
}

function text(form: FormData, name: string) {
  return String(form.get(name) || '').trim()
}

function canBring(user: SessionUser) {
  return user.role === 'master' || user.role === 'portal-admin'
}

function editDenied(user: SessionUser, course: { origin?: string; portal?: unknown } | null) {
  if (!course) return 'That course could not be found.'
  if (user.role === 'master') return null
  if (user.role !== 'portal-admin') return 'Only a portal admin can change a course.'
  if (course.origin === 'master') return 'This course is linked from the library. You can view it or remove the link. You cannot edit the original.'
  if (idOf(course.portal) !== portalIdOf(user)) return 'That course is not in your portal.'
  return null
}

async function channelMap(payload: Payload): Promise<ChannelMapRow[]> {
  const found = await payload.find({ collection: 'channel-speakers', overrideAccess: true, depth: 0, limit: 200 })
  return (found.docs as { channelKey?: string; speaker?: string }[]).map((row) => ({
    channelKey: String(row.channelKey || ''),
    speaker: String(row.speaker || ''),
  }))
}

async function libraryIds(payload: Payload) {
  const found = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: 5000, where: { youtubeId: { exists: true } } })
  return new Set((found.docs as { youtubeId?: string }[]).map((row) => String(row.youtubeId || '')).filter(Boolean))
}

export async function previewBringIn(payload: Payload, user: SessionUser, form: FormData) {
  if (!canBring(user)) return { error: 'You cannot bring in a film.' }
  const raw = text(form, 'urls')
  if (!raw) return { error: 'Paste a YouTube link, a playlist or a channel first.' }
  const lang = captionLang(text(form, 'captionLang'))
  const typedSpeaker = text(form, 'speaker')
  const jibril = jibrilSection(text(form, 'jibril'))
  const ghunya = ghunyaHeading(text(form, 'ghunya'))
  const expanded = await expandBringInText(raw, { lang })
  const creating = text(form, 'course') === 'new'
  const courseSpeaker = creating ? suggestedCourseSpeaker({ typed: typedSpeaker, videos: expanded.videos }) : typedSpeaker
  const newTitle = text(form, 'newTitle') || (creating ? suggestedCourseName({ playlistTitle: expanded.playlistTitle, loose: looseBringInPaste(raw), videos: expanded.videos }) : '')
  const pasteErrors = joinBringInErrors(expanded.errors)
  if (!expanded.videos.length) return { error: pasteErrors || 'Those links did not return any films.' }
  const known = await libraryIds(payload)
  const map = await channelMap(payload)
  const marked = markBringInSkips(
    expanded.videos.map((video) => ({
      id: video.id,
      url: video.url,
      title: video.title,
      durationSeconds: video.durationSeconds,
      channel: video.channel,
      channelId: video.channelId,
      captions: video.captions || 'unknown',
      lineSpeaker: video.lineSpeaker,
    })),
    known,
  ).map((row) => ({
    ...row,
    speaker: speakerForCandidate({
      lineSpeaker: row.lineSpeaker,
      courseSpeaker: typedSpeaker,
      channel: row.channel,
      channelId: row.channelId,
      channelMap: map,
    }) || (creating && !typedSpeaker ? String(row.channel || '').trim() : ''),
    jibril,
    ghunya,
  }))
  const placed = await placeBringInRows(marked, {
    catalogue: loadPlaceCatalogue(),
    presetJibril: jibril,
    presetGhunya: ghunya,
    fetchTranscript: async (id) => (await transcriptFor(id, undefined, { lang })).transcript,
  })
  const courseId = Number(text(form, 'course') || 0) || null
  const origin = user.role === 'master' && text(form, 'origin') !== 'local' ? 'master' : 'local'
  const body: PreviewBody = {
    courseId: creating ? null : courseId,
    newTitle,
    courseSpeaker,
    lang,
    origin,
    portalId: origin === 'local' ? portalIdOf(user) : null,
    rows: placed,
  }
  if (body.courseId) {
    const course = await payload.findByID({ collection: 'courses', id: body.courseId, depth: 0, overrideAccess: true }).catch(() => null)
    const denied = editDenied(user, course as { origin?: string; portal?: unknown } | null)
    if (denied) return { error: denied }
  }
  const doc = await payload.create({
    collection: 'bring-in-previews',
    overrideAccess: true,
    data: { actor: user.id, portal: body.portalId || undefined, body } as never,
  })
  const notice = pasteErrors || undefined
  return { previewId: doc.id, notice }
}

function fixtureMeta(id: string): YoutubeMeta {
  const fallback = { id, title: `Film ${id}`, author: 'YouTube', thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
  try {
    const catalogue = JSON.parse(readFileSync(path.join(process.cwd(), 'tests/fixtures/bring-in/catalogue.json'), 'utf8')) as {
      videos?: { id: string; title?: string; channel?: string }[]
    }
    const video = catalogue.videos?.find((row) => row.id === id)
    if (!video) return fallback
    return { id, title: video.title || fallback.title, author: video.channel || 'YouTube', thumbnail: fallback.thumbnail }
  } catch {
    return fallback
  }
}

async function ensureCourse(payload: Payload, user: SessionUser, body: PreviewBody) {
  if (body.courseId) {
    const course = (await payload.findByID({ collection: 'courses', id: body.courseId, depth: 0, overrideAccess: true }).catch(() => null)) as unknown as Doc | null
    const denied = editDenied(user, course as { origin?: string; portal?: unknown } | null)
    if (denied || !course) return { error: denied || 'That course could not be found.' }
    return { course }
  }
  const title = body.newTitle.trim()
  if (!title) return { error: 'Type a name for the new course.' }
  const existing = await payload.find({
    collection: 'courses',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { and: [{ title: { equals: title } }, body.portalId ? { portal: { equals: body.portalId } } : { origin: { equals: 'master' } }] },
  })
  const found = existing.docs[0] as unknown as Doc | undefined
  if (found) return { course: found }
  const course = (await payload.create({
    collection: 'courses',
    overrideAccess: true,
    data: {
      title,
      speaker: body.courseSpeaker,
      origin: body.origin,
      portal: body.portalId || undefined,
      importable: body.origin === 'master',
      visibility: 'published',
    } as never,
  })) as unknown as Doc
  await payload.create({
    collection: 'units',
    overrideAccess: true,
    data: { title: 'Talks', course: course.id, order: 1 } as never,
  })
  return { course }
}

export async function commitBringIn(payload: Payload, user: SessionUser, form: FormData) {
  if (!canBring(user)) return { error: 'You cannot bring in a film.' }
  const previewId = Number(text(form, 'preview') || 0)
  const preview = (await payload.findByID({ collection: 'bring-in-previews', id: previewId, depth: 0, overrideAccess: true }).catch(() => null)) as { body?: PreviewBody; actor?: unknown; portal?: unknown } | null
  if (!preview?.body?.rows) return { error: 'Look the films up again. That list is no longer here.' }
  if (user.role !== 'master' && idOf(preview.actor) !== user.id) return { error: 'That list belongs to another desk.' }
  const body = preview.body
  const picked = new Set(form.getAll('pick').map((value) => String(value)))
  const chosen = body.rows.filter((row) => picked.has(String(row.index)) && row.skipReason !== 'library' && row.skipReason !== 'duplicate')
  if (!chosen.length) return { error: 'Tick at least one film. Ones already in the library stay out.' }
  const previousSpeaker = body.courseSpeaker
  if (!body.courseId) {
    if (form.has('newTitle')) body.newTitle = text(form, 'newTitle')
    if (form.has('courseSpeaker')) body.courseSpeaker = text(form, 'courseSpeaker')
  }
  const rows = chosen.map((row) => {
    const posted = text(form, `speaker-${row.index}`) || row.speaker
    const speaker = !body.courseId && posted === previousSpeaker ? body.courseSpeaker || posted : posted
    return {
      ...row,
      speaker,
      jibril: jibrilSection(text(form, `jibril-${row.index}`) || row.jibril),
      ghunya: ghunyaHeading(text(form, `ghunya-${row.index}`) || row.ghunya),
    }
  })
  const lockKey = `bringin:${body.courseId || body.newTitle}:${rows.map((row) => row.id).sort().join(',')}`
  return withWorkLock(lockKey, async () => {
    const ensured = await ensureCourse(payload, user, body)
    if ('error' in ensured && ensured.error) return { error: ensured.error }
    const course = ensured.course as unknown as Doc
    const units = await payload.find({ collection: 'units', overrideAccess: true, limit: 1, sort: 'order', where: { course: { equals: course.id } } })
    let unit = units.docs[0] as unknown as Doc | undefined
    if (!unit) {
      unit = (await payload.create({ collection: 'units', overrideAccess: true, data: { title: 'Talks', course: course.id, order: 1 } as never })) as unknown as Doc
    }
    let orderBase = (await payload.count({ collection: 'lessons', overrideAccess: true, where: { course: { equals: course.id } } })).totalDocs
    const known = await libraryIds(payload)
    let saved = 0
    let waiting = 0
    let failed = 0
    let skipped = 0
    const lessonIds: number[] = []
    const lang = captionLang(body.lang)
    for (const row of rows) {
      if (known.has(row.id)) {
        skipped++
        continue
      }
      orderBase += 1
      const created = (await payload.create({
        collection: 'lessons',
        overrideAccess: true,
        data: {
          title: row.title || `Film ${orderBase}`,
          unit: unit.id,
          course: course.id,
          portal: idOf(course.portal) || undefined,
          master: course.origin === 'master',
          order: orderBase,
          ...(row.speaker ? { speaker: row.speaker } : {}),
          ...(row.jibril ? { jibrilSection: row.jibril } : {}),
          ...(row.ghunya ? { ghunyaHeading: row.ghunya } : {}),
          ...(row.durationSeconds ? { durationSeconds: row.durationSeconds } : {}),
          transcriptSource: 'none',
          transcriptNote: bringInNote('queued', 'Waiting its turn.', lang),
          publishState: 'draft',
          youtubeId: row.id,
          youtubeUrl: row.url,
        } as never,
      })) as unknown as Doc
      known.add(row.id)
      lessonIds.push(created.id)
      await payload.update({
        collection: 'lessons',
        id: created.id,
        overrideAccess: true,
        data: { transcriptNote: bringInNote('processing', 'Waiting for YouTube.', lang) } as never,
      })
      const result = await ingestYoutubeUrl(row.url, {
        lang,
        ...(process.env.HEARTS_YT_FIXTURE === '1' ? { meta: async (id: string) => fixtureMeta(id), duration: async () => null } : {}),
      })
      const decision = decideBringInWrite(result, true, lang)
      const duration = result.durationSeconds && result.durationSeconds > 0 ? Math.round(result.durationSeconds) : row.durationSeconds || 0
      const meta = result.meta
      await payload.update({
        collection: 'lessons',
        id: created.id,
        overrideAccess: true,
        data: {
          ...(meta?.title ? { title: meta.title, sourceTitle: meta.title } : {}),
          ...(duration > 0 ? { durationSeconds: duration } : {}),
          ...(decision.transcript ? { transcript: decision.transcript, transcriptSource: decision.source } : decision.source === 'pending' ? { transcriptSource: 'pending' as const } : {}),
          transcriptNote: decision.note,
          publishState: 'draft',
          ...(row.speaker ? { speaker: row.speaker } : {}),
          ...(row.jibril ? { jibrilSection: row.jibril } : {}),
          ...(row.ghunya ? { ghunyaHeading: row.ghunya } : {}),
        } as never,
      })
      if (decision.raw && decision.transcript && decision.raw !== decision.transcript && decision.raw.length <= 450_000 && result.ok) {
        const media = await payload.create({
          collection: 'media',
          overrideAccess: true,
          data: { alt: `Raw captions ${row.id}`, purpose: 'portal-asset' } as never,
          file: { data: Buffer.from(decision.raw), mimetype: 'text/vtt', name: `${row.id}-raw.vtt`, size: Buffer.byteLength(decision.raw) },
        }).catch(() => null)
        if (media && typeof (media as { id?: number }).id === 'number') {
          await payload.create({
            collection: 'resources',
            overrideAccess: true,
            data: { lesson: created.id, name: 'Raw captions', kind: 'transcript', file: (media as { id: number }).id } as never,
          }).catch(() => undefined)
        }
      }
      if (decision.bucket === 'saved') saved++
      else if (decision.bucket === 'waiting') waiting++
      else failed++
    }
    const notice = bringInFlash({ saved, waiting, failed, skipped, clipsSetAside: 0, drafts: lessonIds.length })
    return { notice, lessons: lessonIds, courseId: course.id }
  })
}

export async function listDraftTalks(payload: Payload, user: SessionUser) {
  const where = draftLessonWhere({ role: user.role, portalId: portalIdOf(user) })
  const docs: Doc[] = []
  let page = 1
  let more = false
  while (docs.length < 400) {
    const found = await payload.find({
      collection: 'lessons',
      overrideAccess: true,
      depth: 0,
      limit: 100,
      page,
      sort: '-updatedAt',
      where: where as never,
    })
    docs.push(...(found.docs as unknown as Doc[]))
    more = Boolean(found.hasNextPage)
    if (!found.hasNextPage) break
    page += 1
  }
  const courseIds = [...new Set(docs.map((row) => idOf(row.course)).filter((id): id is number => Boolean(id)))]
  const courses = courseIds.length
    ? await payload.find({ collection: 'courses', overrideAccess: true, depth: 0, limit: courseIds.length, where: { id: { in: courseIds } } })
    : { docs: [] as { id: number; title?: string | null }[] }
  const titles = new Map(courses.docs.map((course) => [course.id, String((course as { title?: string | null }).title || '')]))
  return {
    more,
    talks: docs.map((row) => ({
      id: row.id,
      title: String(row.title || 'Untitled'),
      courseId: idOf(row.course) || 0,
      courseTitle: titles.get(idOf(row.course) || 0) || '',
      status: bringInStatus(String(row.transcriptNote || '')),
    })),
  }
}

export async function publishTalks(payload: Payload, user: SessionUser, form: FormData) {
  if (!canBring(user)) return { error: 'You cannot publish a talk.' }
  const ids = [...new Set(form.getAll('lesson').map((value) => Number(value)).filter((id) => id > 0))]
  if (!ids.length) return { error: 'Choose at least one talk to publish.' }
  const give = text(form, 'giveHolders') === 'yes'
  const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: ids.length, where: { id: { in: ids } } })
  if (lessons.docs.length !== ids.length) return { error: 'One of those talks could not be found.' }
  const courseIds = new Set<number>()
  let stillHidden = 0
  for (const lesson of lessons.docs as unknown as Doc[]) {
    const courseId = idOf(lesson.course)
    const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null) : null
    const denied = editDenied(user, course as { origin?: string; portal?: unknown } | null)
    if (denied) return { error: denied }
    if (courseId) courseIds.add(courseId)
    await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { publishState: 'published' } as never })
    const status = bringInStatus(String(lesson.transcriptNote || ''))
    if (status === 'waiting' || status === 'failed' || status === 'queued' || status === 'processing') stillHidden++
  }
  const packs = give ? await packsContaining(payload, [...courseIds]) : []
  const given = give ? await giveCourseToPackHolders(payload, [...courseIds]) : { updated: 0, live: 0, users: [] as number[] }
  return {
    notice: publishNotice({
      published: ids.length,
      stillHidden,
      give,
      coursesInPack: packs.length,
      holdersUpdated: given.updated,
      holdersLive: given.live,
    }),
  }
}

/** Publish talks that already have captions, and mark the rest to publish when captions arrive. */
export async function schedulePublishWhenCaptions(payload: Payload, user: SessionUser, form: FormData) {
  if (!canBring(user)) return { error: 'You cannot publish a talk.' }
  const ids = [...new Set(form.getAll('lesson').map((value) => Number(value)).filter((id) => id > 0))]
  if (!ids.length) return { error: 'Choose at least one talk to publish.' }
  const give = text(form, 'giveHolders') === 'yes'
  const lessons = await payload.find({ collection: 'lessons', overrideAccess: true, depth: 0, limit: ids.length, where: { id: { in: ids } } })
  if (lessons.docs.length !== ids.length) return { error: 'One of those talks could not be found.' }
  let published = 0
  let waiting = 0
  let failed = 0
  const publishedCourses = new Set<number>()
  for (const lesson of lessons.docs as unknown as Doc[]) {
    const courseId = idOf(lesson.course)
    const course = courseId ? await payload.findByID({ collection: 'courses', id: courseId, depth: 0, overrideAccess: true }).catch(() => null) : null
    const denied = editDenied(user, course as { origin?: string; portal?: unknown } | null)
    if (denied) return { error: denied }
    const note = String(lesson.transcriptNote || '')
    const status = bringInStatus(note)
    if (status === 'failed') {
      failed++
      continue
    }
    if (captionsBlockPublish(note)) {
      const marked = withCaptionPublishPlan(note, give)
      const mark = give ? '[publish-when-captions-give]' : '[publish-when-captions]'
      const transcriptNote = marked.length <= 500 ? marked : `${marked.slice(0, 499 - mark.length).trim()} ${mark}`
      await payload.update({
        collection: 'lessons',
        id: lesson.id,
        overrideAccess: true,
        data: { transcriptNote } as never,
      })
      waiting++
      continue
    }
    await payload.update({ collection: 'lessons', id: lesson.id, overrideAccess: true, data: { publishState: 'published' } as never })
    published++
    if (courseId) publishedCourses.add(courseId)
  }
  const given = give && publishedCourses.size ? await giveCourseToPackHolders(payload, [...publishedCourses]) : { updated: 0, live: 0, users: [] as number[] }
  return {
    notice: captionReadyNotice({ published, waiting, failed, give, holdersUpdated: given.updated }),
  }
}

export async function saveChannelSpeaker(payload: Payload, user: SessionUser, form: FormData) {
  if (user.role !== 'master') return { error: 'Only the master desk can map a channel to a speaker.' }
  const channelKey = text(form, 'channelKey')
  const speaker = text(form, 'speaker')
  if (!channelKey || !speaker) return { error: 'Type the channel and the speaker.' }
  const existing = await payload.find({
    collection: 'channel-speakers',
    overrideAccess: true,
    limit: 1,
    where: { channelKey: { equals: channelKey } },
  })
  if (existing.docs[0]) {
    await payload.update({ collection: 'channel-speakers', id: existing.docs[0].id, overrideAccess: true, data: { speaker, label: text(form, 'label') || channelKey } as never })
  } else {
    await payload.create({
      collection: 'channel-speakers',
      overrideAccess: true,
      data: { channelKey, speaker, label: text(form, 'label') || channelKey } as never,
    })
  }
  return { notice: `Films from ${channelKey} will use ${speaker} when the course has no speaker of its own.` }
}

export async function deleteChannelSpeaker(payload: Payload, user: SessionUser, form: FormData) {
  if (user.role !== 'master') return { error: 'Only the master desk can remove a channel mapping.' }
  const id = Number(text(form, 'mapping') || 0)
  if (!id) return { error: 'That channel mapping could not be found.' }
  await payload.delete({ collection: 'channel-speakers', id, overrideAccess: true }).catch(() => undefined)
  return { notice: 'That channel no longer sets a speaker.' }
}

export async function createHelperToken(payload: Payload, user: SessionUser, form: FormData) {
  if (user.role !== 'master') return { error: 'Only the master desk can create a helper token.' }
  const label = text(form, 'label') || 'Caption helper'
  const minted = newHelperToken()
  await payload.create({
    collection: 'helper-tokens',
    overrideAccess: true,
    data: { label, tokenHash: minted.hash, tokenPrefix: minted.prefix, createdBy: user.id } as never,
  })
  return { notice: 'Helper token created. Copy it from this page. It will not be shown again.', secret: minted.secret }
}

export async function revokeHelperToken(payload: Payload, user: SessionUser, form: FormData) {
  if (user.role !== 'master') return { error: 'Only the master desk can revoke a helper token.' }
  const id = Number(text(form, 'token') || 0)
  if (!id) return { error: 'That token could not be found.' }
  await payload.update({
    collection: 'helper-tokens',
    id,
    overrideAccess: true,
    data: { revokedAt: new Date().toISOString() } as never,
  })
  return { notice: 'That helper token is revoked. It can no longer list talks or attach transcripts.' }
}
