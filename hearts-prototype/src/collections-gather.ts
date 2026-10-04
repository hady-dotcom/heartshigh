import type { CollectionConfig } from 'payload'

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'
const masterOnly = { read: master, create: master, update: master, delete: master }

const kind = {
  name: 'kind',
  type: 'select' as const,
  defaultValue: 'circle',
  options: [
    { label: 'Circle after a prayer', value: 'circle' },
    { label: 'Tea and talk', value: 'tea' },
    { label: 'Volunteering', value: 'volunteer' },
    { label: 'Walk', value: 'walk' },
    { label: 'Youth night', value: 'youth' },
    { label: 'Picnic', value: 'picnic' },
  ],
}

const audience = {
  name: 'audience',
  type: 'select' as const,
  defaultValue: 'all',
  options: [
    { label: 'Brothers', value: 'brothers' },
    { label: 'Sisters', value: 'sisters' },
    { label: 'Families', value: 'family' },
    { label: 'Youth', value: 'youth' },
    { label: 'Everyone', value: 'all' },
  ],
}

export const Gatherings: CollectionConfig = {
  slug: 'gatherings',
  labels: { singular: 'Gathering', plural: 'Gatherings' },
  admin: { useAsTitle: 'title', description: 'A real meeting at a portal: circle, tea, volunteering, walk, youth night or picnic.' },
  access: masterOnly,
  fields: [
    { name: 'title', type: 'text', required: true },
    kind,
    audience,
    { name: 'startsAt', type: 'date', required: true },
    { name: 'endsAt', type: 'date' },
    { name: 'place', type: 'text' },
    { name: 'mapUrl', type: 'text' },
    { name: 'capacity', type: 'number', min: 0, defaultValue: 0, admin: { description: '0 means no cap.' } },
    { name: 'bring', type: 'textarea' },
    { name: 'note', type: 'textarea' },
    { name: 'host', type: 'relationship', relationTo: 'users' },
    { name: 'hostLabel', type: 'text', admin: { description: 'The name shown on the public page. A role or a first name, not a learner’s full name.' } },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'published',
      options: [
        { label: 'Proposed by a learner', value: 'proposed' },
        { label: 'Published', value: 'published' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'proposedBy', type: 'relationship', relationTo: 'users' },
    { name: 'lesson', type: 'relationship', relationTo: 'lessons' },
    { name: 'course', type: 'relationship', relationTo: 'courses' },
    { name: 'task', type: 'relationship', relationTo: 'engagement-points' },
    { name: 'door', type: 'number', min: 1, max: 20 },
    { name: 'linkLabel', type: 'text' },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'checkinToken', type: 'text', required: true },
    { name: 'prompts', type: 'json' },
    { name: 'circles', type: 'json', admin: { description: 'Small groups for the night. Names only. No scores.' } },
    { name: 'seedKey', type: 'text', unique: true, index: true },
  ],
}

export const GatherRsvps: CollectionConfig = {
  slug: 'gather-rsvps',
  labels: { singular: 'Gather RSVP', plural: 'Gather RSVPs' },
  access: masterOnly,
  fields: [
    { name: 'gathering', type: 'relationship', relationTo: 'gatherings', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'going',
      options: [
        { label: 'Going', value: 'going' },
        { label: 'Maybe', value: 'maybe' },
        { label: "Can't", value: 'cant' },
        { label: 'Waitlist', value: 'waitlist' },
      ],
    },
    { name: 'guestName', type: 'text' },
    { name: 'guestContact', type: 'text' },
    { name: 'guestToken', type: 'text', index: true },
    { name: 'broughtBy', type: 'relationship', relationTo: 'users' },
    { name: 'bringCode', type: 'text' },
    { name: 'remind', type: 'checkbox', defaultValue: false },
    { name: 'seedKey', type: 'text', index: true },
  ],
}

export const GatherCheckins: CollectionConfig = {
  slug: 'gather-checkins',
  labels: { singular: 'Gather check-in', plural: 'Gather check-ins' },
  access: masterOnly,
  fields: [
    { name: 'gathering', type: 'relationship', relationTo: 'gatherings', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users' },
    { name: 'rsvp', type: 'relationship', relationTo: 'gather-rsvps' },
    { name: 'guestLabel', type: 'text' },
    {
      name: 'method',
      type: 'select',
      defaultValue: 'qr',
      options: [
        { label: 'QR at the door', value: 'qr' },
        { label: 'Host', value: 'host' },
      ],
    },
    { name: 'newcomer', type: 'checkbox', defaultValue: false },
    { name: 'welcomed', type: 'checkbox', defaultValue: false },
    { name: 'seedKey', type: 'text', index: true },
  ],
}

export const GatherReflections: CollectionConfig = {
  slug: 'gather-reflections',
  labels: { singular: 'Gather reflection', plural: 'Gather reflections' },
  access: masterOnly,
  fields: [
    { name: 'gathering', type: 'relationship', relationTo: 'gatherings', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true },
    { name: 'body', type: 'textarea', required: true },
  ],
}

export const GatherPhotos: CollectionConfig = {
  slug: 'gather-photos',
  labels: { singular: 'Gather photo', plural: 'Gather photos' },
  access: masterOnly,
  fields: [
    { name: 'gathering', type: 'relationship', relationTo: 'gatherings', required: true, index: true },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    { name: 'caption', type: 'text' },
    { name: 'consent', type: 'checkbox', defaultValue: false },
    { name: 'postedBy', type: 'relationship', relationTo: 'users' },
  ],
}

export const gatherCollections = [Gatherings, GatherRsvps, GatherCheckins, GatherReflections, GatherPhotos]
