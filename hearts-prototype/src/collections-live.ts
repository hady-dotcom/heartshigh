import type { CollectionConfig } from 'payload'

const master = ({ req }: { req: { user?: { role?: string } | null } }) => req.user?.role === 'master'
const masterOnly = { read: master, create: master, update: master, delete: master }

export const LiveSessions: CollectionConfig = {
  slug: 'live-sessions',
  labels: { singular: 'Live session', plural: 'Live sessions' },
  admin: { useAsTitle: 'title', description: 'A teacher going live for the learners of one portal.' },
  access: masterOnly,
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'door', type: 'number', min: 1, max: 20 },
    { name: 'host', type: 'relationship', relationTo: 'users', required: true },
    { name: 'hostName', type: 'text' },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'youtube',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
        { label: 'Mux', value: 'mux' },
      ],
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'youtubeId', type: 'text' },
    { name: 'vimeoId', type: 'text' },
    { name: 'muxStreamId', type: 'text' },
    { name: 'muxStreamKey', type: 'text' },
    { name: 'muxRtmpUrl', type: 'text' },
    { name: 'muxPlaybackId', type: 'text' },
    { name: 'vodUrl', type: 'text' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Live', value: 'live' },
        { label: 'Ended', value: 'ended' },
      ],
    },
    { name: 'scheduledAt', type: 'date' },
    { name: 'startedAt', type: 'date' },
    { name: 'endedAt', type: 'date' },
    { name: 'viewerCount', type: 'number', defaultValue: 0 },
    { name: 'replayLesson', type: 'relationship', relationTo: 'lessons' },
    { name: 'seedKey', type: 'text', unique: true, index: true },
  ],
}

export const LiveQuestions: CollectionConfig = {
  slug: 'live-questions',
  labels: { singular: 'Live question', plural: 'Live questions' },
  access: masterOnly,
  fields: [
    { name: 'session', type: 'relationship', relationTo: 'live-sessions' as 'lessons', required: true, index: true },
    { name: 'author', type: 'relationship', relationTo: 'users', required: true },
    { name: 'authorName', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
    { name: 'hidden', type: 'checkbox', defaultValue: false },
    { name: 'answered', type: 'checkbox', defaultValue: false },
    { name: 'pinned', type: 'checkbox', defaultValue: false },
  ],
}

export const LiveReminders: CollectionConfig = {
  slug: 'live-reminders',
  labels: { singular: 'Live reminder', plural: 'Live reminders' },
  access: masterOnly,
  fields: [
    { name: 'session', type: 'relationship', relationTo: 'live-sessions' as 'lessons', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
  ],
}

export const LivePresence: CollectionConfig = {
  slug: 'live-presence',
  labels: { singular: 'Live presence', plural: 'Live presence' },
  access: masterOnly,
  fields: [
    { name: 'session', type: 'relationship', relationTo: 'live-sessions' as 'lessons', required: true, index: true },
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    { name: 'lastSeenAt', type: 'date', required: true },
  ],
}

export const liveCollections = [LiveSessions, LiveQuestions, LiveReminders, LivePresence]
