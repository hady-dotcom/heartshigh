import type { Access, CollectionConfig } from 'payload'

const staffRead: Access = ({ req }) => req.user?.role === 'master' || req.user?.role === 'portal-admin'
const masterWrite: Access = ({ req }) => req.user?.role === 'master'

export const CalendarSeasons: CollectionConfig = {
  slug: 'calendar-seasons',
  labels: { singular: 'Calendar season', plural: 'Calendar seasons' },
  admin: { useAsTitle: 'name', group: 'Calendar' },
  access: { read: staffRead, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'theme', type: 'text' },
    { name: 'start', type: 'date', required: true },
    { name: 'end', type: 'date', required: true },
    { name: 'nudgeTalks', type: 'checkbox', defaultValue: true },
    { name: 'usePopular', type: 'checkbox', defaultValue: false },
  ],
}

export const CalendarCopy: CollectionConfig = {
  slug: 'calendar-copy',
  labels: { singular: 'Calendar line', plural: 'Calendar lines' },
  admin: { useAsTitle: 'label', group: 'Calendar' },
  access: { read: staffRead, create: masterWrite, update: masterWrite, delete: masterWrite },
  fields: [
    { name: 'slot', type: 'text', required: true, index: true },
    { name: 'context', type: 'text', required: true, index: true },
    { name: 'label', type: 'text', required: true },
    { name: 'approved', type: 'checkbox', defaultValue: false, index: true },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'staff',
      options: [
        { label: 'Written on the desk', value: 'staff' },
        { label: 'Suggested by AI', value: 'ai' },
        { label: 'Mock draft', value: 'mock' },
      ],
    },
    { name: 'createdBy', type: 'relationship', relationTo: 'users' },
    { name: 'approvedBy', type: 'relationship', relationTo: 'users' },
  ],
}

export const calendarCollections = [CalendarSeasons, CalendarCopy]
