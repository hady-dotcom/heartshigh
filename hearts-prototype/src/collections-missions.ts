import type { Access, CollectionConfig } from 'payload'

const relation = (name: string) => name as 'users'

const staffRead: Access = ({ req }) => req.user?.role === 'master' || req.user?.role === 'portal-admin'
const masterWrite: Access = ({ req }) => req.user?.role === 'master'
const signedIn: Access = ({ req }) => Boolean(req.user)

const status = {
  name: 'status',
  type: 'select' as const,
  required: true,
  defaultValue: 'draft',
  index: true,
  options: [
    { label: 'Draft', value: 'draft' },
    { label: 'Open', value: 'open' },
    { label: 'Closed', value: 'closed' },
    { label: 'Shared', value: 'shared' },
  ],
}

export const Missions: CollectionConfig = {
  slug: 'missions',
  labels: { singular: 'Mission', plural: 'Missions' },
  admin: { useAsTitle: 'title', group: 'Missions' },
  access: { read: signedIn, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'ask', type: 'textarea', required: true },
    { name: 'why', type: 'textarea' },
    { name: 'minutesAsked', type: 'number', required: true, defaultValue: 60, min: 5, max: 600 },
    { name: 'startsAt', type: 'date', required: true },
    { name: 'endsAt', type: 'date', required: true },
    { name: 'target', type: 'number', required: true, defaultValue: 500, min: 1 },
    { name: 'portals', type: 'relationship', relationTo: 'portals', hasMany: true },
    { name: 'experiment', type: 'relationship', relationTo: relation('experiments') },
    { name: 'tryPath', type: 'text' },
    status,
    { name: 'result', type: 'textarea' },
    { name: 'resultAt', type: 'date' },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
  ],
}

export const MissionJoins: CollectionConfig = {
  slug: 'mission-joins',
  labels: { singular: 'Mission join', plural: 'Mission joins' },
  admin: { group: 'Missions', hidden: true },
  access: { read: staffRead, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'mission', type: 'relationship', relationTo: relation('missions'), required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'joinedAt', type: 'date', required: true },
    { name: 'finishedAt', type: 'date' },
    { name: 'minutes', type: 'number', defaultValue: 0 },
    { name: 'thanked', type: 'checkbox', defaultValue: false },
  ],
}

export const SupportThreads: CollectionConfig = {
  slug: 'support-threads',
  labels: { singular: 'Support thread', plural: 'Support threads' },
  admin: { group: 'Missions', hidden: true },
  access: { read: signedIn, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'status', type: 'select', defaultValue: 'open', options: [{ label: 'Open', value: 'open' }, { label: 'Closed', value: 'closed' }] },
  ],
}

export const SupportMessages: CollectionConfig = {
  slug: 'support-messages',
  labels: { singular: 'Support message', plural: 'Support messages' },
  admin: { group: 'Missions', hidden: true },
  access: { read: signedIn, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'thread', type: 'relationship', relationTo: relation('support-threads'), required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'body', type: 'textarea', required: true },
    { name: 'fromDesk', type: 'checkbox', defaultValue: false },
  ],
}

export const missionCollections = [Missions, MissionJoins, SupportThreads, SupportMessages]
