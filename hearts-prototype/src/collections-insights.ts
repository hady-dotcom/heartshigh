import type { Access, CollectionConfig } from 'payload'

const relation = (name: string) => name as 'users'

const staffRead: Access = ({ req }) => req.user?.role === 'master' || req.user?.role === 'portal-admin'
const masterWrite: Access = ({ req }) => req.user?.role === 'master'
const nobody: Access = () => false

export const InsightEvents: CollectionConfig = {
  slug: 'insight-events',
  labels: { singular: 'Insight event', plural: 'Insight events' },
  admin: { group: 'Insights', hidden: true },
  access: { read: staffRead, create: nobody, update: nobody, delete: masterWrite },
  fields: [
    { name: 'kind', type: 'text', required: true, index: true },
    { name: 'route', type: 'text', required: true, index: true },
    { name: 'sessionId', type: 'text', required: true, index: true },
    { name: 'subject', type: 'text', index: true },
    { name: 'learner', type: 'relationship', relationTo: 'users', index: true },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'x', type: 'number' },
    { name: 'y', type: 'number' },
    { name: 'vw', type: 'number' },
    { name: 'vh', type: 'number' },
    { name: 'depth', type: 'number' },
    { name: 'clipId', type: 'text' },
    { name: 'watchPct', type: 'number' },
    { name: 'step', type: 'text', index: true },
    { name: 'interactive', type: 'checkbox', defaultValue: false },
    { name: 'sampled', type: 'checkbox', defaultValue: true },
    { name: 'props', type: 'json' },
    { name: 'at', type: 'date', required: true, index: true },
  ],
}

export const InsightSessions: CollectionConfig = {
  slug: 'insight-sessions',
  labels: { singular: 'Insight session', plural: 'Insight sessions' },
  admin: { group: 'Insights', hidden: true },
  access: { read: staffRead, create: nobody, update: nobody, delete: masterWrite },
  fields: [
    { name: 'sessionId', type: 'text', required: true, unique: true, index: true },
    { name: 'subject', type: 'text', index: true },
    { name: 'learner', type: 'relationship', relationTo: 'users', index: true },
    { name: 'deviceId', type: 'text', index: true },
    { name: 'portal', type: 'relationship', relationTo: 'portals', index: true },
    { name: 'sampled', type: 'checkbox', defaultValue: true },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'endedAt', type: 'date' },
    { name: 'routes', type: 'json' },
  ],
}

export const insightCollections = [InsightEvents, InsightSessions]
export { relation }
