import type { Access, CollectionConfig, Where } from 'payload'
import { portalIdOf } from './lib/ids'
import { mediaListWhere } from './lib/media-access'
import { REPORT_LABEL } from './lib/safety'

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'
const masterOnly = { read: master, create: master, update: master, delete: master }

function staffRead(): Access {
  return ({ req }) => {
    const user = req.user as { id: number; role?: string; tenants?: { tenant?: unknown }[] } | null
    if (!user) return false
    if (user.role === 'master') return true
    if (user.role === 'learner') return false
    const portal = portalIdOf(user)
    return portal ? { portal: { equals: portal } } : false
  }
}

const staffOnly = { read: staffRead(), create: master, update: master, delete: master }

export const Reports: CollectionConfig = {
  slug: 'reports',
  labels: { singular: 'Report', plural: 'Reports' },
  admin: { useAsTitle: 'reason', description: 'A calm concern from a learner. The reported person never sees who wrote it.' },
  access: staffOnly,
  fields: [
    { name: 'reporter', type: 'relationship', relationTo: 'users', required: true },
    { name: 'targetType', type: 'text', required: true, index: true },
    { name: 'targetId', type: 'number', required: true, index: true },
    {
      name: 'reason',
      type: 'select',
      required: true,
      options: Object.entries(REPORT_LABEL).map(([value, label]) => ({ value, label })),
    },
    { name: 'note', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Kept', value: 'kept' },
        { label: 'Escalated', value: 'escalated' },
      ],
    },
    { name: 'handledBy', type: 'relationship', relationTo: 'users' },
    { name: 'handledAt', type: 'date' },
    { name: 'handleNote', type: 'textarea' },
  ],
}

export const ModerationHides: CollectionConfig = {
  slug: 'moderation-hides',
  labels: { singular: 'Hidden item', plural: 'Hidden items' },
  access: staffOnly,
  fields: [
    { name: 'targetType', type: 'text', required: true, index: true },
    { name: 'targetId', type: 'number', required: true, index: true },
    { name: 'reason', type: 'text' },
    { name: 'source', type: 'select', defaultValue: 'report', options: [
      { label: 'Report', value: 'report' },
      { label: 'Word screen', value: 'screen' },
      { label: 'Staff', value: 'staff' },
    ] },
    { name: 'hidden', type: 'checkbox', defaultValue: true },
    { name: 'by', type: 'relationship', relationTo: 'users' },
  ],
}

export const SafeguardingAlerts: CollectionConfig = {
  slug: 'safeguarding-alerts',
  labels: { singular: 'Safeguarding alert', plural: 'Safeguarding alerts' },
  access: staffOnly,
  fields: [
    { name: 'learner', type: 'relationship', relationTo: 'users', required: true },
    { name: 'source', type: 'select', required: true, options: [
      { label: 'Crisis option', value: 'crisis' },
      { label: 'Word screen', value: 'screen' },
      { label: 'Report', value: 'report' },
    ] },
    { name: 'targetType', type: 'text' },
    { name: 'targetId', type: 'number' },
    { name: 'seenBy', type: 'relationship', relationTo: 'users' },
    { name: 'seenAt', type: 'date' },
    { name: 'outcome', type: 'textarea' },
  ],
}

export const Announcements: CollectionConfig = {
  slug: 'announcements',
  labels: { singular: 'Announcement', plural: 'Announcements' },
  access: staffOnly,
  fields: [
    { name: 'body', type: 'textarea', required: true, maxLength: 500 },
    { name: 'audience', type: 'select', defaultValue: 'everyone', options: [
      { label: 'Everyone in the portal', value: 'everyone' },
      { label: 'Teachers only', value: 'teachers' },
      { label: 'One access code', value: 'code' },
    ] },
    { name: 'accessCode', type: 'relationship', relationTo: 'access-codes' },
    { name: 'publishAt', type: 'date' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
  ],
}

export const AnnouncementDismissals: CollectionConfig = {
  slug: 'announcement-dismissals',
  access: masterOnly,
  fields: [
    { name: 'announcement', type: 'relationship', relationTo: 'announcements', required: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
  ],
}

export const RateHits: CollectionConfig = {
  slug: 'rate-hits',
  access: masterOnly,
  fields: [
    { name: 'key', type: 'text', required: true, index: true },
    { name: 'at', type: 'date', required: true, index: true },
  ],
}

export const CircleMutes: CollectionConfig = {
  slug: 'circle-mutes',
  access: staffOnly,
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'until', type: 'date', required: true },
    { name: 'by', type: 'relationship', relationTo: 'users' },
    { name: 'reason', type: 'text' },
  ],
}

export const safetyCollections = [Reports, ModerationHides, SafeguardingAlerts, Announcements, AnnouncementDismissals, RateHits, CircleMutes]

/** Media.read used from collections.ts. Kept here so the rule lives with Lane C. */
export function mediaReadAccess({ req, id }: { req: { user?: { id: number; role?: string; tenants?: { tenant?: unknown }[] } | null; payload?: { findByID?: Function; find?: Function } }; id?: string | number }) {
  const user = req.user
  if (!user) return false
  if (!id) return mediaListWhere(user) as Where
  return (async () => {
    const payload = req.payload
    if (!payload?.findByID) return false
    const media = await payload.findByID({ collection: 'media', id, overrideAccess: true, depth: 0 }).catch(() => null)
    if (!media) return false
    const { canReadMedia } = await import('./lib/media-access')
    const answer = await linkedAnswerFor(payload, media)
    return canReadMedia(user, media, answer, false)
  })()
}

async function linkedAnswerFor(payload: { find?: Function }, media: { id?: number; purpose?: string | null }) {
  if (!payload.find || !media.id) return null
  if (media.purpose === 'feedback') {
    const notes = await payload.find({ collection: 'feedback-notes', overrideAccess: true, depth: 0, limit: 1, where: { or: [{ audio: { equals: media.id } }, { image: { equals: media.id } }] } }).catch(() => ({ docs: [] }))
    const note = notes.docs[0] as { answer?: unknown } | undefined
    if (!note?.answer) return null
    const answers = await payload.find({ collection: 'answers', overrideAccess: true, depth: 0, limit: 1, where: { id: { equals: typeof note.answer === 'object' && note.answer && 'id' in note.answer ? (note.answer as { id: number }).id : note.answer } } }).catch(() => ({ docs: [] }))
    return answers.docs[0] || null
  }
  const found = await payload.find({
    collection: 'answers',
    overrideAccess: true,
    depth: 0,
    limit: 1,
    where: { or: [{ image: { equals: media.id } }, { audio: { equals: media.id } }, { video: { equals: media.id } }] },
  }).catch(() => ({ docs: [] }))
  return found.docs[0] || null
}
