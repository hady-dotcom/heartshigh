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

export function isMediaPurpose(value: unknown): value is MediaPurpose {
  return typeof value === 'string' && (MEDIA_PURPOSES as readonly string[]).includes(value)
}

export function isPublicPurpose(purpose: string | null | undefined) {
  return purpose === 'portal-asset' || purpose === 'film'
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
  const purpose = media.purpose || (answer ? 'answer' : 'portal-asset')
  if (listing && (purpose === 'answer' || purpose === 'feedback')) return false
  if (isPublicPurpose(purpose)) {
    if (user.role === 'master') return true
    const portal = portalIdOf(user)
    return Boolean(portal && idOf(media.portal) === portal)
  }
  if (purpose === 'gather-photo') {
    if (user.role === 'master') return true
    const portal = portalIdOf(user)
    return Boolean(portal && idOf(media.portal) === portal)
  }
  if (purpose === 'answer' || purpose === 'feedback') return canReadLinkedAnswer(user, answer)
  return false
}

/** Where clause for a media list: own public files, portal assets, films, and gather photos. Never answer files. */
export function mediaListWhere(user: NonNullable<MediaReader>) {
  const portal = portalIdOf(user)
  const publicPurposes = ['portal-asset', 'film']
  if (user.role === 'master') {
    return { purpose: { in: [...publicPurposes, 'gather-photo'] } }
  }
  if (!portal) return { id: { equals: -1 } }
  if (user.role === 'learner') {
    return { and: [{ portal: { equals: portal } }, { purpose: { in: publicPurposes } }] }
  }
  return { and: [{ portal: { equals: portal } }, { purpose: { in: [...publicPurposes, 'gather-photo'] } }] }
}
