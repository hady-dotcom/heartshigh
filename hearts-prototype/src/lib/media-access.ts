import { idOf, portalIdOf } from './ids'

export const MEDIA_PURPOSES = ['answer', 'gather-photo', 'portal-asset', 'film', 'feedback'] as const
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number]

export type MediaReader = {
  id: number
  role?: string | null
  tenants?: { tenant?: unknown }[]
} | null

export type MediaDoc = {
  id?: number
  owner?: unknown
  purpose?: string | null
  portal?: unknown
}

export type LinkedAnswer = {
  user?: unknown
  portal?: unknown
  keepPrivate?: boolean | null
  shareWithTeacher?: boolean | null
  shareWithLearners?: boolean | null
} | null

/**
 * Media rows that signed-in portal members (and the master) may read without an answer share.
 *
 * These count as public Media:
 * - `portal-asset`: speaker photos stored on Media, leftover portal uploads, unmatched rows after migration
 * - `film`: a lesson's uploaded file (`lessons.film_id`)
 *
 * These are not Media rows. They stay readable signed out, from disk or YouTube:
 * - talk thumbnails: `/clips/{youtubeId}.jpg` or `https://i.ytimg.com/vi/…`
 * - speaker portraits: `/speakers/{slug}.jpg`
 * - scenic / slide art: `/slides/bg-*.jpg` and `/theme/…`
 * - catalogue stills via `/backgrounds/jpg/…` (short signed S3 GET; not a Media row)
 *
 * Answer and feedback files are never public. A file nobody owns that an answer
 * still references is treated as that answer's file (private unless the share flags allow it).
 */
export const PUBLIC_MEDIA_PURPOSES = ['portal-asset', 'film'] as const

export function isMediaPurpose(value: unknown): value is MediaPurpose {
  return typeof value === 'string' && (MEDIA_PURPOSES as readonly string[]).includes(value)
}

export function isPublicPurpose(purpose: string | null | undefined) {
  return purpose === 'portal-asset' || purpose === 'film'
}

/** The app's own authorised file URL. Payload's `/api/media/file/…` stays gated by Media.read. */
export function heartsFileUrl(media: unknown) {
  const id = idOf(media)
  return id ? `/api/hearts/file/${id}` : null
}

/** Same sharing rules as Answers.ownerOrStaff(true, 'keepPrivate'). */
export function canReadLinkedAnswer(user: MediaReader, answer: LinkedAnswer) {
  if (!user || !answer) return false
  const ownerId = idOf(answer.user)
  if (ownerId === user.id) return true
  if (answer.keepPrivate) return false
  if (user.role === 'master') return true
  if (user.role === 'learner') return Boolean(answer.shareWithLearners)
  const portal = portalIdOf(user)
  if (!portal || idOf(answer.portal) !== portal) return false
  if (user.role === 'teacher') return Boolean(answer.shareWithTeacher)
  return user.role === 'portal-admin'
}

/**
 * Who may open one media file.
 * Listing never includes answer or feedback files — those are opened by id, after the answer rules.
 */
export function canReadMedia(user: MediaReader, media: MediaDoc, answer: LinkedAnswer, listing = false) {
  if (!user) return false
  const ownerId = idOf(media.owner)
  if (ownerId === user.id) return !listing || isPublicPurpose(media.purpose)
  // A file attached to an answer is never a portal-wide public file, even when
  // nobody was written as owner and purpose was left blank.
  if (answer) {
    if (listing) return false
    return canReadLinkedAnswer(user, answer)
  }
  const purpose = media.purpose || 'portal-asset'
  if (listing && (purpose === 'answer' || purpose === 'feedback')) return false
  if (isPublicPurpose(purpose) || purpose === 'gather-photo') {
    if (user.role === 'master') return true
    const portal = portalIdOf(user)
    return Boolean(portal && idOf(media.portal) === portal)
  }
  return false
}

/** Where clause for a media list: portal assets, films, and gather photos. Never answer files. */
export function mediaListWhere(user: NonNullable<MediaReader>) {
  const portal = portalIdOf(user)
  const publicPurposes = [...PUBLIC_MEDIA_PURPOSES]
  if (user.role === 'master') {
    return { purpose: { in: [...publicPurposes, 'gather-photo'] } }
  }
  if (!portal) return { id: { equals: -1 } }
  if (user.role === 'learner') {
    return { and: [{ portal: { equals: portal } }, { purpose: { in: publicPurposes } }] }
  }
  return { and: [{ portal: { equals: portal } }, { purpose: { in: [...publicPurposes, 'gather-photo'] } }] }
}
